---
title: NEOS statistics for 2013
date: 2014-01-02
aliases: ['/2014/01/02/neos-statistics-for-2013.html']
---

2013 is over so it's time to report the annual [NEOS Server](http://www.neos-server.org/neos/)
statistics again.

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

The input methods have changed dramatically as well. While in 2012 most submissions
where done via web, in 2013 submissions via APIs have taken the lead.

The IPython notebook which I used to extract statistics from NEOS
is available [here](https://github.com/vitaut/neos-stats).
I have updated it to make the start and end date configurable.

<script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
<script type="text/javascript" src="/2014-01-stats.js">
</script>
