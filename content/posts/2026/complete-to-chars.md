---
title: "A complete floating-point to_chars in 18 kB"
date: 2026-08-18
enableLaTeX: true
---

![](/img/agc.jpg#floatright
"The Apollo Guidance Computer got to the Moon in 72 kB of ROM. std::to_chars wouldn't have made it.")

libstdc++'s floating-point `std::to_chars`, every format and precision for
`float` through `long double`, adds about 256 kB to a statically linked binary.
[Żmij](https://github.com/vitaut/zmij) does the same job in about 18 kB, and
formats shortest `double`s about 7x faster in the benchmark below.

[`std::to_chars`](https://en.cppreference.com/cpp/utility/to_chars) for floating
point has been in the standard since C++17. It is the low-level,
locale-independent, non-throwing primitive that everything else
(`std::to_string`, `std::format`, your favorite logging library) is supposed to
build on. It took years to land in the major standard libraries, some cases
are still not handled correctly, and where it does exist it is more bloated than
you might expect for printing a number.

So I implemented the whole thing, correctly rounded, in Żmij, a Slavic dragon,
because the naming convention in this field is not negotiable. It fits in one
source file and two headers, one for the core library and one for the
`to_chars` API, and draws on almost ten years of implementing floating-point
formatting algorithms in [{fmt}](https://github.com/fmtlib/fmt) and recent
[developments]({{< relref "yy-dtoa.md" >}}). This post is about how small
"complete" can be, and why the standard version isn't.

## What "complete" actually means

`std::to_chars` isn't one function. The floating-point overloads span:

* four formats: `chars_format::scientific` (`%e`), `fixed` (`%f`), `general`
  (`%g`), and `hex` (`%a`);
* the shortest form *and* an arbitrary explicit precision;
* three types: `float`, `double`, and `long double`;
* all of it correctly rounded (round-half-to-even) and locale-independent.

Another way to see it: this is everything `printf` gives you (those formats at an
explicit precision), plus the shortest form, which `printf` lacks but almost
every modern language has, and usually as the default when you print a float.

Shortest formatting, the part that gets the most attention, is only a part of
this. The explicit-precision paths, fixed and scientific to a caller-chosen
number of digits, are a different problem, and they make up most of
the API surface.

## The size cost

To illustrate, take a program that does nothing but print a floating-point value,
shortest by default or to a requested precision, with the type chosen at runtime:

```c++
#include <charconv>
#include <stdio.h>   // C I/O, to avoid pulling in extra C++ symbols
#include <stdlib.h>

template <typename T>
char* convert(char* buf, size_t n, double v, int argc, char** argv) {
  T x = static_cast<T>(v);  // convert to the target type
  std::to_chars_result r;
  if (argc > 3) {   // precision (+ optional format f/e/g/a)
    std::chars_format f = std::chars_format::general;
    switch (argc > 4 ? argv[4][0] : 'g') {
    case 'f': f = std::chars_format::fixed; break;
    case 'e': f = std::chars_format::scientific; break;
    case 'a': f = std::chars_format::hex; break;
    }
    r = std::to_chars(buf, buf + n, x, f, atoi(argv[3]));
  } else {          // no precision -> shortest
    r = std::to_chars(buf, buf + n, x);
  }
  return r.ptr;
}

int main(int argc, char** argv) {
  char t = argc > 1 ? argv[1][0] : 'd';  // f/d/l -> float/double/long double
  double v = argc > 2 ? strtod(argv[2], nullptr) : 0.1;
  char buf[400] = {};
  char* end = buf;
  if (t == 'f')
    end = convert<float>(buf, sizeof(buf), v, argc, argv);
  else if (t == 'l')
    end = convert<long double>(buf, sizeof(buf), v, argc, argv);
  else
    end = convert<double>(buf, sizeof(buf), v, argc, argv);
  fwrite(buf, 1, size_t(end - buf), stdout);
}
```

The type, value, precision, and format all come from the command-line arguments
on purpose, so the optimizer can't fold the call away and we measure the real
conversion code.
Instantiating `convert` for `float`, `double`, and `long double`, each with the
shortest form plus `fixed`, `scientific`, `general`, and `hex` at an explicit
precision, is what exercises the *complete* API that the numbers below measure.

I compiled it with the same recipe as [Honey, I shrunk {fmt}]({{< relref
"binary-size.md" >}}), `-flto -DNDEBUG` then `strip`, at two optimization levels:
`-Os` (for size) and `-O2` (for speed). The one addition is `-static-libstdc++
-static-libgcc`, so the library's `to_chars` code and its tables land *in the
executable* instead of hiding in `libstdc++.so` where a naive `ls -l` wouldn't
count them. To isolate the conversion I subtract a baseline binary with identical
scaffolding but no conversion.

Numbers are from an Apple M-series arm64 machine, Homebrew GCC 16.1.0
(libstdc++). I use libstdc++ rather than libc++ because libc++'s `long double`
`to_chars` is still incomplete, as discussed below, so it can't produce the
complete API correctly.

| build | `-Os` | `-O2` |
|---|---:|---:|
| baseline (no conversion) | 33.6 kB | 33.6 kB |
| Żmij | 52.1 kB, +18 kB | 68.6 kB, +35 kB |
| `std::to_chars` (stock libstdc++) | 289.9 kB, +256 kB | same binary |

Żmij covers all of that in about 18 kB optimized for size and 35 kB optimized
for speed. libstdc++ adds about 256 kB at both optimization levels because
`-static-libstdc++` links `floating_to_chars.o` out of the `libstdc++.a` that
Homebrew ships, built once at `-O2` with no LTO information in the archive, so
my optimization level never reaches it. That is the number you actually get
unless you rebuild the standard library yourself. Only code you compile from
source, like Żmij, responds to the flag at all. So Żmij stays roughly 7 to 14x
smaller depending on how you build. And that 256 kB is all-or-nothing: most of
it is the shared lookup tables that every format and precision relies on, so you
pay for nearly all of it as soon as you call `to_chars` at all, even if you only
ever use one format.

Dropping `-flto` costs Żmij about 1 kB (+19.6 kB at `-Os`, +35.6 kB at `-O2`)
and changes `std::to_chars` by exactly zero bytes, byte for byte the same
binary, as expected: LTO cannot optimize the prebuilt library code.

One caveat on the platform: on arm64 macOS `long double` is just `double`, so
the figures above don't exercise a distinct extended-precision path. On x86-64,
where `long double` is 80-bit, adding it on top of `float` and `double` costs
libstdc++ about 33 kB more but Żmij only 4 to 8 kB, so the gap widens rather
than closes.

Where does libstdc++'s quarter-megabyte go?

```
$ size -m charconv   # the std::to_chars build
Segment __TEXT: 245760
    Section __text:  84184   # code
    Section __const: 125296  # precomputed tables
```

About 125 kB of the binary is lookup tables, more than twice the entire Żmij
binary. That is not an inherent cost of printing floats to a precision; it is a
consequence of the *algorithm* the implementation is built on. libstdc++ (like
libc++ and MSVC) builds its floating-point `to_chars` on
[Ryū](https://github.com/ulfjack/ryu), which leans on large precomputed tables.
Ryū is a dragon too, and like any self-respecting dragon it sleeps on a hoard it
never spends. It was a solid choice when Ulf Adams published it in 2018. It is no
longer the state of the art, and its reliance on large tables is what inflates
the binary.

## Why the size matters

On a desktop or server, where `to_chars` comes from a shared libstdc++, 256 kB is
often noise. It lands hardest where C++ tends to be chosen and the standard
library is linked statically or bundled with the application: embedded and
firmware, where the entire flash budget is a few hundred kB; WebAssembly, where
the binary is downloaded before the page can run; mobile apps, where size
affects both downloads and launch time; and short-lived or serverless processes,
where it is startup latency on every invocation. `to_chars` is also a primitive,
so that cost can propagate into higher-level formatting, logging and
serialization facilities built on the same conversion machinery.

The shared-library escape hatch also assumes `to_chars` stays out of line.
[P3652](https://wg21.link/p3652) proposes making the floating-point overloads
`constexpr` (integer `to_chars` already is, since C++23). A naive implementation
that simply moves the existing code, tables and all, into headers would compile
it into every translation unit that uses it, where it can no longer hide in a
shared library and every TU has to parse and instantiate all of it. That is not
forced by `constexpr`: `if consteval` can route constant evaluation through a
small header-visible path and leave the tuned runtime code out of line. But that
split is only as cheap as the compile-time path is small.

The tables may also have a runtime cost. A single conversion touches only a
handful of entries, so this is not a per-call penalty, but 125 kB of tables
enlarges the program's cache footprint and can interfere with hotter data in a
mixed workload. A tight formatting loop keeps the entries it uses warm and
benchmarks beautifully, which is exactly the case least likely to show the
effect; the benchmarks below don't measure it either. Treat it as a reason to
prefer smaller tables, not as a quantified cost. Small and fast are not in
tension here.

## The exact problem

The 256 kB footprint isn't inevitable, but producing correctly rounded output
for arbitrary precision is genuinely difficult, and the algorithm you pick to do
it is what decides the size.

Shortest conversion, the subject of most of my previous posts, from
[Schubfach]({{< relref "smallest-dtoa.md" >}}) to [yy]({{< relref "yy-dtoa.md" >}}),
gets to stop early. It only needs enough digits to uniquely identify the
float, which is at most 17 for a `double`. Fixed and scientific output to an
explicit precision don't have that luxury: they must round the *exact real
value* of the float to the requested place, and a `double`'s exact value can be
enormous.

The smallest positive subnormal double is $2^{-1074}$. Written with `%f` it has
1074 digits after the decimal point: 323 zeros followed by 751 significant ones.
Ask for `%.1074f` and every one of them has to be right. You can't get there by
computing $v \cdot 10^{k}$ in a wide integer and hoping: the intermediate
doesn't fit in anything fixed-width, and naive scaling loses exactly the
low-order information rounding depends on.

Getting the exact value is what decides the size. Dragon4 and David Gay's `dtoa`
compute it at runtime with arbitrary-precision (bignum) arithmetic: little code,
more work per call. Ryū instead precomputes for the worst case into large tables:
fast, but it doesn't scale, costing hundreds of kilobytes for `double` alone and
never extending its fixed-precision path to `long double`.

## Mind the gaps

Size is one thing. The other is that, nine years after C++17, the
floating-point overloads still aren't uniformly complete. The clearest gap today
is in libc++, which degrades `long double`: where `long double` is wider than
`double` (80-bit x86, 128-bit elsewhere), it silently converts through `double`
instead of formatting the real value. On those platforms libc++'s `long double`
is a `double` in a trenchcoat. This reflects the sheer amount of work these
overloads take and how stretched standard library maintainers are.

That gap is easy to see, and it isn't just about losing precision. Take
the `double` value `0.1`, widened to a 128-bit `long double`, and ask for its
shortest form:

```c++
long double v = 0.1;  // the double 0.1, widened to long double
char buf[64];
auto r = std::to_chars(buf, buf + sizeof(buf), v);  // shortest
```

| implementation | output | round-trips to `v`? |
|---|---|---|
| libstdc++, Żmij | `0.1000000000000000055511151231257827` | yes |
| libc++ | `0.1` | no |

The shortest form depends on the
[rounding interval]({{< relref "smallest-dtoa.md" >}}), which reaches halfway to
the neighboring representable values, and a `long double`'s neighbors are far
closer than a `double`'s: `0.1` uniquely identifies the value among `double`s,
but among `long double`s you need every digit. libc++ formats through `double`,
so it uses the wider interval and prints `0.1`, which reads back as a *different*
`long double`. Here that conversion is exact, so only the interval is wrong; for
a value that isn't exactly a `double` it also changes the number being printed.

There are also issues with the specification itself. For example, Junekey Jeon,
the author of [Dragonbox](https://github.com/jk-jeon/dragonbox), and I fixed the
default floating-point representation in `std::to_chars` (which `std::format`
builds on) in [P3505](https://isocpp.org/files/papers/P3505R3.html).

## The small print

Most of Żmij's size discipline comes from being deliberate about tables and
about which cases are worth optimizing.

**Use tables sparingly.** There is a single precomputed power-of-ten table,
shared between the shortest and fixed-precision paths, rather than one table per
job.
The tables are also configurable: `ZMIJ_OPTIMIZE_SIZE` compresses the
power-of-ten table (computing entries on the fly instead of storing them) and
drops some of the others, trading a little speed for a smaller footprint while
still formatting quickly enough for most uses.

**Optimize the cases that matter.** Up to the round-trip precision (17
significant digits for `double`), the digits carry information, so those
paths are heavily tuned, with table-driven scaling and fast BCD digit extraction
with SIMD variants (SSE and NEON).

**Don't pay for the pointless cases.** Asking for more than round-trip precision
just spells out the exact value of the stored binary float in ever more "garbage"
digits that say nothing more about the number you started with, and which almost
nobody needs. Żmij still produces them correctly, but with a compact `bigint`
fallback rather than dragging a second high-performance algorithm and its tables
into every build.

The result is that "add precision support" reuses one shared table for the
common case, plus a small exact fallback for the rest, not a second algorithm
and a second set of tables.

## Performance

Small doesn't have to mean slow. I ran the
[dtoa-benchmark](https://github.com/fmtlib/dtoa-benchmark) for shortest `double`
formatting, the operation most programs hit, with the same compiler and
optimization levels as the size numbers above (Homebrew GCC 16, libstdc++, `-O2`
and `-Os`, `-DNDEBUG`) on an Apple M5 Max. Time per conversion in nanoseconds,
lower is better:

<style type="text/css">
.zmij-chart { width: 100%; height: auto; display: block; }
.zmij-chart text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
}
.zmij-chart .lbl { fill: #24292f; }
.zmij-chart .val, .zmij-chart .cap { fill: #6a737d; }
.night .zmij-chart .lbl { fill: #e6e6e6; }
.night .zmij-chart .val, .night .zmij-chart .cap { fill: #a8a8a8; }
</style>
<svg class="zmij-chart" viewBox="0 0 820 244" xmlns="http://www.w3.org/2000/svg"
     role="img"
     aria-label="Shortest double formatting time at -O2 and -Os (dtoa-benchmark)">
  <g>
    <text x="140" y="21" text-anchor="end" dominant-baseline="middle" class="lbl">Żmij -O2</text>
    <rect x="150" y="8" width="57.2" height="26" rx="3" ry="3" fill="#3366cc"/>
    <text x="217.2" y="21" dominant-baseline="middle" class="val">4.69 ns</text>
  </g>
  <g>
    <text x="140" y="51" text-anchor="end" dominant-baseline="middle" class="lbl">Żmij -Os</text>
    <rect x="150" y="38" width="101.7" height="26" rx="3" ry="3" fill="#8ea9e3"/>
    <text x="261.7" y="51" dominant-baseline="middle" class="val">8.34 ns</text>
  </g>
  <g>
    <text x="140" y="93" text-anchor="end" dominant-baseline="middle" class="lbl">Ryū -O2</text>
    <rect x="150" y="80" width="395.8" height="26" rx="3" ry="3" fill="#990099"/>
    <text x="555.8" y="93" dominant-baseline="middle" class="val">32.44 ns</text>
  </g>
  <g>
    <text x="140" y="123" text-anchor="end" dominant-baseline="middle" class="lbl">Ryū -Os</text>
    <rect x="150" y="110" width="508.9" height="26" rx="3" ry="3" fill="#cc7fcc"/>
    <text x="668.9" y="123" dominant-baseline="middle" class="val">41.71 ns</text>
  </g>
  <g>
    <text x="140" y="165" text-anchor="end" dominant-baseline="middle" class="lbl">to_chars -O2</text>
    <rect x="150" y="152" width="430.5" height="26" rx="3" ry="3" fill="#0099c6"/>
    <text x="590.5" y="165" dominant-baseline="middle" class="val">35.29 ns</text>
  </g>
  <g>
    <text x="140" y="195" text-anchor="end" dominant-baseline="middle" class="lbl">to_chars -Os</text>
    <rect x="150" y="182" width="436.6" height="26" rx="3" ry="3" fill="#7fccdf"/>
    <text x="596.6" y="195" dominant-baseline="middle" class="val">35.79 ns</text>
  </g>
  <text x="435" y="232" text-anchor="middle" class="cap">
    shortest double, ns per conversion (lower is better)
  </text>
</svg>

At `-O2`, Żmij formats a shortest `double` about 7x faster than
`std::to_chars` and standalone Ryū (which the libstdc++ implementation is based
on). Optimizing for size costs Żmij some speed, but even the `-Os` build, the
smallest one, is still the fastest here and about 4x ahead of `std::to_chars`.
The two `std::to_chars` bars are the same prebuilt library code called from two
different client builds, for the same reason as in the size table, so read the
half-nanosecond between them as noise rather than as an effect of the flag.

## Room to shrink

18 kB is a good start, but there is more to take out. Two directions look
promising.

**Share more code between types.** The `float` and `double` paths are still
largely separate instantiations of the same logic. Formatting `float` through
the `double` machinery, or factoring the common parts into a single type-erased
core, should shave off a few more kB for programs that print both.

**`constexpr` `to_chars`.** Whatever happens to the runtime path, the
compile-time one has to live in headers, so it wants to be small and quick to
compile. That is where a compact core helps: Żmij's compile-time path can use
compressed tables, as `ZMIJ_OPTIMIZE_SIZE` already does, rather than the
full-size tables and SIMD.

## The point

The standard gave us the right API in 2017, and printing floats correctly is a
hard problem, so it's no surprise the early implementations reached for the
algorithms that were state of the art at the time. The building blocks have
improved a lot since then, and Żmij is what you get when you put the current
ones together: the *complete* floating-point `to_chars`, correctly rounded, for
every format, precision and type, in about 18 kB, while making the common
shortest-`double` case several times faster than libstdc++ in this benchmark.

Żmij fits in one source file and two headers, exposes a
[`std::to_chars`-style API](https://github.com/vitaut/zmij/blob/main/zmij-to-chars.h)
that works in C++14 (`std::to_chars` itself requires C++17), ships under a
permissive license, and already has ports to
[Rust](https://github.com/dtolnay/zmij) and [Zig](https://github.com/de-sh/zmij).
If you maintain a standard library, a JSON serialization library, or anything
that turns floats into text, there's now a small, fast, complete implementation
to study or borrow from.

[Żmij](https://github.com/vitaut/zmij) is on GitHub.
