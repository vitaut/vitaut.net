---
layout: post
title: I can't believe it's not Python
date: 2012-12-17
---

{{ page.title }}
================

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
    <img border=
    "0" height="240" src=
    "/zverovich.net/img/python.png"
    title=
    "If it looks like Python and behaves like Python, then it probably is Python."
    width="240">
  </div>

I've been recently experimenting with a [new string formatting
library for C++](https://github.com/vitaut/format) and realized
that it can be used for converting objects to strings à la Python's
[str](http://docs.python.org/2/library/functions.html#str) function.
In fact it the implementation of such function is almost trivial:

{% highlight c++ %}
template <typename T>
std::string str(const T &value) {
  return (fmt::Format("{0}") << value).str();
}
{% endhighlight %}

See [this post](/2012/12/12/a-better-string-formatting-library-for-cplusplus.html)
to learn more about `fmt::Format`.

The `str` function, unlike `sprintf`, can work with any type that has
correspondent `std::ostream` inserter operator `<<`. For example:

{% highlight c++ %}
class Date {
  int year_, month_, day_;
 public:
  Date(int year, int month, int day) : year_(year), month_(month), day_(day) {}

  friend std::ostream &operator<<(std::ostream &os, const Date &d) {
    os << d.year_ << '-' << d.month_ << '-' << d.day_;
    return os;
  }
};

using fmt::str;
auto s = str(Date(2012, 12, 9));
// s == "2012-12-9"
{% endhighlight %}

The `str` function applies the default formatting for the type, so
if you want to have control over formatting you should use `Format` instead.

Being based on `Format`, `str` uses IOStreams only for user-defined types,
but not for built-in types which it handles
[much more efficiently](/2012/12/15/making-string-formatting-fast.html).
Additional performance improvement can be achieved by getting rid of the
format string and passing arguments to the formatter directly.
This requires minor changes to the library since this functionality is
currently private to the `Formatter` class.
