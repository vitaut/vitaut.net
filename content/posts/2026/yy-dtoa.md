---
title: The fastest double-to-string algorithm you’ve never heard of
date: 2026-08-10
enableLaTeX: true
---

[Żmij](https://github.com/vitaut/zmij), the binary-to-decimal conversion
library I wrote about [a few posts back]({{< relref "faster-dtoa.md" >}}),
started as an optimized port of Schubfach. Later I switched its core to a different
algorithm, defined in [`yy_double.c`](
https://github.com/ibireme/c_numconv_benchmark/blob/master/vendor/yy_double/yy_double.c)
from [yyjson](https://github.com/ibireme/yyjson) by
[ibireme](https://github.com/ibireme). It has no paper, no name beyond
the file it lives in (I'll refer to it as yy), and almost no public
profile outside the JSON performance crowd. It also happens to be one of the
[fastest](https://fmtlib.github.io/dtoa-benchmark/results/apple-m5-max_macos_clang21.0_ab145b9.html)
`dtoa` implementations.

This post is a tour of yy through a small visualization, with a
close look at one boundary case.

## Where yy fits in

yy is in the
[Schubfach](https://drive.google.com/file/d/1IEeATSVnEE6TkrHlCYNY2GjaraBjOT4f/)
family. The shared idea, which I covered
[in an earlier post]({{< relref "smallest-dtoa.md" >}}), is to find
the shortest decimal $\sigma \cdot 10^{e_{10}}$ that round-trips back
to a binary float $v$ by intersecting $v$'s rounding interval with
decimal grids of various spacings, and picking the coarsest grid that
still has a tick in the interval.

yy's trick is doing this very cheaply. The whole algorithm runs on
fixed-width integer arithmetic and uses only *one* multiplication by a
precomputed power of 10, where classic Schubfach needs two or three.

## Four candidates

For each binary float $v = c \cdot 2^{e_2}$, yy picks a decimal
exponent $e_{10}$ via a fixed-point approximation of $\log_{10} 2$,
then re-expresses $v$ at the decimal scale as

$$
\bar v \approx v \cdot 10^{-e_{10}}
$$

using a precomputed power-of-10 table $p_{10}$, a fixed-point value
with $p_{10} \cdot 2^{e_p} \approx 10^{-e_{10}}$ for some binary
exponent $e_p$. $\bar v$ then sits between four candidate decimal
values:

* $d_1 = \lfloor \bar v \rfloor$ and $u_1 = d_1 + 1$, the integers
  immediately below and above $\bar v$.
* $d_0 = 10 \cdot \lfloor \bar v / 10 \rfloor$ and $u_0 = d_0 + 10$,
  the multiples of 10 below and above.

Outputting $d_0$ or $u_0$ gives a decimal one digit shorter than
$d_1$ or $u_1$, because the trailing zero folds into the exponent.

Like classic Schubfach, yy prefers $d_0$ or $u_0$ when they round-trip
and falls back to $d_1$ or $u_1$ otherwise. Three predicates do the
work, evaluated against $\bar v$ and a half-ulp band $\delta$ around
it. The first checks
whether $\bar v - \delta$ reaches $d_0$:

$$
\delta \ge \bar v_{10} + \varepsilon_c
$$

with $\bar v_{10} = \bar v \bmod 10$. The second checks whether
$\bar v + \delta$ reaches $u_0$:

$$
\bar v_{10} + \delta \ge 10 + \eta_c
$$

The third decides between the longer candidates $d_1$ and $u_1$ by
checking whether $\bar v$ is past the midpoint:

$$
\bar v \bmod 1 \ge \tfrac12 + \varepsilon_u
$$

The biases $\varepsilon_c$, $\eta_c = 2\varepsilon_c - 1$,
$\varepsilon_u$ are small parity adjustments ($0$ or $\pm 1$) that
implement round-half-to-even at exact ties. The first predicate that
fires picks the candidate; if none does, the answer is $d_1$.

The $\varepsilon$ and $\eta$ terms are my bookkeeping, not yy's: they
let me write the three predicates as simple, uniform formulas. The code
doesn't adjust the thresholds at all. It runs the plain comparison and,
only when it lands exactly on a tie, branches off and rounds to even by
testing a low bit of the significand.

This is where the one-multiplication claim from earlier comes in:
$\delta$ doesn't need its own multiplication. The half-ulp of $v$ is
$\tfrac12 \cdot \mathrm{ulp}(v) = 2^{e_2 - 1}$, which in $\bar v$'s scale
gives

$$
\delta = 2^{e_2 - 1} \cdot p_{10} \cdot 2^{e_p}
       = p_{10} \cdot 2^{e_2 + e_p - 1}
$$

so $\delta$ is just $p_{10}$ shifted by an integer (no rounding, no
second multiplication). The bounds of the rounding interval are then
$\bar v \pm \delta$ via add and subtract. Schubfach instead multiplies
$v$, $v_l$, and $v_r$ by $p_{10}$ separately, which is two extra
192-bit multiplications.

The actual algorithm is a bit more involved than this, with extra
paths for irregular intervals, subnormals, and the digit-emission
loop. The sketch above is the core idea the rest hangs off of, and
all you need to follow the visualization.

## A step-by-step at E4M3 scale

E4M3 is an 8-bit floating-point format (1 sign bit, 4 exponent bits,
3 significand bits, bias 7) used for low-precision AI inference on
recent GPUs. With only 256 encodings it fits on one page, which
makes it a good target for visualizing things you'd otherwise have
to take on faith at f64 scale. I went into more detail on the format
[in the previous post]({{< relref "every-float.md" >}}).

The walk-through is one HTML page,
[`e4m3-yy.html`](https://vitaut.net/e4m3-yy.html); open it in a new
tab.

The page walks a value through yy's pipeline top to bottom. The main
grid at the top plots every E4M3 value, with the rounding interval of
the selected value highlighted:

[![](/img/yy-grid.png)](https://vitaut.net/e4m3-yy.html)

The middle panel is yy itself, step by step: $e_{10}$, the $p_{10}$
table with the active row highlighted, the scaling chain
$\bar v = c \cdot 2^{e_2} \cdot p_{10} \cdot 2^{e_p}$, and the four
candidates derived from $\bar v$:

[![](/img/yy-conversion.png)](https://vitaut.net/e4m3-yy.html)

The bottom of that panel is the predicate table. Each row shows ✓
when the predicate fires, ✗ when it evaluates to false, and is
greyed out when an earlier row already fired, alongside the actual
comparison at 8-bit working-word precision. Below it, a small
diagram puts the four candidates on a number line with $\bar v$ in
the middle and a band of width $\pm \delta$:

[![](/img/yy-predicates.png)](https://vitaut.net/e4m3-yy.html)

Hover any underlined hex literal for the exact infinite-precision
tail; hover a `?` over a comparison for a note on why that cell is on
a tipping point.

## A boundary case that looks like a bug

Set the encoding to **116** in the explorer, or work out
$v = 12 \cdot 2^{4} = 192$ by hand. The bits are `0 1110 100`, so
$c = 12$, $e_2 = 4$, and yy picks
$e_{10} = \lfloor 4 \log_{10} 2 \rfloor = 1$, so
$\bar v = 192 \cdot 10^{-1} = 19.2$ and the fine-grid fallback is
$d_1 = \lfloor \bar v \rfloor = 19$, printed as `19e1`. The shorter grid
is multiples of $10^{2} = 100$, with $d_0 = 100$ and $u_0 = 200$. If
$v$'s rounding interval reaches $u_0 = 200$, yy can emit the
shorter `2e2` instead of the longer `19e1`.

The decision comes down to the second predicate,
$\bar v_{10} + \delta \ge 10$. yy evaluates it in a Q4.4 fixed-point
working word (4 integer bits, 4 fractional bits, packed in 8 bits), and
the left-hand side comes out to `0x9.F` ($= 9.9375$), one LSB short of
$10$. The predicate is false, so yy emits `19e1`, a digit longer than it
needs to be.

That looks wrong, and the reason it isn't comes down to one term. The
comparison yy actually runs is

$$
\bar v_{10} + \delta \ge 10 + \eta_c
$$

with $\eta_c = -1$ LSB here. Lowering the threshold by a unit in the last
place looks like an off-by-one, but it is correcting for one.

In exact arithmetic the interval reaches $u_0$ exactly:

$$
\bar v + \delta = 192 \cdot 10^{-1} + \tfrac12 \cdot 2^{4} \cdot 10^{-1}
= 19.2 + 0.8 = 20.0,
$$

so $u_0 = 200 = 10 \cdot 10^{1}$ sits at the edge of the interval. yy has
no exact arithmetic. Its $p_{10}$ table is stored wider than the Q4.4
working word, 16 bits at this scale, and the $10^{-1}$ row floors to
`0xCCCC`, dropping a `0.8` LSB tail, the largest truncation any row
carries. Multiplying by that rounded-down $p_{10}$ and packing the
product back into Q4.4 is what turns a true `10.0` into `0x9.F`, and
$\eta_c$ subtracts the same LSB from the threshold to match:

$$
\bar v_{10} + \delta \ge 10 + \eta_c \iff \mathtt{0x9.F} \ge \mathtt{0xA.0 - 0x0.1}
$$

Both sides are `0x9.F`. The predicate ties, fires, and yy emits `2e2`.

[![](/img/yy-eta-nudge.png)](https://vitaut.net/e4m3-yy.html)

The visualization flags this cell with a `?` because it's
bias-sensitive: flip $\eta_c$ from $-1$ back to $0$ and the verdict
flips, and yy emits `19e1`. Both decimals round-trip: `200` parses to
the halfway point between $192$ and $208$, and round-half-to-even picks
$192$ because $c = 12$ is even.

## Try it

The [explorer](https://vitaut.net/e4m3-yy.html) is a single HTML file
with no build step
([source](https://github.com/vitaut/vitaut.net/blob/master/static/e4m3-yy.html)).
Click through the encodings to see where $p_{10}$ truncation and
round-half-to-even actually change yy's output.

Algorithms that live in JSON libraries don't get the citation count
of the ones that ship with papers. yy is worth knowing about anyway.

## Fun fact

The smallest normal `double`, $2^{-1022}$, is regular: its predecessor
sits exactly one ULP below. Schubfach-family algorithms (yy, Dragonbox,
Żmij) all flag "irregular" with `sig_bin == 1ULL << 52`, which fires
on every power of two including this one. Harmless, but as far as I
know nobody special-cases it.