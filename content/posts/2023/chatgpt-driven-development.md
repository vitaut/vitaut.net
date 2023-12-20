---
title: ChatGPT-driven development
date: 2023-12-14
aliases: ['/2023/12/14/chatgpt-driven-development.html']
---

![](/img/chatgpt.jpg#floatright
"Computers are useless. They can only give answers - Pablo Picasso")

In the vast, often inexplicable universe of C++ programming, I found myself
staring into the digital abyss of a peculiar problem: how does one effectively
compare `format_as` with the venerable `formatter` specialization? This
question was as intriguing as it was esoteric, much like pondering the number
of Vogon ships in the Galactic Fleet. But fear not, for my quest was not
solitary. I had a companion, an AI of improbable intelligence and wit: ChatGPT.

(As you might have guessed I got some help from ChatGPT in writing a catchy
introductory paragraph as well.)

First, some background: [the open-source {fmt} library][1] provides two
extension APIs to make a type formattable.

[1]: https://github.com/fmtlib/fmt

Let's say you want to make the following enum formattable as the underlying type
(`int`) with `fmt::format`:

```c++
enum class mode {read = 1, write = 2};

std::string s = fmt::format("{}", mode::read);
// s == "1"
```

To do this you can either provide a `formatter` specialization

```c++
template <> struct fmt::formatter<mode>: formatter<int> {
  auto fmt::formatter<mode>::format(mode m, format_context& ctx) const {
    return formatter<int>::format(std::to_underlying(m), ctx);
  }
};
```

or a `format_as` function:

```c++
auto format_as(mode m) { return std::to_underlying(m); }
```

Obviously the latter is much simpiler but I was wondering what is the
performance difference between the two, if any.

Enter ChatGPT 4. I approached this AI with my query

> Write a google benchmark comparing performance of format_as and
> formatter specialization

half-expecting generic responses. To my surprise, ChatGPT did a pretty good job
at this task. The initial solution that it came up with was:

```c++
#include <benchmark/benchmark.h>
#include <fmt/format.h>

// Define a simple struct or enum
enum class Color { Red, Green, Blue };

// Define formatter specialization for Color
template <>
struct fmt::formatter<Color> {
    template <typename FormatContext>
    auto format(Color c, FormatContext& ctx) {
        std::string name;
        switch (c) {
            case Color::Red:   name = "Red"; break;
            case Color::Green: name = "Green"; break;
            case Color::Blue:  name = "Blue"; break;
        }
        return fmt::format_to(ctx.out(), "{}", name);
    }
};

// Define format_as for Color
constexpr auto format_as(const Color& color) -> std::string {
    switch (color) {
        case Color::Red:   return "Red";
        case Color::Green: return "Green";
        case Color::Blue:  return "Blue";
        default:           return "Unknown";
    }
}

// Benchmark for formatter specialization
static void BM_FormatterSpecialization(benchmark::State& state) {
    Color color = Color::Red; // or cycle through enum values
    for (auto _ : state) {
        std::string formatted = fmt::format("{}", color);
        benchmark::DoNotOptimize(formatted);
    }
}
BENCHMARK(BM_FormatterSpecialization);

// Benchmark for format_as
static void BM_FormatAs(benchmark::State& state) {
    Color color = Color::Red; // or cycle through enum values
    for (auto _ : state) {
        std::string formatted = fmt::format("{}", color);
        benchmark::DoNotOptimize(formatted);
    }
}
BENCHMARK(BM_FormatAs);

BENCHMARK_MAIN();
```

It had the correct structure but wouldn't compile because of a conflict which I
explained in my feedback:

> This won't compile because format_as and formatter specialization
> conflict with each other. To fix this introduce two enums with different names
> but otherwise identical, one for format_as, another for the formatter
> specialization.

Amazingly, ChatGPT had no problem in fixing this issue:

```c++
#include <benchmark/benchmark.h>
#include <fmt/format.h>

// Define two identical enums with different names
enum class ColorWithFormatAs { Red, Green, Blue };
enum class ColorWithFormatter { Red, Green, Blue };

// Define formatter specialization for ColorWithFormatter
template <>
struct fmt::formatter<ColorWithFormatter> {
    template <typename FormatContext>
    auto format(ColorWithFormatter c, FormatContext& ctx) {
        std::string name;
        switch (c) {
            case ColorWithFormatter::Red:   name = "Red"; break;
            case ColorWithFormatter::Green: name = "Green"; break;
            case ColorWithFormatter::Blue:  name = "Blue"; break;
        }
        return fmt::format_to(ctx.out(), "{}", name);
    }
};

// Define format_as for ColorWithFormatAs
constexpr auto format_as(const ColorWithFormatAs& color) -> std::string {
    switch (color) {
        case ColorWithFormatAs::Red:   return "Red";
        case ColorWithFormatAs::Green: return "Green";
        case ColorWithFormatAs::Blue:  return "Blue";
        default:                       return "Unknown";
    }
}

// Benchmark for formatter specialization
static void BM_FormatterSpecialization(benchmark::State& state) {
    ColorWithFormatter color = ColorWithFormatter::Red; // or cycle through enum values
    for (auto _ : state) {
        std::string formatted = fmt::format("{}", color);
        benchmark::DoNotOptimize(formatted);
    }
}
BENCHMARK(BM_FormatterSpecialization);

// Benchmark for format_as
static void BM_FormatAs(benchmark::State& state) {
    ColorWithFormatAs color = ColorWithFormatAs::Red; // or cycle through enum values
    for (auto _ : state) {
        std::string formatted = fmt::format("{}", color);
        benchmark::DoNotOptimize(formatted);
    }
}
BENCHMARK(BM_FormatAs);

BENCHMARK_MAIN();
```

However, the `formatter` specialization wasn't quite right (missing `parse`) and
also I wanted it to compare enums formatted as underlying types, not as strings.
To be fair I didn't specify this in my original prompt. After three more
iterations ChatGPT produced a usable result:

```c++
#include <benchmark/benchmark.h>
#include <fmt/format.h>

// Define two identical enums with different names for separate formatting methods
enum class NumericEnumForFormatAs { One = 1, Two, Three };
enum class NumericEnumForFormatter { One = 1, Two, Three };

// Define formatter specialization for NumericEnumForFormatter to format as an integer
template <>
struct fmt::formatter<NumericEnumForFormatter> : fmt::formatter<int> {
    auto format(NumericEnumForFormatter e, fmt::format_context& ctx) {
        return fmt::formatter<int>::format(static_cast<int>(e), ctx);
    }
};

// Define format_as for NumericEnumForFormatAs to format as an integer
constexpr auto format_as(const NumericEnumForFormatAs& e) -> int {
    return static_cast<int>(e);
}

// Benchmark for formatter specialization
static void BM_FormatterSpecialization(benchmark::State& state) {
    NumericEnumForFormatter e = NumericEnumForFormatter::Two; // or cycle through enum values
    for (auto _ : state) {
        std::string formatted = fmt::format("{}", e);
        benchmark::DoNotOptimize(formatted);
    }
}
BENCHMARK(BM_FormatterSpecialization);

// Benchmark for format_as
static void BM_FormatAs(benchmark::State& state) {
    NumericEnumForFormatAs e = NumericEnumForFormatAs::Two; // or cycle through enum values
    for (auto _ : state) {
        std::string formatted = fmt::format("{}", e);
        benchmark::DoNotOptimize(formatted);
    }
}
BENCHMARK(BM_FormatAs);

BENCHMARK_MAIN();
```

There is still room for improvement but it's a reasonable start and only
required 5 iterations in total. Interestingly, it completely forgot about the
conflict issue when switching from strings to integers so I had to remind it.

Running the benchmark confirmed the hypothesis that `format_as` is faster:

```
---------------------------------------------------------------------
Benchmark                           Time             CPU   Iterations
---------------------------------------------------------------------
BM_FormatterSpecialization       18.2 ns         18.1 ns     37152426
BM_FormatAs                      9.47 ns         9.46 ns     73865375
```

**Conclusion**

ChatGPT can save you some time when dealing with programming tasks that require
fair amount of boilerplate like setting up a benchmark. However, to get decent
results you still need to understand the nuances of the APIs and provide a lot
of guidance. Otherwise you will likely get something that looks reasonable but
is subtly wrong. If you are lucky it will be wrong enough to not compile like
the first benchmark produced by ChatGPT here. But overall being able to
meaningfullly iterate on a piece of code by conversing with an AI is an
impressive feat of technology.
