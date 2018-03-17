---
layout: post
title: Text Formatting at the ISO C++ standards meeting in Jacksonville
date: 2018-03-17
---

{{ page.title }}
================

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img border="0" src="/img/committee.jpeg" width="300"
       title="Design by committee">
</div>

This week I attended the ISO C++ standards committee meeting to present the
second revision of my paper [P0645R1 Text
Formatting](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0645r1.html),
based on the [{fmt} formatting library](https://github.com/fmtlib/fmt).
The first revision was reviewed by Library Evolution Working Group (LEWG) in
June 2017 in Toronto and there was a lot of feedback, particularly I've been
asked to

* investigate compile-time format string processing,
* look at using or explain why not to use an output iterator,
* use `string_view`,
* allow pre-computation of output size,
* add benchmarks.

It took me a while to address all the feedback, particularly the first two
items which required substantial API and implementation changes, so I had to
skip the meeting in Albuquerque. However, this ultimately resulted in a much
better API so I'm grateful to LEWG for the helpful guidance. Despite all the
negative press ~~covfefe~~ "design by committee" sometimes works surprisingly
well.

Results
-------

[P0645R1](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0645r1.html)
was reviewed on Wednesday and the main features of the proposal received strong
support from LEWG. Here are the [results of the polls](
https://issues.isocpp.org/show_bug.cgi?id=322):

{% highlight none %}
We like this format syntax (vs. printf syntax).
SF	F	N	A	SA
12	5	3	3	0
{% endhighlight %}

where "this" is the proposed Python-like syntax with '{' and '}' used as
replacement field delimiters in format strings. "SF", "F", "N", "A" and "SA"
stand for "Strongly in Favor", "in Favor", "Neutral", "Against" and "Strongly
Against" respectively.

{% highlight none %}
We like the user-extensibility of the format syntax.
SF	F	N	A	SA
11	7	4	0	1
{% endhighlight %}

Apart from the obvious consistency argument, a very strong argument in favor of
the second feature is that it can be beneficial for localization. For example,
it's easy to change date formatting even if you use some non-standard date type:

{% highlight c++ %}
auto s = format_translated("Oh dear! The deadline is on {:%m/%d/%Y}.", date);
{% endhighlight %}

and somewhere in a translation database

{% highlight none %}
en_US: "Oh dear! The deadline is on {:%m/%d/%Y}." # extracted from the source
en_UK: "Blimey! The deadline is on {:%d/%m/%Y}."  # go figure the date
{% endhighlight %}

There was a long discussion on how to make the iterator-based API safer and
avoid the pitfalls of `sprintf`. The outcome of this discussion and a
subsequent poll was to add a new API function, `format_to_n`, that takes an
iterator and a size which should be a relatively minor change.

{% highlight c++ %}
array<char, 10> buffer;
format_to_n(buffer.begin(), buffer.size(), "{}", 42);
{% endhighlight %}

Thanks to Eric Niebler for helping to defend the iterator-based API, the idea
of which he in fact proposed in Toronto. Iterators are a standard and
well-understood abstraction and they work fairly well both in the common case of
efficiently writing to contiguous memory (there was no performance regression
in {fmt} after adding iterator support) as well as more complex targets such as
`std::ostream` or `std::streambuf`.

In the future we could have even more convenient API with ranges.

There was a question of whether it is possible to check format strings for
user-defined types at compile-time. The design of the extension API allows this
and here's an example ([godbolt](https://godbolt.org/g/wQyU21)):

{% highlight c++ %}
#include <fmt/format.h>

struct S {};

namespace fmt {
template <>
struct formatter<S> {
  constexpr auto parse(parse_context& ctx) {
    auto it = ctx.begin();
    spec = *it;
    if (spec != 'd' && spec != 's')
      throw format_error("invalid specifier");
    ++it;
    return it;
  }

  template <typename FormatContext>
  auto format(S, FormatContext& ctx) {
    return spec == 's' ?
      format_to(ctx.begin(), "{}", "fourty-two") :
      format_to(ctx.begin(), "{}", 42);
  }

  char spec = 0;
};
}

int main() {
  std::string s = fmt::format(fmt("{:x}"), S());
}
{% endhighlight %}

This gives an intentional compile error due to an invalid format specifier:

{% highlight none %}
...
<source>:12:45: error: expression '<throw-expression>' is not a constant expression
       throw format_error("invalid specifier");
{% endhighlight %}

Changing the specifier from 'x' to one of the valid two ('d' or 's') fixes the
error ([godbolt](https://godbolt.org/g/9s4kNB)):

{% highlight c++ %}
std::string s = fmt::format(fmt("{:s}"), S());
{% endhighlight %}
 
Compile-time strings
--------------------

In the current standard to provide an API that takes a compile-time string, i.e.
a string that can be processed in the `constexpr` context, you need to use hacks
such as `constexpr` lambdas nicely described in Michael Park's post [`constexpr`
function parameters](
https://mpark.github.io/programming/2017/05/26/constexpr-function-parameters/).
For example, {fmt} provides the `fmt` macro (sigh) for constructing a
compile-time format string:

{% highlight c++ %}
s = fmt::format(fmt("{}"), 42);
{% endhighlight %}

where `fmt(s)` is roughly defined as follows:

{% highlight c++ %}
#define fmt(s) [] { \
    struct S : fmt::internal::format_string { \
      static constexpr auto data() { return s; } \
      static constexpr size_t size() { return sizeof(s); } \
    }; \
    return S{}; \
  }()
{% endhighlight %}

Obviously this is far from ideal. Fortunately, Louis Dionne proposed the paper
[P0424 Reconsidering literal operator templates for
strings](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2016/p0424r0.pdf)
which addressed exactly this use case and added literal operator template for
string literals, so that you could do something like

{% highlight c++ %}
s = format("{}"_fmt, 42);
{% endhighlight %}

P0424 was approved by Evolution Working Group in Albuquerque, but in
Jacksonville Jeff Snyder submitted [P0732 Class Types in Non-Type Template
Parameters](http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2018/p0732r0.pdf)
which provided a more general way of addressing the same use cases.
As the name suggests with P0732 you can use strings (and more) as template
parameters:

{% highlight c++ %}
s = format(fmt<"{}">(), 42);
{% endhighlight %}

This is a great feature and according to Bjarne Stroustrup the intent was to
have this functionality from the very beginning but it was not clear how to
implement it at the time.

After a few delays P0732 was finally reviewed by EWG on Thursday. It was
unanimously approved and sent to Core Working Group to review the wording.
In an interesting twist, P0424 was pulled out of Core, but EWG voted for the
user-defined literal part of it, which will now have to be based on top of P0732.

Once the two papers are accepted it will be possible to provide different APIs
taking compile-time string:

{% highlight c++ %}
s = format<"{}">(42);
s = format(fmt<"{}">, 42);
s = "{}"_format(42);
{% endhighlight %}

I hope that there will be an even more intuitive way to express `constexpr`
parameters, but P0732 and P0424 make a huge step in the right direction.

What's next?
------------

I plan to address the LEWG's feedback, improve the wording, and present a new
revision of P0645 Text Formatting at one of the forthcoming meetings. Help in
reviewing and/or improving the wording of the paper will be greatly appreciated
and acknowledged.
