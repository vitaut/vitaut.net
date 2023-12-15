google.load("visualization", "1", {packages:["corechart", "table"]});
google.setOnLoadCallback(drawChart);
function drawChart() {
  // Raw int-benchmark results.
  var results = {
    "context": {
      "date": "2020-06-16 18:37:18",
      "host_name": "juno",
      "executable": "./int-benchmark",
      "num_cpus": 16,
      "mhz_per_cpu": 5000,
      "cpu_scaling_enabled": false,
      "caches": [
        {
          "type": "Data",
          "level": 1,
          "size": 32000000,
          "num_sharing": 2
        },
        {
          "type": "Instruction",
          "level": 1,
          "size": 32000000,
          "num_sharing": 2
        },
        {
          "type": "Unified",
          "level": 2,
          "size": 256000000,
          "num_sharing": 2
        },
        {
          "type": "Unified",
          "level": 3,
          "size": 16384000000,
          "num_sharing": 16
        }
      ],
      "load_avg": [0.28,0.17,0.3],
      "library_build_type": "release"
    },
    "benchmarks": [
      {
        "name": "sprintf",
        "run_name": "sprintf",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 14,
        "real_time": 4.8300176426502213e+07,
        "cpu_time": 4.8304181285714284e+07,
        "time_unit": "ns",
        "items_per_second": 2.0702141582425389e+07
      },
      {
        "name": "std_ostringstream",
        "run_name": "std_ostringstream",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 18,
        "real_time": 3.9126384382446609e+07,
        "cpu_time": 3.9129300999999993e+07,
        "time_unit": "ns",
        "items_per_second": 2.5556296035035234e+07
      },
      {
        "name": "std_to_string",
        "run_name": "std_to_string",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 52,
        "real_time": 1.3097335862067457e+07,
        "cpu_time": 1.3098203038461534e+07,
        "time_unit": "ns",
        "items_per_second": 7.6346350492781505e+07
      },
      {
        "name": "std_to_chars",
        "run_name": "std_to_chars",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 76,
        "real_time": 8.9327666332553085e+06,
        "cpu_time": 8.9334930657894704e+06,
        "time_unit": "ns",
        "items_per_second": 1.1193829699487521e+08
      },
      {
        "name": "fmt_to_string",
        "run_name": "fmt_to_string",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 54,
        "real_time": 1.2750516223065831e+07,
        "cpu_time": 1.2751686555555565e+07,
        "time_unit": "ns",
        "items_per_second": 7.8420999108100489e+07
      },
      {
        "name": "fmt_format_runtime",
        "run_name": "fmt_format_runtime",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 35,
        "real_time": 1.9761988600449901e+07,
        "cpu_time": 1.9763795885714278e+07,
        "time_unit": "ns",
        "items_per_second": 5.0597567682978489e+07
      },
      {
        "name": "fmt_format_compile",
        "run_name": "fmt_format_compile",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 55,
        "real_time": 1.2726185182956131e+07,
        "cpu_time": 1.2727286036363626e+07,
        "time_unit": "ns",
        "items_per_second": 7.8571346408249244e+07
      },
      {
        "name": "fmt_format_to_runtime",
        "run_name": "fmt_format_to_runtime",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 48,
        "real_time": 1.4442441150701294e+07,
        "cpu_time": 1.4443445729166651e+07,
        "time_unit": "ns",
        "items_per_second": 6.9235556303620175e+07
      },
      {
        "name": "fmt_format_to_compile",
        "run_name": "fmt_format_to_compile",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 88,
        "real_time": 7.7583574880422512e+06,
        "cpu_time": 7.7590171363636414e+06,
        "time_unit": "ns",
        "items_per_second": 1.2888230331563132e+08
      },
      {
        "name": "fmt_format_int",
        "run_name": "fmt_format_int",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 93,
        "real_time": 7.3832305378570994e+06,
        "cpu_time": 7.3838690107526993e+06,
        "time_unit": "ns",
        "items_per_second": 1.3543035481043315e+08
      },
      {
        "name": "boost_lexical_cast",
        "run_name": "boost_lexical_cast",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 26,
        "real_time": 2.7160477036466964e+07,
        "cpu_time": 2.7162480269230776e+07,
        "time_unit": "ns",
        "items_per_second": 3.6815489236923046e+07
      },
      {
        "name": "boost_format",
        "run_name": "boost_format",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 4,
        "real_time": 1.7779531574342400e+08,
        "cpu_time": 1.7781029175000018e+08,
        "time_unit": "ns",
        "items_per_second": 5.6239714257147266e+06
      },
      {
        "name": "boost_karma_generate",
        "run_name": "boost_karma_generate",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 69,
        "real_time": 9.9817785785358027e+06,
        "cpu_time": 9.9825534347826000e+06,
        "time_unit": "ns",
        "items_per_second": 1.0017477056678315e+08
      },
      {
        "name": "voigt_itostr",
        "run_name": "voigt_itostr",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 46,
        "real_time": 1.4718967388667490e+07,
        "cpu_time": 1.4720309173913069e+07,
        "time_unit": "ns",
        "items_per_second": 6.7933355759413853e+07
      },
      {
        "name": "decimal_from",
        "run_name": "decimal_from",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 73,
        "real_time": 9.4006011606997829e+06,
        "cpu_time": 9.4011533287671078e+06,
        "time_unit": "ns",
        "items_per_second": 1.0636992771302272e+08
      },
      {
        "name": "stout_ltoa",
        "run_name": "stout_ltoa",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 22,
        "real_time": 3.1012352598323062e+07,
        "cpu_time": 3.1013061136363670e+07,
        "time_unit": "ns",
        "items_per_second": 3.2244479047167405e+07
      }
    ]
  };
  var data = [];
  data.push(["Method", "int/s", "Speed ratio"]);
  var max = 0;
  for (var i = 0; i < results.benchmarks.length; i++) {
    max = Math.max(max, results.benchmarks[i].items_per_second);
  }
  for (var i = 0; i < results.benchmarks.length; i++) {
    var bench = results.benchmarks[i];
    var name = bench.name.replace("std_", "std::");
    name = name.replace("fmt_", "fmt::");
    name = name.replace("boost_", "boost::");
    name = name.replace("_compile", "[c]");
    name = name.replace("_runtime", "[r]");
    data.push([
      name,
      Math.round(bench.items_per_second),
      max / bench.items_per_second]);
  }
  data.sort(function(lhs, rhs) { return rhs[1] - lhs[1]; });
  
  data = google.visualization.arrayToDataTable(data);

  var table = new google.visualization.Table(
    document.getElementById('table_div_linux'));
  table.draw(data.clone(), {});

  var options = {
    title: 'Conversion speed',
    vAxis: {title: 'Method', titleTextStyle: {color: 'red'}}
  };

  var chart = new google.visualization.BarChart(
    document.getElementById('chart_div_linux'));
  data.removeColumn(2);
  chart.draw(data, options);
}
