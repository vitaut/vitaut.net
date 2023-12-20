---
title: Converting a hundred million integers to strings per second
date: 2020-06-13
aliases: ['/2020/06/13/fast-int-to-string-revisited.html']
---

![](/img/dude.jpg#floatright "New shit has come to light.")

Almost 7 years ago I wrote a [blog post](
http://www.zverovich.net/2013/09/07/integer-to-string-conversion-in-cplusplus.html)
comparing performance of different methods of converting an integer into a
string. A lot of things have changed since then so I decided to write a
follow-up post and see how much progress has been made over the years.

First of all let's look at the [benchmark itself](
https://github.com/fmtlib/format-benchmark/blob/d0d5e141df6a8f2e60d4ba3ea718415a00ca3e5b/src/int-benchmark.cc).
It is based on Boost Karma [int_performance](
http://www.boost.org/doc/libs/1_52_0/libs/spirit/doc/html/spirit/karma/performance_measurements/numeric_performance/int_performance.html)
benchmark ported to [Google Benchmark](https://github.com/google/benchmark) to
make the results more reproducible. It reports the time taken to convert ten
million integers into strings. This is a somewhat weird metric so I changed it
into a more intuitive conversion speed in integers per second.

One problem with the benchmark was that it used `rand` to generate input
data in a non-portable way (thanks Travis Downs for [reporting this issue](
https://github.com/fmtlib/format-benchmark/issues/12)). This was fixed by
replacing `rand` with a [proper pseudo-random number generator](
https://en.cppreference.com/w/cpp/numeric/random) so now the input distribution
is consistent across platforms.

Travis also [pointed me](https://twitter.com/trav_downs/status/1271595932665237504)
to a recent [bug on Intel CPUs](
https://www.intel.com/content/www/us/en/support/articles/000055650/processors.html)
which may affect performance when jump instructions cross cache lines.
Experiments showed a big variation in `mite_uops` / `dsb_uops` after unrelated
code changes (e.g. adding an unused function). To make the benchmark more
reliable I implemented Intel CPU detection and the recommended [mitigation](
https://www.intel.com/content/dam/support/us/en/documents/processors/mitigations-jump-conditional-code-erratum.pdf),
namely added `-Wa,-mbranches-within-32B-boundaries` to the compiler options.

Here is an example of a single benchmark run without mitigation:

```
$ perf stat -e uops_issued.any,idq.dsb_uops,idq.mite_uops,dsb2mite_switches.penalty_cycles \
    ./int-benchmark --benchmark_filter=format_int
...
---------------------------------------------------------------------
Benchmark           Time             CPU   Iterations UserCounters...
---------------------------------------------------------------------
format_int    8420131 ns      8420392 ns           83 items_per_second=118.759M/s

 Performance counter stats for './int-benchmark --benchmark_filter=format_int':

     9,708,172,187      uops_issued.any                                             
     8,745,800,873      idq.dsb_uops                                                
     1,903,352,743      idq.mite_uops                                               
       470,737,031      dsb2mite_switches.penalty_cycles                                   
```

and here is the same benchmark run with mitigation:

```
$ perf stat -e uops_issued.any,idq.dsb_uops,idq.mite_uops,dsb2mite_switches.penalty_cycles \
    ./int-benchmark --benchmark_filter=format_int
...
---------------------------------------------------------------------
Benchmark           Time             CPU   Iterations UserCounters...
---------------------------------------------------------------------
format_int    7455764 ns      7456006 ns           93 items_per_second=134.12M/s

 Performance counter stats for './int-benchmark --benchmark_filter=format_int':

    11,585,171,382      uops_issued.any                                             
    13,069,550,403      idq.dsb_uops                                                
       335,873,122      idq.mite_uops                                               
        11,939,259      dsb2mite_switches.penalty_cycles                                   
```

As you can see there is almost 13% performance difference and a dramatic drop in
`dsb2mite_switches.penalty_cycles` (and `mite_uops` / `dsb_uops`) that suggests
that the mitigation is working.

And finally I added digest computation for output strings to prevent compilers
from optimizing away parts of the conversion and to validate the results.
This is only a few percent slower than `benchmark::DoNotOptimize` even for the
fastest case and makes the benchmark much more reliable and arguably more
realistic since the conversion output is unlikely to be discarded in practice.

Here are the results on Intel Core i7-8569U CPU @ 2.80GHz running macOS and
compiled with Apple clang version 11.0.3 (clang-1103.0.32.62) and libc++:

<div id="table_div_mac">
</div>
<div style="height: 420px" id="chart_div_mac">
</div>
<script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
<script type="text/javascript" src="/files/2020-06-stats-mac.js"></script>

Speed ratio, as the name suggests, is the fastest method's speed divided by the
current method speed or how much slower this method is compared to the leader.
`[c]` and `[r]` mean compile-time and runtime format string processing
respectively.

As you can see {fmt}'s `format_int` still remains the fastest on this
benchmark closely followed by `format_to` with compile-time processing of
format strings. Both can now deliver over a 100 million conversions per second
on a medium-spec laptop.

Alf P. Steinbach's elegantly simple `decimal_from` which does formatting in
reverse to avoid size computation and then calls `std::reverse` is in the third
place (fourth after adding `u2985907`).

[`std::to_chars`](https://en.cppreference.com/w/cpp/utility/to_chars) is a new
addition to the benchmark. It is a low-level numeric formatting function
introduced in C++17 to address some of the limitations of `sprintf`, `iostreams`
and `std::to_string`. It shows a respectable result, only 30% slower than
`fmt::format_int`.

Remarkably, `fmt::to_string` and `fmt::format` with compile-time format string
processing are only ~7% slower than libc++'s `to_chars` even though they return
`std::string` while `to_chars` operates on a stack-allocated buffer. This is
partly due to small string optimization that avoids dynamic memory allocation.

[`std::to_string`](
https://en.cppreference.com/w/cpp/string/basic_string/to_string) is no longer a
performance disaster as it used to be, at least on integer input. It is still
affected by the global locale giving unpredictable results and nondeterministic
performance and should generally be avoided but its an interesting development
nevertheless.

Another interesting result is that `fmt::format` with runtime format string
processing is faster than `std::to_string` and is more than 4x faster than
`sprintf` (previously it was less than 2x faster).

Now let's repeat the exercise on Linux. Here are the results on Intel Core
i9-9900K CPU @ 3.60GHz running Ubuntu 20.20 and compiled with GCC 9.3.0 and
libstdc++:

<div id="table_div_linux">
</div>
<div style="height: 400px" id="chart_div_linux">
</div>
<script type="text/javascript" src="/files/2020-06-stats-linux.js"></script>

Here the results are more balanced. `fmt::format_int` is still the leader but it
is only ~21% faster than `std::to_chars`.

Interestingly, `std::ostringstream` is faster than `sprintf` on this platform
(if you reuse the same stream object).

Runtime format string processing is not as good on gcc as on clang so it
might be something worth looking into. In the meantime it's possible to use
compile-time format string processing in rare cases when formatting is a
performance bottleneck.

So what is `format_int` and what makes it fast?

The idea is very simple - it has a small buffer within the object itself and
formats backwards with a single pass handling pairs of digits at a time to
minimize expensive integer divisions (which a compiler turns into cheaper
but still expensive multiplications). The idea of processing pairs of digits
comes from the great talk by Alexei Alexandrescu [Three Optimization Tips For
C++](https://archive.org/details/AndreiAlexandrescu-Three-Optimization-Tips).
`format_int` is very easy to use ([https://godbolt.org/z/2Kp9iZ](
https://godbolt.org/z/2Kp9iZ)):

```c++
auto f = fmt::format_int(42);
// f.data() is the data, f.size() is the size
```

It's more user-friendly and safer than other low-level alternatives because it
manages memory automatically but you may need to copy the data. Note that
neither `snprintf` nor `to_chars` give you the information on how much storage
you need, so you often have to overallocate and then do an extra copy anyway.
For example, here's how to format into a `std::string` using `std::to_chars`:

```c++
std::array<char, std::numeric_limits<int>::digits10 + 2> buffer;
auto result = std::to_chars(buffer.data(),
                            buffer.data() + buffer.size(), number);
if (result.ec == std::errc()) {
  std::string result(buffer.data(), result.ptr); // Copy the data into string.
  // Use result.
} else {
  // Handle the error.
}
```

In any case, you don't need to use these low-level APIs often - they are mostly
for implementing higher level facilities and it's easy to wrap `std::to_chars`
in a more user-friendly API. For example numeric formatting in [`std::format`](
https://en.cppreference.com/w/cpp/utility/format/format) is defined in terms of
`std::to_chars`.

**Summary**

There have been big improvements to standard library implementations in
terms of performance (e.g. `std::to_string` is much faster now) and the
availability of new locale-independent formatting facilities (`std::to_chars`).
The [open-source {fmt} library](https://github.com/fmtlib/fmt) continues to
provide some of the fastest integer formatters that are often more performant
than their standard counterparts.

Benchmarking remains to be a tricky business and extra care should be taken to
ensure reproducibility of results, particularly in view of recent hardware bugs
and mitigations and increasingly advanced compiler optimizations.

**Update**:

As [pointed out](https://twitter.com/ivafanas/status/1273246162708037633) by
Иван Афанасьев, libc++'s implementation of `to_string` ignores the locale for
integer formatting (but not for floating point).

**Update 2**:

Added [u2985907](
https://github.com/fmtlib/format-benchmark/blob/master/src/u2985907.h), an
integer to string conversion method from
[https://stackoverflow.com/a/19944488/471164](
https://stackoverflow.com/a/19944488/471164) with [fixes](
https://gist.github.com/cpei-avalara/8aedf14f5618852be2cff4de267d497c).
This method by StackOverflow user [user2985907](
https://stackoverflow.com/users/2985907/user2985907), sometimes incorrectly
attributed to jiaendu, shows good results. Unfortunately it uses a whopping
90k of data tables which is a bit excessive. For comparison, the whole {fmt}
library compiled with LTO is ~57k after [recent optimizations](
http://www.zverovich.net/2020/05/21/reducing-library-size.html) which includes
implementations of integer and floating-point formatting algorithms.
