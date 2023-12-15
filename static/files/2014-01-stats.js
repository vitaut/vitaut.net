google.load("visualization", "1", {packages:["corechart"]});
google.setOnLoadCallback(drawChart);
function drawChart() {
var data = new google.visualization.DataTable();
data.addColumn('string', 'Solver');
data.addColumn('number', 'Number of Submissions');
data.addRows([
  ['MINOS', {v: 743495, f: "743495 (39.86%)"}],
  ['MINLP', {v: 507032, f: "507032 (27.19%)"}],
  ['KNITRO', {v: 257738, f: "257738 (13.82%)"}],
  ['Gurobi', {v: 71034, f: "71034 (3.81%)"}],
  ['Ipopt', {v: 33742, f: "33742 (1.81%)"}],
  ['SNOPT', {v: 33538, f: "33538 (1.80%)"}],
  ['csdp', {v: 22144, f: "22144 (1.19%)"}],
  ['DICOPT', {v: 19722, f: "19722 (1.06%)"}],
  ['Cbc', {v: 15640, f: "15640 (0.84%)"}],
  ['XpressMP', {v: 15257, f: "15257 (0.82%)"}]
]);
var chart = new google.visualization.ColumnChart(document.getElementById('solver_chart'));
chart.draw(data, {title: 'Top 10 Solvers'}); 

data = new google.visualization.DataTable();
data.addColumn('string', 'Input');
data.addColumn('number', 'Number of Submissions');
data.addRows([
  ['AMPL', {v: 1649918, f: "1649918 (88.46%)"}],
  ['GAMS', {v: 153158, f: "153158 (8.21%)"}],
  ['SPARSE_SDPA', {v: 23760, f: "23760 (1.27%)"}],
  ['MPS', {v: 10654, f: "10654 (0.57%)"}],
  ['TSP', {v: 6605, f: "6605 (0.35%)"}],
  ['C', {v: 4849, f: "4849 (0.26%)"}],
  ['CPLEX', {v: 4389, f: "4389 (0.24%)"}],
  ['Fortran', {v: 4083, f: "4083 (0.22%)"}],
  ['MOSEL', {v: 1680, f: "1680 (0.09%)"}],
  ['LP', {v: 1083, f: "1083 (0.06%)"}]
]);
chart = new google.visualization.ColumnChart(document.getElementById('input_chart'));
chart.draw(data, {title: 'Top 10 Inputs'});

data = new google.visualization.DataTable();
data.addColumn('string', 'Category');
data.addColumn('number', 'Number of Submissions');
data.addRows([
  ['nco', {v: 1077102, f: "1077102 (57.75%)"}],
  ['kestrel', {v: 507570, f: "507570 (27.21%)"}],
  ['milp', {v: 104255, f: "104255 (5.59%)"}],
  ['minco', {v: 57120, f: "57120 (3.06%)"}],
  ['lp', {v: 39812, f: "39812 (2.13%)"}],
  ['sdp', {v: 25812, f: "25812 (1.38%)"}],
  ['go', {v: 18758, f: "18758 (1.01%)"}],
  ['cp', {v: 11662, f: "11662 (0.63%)"}],
  ['co', {v: 6622, f: "6622 (0.36%)"}],
  ['bco', {v: 5158, f: "5158 (0.28%)"}]
]);
chart = new google.visualization.ColumnChart(document.getElementById('category_chart'));
chart.draw(data, {title: 'Top 10 Categories'});

data = new google.visualization.DataTable();
data.addColumn('string', 'Interface');
data.addColumn('number', 'Number of Submissions');
data.addRows([
  ['XML-RPC', {v: 1061702, f: "1061702 (56.93%)"}],
  ['kestrel', {v: 507570, f: "507570 (27.21%)"}],
  ['Web', {v: 264892, f: "264892 (14.20%)"}],
  ['Web Example', {v: 30014, f: "30014 (1.61%)"}],
  ['JAVA Submission Tool', {v: 466, f: "466 (0.02%)"}],
  ['email', {v: 443, f: "443 (0.02%)"}]
]);
chart = new google.visualization.ColumnChart(document.getElementById('interface_chart'));
chart.draw(data, {title: 'Interfaces'});
}