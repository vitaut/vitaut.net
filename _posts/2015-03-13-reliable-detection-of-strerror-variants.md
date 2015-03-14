---
layout: post
title: Reliable detection of strerror variants
date: 2015-03-13
---

{{ page.title }}
================

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img border="0" src="/img/tanenbaum.jpg" width="280"
       title="The nice thing about standards is that you have so many to choose from.">
</div>

One of the challenges of writing portable code is dealing with variations of
APIs that are supposed to be standard. In this post I'll talk about `strerror` and
friends which turned out to be particularly interesting to detect.

First, why not just use [`strerror`](http://pubs.opengroup.org/onlinepubs/9699919799/functions/strerror.html)
which is defined in the C and POSIX standards?
Unfortunately, quoting
[one of the standards](http://pubs.opengroup.org/onlinepubs/9699919799/functions/strerror.html):

> The strerror() function need not be thread-safe.

which is a bit of a non-starter. One might hope that standard libraries use thread-local
storage to implement it, but there is no guarantee.

This limitation can be overcome by using
[`strerror_r`](http://pubs.opengroup.org/onlinepubs/9699919799/functions/strerror.html)
instead. But the problem is that there is not one, but two functions of the same name
with incompatible API, XSI-compliant:

{% highlight c++ %}
int strerror_r(int errnum, char *buf, size_t buflen);
{% endhighlight %}

and GNU-specific (thanks, wildebeest):
            
{% highlight c++ %}
char *strerror_r(int errnum, char *buf, size_t buflen);
{% endhighlight %}

No problems, the correct variant of `strerror_r` can be detected with a few lines
of [CMake](http://www.cmake.org/) code. And this is a fine solution if you are
writing an application and have control over your build system. But if you are
writing a library distrubuted in source form that is supposed to be used with any
build system, you can't rely on CMake.

A common solution to such problems is using macros. This is also the only solution
if you are using C and, if you are interfacing to C from another language via some
kind of an [FFI](https://en.wikipedia.org/wiki/Foreign_function_interface), you are
totally out of luck.
The man page of [`strerror_r`](http://linux.die.net/man/3/strerror_r) gives
this beatiful condition
that you can check to see if XSI-compliant is provided:

{% highlight c++ %}
(_POSIX_C_SOURCE >= 200112L || _XOPEN_SOURCE >= 600) && ! _GNU_SOURCE
{% endhighlight %}

The only problem is that this only works with glibc and on some platforms, so
you keep getting errors [like this](https://github.com/cppformat/cppformat/issues/93)
and keep adding more checks to the `#ifdef`.

Fortunately, there is a better way. Instead of using macros, you can rely
on function overloading to detect if `strerror_r` is available and,
whether it is XSI-compliant or GNU-specific.

So here's the code that illustrates and tests the idea:

{% highlight c++ %}
#include "format.h"

#ifdef XSI
int strerror_r(int, char *, size_t) { return 0; }
#elif GNU
char *strerror_r(int, char *, size_t) { return 0; }
#endif

struct None {};
static None strerror_r(int, char *, ...) { return None(); }

void check(int) { fmt::print("XSI-compliant strerror_r\n"); }
void check(char *) { fmt::print("GNU-specific strerror_r\n"); }
void check(None) { fmt::print("No strerror_r\n"); }

int main() {
  char buf[10];
  check(strerror_r(0, buf, sizeof(buf)));
}
{% endhighlight %}

Instead of using system functions, I just created prototypes in my code enabled with macros
to simplify testing. The code is pretty straightforward, it simply calls `strerror_r` and
passes its result to the `check` function which prints what version of `strerror_r` is
available.

The only tricky part here is to provide our own overload of `strerror_r`
that is used if the system doesn't provide this function, and to make sure
that it doesn't cause ambiguity. This is achieved by using varargs.

Let's see how it works:

{% highlight bash %}
$ g++ -DXSI test.cc format.cc
$ ./a.out 
XSI-compliant strerror_r
$ g++ -DGNU test.cc format.cc
$ ./a.out 
GNU-specific strerror_r
$ g++ test.cc format.cc
$ ./a.out 
No strerror_r
{% endhighlight %}

As expected, all cases are detected correctly without any use of preprocessor
(other than for testing purposes).

This will be integrated in the [C++ Format](https://github.com/cppformat/cppformat)
library very soon. If you are interested in a more high-level way to report
system errors, check out my
[Reporting system errors in C++ made easy](http://zverovich.net/2014/04/30/reporting-system-errors-made-easy.html)
post.
