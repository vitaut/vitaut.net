---
title: Every float on one page
date: 2026-05-02
enableLaTeX: true
---

<img src="/img/all-floats.png#floatright" class="floatright" width="40%" />

In my [previous post]({{< relref "faster-dtoa.md" >}}) about
[Żmij](https://github.com/vitaut/zmij), a high-performance binary-to-decimal
floating-point conversion library, I drew a small diagram of a rounding
interval around a single floating-point value. That worked well enough for
the local picture, but it doesn't say much about the global one. Where do
the irregular intervals at powers of two come from? What does the subnormal
range actually look like? And how do the
[binades](https://en.wikipedia.org/wiki/Binade) (the $[2^e, 2^{e+1})$
slices of the real line on which all FP numbers share an exponent) fit
together?

So I tried to draw that instead: the entire set of representable numbers,
laid out so the interesting structure is visible at a glance.

## A small format that is actually used

To draw all the floats you really need a small format. Luckily small formats
have recently escaped the textbook: 8-bit floating-point formats are now used
in production for AI training and inference. The one we will look at here is
**E4M3**: 1 sign bit, 4 exponent
bits, 3 significand bits, bias 7, with subnormals and a single NaN slot. It is
specified in [FP8 Formats for Deep Learning](https://arxiv.org/abs/2209.05433)
by NVIDIA, Arm and Intel, three companies that famously agree on very little,
and is supported in hardware by GPUs such as the H100, H200 and B200, where
it is the workhorse format for low-precision inference.

E4M3 has only 256 encodings, so we can comfortably show every value at once
and still have room to think.

## The usual picture is a single line

The traditional way to visualize floating-point numbers is to put them on a
real number line. For E4M3 the result is accurate but not very useful: most
of the action is squeezed near zero, huge gaps open up near the maximum, and
there is nothing on the page that tells you *why* the spacing changes the
way it does. (You can see for yourself in the *linear number line* panel at
the bottom of the embedded explorer further down.) The structure that makes
floating-point floating-point, the partition into binades, is exactly the
thing the linear axis hides.

Zooming in helps a bit, but it doesn't scale: at any zoom level you only ever
see a slice of one or two binades, and the relationship between the binary
representation and the decimal positions is still mostly invisible.

## A 2-D picture, suggested by an LLM

After some back and forth with an LLM, a much better idea came up: forget
the linear axis, just plot every value by its exponent. The first sketch was
crude but got the point across, which was more than I had any right to
expect from a vibe-coding session:

```
Log₂ scale (this is the "real" structure)

E = -9   • • • • • • •          (subnormals)
E = -6   • • • • • • • •
E = -5   • • • • • • • •
E = -4   • • • • • • • •
E = -3   • • • • • • • •
E = -2   • • • • • • • •
E = -1   • • • • • • • •
E =  0   • • • • • • • •
E =  1   • • • • • • • •
E =  2   • • • • • • • •
E =  3   • • • • • • • •
E =  4   • • • • • • • •
E =  5   • • • • • • • •
E =  6   • • • • • • • •
E =  7   • • • • • • • •

👉 Every exponent bucket has exactly 8 evenly spaced values
👉 That's why FP behaves like a logarithmic number system
```

The reason this works is that every finite floating-point value can be written
as $c \cdot 2^{e_2}$ with $c$ an integer in a small range. For E4M3 normals
$c \in \\{8, \ldots, 15\\}$ and $e_2 = E - 10$; for subnormals $c \in
\\{1, \ldots, 7\\}$ and $e_2 = -9$. So *every* value sits at integer coordinates
$(c, e_2)$: the rows are binades, the columns are integer significands, and
within each row the dots are linearly spaced. The mysterious "logarithmic
spacing" of floating-point numbers is just what you see when you stack these
linear rows and look at them from the side.

## Vibe-coded into something usable

A few more iterations and the sketch turned into the interactive explorer
below ([standalone page](/e4m3.html),
[source](https://github.com/vitaut/vitaut.net/blob/master/static/e4m3.html)).
Click any dot to inspect the value, toggle subnormals and NaN, or scrub
through the encoding directly:

<iframe src="/e4m3.html"
        style="width:100%; height:1200px; border:1px solid var(--line, #30363d);
               border-radius:10px; background:#0e1116;"
        loading="lazy"
        title="E4M3 explorer"></iframe>

Two axes, two scales: the binary exponent $e_2$ runs down the left, and the
matching decimal exponent $e_{10} = \lfloor e_2 \log_{10} 2 \rfloor$ down
the right. A few things to look at:

* The horizontal line through each row is the binade, extended by half a cell
  on each side. Those half-cells are exactly the *rounding interval*: real
  numbers between them round back to the dot in the middle (modulo
  rounding-mode tie-breaks I'm glossing over).
* Crossing each row are vertical decimal ticks at two scales: minor every
  $10^{e_{10}}$, major every $10^{e_{10}+1}$. They are the only two decimal
  grids that matter in that binade. Anything coarser misses the rounding
  interval, anything finer just adds digits.

So shortest-decimal conversion is one row's worth of work: pick a dot, find
the coarsest tick that lands inside its rounding interval.

## Reading the shortest decimal by hand

Let's pick a value and walk through it. Set the encoding to **51** in the
explorer (or click the dot at row $e_2 = -4$, column $c = 11$). The bits
are `0 0110 011`, i.e. $E = 6$, $M = 3$, so

$$
v = (8 + 3) \cdot 2^{6 - 10} = 11 \cdot 2^{-4} = 0.6875.
$$

Its row is $e_2 = -4$, with $e_{10} = \lfloor -4 \log_{10} 2 \rfloor = -2$. So
on this row:

* minor ticks are at multiples of $10^{-2} = 0.01$,
* major ticks are at multiples of $10^{-1} = 0.1$.

The dot's neighbors in the binade are at $10 \cdot 2^{-4} = 0.625$ on the
left and $12 \cdot 2^{-4} = 0.75$ on the right. The half-cells around the dot
therefore span $(0.65625, 0.71875)$, the rounding interval. Now eyeball the
ticks in that interval:

* The **major tick at $0.7$** sits right inside it.
* (Several minor ticks $0.66, 0.67, \ldots, 0.71$ are also inside, but we
  don't care: the major tick already gives the shortest answer.)

Therefore the shortest decimal that round-trips through E4M3 to $0.6875$ is
simply **`0.7`**. No tables, no big-integer arithmetic, just one dot and the
ticks on its row.

This is exactly what Schubfach (and Dragonbox, and Żmij) compute for `double`,
just at a much larger scale and with a lot more arithmetic to keep track of:
pick the coarsest decimal grid whose spacing still fits inside the rounding
interval, then round the value to that grid.

## Where the special cases go

Subnormals turn out to be just the bottom row $e_2 = -9$, with the column
index running $1\ldots 7$ instead of $8\ldots 15$ and the leftmost half-cell
extending a little further than usual. The irregular rounding
intervals at powers of two show up at the leftmost normal column ($c = 8$ in
every row except the bottom), where the left half-cell is shorter than the
right because the predecessor sits in the binade below and is only half a
ULP away. Even the `e10` vs `e10 + 1` decision in Schubfach has an obvious
reading: "does the major tick fit inside the interval, or do we have to fall
back to minor ticks?".

The full explorer is a single HTML/JS/SVG file with no build step; if you
want to fork it, adapt it to a different format
([E5M2](https://arxiv.org/abs/2209.05433)?
[bfloat16](https://en.wikipedia.org/wiki/Bfloat16_floating-point_format)?
Whatever your hardware vendor invents next quarter?), or
just read how it's wired together, the source is in
[the website's repo](https://github.com/vitaut/vitaut.net).

Happy floatspotting!
