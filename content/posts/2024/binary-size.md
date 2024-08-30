---
title: "Honey, I shrunk {fmt}: bringing binary size to 14k and ditching the C++ runtime"
date: 2024-08-30
---

![](/img/kennedy.jpg#floatright
"We do this not because it is easy, but because we thought it would be easy.")

[The {fmt} formatting library][fmt] is known for its small binary footprint,
often producing code that is several times smaller per function call compared
to alternatives like IOStreams, Boost Format, or, somewhat ironically,
tinyformat. This is mainly achieved through careful application of type erasure
on various levels, which effectively minimizes template bloat.

[fmt]: https://github.com/fmtlib/fmt

Formatting arguments are passed via type-erased `format_args`:

```c++
auto vformat(string_view fmt, format_args args) -> std::string;

template <typename... T>
auto format(format_string<T...> fmt, T&&... args) -> std::string {
  return vformat(fmt, fmt::make_format_args(args...));
}
```

As you can see, `format` delegates all its work to `vformat`, which is not a
template.

Output iterators and other output types are also type-erased through a specially
designed buffer API.

This approach confines template usage to a minimal top-level layer, leading to
both a smaller binary size and [faster build times][build-speed].

[build-speed]: https://vitaut.net/posts/2024/faster-cpp-compile-times/

For example, the following code:

```c++
// test.cc
#include <fmt/base.h>

int main() {
  fmt::print("The answer is {}.", 42);
}
```

compiles to just 

```
.LC0:
        .string "The answer is {}."
main:
        sub     rsp, 24
        mov     eax, 1
        mov     edi, OFFSET FLAT:.LC0
        mov     esi, 17
        mov     rcx, rsp
        mov     rdx, rax
        mov     DWORD PTR [rsp], 42
        call    fmt::v11::vprint(fmt::v11::basic_string_view<char>, fmt::v11::basic_format_args<fmt::v11::context>)
        xor     eax, eax
        add     rsp, 24
        ret
```
[godbolt](https://godbolt.org/z/PMKdPPnYn)

It is much smaller than the equivalent IOStreams code and comparable to that
of `printf`:

```
.LC0:
        .string "The answer is %d."
main:
        sub     rsp, 8
        mov     esi, 42
        mov     edi, OFFSET FLAT:.LC0
        xor     eax, eax
        call    printf
        xor     eax, eax
        add     rsp, 8
        ret
```
[godbolt](https://godbolt.org/z/soTjfno71)

Unlike `printf`, {fmt} offers full runtime type safety. Errors in format strings
can be caught at compile time, and even when the format string is determined at
runtime, errors are managed through exceptions, preventing undefined behavior,
memory corruption, and potential crashes.  Additionally, {fmt} calls are
generally more efficient, particularly when using positional arguments, which C
varargs are not well-suited for.

Back in 2020, I dedicated some time to [optimizing the library size][opt-size],
successfully reducing it to under 100kB (just ~57kB with `-Os -flto`).
A lot has changed since then. Most notably, {fmt} now uses the exceptional
[Dragonbox][dragonbox] algorithm for floating-point formatting, kindly
contributed by its author, Junekey Jeon. Let's explore how these changes have
impacted the binary size and see if further reductions are possible.

[opt-size]: https://vitaut.net/posts/2020/reducing-library-size/
[dragonbox]: https://github.com/jk-jeon/dragonbox

But why, some say, the binary size? Why choose this as our goal?

There has been considerable interest in using {fmt} on memory-constrained
devices, see e.g. [#758][758] and [#1226][1226] for just two examples from
the distant past. A particularly intriguing use case is retro computing, with
people using {fmt} on systems like Amiga ([#4054][4054]).

[758]: https://github.com/fmtlib/fmt/issues/758
[1226]: https://github.com/fmtlib/fmt/issues/1226
[4054]: https://github.com/fmtlib/fmt/issues/4054

We'll apply the same methodology as in [previous work][opt-size], examining the
executable size of a program that uses {fmt}, as this is most relevant to end
users. All tests will be conducted on an aarch64 Ubuntu 22.04 system with GCC
11.4.0.

First, let's establish the baseline: what is the binary size for the latest
version of {fmt} (11.0.2)?

```
$ git checkout 11.0.2
$ g++ -Os -flto -DNDEBUG -I include test.cc src/format.cc
$ strip a.out && ls -lh a.out
-rwxrwxr-x 1 vagrant vagrant 75K Aug 30 19:24 a.out
```

The resulting binary size is 75kB (stripped). The positive takeaway is that
despite numerous developments over the past four years, the size has not
significantly regressed.

Now, let's explore potential optimizations. One of the first adjustments you
might consider is disabling locale support. All the formatting in {fmt} is
locale-independent by default (which breaks with the C++'s tradition of having
wrong defaults), but it is still available as an opt in via the `L` format
specifier. It can be disabled in a somewhat obscure way via the
`FMT_STATIC_THOUSANDS_SEPARATOR` macro:

```
$ g++ -Os -flto -DNDEBUG "-DFMT_STATIC_THOUSANDS_SEPARATOR=','" \
      -I include test.cc src/format.cc
$ strip a.out && ls -lh a.out
-rwxrwxr-x 1 vagrant vagrant 71K Aug 30 19:25 a.out
```

Disabling locale support reduces the binary size to 71kB.

Next, let's examine the results using our trusty tool, [Bloaty][bloaty]:

[bloaty]: https://github.com/google/bloaty

```
$ bloaty -d symbols a.out

    FILE SIZE        VM SIZE
 --------------  --------------
  43.8%  41.1Ki  43.6%  29.0Ki    [121 Others]
   6.4%  6.04Ki   8.1%  5.42Ki    fmt::v11::detail::do_write_float<>()
   5.9%  5.50Ki   7.5%  4.98Ki    fmt::v11::detail::write_int_noinline<>()
   5.7%  5.32Ki   5.8%  3.88Ki    fmt::v11::detail::write<>()
   5.4%  5.02Ki   7.2%  4.81Ki    fmt::v11::detail::parse_replacement_field<>()
   3.9%  3.69Ki   3.7%  2.49Ki    fmt::v11::detail::format_uint<>()
   3.2%  3.00Ki   0.0%       0    [section .symtab]
   2.7%  2.50Ki   0.0%       0    [section .strtab]
   2.3%  2.12Ki   2.9%  1.93Ki    fmt::v11::detail::dragonbox::to_decimal<>()
   2.0%  1.89Ki   2.4%  1.61Ki    fmt::v11::detail::write_int<>()
   2.0%  1.88Ki   0.0%       0    [ELF Section Headers]
   1.9%  1.79Ki   2.5%  1.66Ki    fmt::v11::detail::write_float<>()
   1.9%  1.78Ki   2.7%  1.78Ki    [section .dynstr]
   1.8%  1.72Ki   2.4%  1.62Ki    fmt::v11::detail::format_dragon()
   1.8%  1.68Ki   1.5%    1016    fmt::v11::detail::format_decimal<>()
   1.6%  1.52Ki   2.1%  1.41Ki    fmt::v11::detail::format_float<>()
   1.6%  1.49Ki   0.0%       0    [Unmapped]
   1.5%  1.45Ki   2.2%  1.45Ki    [section .dynsym]
   1.5%  1.45Ki   2.0%  1.31Ki    fmt::v11::detail::write_loc()
   1.5%  1.44Ki   2.2%  1.44Ki    [section .rodata]
   1.5%  1.40Ki   1.1%     764    fmt::v11::detail::do_write_float<>()::{lambda()#2}::operator()()
 100.0%  93.8Ki 100.0%  66.6Ki    TOTAL
```

Unsurprisingly, a significant portion of the binary size is dedicated to numeric
formatting, particularly floating-point numbers. FP formatting also relies on
sizable tables, which aren't shown here. But what if floating-point support
isn't required? {fmt} provides a way to disable it, though the method is
somewhat ad hoc and doesn’t extend to other types.

The core issue is that formatting functions need to be aware of all formattable
types. Or do they? This is true for `printf` as defined by the C standard, but
not necessarily for {fmt}. {fmt} supports an extension API that allows
formatting arbitrary types without knowing the complete set of types in advance.
While built-in and string types are handled specially for performance reasons,
focusing on binary size might warrant a different approach. By removing this
special handling and routing every type through the extension API, you can avoid
paying for types you don't use.

I did an experimental [implementation of this idea][377cf20]. With the
`FMT_BUILTIN_TYPES` macro set to 0, only `int` is handled specially, and all
other types go through the general extension API. We still need to know about
`int` for dynamic width and precision, for example

```c++
fmt::print("{:{}}\n", "hello", 10); // prints "hello     "
```

[377cf20]: https://github.com/fmtlib/fmt/commit/377cf20

This gives you the "don't pay for what you don't use" model, though it comes
with a slight increase in per-call binary size. If you do format floating-point
numbers or other types, the relevant code will still be included in the build.
While it's possible to make the FP implementation smaller, we won’t delve into
that here.

With `FMT_BUILTIN_TYPES=0`, the binary size in our example reduced to 31kB,
representing a substantial improvement:

```
$ git checkout 377cf20
$ g++ -Os -flto -DNDEBUG \
      "-DFMT_STATIC_THOUSANDS_SEPARATOR=','" -DFMT_BUILTIN_TYPES=0 \
      -I include test.cc src/format.cc
$ strip a.out && ls -lh a.out
-rwxrwxr-x 1 vagrant vagrant 31K Aug 30 19:37 a.out
```

However, the updated Bloaty results reveal some lingering locale artifacts,
such as `digit_grouping`:

```
$ bloaty -d fullsymbols a.out

    FILE SIZE        VM SIZE
 --------------  --------------
  41.8%  18.0Ki  39.7%  11.0Ki    [84 Others]
   6.4%  2.77Ki   0.0%       0    [section .symtab]
   5.3%  2.28Ki   0.0%       0    [section .strtab]
   4.6%  1.99Ki   6.9%  1.90Ki    fmt::v11::detail::format_handler<char>::on_format_specs(int, char const*, char const*)
   4.4%  1.88Ki   0.0%       0    [ELF Section Headers]
   4.1%  1.78Ki   5.8%  1.61Ki    fmt::v11::basic_appender<char> fmt::v11::detail::write_int_noinline<char, fmt::v11::basic_appender<char>, unsigned int>(fmt::v11::basic_appender<char>, fmt::v11::detail::write_int_arg<unsigned int>, fmt::v11::format_specs const&, fmt::v11::detail::locale_ref) (.constprop.0)
   3.7%  1.60Ki   5.8%  1.60Ki    [section .dynstr]
   3.5%  1.50Ki   4.8%  1.34Ki    void fmt::v11::detail::vformat_to<char>(fmt::v11::detail::buffer<char>&, fmt::v11::basic_string_view<char>, fmt::v11::detail::vformat_args<char>::type, fmt::v11::detail::locale_ref) (.constprop.0)
   3.5%  1.49Ki   4.9%  1.35Ki    fmt::v11::basic_appender<char> fmt::v11::detail::write_int<fmt::v11::basic_appender<char>, unsigned __int128, char>(fmt::v11::basic_appender<char>, unsigned __int128, unsigned int, fmt::v11::format_specs const&, fmt::v11::detail::digit_grouping<char> const&)
   3.1%  1.31Ki   4.7%  1.31Ki    [section .dynsym]
   3.0%  1.29Ki   4.2%  1.15Ki    fmt::v11::basic_appender<char> fmt::v11::detail::write_int<fmt::v11::basic_appender<char>, unsigned long, char>(fmt::v11::basic_appender<char>, unsigned long, unsigned int, fmt::v11::format_specs const&, fmt::v11::detail::digit_grouping<char> const&)

```

After disabling these artifacts in commits [e582d37][e582d37] and
[b3ccc2d][b3ccc2d], and introducing a more user-friendly option to opt out via
the `FMT_USE_LOCALE` macro, the binary size drops to 27kB:

```
$ git checkout b3ccc2d
$ g++ -Os -flto -DNDEBUG -DFMT_USE_LOCALE=0 -DFMT_BUILTIN_TYPES=0 \
      -I include test.cc src/format.cc
$ strip a.out && ls -lh a.out
-rwxrwxr-x 1 vagrant vagrant 27K Aug 30 19:38 a.out
```

[e582d37]: https://github.com/fmtlib/fmt/commit/e582d37
[b3ccc2d]: https://github.com/fmtlib/fmt/commit/b3ccc2d

The library includes several areas where size is traded off for speed.
For example, consider this function used to compute the number of decimal
digits:

```c++
auto do_count_digits(uint32_t n) -> int {
// An optimization by Kendall Willets from https://bit.ly/3uOIQrB.
// This increments the upper 32 bits (log10(T) - 1) when >= T is added.
#  define FMT_INC(T) (((sizeof(#T) - 1ull) << 32) - T)
  static constexpr uint64_t table[] = {
      FMT_INC(0),          FMT_INC(0),          FMT_INC(0),           // 8
      FMT_INC(10),         FMT_INC(10),         FMT_INC(10),          // 64
      FMT_INC(100),        FMT_INC(100),        FMT_INC(100),         // 512
      FMT_INC(1000),       FMT_INC(1000),       FMT_INC(1000),        // 4096
      FMT_INC(10000),      FMT_INC(10000),      FMT_INC(10000),       // 32k
      FMT_INC(100000),     FMT_INC(100000),     FMT_INC(100000),      // 256k
      FMT_INC(1000000),    FMT_INC(1000000),    FMT_INC(1000000),     // 2048k
      FMT_INC(10000000),   FMT_INC(10000000),   FMT_INC(10000000),    // 16M
      FMT_INC(100000000),  FMT_INC(100000000),  FMT_INC(100000000),   // 128M
      FMT_INC(1000000000), FMT_INC(1000000000), FMT_INC(1000000000),  // 1024M
      FMT_INC(1000000000), FMT_INC(1000000000)                        // 4B
  };
  auto inc = table[__builtin_clz(n | 1) ^ 31];
  return static_cast<int>((n + inc) >> 32);
}
```

The table used here is 256 bytes. There isn't a one-size-fits-all solution,
and changing it unconditionally might negatively impact other use cases.
Fortunately, we have a fallback implementation of this function for scenarios
where `__builtin_clz` is unavailable, such as with `constexpr`:

```c++
template <typename T> constexpr auto count_digits_fallback(T n) -> int {
  int count = 1;
  for (;;) {
    // Integer division is slow so do it for a group of four digits instead
    // of for every digit. The idea comes from the talk by Alexandrescu
    // "Three Optimization Tips for C++". See speed-test for a comparison.
    if (n < 10) return count;
    if (n < 100) return count + 1;
    if (n < 1000) return count + 2;
    if (n < 10000) return count + 3;
    n /= 10000u;
    count += 4;
  }
}
```

All that remains is to provide users with control over when to use the fallback
implementation via (you guessed it) another configuration macro,
`FMT_OPTIMIZE_SIZE`:

```c++
auto count_digits(uint32_t n) -> int {
#ifdef FMT_BUILTIN_CLZ
  if (!is_constant_evaluated() && !FMT_OPTIMIZE_SIZE) return do_count_digits(n);
#endif
  return count_digits_fallback(n);
}
```

With this and a few similar adjustments, we reduced the binary size to 23kB:

```
$ git checkout 8e3da9d
$ g++ -Os -flto -DNDEBUG -I include \
      -DFMT_USE_LOCALE=0 -DFMT_BUILTIN_TYPES=0 -DFMT_OPTIMIZE_SIZE=1 \
      test.cc src/format.cc
$ strip a.out && ls -lh a.out
-rwxrwxr-x 1 vagrant vagrant 23K Aug 30 19:41 a.out
```

We could likely reduce the binary size even further with additional tweaks,
but let’s address the elephant in the room which is, of course, the C++ standard
library. What's the point of optimizing the size when you end up getting
a megabyte or two of the C++ runtime?

While {fmt} relies minimally on the standard library, is it possible to
remove it completely as a dependency? One obvious problem is exceptions and
those can be disabled via `FMT_THROW`, e.g. by defining it to `abort`.
In general it is not recommended but it might be OK for some use cases
especially considering that most errors are caught at compile time.

Let's try it out and compile with `-nodefaultlibs` and exceptions disabled:

```
$ g++ -Os -flto -DNDEBUG -I include \
      -DFMT_USE_LOCALE=0 -DFMT_BUILTIN_TYPES=0 -DFMT_OPTIMIZE_SIZE=1 \
      '-DFMT_THROW(s)=abort()' -fno-exceptions test.cc src/format.cc \
      -nodefaultlibs -lc

/usr/bin/ld: /tmp/cc04DFeK.ltrans0.ltrans.o: in function `fmt::v11::basic_memory_buffer<char, 500ul, std::allocator<char> >::grow(fmt::v11::detail::buffer<char>&, unsigned long)':
<artificial>:(.text+0xaa8): undefined reference to `std::__throw_bad_alloc()'
/usr/bin/ld: <artificial>:(.text+0xab8): undefined reference to `operator new(unsigned long)'
/usr/bin/ld: <artificial>:(.text+0xaf8): undefined reference to `operator delete(void*, unsigned long)'
/usr/bin/ld: /tmp/cc04DFeK.ltrans0.ltrans.o: in function `fmt::v11::vprint_buffered(_IO_FILE*, fmt::v11::basic_string_view<char>, fmt::v11::basic_format_args<fmt::v11::context>) [clone .constprop.0]':
<artificial>:(.text+0x18c4): undefined reference to `operator delete(void*, unsigned long)'
collect2: error: ld returned 1 exit status
```

Amazingly, this approach mostly works. The only remaining dependency on the C++
runtime comes from `fmt::basic_memory_buffer`, which is a small stack-allocated
buffer that can grow into dynamic memory if necessary.

`fmt::print` can write directly into the `FILE` buffer and generally
doesn’t require dynamic allocation. So we could remove the dependency on
`fmt::basic_memory_buffer` from `fmt::print`. However, since it may be used
elsewhere, a better solution is to replace the default allocator with one that
uses `malloc` and `free` instead of `new` and `delete`.

```c++
template <typename T> struct allocator {
  using value_type = T;

  T* allocate(size_t n) {
    FMT_ASSERT(n <= max_value<size_t>() / sizeof(T), "");
    T* p = static_cast<T*>(malloc(n * sizeof(T)));
    if (!p) FMT_THROW(std::bad_alloc());
    return p;
  }

  void deallocate(T* p, size_t) { free(p); }
};
```

This reduces binary size to just 14kB:

```
$ git checkout c0fab5e
$ g++ -Os -flto -DNDEBUG -I include \
      -DFMT_USE_LOCALE=0 -DFMT_BUILTIN_TYPES=0 -DFMT_OPTIMIZE_SIZE=1 \
      '-DFMT_THROW(s)=abort()' -fno-exceptions test.cc src/format.cc \
      -nodefaultlibs -lc
$ strip a.out && ls -lh a.out
-rwxrwxr-x 1 vagrant vagrant 14K Aug 30 19:06 a.out
```

Considering that a C program with an empty `main` function is 6kB on this
system, {fmt} now adds less than 10kB to the binary.

We can also easily verify that it no longer depends on the C++ runtime:

```
$ ldd a.out
        linux-vdso.so.1 (0x0000ffffb0738000)
        libc.so.6 => /lib/aarch64-linux-gnu/libc.so.6 (0x0000ffffb0530000)
        /lib/ld-linux-aarch64.so.1 (0x0000ffffb06ff000)
```

Hope you found this interesting and happy embedded formatting!
