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

<script type="text/javascript">
google.load("visualization", "1", {packages:["corechart"]});
google.setOnLoadCallback(drawChart);
function drawChart() {
var data = new google.visualization.DataTable();
data.addColumn('string', 'Solver');
data.addColumn('number', 'Number of Submissions');
data.addRows([
  ['Gurobi', {v: 59248, f: "59248 (16.78%)"}],
  ['MINOS', {v: 31191, f: "31191 (8.83%)"}],
  ['CONOPT', {v: 27640, f: "27640 (7.83%)"}],
  ['SBB', {v: 20082, f: "20082 (5.69%)"}],
  ['KNITRO', {v: 19145, f: "19145 (5.42%)"}],
  ['XpressMP', {v: 17426, f: "17426 (4.94%)"}],
  ['MINTO', {v: 15525, f: "15525 (4.40%)"}],
  ['SNOPT', {v: 14738, f: "14738 (4.17%)"}],
  ['Bonmin', {v: 12928, f: "12928 (3.66%)"}],
  ['Ipopt', {v: 12558, f: "12558 (3.56%)"}]
]);
var chart = new google.visualization.ColumnChart(document.getElementById('solver_chart'));
chart.draw(data, {title: 'Top 10 Solvers'}); 

data = new google.visualization.DataTable();
data.addColumn('string', 'Input');
data.addColumn('number', 'Number of Submissions');
data.addRows([
  ['AMPL', {v: 200831, f: "200831 (56.88%)"}],
  ['GAMS', {v: 121334, f: "121334 (34.36%)"}],
  ['SPARSE_SDPA', {v: 7438, f: "7438 (2.11%)"}],
  ['MPS', {v: 4650, f: "4650 (1.32%)"}],
  ['Fortran', {v: 3715, f: "3715 (1.05%)"}],
  ['MOSEL', {v: 3317, f: "3317 (0.94%)"}],
  ['TSP', {v: 3042, f: "3042 (0.86%)"}],
  ['CPLEX', {v: 3003, f: "3003 (0.85%)"}],
  ['C', {v: 2514, f: "2514 (0.71%)"}],
  ['MATLAB_BINARY', {v: 1489, f: "1489 (0.42%)"}]
]);
chart = new google.visualization.ColumnChart(document.getElementById('input_chart'));
chart.draw(data, {title: 'Top 10 Inputs'});

data = new google.visualization.DataTable();
data.addColumn('string', 'Category');
data.addColumn('number', 'Number of Submissions');
data.addRows([
  ['nco', {v: 92930, f: "92930 (26.32%)"}],
  ['milp', {v: 86483, f: "86483 (24.49%)"}],
  ['minco', {v: 60554, f: "60554 (17.15%)"}],
  ['lp', {v: 41627, f: "41627 (11.79%)"}],
  ['kestrel', {v: 26295, f: "26295 (7.45%)"}],
  ['cp', {v: 11542, f: "11542 (3.27%)"}],
  ['go', {v: 10464, f: "10464 (2.96%)"}],
  ['sdp', {v: 9428, f: "9428 (2.67%)"}],
  ['bco', {v: 4413, f: "4413 (1.25%)"}],
  ['co', {v: 3049, f: "3049 (0.86%)"}]
]);
chart = new google.visualization.ColumnChart(document.getElementById('category_chart'));
chart.draw(data, {title: 'Top 10 Categories'});

data = new google.visualization.DataTable();
data.addColumn('string', 'Interface');
data.addColumn('number', 'Number of Submissions');
data.addRows([
  ['Web', {v: 234757, f: "234757 (66.49%)"}],
  ['XML-RPC', {v: 88334, f: "88334 (25.02%)"}],
  ['kestrel', {v: 26294, f: "26294 (7.45%)"}],
  ['Web Example', {v: 2693, f: "2693 (0.76%)"}],
  ['email', {v: 533, f: "533 (0.15%)"}],
  ['JAVA Submission Tool', {v: 480, f: "480 (0.14%)"}]
]);
chart = new google.visualization.ColumnChart(document.getElementById('interface_chart'));
chart.draw(data, {title: 'Interfaces'});
}
</script>
