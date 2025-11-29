---
title: The smallest state-of-the-art double-to-string implementation
date: 2025-11-29
---

<img src="/img/pigeonhole.jpeg#floatright" class="floatright" width="40%" />

Converting floating-point numbers to their shortest decimal
representations has long been a surprisingly challenging problem. For decades,
developers relied on algorithms such as Dragon4 that used multi-precision
arithmetic. More recently, a new generation of provably correct and
high-performance algorithms emerged, including
[Ryu](https://dl.acm.org/doi/10.1145/3192366.3192369),
[Schubfach](https://drive.google.com/file/d/1IEeATSVnEE6TkrHlCYNY2GjaraBjOT4f/)
and [Dragonbox](
https://github.com/jk-jeon/dragonbox/blob/master/other_files/Dragonbox.pdf).

In my earlier post, [double to string conversion in 150 lines of code](
https://vitaut.net/posts/2024/simple-dtoa/), I explored how compact a basic
implementation can be while still maintaining correctness. The Schubfach
algorithm pushes this idea much further: it enables fully proven,
high-performance `dtoa` with an amount of code comparable to the naïve
algorithm. This post gives a brief overview of Schubfach and then walks through
the minimal C++ implementation in https://github.com/vitaut/schubfach.

## A brief overview of the Schubfach algorithm

The Schubfach algorithm, introduced by Raffaello Giulietti, is a method to
convert binary floating-point numbers into the shortest, correctly rounded
decimal string representation. It is based on two key insights:

### 1. The non-iterative search guided by the pigeonhole principle

The algorithm is founded on the [Schubfachprinzip](
https://en.wikipedia.org/wiki/Pigeonhole_principle) (the pigeonhole principle),
which gives the algorithm its name, to efficiently determine the correct
decimal exponent ($k$) for the optimal shortest decimal representation ($d_v$).

* Instead of iteratively searching for the shortest decimal representation,
  Schubfach determines a unique integer exponent $k$ based on comparing the
  distance between adjacent decimal values ($10^k$) in a given scale ($10_k$)
  against the width of the floating-point number's rounding interval
  ($\Vert R_v \Vert$).

* The exponent $k$ is calculated such that
  $10^k \leq \Vert R_v \Vert < 10^{k+1}$. This comparison guarantees that the
  set of decimals rounding back to the original floating-point value $v$
  ($R_k$) contains at least one element, and the set at the next finest
  resolution ($R_{k+1}$) contains at most one element.

* This approach makes the algorithm non-iterative.

### 2. Guaranteed accuracy through fixed-precision integer estimates

Schubfach achieves high performance by replacing costly, arbitrary-precision
arithmetic (like `BigInteger` in Java) with reduced, fixed-precision integer
arithmetic.

* This shift to efficient fixed-precision computation is made possible and
  guaranteed correct by the [Nadezhin result](
  https://github.com/nadezhin/verify-todec).

* This result establishes that critical scaled boundaries of the rounding
  interval are never extremely close to an integer.
  Specifically, there is a $2\varepsilon$-wide zone around integers where these boundaries cannot exist, except when they are exactly an integer.

* This separation allows the algorithm to safely use limited precision
  overestimates derived from precomputed tables of powers of 10.
  These estimates are close enough to the true values that they produce the
  exact same rounding decision as the full-precision values.

## Rounding Interval

A floating point number $v = c 2^q$ represents not just a single real value but
an entire rounding interval $R_v$ that contains all real numbers that round back
to $v$. For a finite positive value, the interval is bounded by $v_l = c_l 2^q$
and $v_r = c_r 2^q$, where $c_l$ and $c_r$ are midpoints between $v$ and its
predecessor and successor. In the common case of regular IEEE 754 spacing,
these are $c_l = c − 1/2$ and $c_r = c + 1/2$. In the rare irregular case near
powers of two, the left midpoint becomes $c_l = c − 1/4$. The width of the
interval is $\Vert R_v \Vert = v_r − v_l$, and every real number strictly
between the endpoints will round to $v$. The rounding mode determines whether
the endpoints themselves are included. For example, with round-to-even, both
endpoints belong to $R_v$ when $c$ is even and both are excluded when $c$ is
odd.

Formatting a floating point value does not require reproducing its full decimal
expansion. Any decimal inside $R_v$ is guaranteed to round back to $v$, so
the goal is to choose the shortest such decimal (in terms of the number of
decimal digits in the significand). Schubfach does this by examining how $R_v$
intersects decimal grids ($D_i$) of various scales. If the spacing $10^i$ is
narrower than the width of $R_v$, then at least one decimal of that scale must
fall within the interval. If the spacing is wider, at most one can. By finding
the exact scale where this transition occurs, the algorithm pinpoints the
minimal length at which candidates exist.

The following figure illustrates this principle visually. It shows several
evenly spaced tick marks representing values in a chosen decimal grid $D_i$,
while the rounding intervals $R_v$ are drawn as horizontal segments. When the
grid spacing is too coarse, the ticks may all fall outside the interval,
meaning no decimal of that length can represent $v$. When the spacing is too
fine, multiple ticks fall inside, meaning several decimals of that length round
to $v$. Schubfach identifies precisely the grid levels where the interval
captures at least one and at most one such tick, allowing it to choose the
shortest decimal that is still unambiguous during round-trip conversion.

![Figure 6 from the Schubfach paper](/img/schubfach.png)

<small>Figure from “The Schubfach way to render doubles” by Raffaello Giulietti, licensed under CC BY-SA 4.0.</small>

## Minimal C++ implementation of Schubfach

Now let's look at the implementation from https://github.com/vitaut/schubfach.

### 1. Extract IEEE-754 fields

To begin the conversion, we first extract the IEEE-754 components: the sign
bit, the exponent field (`bin_exp`), and the 52-bit significand (`bin_sig`).
Using `std::bit_cast`](https://en.cppreference.com/w/cpp/numeric/bit_cast.html),
we interpret the floating-point value as an unsigned integer and use bit
manipulation to extract the components:

```c++
uint64_t bits = std::bit_cast<uint64_t>(x);

constexpr int precision = 52;
constexpr int exp_mask = 0x7ff;
int bin_exp = static_cast<int>(bits >> precision) & exp_mask;

constexpr uint64_t implicit_bit = uint64_t(1) << precision;
uint64_t bin_sig = bits & (implicit_bit - 1); // binary significand
```

We output the sign right away and handle special cases such as ±infinity, NaN
and zero, writing them out and returning early:

```c++
if (bin_exp == exp_mask) {
  memcpy(buffer, bin_sig == 0 ? "inf" : "nan", 4);
  return;
}
```

### 2. Normalize representation

The next step is to normalize the representation by adding an implicit bit if
necessary and adjusting the exponent:

```c++
bool regular = bin_sig != 0;
if (bin_exp != 0) {
  bin_sig |= implicit_bit;
} else {
  ++bin_exp; // Adjust the exponent for subnormals.
  regular = true;
}
bin_exp -= precision + 1023; // Remove the exponent bias.
```

Now the absolute value of the original number is equal to
`bin_sig * pow(2, bin_exp)`.

We also determine if the rounding interval is regular (symmetric). Irregularity
occurs when the spacing between adjacent FP numbers increases, which happens
for numbers that are powers of 2 and not subnormal.

### 3. Shift the significand

To make the boundaries of the rounding interval integers we shift the
significand left by two:

```c++
uint64_t bin_sig_shifted = bin_sig << 2;
```

and set the boundaries:

```c++
uint64_t lower = bin_sig_shifted - (regular ? 2 : 1);
uint64_t upper = bin_sig_shifted + 2;
```

### 4. Compute the decimal exponent and power of 10

We compute the decimal exponent (`dec_exp` or $k$ in the paper) as
`floor(log10(pow(2, bin_exp)))` using fixed-point arithmetic:

```c++
int dec_exp = regular ? floor_log10_pow2(bin_exp) : /* … */;
```

where `floor_log10_pow2` is defined as

```c++
// floor(log10(2) * 2**fixed_precision)
constexpr long long floor_log10_2_fixed = 661'971'961'083;
constexpr int fixed_precision = 41;

// Computes floor(log10(pow(2, e))) for e <= 5456721.
auto floor_log10_pow2(int e) noexcept -> int {
  return e * floor_log10_2_fixed >> fixed_precision;
}
```

For irregular intervals, an additional adjustment for `log10(3/4)` is included.

The decimal exponent (or, rather, its negation) is then used to look up the
126-bit significand of an overestimate of a power of 10 from a table,
precomputed with a Python script, [`gen-pow10.py`](
https://github.com/vitaut/schubfach/blob/main/gen-pow10.py). Those are returned
as two `uint64_t` numbers, `pow10_hi` and `pow10_lo`, becaue C++ doesn't
have standard 128-bit integers.

An interesting artifact of the table is that it stores values as pairs of 63-bit
integers, likely because the algorithm was targeting Java which lacks unsigned
integers. This is kept for now to keep the implementation close to the reference
but can potentially be simplified in the future.

### 5. Scale by power of 10

The next step is to multiply the significand and boundaries by the power of 10
we obtained earlier:

```c++
uint64_t scaled_sig =
    umul192_upper64_modified(pow10_hi, pow10_lo, bin_sig_shifted << shift);
lower = umul192_upper64_modified(pow10_hi, pow10_lo, lower << shift);
upper = umul192_upper64_modified(pow10_hi, pow10_lo, upper << shift);
```

This is probably the most complicated part of the whole algorithm. It relies
on special (modified) rounding to make sure that the later comparisons of the
integer candidates with the bounds give the same results as those we would
get with full precision (using rationals or bigints). There is also a small,
obscure shift applied to bring the intermediate result in
`umul192_upper64_modified` in the required range. Going into details here is
out of scope of this post but if you are interested check out sections 9.5 and
9.6 of the paper.

### 6. Select the candidate

Now that we have our scaled value and boundaries, we can construct and select
from up to four candidates:

* Two corresponding to `dec_exp + 1` ($k + 1$), from which at most one can fall
  into the rounding interval:
  * Underestimate with significand `dec_sig_under2`
  * Overestimate with significand `dec_sig_over2`
* Two corresponding to `dec_exp` ($k$) with at least one belonging to the
  interval:
  * Underestimate with significand `dec_sig_under` ($s$)
  * Overestimate with significand `dec_sig_over` ($t$)

The checks are very similar so let’s consider the smaller decimal exponent
(`dec_exp`) case. We determine whether the underestimate is in the interval
(`under_in`) by comparing it against the lower boundary taking into account
the least significant bit of the binary significand for rounding and similarly
for the overestimate:

```c++
uint64_t dec_sig_under = scaled_sig >> 2;
uint64_t dec_sig_over = dec_sig_under + 1;
uint64_t bin_sig_lsb = bin_sig & 1;
bool under_in = lower + bin_sig_lsb <= dec_sig_under << 2;
bool over_in = (dec_sig_over << 2) + bin_sig_lsb <= upper;
if (under_in != over_in) {
  // Only one of dec_sig_under or dec_sig_over are in the rounding interval.
  return write(buffer, under_in ? dec_sig_under : dec_sig_over, dec_exp);
}
```

If both are in the interval then we select the closest:

```c++
int cmp = scaled_sig - ((dec_sig_under + dec_sig_over) << 1);
bool under_closer = cmp < 0 || cmp == 0 && (dec_sig_under & 1) == 0;
return write(buffer, under_closer ? dec_sig_under : dec_sig_over, dec_exp);
```

### 7. Write the output

Once the decimal significand is chosen we forward it together with the decimal
exponent (`dec_exp`) to the `write` function that writes the number into the
output in the exponential format. We all know how to [format integers quickly](
https://vitaut.net/posts/2020/fast-int-to-string-revisited/).

## Performance

The current implementation doesn’t apply all optimizations from Schubfach, just
the ones replacing which wouldn’t bring much benefit in terms of simplicity or
could potentially harm correctness. In particular, we skip the fast path from
section 8.3 when $q < 0$ and $v \in \mathbb{Z}$. Hopefully, the implementation
can still be legally called Schubfach despite those optimization budget cuts.

Let’s try to see how well this basic version of the algorithm
performs on the dtoa-benchmark (https://github.com/fmtlib/dtoa-benchmark):

<div id="main"></div>
 
The performance is comparable to (or slightly better than) Ryu, ~70% worse than
Dragonbox and whopping 21 times better than `sprintf`. This is great for the
implementation which is only ~200 lines of code including comments and not
including generated tables.

## Conclusion

I find it remarkable that a state-of-the-art algorithm for converting a `double`
to its shortest decimal representation can be implemented in just two hundred
lines of portable C++ code. The resulting implementation is relatively
straightforward if you’re familiar with common bit-fiddling techniques, with
the exception of the modified rounding step. This part is a subtle piece of
logic that I simply reproduced rather than fully internalized. Sometimes you
really do have to trust the math.

The performance is competitive with the best existing algorithms, and with a
few extensions such as `__uint128_t` it could be pushed even further.

I hope you find this useful. The complete code is available under a permissive
MIT license at https://github.com/vitaut/schubfach.

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
		width: '100%',
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
		width: '100%',
		height: 400
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
	width: '100%';
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
randomdigit,ryu,1,45.780000
randomdigit,ryu,2,46.520000
randomdigit,ryu,3,45.570000
randomdigit,ryu,4,44.710000
randomdigit,ryu,5,42.890000
randomdigit,ryu,6,42.370000
randomdigit,ryu,7,38.270000
randomdigit,ryu,8,37.120000
randomdigit,ryu,9,35.640000
randomdigit,ryu,10,36.770000
randomdigit,ryu,11,33.560000
randomdigit,ryu,12,32.620000
randomdigit,ryu,13,31.420000
randomdigit,ryu,14,30.250000
randomdigit,ryu,15,29.220000
randomdigit,ryu,16,28.220000
randomdigit,ryu,17,28.610000
randomdigit,doubleconv,1,59.800000
randomdigit,doubleconv,2,72.670000
randomdigit,doubleconv,3,75.080000
randomdigit,doubleconv,4,76.970000
randomdigit,doubleconv,5,79.010000
randomdigit,doubleconv,6,82.210000
randomdigit,doubleconv,7,84.360000
randomdigit,doubleconv,8,84.380000
randomdigit,doubleconv,9,84.490000
randomdigit,doubleconv,10,82.910000
randomdigit,doubleconv,11,82.630000
randomdigit,doubleconv,12,84.510000
randomdigit,doubleconv,13,86.150000
randomdigit,doubleconv,14,89.170000
randomdigit,doubleconv,15,91.730000
randomdigit,doubleconv,16,95.110000
randomdigit,doubleconv,17,100.790000
randomdigit,fmt,1,18.840000
randomdigit,fmt,2,22.350000
randomdigit,fmt,3,21.190000
randomdigit,fmt,4,21.580000
randomdigit,fmt,5,19.630000
randomdigit,fmt,6,21.190000
randomdigit,fmt,7,19.690000
randomdigit,fmt,8,22.320000
randomdigit,fmt,9,22.900000
randomdigit,fmt,10,24.910000
randomdigit,fmt,11,22.900000
randomdigit,fmt,12,24.700000
randomdigit,fmt,13,22.000000
randomdigit,fmt,14,23.660000
randomdigit,fmt,15,21.790000
randomdigit,fmt,16,23.390000
randomdigit,fmt,17,27.600000
randomdigit,dragonbox,1,18.620000
randomdigit,dragonbox,2,19.830000
randomdigit,dragonbox,3,19.710000
randomdigit,dragonbox,4,21.070000
randomdigit,dragonbox,5,19.870000
randomdigit,dragonbox,6,20.780000
randomdigit,dragonbox,7,20.120000
randomdigit,dragonbox,8,20.970000
randomdigit,dragonbox,9,20.240000
randomdigit,dragonbox,10,20.800000
randomdigit,dragonbox,11,20.280000
randomdigit,dragonbox,12,21.170000
randomdigit,dragonbox,13,20.520000
randomdigit,dragonbox,14,21.520000
randomdigit,dragonbox,15,20.790000
randomdigit,dragonbox,16,21.620000
randomdigit,dragonbox,17,24.090000
randomdigit,fpconv,1,50.200000
randomdigit,fpconv,2,53.020000
randomdigit,fpconv,3,54.580000
randomdigit,fpconv,4,56.540000
randomdigit,fpconv,5,57.540000
randomdigit,fpconv,6,58.930000
randomdigit,fpconv,7,60.450000
randomdigit,fpconv,8,61.810000
randomdigit,fpconv,9,61.980000
randomdigit,fpconv,10,63.320000
randomdigit,fpconv,11,64.810000
randomdigit,fpconv,12,66.680000
randomdigit,fpconv,13,68.100000
randomdigit,fpconv,14,69.250000
randomdigit,fpconv,15,70.550000
randomdigit,fpconv,16,72.490000
randomdigit,fpconv,17,83.500000
randomdigit,grisu2,1,38.110000
randomdigit,grisu2,2,42.130000
randomdigit,grisu2,3,47.400000
randomdigit,grisu2,4,47.970000
randomdigit,grisu2,5,49.940000
randomdigit,grisu2,6,52.360000
randomdigit,grisu2,7,55.920000
randomdigit,grisu2,8,56.530000
randomdigit,grisu2,9,56.960000
randomdigit,grisu2,10,58.660000
randomdigit,grisu2,11,61.020000
randomdigit,grisu2,12,63.910000
randomdigit,grisu2,13,66.320000
randomdigit,grisu2,14,68.790000
randomdigit,grisu2,15,71.130000
randomdigit,grisu2,16,74.090000
randomdigit,grisu2,17,81.130000
randomdigit,null,1,0.970000
randomdigit,null,2,0.930000
randomdigit,null,3,0.930000
randomdigit,null,4,0.930000
randomdigit,null,5,0.930000
randomdigit,null,6,0.930000
randomdigit,null,7,0.930000
randomdigit,null,8,0.930000
randomdigit,null,9,0.930000
randomdigit,null,10,0.930000
randomdigit,null,11,0.930000
randomdigit,null,12,0.930000
randomdigit,null,13,0.930000
randomdigit,null,14,0.930000
randomdigit,null,15,0.930000
randomdigit,null,16,0.930000
randomdigit,null,17,0.930000
randomdigit,ostringstream,1,788.490000
randomdigit,ostringstream,2,805.760000
randomdigit,ostringstream,3,818.490000
randomdigit,ostringstream,4,827.810000
randomdigit,ostringstream,5,841.100000
randomdigit,ostringstream,6,887.340000
randomdigit,ostringstream,7,930.650000
randomdigit,ostringstream,8,879.440000
randomdigit,ostringstream,9,876.230000
randomdigit,ostringstream,10,885.100000
randomdigit,ostringstream,11,889.510000
randomdigit,ostringstream,12,902.230000
randomdigit,ostringstream,13,920.190000
randomdigit,ostringstream,14,947.970000
randomdigit,ostringstream,15,979.750000
randomdigit,ostringstream,16,953.550000
randomdigit,ostringstream,17,935.950000
randomdigit,sprintf,1,647.770000
randomdigit,sprintf,2,667.750000
randomdigit,sprintf,3,682.180000
randomdigit,sprintf,4,692.170000
randomdigit,sprintf,5,702.520000
randomdigit,sprintf,6,714.300000
randomdigit,sprintf,7,724.480000
randomdigit,sprintf,8,735.150000
randomdigit,sprintf,9,737.080000
randomdigit,sprintf,10,744.380000
randomdigit,sprintf,11,759.600000
randomdigit,sprintf,12,764.480000
randomdigit,sprintf,13,776.960000
randomdigit,sprintf,14,785.040000
randomdigit,sprintf,15,788.220000
randomdigit,sprintf,16,816.180000
randomdigit,sprintf,17,782.530000
randomdigit,schubfach,1,29.460000
randomdigit,schubfach,2,33.560000
randomdigit,schubfach,3,33.410000
randomdigit,schubfach,4,33.050000
randomdigit,schubfach,5,32.670000
randomdigit,schubfach,6,32.400000
randomdigit,schubfach,7,32.270000
randomdigit,schubfach,8,32.030000
randomdigit,schubfach,9,31.920000
randomdigit,schubfach,10,34.900000
randomdigit,schubfach,11,36.970000
randomdigit,schubfach,12,37.120000
randomdigit,schubfach,13,36.750000
randomdigit,schubfach,14,36.440000
randomdigit,schubfach,15,36.340000
randomdigit,schubfach,16,38.330000
randomdigit,schubfach,17,43.990000
</textarea>

<script>
  window.MathJax = {
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']]
    },
    svg: { fontCache: 'global' }
  };
</script>
<script
  id="MathJax-script" async
  src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
