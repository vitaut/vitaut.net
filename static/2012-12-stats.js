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
