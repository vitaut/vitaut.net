---
layout: post
title: Does string formatting boost karma?
date: 2012-12-21
---

{{ page.title }}
================

If you've read any of my recent posts about string formatting
([A better string formatting library for C++](/2012/12/12/a-better-string-formatting-library-for-cplusplus.html),
[Making string formatting fast](/2012/12/15/making-string-formatting-fast.html) or
[I can’t believe it’s not Python](/2012/12/17/i-cant-believe-its-not-python.html))
I apologize for bringing this topic up again.

Today my attention was drawn by
[Boost Karma](http://www.boost.org/doc/libs/1_52_0/libs/spirit/doc/html/spirit/karma.html),
which a less-known Boost library for output generation.
The authors of this library
[claim](http://www.boost.org/doc/libs/1_52_0/libs/spirit/doc/html/spirit/karma/tutorials/quick_start.html)
that it is much faster than `printf`, `std::stream` and `boost::format`,
so I decided to have a look at it.

Karma works with generators which can be created in a number of ways.
For example, `int_` creates a built-in generator that outputs an integer.
Generators can be combined using operator `<<` like `int_ << int_` which
outputs two integers, or `*int_` which outputs zero or more integers.
This is somewhat similar to construction of regular expressions or grammar
productions which is not surprising considering that Karma is a part of the
[Spirit Parser Framework](http://www.boost.org/doc/libs/1_52_0/libs/spirit/doc/html/index.html).

Here is a small example:

{% highlight c++ %}
#include <iostream> 
#include <boost/spirit/include/karma.hpp>

using namespace boost::spirit;

int main() {
  karma::generate(
    std::ostream_iterator<char>(std::cout),
    (int_ % ',') << '\n', std::vector<int>{1, 2, 3});
}
{% endhighlight %}

Character literals like ',' are copied unchanged to the output and
`(int_ % ',')` is equivalent to `int_ << *(',' << int_)`.

Compiling it with `g++ -std=c++11 <filename>` and running gives the following
output:

<pre class="terminal"><code>1,2,3
</code></pre>

What strikes me in the example above is that there is no format string there.
As with IOStreams literal text is mixed with arguments, so i18n is
problematic. So you definitely don't want to use Karma for messages shown to
the user.

Also a little mistake like a misused operator in a generator expression
can lead to a cascade of lengthy and incomprehensible error messages.
The good thing though is that format specifications are checked at
compile time.

Karma provides some control over formatting, for example, you can
specify alignment and fill. Specifying precision is also possible although
a bit cumbersome:

{% highlight c++ %}
template <typename T>
struct double2_policy : boost::spirit::karma::real_policies<T> {
  static unsigned int precision(T) { return 2; }
};

int main() {
  karma::real_generator<double, double2_policy<double> > double2;
  std::cout << karma::format('[' << right_align(10)[double2]
    <<  ']', 12.3456) << std::endl;
}
{% endhighlight %}

The above example prints

<pre class="terminal"><code>[     12.35]
</code></pre>

Unfortunately I haven't found an equivalent to printf's `0` format specifier.

One of the claimed advantages of Karma is performance so I decided to do a
small comparison of integer to string conversion with my formatting library.
I took the [int_generator](http://www.boost.org/doc/libs/1_43_0/libs/spirit/optimization/karma/int_generator.cpp)
test and modified it to include the format library. I've exposed an integer
formatting method through `Formatter::operator<<(int)` and used it to avoid
unnecessary parsing of a format string and make the comparison to Karma more
fair. I plan to add similar methods for other types as well.

So here are the results:

<div style="width: 500px; height: 300px" id="chart_div">
</div>
<script type="text/javascript">
google.load("visualization", "1", {packages:["corechart"]});
google.setOnLoadCallback(drawChart);
function drawChart() {
var data = google.visualization.arrayToDataTable([
  ['Name',        'Time, s'],
  ['sprintf',      1.12134 ],
  ['iostreams',    0.839434],
  ['Boost.Format', 5.61053 ],
  ['int_',         0.393489],
  ['format',       0.42093 ]
]);

var options = {
  title: 'Performance',
  hAxis: {title: 'Library', titleTextStyle: {color: 'red'}}
};

var chart = new google.visualization.ColumnChart(document.getElementById('chart_div'));
chart.draw(data, options);
}
</script>

As you can see Karma is indeed the fastest among the tested methods.
However, the difference between format and Karma is only about 7% which
is not too bad considering that format does runtime handling of format
specifications and automatically allocates enough space for the output
while Karma uses a predefined format and a fixed size buffer. What is
surprising to me is that both sprintf and iostreams are much slower.
I would love to know why, so if you have any ideas let me know in the
comment section below.

The performance test is called `int_generator` and it is available in the
[format repository](https://github.com/vitaut/format) at GitHub so you
can verify the results.

The conclusion is that Karma is most useful if you need fast output in
some predefined format known at compile time, but not for any user messages.

