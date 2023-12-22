---
title: A better string formatting library for C++
date: 2012-12-12
aliases: ['/2012/12/12/a-better-string-formatting-library-for-cplusplus.html']
---

![](http://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Calabi-Yau-alternate.png/240px-Calabi-Yau-alternate.png#floatright
"Artist's impression of the state of string formatting in C++.")

When I started learning C++ I kind of liked the [IOStreams][1] library. It was
safe, [extensible][2] and could work with user-defined types. This compared
favorably with the `printf` family of functions. However, as I started using
C++ more and more in my daily job I found out that IOStreams had serious flaws.
[This answer](http://stackoverflow.com/a/3176640/471164) on Stack Overflow
nicely summarizes several issues with IOStreams:

- Poor error handling
- Poor separation between formatting and I/O
- Poor support for i18n

[1]: http://en.wikipedia.org/wiki/Input/output_(C%2B%2B)
[2]: http://www.boost.org/doc/libs/1_37_0/libs/iostreams/doc/index.html

The popular [Google C++ Style
Guide](http://google-styleguide.googlecode.com/svn/trunk/cppguide.xml)
even restricts the use of streams only to logging.

So I started looking for a better solution and discovered the following
libraries: [Boost
Format](http://www.boost.org/doc/libs/1_52_0/libs/format/),
[SafeFormat](http://loki-lib.sourceforge.net/html/a00666.html),
[FastFormat](http://fastformat.sourceforge.net/) and
[tinyformat](https://github.com/c42f/tinyformat). Unfortunately neither
of these entirely satisfied my needs so a few days ago when I was
staying at home with cold I wrote [a new formatting
library](https://github.com/cppformat/cppformat) which is small, type
safe and close to `printf` in speed. In this and forthcoming posts I am
going to describe its features and how this library compares to others.

APIs of formatting libraries can be divided into two groups. The first
group uses functions with variable number of arguments. It includes
`printf` and friends, Fast Format and tinyformat. Here is an example
using `printf`:

```c++
printf("%s, %s %d\n", weekday, month, day);
```

One way to implement this kind of API is to use
[varargs](http://en.wikipedia.org/wiki/Stdarg.h). This method is
inherently unsafe because the type information is not available to the
callee and it has to use some other mechanism such as a type field in a
format string like `printf` does. Another possibility is to use
[variadic templates](http://en.wikipedia.org/wiki/Variadic_template)
which unfortunately only available in C++11. For C++98 compatibility
some libraries like tinyformat provide multiple versions of the same
function with different number of arguments. The problem with this
method is that it is difficult to define your own function that wraps a
formatting function. Tinyformat provides a macro
[TINYFORMAT_WRAP_FORMAT](https://github.com/c42f/tinyformat#wrapping-tfmformat-inside-a-user-defined-format-function)
for this purpose which is used as follows:

```c++
#undef TINYFORMAT_WRAP_FORMAT_EXTRA_ARGS
#define TINYFORMAT_WRAP_FORMAT_EXTRA_ARGS int code,
TINYFORMAT_WRAP_FORMAT(
  void,                                        /* return type */
  error,                                       /* function name */
  /*empty*/,                                   /* function declaration
                                                  suffix (eg, const) */
  std::cerr << "error (code " << code << ")";, /* stuff before
                                                  format()*/
  std::cerr,                                   /* stream name */
  /*empty*/                                    /* stuff after
                                                  format() */
  )
#undef TINYFORMAT_WRAP_FORMAT_EXTRA_ARGS
#define TINYFORMAT_WRAP_FORMAT_EXTRA_ARGS
```

This is obviously far from ideal so I rejected variadic functions in the
core API although I am considering adding them in the future on top of
existing interface.

The second group of libraries uses overloaded operators such as
`operator<<` for passing arguments. It includes IOStreams, Boost Format
and SafeFormat. They all use different operators:

```c++
// IOStreams:
std::cout << weekday << ", " << month << " " << day << "\n";

// Boost Format:
std::string s = 
  str(boost::format("%1%, %2% %3%\n") % weekday % month % day);

// SafeFormat:
Loki::SPrintf(s, "%s, %d %d\n")(weekday)(month)(day);
```

Instead of yet another arbitrary operator choice, I decided to use the
conventional insertion operator `<<` since it is used by the standard
streams:

```c++
std::string s =
  str(fmt::Format("{0}, {1} {2}\n") << weekday << month << day);
```

As you can see the API is quite similar to Boost Format. `Format` is a
function that takes a format string as an argument and returns a
temporary object that accepts additional arguments via the operator
`<<`. The `str` function converts the result into an `std::string`.
There is also a `c_str` function that converts the result into a C
string which can be useful for working with C code:

```c++
rmdir(c_str(fmt::Format("{0}.lock") << pid));
```

So far this is similar to existing APIs. What is different is the
ability to define your own functions that look exactly like `Format` but
do additional things, for example:

```c++
ReportError("File not found: {0}") << path;
```

Let\'s say I want to define a function `ReportError` that formats and
prints an error to `std::cerr` adding a newline. To this end I need to
create a small class (struct will do since it has only one public
member) that defines `operator()(const fmt::Writer &)` which does the
output:

```c++
struct PrintError {
  void operator()(const fmt::Writer &w) const {
      std::cerr << "Error: " << w.str() << std::endl;
  }
};
```

`Writer` is a class that does all the formatting and stores the output
in a buffer. The `str()` method converts the output to `std::string`,
there are other access methods as well. Now I can define the
`ReportError` function:

```c++
fmt::Formatter ReportError(const char *format) {
  return fmt::Formatter(format);
}
```

`Formatter` is used only in wrapper functions like the one above. It is
responsible for receiving arguments via `operator<<`, completing the
format operation and calling a user supplied action like `PrintError`
after that.

As you can see creating wrappers is relatively easy. It doesn\'t require
any preprocessor tricks or defining functions for different number of
arguments. And once a wrapper function is defined it is as easy to use
as `fmt::Format`, in fact the latter is implemented in exactly the same
way.

The `Writer` class can also be used on its own if you need to
efficiently merge the output of multiple format operations, for example:

```c++
fmt::Writer out;
for (int i = 0; i < 10; i++)
  out.Format("{0}") << i;
std::string s = out.str(); // s == 0123456789
```

This concludes the first and the most important part about the API. In
the next part I am going to write about performance and related design
aspects.

The library is available in [this
repository](https://github.com/cppformat/cppformat) on GitHub. Feel free
to use it and post your comments below.
