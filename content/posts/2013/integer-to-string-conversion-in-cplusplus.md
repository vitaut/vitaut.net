---
title: Fast integer to string conversion in C++
date: 2013-09-07
aliases: ['/2013/09/07/integer-to-string-conversion-in-cplusplus.html']
---

<div style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img src="/img/knuth.jpg"
       title="Warning: the information from this post can be used for premature optimization."
       width="240">
</div>

An updated version of this post is available here:
[Converting a hundred million integers to strings per second](
http://www.zverovich.net/2020/06/13/fast-int-to-string-revisited.html).

In this post I compare the performance of several methods
of integer to string conversion in C++:

* [`sprintf`](http://en.cppreference.com/w/cpp/io/c/fprintf)
* [`std::stringstream`](http://en.cppreference.com/w/cpp/io/basic_stringstream)
* [`std::to_string`](http://en.cppreference.com/w/cpp/string/basic_string/to_string) from C++11
* `boost::format` from the [Boost Format library](http://www.boost.org/doc/libs/1_54_0/libs/format/)
* [`boost::lexical_cast`](http://www.boost.org/doc/libs/1_54_0/doc/html/boost_lexical_cast.html)
* `karma::generate` from the [Boost Spirit Parser framework](http://www.boost.org/doc/libs/1_54_0/libs/spirit/doc/html/index.html)
* `fmt::format_int`, `fmt::format`, `fmt::format_to` and `fmt::compile` from
  the [{fmt} library](https://github.com/fmtlib/fmt)
* [Public-domain `ltoa`](http://www8.cs.umu.se/~isak/snippets/ltoa.c) implementation
* [`decimal_from`](http://ideone.com/nrQfA8) function suggested by Alf P. Steinbach

To measure the performance I used a
[benchmark from Boost Karma](http://www.boost.org/doc/libs/1_52_0/libs/spirit/doc/html/spirit/karma/performance_measurements/numeric_performance/int_performance.html).
This benchmark generates 10,000,000 random integers and converts them to strings
using different methods measuring conversion time. I've replaced nonportable
`itoa` with `sprintf` and added several other methods.

Apart from adding new conversion methods, I've also noticed that the benchmark
used unnecessary conversion to `std::string` in some tests
to compensate for string operations in the other. To get more useful results,
I've split every such test in two, one that does conversion to `std::string` and
one that doesn't. Tests that do unnecessary conversion to `std::string` have suffix
`+std::string`. They are suboptimal, but I've included them for completeness.

Here are the results ordered by the time it took a method to convert 10,000,000
integers to strings (obviously smaller is better); time ratio is the ratio of
conversion time to the best time:

<div id="table_div">
</div>
<div style="height: 400px" id="chart_div">
</div>
<script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
<script type="text/javascript" src="/files/2013-09-stats.js"></script>

I consider these results pretty exciting. First they show that `fmt::format_int`
is the fastest of the tested methods, about 24% faster than
`cppx::decimal_from`, the next contender, and whopping 30x (not 30%) faster than
boost::format. Here's the code to convert an integer to a string with
`fmt::format_int`:

```c++
fmt::format_int f(42);
// The result can be converted to std::string using f.str() or
// accessed as a C string using f.c_str().
auto s = f.c_str(); // s == "42"
```

Note that `fmt::format_int` automatically manages the output buffer unlike
`sprintf` and `karma::generate` which require an error-prone manual memory
management. In the case of `karma::generate` you can probably use an output
iterator such as `back_insert_iterator` for automatic memory management but the
performance will likely suffer.

Another remarkable and surprising (to me) observation is that
`sprintf` is not particularly good for integer formatting. It is more than 6
times slower than `fmt::format_int`. One possible reason for this is that
`sprintf` parses the format string, but so do `fmt::format` and `fmt::format_to`
which are 1.8 - 2.6 times faster than `sprintf`. The good thing is that you
don't have to use `sprintf` in an attempt to sacrifice safety for performance.
There are much faster or at least equally slow but safer methods.

One recent addition to the benchmark is `fmt::compile` which does `constexpr`
format string compilation. As can be seen from the results `fmt::compile` +
`fmt::format_to` are almost as fast as an artisanal integer-to-string converter
optimized by hand (`cppx::decimal_from`). Thanks Louis Dionne for the idea and
Hana Dusíková for the proof-of-concept implementation of format string
compilation.

The benchmark results were obtained on macOS Mojave with Apple LLVM version
10.0.1 (clang-1001.0.46.4) and the following compiler flags: `-O3 -DNDEBUG`.

Running the benchmark:

```
$ git clone --recursive https://github.com/fmtlib/format-benchmark.git
$ cd format-benchmark
$ cmake .
$ make
$ ./int-generator-test.py
```

You can find out more about `fmt::format_int` and `fmt::format` in the [{fmt}
library repository](https://github.com/fmtlib/fmt) on GitHub and in the
[documentation](http://fmt.dev/).

**Update:**
Since I don't have `ltoa` on my platform, I've added a basic
public-domain implementation of this function from
[here](http://www8.cs.umu.se/~isak/snippets/ltoa.c). Let me know in the
comment section if there is a better version available somewhere.

**Update 2:**
Added [decimal_from](http://ideone.com/nrQfA8) function suggested by Alf P.
Steinbach. As `sprintf` and `ltoa` it requires a user-provided buffer.

**Update 3:**
Inspired by a lesson learned from Alexandrescu's talk that "no work is less
work than some work" I've come up with a faster method of integer to string
conversion. Unlike other methods it does one pass over the digits. All other
methods I know do two passes and can be divided into two categories:

1. Count digits (pass 1), then convert digits to chars writing from the end of
   the buffer (pass 2).
2. Convert digits to chars writing from the beginning of the buffer (pass 1).
   Reverse the string in the buffer (pass 2).

Instead of doing this, I just convert digits to chars writing from the end ofi
the buffer and return the pointer to the start of the converted string. In most
cases there is some space left in the beginning of the buffer, but that's fine
because the same is true for the second category of methods above, they just
have this space at the end of the buffer. This avoids unnecessary copying within
a buffer that is often discarded anyway.

I've implemented this method in the `fmt::format_int` class available in the
{fmt} library.

**Update 4:**

Added side effects to make sure that the code being tested is not optimized
away by a super clever compiler (I wish there existed one). This is implemented
by computing a sum of lengths of all formatted strings using `strlen`. 
The `strlen` function is used even in cases where `std::string::size` could be
used to make sure the same extra computation is done for all methods. Note that
since this adds a more or less constant factor to all the methods, high
performers are penalized more.

**Update 5:**

Fixed links to the {fmt} library.

**Update 6 (25 Nov 2019):**

Added `fmt::compile` which does `constexpr` format string compilation and
updated the test results.

