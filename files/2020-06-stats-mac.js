google.load("visualization", "1", {packages:["corechart", "table"]});
google.setOnLoadCallback(drawChart);
function drawChart() {
  // Raw int-benchmark results.
  var results = {
    "context": {
      "date": "2020-06-16 08:20:34",
      "host_name": "viz-mbp",
      "executable": "./int-benchmark",
      "num_cpus": 8,
      "mhz_per_cpu": 2800,
      "cpu_scaling_enabled": false,
      "caches": [
        {
          "type": "Data",
          "level": 1,
          "size": 32768000,
          "num_sharing": 2
        },
        {
          "type": "Instruction",
          "level": 1,
          "size": 32768000,
          "num_sharing": 2
        },
        {
          "type": "Unified",
          "level": 2,
          "size": 262144000,
          "num_sharing": 2
        },
        {
          "type": "Unified",
          "level": 3,
          "size": 8388608000,
          "num_sharing": 8
        }
      ],
      "load_avg": [1.92139,2.21094,2.22559],
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
        "iterations": 11,
        "real_time": 6.2644334552301601e+07,
        "cpu_time": 6.2472818181818180e+07,
        "time_unit": "ns",
        "items_per_second": 1.6006961573105978e+07
      },
      {
        "name": "std_ostringstream",
        "run_name": "std_ostringstream",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 4,
        "real_time": 1.5536632222938353e+08,
        "cpu_time": 1.5522950000000003e+08,
        "time_unit": "ns",
        "items_per_second": 6.4420744768230254e+06
      },
      {
        "name": "std_to_string",
        "run_name": "std_to_string",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 46,
        "real_time": 1.5248428544272548e+07,
        "cpu_time": 1.5235021739130426e+07,
        "time_unit": "ns",
        "items_per_second": 6.5638239125812843e+07
      },
      {
        "name": "std_to_chars",
        "run_name": "std_to_chars",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 62,
        "real_time": 1.1138610402873207e+07,
        "cpu_time": 1.1125532258064512e+07,
        "time_unit": "ns",
        "items_per_second": 8.9883340122908249e+07
      },
      {
        "name": "fmt_to_string",
        "run_name": "fmt_to_string",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 57,
        "real_time": 1.1959118772657555e+07,
        "cpu_time": 1.1947350877192980e+07,
        "time_unit": "ns",
        "items_per_second": 8.3700563436950728e+07
      },
      {
        "name": "fmt_format_runtime",
        "run_name": "fmt_format_runtime",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 47,
        "real_time": 1.4688557873361131e+07,
        "cpu_time": 1.4669808510638293e+07,
        "time_unit": "ns",
        "items_per_second": 6.8167215630307451e+07
      },
      {
        "name": "fmt_format_compile",
        "run_name": "fmt_format_compile",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 57,
        "real_time": 1.1999533139986165e+07,
        "cpu_time": 1.1980298245614028e+07,
        "time_unit": "ns",
        "items_per_second": 8.3470376070654079e+07
      },
      {
        "name": "fmt_format_to_runtime",
        "run_name": "fmt_format_to_runtime",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 50,
        "real_time": 1.3892540561500935e+07,
        "cpu_time": 1.3875419999999998e+07,
        "time_unit": "ns",
        "items_per_second": 7.2069890497008383e+07
      },
      {
        "name": "fmt_format_to_compile",
        "run_name": "fmt_format_to_compile",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 75,
        "real_time": 9.0572531319533791e+06,
        "cpu_time": 9.0442666666666586e+06,
        "time_unit": "ns",
        "items_per_second": 1.1056728387781589e+08
      },
      {
        "name": "fmt_format_int",
        "run_name": "fmt_format_int",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 78,
        "real_time": 8.5592802303532753e+06,
        "cpu_time": 8.5508205128205139e+06,
        "time_unit": "ns",
        "items_per_second": 1.1694784126279677e+08
      },
      {
        "name": "boost_lexical_cast",
        "run_name": "boost_lexical_cast",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 24,
        "real_time": 2.9355695291693944e+07,
        "cpu_time": 2.9332416666666638e+07,
        "time_unit": "ns",
        "items_per_second": 3.4091974465111159e+07
      },
      {
        "name": "boost_format",
        "run_name": "boost_format",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 2,
        "real_time": 3.3519802801311016e+08,
        "cpu_time": 3.3481500000000077e+08,
        "time_unit": "ns",
        "items_per_second": 2.9867240117676859e+06
      },
      {
        "name": "boost_karma_generate",
        "run_name": "boost_karma_generate",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 55,
        "real_time": 1.2465107491747899e+07,
        "cpu_time": 1.2446872727272730e+07,
        "time_unit": "ns",
        "items_per_second": 8.0341465837347955e+07
      },
      {
        "name": "voigt_itostr",
        "run_name": "voigt_itostr",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 37,
        "real_time": 1.8903207785852659e+07,
        "cpu_time": 1.8890162162162155e+07,
        "time_unit": "ns",
        "items_per_second": 5.2937608021335304e+07
      },
      {
        "name": "decimal_from",
        "run_name": "decimal_from",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 64,
        "real_time": 1.0545646280661458e+07,
        "cpu_time": 1.0534234374999980e+07,
        "time_unit": "ns",
        "items_per_second": 9.4928588486052364e+07
      },
      {
        "name": "stout_ltoa",
        "run_name": "stout_ltoa",
        "run_type": "iteration",
        "repetitions": 0,
        "repetition_index": 0,
        "threads": 1,
        "iterations": 18,
        "real_time": 4.1763770717403129e+07,
        "cpu_time": 4.1694166666666716e+07,
        "time_unit": "ns",
        "items_per_second": 2.3984170447504621e+07
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
    document.getElementById('table_div_mac'));
  table.draw(data.clone(), {});

  var options = {
    title: 'Conversion speed',
    vAxis: {title: 'Method', titleTextStyle: {color: 'red'}}
  };

  var chart = new google.visualization.BarChart(
    document.getElementById('chart_div_mac'));
  data.removeColumn(2);
  chart.draw(data, options);
}
