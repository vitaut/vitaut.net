---
title: Format API improvements
date: 2017-08-20
aliases: ['/2017/08/20/format-api-improvements.html']
---

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img src="/img/untangle.jpg" width="300" title="Untangling the API">
</div>

It's been a while since my last post. Two important things happened
in the meantime to the [fmt project](https://github.com/fmtlib/fmt):
[revision 0 of the formatting paper](
http://www.open-std.org/jtc1/sc22/wg21/docs/papers/2017/p0645r0.html)
has been submitted to the standards committee and [version 4 of the library
released](https://github.com/fmtlib/fmt/releases/tag/4.0.0) (thanks to
[Jonathan Müller](https://github.com/foonathan) for putting the new release
together). In this post I will describe the recent work in the
[std branch](https://github.com/fmtlib/fmt/tree/std) of the library that is an
implementation of the standards proposal.

## `string_view` support

Methods now take format string as a [`string_view`](http://en.cppreference.com/w/cpp/string/basic_string_view)
instead of a null-terminated string (that used to be wrapped in a now extinct
`cstring_view`):

```c++
template <typename... Args>
std::string format(string_view format_str, const Args&... args) {
```

This was one of the most frequent pieces of feedback to the proposal, see, for
example, this discussion on [std-proposals](
https://groups.google.com/a/isocpp.org/d/msg/std-proposals/4wOU-1_3D0A/hivSTcSaCAAJ).
Surprisingly noone ever mentioned it as a library feature. For compatibility
reasons the library provides it's own implementation of `basic_string_view`,
that will eventually be replaced with the standard one.

Seemingly simple, switching to `string_view` showed that parsing is way easier
when using sentinels (duh) which I ended up doing by introducing a new iterator
type that simulates having a sentinel at the end of the input.

This change also added a small overhead on the call site due to passing of the
size in addition to the string pointer but the performance impact was
negligible according to preliminary benchmarks.

## Separation of parsing and formatting

A more important change that required a lot of refactoring was separation of
parsing and formatting in the extension API. It is in part based on
[one of the many suggestions by Bengt Gustafsson](
https://groups.google.com/a/isocpp.org/d/msg/std-proposals/4wOU-1_3D0A/xiNQSmO1CAAJ)
in the std-proposals mailing list and related to the idea of precompilation of a
format string which is hardly new.

First, what is the extension API I'm talking about? It's the interface that
allows you to add formatting support for your types or, rather, objects of these
types. For example, in iostreams you define an `operator<<` for this purpose:

```c++
std::ostream& operator<<(std::ostream& os, const MyType& value) {
  // Format value into os.
  return os;
}
```

In addition to formatting, the fmt library gives you control over parsing of
format specs. In the current proposal it is done via the `format_value`
extension point:

```c++
void format_value(buffer& buf, const MyType& value, context& ctx) {
  // Parse format string provided by ctx and format value into buf.
}
```

where `buf` is an output buffer and `ctx` is a formatting context that provides
access to the current position in the format string and other arguments. The
latter is necessary for implementing features like dynamic width and precision.

While simple, this approach mixes parsing and formatting which is not always
desirable. [The new approach](
https://github.com/fmtlib/fmt/commit/5e0562ab51f1d5fd75ed7e38aa47524bb23b4df4)
separates the two concerns and replaces `format_value` with the `formatter`
struct as an extension point:

```c++
template <>
struct formatter<MyType> {
  const char* parse(std::string_view format) {
    // Parse format specifiers, store them in the current formatter object
    // and return a pointer past the end of the parsed range.
  }

  void format(buffer& buf, const MyType& value, context& ctx) {
    // Format value using the format specifiers parsed earlier.
  }
};
```

This is still experimental and will likely require more work but it already
allows interesting use cases that weren't possible before, such as
precompilation of a format string when formatting a sequence of values:

```c++
namespace fmt {
template <typename T>
struct formatter<std::vector<T>> : formatter<T> {
  void format(buffer& buf, const std::vector<T>& values, context& ctx) {
    buf.push_back('{');
    auto it = values.begin(), end = values.end();
    if (it != end) {
      formatter<T>::format(buf, *it, ctx);
      for (++it; it != end; ++it) {
        format_to(buf, ", ");
        formatter<T>::format(buf, *it, ctx);
      }
    }
    buf.push_back('}');
  }
};
}

std::vector<int> v{11, 22, 33};
auto str = fmt::format("{:04}", v);
// str == "{0011, 0022, 0033}"
```

Note that there is no `parse` method in the above example because it's inherited
from the base class, `formatter<T>`. Moreover, the format specifiers are parsed
once and reused when formatting each element.

Moving parsing to a separate method also opens the possibility of compile-time
format string checks, but that's a topic for another blog post.
