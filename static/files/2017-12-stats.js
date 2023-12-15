google.load("visualization", "1", {packages:["corechart", "table"]});
google.setOnLoadCallback(drawChart);
function drawChart() {
var data = google.visualization.arrayToDataTable([
['Method'           , 'Time, s', 'Binary size, KiB' ],
['fmt'              ,   38.3   , ''],
['Folly Format'     ,   157.2  , ''],
]);

var options = {
  title: 'Compile time',
  chartArea:{left: '20%', width: '60%'}
};

var chart = new google.visualization.BarChart(document.getElementById('chart_div'));
  data.removeColumn(2);
  chart.draw(data, options);

var data2 = google.visualization.arrayToDataTable([
['Method',              'Time, s'],
['printf',                    2.7],
['printf+string',            18.4],
['fmt',                      22.0],
['IOStreams',                34.6],
['tinyformat',               51.8],
['Boost Format',            120.5],
['Folly Format',            158.7],
]);

var chart = new google.visualization.BarChart(document.getElementById('chart2_div'));
  chart.draw(data2, options);
}
