---
title: Printing double aka the most difficult problem in computer science
date: 2023-06-04
aliases: ['/2023/06/04/printing-double.html']
---

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em; width: 50%">
<a href="/img/stackoverflow.png">
  <img border="0" src="/img/stackoverflow.png" width="100%"
       title="StackOverflow in a nutshell">
</a>
</div>

A few years ago I discovered this StackOverflow question:
[How do I print a double value with full precision using cout?](
https://stackoverflow.com/q/554063/471164) I was shocked to see how wrong
most of the answers were so I [answered it myself](
https://stackoverflow.com/a/65329803/471164) back then. Recently I stumbled
upon it again and decided to write this blog post explaining the problems with
some of the top answers.

Consider the (now removed) top answer with almost 500 upvotes. The first part of it gives
us this method:

```c++
double d = 3.14159265358979;
cout.precision(17);
cout << "Pi: " << fixed << d << endl;
```

It is funny to see a weirdly rounded approximation of π in the question about
precision but putting it aside, is this answer correct? Let's check!

Plugging it in [godbolt](https://godbolt.org/z/c56fvsPz7) and fixing obvious
mistakes like missing namespace qualification gives us:

```
Pi: 3.14159265358979001
```

It seems to work, doesn't it? Let's check another number:

```c++
double d = 1e-20;
cout.precision(17);
cout << "Smol: " << fixed << d << endl;
```

This prints

```
Smol: 0.00000000000000000
```

This is a bit too wrong for the correct answer. There is also a questionable
usage of hardcoded precision. But the answer has a second, slightly different
part:

```c++
#include <limits>

typedef std::numeric_limits< double > dbl;

double d = 3.14159265358979;
cout.precision(dbl::max_digits10);
cout << "Pi: " << d << endl;
```

This one is better: it uses `max_digits10` instead of the hardcoded precision
and removes `fixed`. Does it work with our smol number 
([godbolt](https://godbolt.org/z/Ken373Tch))?

```c++
typedef std::numeric_limits< double > dbl;
cout.precision(dbl::max_digits10);
cout << "Smol: " << 1e-20 << endl;
```

prints

```
9.9999999999999995e-21
```

which is not pretty but not terribly wrong. If you read it back you'll get the
correct value but it's not very user-friendly.

Does the second solution always work? Not really, because unfortunately `cout`
uses the global state to control formatting. So it will break if the floating
point format flags where earlier set to `fixed` ([godbolt](
https://godbolt.org/z/5vMWe74zd)):

```c++
// Some place else:
cout << fixed << 0.42 << endl;
//  ...
typedef std::numeric_limits< double > dbl;
cout.precision(dbl::max_digits10);
cout << "Smol: " << 1e-20 << endl;
```

**Conclusion**: 3/10 because of the completely wrong first part of the answer
and subtly wrong second part and no explanation how these two relate to each
other.

Let's move to the second top answer with 90 votes:

```c++
#include <iomanip>
std::cout << std::setprecision (15) << 3.14159265358979 << std::endl;
```

This one is really broken because it uses insufficient precision in addition to
being affected by the global state. This is easy to see by printing a more
precise approximation of π ([godbolt](https://godbolt.org/z/hhczYcn4x)):

```c++
std::cout << std::setprecision (15) << 3.141592653589793 << std::endl;
std::cout << std::setprecision (17) << 3.141592653589793 << std::endl;
```

This prints:

```
3.14159265358979
3.1415926535897931
```

On a positive note it namespace qualifies names and uses a fancy
`std::setprecision` I/O manipulator.

**Conclusion**: 1/10 because it gets the most important part wrong.

The next answer with 28 votes gives us this code:

```c++
std::cout << std::setprecision (std::numeric_limits<double>::digits10 + 1)
          << 3.14159265358979
          << std::endl;
```

This one uses an interesting formula `std::numeric_limits<double>::digits10 + 1`
which feels clever. For IEEE 754 double this gives us 16 which is more precision
than the second answer but less than the first answer. At this point I think
people are brute forcing the correct precision although the general answer has 
been known at least [since 1968](https://dl.acm.org/doi/10.1145/362851.362887)
and is available from Wikipedia:

> If an IEEE 754 double-precision number is converted to a decimal string with
> at least 17 significant digits, and then converted back to double-precision
> representation, the final result must match the original number.

This time we can have our π and print it too because it so happens that
16 digits is enough to round trip it. But not enough to round trip
1.2345678901234567 ([godbolt](https://godbolt.org/z/EK7sd4Wz4)):

```c++
std::cout << std::setprecision (std::numeric_limits<double>::digits10 + 1)
          << 1.2345678901234567
          << std::endl;
```

This prints 
```
1.234567890123457
```

If you stare long enough you can see that it's wrong. To convince yourself that
this is not just a rounding issue you can print both 1.2345678901234567 and
1.234567890123457 with precision of 17 and see that this gives different results.

**Conclusion**: 2/10 because it gets the most important part wrong but at least
does it in a fancy and slightly less wrong way than the previous answer.

I'll leave my own answer to the end so let's look at the one with approximately
the same number of votes. The first method it suggests is

```c++
std::cout.precision(std::numeric_limits<double>::max_digits10 - 1);
std::cout << std::scientific <<  1.0/7.0 << '\n';

// C++11 Typical output
1.4285714285714285e-01
```

This is the first correct answer which is why it only has measly 17 votes.
Subtracting one looks counter-intuitive but it accounts for the fact that the
`scientific` format only counts digits **after** the decimal point. It is not
affected by the global state because it always sets the format. The only small
drawbacks are that it may print more digits than necessary and always prints
the exponent.

The answer rightfully warns against using the  `fixed` format and also suggests
`hexfloat` as another alternative:

```c++
std::cout << "hexfloat: " << std::hexfloat << exp (-100) << '\n';
std::cout << "hexfloat: " << std::hexfloat << exp (+100) << '\n';
// output
hexfloat: 0x1.a8c1f14e2af5dp-145
hexfloat: 0x1.3494a9b171bf5p+144
```

**Conclusion**: 8/10 because it is gives correct but suboptimal result

[The method that I'd recommend](https://stackoverflow.com/a/65329803/471164) is,
of course, using C++20 [`std::format`](
https://en.cppreference.com/w/cpp/utility/format/format) or, if the latter is
not yet available on your system, [`fmt::format`](https://github.com/fmtlib/fmt)
which implements all of the standard features and more:

```c++
std::cout << std::format("{}", std::numbers::pi_v<double>);
```

It gives you the shortest decimal representation with the round trip guarantee
and the correct rounding. It is not affected by global state and, unlike the
previous answer, won't print unnecessary digits. And you don't need to manually
specify the precision.

P.S. The question doesn't actually define what it means by "full precision".
Normally it is understood as precision enough for round trip through decimal but
there is another possible but unlikely interpretation of [the maximum number of
(significant) decimal digits](https://www.exploringbinary.com/maximum-number-of-decimal-digits-in-binary-floating-point-numbers/).
For IEEE 754 `double` it's whopping 767 digits! It is also one of the reasons
why your `printf` implementation uses multiprecision arithmetic.

Happy floating-point formatting!
