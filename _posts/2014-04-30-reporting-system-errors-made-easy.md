---
layout: post
title: Reporting system errors in C++ made easy
date: 2014-04-30
---

{{ page.title }}
================

  <div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
    <img border=
    "0" src=
    "/img/error.png"
    title=
    "Error messages help you quickly pinpoint the source of the problem."
    width="240">
  </div>


Reporting system errors in C++ is a daunting task. By system errors I mean
errors returned by standard C library functions, POSIX or Windows API.
In an ideal world you'd have a nice C++ API with errors reported as exceptions.
But often you need to use this nasty C function that indicates failure by a
special return value and sets <code>errno</code>. Or even worse,
you have to call a Windows API function and the error code returned by
<code>GetLastError</code> needs to be converted to a readable form via
<code>FormatMessage</code> that will only appeal to you if you like functions
with 7 arguments with meaning of some of them depending on values of the other.

To cope with this, the [C++ Format library](http://cppformat.github.io) now
provides <code>SystemError</code> exception class and two simple functions,
<code>ThrowSystemError</code> and <code>ThrowWinError</code>. Both functions
take an error code and a format string and accept variable number of
arguments feeded via <code>operator&lt;&lt;</code> like the <code>Format</code>
function. They format the arguments according to the format string, get
the error message corresponding to the error code and throw
<code>SystemError</code> exception with the description of the form:

{% highlight text %}
<your-message>: <system-error-message>
{% endhighlight text %}

where <code>&lt;your-message&gt;</code> is your formatted message and
<code>&lt;system-error-message&gt;</code> is the system error message.

It is best illustrated with an example. Let's say we need to open
a file and pass the <code>FILE</code> object into some legacy C API.
That's how you can do this with proper error handling using
<code>ThrowSystemError</code>:

{% highlight c++ %}
FILE *f = fopen(filename, "r");
if (!f)
  fmt::ThrowSystemError(errno, "Cannot open file '{}'") << filename;
{% endhighlight c++ %}

If the file doens't exist, this will throw <code>SystemError</code> exception
with a description such as "Cannot open file 'test.log': No such file or directory".
And of course you can wrap this in a nice reusable RAII class that makes
sure the file is closed when the object is destroyed.

The second function, <code>ThrowWinError</code> is similar, but it accept
error codes as given by <code>GetLastError</code> on Windows. Obviously
this function is only available on Windows.

This new functionality is implemented in the [C++ Format repository](https://github.com/cppformat/cppformat)
and will be available in the next release. Also, ulike <code>std::system_error</code>
and friends, it works with legacy compilers that don't (fully) support C++11.
