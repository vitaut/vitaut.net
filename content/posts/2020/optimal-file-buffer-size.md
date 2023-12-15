---
title: Writing files 5 to 9 times faster than fprintf
date: 2020-08-04
aliases: ['/2020/08/04/optimal-file-buffer-size.html']
---

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em; width: 40%">
<blockquote class="twitter-tweet" data-conversation="none"><p lang="en" dir="ltr">&quot;The value of BUFSIZ has been chosen at random in 1989 and can no longer be changed because that would break ABI.&quot;</p>&mdash; Peter Dimov (@pdimov2) <a href="https://twitter.com/pdimov2/status/1289649603218829313?ref_src=twsrc%5Etfw">August 1, 2020</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
</div>

I recently added a new unsynchronized file output API to
[the {fmt} library](https://github.com/fmtlib/fmt). Together with [format
string compilation](https://fmt.dev/latest/api.html#compile-api), zero memory
allocations and locale-independent formatting by default this gives you a high
performance file output from a single thread.

Here's a small example demonstrating the new API:

```c++
#include <fmt/os.h>

int main() {
  auto f = fmt::output_file("guide");
  f.print("The answer is {}.", 42);
}
```

Initially I picked `BUFSIZ` as the default buffer size because according to
[the glibc manual](
https://www.gnu.org/software/libc/manual/html_node/Controlling-Buffering.html):

> The value of BUFSIZ is chosen on each system so as to make stream I/O
> efficient.

Later I added the ability to pass a buffer size

```c++
auto f = fmt::output_file("guide", fmt::buffer_size=4096);
```
and decided to use the new powers to check if `BUFSIZ` is actually a good
default.

To this end I created a little benchmark that writes a 10MiB file with different
values of the buffer size starting from `BUFSIZ`:

```c++
#include <benchmark/benchmark.h>
#include <fmt/compile.h>
#include <fmt/os.h>
#include <stdio.h>

auto test_data = "test data";
auto num_iters = 1'000'000;

const char* removed(benchmark::State& state, const char* path) {
  state.PauseTiming();
  std::remove(path);
  state.ResumeTiming();
  return path;
}

void fprintf(benchmark::State& state) {
  for (auto s : state) {
    auto f = fopen(removed(state, "/tmp/fprintf-test"), "wb");
    for (int i = 0; i < num_iters; ++i)
      fprintf(f, "%s\n", test_data);
    fclose(f);
  }
}
BENCHMARK(fprintf);

void fmt_print_compile(benchmark::State& state) {
  for (auto s : state) {
    auto f = fmt::output_file(removed(state, "/tmp/fmt-compile-test"),
                              fmt::buffer_size=state.range(0));
    for (int i = 0; i < num_iters; ++i)
      f.print(FMT_COMPILE("{}\n"), test_data);
  }
}
BENCHMARK(fmt_print_compile)->RangeMultiplier(2)->Range(BUFSIZ, 1 << 20);

BENCHMARK_MAIN();
```
The full benchmark is available [here](
https://github.com/fmtlib/format-benchmark/blob/d5c10ce75c2b9bb9885100907be49093da519389/src/file-benchmark.cc).

Running it on macOS with an AP1024M SSD shows that `BUFSIZ` which is equal to
1024 on this system is suboptimal to put it mildly. By switching to a larger
buffer we can make {fmt}'s `print` more than 9 times faster than `fprintf`:

```
Run on (8 X 2800 MHz CPU s)
CPU Caches:
  L1 Data 32K (x4)
  L1 Instruction 32K (x4)
  L2 Unified 262K (x4)
  L3 Unified 8388K (x1)
Load Average: 2.21, 1.96, 2.02
--------------------------------------------------------------------
Benchmark                          Time             CPU   Iterations
--------------------------------------------------------------------
fprintf                    101143652 ns    100765429 ns            7
fmt_print_compile/1024      46979210 ns     46620467 ns           15
fmt_print_compile/2048      34731403 ns     34565400 ns           20
fmt_print_compile/4096      29536168 ns     29223478 ns           23
fmt_print_compile/8192      19930252 ns     19783206 ns           34
fmt_print_compile/16384     17627005 ns     15691674 ns           46
fmt_print_compile/32768     12819629 ns     12684212 ns           52
fmt_print_compile/65536     17585901 ns     12323373 ns           59
fmt_print_compile/131072    17223877 ns     11012742 ns           62
fmt_print_compile/262144    10815320 ns     10711619 ns           63
fmt_print_compile/524288    16649142 ns     10812969 ns           64
fmt_print_compile/1048576   16610093 ns     10747453 ns           64
```

<script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
<script type="text/javascript">
  google.charts.load('current', {'packages':['corechart']});
  google.charts.setOnLoadCallback(drawChart);

  function drawChart() {
    var data = [
      ['Buffer size', 'Time', 'CPU time'],
      [1024, 46979, 46620],
      [2048, 34731, 34565],
      [4096, 29536, 29223],
      [8192, 19930, 19783],
      [16384, 17627, 15691],
      [32768, 12819, 12684],
      [65536, 17585, 12323],
      [131072, 17223, 11012],
      [262144, 10815, 10711],
      [524288, 16649, 10812],
      [1048576, 16610, 10747]
    ];
    for (var i = 1; i < data.length; i++) {
      data[i][1] = data[i][1] / 1000.0;
      data[i][2] = data[i][2] / 1000.0;
    }

    var table = google.visualization.arrayToDataTable(data);
    var options = {
      hAxis: {
        logScale: 'true',
        ticks: [1024, 4096, 16384, 65536, 262144, 1048576]
      },
      vAxis: {
        baseline: 101.143652,
        baselineColor: 'green'
      },
      vAxes: {
        0: {title: 'Time, ms'}
      },
      hAxes: {
        0: {title: 'Buffer size (log scale)'}
      }
    };

    var chart = new google.visualization.LineChart(
      document.getElementById('chart'));

    chart.draw(table, options);
  }
</script>
<div id="chart" style="height: 500px; width: 100%"></div>

The green baseline shows `fprintf` time with the default (fixed) buffer size.

There are some fluctuations in the wall clock time but you can see that
increasing the buffer size even by a small factor gives a big performance boost.
There is a trade off between memory and speed with diminishing returns for
increasing the buffer size. A good default seems to be somewhere in the range
8kiB - 128kiB.

Running the same benchmark on GNU/Linux with Samsung SSD 970 PRO gives
completely different results. `BUFSIZ` is 8kiB there and making the buffer
bigger gives only moderate ~9% improvement. However, this time {fmt} is more
than 5 times faster than `fprintf` even with the default buffer size.

```
Run on (16 X 5000 MHz CPU s)
CPU Caches:
  L1 Data 32K (x8)
  L1 Instruction 32K (x8)
  L2 Unified 256K (x8)
  L3 Unified 16384K (x1)
Load Average: 0.44, 0.27, 0.15
--------------------------------------------------------------------
Benchmark                          Time             CPU   Iterations
--------------------------------------------------------------------
fprintf                     40097543 ns     40098696 ns           18
fmt_print_compile/8192       7661507 ns      7661109 ns           90
fmt_print_compile/16384      7326631 ns      7326616 ns           95
fmt_print_compile/32768      7153550 ns      7152801 ns           97
fmt_print_compile/65536      7196112 ns      7057630 ns           97
fmt_print_compile/131072     7023975 ns      7024247 ns           98
fmt_print_compile/262144     7052366 ns      7051588 ns           98
fmt_print_compile/524288     7033374 ns      7033412 ns           98
fmt_print_compile/1048576    7028619 ns      7028467 ns           98
```

<script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
<script type="text/javascript">
  google.charts.load('current', {'packages':['corechart']});
  google.charts.setOnLoadCallback(drawChart);

  function drawChart() {
    var data = [
      ['Buffer size', 'Time'],
      [8192,       7661507],
      [16384,      7326631],
      [32768,      7153550],
      [65536,      7196112],
      [131072,     7023975],
      [262144,     7052366],
      [524288,     7033374],
      [1048576,    7028619]
    ];
    for (var i = 1; i < data.length; i++) {
      data[i][1] = data[i][1] / 1000000.0;
    }

    var table = google.visualization.arrayToDataTable(data);
    var options = {
      hAxis: {
        logScale: 'true',
        ticks: [8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576]
      },
      vAxis: {
        viewWindow: {
          min: "0"
        },
        baseline: 40.097543,
        baselineColor: 'green'
      },
      vAxes: {
        0: {title: 'Time, ms'}
      },
      hAxes: {
        0: {title: 'Buffer size (log scale)'}
      }
    };

    var chart = new google.visualization.LineChart(
      document.getElementById('chart-linux'));

    chart.draw(table, options);
  }
</script>
<div id="chart-linux" style="height: 500px; width: 100%"></div>

Note that in this case wall clock and CPU time are similar so only the former is
shown.

Based on this findings the default file buffer size in {fmt} has been increased
to `max(BUFSIZ, 32768)` which gives 3.5x improvement on macOS and ~7%
improvement on Linux on the above benchmark. As mentioned earlier, it's possible
to pass a different size when opening a file which, unlike a similar stdio API,
avoids reallocation.

**Summary**

With an increased default buffer size {fmt} now provides a simple and efficient
file output API which is up to 5-9 times faster than `fprintf` (possibly more on
[numeric formatting](
http://www.zverovich.net/2020/06/13/fast-int-to-string-revisited.html)).