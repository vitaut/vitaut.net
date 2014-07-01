---
layout: post
title: Fast integer to string conversion in C++
date: 2013-09-07
---

{{ page.title }}
================

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
    <img border=
    "0" src=
    "/img/knuth.jpg"
    title=
    "Warning: the information from this post can be used for premature optimization."
    width="240">
  </div>

In this post I compare the performance of several methods
of integer to string conversion in C++:

1. [sprintf](http://en.cppreference.com/w/cpp/io/c/fprintf)
2. [std::stringstream](http://en.cppreference.com/w/cpp/io/basic_stringstream)
3. [std::to_string](http://en.cppreference.com/w/cpp/string/basic_string/to_string) from C++11
4. boost::format from the [Boost Format library](http://www.boost.org/doc/libs/1_54_0/libs/format/)
4. [boost::lexical_cast](http://www.boost.org/doc/libs/1_54_0/doc/html/boost_lexical_cast.html)
5. karma::generate from the [Boost Spirit Parser framework](http://www.boost.org/doc/libs/1_54_0/libs/spirit/doc/html/index.html)
6. [fmt::Writer](http://zverovich.net/format/#project0classfmt_1_1_basic_writer) from the [C++ Format library](https://github.com/cppformat/cppformat)
7. [fmt::format](http://zverovich.net/format/#fmt::Format__StringRef) from the [C++ Format library](https://github.com/cppformat/cppformat)
8. [Public-domain ltoa](http://www8.cs.umu.se/~isak/snippets/ltoa.c) implementation
9. [decimal_from](http://ideone.com/nrQfA8) function suggested by Alf P. Steinbach
10. `fmt::FormatInt` from the [C++ Format library](https://github.com/cppformat/cppformat)
11. `strtk::type_to_string` from the [strtk library](https://code.google.com/p/strtk/)

To measure the performance I used a
[benchmark from Boost Karma](http://www.boost.org/doc/libs/1_52_0/libs/spirit/doc/html/spirit/karma/performance_measurements/numeric_performance/int_performance.html).
This benchmark generates 10,000,000 random integers and converts them to strings using
different methods measuring conversion time. I've replaced nonportable `itoa` with
`sprintf` and added `std::to_string`, `boost::lexical_cast`, `fmt::Writer` and `fmt::format`
methods.

Apart from adding new conversion methods, I've also noticed that the benchmark
used unnecessary conversion to `std::string` in `sprintf` and `karma::generate` tests
to compensate for string operations in other tests. To get more useful results,
I've split every such test in two, one that does conversion to `std::string` and
one that doesn't. Tests that do unnecessary conversion to `std::string` have suffix
`+std::string`. They are suboptimal, but I've included them for reference.

Here are the results ordered by the time it took a method to convert 10,000,000
integers to strings (obviously smaller is better); time ratio is the ratio of
conversion time to the best time:

<div id="table_div">
</div>
<div style="height: 400px" id="chart_div">
</div>
<script type="text/javascript" src="/files/2013-09-stats.js"></script>

I consider these results pretty exciting. First they show that `fmt::Writer` is the
fastest (was the fastest, see the updates at the bottom of the post) of the tested
methods, almost 40% faster than `karma::generate`, the next contender. Here's the
code used to convert an integer `n` to a string using `fmt::Writer`:

{% highlight c++ %}
fmt::Writer w;
w << n;
// The result can be converted to std::string using w.str() or
// accessed as a C string using w.c_str().
{% endhighlight %}

Note that `fmt::Writer` automatically allocates enough space to hold the formatted output
unlike `sprintf` and `karma::generate` which use a preallocated buffer. In case of
`karma::generate` you can probably use another output iterator, but the performance
is likely to be lower.

Another remarkable and surprising (to me) thing about the results is that `sprintf` is
not particularly fast for integer formatting. It has about the same performance as
`std::stringstream`, about 6 times slower than `fmt::Writer`. One possible reason for
this is that `sprintf` parses the format string, but so does `fmt::format` which is two
times faster than `sprintf`. Anyway, the good thing is that you don't have to
use `sprintf` even for performance reasons. There are much faster or at least equally
slow but safer methods even in the standard library.

The benchmark results were obtained on Ubuntu 13.04 with GCC 4.7.3 and the following
compiler flags: `-O3 -DNDEBUG -std=c++11`.

Running the benchmark:

{% highlight bash %}
$ git clone --recursive https://github.com/vitaut/format.git
$ cd format
$ cmake .
$ make
$ cd format-benchmark
$ ./int-generator-test.py
{% endhighlight %}

You can find out more about `fmt::Writer` and `fmt::format` in the [C++ Format
library repository](https://github.com/cppformat/cppformat) on GitHub and in the
[documentation](http://cppformat.github.io/doc/latest).

**Update:**
Since I don't have `ltoa` on my platform, I've added a basic
public-domain implementation of this function from
[here](http://www8.cs.umu.se/~isak/snippets/ltoa.c). Let me know in the
comment section if there is a better version available somewhere.

**Update 2:**
Added [decimal_from](http://ideone.com/nrQfA8) function suggested by Alf P. Steinbach.
It has approximately the same performance as `fmt::Writer`, the difference of 0.5% is
probably less than the measurement error. In some runs it is even marginally faster.
As `sprintf` and `ltoa` and unlike `fmt::Writer` it requires preallocated buffer.

**Update 3:**
Inspired by a lesson learned from Alexandrescu's talk that "no work is less work than
some work" I've come up with a faster method of integer to string conversion. Unlike
other methods it does one pass over the digits. All other methods I know do two passes
and can be divided into two categories:

1. Count digits (pass 1), then convert digits to chars writing from the end of the
   buffer (pass 2).
2. Convert digits to chars writing from the beginning of the buffer (pass 1).
   Reverse the string in the buffer (pass 2).

Instead of doing this, I just convert digits to chars writing from the end of the
buffer and return the pointer to the start of the converted string. In most cases
there is some space left in the beginning of the buffer, but that's fine because
the same is true for the second category of methods above, they just have this
space at the end of the buffer. This avoids unnecessary copying within a buffer
that is discarded anyway.

I've implemented this method in the `fmt::FormatInt` class which can be used as follows:

{% highlight c++ %}
fmt::FormatInt(42).str();   // convert to std::string
fmt::FormatInt(42).c_str(); // convert and get as a C string
                            // (mind the lifetime, same as std::string::c_str())
{% endhighlight %}

I've updated the test results and as you can see it is about 30% faster than the
previous winner, `fmt::Writer`.

**Update 4:**

Added `strtk::type_to_string` as suggested in the comments.

**Update 5:**

Added side effects to make sure that the code being tested is not optimized
away by a super clever compiler (I wish there existed one). This is implemented
by computing a sum of lengths of all formatted strings using strlen. 
The strlen function is used even in cases where std::string::size could be used
to make sure the same extra computation is done for all methods. Note that since
this adds a more or less constant factor to all the methods, high performers are
penalized more.
