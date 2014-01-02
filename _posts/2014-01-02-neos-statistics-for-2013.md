---
layout: post
title: NEOS statistics for 2013
date: 2014-01-02
---

{{ page.title }}
================

2013 is over so it's time to report [NEOS Server](http://www.neos-server.org/neos/)
statistics.

<div style="width: 500px; height: 300px" id="input_chart">
</div>

The results are very different from the
[previous year](http://zverovich.net/2013/01/01/neos-statistics-for-2012.html).
AMPL is now used in almost 90% of all submissions, a large increase from ~57% in 2012.
The use of low-level formats such as MPS decreased to less than 4%, down from ~10%
the year before.

<div style="width: 500px; height: 300px" id="solver_chart">
</div>

Top three positions in the solver category are now occupied by nonlinear solvers,
MINOS, MINLP and KNITRO.

<div style="width: 500px; height: 300px" id="category_chart">
</div>

<div style="width: 500px; height: 300px" id="interface_chart">
</div>

The IPython notebook which I used to extract statistics from NEOS
is available [here](https://github.com/vitaut/neos-stats).
I have updated it to make the start and end date configurable.

<script type="text/javascript" src="/files/2014-01-stats.js">
</script>
