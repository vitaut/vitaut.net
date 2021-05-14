---
layout: post
title: Compile-time format string checks
date: 2017-11-05
---

{{ page.title }}
================

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img border="0" src="/img/compiling.png" width="300"
       title="Now even more time to slack off"><br>
  <a href="https://xkcd.com/303/">https://xkcd.com/303/</a>
</div>

**Note**: the API described in this post is outdated, please use the one
documented in [Format string compilation](
https://fmt.dev/latest/api.html#compile-api) instead.

Compile-time validation of format strings in various forms is one of the most
requested features in the [fmt project](https://github.com/fmtlib/fmt) on GitHub
([#62](https://github.com/fmtlib/fmt/issues/62),
[#166](https://github.com/fmtlib/fmt/issues/166),
[#295](https://github.com/fmtlib/fmt/issues/295),
[#467](https://github.com/fmtlib/fmt/issues/467),
[#492](https://github.com/fmtlib/fmt/issues/492),
[#544](https://github.com/fmtlib/fmt/issues/544),
[#546](https://github.com/fmtlib/fmt/issues/546)) and a major request
from the C++ standards committee after the review of my [formatting paper](
http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0645r0.html).
In 2015 I came up with an [unsatisfactory solution](
http://zverovich.net/2015/04/22/compile-time-checking-of-printf-args-in-cppformat.html)
to this problem that only worked with printf syntax and involved macros.
But inspired by recent progress in `constexpr` support in modern compilers and the
work of various people, most importantly, Michael Park's cool
[MPark.Format](https://github.com/mpark/format) project
as well as Ben Deane & Jason Turner's illuminating talk
["`constexpr` ALL the Things!"](https://www.youtube.com/watch?v=PJwd4JLYJJY),
I decided to give it another go.

After some struggling with compilers and their various degrees of
`constexpr`-readiness, I am finally happy to announce that the
[std branch of the fmt library](https://github.com/fmtlib/fmt/tree/std) now
implements compile-time format string checks!

First, let's take a look at a simple example (`test.cc`):

{% highlight c++ %}
#include <fmt/format.h>

int main() {
  using namespace fmt::literals;
  std::string s = "{2}"_format(42);
}
{% endhighlight %}

and try compiling it:

{% highlight text %}
$ g++ -Iinclude test.cc -std=c++14
In file included from test.cc:1:
include/fmt/format.h:3857:20: error: constexpr variable 'invalid_format' must be initialized by a constant expression
    constexpr bool invalid_format = check_format<Args...>(s);
                   ^                ~~~~~~~~~~~~~~~~~~~~~~~~
test.cc:5:31: note: in instantiation of function template specialization 'fmt::internal::udl_formatter<char, '{', '2', '}'>::operator()<int>' requested here
  std::string s = "{2}"_format(42);
                              ^
include/fmt/format.h:3838:7: note: non-constexpr function 'on_error' cannot be used in a constant expression
      on_error("argument index out of range");
      ^
...
{% endhighlight %}

The first part of the error about initialization of `invalid_format` variable is
pretty generic and not very useful, but then we get the exact cause of the
error:

{% highlight text %}
on_error("argument index out of range");
{% endhighlight %}

because we passed 2 as the argument index while provided only 1 argument. Also
we get the error location:

{% highlight text %}
test.cc:5:31: note: in instantiation of function template specialization 'fmt::internal::udl_formatter<char, '{', '2', '}'>::operator()<int>' requested here
  std::string s = "{2}"_format(42);
                              ^
{% endhighlight %}

So we have all we need to quickly navigate to the problematic line and fix it:

{% highlight c++ %}
std::string s = "{0}"_format(42);
{% endhighlight %}

OK, this is nice but we've [seen it before](https://github.com/mpark/format).
What's so special about the new implementation?

First, the format string parsing code is the same between runtime and
compile time. The code is super readable and doesn't have any recursive
templates or value-encoded types that were often needed to [workaround lack of
proper `constexpr` function parameters](
https://mpark.github.io/programming/2017/05/26/constexpr-function-parameters/):

{% highlight c++ %}
template <typename Iterator, typename Handler>
constexpr void parse_format_string(Iterator it, Handler &&handler) {
  using char_type = typename std::iterator_traits<Iterator>::value_type;
  auto start = it;
  while (*it) {
    char_type ch = *it++;
    if (ch != '{' && ch != '}') continue;
    if (*it == ch) {
      handler.on_text(start, it);
      start = ++it;
      continue;
    }
    if (ch == '}') {
      handler.on_error("unmatched '}' in format string");
      return;
    }
    handler.on_text(start, it - 1);
    // parse format specs
    start = ++it;
  }
  handler.on_text(start, it);
}
{% endhighlight %}

Second, [full Python-esque format string syntax](http://fmtlib.net/latest/syntax.html)
is supported and not just some basic subset of it. Argument types are taken into
account as well, for example

{% highlight c++ %}
"{:010.2}"_format(42);
{% endhighlight %}

will give you an error because precision (`.2`) is not allowed for integral
types. At the same time

{% highlight c++ %}
"{:010.2}"_format(4.2);
{% endhighlight %}

will pass the checks because `4.2` is a floating-point number and can be
formatted with precision.

And last, but not least, this functionality is available for user-defined types,
so if a user-provided format spec parsing function is `constexpr`, compile-time
checks will Just Work (tm) for it as well:

{% highlight c++ %}
// Checked at compile time provided that formatter<Date>::parse is constexpr.
"{:YYYY-mm-dd}"_format(Date(2012, 12, 9));
{% endhighlight %}

To the best of my knowledge [fmt](https://github.com/fmtlib/fmt) is the first
C++ formatting library with this capability (but correct me if I'm wrong in the
comments below). I'll cover support for user-defined types in more details in a
separate post since it's a big topic on its own.

This functionality is still experimental and, although parsing is fully
implemented, some errors are not reported yet which will be addressed shortly.
The compile-time checks work on GCC and Clang only, because they require
user-defined literal templates which is a GCC extension. The code is compatible
with Visual C++ but gracefully degrades with compile-time checks replaced with
runtime ones.

This is not the end though. Compile-time parsing of format strings can be used
not just for checks but, as [pointed out by Louis Dionne](
https://github.com/fmtlib/fmt/issues/546#issuecomment-337450603), the author
of the famous [Boost.Hana](https://github.com/boostorg/hana) library, also to generate
optimal formatting code. This will make the separate [write API](
http://fmtlib.net/latest/api.html#write-api) unnecessary and make fmt even
easier to use.

Thanks to the C++ Library Evolution Working Group members for encouraging me
working on this. Special thanks to Zach Laine for the initial feedback and
providing a code example of constexpr compile-time parsing.
