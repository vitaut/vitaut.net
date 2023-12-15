---
title: std::format in C++20
date: 2019-07-23
aliases: ['/2019/07/23/std-format-cpp20.html']
---

<script type="text/javascript" src="http://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS-MML_HTMLorMML"></script>

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
<a href="/img/standardization.png">
  <img border="0" src="/img/standardization.png" width="400"
       title="Path of standardization">
</a>
</div>

I'm happy to announce that the [Text Formatting proposal (`std::format`)](
https://fmt.dev/Text%20Formatting.html) made it into the C++20 Committee
Draft at the Cologne meeting, just in time before the feature freeze. This
concludes a three-year long design, implementation, and standardization effort.

Here's a brief history of the proposal aka "what took you so long?":

2016-08-17:
  - [posted on Reddit](https://www.reddit.com/r/cpp/comments/4y5zxf/formatting_functionality_in_the_standard_library/)
    floating the proposal idea

2016-08-27:
  - committed the [initial proposal draft on GitHub](https://github.com/fmtlib/fmtlib.github.io/blob/3c85511ca2665eed0e54cb598dd70b70e236ec0f/Text%20Formatting.html)

2017-07-10 to 15, Toronto, Canada:
  - presented revision 0 (R0 - as all sensible people we use zero-based revision
    numbers) of the proposal which received a positive feedback
  - was asked for compile-time processing of format strings, output
    iterator support, precomputing output size, and benchmark results
    (as you can see the committee loves to make you do more work - all of these
    features took months to design, implement, and turn into the paper form
    since I was working in my spare time, so I skipped one meeting)

2018-03-12 to 17, Jacksonville, USA:
  - presented R1
  - [Python-like syntax](https://fmt.dev/Text%20Formatting.html#Syntax) was
    approved (`{}` instead of `%`)
  - [user extensibility of syntax](https://fmt.dev/Text%20Formatting.html#Extensibility)
    was approved (important for date, time, and other nontrivial formatting,
    e.g. `format("{0:%Y-%m-%d}", t)`)
  - was asked for a function that formats to a sized range (`format_to_n`)

2018-06-04 to 09, Rapperswil, Switzerland:
  - presented R2
  - leaving the Unicode support for a separate paper was approved (😌 Relieved
    Face)
  - nested namespace was dropped (`std::format` instead of `std::fmt::format` or
    similar)
  - the proposal was prioritized for the International Standard as opposed to
    going to the [Library Fundamentals Technical Specification](
    https://github.com/cplusplus/fundamentals-ts)
  - was asked to make the default floating-point format round trip

2018-11-05 to 10, San Diego, USA:
  - presented R4 (R3 was in the [post-Rapperswil mailing](
    http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/#mailing2018-06))
  - [type-erased API](https://fmt.dev/Text%20Formatting.html#Footprint) was
    approved (`std::vformat` that doesn't depend on argument types and gives you
    compact per-call binary code)
  - [specialization-based extension API](
    https://fmt.dev/Text%20Formatting.html#Extensibility) was approved
    (`std::formatter<T>`)
  - using the shortest correctly rounded decimal representation as the default
    floating-point format (expressed in terms of `std::to_chars`) was approved
  - the proposal was forwarded to the Library Working Group (LWG) for the
    wording (the text that goes into the standard) review
  - the wording was reviewed by LWG for the first time during its Saturday
    "zombie" session

2019-02-18 to 23, Kona, USA:
  - presented R5
  - obscure but important API improvements were approved 
  - forwarded back to LWG for C++20
  - survived extensive wording reviews of R7 (where did R6 go?) via multiple
    teleconferences after the meeting

2019-07-15 to 20, Cologne, Germany:
  - presented R9 (here I was told to stop bumping revisions between
    mailings, oops)
  - wording review and approval of the final revision
    [R10](https://fmt.dev/Text%20Formatting.html) that will be in the
    post-Cologne mailing

Contrary to the usual "design-by-committee" narrative, the standardization
process was tremendously beneficial both for the proposal and [the {fmt}
library](https://github.com/fmtlib/fmt), resulting in numerous improvements and
here are just a few examples:

* **Iterator support**

   The addition of iterator-based `std::format_to` and `std::format_to_n` functions
   makes formatting to arbitrary output targets such as arrays or containers
   as easy and natural as calling `std::copy` or `std::copy_n`:

   ```c++
   std::vector<char> buf;
   std::format_to(std::back_inserter(buf), "{}", 42);
   // buf contains "42"
   ```

   or 

   ```c++
   char buf[10];
   auto result = std::format_to_n(buf, sizeof(buf), "{}", 42);
   // buf contains "42" and result.out points to the end of the output.
   // No dynamic memory allocations.
   ```

* **Precomputing the output size**

   As the name suggests, `formatted_size` gives you the output size which
   could be useful for preallocating a buffer:

   ```c++
   auto size = std::formatted_size("{}", 42); // size == 2
   std::vector<char> buf(size);
   std::format_to(buf.data(), "{}", 42);
   ```

* **Compile-time processing of format string**

   Although not exposed through the top-level API yet, the design and the
   extension API fully support `constexpr` format string parsing which also
   applies to user-defined types. This required separation of parser and
   formatter contexts that hold parsing and formatting state respectively and
   generally resulted in a cleaner API:

   ```c++
   struct std::formatter<MyType> {
      constexpr auto parse(parse_context& ctx) {
        // Parses the format string range [ctx.begin(), ctx.end()).
        // Can be omitted if inherited from another formatter.
      }

      auto format(const MyType& value, format_context& ctx) {
        // Formats value and writes into ctx.out().
        // Can be delegated to another formatter.
      }
   };
   ```
   
   This will allow compile-time format string checks and even translating your
   format strings into formatter objects and eliminating any runtime overhead
   (which is usually pretty small though).

* **Default representation of floating-point numbers**

   Building upon C++17's [`std::to_chars`](
   https://en.cppreference.com/w/cpp/utility/to_chars) and following the example
   of Python 3's `str.format`, `std::format` provides the shortest
   correctly-rounded floating point representation as the default. In particular
   this means, that unlike with `printf`, there is no precision loss:

   ```c++
   auto s = std::format("{}", M_PI); // s == "3.141592653589793"
   char buf[20];
   sprintf(buf, "%g", M_PI);         // buf contains "3.14159"
   ```

In addition to the P0645 Text Formatting there were several other formatting
papers approved at Cologne:

1. [P1361 Integration of chrono with text formatting](
   https://github.com/vitaut/wg21/blob/master/generated/D1361R2.pdf) written in
   collaboration with Daniela Engert and Howard E. Hinnant. This paper makes it
   possible to format all chrono types with `std::format` and removes now
   redundant `std::chrono::format`. Among other things, formatting multiple
   objects in one go becomes much easier:

   ```c++
   void print_birthday(std::string_view name,
                       const std::chrono::year_month_day& birthday) {
     std::cout << std::format("{0}'s birthday is {1:%Y-%m-%d}.\n", name, birthday);
   }
   ```

   and you can avoid dynamic memory allocations:

   ```c++
   std::array<char, 100> buf;
   std::format_to_n(buf.data(), buf.size(), "{:%Y-%m-%d}", date);
   ```

2. [P1652 Printf corner cases in `std::format`](
   http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p1652r0.html)
   written by Zhihao Yuan. This paper contains a number of critical bug fixes
   for P0645 Text Formatting. For example, it makes formatting of `float`
   round trip (previously `float` was converted to `double` as in `printf`):

   ```c++
   std::string s = std::format("{}", 3.31f); // s == "3.31"
   ```
   Without the fix `s` would contain "3.309999942779541".

3. [P1636 Formatters for library types](https://wg21.link/p1636r0) by
   Lars Gullik Bjønnes. This paper makes a number of standard library types
   such as `std::complex` and `std::filesystem::path` formattable with
   `std::format`, e.g.

   ```c++
   auto s = std::format("{}", 1 + 2i); // s == (1, 2)
   ```
   
   It was approved by the Library Evolution Working Group
   that deals with the design and API, but there was no wording review yet.

## Acknowledgements

Thanks to Alberto Barbati, Antony Polukhin, Beman Dawes, Bengt Gustafsson,
Daniel Krügler, Daniela Engert, Eric Niebler, Jason McKesson, Jeffrey Yasskin,
Joël Lamotte, Lars Gullik Bjønnes, Lee Howes, Louis Dionne, Marshall Clow,
Matt Clarke, Michael Park, Sean Middleditch, Sergey Ignatchenko,
Thiago Macieira, Titus Winters, Tomasz Kamiński, Zach Laine, Zhihao Yuan,
participants of
the Library Evolution Working Group and the Library Working Group for their
feedback, support, constructive criticism and contributions to
the proposal. Special thanks to Howard E. Hinnant who encouraged me to write the
proposal and gave useful early advice on how to go about it.

Also thanks to my current and past managers at Facebook for supporting my
standardization work and the company for paying for my trips to standards
committee meetings.

And last but not least thanks to the many [contributors to the {fmt} library](
https://github.com/fmtlib/fmt/graphs/contributors) for their work.

## What's next?

P0645 has built the foundation for modern, efficient, and extensible text
formatting. However, due to time constraints it left unanswered a number of
questions that will be addressed by future proposals:

* **Compile-time format strings**: as mentioned earlier, the extension API is
  `constexpr`-ready but we need a convenient top-level API to make use of it.

* **Formatted I/O**: it would be nice to have a better integration between
  formatting and I/O than just passing strings around as in

  ```c++
  std::cout << std::format("The answer is {}.", 42);
  ```

## FAQ

**Q**: I want to use this now, not wait until C++20 is available and `std::format`
is implemented in my standard library. What should I do?

**A**: All of this and much more has been implemented in [the {fmt} library](
https://github.com/fmtlib/fmt) which works on pretty much anything that
considers itself a C++ compiler.