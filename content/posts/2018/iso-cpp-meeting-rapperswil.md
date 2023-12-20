---
title: ISO C++ standards committee meeting in Rapperswil
date: 2018-06-15
aliases: ['/2018/06/15/iso-cpp-meeting-rapperswil.html']
---

<div style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img src="/img/evolution.jpg" width="300"
       title="Hopefully C++ evolution process has more tools at its disposal">
</div>

Last week I attended the ISO C++ standards committee meeting in beautiful
Rapperswil and here are some highlights biased towards what I’m interested in
and what I had a chance to attend (mostly text formatting, modules, and various
library evolution stuff). For a more comprehensive report see [2018 Rapperswil
ISO C++ Committee Trip Report (Contracts for C++20; Parallelism TS v2 published;
Draft Reflection TS)](
https://www.reddit.com/r/cpp/comments/8prqzm/2018_rapperswil_iso_c_committee_trip_report/).

## Text Formatting

Revision 2 (zero-based, obviously) of my paper, [P0645R2 Text Formatting](
http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0645r2.html), was
reviewed on Wednesday. This revision had mostly cosmetic changes based on the
feedback from Jacksonville, namely:

* Rename `count` to `formatted_size`.
* Add the `format_to_n` function taking an output iterator and a size.
* Drop nested namespace `fmt` and add `format` to some names to prevent potential
  collisions.
* Add a note that compile-time processing of format strings applies to
  user-defined types.
* Wording cleanup

With the approval of SG16 (Unicode) study group, Unicode support was left for a
future paper. It doesn’t affect the design of the API, but some work will be
needed to define how various format specifiers are handled in case of Unicode.

```
We will leave unicode support for future paper.
SF F  N  A  SA
15  5 1  0  0
```

Here and below SF, F, N, A, and SA stand for "Strongly in Favor", "in Favor",
"Neutral", "Against", and "Strongly Against" respectively.

LEWG voted overwhelmingly in favor of putting the format functions in the `std`
namespace:

```
auto s = std::format("{}", 42);
```

instead of a nested namespace such as `std::fmt`:

```
auto s = std::fmt::format("{}", 42);
``` 

Here are the votes:

```
namespace std vs. namespace std::fmt
SStd Std N Fmt SFmt
20   3   2 0   1
```

The group liked the name `formatted_size` proposed by [@Mehrdad](
https://twitter.com/mtux) (thanks!) There was a suggestion to drop the function
altogether in favor of `format_to_n(nullptr, 0, ...)` which also returns the
formatted output size similarly to `snprintf(nullptr, 0, ...)`, but it was
decided to keep it:

```
We want to keep formatted_size.
SF F  N  A  SA
8  10 4  1  1
```

There was a slight preference towards keeping the size type as a template
argument in `format_to_n` (same as in
[`copy_n`](https://en.cppreference.com/w/cpp/algorithm/copy_n)):

```
12 No default, template param
8 default to std::iterator_traits<OutputIterator>::size_type
6 (the range version of the above)
6 size_t
```

And most importantly, LEWG voted to prioritize the proposal for the International
Standard which means that it has a chance to get into C++20:

```
Prioritize this for the IS (give it more time this week and in SD).
SF F N A SA
16 3 3 0 0
```

Unfortunately it was not given more time last week since there were a lot of
other papers on the agenda. I did my best to help review the backlog of LEWG
papers both during the week and on Saturday afternoon after the closing plenary.

Sending the paper to Library Fundamentals Technical Specification had much lower
support which is good because it would unnecessarily delay the process and there
is already plenty of experience using the proposed functionality implemented in
the open-source {fmt} library.

```
Send this to LFTS3
SF F N A SA
1  6 7 3 2
```

Here is a summary from the [Bugzilla issue](
https://issues.isocpp.org/show_bug.cgi?id=322) which tracks review comments and
votes:

> We will prioritize this for the IS - no paper needed, future review TBD.

Thanks to LEWG chair, Titus Winters, and all the group participants for their
support and guidance.

## Other news

### `string_view(nullptr)`

On Monday there was a long discussion in a joint EWG/LEWG session about similarly
trivial issue of whether to change `string_view(nullptr)` from undefined behavior
to constructing an empty `string_view`. The result was to keep the status quo
(UB).

### Ranges merge

A good progress was made on merging the Ranges Technical Specification (TS) as
well as reviewing the new paper [P1037 Deep Integration of the Ranges
TS](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p1037r0.pdf) which
proposed an elegant and concise solution to the problem of having two separate
set of iterator classes, one in `std` and one in `std::ranges`.

### Modules

On Tuesday Evolution Working Group discussed modules which are, in my opinion,
by far the most important missing feature in C++. The authors of two competing
proposals, the Modules TS and Another Take On Modules (aka ATOM), came up with
a merged proposal and it was decided to adopt the latter into the Modules TS.

### Stack trace library

A proposal to add stack trace library ([P0881R1](
http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0881r1.html)) by Alexey
Gorgurov and Antony Polukhin was unanimously approved by LEWG and sent to Library
Working Group for C++20.

### Class types in non-type template parameters

Class Types in Non-Type Template Parameters ([P0732R1](
http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0732r1.pdf)) by Jeff
Snyder and Louis Dionne made it into C++20! This is great news, because, as I
wrote in my [previous
post](http://www.zverovich.net/2018/03/17/text-formatting-jacksonville.html),
it will enable usable APIs that take compile-time strings and more.
