---
layout: post
title: Solving a puzzle with AMPL and Gecode
date: 2013-02-08
---

{{ page.title }}
================

Here's an interesting little puzzle posted by
[Ryan Ng](https://plus.google.com/u/0/112475770803353943254/posts) on Google+:

> A 5 digit number is written on a whiteboard. Ron erases one of its
> digits and adds a newly constructed number to the original one.
> The result is 41751. What is the original number?

It can be easily solved with constraint programming and I'll demonstrate how
to do it using [AMPL](http://www.ampl.com/) and [Gecode](http://www.gecode.org/).
The model is very simple, it's just a few lines of code:

{% highlight text %}
set Digits = 0..4;
var d{Digits} >= 0 <= 9 integer;
var original integer;

s.t. define_original: original = sum{i in Digits} d[i] * 10 ^ i;
s.t. relation:
  exists{i in Digits}
    (original + sum{j in Digits: j != i}
                  d[j] * 10 ^ (if j < i then j else j - 1) = 41751);
{% endhighlight %}

`Digits` is a set of digit positions starting from 0 for the least
significant digit. The digits themselves are represented by the variable `d`.
As the name suggests, the variable `original` holds the original number
that we are looking for. It is defined in the constraint `define_original`
using variables `d`. And finally, `relation` specifies that there should
exists a number obtained from the original one with one digit removed
which, when added to the original one, gives 41751.

We can use a free student version of AMPL to solve this model.
The Windows version of AMPL is available from the
[download page](http://www.ampl.com/DOWNLOADS/index.html)
on the AMPL website. Versions for other platforms are available from the
[AMPL repository on Netlib](http://www.netlib.org/ampl/student/).

The model uses constraint programming (CP) features or, more specifically,
logical constraints. So we need a CP solver such as Gecode to solve it.
Gecode binaries for AMPL are available for download from the
[GoogleCode AMPL page](http://code.google.com/p/ampl/downloads/list?q=gecode).

Once AMPL and Gecode have been downloaded and extracted, and the model saved
to the file `puzzle.ampl`, we can run `ampl` and solve the the problem:

<pre class="terminal"><code>ampl: model puzzle.ampl;
ampl: option solver gecode;
ampl: solve;
gecode 3.7.3: feasible solution
63299 nodes, 31647 fails
ampl: print original;
37956
</code></pre>

This gives the solution 37956. To see which digit was erased, subtract 
`original` from 41751.

