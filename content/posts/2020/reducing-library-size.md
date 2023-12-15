---
title: Reducing {fmt} library size 4x using Bloaty McBloatface
date: 2020-05-21
aliases: ['/2020/05/21/reducing-library-size.html']
---

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em; width: 40%">
<a href="/img/puffer.jpg">
  <img border="0" src="/img/puffer.jpg" width="100%"
       title="Use templates they said...">
</a>
</div>

When it comes to comparing different software solutions, speed is often the main
if not the only factor considered. This is not the case in [the {fmt} library](
https://github.com/fmtlib/fmt) which tries to find a good balance between speed,
binary size and compile times by default and give you an option to get maximum
performance in cases that matter.

A lot of effort has been put into making binary code at the usage site very
compact, comparable to that of `printf`. For example
([godbolt](https://godbolt.org/z/5KSrMz)):

```c++
#include <fmt/core.h>

int main() {
  fmt::print("The answer is {}.\n", 42);
}
```

compiles to just

```
main:                                   # @main
        sub     rsp, 24
        mov     qword ptr [rsp], 42
        mov     rcx, rsp
        mov     edi, offset .L.str
        mov     esi, 18
        mov     edx, 1
        call    fmt::v6::vprint(fmt::v6::basic_string_view<char>, fmt::v6::format_args)
        xor     eax, eax
        add     rsp, 24
        ret
.L.str:
        .asciz  "The answer is {}.\n"
```

Compare this to iostreams ([godbolt](https://godbolt.org/z/QmrCC7)):

```c++
#include <iostream>

int main() {
  std::cout << "The answer is " << 42 << ".\n";
}
```

```
main:                                   # @main
        push    rax
        mov     edi, offset std::cout
        mov     esi, offset .L.str
        mov     edx, 14
        call    std::basic_ostream<char, std::char_traits<char> >& std::__ostream_insert<char, std::char_traits<char> >(std::basic_ostream<char, std::char_traits<char> >&, char const*, long)
        mov     edi, offset std::cout
        mov     esi, 42
        call    std::basic_ostream<char, std::char_traits<char> >::operator<<(int)
        mov     esi, offset .L.str.1
        mov     edx, 2
        mov     rdi, rax
        call    std::basic_ostream<char, std::char_traits<char> >& std::__ostream_insert<char, std::char_traits<char> >(std::basic_ostream<char, std::char_traits<char> >&, char const*, long)
        xor     eax, eax
        pop     rcx
        ret
_GLOBAL__sub_I_example.cpp:             # @_GLOBAL__sub_I_example.cpp
        push    rax
        mov     edi, offset std::__ioinit
        call    std::ios_base::Init::Init() [complete object constructor]
        mov     edi, offset std::ios_base::Init::~Init() [complete object destructor]
        mov     esi, offset std::__ioinit
        mov     edx, offset __dso_handle
        pop     rax
        jmp     __cxa_atexit            # TAILCALL
.L.str:
        .asciz  "The answer is "

.L.str.1:
        .asciz  ".\n"
```
(You can ignore the `_GLOBAL__sub_I_example.cpp` part.)

Not only {fmt}'s binary code is smaller, it has fewer function
calls and is [faster](https://github.com/fmtlib/fmt#benchmarks). And this is one
of the best cases for iostreams specifically chosen to avoid blog post bloat.
With `ostringstream` the compiler can generate half of a kilobyte of binary code
even for trivial formatting (see e.g. [Binary code comparison](
https://fmt.dev/papers/p0645.html#BinaryCode)).
Code bloat is a common problem with [concatenation-based formatting](
https://accu.org/index.php/journals/1539) methods compared to replacement-based
ones like `printf`.

While per-use binary size in {fmt} is highly optimized, little effort has been
put so far into making the library itself smaller. We try not to do anything
obviously silly that would result in an explosion of template instantiations but
little more than that.

At the same time, reducing library size has been a frequently requested feature
from folks working on mobile and embedded systems. So I finally decided to look
into this problem more systematically. In this post I use the wonderfully named
and overall super nice tool called [Bloaty McBloatface](
https://github.com/google/bloaty), a size profiler for binaries, to try making
the {fmt} library smaller.

Let's use the earlier example and compile it with {fmt} revision
[5b02881](https://github.com/fmtlib/fmt/commit/5b02881582bb6b375421ea729cb2cd57735836eb).

`test.cc`:
```c++
#include <fmt/core.h>

int main() {
  fmt::print("The answer is {}.\n", 42);
}
```

```
% clang++ -std=c++17  -I include -O2 -DNDEBUG test.cc src/format.cc
% strip a.out
% ls -l a.out
...  367708 May 21 08:24 a.out
```

So we start with ~368k which seems excessive even considering that {fmt}
implements a replacement for `(s)printf`, iostreams and [double-conversion](
https://github.com/google/double-conversion) including full implementation of
[Grisu3](https://www.cs.tufts.edu/~nr/cs257/archive/florian-loitsch/printf.pdf)
and [Dragon4](http://kurtstephens.com/files/p372-steele.pdf) floating point
formatting algorithms. Can we do better?

Recompiling the test binary to restore symbols and running bloaty gives the
following result:
```
% bloaty a.out -d symbols
     VM SIZE                                                                    FILE SIZE
 --------------                                                              --------------
  59.5%   242Ki fmt::v6::internal::basic_writer<>::write_padded<>()            242Ki  59.5%
  13.3%  54.1Ki [152 Others]                                                  54.1Ki  13.3%
   3.4%  13.7Ki fmt::v6::internal::format_decimal<>()                         13.7Ki   3.4%
   3.0%  12.3Ki fmt::v6::internal::basic_writer<>::int_writer<>::on_num()     12.3Ki   3.0%
   ...
```
As you can see `write_padded` is responsible for 59% of the binary code. So much
for not doing anything silly 🤦😂. This function adds padding before and after
the formatted argument so that it appears aligned to the left, center, or right
per format specifications.
For example, in
```c++
fmt::print("{:>10}", 42);
```
it will write 8 spaces and then call a function that writes "42".

```c++
template <typename F> void write_padded(const format_specs& specs, F&& f) {
  unsigned width = to_unsigned(specs.width);
  size_t size = f.size();
  size_t num_code_points = width != 0 ? f.width() : size;
  if (width <= num_code_points) return f(reserve(size));
  size_t padding = width - num_code_points;
  size_t fill_size = specs.fill.size();
  auto&& it = reserve(size + padding * fill_size);
  if (specs.align == align::right) {
    it = fill(it, padding, specs.fill);
    f(it);
  } else if (specs.align == align::center) {
    std::size_t left_padding = padding / 2;
    it = fill(it, left_padding, specs.fill);
    f(it);
    it = fill(it, padding - left_padding, specs.fill);
  } else {
    f(it);
    it = fill(it, padding, specs.fill);
  }
}
```
Here `f.size()` returns the data size in code units, `f.width()` returns
width in user-perceived characters and `f(it)` writes the data.

`write_padded` itself is relatively small but because it's used in many places
and thanks to overly eager inliner we get this code bloat. Fortunately it has
turned out to be a recent issue which hasn't affected most of the earlier
library versions and also very easy to fix - just mark the `fill` function
called from `write_padded` as `noinline`:

```c++
__attribute__((noinline)) OutputIt fill(
    OutputIt it, size_t n, const fill_t<Char>& fill) {
  ...
}
```
This trivial change reduced the binary size from ~368k to ~245k which is better
but still not perfect. Let's look at full symbols to see why we have so many
instantiations:
```
% bloaty a.out -d fullsymbols
     VM SIZE                                                                  FILE SIZE
 --------------                                                            --------------
  71.8%   206Ki [358 Others]                                                206Ki  71.9%
   3.8%  10.8Ki [__LINKEDIT]                                               10.8Ki   3.7%
   1.8%  5.11Ki void fmt::...fallback_format<double>(double, fmt::v6::int  5.11Ki   1.8%
   1.5%  4.21Ki void fmt::...<fmt::v6::buffer_range<wchar_t> >::write_pad  4.21Ki   1.5%
   1.4%  4.09Ki void fmt::...<fmt::v6::buffer_range<wchar_t> >::write_pad  4.09Ki   1.4%
   1.4%  4.03Ki void fmt::...<fmt::v6::buffer_range<wchar_t> >::write_pad  4.03Ki   1.4%
   ...
```

Many of the instantiations are for `wchar_t` which we don't even need. A simple
way to get rid of those is by using link-time optimization (LTO):
```
clang++ test.cc -O2 -I include -std=c++17 src/format.cc -DNDEBUG -flto
```
This reduces the binary size to ~164k. To get the same reduction without LTO
let's remove the `wchar_t` `vformat` instantiation:
```c++
template FMT_API std::wstring internal::vformat<wchar_t>(
    wstring_view, basic_format_args<wformat_context>);
```
This way users don't pay for what they don't use.

While at it I also noticed and nuked a few deprecated functions such as
```
     VM SIZE                                                                    FILE SIZE
 --------------                                                              --------------
   ...
   0.4%  1.28Ki fmt::v6::internal::arg_map<>::init()                         1.28Ki   0.4%
```

and another interesting thing - we get `type_info` for `std::allocator`
which is not even a polymorphic type:
```
   0.0%      65 typeinfo name for std::__1::allocator<char>                      65   0.0%
   0.0%      65 typeinfo name for std::__1::allocator<unsigned int>              65   0.0%
   0.0%      65 typeinfo name for std::__1::allocator<wchar_t>                   65   0.0%
```

The type info is generated because we use the empty base class optimization in
`memory_buffer`, which is a polymorphic class, inheriting from `std::allocator`:
```c++
template <typename T, std::size_t SIZE = inline_buffer_size,
          typename Allocator = std::allocator<T>>
class basic_memory_buffer : private Allocator ...
```
The type info is tiny but let's nuke it too replacing inheritance with
composition to reduce symbol noise:
```c++
template <typename T, std::size_t SIZE = inline_buffer_size,
          typename Allocator = std::allocator<T>>
class basic_memory_buffer : ... {
  Allocator alloc_;
  ...
};
```
In C++20 we'll be able to use [`[[no_unique_address]]`](
https://en.cppreference.com/w/cpp/language/attributes/no_unique_address) to get
the same optimization without the unwanted side-effects.

This brings library size to ~132k (mostly thanks to removing `wchar_t`
instantiations), even better than with LTO. However, `write_padded` still
takes way too much space:

```
     VM SIZE                                                                 FILE SIZE
 --------------                                                           --------------
  30.7%  48.0Ki fmt::v6::internal::basic_writer<>::write_padded<>()        48.0Ki  30.9%
  26.0%  40.5Ki [128 Others]                                               40.4Ki  26.0%
   6.5%  10.2Ki [__LINKEDIT]                                               9.34Ki   6.0%
   ...
```

Let's improve it by doing all the padding computation first and reducing the
number of calls to `fill`:
```c++
template <typename F> void write_padded(const format_specs& specs, F&& f) {
  unsigned width = to_unsigned(specs.width);
  size_t size = f.size();
  size_t num_code_points = width != 0 ? f.width() : size;
  size_t padding = width > num_code_points ? width - num_code_points : 0;
  size_t left_padding = 0;
  if (specs.align == align::right)
    left_padding = padding;
  else if (specs.align == align::center)
    left_padding = padding / 2;
  auto&& it = reserve(size + padding * specs.fill.size());
  it = fill(it, left_padding, specs.fill);
  f(it);
  it = fill(it, padding - left_padding, specs.fill);
}
```

This brings the size to 108k. Now let's reduce branching by using a bit shift
to compute `left_padding`. Also while at it let's pass the size and width
explicitly:

```c++
const char padding_shifts[] = {
// shift     align    meaning
// -----     -------  -------
      31, // default  same as left
      31, // left     shift left padding out of existence
       0, // right    left padding takes it all
       1, // center   left padding gets half
       0  // numeric  I don't even but let's say it's similar to right
};

template <typename F>
void write_padded(const format_specs& specs, size_t size, size_t width,
                  const F& f) {
  unsigned spec_width = to_unsigned(specs.width);
  size_t padding = spec_width > width ? spec_width - width : 0;
  size_t left_padding = padding >> data::padding_shifts[specs.align];
  auto&& it = reserve(size + padding * specs.fill.size());
  it = fill(it, left_padding, specs.fill);
  it = f(it);
  it = fill(it, padding - left_padding, specs.fill);
}
```
Now we are at ~104k and optimized `write_padded` so much (30x) that it is no
longer the main contributor to the binary size (yay!):

```
     VM SIZE                                                                 FILE SIZE
 --------------                                                           --------------
  30.6%  37.9Ki [125 Others]                                               37.8Ki  30.6%
   8.0%  9.95Ki [__LINKEDIT]                                               9.39Ki   7.6%
   7.5%  9.24Ki fmt::v6::internal::basic_writer<>::write_int<>()           9.24Ki   7.5%
   6.4%  7.97Ki fmt::v6::internal::write_padded<>()                        7.97Ki   6.5%
   ...
```

Let's look into `write_int` which is an internal function used for fancy
integer formatting. It writes an integer in the format
`<left-padding><prefix><numeric-padding><digits><right-padding>` per
format specs:
```c++
template <typename F>
void write_int(int num_digits, string_view prefix, format_specs specs, F f) {
  std::size_t size = prefix.size() + to_unsigned(num_digits);
  char_type fill = specs.fill[0];
  std::size_t padding = 0;
  if (specs.align == align::numeric) {
    auto unsiged_width = to_unsigned(specs.width);
    if (unsiged_width > size) {
      padding = unsiged_width - size;
      size = unsiged_width;
    }
  } else if (specs.precision > num_digits) {
    size = prefix.size() + to_unsigned(specs.precision);
    padding = to_unsigned(specs.precision - num_digits);
    fill = static_cast<char_type>('0');
  }
  if (specs.align == align::none) specs.align = align::right;
  out_ = write_padded(out_, specs, size, [=](reserve_iterator it) {
    ...
  });
}
```
Here `prefix` is a base prefix such as "0x" and `f` is a callable that writes
digits through the output iterator. We can optimize this by moving the part that
doesn't depend on `F` to a separate function only parameterized by the character
type:

```c++
template <typename Char> struct write_int_params {
  std::size_t size;
  std::size_t padding;
  Char fill;
};

template <typename Char>
write_int_params<Char> make_write_int_params(int num_digits, string_view prefix,
                                             basic_format_specs<Char>& specs) {
  std::size_t size = prefix.size() + to_unsigned(num_digits);
  Char fill = specs.fill[0];
  std::size_t padding = 0;
  if (specs.align == align::numeric) {
    auto width = to_unsigned(specs.width);
    if (width > size) {
      padding = width - size;
      size = width;
    }
  } else if (specs.precision > num_digits) {
    size = prefix.size() + to_unsigned(specs.precision);
    padding = to_unsigned(specs.precision - num_digits);
    fill = static_cast<Char>('0');
  }
  if (specs.align == align::none) specs.align = align::right;
  return {size, padding, fill};
}

template <typename F>
void write_int(int num_digits, string_view prefix, format_specs specs, F f) {
  auto params = make_write_int_params(num_digits, prefix, specs);
  out_ = write_padded(out_, specs, params.size, [=](reserve_iterator it) {
    ...
  });
}
```

Bloaty also shows some suspicious instantiations of `int_writer` for signed
integral types:
```
     VM SIZE                                                          FILE SIZE
 --------------                                                    --------------
   ...
   0.7%     863 fmt::...basic_writer<...>::int_writer<int...       863   0.7%
   0.7%     863 fmt::...basic_writer<...>::int_writer<long...      863   0.7%
```
Why are these suspicious? {fmt} tries to reduce the number of instantiations of
internal templates by mapping integral types into a smaller subset which still
covers all possible bit sizes. On most platforms it's just 3 unsigned types:
32-bit, 64-bit and 128-bit. However, `int_writer` slipped through the cracks and
was accidentally instantiated for signed types. This also explains much of the
code bloat we've seen so far because those functions are used from `int_writer`.

```c++
template <typename Int> struct int_writer {
  using unsigned_type = uint32_or_64_or_128_t<Int>;

  int_writer(basic_writer<Range>& w, Int value,
             const basic_format_specs<char_type>& s)
      : abs_value(static_cast<unsigned_type>(value)), ...
```
The fix is to move type mapping (`uint32_or_64_or_128_t<Int>`) from the
`int_writer` class to its constructor and add a static assert so that it doesn't
happen again:
```c++
 template <typename UInt> struct int_writer {
  template <typename Int>
  int_writer(basic_writer<Range>& w, Int value,
             const basic_format_specs<char_type>& s)
      : abs_value(static_cast<UInt>(value)), ... {
    static_assert(std::is_same<uint32_or_64_or_128_t<Int>, UInt>::value, "");
  }
```

This reduces the binary size to ~92k. We can go even further by compiling with
`-Os` instead of `-O2` which gives ~75k or with `-Os -flto` which gives ~57k.

**Summary**

With the help of Bloaty McBloatface and a few simple transformations we managed
to reduce library size 4x, from 368k to just 92k without affecting performance.
These improvements have been achieved by

* reducing the number of template instantiations,
* reducing inlining,
* moving code that doesn't have to be parameterized outside of templates,
* reducing branching.

Numbers reported here are obtained on x86-64 macOS with clang++ and `-O2`.
On embedded/mobile targets they will likely be smaller. It is possible to reduce
library size even more by [disabling floating-point support](
https://github.com/fmtlib/fmt/pull/1590) which could be useful on some embedded
platforms.

All of these size optimizations and more are already available in {fmt}'s
`master` and will ship in the next major release since they affect ABI.
