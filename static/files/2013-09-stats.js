google.load("visualization", "1", {packages:["corechart", "table"]});
google.setOnLoadCallback(drawChart);
function drawChart() {
var data = google.visualization.arrayToDataTable([
['Method'                      , 'Time, s' , 'Time ratio' ],
['fmt::format_int'             ,   0.127698,           1.0],
['cppx::decimal_from'          ,   0.158876, 1.24415417626],
['fmt::compile'                ,   0.166164, 1.30122633087],
['karma::generate'             ,   0.167268, 1.30987172861],
['itostr'                      ,   0.207244, 1.62292283356],
['karma::generate+std::string' ,   0.256794, 2.01094770474],
['fmt::format_to'              ,    0.29158, 2.28335604316],
['boost::lexical_cast'         ,   0.393476, 3.08130119501],
['fmt::format'                 ,   0.420751, 3.29489107112],
['ltoa'                        ,   0.463599, 3.63043273975],
['sprintf'                     ,   0.772874, 6.05235790694],
['sprintf+std::string'         ,    0.87743,  6.8711334555],
['std::to_string'              ,    1.03077, 8.07193534746],
['std::stringstream'           ,    1.87598, 14.6907547495],
['boost::format'               ,    3.75657, 29.4176102993],
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
