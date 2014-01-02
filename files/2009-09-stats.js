google.load("visualization", "1", {packages:["corechart", "table"]});
google.setOnLoadCallback(drawChart);
function drawChart() {
var data = google.visualization.arrayToDataTable([
['Method'                      , 'Time, s' , 'Time ratio' ],
['fmt::FormatInt'              ,   0.140499,           1.0],
['cppx::decimal_from'          ,   0.160447, 1.14197965822],
['fmt::Writer'                 ,   0.170481, 1.21339653663],
['karma::generate'             ,   0.217157, 1.54561242429],
['strtk::type_to_string'       ,   0.381777, 2.71729336152],
['karma::generate+std::string' ,   0.405444, 2.88574295902],
['fmt::Writer+std::string'     ,   0.414739, 2.95190001352],
['fmt::Format'                 ,   0.443754, 3.15841393889],
['ltoa'                        ,   0.538002, 3.82922298379],
['fmt::Format+std::string'     ,   0.686678, 4.88742268628],
['sprintf'                     ,   0.948262, 6.74924376686],
['boost::lexical_cast'         ,    1.08146, 7.69727898419],
['sprintf+std::string'         ,    1.20853, 8.60169823273],
['std::stringstream'           ,    1.42531, 10.1446273639],
['std::to_string'              ,     1.5242, 10.8484757899],
['boost::format'               ,    4.43679, 31.5788012726]
]);

var table = new google.visualization.Table(document.getElementById('table_div'));
table.draw(data.clone(), {});

var options = {
  title: 'Conversion time',
  vAxis: {title: 'Method', titleTextStyle: {color: 'red'}}
};

var chart = new google.visualization.BarChart(document.getElementById('chart_div'));
data.removeColumn(2);
chart.draw(data, options);
}
