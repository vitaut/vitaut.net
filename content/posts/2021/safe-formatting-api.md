---
title: A quest for safe text formatting API
date: 2021-06-16
aliases: ['/2021/06/16/safe-formatting-api.html']
---

![](/img/safety.jpg#floatright)

Since the introduction of format strings in Fortran in the 50s pretty much all
major programming languages used them in their text formatting and I/O APIs:

* `printf`-based: C, Haskell, Java/JVM languages, PHP and others
* Python-format-based: Python, Rust, C++ (starting from C++20)
* NIH-based: C#/.NET

One notable exception is C++ iostreams that use operator overloading and
per-stream state manipulation to control formatting. At this point stateful APIs
have pretty much proved to be a failure in terms of usability and performance
and many C++ programmers [prefer `*printf` instead](
https://stackoverflow.com/q/2872543/471164).

However, format strings in C have a bad reputation because of lack of type
safety: users must encode type information together with formatting information.
If the user-specified and actual types don't match we have an undefined
behavior ([godbolt](https://godbolt.org/z/aYqE493b9)):

```c
int main() {
  printf("%d", "I am not a number");
}
```
This prints part of a pointer as a decimal number, in other cases you can get
a segfault or something worse.

Fortunately, modern compilers can diagnose such errors at compile time
for literal format strings but this is an opt-in which is not ideal.
Encoding type information by hand is not only error-prone but also cumbersome as
this table from the [documentation of the C `stdint.h` header](
https://en.cppreference.com/w/c/types/integer) illustrates: 

![](/img/printf.png)

Formatting facilities in languages other than C are usually type-safe.
For example, in Python you get an exception when trying to format a string as
an integer:

```python
>>> '{:d}'.format("I am not a number")
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
ValueError: Unknown format code 'd' for object of type 'str'
```

Moreover, format specifiers only convey formatting information and not type
which makes the syntax much simpler and easier to parse, eliminating numerous
unnecessary specifiers. For example, `d` means format as decimal, not that the
type is `int` and that it should be formatted as decimal.

Statically typed languages like Rust do even better and give you a compile-time
error:

```rust
print!("{:x}", "I am not a number");
```
(Note that Rust's formatting facility doesn't support `d` for some reason so it
is replaced with `x` here.)

Output:
```
error[E0277]: the trait bound `str: LowerHex` is not satisfied
 --> <source>:2:18
  |
2 |   print!("{:x}", "I am not a number");
  |                  ^^^^^^^^^^^^^^^^^^^ the trait `LowerHex` is not implemented for `str`
  |
  = note: required because of the requirements on the impl of `LowerHex` for `&str`
  = note: required by `std::fmt::LowerHex::fmt`
  = note: this error originates in a macro (in Nightly builds, run with -Z macro-backtrace for more info)
```

I've been looking into doing the same in [the {fmt} library](
https://github.com/fmtlib/fmt) since around 2014 but the solution remained
elusive. One approach that has been available since [{fmt} 5.0](
https://github.com/fmtlib/fmt/releases/tag/5.0.0) is based on `constexpr` 
parameter emulation trick described in [this nice post by Michael Park](
https://mpark.github.io/programming/2017/05/26/constexpr-function-parameters/):

```c++
fmt::print(FMT_STRING("{:d}"), "I am not a number");
```
It works but is an opt-in with an obviously suboptimal API.

The solution came from a somewhat unexpected (to me) place: [C++20 `consteval`](
https://en.cppreference.com/w/cpp/language/consteval).
With C++20 it is now possible to write just ([godbolt](
https://godbolt.org/z/aWEhsTMPW))

```c++
fmt::print("{:d}", "I am not a number");
```
and get an expected compile-time error:

```
<source>:4:14: error: call to consteval function 'fmt::basic_format_string<char, char const (&)[18]>::basic_format_string<char [5], 0>' is not a constant expression
  fmt::print("{:d}", "I am not a number");
             ^
.../include/fmt/core.h:2587:23: note: non-constexpr function 'on_error' cannot be used in a constant expression
  if (spec != 'p') eh.on_error("invalid type specifier");
                      ^
.../include/fmt/core.h:2808:7: note: in call to 'check_cstring_type_spec(100, eh)'
      detail::check_cstring_type_spec(specs_.type, eh);
      ^
.../include/fmt/core.h:2456:12: note: in call to '&f->parse(checker(s, {}).context_)'
  return f.parse(ctx);
           ^
.../include/fmt/core.h:2718:39: note: in call to 'parse_format_specs(checker(s, {}).context_)'
    return id >= 0 && id < num_args ? parse_funcs_[id](context_) : begin;
                                      ^
.../include/fmt/core.h:2382:23: note: in call to '&checker(s, {})->on_format_specs(0, &"{:d}"[2], &"{:d}"[4])'
      begin = handler.on_format_specs(adapter.arg_id, begin + 1, end);
                      ^
.../include/fmt/core.h:2407:21: note: in call to 'parse_replacement_field(&"{:d}"[1], &"{:d}"[4], checker(s, {}))'
        begin = p = parse_replacement_field(p - 1, end, handler);
                    ^
.../include/fmt/core.h:2849:7: note: in call to 'parse_format_string({&"{:d}"[0], 4}, checker(s, {}))'
      detail::parse_format_string<true>(str_, checker(s, {}));
      ^
<source>:4:14: note: in call to 'basic_format_string("{:d}")'
  fmt::print("{:d}", "I am not a number");
             ^
.../include/fmt/core.h:616:29: note: declared here
  FMT_NORETURN FMT_API void on_error(const char* message);
                            ^
```

The error is somewhat verbose but it gives you all the necessary information:

1. The problematic call to `print`:
```c++
fmt::print("{:d}", "I am not a number");
              ^
```

2. The error message: "invalid type specifier".

3. The compile-time call stack similar to a runtime stack that you get in case
  of an uncaught exception. This part can potentially be simplified in the
  future.

{fmt} is closer to Python than Rust because format specifications are
extensible while in Rust you only have a handful of "global" specifiers.
This is particularly useful for date and time formatting. Parsing of format
specifications for user-defined types is done in `constexpr` functions so the
same code is used both at compile time (for checks or format string compilation)
and runtime.

## How does it work?

The high-level API is very simple with the check done in an implicit `consteval`
constructor of a format string:

```c++
template <typename... T>
struct format_string {
  string_view str;

  template <typename S>
  consteval format_string(const S& fmt) : str(fmt) {
    // Check if fmt is a valid format string for types T...
  }
}

template <typename... T>
void print(format_string<T...> fmt, T&&... args);
```
The implicit constructor is invoked whenever we call `print` triggering the
check. The actual work is done in the format string parser which is an ordinary
`constexpr` C++ code not worth explaining here.

It works with gcc 10+, clang 11+ and any other C++ compiler that supports
`consteval`.

The compile-time checks for C++20 `std::format` have been accepted into the C++
standard ([P2216](
http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2021/p2216r3.html])) and are
coming to the standard library implementations near you. Until then you can
of course use the {fmt} library which will include compile-time checks in the
upcoming major release.

## What about build speed?

I was somewhat concerned that the compile-time check might be prohibitively
expensive. However, after enabling the feature in the {fmt}'s test suite that
contains a large number of formatting function calls the effect on build time
was very small, close to the natural variation between different builds.

## What about runtime format strings?

Compile-time checks are cool but it's occasionally useful to have runtime format
strings e.g. when translating messages with [gettext](
https://www.gnu.org/software/gettext/). It is still supported as an opt-in
(the correct default in C++, shocking!) by wrapping a format string in
`fmt::runtime` or using type-erased overloads like `vformat`:

```c++
fmt::print(fmt::runtime("{:d}"), "I am not a number");
```

This makes runtime format strings clearly visible in code and misuses easy to
catch with a code review or tools.

It is possible to do compile-time checks of format strings that are keys into
a translation database which eliminates the main use case for runtime ones but
that's a topic for another post.

Happy type-safe formatting!