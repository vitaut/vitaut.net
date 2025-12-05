---
title: to_chars or not to_chars?
date: 2025-12-05
---

I was recently adding [my Schubfach double-to-string conversion algorithm
implementation](https://github.com/vitaut/schubfach) to [`dtoa-benchmark`](
https://github.com/fmtlib/dtoa-benchmark) and noticed that `std::to_chars`
was notably missing from that benchmark. So I decided to add it and see how
well it compares to other methods.

And it did pretty well! This particular implementation from libc++ was 17
times faster than `sprintf` and almost 2 times faster than
[double-conversion](https://github.com/google/double-conversion).
Considering that `std::to_chars` has been available since 2017, I think it's
time to retire double-conversion.

<div id="main"></div>

There is still a considerable gap to other state-of-the-art libraries like
[Schubfach](https://github.com/vitaut/schubfach) and [Dragonbox](
https://github.com/jk-jeon/dragonbox) (used in
[{fmt}](https://github.com/fmtlib/fmt)), but performance should be more than
sufficient for most use cases.

You can also clearly see that libc++ uses Ryu because their performance profiles
are nearly identical, with stock implementation being just a bit faster.

The binary code is surprisingly reasonable too. For example

```c++
#include <charconv>

int main() {
  char buf[25];
  *std::to_chars(buf, buf + 25, 4.2).ptr = 0;
}
```

generates

```s
main:
        sub     rsp, 40
        movsd   xmm0, QWORD PTR .LC0[rip]
        mov     rdi, rsp
        lea     rsi, [rsp+25]
        call    std::to_chars(char*, char*, double)
        mov     BYTE PTR [rax], 0
        xor     eax, eax
        add     rsp, 40
        ret
.LC0:
        .long   -858993459
        .long   1074842828
```

Godbolt: https://www.godbolt.org/z/jvahnosed

Hopefully it will remain like this, and the C++ committee resists the urge of
adding wide char, locale, range and other irrelevant functionality to this
low-level API.

P.S. I was surprised to see that [my toy 150-line double-to-string conversion
algorithm](/posts/2024/simple-dtoa/) was 15% faster than
`sprintf`.

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
randomdigit,doubleconv,1,61.120000
randomdigit,doubleconv,2,71.110000
randomdigit,doubleconv,3,74.880000
randomdigit,doubleconv,4,78.780000
randomdigit,doubleconv,5,83.090000
randomdigit,doubleconv,6,83.970000
randomdigit,doubleconv,7,84.540000
randomdigit,doubleconv,8,89.100000
randomdigit,doubleconv,9,87.520000
randomdigit,doubleconv,10,84.570000
randomdigit,doubleconv,11,83.310000
randomdigit,doubleconv,12,84.820000
randomdigit,doubleconv,13,86.670000
randomdigit,doubleconv,14,89.260000
randomdigit,doubleconv,15,92.170000
randomdigit,doubleconv,16,95.710000
randomdigit,doubleconv,17,101.000000
randomdigit,dragonbox,1,18.550000
randomdigit,dragonbox,2,19.790000
randomdigit,dragonbox,3,19.610000
randomdigit,dragonbox,4,20.420000
randomdigit,dragonbox,5,19.850000
randomdigit,dragonbox,6,20.940000
randomdigit,dragonbox,7,20.090000
randomdigit,dragonbox,8,20.920000
randomdigit,dragonbox,9,20.180000
randomdigit,dragonbox,10,20.740000
randomdigit,dragonbox,11,20.210000
randomdigit,dragonbox,12,21.140000
randomdigit,dragonbox,13,20.490000
randomdigit,dragonbox,14,21.460000
randomdigit,dragonbox,15,20.740000
randomdigit,dragonbox,16,21.580000
randomdigit,dragonbox,17,24.110000
randomdigit,ryu,1,45.850000
randomdigit,ryu,2,46.420000
randomdigit,ryu,3,45.600000
randomdigit,ryu,4,44.660000
randomdigit,ryu,5,43.010000
randomdigit,ryu,6,42.690000
randomdigit,ryu,7,39.050000
randomdigit,ryu,8,37.580000
randomdigit,ryu,9,35.800000
randomdigit,ryu,10,36.870000
randomdigit,ryu,11,34.020000
randomdigit,ryu,12,33.140000
randomdigit,ryu,13,31.510000
randomdigit,ryu,14,30.510000
randomdigit,ryu,15,29.570000
randomdigit,ryu,16,28.810000
randomdigit,ryu,17,28.630000
randomdigit,fmt,1,19.070000
randomdigit,fmt,2,22.480000
randomdigit,fmt,3,20.300000
randomdigit,fmt,4,21.500000
randomdigit,fmt,5,19.610000
randomdigit,fmt,6,21.040000
randomdigit,fmt,7,19.570000
randomdigit,fmt,8,21.870000
randomdigit,fmt,9,23.130000
randomdigit,fmt,10,24.980000
randomdigit,fmt,11,22.760000
randomdigit,fmt,12,24.380000
randomdigit,fmt,13,21.990000
randomdigit,fmt,14,23.830000
randomdigit,fmt,15,21.690000
randomdigit,fmt,16,23.400000
randomdigit,fmt,17,27.490000
randomdigit,null,1,0.930000
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
randomdigit,ostringstream,1,788.800000
randomdigit,ostringstream,2,802.980000
randomdigit,ostringstream,3,816.330000
randomdigit,ostringstream,4,826.840000
randomdigit,ostringstream,5,842.320000
randomdigit,ostringstream,6,851.420000
randomdigit,ostringstream,7,861.610000
randomdigit,ostringstream,8,869.080000
randomdigit,ostringstream,9,873.280000
randomdigit,ostringstream,10,880.050000
randomdigit,ostringstream,11,887.690000
randomdigit,ostringstream,12,904.700000
randomdigit,ostringstream,13,913.590000
randomdigit,ostringstream,14,922.810000
randomdigit,ostringstream,15,925.390000
randomdigit,ostringstream,16,932.560000
randomdigit,ostringstream,17,929.070000
randomdigit,puff,1,624.220000
randomdigit,puff,2,629.390000
randomdigit,puff,3,631.220000
randomdigit,puff,4,631.230000
randomdigit,puff,5,629.880000
randomdigit,puff,6,636.800000
randomdigit,puff,7,631.770000
randomdigit,puff,8,627.740000
randomdigit,puff,9,632.170000
randomdigit,puff,10,640.770000
randomdigit,puff,11,631.200000
randomdigit,puff,12,628.450000
randomdigit,puff,13,628.570000
randomdigit,puff,14,626.410000
randomdigit,puff,15,625.090000
randomdigit,puff,16,623.300000
randomdigit,puff,17,620.000000
randomdigit,schubfach,1,20.370000
randomdigit,schubfach,2,24.030000
randomdigit,schubfach,3,23.640000
randomdigit,schubfach,4,23.660000
randomdigit,schubfach,5,23.060000
randomdigit,schubfach,6,23.160000
randomdigit,schubfach,7,23.240000
randomdigit,schubfach,8,23.240000
randomdigit,schubfach,9,22.400000
randomdigit,schubfach,10,24.340000
randomdigit,schubfach,11,26.080000
randomdigit,schubfach,12,25.860000
randomdigit,schubfach,13,25.930000
randomdigit,schubfach,14,25.530000
randomdigit,schubfach,15,25.430000
randomdigit,schubfach,16,27.070000
randomdigit,schubfach,17,33.340000
randomdigit,sprintf,1,646.690000
randomdigit,sprintf,2,667.460000
randomdigit,sprintf,3,680.520000
randomdigit,sprintf,4,690.920000
randomdigit,sprintf,5,701.740000
randomdigit,sprintf,6,713.650000
randomdigit,sprintf,7,723.540000
randomdigit,sprintf,8,732.710000
randomdigit,sprintf,9,736.860000
randomdigit,sprintf,10,743.860000
randomdigit,sprintf,11,754.410000
randomdigit,sprintf,12,764.140000
randomdigit,sprintf,13,776.490000
randomdigit,sprintf,14,784.240000
randomdigit,sprintf,15,787.530000
randomdigit,sprintf,16,799.810000
randomdigit,sprintf,17,781.380000
randomdigit,to_chars,1,52.160000
randomdigit,to_chars,2,53.220000
randomdigit,to_chars,3,50.860000
randomdigit,to_chars,4,49.200000
randomdigit,to_chars,5,47.660000
randomdigit,to_chars,6,46.040000
randomdigit,to_chars,7,44.810000
randomdigit,to_chars,8,43.420000
randomdigit,to_chars,9,42.080000
randomdigit,to_chars,10,43.100000
randomdigit,to_chars,11,40.010000
randomdigit,to_chars,12,38.480000
randomdigit,to_chars,13,37.150000
randomdigit,to_chars,14,36.030000
randomdigit,to_chars,15,35.210000
randomdigit,to_chars,16,34.060000
randomdigit,to_chars,17,35.200000
</textarea>
