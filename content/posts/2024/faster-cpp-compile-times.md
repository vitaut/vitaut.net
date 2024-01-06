---
title: "Optimizing the unoptimizable: a journey to faster C++ compile times"
date: 2024-01-06
---

![](/img/hydra.jpg#floatright "Optimizing C++ includes")

In this post I'll talk about bringing compile times of [the {fmt} library][fmt]
on par with the C standard I/O library ([stdio][stdio]).

[fmt]: https://github.com/fmtlib/fmt
[stdio]: https://en.wikipedia.org/wiki/C_file_input/output

First some background: {fmt} is a popular open-source formatting library for
C++ that provides a better alternative to C++ iostreams and C stdio. It has
already surpassed stdio in many areas:

* Type safety with [compile-time format string checks][checks] available by
  default since C++20 and as an opt in for C++14/17. Runtime format strings are
  also safe to use in {fmt} which is impossible to achieve in `printf`.
* Extensibility: [user-defined type can be made formattable][udt] and most
  standard library types such as containers, dates and times are formattable out
  of the box.
* Performance: {fmt} is significantly faster than common standard library
  implementations of `printf`, in some cases by an order of magnitude
  (e.g. [on floating-point formatting][speed]).
* Portable Unicode support.

[checks]: https://vitaut.net/posts/2021/safe-formatting-api/
[udt]: https://fmt.dev/latest/api.html#formatting-user-defined-types
[speed]: https://github.com/fmtlib/fmt?tab=readme-ov-file#speed-tests

However, one area where stdio remained significantly better was compile times.

We've put a lot of effort into optimizing compile times in {fmt} by applying
type erasure on both argument and output level, limiting templates to a small
top-level API layer and introducing `fmt/core.h` with minimal dependencies.

This made {fmt} [faster to compile than C++ alternatives][compile-time] such as
iostreams, Boost Format and Folly Format but couldn't close the gap with stdio.
We knew that the bottleneck was in the `<string>` dependency but it was also
needed for the main API, `fmt::format`.

[compile-time]: https://github.com/fmtlib/fmt?tab=readme-ov-file#compile-time-and-code-bloat

Over time it has become clear that there are use cases that don't need (or want)
`std::string`. Quoting Sean Middleditch's [comment on GitHub](
https://github.com/fmtlib/fmt/issues/1046#issuecomment-465855241):

> If I don't use `std::string` (and I don't) I do not want to pull in the heavy
> dependencies of that header and to every single TU that might do some
> formatting (and hence wants to have access to `formatter<>` specializations).

{fmt} has become increasingly [used for I/O][io] and logging libraries where
`std::string` objects only may appear as arguments at some call sites.

[io]: http://localhost:1313/posts/2020/optimal-file-buffer-size/

And the most important use case of them all is, of course, Godbolt where people
often use {fmt} to print things, especially the ones not supported by `printf`,
and a few hundred milliseconds of overhead is noticeable.

On the other hand, it is hard to avoid `<string>` in C++. If you are using any
part of the library it will likely get pulled in transitively. Also compile
times were not terrible and there were more important things to do so for a
while I haven't been actively working on it.

C++20 changed the situation dramatically. Consider the following Hello World
program with basic formatted output (`hello.cc`)

```c++
#include <fmt/core.h>

int main() {
  fmt::print("Hello, {}!\n", "world");
}
```

With C++11 it took ~225ms to compile it with clang on an M1 MacBook Pro
(here and below I report the best of three runs):

```
% time c++ -c hello.cc -I include -std=c++11
c++ -c hello.cc -I include -std=c++11  0.17s user 0.04s system 90% cpu 0.225 total
```

With C++20 it now takes ~319ms, 40% more:

```
% time c++ -c hello.cc -I include -std=c++20
c++ -c hello.cc -I include -std=c++20  0.26s user 0.05s system 95% cpu 0.319 total
```

For comparison, here is an equivalent C program (`hello-stdio.c`):

```c
#include <stdio.h>

int main() {
  printf("Hello, %s!\n", "world");
}
```

and it takes only ~59ms:

```
% time cc hello-stdio.c
cc hello-stdio.c  0.05s user 0.02s system 121% cpu 0.059 total
```

So due to uncontrolled standard library bloat between C++11 and C++20 we are now
more than 5 times slower to compile than `printf`, all thanks to `<string>`
include. Can we do something about it?

It turned out that with type erasure the dependency on `std::string` in
`fmt/core.h` has become minimal so I decided to give it a try and remove this
dependency. But first let's see what's going on by getting a time trace:

```
c++ -ftime-trace -c hello.cc -I include -std=c++20
```

and opening [hello.json](/files/2024-hello-before.json) in Chrome using
`chrome://tracing/`:

![](/img/2024-trace.png)

The time spent in `fmt/core.h` itself is only ~7.5ms and most of the time is
spent in includes:

* `<iterator>`: ~71ms
* `<memory>`: ~37ms
* `<string>`: ~122ms (highlighted on the above trace)

OK, `<string>` is indeed the worst but what about the other ones? Unfortunately
removing the other includes doesn't change the situation because the amount of
stuff pulled in transitively remains roughly the same. These headers show up on
the trace only because they happen to be included before `<string>`.

Thorough research (googling) revealed that we can actually do something about it
in libc++ thanks to [`_LIBCPP_REMOVE_TRANSITIVE_INCLUDES`][includes]. Let's try
it out:

```
% time c++ -D_LIBCPP_REMOVE_TRANSITIVE_INCLUDES -c hello.cc -I include -std=c++20
c++ -D_LIBCPP_REMOVE_TRANSITIVE_INCLUDES -c hello.cc -I include -std=c++20  0.18s user 0.03s system 91% cpu 0.231 total
```

So this reduced the compile time to ~231ms, almost C++11 level, which is nice
but still a far cry from stdio.

[includes]: https://libcxx.llvm.org/DesignDocs/HeaderRemovalPolicy.html

But without spaghetti transitive dependencies it now makes sense to get rid of
`<iterator>` and `<memory>`.

`<memory>` is only used in one place for `std::addressof` to workaround a broken
implementation of `std::vector<bool>::reference` in libc++ that provides a very
innovative overload of unary `operator&`. Here's this usage:

```c++
custom.value = const_cast<value_type*>(std::addressof(val));
```

We can replace it with a few casts at the cost of not being able to directly
format `std::vector<bool>::reference` at compile time which is a tradeoff I can
live with:

```c++
if constexpr (std::is_same<decltype(&val), T*>::value)
  custom.value = const_cast<value_type*>(&val);
if (!is_constant_evaluated())
  custom.value = const_cast<char*>(&reinterpret_cast<const char&>(val));
```

Now that we don't have `<memory>` (I would prefer to not have memory of this
workaround) this brings the time down to ~195ms, better than the initial C++11
time.

Removing `<iterator>` is a bit trickier because we use `back_insert_iterator`
to detect and optimize formatting into contiguous containers. Unfortunately it's
not even possible to detect it with SFINAE because `back_insert_iterator` has
the same API shape as `front_insert_iterator`. There is a number of solutions to
this problem such as moving the optimization to `fmt/format.h`. For now I added
a simple local replacement, `fmt::back_insert_iterator`. Without `<iterator>`
the time was down to ~178ms.

This would be the time to tackle `<string>` but as it turned out we also
conditionally included `<string_view>` or `<experimental/string_view>` (sigh).
It doesn't add any overhead directly because it is pulled in from `<string>`
anyway but we need to remove one in order to get rid of the other. We already
have a trait in ranges to detect `std::string_view`-like API which we can
apply here with some simplifications:

```c++
template <typename T, typename Enable = void>
struct is_string_like : std::false_type {};

// A heuristic to detect std::string and std::string_view.
template <typename T>
struct is_string_like<T, void_t<decltype(std::declval<T>().find_first_of(
                             typename T::value_type(), 0))>> : std::true_type {
};
```

This can give false positives but they are benign since the worst thing that
can happen is that your type that looks like a string will be formatted as a
string. If you don't want this you can always opt out.

Now to the final boss, `<string>`. There were very few references to
`std::string` in `fmt/core.h`. However, we also had `std::char_traits` which
was used in our fallback implementation of `string_view` needed for
compatibility with C++11. `char_traits` didn't bring much value and was easy to
replace with C functions such as `strlen` and their fallbacks for `constexpr`.

The only API that used `std::string` was `fmt::format`. One option was moving it
to `fmt/format.h` but this would be a huge breaking change. So I decided to do
something horrible but non-breaking and forward declare `std::basic_string`
instead. Doing such things is frowned upon but it's not the worst thing we had
to do in {fmt} to workaround limitations of C and C++ standard libraries. Here
is a slightly simplified version:

```c++
#ifdef FMT_BEGIN_NAMESPACE_STD
FMT_BEGIN_NAMESPACE_STD
template <typename Char>
struct char_traits;
template <typename T>
class allocator;
template <typename Char, typename Traits, typename Allocator>
class basic_string;
FMT_END_NAMESPACE_STD
#else
# include <string>
#endif
```

`FMT_BEGIN_NAMESPACE_STD` and `FMT_END_NAMESPACE_STD` are defined depending on
the implementation. Currently both major standard libraries, libstdc++ and
libc++, are supported.

Obviously this didn't work with our definition of `fmt::format`:

```c++
template <typename... T>
 FMT_NODISCARD FMT_INLINE auto format(format_string<T...> fmt, T&&... args)
    -> basic_string<char> {
   return vformat(fmt, fmt::make_format_args(args...));
 }
```

giving the following error:

```c++
In file included from hello.cc:1:
include/fmt/core.h:2843:31: error: implicit instantiation of undefined template 'std::basic_string<char, std::char_traits<char>, std::allocator<char>>'
FMT_NODISCARD FMT_INLINE auto format(format_string<T...> fmt, T&&... args)
                              ^
```

As usual in C++, the solution is more ~~levels of indirection~~ templates:

```c++
template <typename... T, typename Char = char>
 FMT_NODISCARD FMT_INLINE auto format(format_string<T...> fmt, T&&... args)
    -> basic_string<Char> {
   return vformat(fmt, fmt::make_format_args(args...));
 }
```

Was it worth it? Let's check:

```
% time c++ -c hello.cc -I include -std=c++20
c++ -c hello.cc -I include -std=c++20  0.04s user 0.02s system 81% cpu 0.069 total
```

We are down from ~319ms to ~69ms and don't even need
`_LIBCPP_REMOVE_TRANSITIVE_INCLUDES` any more. With all the optimizations,
`fmt/core.h` is now comparable to `stdio.h` in terms of compile times, with
only ~17% difference in our test. I think this is a very low price to pay for
improved safety, performance and extensibility.

P.S. After the optimization `stdio.h` is now the second heaviest include, adding
whopping 5ms to compile times.
