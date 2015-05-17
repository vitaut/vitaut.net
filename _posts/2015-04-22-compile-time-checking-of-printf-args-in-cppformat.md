---
layout: post
title: Compile-time checking of printf arguments in C++ Format
date: 2015-04-22
---

{{ page.title }}
================

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img border="0" src="/img/safety.jpg" width="200"
       title="Safety first!">
</div>

As an author of [C++ Format](https://github.com/cppformat/cppformat), a library that
implements safe Python-like and printf-like formatting, every now and then I hear
questions whether it supports compile-time checking of format strings and arguments.
Until recently I didn't know any way to do this, but then it occurred to me that it
is possible to have some compile-time checking based on GCC's `format` attribute
described [here](https://gcc.gnu.org/onlinedocs/gcc/Function-Attributes.html).
This approach is somewhat limited and not particularly elegant, but it can be
useful in some cases such as logging.

If you are not familiar with the GCC's `format` attribute, here's an example demonstrating
how it works:

{% highlight c++ %}
void format(const char *, ...) __attribute__((format(printf, 1, 2)));

int main() {
  format("%s", 42);
}
{% endhighlight %}

{% highlight bash %}
$ g++ test.cc
test.cc: In function ‘int main()’:
test.cc:4:18: warning: format ‘%s’ expects argument of type ‘char*’, but argument 2 has type ‘int’ [-Wformat=]
   format("%s", 42);
                  ^
{% endhighlight %}

This is a pretty nice but, of course, only works with literal format strings.
Unfortunately the `format` attribute requires varargs and doesn't support variadic
function templates:

{% highlight c++ %}
template <typename... Args>
void format(const char *format_str, const Args& ... args)
  __attribute__((format(printf, 1, 2)));

int main() {
  format("%s", 42);
}
{% endhighlight %}

{% highlight bash %}
$ g++ -std=c++11 test.cc
test.cc: In substitution of ‘template<class ... Args> void format(const char*, const Args& ...) [with Args = {int}]’:
test.cc:6:18:   required from here
test.cc:2:6: error: args to be formatted is not ‘...’
 void format(const char *format_str, const Args& ... args)
      ^
{% endhighlight %}

and for obvious safety reasons C++ Format avoids varargs.

The main (and ugly) part of the solution is to use a macro with a call to a dummy vararg function
declared with the `format` attribute and a call to the actual formatting function
[`fmt::printf`](http://cppformat.readthedocs.org/en/stable/reference.html#printf-formatting-functions):

{% highlight c++ %}
#include "format.h"

void check_args(const char *format, ...) __attribute__ ((format (printf, 1, 2)));

#define FMT_PRINTF(...) \
  if (false) check_args(__VA_ARGS__); \
  fmt::printf(__VA_ARGS__);

int main() {
  try {
    FMT_PRINTF("%s", 42);
  } catch (const std::exception &e) {
    fmt::print("error: {}\n", e.what());
  }
}
{% endhighlight %}

The `check_args` function is never called, so it doesn't introduce runtime overheads or
safety issues. But it makes the compiler do its magic:

{% highlight bash %}
$ g++ -std=c++11 test.cc
test.cc: In function ‘int main()’:
test.cc:6:36: warning: format ‘%s’ expects argument of type ‘char*’, but argument 2 has type ‘int’ [-Wformat=]
   if (false) check_args(__VA_ARGS__); \
                                    ^
test.cc:11:5: note: in expansion of macro ‘FMT_PRINTF’
     FMT_PRINTF("%s", 42);
     ^
{% endhighlight %}

One of the limitations of this method is that it can't be used with objects of
non-trivially-copyable C++ types such as `std::string` passed as formatting arguments.

Of course, this only gives a compile-time diagnostic for literal format string,
but C++ Format got you covered in all cases with runtime type checking which
is relatively cheap. Also if you use
[Python-like format strings](http://cppformat.readthedocs.org/en/stable/reference.html#formatting-functions),
you can often omit type specifier in the format string which makes the check unnecessary:

{% highlight c++ %}
fmt::print("{}", 42); // nothing to check here, any argument is fine
{% endhighlight %}

The approach described in this post has been successfully applied in the [logging system of TrinityCore](
https://github.com/TrinityCore/TrinityCore/blob/2b6c0865769b8b8166d6afa36dd55cdb6cf98f45/src/server/shared/Logging/Log.h#L165-L174),
a well-known open-source MMO framework.
