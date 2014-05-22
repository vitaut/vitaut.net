google.load("visualization", "1", {packages:["corechart", "table"]});
google.setOnLoadCallback(drawChart);
function drawChart() {
var data = google.visualization.arrayToDataTable([
['Method'               , 'Executable size, KiB' , 'Stripped size, KiB' ],
['printf'               ,   41                   ,  30],
['IOStreams'            ,   84                   ,  62],
['C++ Format'           ,   46                   ,  34],
['tinyformat'           ,  418                   , 386],
['Boost Format'         ,  990                   , 923]
]);

var table = new google.visualization.Table(document.getElementById('table_div'));
table.draw(data.clone(), {});

var options = {
  title: 'Executable size',
  vAxis: {title: 'Method', titleTextStyle: {color: 'red'}}
};

var chart = new google.visualization.BarChart(document.getElementById('chart_div'));
chart.draw(data, options);
}
