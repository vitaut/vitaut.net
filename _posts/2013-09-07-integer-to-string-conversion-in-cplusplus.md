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
6. [fmt::Writer](http://zverovich.net/format/#project0classfmt_1_1_basic_writer) from the [format library](https://github.com/vitaut/format)
7. [fmt::Format](http://zverovich.net/format/#fmt::Format__StringRef) from the [format library](https://github.com/vitaut/format)
8. [Public-domain ltoa](http://www8.cs.umu.se/~isak/snippets/ltoa.c) implementation

To measure the performance I used a
[benchmark from Boost Karma](http://www.boost.org/doc/libs/1_52_0/libs/spirit/doc/html/spirit/karma/performance_measurements/numeric_performance/int_performance.html).
This benchmark generates 10,000,000 random integers and converts them to strings using
different methods measuring conversion time. I've replaced nonportable `itoa` with
`sprintf` and added `std::to_string`, `boost::lexical_cast`, `fmt::Writer` and `fmt::Format`
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
<script type="text/javascript">
google.load("visualization", "1", {packages:["corechart", "table"]});
google.setOnLoadCallback(drawChart);
function drawChart() {
var data = google.visualization.arrayToDataTable([
['Method'                      , 'Time, s' , 'Time ratio' ],
['fmt::Writer'                 ,   0.133356,           1.0],
['karma::generate'             ,   0.184496, 1.38348480758],
['fmt::Writer+std::string'     ,   0.378122, 2.83543297639],
['fmt::Format'                 ,   0.386579, 2.89884969555],
['karma::generate+std::string' ,   0.408521, 3.06338672426],
['ltoa'                        ,   0.505352, 3.78949578572],
['fmt::Format+std::string'     ,   0.632557, 4.74337112691],
['std::stringstream'           ,   0.844208, 6.33048381775],
['sprintf'                     ,   0.846803, 6.34994300969],
['boost::lexical_cast'         ,   0.995631, 7.46596328624],
['sprintf+std::string'         ,    1.16461, 8.73309037464],
['std::to_string'              ,    1.42826,  10.710129278],
['boost::format'               ,    4.32976, 32.4676804943]
]);

var table = new google.visualization.Table(document.getElementById('table_div'));
table.draw(data, {});

var options = {
  title: 'Conversion time',
  vAxis: {title: 'Method', titleTextStyle: {color: 'red'}}
};

var chart = new google.visualization.BarChart(document.getElementById('chart_div'));
data.removeColumn(2);
chart.draw(data, options);
}
</script>

I consider these results pretty exciting. First they show that `fmt::Writer` is the
fastest of the tested methods, almost 40% faster than `karma::generate`, the next
contender. Here's the code used to convert an integer `n` to a string using `fmt::Writer`:

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
`std::stringstream`, about 6 times slower than `fmt::Writer`. One reason for this
can be is that it parses the format string, but so does `fmt::Format` which is two
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

You can find out more about `fmt::Writer` and `fmt::Format` in the [format
library repository](https://github.com/vitaut/format) on GitHub and in the
[documentation](http://zverovich.net/format/).

**Update:**
Since I don't have `ltoa` on my platform, I've added a basic
public-domain implementation of this function from
[here](http://www8.cs.umu.se/~isak/snippets/ltoa.c). Let me know in the
comment section if there is a better version available somewhere.
