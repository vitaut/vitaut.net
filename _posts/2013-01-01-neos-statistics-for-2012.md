---
layout: post
title: NEOS statistics for 2012
date: 2013-01-01
---

{{ page.title }}
================

With the start of a new year I think it's about time to look at the
[NEOS Server](http://www.neos-server.org/neos/) statistics for 2012.
So I wrote a small [IPython](http://ipython.org/) notebook that
extracts the information from
[NEOS Solver Access Statistics](http://www.neos-server.org/neos/report.html)
and here are the results.

<div style="width: 500px; height: 300px" id="solver_chart">
</div>
Gurobi has become number one solver on NEOS in 2012 which is not
surprising (for me). Interestingly, top NEOS solvers are either nonlinear
or mixed integer or both. 

<div style="width: 500px; height: 300px" id="input_chart">
</div>

Modelling languages continue to dominate as in a
[similar report made by Erwin Kalvelagen in 2009](http://yetanothermathprogrammingconsultant.blogspot.com/2009/11/neos-statistics.html),
with AMPL being the most widely used input format.
AMPL and GAMS together account for more than 90% of submissions.

<div style="width: 500px; height: 300px" id="category_chart">
</div>

<div style="width: 500px; height: 300px" id="interface_chart">
</div>

The IPython notebook which I used to extract statistics from NEOS
is available [here](https://github.com/vitaut/neos-stats).

<script type="text/javascript" src="/files/2013-01-stats.js">
</script>
