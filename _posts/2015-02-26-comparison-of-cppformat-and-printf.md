---
layout: post
title: Comparison of C++ Format and C library's printf
date: 2014-12-30
---

{{ page.title }}
================

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img border="0" src="/img/printf.jpg" width="320" 
  title="A mandatory image of a bee.">
</div>

I was recently asked on GitHub why would someone use `fmt::printf`, which is a part of the
[C++ Format library](https://github.com/cppformat/cppformat), over the standard C library
`printf`. This is a fair question and so I decided to write this blog post comparing the two.

Disclaimer: I'm the author of C++ Format, so this is all very biased =).

Whenever I mention `printf` without namespace I mean the whole family of `printf`-functions
from the C standard library, including `sprintf` and `fprintf`. The C++ Format library
includes its own implementation of printf which resides in `fmt` namespace, so I'll use
qualified name `fmt::printf` to distinguish it from the standard one.

Safety
------

The main difference between `printf` and C++ Format is the way they accept formatting
arguments.

`printf` uses mechanism provided by the C language sometimes referred to
as [varargs](https://en.wikipedia.org/wiki/Variadic_function). This mechanism is
inherently unsafe because it relies on the user to handle the type information which,
in the case of `printf`, is encoded in the format string together with formatting
options. However, some compilers provide extensions, such as
[__attribute__ ((format (printf, ...))](http://gcc.gnu.org/onlinedocs/gcc/Function-Attributes.html)
in GCC, that to some extent address safety issues. However, this only works with
format string that are string literals which is not always the case especially
when strings are localized. Also not all C and C++ compilers support this attribute.

C++ Format uses variadic functions introduces in C++11 and emulates them on older
compilers. This provides complete type safety and mismatch between the format
specification and actual type causes exception while in `printf` it often leads to
segfault.

Here's a small artificial example that illustrates the problem:

{% highlight c++ %}
#include <stdio.h>

int main() {
  const char *format_str = "%s";
  printf(format_str, format_str[0]);
}
{% endhighlight %}

Let's compile and run it:

{% highlight bash %}
$ g++ -Wall -Wextra -pedantic test.cc
$ ./a.out 
Segmentation fault (core dumped)
{% endhighlight %}

And GCC doesn't even give a warning with `-Wall -Wextra -pedantic`.

Doing the same with 

{% highlight c++ %}
#include "format.h"

int main() {
  const char *format_str = "%s";
  try {
    fmt::printf(format_str, format_str[0]);
  } catch (const std::exception &e) {
    fmt::printf("%s\n", e.what());
  }
}
{% endhighlight %}

Let's compile and run it:

{% highlight bash %}
$ g++ test.cc
$ ./a.out 
unknown format code 's' for integer
{% endhighlight %}

As you can see the error is reported as exception that can be safely catched
and handled.

Extensibility
-------------

It is often said that `printf` is not extensible and doesn't support user-defined types.
This is not entirely true as the GNU C Library provides some
[extension mechanisms](http://www.gnu.org/software/libc/manual/html_node/Customizing-Printf.html).
However, as with attributes, this is not standard.

The current version of C++ Format can format any type that provides overloaded
`operator<<` in addition to all built-in types, for example:

{% highlight c++ %}
class Date {
  int year_, month_, day_;
 public:
  Date(int year, int month, int day) : year_(year), month_(month), day_(day) {}

  friend std::ostream &operator<<(std::ostream &os, const Date &d) {
    return os << d.year_ << '-' << d.month_ << '-' << d.day_;
  }
};

std::string s = fmt::format("The date is {}", Date(2012, 12, 9));
// s == "The date is 2012-12-9"
{% endhighlight %}

Note that the above example uses Python-like
[format string syntax](http://cppformat.readthedocs.org/en/stable/syntax.html)
which is also supported (and recommended) by C++ Format.

Since C++ Format manages type information automatically, you don't have to
encode it in the format string as with `printf`, so the same default format
specifier `{}` can be used with an object of any type.

Performance
-----------

The current version of C++ Format library is
[much faster on integer formatting](http://zverovich.net/2013/09/07/integer-to-string-conversion-in-cplusplus.html),
but not as fast on floating-point formatting
[compared to EGLIBC](https://github.com/cppformat/cppformat#speed-tests).
Currently C++ Format relies on `snprintf` for floating-point formatting
and does some additional processing to ensure consistent output across platforms.
This will be improved in the next version.

Portability
-----------

Being part of the C standard library, `printf` is available pretty much everywhere,
but the quality of implementations widely vary and there are inconsistencies
between output on different platforms especially with floating-point numbers.

C++ Format has been tested on all major platforms and compilers. It provides consistent
output across platforms and implements POSIX extensions for positional arguments
that are not available in some `printf` implementations.

Compiled code size
------------------

According to the [code bloat benchmark](https://github.com/cppformat/cppformat#compile-time-and-code-bloat),
C++ Format generates about 10% to the optimized code size compared to `printf`.
The additional size comes from the type information that is passed alongside
the formatting arguments.

Conclusion
----------

The C++ Format library provides safe extensible alternative to the C `printf` family
of functions with comparable or better (on integer formatting) performance and compiled
code size.
