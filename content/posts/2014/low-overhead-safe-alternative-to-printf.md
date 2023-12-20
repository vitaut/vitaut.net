---
title: Safe low-overhead alternative to printf
date: 2014-05-22
aliases: ['/2014/05/22/low-overhead-safe-alternative-to-printf.html']
---

<div style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img src="/img/code-bloat.gif"
       title="Do you want to talk about code bloat?" width="240">
</div>

In posts [Making string formatting fast](http://zverovich.net/2012/12/15/making-string-formatting-fast.html)
and [Fast integer to string conversion in C++](http://zverovich.net/2013/09/07/integer-to-string-conversion-in-cplusplus.html)
I have shown that safe alternatives to `printf` and `sprintf` such as
the [C++ Format library](http://cppformat.github.io/) can perform on par and
even outperform their unsafe C counterparts.

But speed is not the only parameter that may be of interest to us.
Another important parameter is the size of compiled code or "code bloat" and
this is what the current post is about.

First question is how does one measure the code bloat. Fortunately,
Chris Foster, the author of [tinyformat](https://github.com/c42f/tinyformat)
wrote a nice benchmark `bloat_test.sh` which I took the liberty to extend
by including [C++ Format](http://cppformat.github.io/) and making some minor
improvements. This benchmark simulates a medium-sized project by generating
100 translation units each containing 5 calls to `printf` or its equivalent
for a particular formatting method. These translation units are compiled into
a single executable the size of which gives a measure of code bloat.

So here are the benchmark results, obviously smaller is better:

<div id="table_div">
</div>
<div style="height: 400px" id="chart_div">
</div>
<script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
<script type="text/javascript" src="/files/2014-05-stats.js"></script>

These results where obtained with GCC 4.8.1 on Ubuntu 13.10 x86_64.
I'm only showing the results for the optimized version (compiled with `-O3`)
because that's what the user normally sees. `libc`, `libstdc++` and `libformat`
are all linked as shared libraries to compare formatting function overhead
only. Boost Format and tinyformat are header-only libraries so there are
no linkage options for them.

As you can see C++ Format has 80% less overhead in terms of resulting code
size compared to IOStreams and comes pretty close to `printf`. In real code
the effect of replacing `printf` with C++ Format methods will be even more
negligible as the benchmark code consists almost entirely of print methods.

So the conclusion is that safe print methods can easily compete with `printf`
both in terms of resulting code size and runtime speed. However, this requires
careful implementation, otherwise the code bloat can be enormous as the
results for Boost Format show.

As usual, you can reproduce the results yourself:

```
$ git clone --recursive https://github.com/cppformat/format-benchmark.git
$ cd format-benchmark
$ cmake .
$ make
$ ./bloat-test.py
```
