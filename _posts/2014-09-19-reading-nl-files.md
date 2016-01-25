---
layout: post
title: Reading .nl files
date: 2014-09-19
---

{{ page.title }}
================

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img border="0" src="/img/dragon.png" width="320" 
  title="&quot;What does dragon have to do with parsing?&quot; you might ask.">
</div>

The [.nl format][1] is possibly the
most widely used format for representing mathematical optimization problems you've
never heard of unless you are a solver developer.
The reason it is not very well-known is because .nl is a low-level format
designed for efficient machine input and output unlike algebraic modeling languages
that are designed for human readability (at least some of them) and unlike MPS
which is neither particularly human readable nor efficient.

  [1]: https://en.wikipedia.org/wiki/Nl_(format)

Originally developed for
[connecting solvers to AMPL](http://www.ampl.com/REFS/hooking2.pdf),
the .nl format is now used in other modeling systems as well, including
[Pyomo](https://software.sandia.gov/trac/coopr/wiki/Pyomo) and
[Solver Studio](http://solverstudio.org/languages/ampl/).
It is supported by numerous commercial and open-source solvers, either natively or
via separate driver programs. For example, the `cplexamp` executable included in the
[CPLEX](http://www-01.ibm.com/software/commerce/optimization/cplex-optimizer/) distribution
accepts problems in this format. [Cbc](https://projects.coin-or.org/Cbc),
[Ipopt](https://projects.coin-or.org/Ipopt) and other [COIN-OR](http://www.coin-or.org/)
solvers have built-in support for it.

The AMPL Solver Library (ASL), which is mainly used to connect solvers to AMPL, includes
a reference implementation of an .nl reader (parser). While it does its job well,
it has some limitations. Most importantly, it always constructs the ASL representation
of an optimization problem in memory. You cannot reuse the parser for anything else such as
constructing a different problem representation. And it only supports reading from files
or file-like objects, although, depending on the file system, they can be memory-backed.

Now there is an alternative .nl reader, included in the
[ampl/mp](https://github.com/ampl/mp) library, that addresses these limitations.
It supports all features of the format including nonlinear functions and expressions
as well as suffixes (arbitrary metadata that can be attached to variables, constraints, etc),
logic and constraint programming features.

The new reader is fully reusable and is not limited to a specific problem representation.
It provides a [SAX-like](https://en.wikipedia.org/wiki/Simple_API_for_XML) sequential
access parser API.
What this means is that instead of constructing the memory representation of a
problem, the reader sends notifications of problem constructs to the handler object.
Unlike SAX, however, the handler uses static rather than dynamic polymorphism
so its methods can be easily inlined at compile time.

The API of the new .nl reader is very simple, it consists of two functions

{% highlight c++ %}
template <typename Handler>
void mp::ReadNLString(fmt::StringRef str, Handler &handler,
                      fmt::StringRef name = "(input)");

template <typename Handler>
void mp::ReadNLFile(fmt::StringRef filename, Handler &h);
{% endhighlight %}

where `fmt::StringRef` is a string reference which can be either a C
string or `std::string`.

As their names suggest, the first function reads a string containing an
optimization problem in the .nl format while the second one reads an .nl file.

The `handler` object receives notification of problem components.
For example, when the parser reads a binary expression, it invokes
the `OnBinary` method. The `Handler` [concept](http://en.cppreference.com/w/cpp/concept)
is designed in such a way that it is possible, although not necessary,
to construct a problem representation on the fly.

The ability to connect a custom handler makes unit testing much easier
while reading input from memory makes it fast.

Now I am going to demonstrate how to use the reader on a simple example that
counts the number of expressions of certain kind. This can be used, for
instance, to filter out problems containing expressions not supported by some
solver.

In this example I go over the file names passed as command-line arguments,
read each file, count the number of divisions by non-constant expressions and
print the file name together with expression count:

{% highlight c++ %}
#include "mp/nl.h"

enum Expr {OTHER, CONST};

struct ExprCounter : mp::NLHandler<Expr> {
  int num_divs;
  ExprCounter() : num_divs(0) {}
  Expr OnBinary(mp::expr::Kind kind, Expr lhs, Expr rhs) {
    if (kind == mp::expr::DIV && rhs != CONST)
      ++num_divs;
    return OTHER;
  }
  Expr OnNumericConstant(double value) { return CONST; }
};

int main(int argc, char **argv) {
  for (int i = 1; i < argc; ++i) {
    ExprCounter counter;
    mp::ReadNLFile(argv[i], counter);
    if (counter.num_divs != 0)
      fmt::print("{}: {} divisions\n", argv[i], counter.num_divs);
  }
}
{% endhighlight %}

The header file
[mp/nl.h](https://github.com/ampl/mp/blob/f429ae0dcc53cf4f454d99e23672b30daa0c948c/include/mp/nl.h)
provides the declarations of `ReadNLFile` and `ReadNLString` functions
described above as well as the definition of the `NLHandler` class.
This class provides the default implementations of handler methods that
ignore all input. This is perfect for our example, as we only need
to handle two types of expressions, numeric constant and division.

The `Expr` type represents an expression. It is a simple enum as we don't
construct an expression tree here, but only distinguish between constants
and other expressions. The expression type is passed as a template argument
to `NLHandler`. This ensures that default handler methods such as
`NLHandler::OnUnary` also return `Expr`. These methods
[value-initialize](http://en.cppreference.com/w/cpp/language/value_initialization)
the expression objects they return which in this case gives the value `OTHER`.

The implementation of `ExprCounter` is very straightforward, the `OnBinary`
method called by the .nl reader for binary expressions increments the `num_divs`
if the expression kind is division (`expr::DIV`) and the right-hand side is not
a numeric constant. The `OnNumericConstant` method returns `CONST` to mark
a constant expression. This value is automatically propagated as an argument
to the parent expression if necessary.

The `main` function iterates over command-line arguments containing file
names, calls `ReadNLFile` to parse each file passing an `ExprCounter` object
to handle notifications.

Note that the example doesn't contain any dynamic memory allocations.
In fact the new .nl reader normally doesn't use dynamic memory either.
Together with inlining of handler methods and single-pass
[mmap](https://en.wikipedia.org/wiki/Mmap)-based input,
this makes processing .nl files extremely fast.

Let's build this example:

{% highlight text %}
$ git clone https://github.com/ampl/mp.git
$ cd mp
$ cmake .
$ make
$ wget -O nlreader-example.cc http://bit.ly/1paZ3yT
$ g++ -O3 -onlreader-example nlreader-example.cc -Iinclude -Llib -lmp
{% endhighlight %}

Now let's get a bunch of nonlinear problems from
the [CUTE set](http://orfe.princeton.edu/~rvdb/ampl/nlmodels/cute/index.html),
convert them into .nl format and pass them to our program:

{% highlight text %}
$ git clone https://github.com/ampl/cute.git
$ for f in cute/*.mod; do sed 's/solve;//' < $f | ampl -og$f > /dev/null; done
$ time ./nlreader-example cute/*.nl
cute/avion2.mod.nl: 9 divisions
cute/bard.mod.nl: 15 divisions
cute/bratu1d.mod.nl: 1002 divisions
cute/britgas.mod.nl: 368 divisions
cute/brkmcc.mod.nl: 1 divisions
cute/cantilvr.mod.nl: 5 divisions
cute/chemrcta.mod.nl: 4996 divisions
...
real	0m1.663s
user	0m1.643s
sys	0m0.020s
{% endhighlight %}

The `nlreader-example` program processes 712 .nl files, totaling 205 MiB,
in just 1.6 seconds. I plan to compare its performance to the reference ASL
reader in a follow-up post.

This functionality enables building new powerful tools for processing optimization
problems. It can be used to directly construct problems in native solver formats
bypassing intermediate representation, reformulate problems on the fly and convert
them to other formats.

Note that the code described here is fresh from the <s>oven</s>
[repository](https://github.com/ampl/mp) and, although it has been thoroughly tested,
it hasn't been documented yet, other than with source comments.
