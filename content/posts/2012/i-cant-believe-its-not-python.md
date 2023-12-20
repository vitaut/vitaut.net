---
title: I can't believe it's not Python
date: 2012-12-17
aliases: ['/2012/12/17/i-cant-believe-its-not-python.html']
---

<div style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img src="/img/python.png"
       title="If it looks like Python and behaves like Python, then it probably is Python."
       width="240">
</div>

I've been recently experimenting with a [new string formatting
library for C++](https://github.com/cppformat/cppformat) and realized
that it can be used for converting objects to strings à la Python's
[str](http://docs.python.org/2/library/functions.html#str) function.
In fact the implementation of such function is almost trivial:

```c++
template <typename T>
std::string str(const T &value) {
  return fmt::format("{}", value);
}
```

See [this post](/2012/12/12/a-better-string-formatting-library-for-cplusplus.html)
to learn more about `fmt::format`.

The `str` function, unlike `sprintf`, can work with any type that has
appropriate `std::ostream` inserter operator `<<`. For example:

```c++
class Date {
  int year_, month_, day_;
 public:
  Date(int year, int month, int day)
  : year_(year), month_(month), day_(day) {}

  friend std::ostream &operator<<(std::ostream &os, const Date &d) {
    os << d.year_ << '-' << d.month_ << '-' << d.day_;
    return os;
  }
};

auto s = str(Date(2012, 12, 9));
// s == "2012-12-9"
```

The `str` function applies the default formatting for the type, so
if you want to have control over formatting you should use `format` instead.

Being based on `format`, `str` uses IOStreams only for user-defined types,
but not for built-in types which it handles
[much more efficiently](/2012/12/15/making-string-formatting-fast.html).
Additional performance improvement in `str` can be achieved by getting rid
of the format string and passing arguments to the formatter directly.
This requires minor changes to the library since this functionality is
currently private to the `Formatter` class.
