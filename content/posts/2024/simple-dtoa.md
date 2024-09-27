---
title: "double to string conversion in 150 lines of code"
date: 2024-09-27
---

My previous blog post gained some attention on Hacker News ([discussion](
https://news.ycombinator.com/item?id=41416357)), and as someone deeply
interested in floating-point formatting, I couldn't ignore the following
comment:

>> It's kind of mindblowing to see how much code floating point formatting
>> needs.
>
> If you want it to be fast. The baseline implementation isn’t terrible[1,2]
> even if it is still ultimately an > implementation of arbitrary-precision
> arithmetic.
>
> [1] https://research.swtch.com/ftoa
>
> [2] https://go.dev/src/strconv/ftoa.go

The linked algorithm seemed clearly unsuitable for anything beyond teaching
purposes, but I decided to give it a try anyway. One particularly suspicious
claim was that the post boasted 100,000 conversions per second — about three
orders of magnitude slower than state-of-the-art methods, yet still surprisingly
good given that it worked on individual decimal digits and these were 2011
numbers.

To verify these claims, the first thing I did was reproduce the results using a
simple benchmark on the implementation from the [gist](
https://gist.github.com/rsc/1057873):

```go
func BenchmarkFtoa(b *testing.B) {
  for i := 0; i < b.N; i++ {
    ftoa(data[i % 1000], 17);
  }
}
```

I used data from [dtoa-benchmark](https://github.com/miloyip/dtoa-benchmark) to
ensure meaningful comparisons with other methods later.

Here are the benchmark results on my M1 MacBook Pro (best of three runs):

```
% go test --bench=.
goos: darwin
goarch: arm64
cpu: Apple M1 Pro
BenchmarkFtoa-8             6006            203975 ns/op
PASS
```

The full benchmark is avaliable [here](/files/fp_test.go).

The numbers are nowhere near the claimed 100,000 conversions per second.
Converting a random floating-point number takes approximately 200 microseconds
(5,000 conversions per second), which is four orders of magnitude slower than
state-of-the-art algorithms like [Dragonbox](
https://github.com/jk-jeon/dragonbox) or even an optimized version of Grisu,
which run in the tens of nanoseconds on the same machine. [My initial
estimate](https://news.ycombinator.com/item?id=41426601) was off by one order of
magnitude — classic programmer mistake!

![](/img/change.jpeg#floatright)

However, the runtime of this algorithm depends on the magnitude of the exponent.
If you restrict the input to numbers close to 1 (away from infinity and zero),
the performance goes from terrible to merely bad. For instance, formatting π
takes "only" 2.5 microseconds.

While disappointing, this outcome wasn’t entirely unexpected. But what about the
implementation in the `strconv` package? Being part of the standard library, you
would expect it to be optimized, right?

Unfortunately, the standard implementation isn't directly accessible via the
public API. However, with a small tweak to the `strconv` package (commenting out
the calls to Ryu), we can force the algorithm to be used and test it with the
following benchmark:

```go
func BenchmarkStdFtoa(b *testing.B) {
  for i := 0; i < b.N; i++ {
    FormatFloat(data[i % 1000], 'e', 17, 64);
  }
}
```

```
% go test --bench=.
goos: darwin
goarch: arm64
cpu: Apple M1 Pro
BenchmarkStdFtoa-8        327270              3657 ns/op
PASS
```

This is now close to the best case for the naive implementation yet it remains
several times slower than `sprintf` or even a basic implementation of Dragon4,
and about 100 times slower than modern algorithms.

It's unclear why anyone would use this algorithm in practice, even as a
fallback, because the optimized version loses its only advantage: simplicity.
For instance, the implementation of multi-precision `decimal`, which is its main
component, is larger and more complex than its binary equivalent, [`bigint`](
https://github.com/fmtlib/fmt/blob/fade652ade6e9ba4b16e7484cbda5ee4c9178918/include/fmt/format.h#L2664),
used in the fallback Dragon4 implementation of the [{fmt} library](
https://github.com/fmtlib/fmt). Additionally, it requires several kilobytes of
data to make performance a bit less terrible. While it might potentially
outperform Dragon4 when producing ["garbage" digits](
https://fmt.dev/papers/p372-steele.pdf), optimizing for that scenario is
questionable at best.

Regardless, I decided to test the final hypothesis and see if we could identify
some low-hanging fruit to make this algorithm perform at least on par with
Dragon4. As noted in a [comment on Hacker News](
https://news.ycombinator.com/item?id=41426601):

> You can likely get some of the performance back by picking the low-hanging
> fruit, e.g. switching from dumb one-byte bigint limbs in [0,10) to somewhat
> less dumb 32-bit limbs in [0,1e9).

From this point forward, I’ll be using C++, which should provide additional
performance benefits. The implementation turned out to be quite straightforward,
only slightly more complex than the initial textbook version. Here’s an
implementation of a multi-precision decimal number that supports two operations:
shifting left and right by a specified number of bits:

```c++
// A fixed-point decimal number.
struct decimal {
  int num_bigits = 0;
  // Each bigit is a 9-digit decimal number.
  uint32_t bigits[100];
  static constexpr int bigit_bound = 1000000000;

  // Bigits are organized as follows:
  //   bigits[0] ... bigits[F - 1].bigits[F] ... bigits[N - 1],
  // where F is fraction_start.
  int fraction_start;

  void shift_left(int n) {
    int offset = *bigits >= (bigit_bound >> n) ? 1 : 0;
    uint32_t carry = 0;
    for (int i = num_bigits - 1; i >= 0; --i) {
      uint64_t bigit = bigits[i];
      bigit = (bigit << n) + carry;
      if (bigit >= bigit_bound) {
        carry = bigit / bigit_bound;
        bigit = bigit % bigit_bound;
      } else {
        carry = 0;
      }
      bigits[i + offset] = static_cast<uint32_t>(bigit);
    }
    if (offset != 0) {
      bigits[0] = carry;
      ++num_bigits;
    }
  }

  void shift_right(int n) {
    uint32_t mask = (1 << n) - 1;
    uint32_t borrow = 0;
    int offset = 0;
    if ((*bigits >> n) == 0 && *bigits != 0) {
      offset = 1;
	    --num_bigits;
      --fraction_start;
      borrow = uint64_t(*bigits) * bigit_bound >> n;
    }
    for (int i = 0; i != num_bigits; ++i) {
      uint64_t bigit = bigits[i + offset];
      uint32_t new_borrow = (bigit & mask) * bigit_bound >> n;
      bigits[i] = borrow + (bigit >> n);
      borrow = new_borrow;
    }
    if (borrow != 0) bigits[num_bigits++] = borrow;
  }

  explicit decimal(double d) {
    int exp;
    int num_bits = std::numeric_limits<double>::digits;
    int64_t v = static_cast<int64_t>(frexp(d, &exp) * (1ull << num_bits));
    if (v < 0) v = -v;
    exp -= num_bits;

    if (exp >= 0) {
      if (v >= bigit_bound) {
        uint32_t upper = v / bigit_bound;
        if (upper != 0) bigits[num_bigits++] = upper;
      }
      bigits[num_bigits++] = v % bigit_bound;
      int i = 0;
      int bits_per_iteration = 29; // 2**29 fits in one bigit.
      for (; i <= exp - bits_per_iteration; i += bits_per_iteration)
        shift_left(bits_per_iteration);
      if (i != exp) shift_left(exp - i);
      fraction_start = num_bigits;
    } else {
      fraction_start = 1;
      if (v >= bigit_bound) {
        uint32_t upper = v / bigit_bound;
        if (upper != 0) {
          bigits[num_bigits++] = upper;
          ++fraction_start;
        }
      }
      bigits[num_bigits++] = v % bigit_bound;
      int i = 0;
      int bits_per_iteration = 9; // 10**9 can only be shifted left 9 bits.
      for (; i - bits_per_iteration >= exp; i -= bits_per_iteration)
        shift_right(bits_per_iteration);
      if (i != exp) shift_right(i - exp);
    }
  }
};
```

`decimal` handles all the heavy lifting, so in `dtoa`, our primary tasks are to
read the digits, place them in the output buffer, and possibly perform the
rounding:

```c++
void dtoa_puff(char* buf, double val, int precision) {
  decimal d(val);

  int bigit_index = *d.bigits > 0 ? 0 : 1;
  char* ptr = std::to_chars(buf, buf + precision, d.bigits[bigit_index++]).ptr;
  int count = ptr - buf;
  int exp = (d.fraction_start - bigit_index) * 9 + count - 1;
  for (; bigit_index < d.num_bigits && count <= precision; ++bigit_index) {
    char* block = buf + count;
    ptr = std::to_chars(block, block + 9, d.bigits[bigit_index]).ptr;
    int num_digits = ptr - block, num_zeros = 9 - num_digits;
    if (num_digits < 9) {
      memmove(block + num_zeros, block, num_digits);
      memcpy(block, "00000000", num_zeros);
    }
    count += 9;
  }
  auto has_nonzero = [=]() {
    for (int i = precision + 1; i < count; ++i) {
      if (buf[i] != '0') return true;
    }
    for (int i = bigit_index + 1; i < d.num_bigits; ++i) {
      if (d.bigits[i] != 0) return true;
    }
    return false;
  };
  if (count > precision) {
    char digit = buf[precision];
    if (digit > '5' || digit == '5' &&
        ((buf[precision - 1] % 2) == 1 || has_nonzero())) {
      int i = precision - 1;
      for (; i >= 0 && buf[i] == '9'; --i) buf[i] = '0';
      if (i >= 0) {
        ++buf[i];
      } else {
        buf[0] = '1';
        ++exp;
      }
    }
    count = precision;
  }
  bool negative = signbit(val);
  memmove(buf + 2 + (negative ? 1 : 0), buf + 1, count - 1);
  int offset = 1;
  if (negative) {
    buf[1] = buf[0];
    buf[0] = '-';
    ++offset;
  }
  buf[offset] = '.';
  for (count += offset; count <= precision; ++count) buf[count] = '0';
  buf[count++] = 'e';
  if (exp >= 0) buf[count++] = '+';
  *std::to_chars(buf + count, buf + count + 4, exp).ptr = '\0';
}
```

To differentiate this implementation from the numerous others, let's call it
[Puff](https://en.wikipedia.org/wiki/Puff,_the_Magic_Dragon).

The full implementation is available here: https://www.godbolt.org/z/rYqnaW6bq.

In addition to the obvious improvement of using larger "digits", Puff also
shifts by multiple bits per iteration — up to 29 bits for left shifts and up
to 9 bits for right shifts.

Now, let's examine its performance using the [following benchmark](
/files/simple-dtoa-benchmark.cc), which is essentially the same as the previous
one but rewritten to utilize Google Benchmark:

```c++
void dtoa_puff(benchmark::State &s) {
  size_t i = 0;
  char buf[100];
  while (s.KeepRunning())
    dtoa_puff(buf, data[i++ % 1000], 17);
}
BENCHMARK(dtoa);
```

One caveat worth mentioning is that `to_chars` is not available on my system,
so I had to implement it using the {fmt} library.

Here are the results:

```
Run on (8 X 24 MHz CPU s)
CPU Caches:
  L1 Data 64 KiB
  L1 Instruction 128 KiB
  L2 Unified 4096 KiB (x8)
Load Average: 4.82, 4.52, 4.66
-----------------------------------------------------
Benchmark           Time             CPU   Iterations
-----------------------------------------------------
dtoa              984 ns          984 ns       710992
```

*(Ignore the 24 MHz part—this is a known Google Benchmark issue that doesn’t
affect the results.)*

Puff is approximately 3.5 times faster than its counterpart in the Go standard 
ibrary. It’s also simpler, with completely different optimizations applied, and
it doesn't rely on any data tables.

But how does it stack up against other methods? To find out, I added it to a
fork of [dtoa-benchmark](https://github.com/fmtlib/dtoa-benchmark), and here are
the results:

<div id="main"></div>

As you can see, the optimized version of this method comes quite close to
`sprintf`. It’s still about 30 times slower than Dragonbox (the version
integrated into {fmt}), but let’s give it some slack — not every dragon is
destined to soar; some are just here for a scenic glide.

But hey, for a few hours of work (mostly spent debugging), it’s not too shabby!

I hope you found this useful! Let me know in the comments if you’d be interested
in a similar deep dive into Dragon4.

Happy floating-point formatting!

<script src="https://code.jquery.com/jquery-1.8.2.js"></script>
<script type="text/javascript" src="https://www.google.com/jsapi"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-csv/0.8.12/jquery.csv.js"></script>
<script>
	google.load("visualization", "1", {packages:["corechart", "table"]});
  google.setOnLoadCallback(drawChart);
  function drawChart() {
    var csv = $('#textInput').val();
    var data = $.csv.toArrays(csv, {
        onParseValue: $.csv.hooks.castToScalar
    });

    // Convert data for bar chart (summing all digits)
    var timeData = {};	// type -> table
    var funcRowMap;
    var maxDigit = 0;

    for (var i = 1; i < data.length; i++) {
    	var type = data[i][0];
   		var func = data[i][1];
      var digit = data[i][2];
   		var time = data[i][3];
   		if (timeData[type] == null) {
   			timeData[type] = [["Function", "Time (ns)"/*, { role: "style" }*/]];
        if (digit != 0)
   			  funcRowMap = {};
   		}

   		var table = timeData[type];
   		
      if (digit != 0) {
     		if (funcRowMap[func] == null)
     			funcRowMap[func] = table.push([func, 0]) - 1;
     		
     		table[funcRowMap[func]][1] += time;
      }
      else 
        table.push([func, time]);

      maxDigit = Math.max(maxDigit, digit);
    }

    // Compute average
    for (var type in timeData) {
      var table = timeData[type];
      for (var i = 1; i < table.length; i++)
        table[i][1] /= maxDigit;
    }

    // Convert data for drawing line chart per random digit
    var timeDigitData = {}; // type -> table
    var funcColumnMap;

    for (var i = 1; i < data.length; i++) {
    	var type = data[i][0];
   		var func = data[i][1];
		  var digit = data[i][2];
   		var time = data[i][3];

      if (digit == 0)
        continue;

   		if (timeDigitData[type] == null) {
   			timeDigitData[type] = [["Digit"]];
   			funcColumnMap = {};
   		}

   		var table = timeDigitData[type];

   		if (funcColumnMap[func] == null)
   			funcColumnMap[func] = table[0].push(func) - 1;

   		var row;
   		for (row = 1; row < table.length; row++)
   			if (table[row][0] == digit)
   				break;

    	if (row == table.length)
    		table.push([digit]);

		table[row][funcColumnMap[func]] = time;
	}

	for (var type in timeData) {
    $("#section").append($("<li>").append($("<a>", {href: "#" + type}).append(type)));

		drawTable(type, timeData[type]);
		drawBarChart(type, timeData[type]);
    if (timeDigitData[type] != null)
		  drawDigitChart(type, timeDigitData[type]);
	}

	$(".chart").each(function() {
		var chart = $(this);
		var d = $("#downloadDD").clone().css("display", "");
		$('li a', d).each(function() {
	        $(this).click(function() {
	            var svg = chart[0].getElementsByTagName('svg')[0].parentNode.innerHTML;
	            svg=sanitize(svg);
	            $('#imageFilename').val($("#title").html() + "_" + chart.data("filename"));
	            $('#imageGetFormTYPE').val($(this).attr('dltype'));
	            $('#imageGetFormSVG').val(svg);
	            $('#imageGetForm').submit();
	        });
	    });		
		$(this).after(d);
	});

  // Add configurations
  var thisConfig = "unknown_mac32_clang16.0";
  var configurations = ["corei7920@2.67_cygwin32_gcc4.8","corei7920@2.67_cygwin64_gcc4.8","corei7920@2.67_win32_vc2013","corei7920@2.67_win64_vc2013","dragon-unknown_mac32_clang16.0","old-unknown_mac32_clang16.0","unknown_mac32_clang15.0","unknown_mac32_clang16.0","unknown_mac32_clang7.0","unknown_mac64_clang10.0","unknown_mac64_clang12.0","unknown_mac64_clang13.0","unknown_mac64_clang7.0"];

  for (var i in configurations) {
    var c = configurations[i];
    $("#configuration").append($("<li>", {class : (c == thisConfig ? "active" : "")}).append($("<a>", {href: c + ".html"}).append(c)));
  }
}

function drawTable(type, timeData) {
	var data = google.visualization.arrayToDataTable(timeData);
    data.addColumn('number', 'Speedup');
    data.sort([{ column: 1, desc: true }]);
    var formatter1 = new google.visualization.NumberFormat({ fractionDigits: 3 });
    formatter1.format(data, 1);

	var div = document.createElement("div");
	div.className = "tablechart";
	$("#main").append(div);
    var table = new google.visualization.Table(div);
    redrawTable(0);
    table.setSelection([{ row: 0, column: null}]);

    function redrawTable(selectedRow) {
        // Compute relative time using the first row as basis
        var basis = data.getValue(selectedRow, 1);
        for (var rowIndex = 0; rowIndex < data.getNumberOfRows(); rowIndex++)
            data.setValue(rowIndex, 2, basis / data.getValue(rowIndex, 1));

        var formatter = new google.visualization.NumberFormat({suffix: 'x'});
        formatter.format(data, 2); // Apply formatter to second column

        table.draw(data);
    }

    google.visualization.events.addListener(table, 'select',
    function() {
        var selection = table.getSelection();
        if (selection.length > 0) {
            var item = selection[0];
            if (item.row != null)
                redrawTable(item.row);
        }
    });

}

function drawBarChart(type, timeData) {
    var defaultColors = ["#3366cc","#dc3912","#ff9900","#109618","#990099","#0099c6","#dd4477","#66aa00","#b82e2e","#316395","#994499","#22aa99","#aaaa11","#6633cc","#e67300","#8b0707","#651067","#329262","#5574a6","#3b3eac","#b77322","#16d620","#b91383","#f4359e","#9c5935","#a9c413","#2a778d","#668d1c","#bea413","#0c5922","#743411"];

	var data = google.visualization.arrayToDataTable(timeData);
	data.addColumn({ type: "string", role: "style" })
	for (var rowIndex = 0; rowIndex < data.getNumberOfRows(); rowIndex++)
		data.setValue(rowIndex, 2, defaultColors[rowIndex]);

    data.sort([{ column: 1, desc: true }]);
	var options = { 
		title: type,
		chartArea: {'width': '70%', 'height': '70%'},
		width: 700,
		height: 300,
		legend: { position: "none" },
		hAxis: { title: "Time (ns)" }
	};
	var div = document.createElement("div");
	div.className = "chart";
	$(div).data("filename", type + "_time");
	$("#main").append(div);
	var chart = new google.visualization.BarChart(div);

	chart.draw(data, options);
}

function drawDigitChart(type, timeDigitData) {
	var data = google.visualization.arrayToDataTable(timeDigitData);

	var options = { 
		title: type,
		chartArea: {'width': '70%', 'height': '80%'},
		hAxis: {
			title: "Digit",
			gridlines: { count: timeDigitData.length - 1 },
			maxAlternation: 1,
			minTextSpacing: 0
		},
		vAxis: {
			title: "Time (ns) in log scale",
			logScale: true,
			minorGridlines: { count: 10 },
      baseline: 0
		},
		width: 700,
		height: 500
	};
	var div = document.createElement("div");
	div.className = "chart";
	$(div).data("filename", type + "_timedigit");
	$("#main").append(div);
	var chart = new google.visualization.LineChart(div);

	chart.draw(data, options);
}

// http://jsfiddle.net/P6XXM/
function sanitize(svg) {
    svg = svg
        .replace(/\<svg/,'<svg xmlns="http://www.w3.org/2000/svg" version="1.1"')
        .replace(/zIndex="[^"]+"/g, '')
        .replace(/isShadow="[^"]+"/g, '')
        .replace(/symbolName="[^"]+"/g, '')
        .replace(/jQuery[0-9]+="[^"]+"/g, '')
        .replace(/isTracker="[^"]+"/g, '')
        .replace(/url\([^#]+#/g, 'url(#')
        .replace('<svg xmlns:xlink="http://www.w3.org/1999/xlink" ', '<svg ')
        .replace(/ href=/g, ' xlink:href=')
    /*.replace(/preserveAspectRatio="none">/g, 'preserveAspectRatio="none"/>')*/
    /* This fails in IE < 8
    .replace(/([0-9]+)\.([0-9]+)/g, function(s1, s2, s3) { // round off to save weight
    return s2 +'.'+ s3[0];
    })*/

    // IE specific
        .replace(/id=([^" >]+)/g, 'id="$1"')
        .replace(/class=([^" ]+)/g, 'class="$1"')
        .replace(/ transform /g, ' ')
        .replace(/:(path|rect)/g, '$1')
        .replace(/<img ([^>]*)>/gi, '<image $1 />')
        .replace(/<\/image>/g, '') // remove closing tags for images as they'll never have any content
        .replace(/<image ([^>]*)([^\/])>/gi, '<image $1$2 />') // closes image tags for firefox
        .replace(/width=(\d+)/g, 'width="$1"')
        .replace(/height=(\d+)/g, 'height="$1"')
        .replace(/hc-svg-href="/g, 'xlink:href="')
        .replace(/style="([^"]+)"/g, function (s) {
            return s.toLowerCase();
        });

    // IE9 beta bugs with innerHTML. Test again with final IE9.
    svg = svg.replace(/(url\(#highcharts-[0-9]+)&quot;/g, '$1')
        .replace(/&quot;/g, "'");
    if (svg.match(/ xmlns="/g).length == 2) {
        svg = svg.replace(/xmlns="[^"]+"/, '');
    }

    return svg;
}
</script>

<style type="text/css">
.tablechart {
	width: 700px;
	margin: auto;
  margin-left: 100px;
	padding-top: 20px;
	padding-bottom: 20px;
}
.chart {
	padding-top: 20px;
	padding-bottom: 20px;
}
.form-control {
  visibility: hidden;
}
</style>

<textarea id="textInput" class="form-control" rows="5" readonly>
Type,Function,Digit,Time(ns)
randomdigit,ryu,1,48.400000
randomdigit,ryu,2,49.500000
randomdigit,ryu,3,45.500000
randomdigit,ryu,4,46.900000
randomdigit,ryu,5,41.200000
randomdigit,ryu,6,40.600000
randomdigit,ryu,7,38.400000
randomdigit,ryu,8,37.300000
randomdigit,ryu,9,34.400000
randomdigit,ryu,10,37.000000
randomdigit,ryu,11,35.300000
randomdigit,ryu,12,33.400000
randomdigit,ryu,13,31.000000
randomdigit,ryu,14,28.900000
randomdigit,ryu,15,28.600000
randomdigit,ryu,16,26.000000
randomdigit,ryu,17,28.100000
randomdigit,doubleconv,1,65.200000
randomdigit,doubleconv,2,68.800000
randomdigit,doubleconv,3,74.000000
randomdigit,doubleconv,4,80.600000
randomdigit,doubleconv,5,84.400000
randomdigit,doubleconv,6,85.300000
randomdigit,doubleconv,7,91.900000
randomdigit,doubleconv,8,87.700000
randomdigit,doubleconv,9,88.700000
randomdigit,doubleconv,10,88.900000
randomdigit,doubleconv,11,82.400000
randomdigit,doubleconv,12,90.100000
randomdigit,doubleconv,13,88.000000
randomdigit,doubleconv,14,94.100000
randomdigit,doubleconv,15,97.200000
randomdigit,doubleconv,16,98.400000
randomdigit,doubleconv,17,107.200000
randomdigit,fmt,1,34.200000
randomdigit,fmt,2,35.100000
randomdigit,fmt,3,32.100000
randomdigit,fmt,4,36.200000
randomdigit,fmt,5,31.500000
randomdigit,fmt,6,32.800000
randomdigit,fmt,7,31.000000
randomdigit,fmt,8,33.700000
randomdigit,fmt,9,35.000000
randomdigit,fmt,10,40.100000
randomdigit,fmt,11,37.200000
randomdigit,fmt,12,37.200000
randomdigit,fmt,13,35.200000
randomdigit,fmt,14,37.000000
randomdigit,fmt,15,35.000000
randomdigit,fmt,16,34.100000
randomdigit,fmt,17,37.700000
randomdigit,puff,1,985.800000
randomdigit,puff,2,949.300000
randomdigit,puff,3,999.300000
randomdigit,puff,4,983.400000
randomdigit,puff,5,975.700000
randomdigit,puff,6,981.000000
randomdigit,puff,7,970.400000
randomdigit,puff,8,989.800000
randomdigit,puff,9,982.300000
randomdigit,puff,10,963.800000
randomdigit,puff,11,1019.000000
randomdigit,puff,12,1086.400000
randomdigit,puff,13,1035.400000
randomdigit,puff,14,993.000000
randomdigit,puff,15,1012.800000
randomdigit,puff,16,1054.300000
randomdigit,puff,17,1024.500000
randomdigit,fpconv,1,48.900000
randomdigit,fpconv,2,51.600000
randomdigit,fpconv,3,53.800000
randomdigit,fpconv,4,54.800000
randomdigit,fpconv,5,57.100000
randomdigit,fpconv,6,56.800000
randomdigit,fpconv,7,59.400000
randomdigit,fpconv,8,59.200000
randomdigit,fpconv,9,58.600000
randomdigit,fpconv,10,62.200000
randomdigit,fpconv,11,64.700000
randomdigit,fpconv,12,66.700000
randomdigit,fpconv,13,67.200000
randomdigit,fpconv,14,69.600000
randomdigit,fpconv,15,70.000000
randomdigit,fpconv,16,71.800000
randomdigit,fpconv,17,82.400000
randomdigit,grisu2,1,37.800000
randomdigit,grisu2,2,42.800000
randomdigit,grisu2,3,47.700000
randomdigit,grisu2,4,50.500000
randomdigit,grisu2,5,49.600000
randomdigit,grisu2,6,50.900000
randomdigit,grisu2,7,55.300000
randomdigit,grisu2,8,55.400000
randomdigit,grisu2,9,55.500000
randomdigit,grisu2,10,58.200000
randomdigit,grisu2,11,59.200000
randomdigit,grisu2,12,66.100000
randomdigit,grisu2,13,64.400000
randomdigit,grisu2,14,66.900000
randomdigit,grisu2,15,72.400000
randomdigit,grisu2,16,74.400000
randomdigit,grisu2,17,75.800000
randomdigit,null,1,1.000000
randomdigit,null,2,1.000000
randomdigit,null,3,1.000000
randomdigit,null,4,0.900000
randomdigit,null,5,0.900000
randomdigit,null,6,0.900000
randomdigit,null,7,0.900000
randomdigit,null,8,0.900000
randomdigit,null,9,0.900000
randomdigit,null,10,0.900000
randomdigit,null,11,1.000000
randomdigit,null,12,0.900000
randomdigit,null,13,1.000000
randomdigit,null,14,0.900000
randomdigit,null,15,0.900000
randomdigit,null,16,0.900000
randomdigit,null,17,1.000000
randomdigit,ostringstream,1,847.300000
randomdigit,ostringstream,2,832.000000
randomdigit,ostringstream,3,850.700000
randomdigit,ostringstream,4,877.800000
randomdigit,ostringstream,5,886.100000
randomdigit,ostringstream,6,883.500000
randomdigit,ostringstream,7,912.100000
randomdigit,ostringstream,8,893.700000
randomdigit,ostringstream,9,899.600000
randomdigit,ostringstream,10,906.900000
randomdigit,ostringstream,11,933.700000
randomdigit,ostringstream,12,959.400000
randomdigit,ostringstream,13,972.200000
randomdigit,ostringstream,14,968.300000
randomdigit,ostringstream,15,986.100000
randomdigit,ostringstream,16,984.100000
randomdigit,ostringstream,17,989.000000
randomdigit,sprintf,1,672.600000
randomdigit,sprintf,2,664.600000
randomdigit,sprintf,3,699.000000
randomdigit,sprintf,4,701.400000
randomdigit,sprintf,5,719.800000
randomdigit,sprintf,6,719.000000
randomdigit,sprintf,7,731.800000
randomdigit,sprintf,8,755.100000
randomdigit,sprintf,9,736.400000
randomdigit,sprintf,10,735.000000
randomdigit,sprintf,11,776.600000
randomdigit,sprintf,12,791.200000
randomdigit,sprintf,13,817.800000
randomdigit,sprintf,14,801.300000
randomdigit,sprintf,15,808.800000
randomdigit,sprintf,16,815.200000
randomdigit,sprintf,17,798.400000
</textarea>
