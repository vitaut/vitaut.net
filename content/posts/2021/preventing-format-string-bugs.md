---
title: iOS SSID format string bug is preventable
date: 2021-06-22
aliases: ['/2021/06/22/preventing-format-string-bugs.html']
---

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em; width: 40%">
<blockquote class="twitter-tweet"><p lang="en" dir="ltr">After joining my personal WiFi with the SSID “%p%s%s%s%s%n”, my iPhone permanently disabled it’s WiFi functionality. Neither rebooting nor changing SSID fixes it :~)</p>&mdash; Carl Schou (@vm_call) <a href="https://twitter.com/vm_call/status/1405937492642123782?ref_src=twsrc%5Etfw">June 18, 2021</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>
</div>

The SSID format string bug in iOS WiFi service has been making rounds on social
media.
[This blog post](https://blog.chichou.me/2021/06/20/quick-analysis-wifid/)
nicely pinpoints the root cause to concatenating the SSID with a string
and passing the result to a logging method that uses it as a format string.
Let's see how modern APIs like the ones of [the {fmt} formatting library](
https://github.com/fmtlib/fmt) and [C++20 `std::format`](
ttps://en.cppreference.com/w/cpp/utility/format/format) can prevent this.

First, let's adapt the problematic SSID `"%p%s%s%s%s%n"` to the format string
syntax used by {fmt} which is based on [Python's format](
https://docs.python.org/3/library/string.html#format-string-syntax).
The `%n` specifier where
`n` stands for "notorious" is intentionally unsupported but it's irrelevant
because the crash occurs when processing one of the `%s` specifiers. Other than
that the translation is pretty straightforward: `"{:p}{:s}{:s}{:s}{:s}"`.
Note that all of these specifiers can be omitted (`"{}{}{}{}{}"`) as they
are equivalent to the defaults.

There are two problems in the original issue. The first one is that external
data is passed as a format string. This is easily solved with compile-time
format string validation, for example

```c++
std::string ssid = "{:p}{:s}{:s}{:s}{:s}";
fmt::print("SSID: " + ssid);
```

won't even compile in C++20 ([godbolot](https://godbolt.org/z/fEco8Yhas))
because the format string is not known at compile time.

To trigger the bug one would have to explicitly circumvent the compile-time
checks by opting into runtime ones (or using an older compiler):

```c++
std::string ssid = "{:p}{:s}{:s}{:s}{:s}";
fmt::print(fmt::runtime("SSID: " + ssid));
```

but even this will only throw an exception since the replacement fields like
`{:p}` or `{:s}` don't have corresponding arguments.

This brings us to the second problem: `WFLog:message:` doesn't validate the
format string which results in a crash. This is terrible even if you only pass
trusted data to formatting functions because people are bad at testing logging
and error paths where format string bugs often creep in. As I wrote in my
[previous post](https://www.zverovich.net/2021/06/16/safe-formatting-api.html),
formatting APIs in pretty much all programming languages do such validation
nowadays with C being a notable exception.

Conclusion: format string bugs are easily preventable and the main reason we
still see issues like the one in iOS WiFi service in 2021 is legacy code.
Both {fmt} and C++20 `std::format` eliminate this class of bugs via a
combination of compile-time checks enabled by default and runtime validation.
