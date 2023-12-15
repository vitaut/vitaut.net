---
title: Working with optimization problems in .nl files
date: 2016-03-07
aliases: ['/2016/03/07/working-with-optimization-problems-in-nl-files.html']
---

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img border="0" src="/img/api.jpg" width="320" title="The truth is out there, in the code comments.">
</div>

In [one of the previous posts](http://zverovich.net/2014/09/19/reading-nl-files.html)
I have described an API for reading [.nl files](https://en.wikipedia.org/wiki/Nl_(format)).
The NL reader API is now stable and documented at
[http://ampl.github.io/nl-reader.html](http://ampl.github.io/nl-reader.html).
Also you can find a few examples of using it in
[nl-example.cc](https://github.com/ampl/mp/blob/master/src/nl-example.cc).
It is still the way to go if you want to process .nl files in
[the most efficient way](http://zverovich.net/slides/2015-01-11-ics/socp-reformulation.html#/14).
However, if you want to load the complete optimization problem and work with it,
the NL reader will require you to manage the data structures that represent the problem
yourself. Fortunately, [the AMPL/MP library](https://github.com/ampl/mp)
now provides a new API for working with optimization problems and this post will introduce
this new API.

The optimization problem is represented by the `mp::Problem` type which provides methods
for accessing variables, objectives (multiple objectives are supported) and constraints.
It can handle all
[types of optimization problems that the NL format can represent](http://ampl.github.io/nl-reader.html)
including LP, MIP, quadratic, general nonlinear and constraint programming
problems.

Optimization problems can be constructed programmatically or read from .nl files (other
input formats will be added in the future). Here's an example of loading a problem from an .nl file:

```c++
#include <mp/nl-reader.h>
#include <mp/problem.h>

int main() {
  mp::Problem p;
  ReadNLFile("diet.nl", p);
}
```

As you can see, this example uses the NL reader API function
[`ReadNLFile`](http://ampl.github.io/nl-reader.html#_CPPv2N2mp10ReadNLFileEN3fmt10CStringRefER7Handleri)
but passes a reference to the `Problem` object instead of an NL handler as a second argument.
`ReadNLFile` automatically recognizes this and constructs an optimization problem
instead of sending notifications of NL constructs to it. Reading problems from memory
is also supported with
[`ReadNLString`](http://ampl.github.io/nl-reader.html#_CPPv2N2mp12ReadNLStringE11NLStringRefR7HandlerN3fmt10CStringRefEi).

But why yet another API, doesn't the AMPL Solver Library (ASL) have the same functionality?
The difference from the ASL is that the new API is simpler, fully type-safe
(no unsafe casts required), faster,
and allows modification of the problem after it has been loaded that can be
[used to implement transformations](http://zverovich.net/slides/2015-01-11-ics/socp-reformulation.html).
The new implementation is already
[~36% faster on the CUTE test set](http://zverovich.net/slides/2015-01-11-ics/socp-reformulation.html#/14)
and it hasn't been even optimized yet.
The current limitation is that it doesn't provide support automatic differentiation,
but this will be addressed in the future.

As for the API simplicity, here's a concrete example of reading a problem from an .nl file and
checking if the initial solution is feasible using AMPL/MP:

```c++
#include <mp/nl-reader.h>
#include <mp/problem.h>

int main() {
  mp::Problem p;
  ReadNLFile("diet.nl", p);
  if (p.has_nonlinear_cons() || p.num_logical_cons() != 0) {
    std::puts("problem has nonlinear constraints");
    return 1;
  } 
  for (auto var: p.vars()) {
    if (!(var.lb() <= var.value() && var.value() <= var.ub())) {
      std::puts("infeasible");
      return 1;
    }
  }
  for (auto con: p.algebraic_cons()) {
    double body = 0;
    for (auto term: con.linear_expr())
      body += term.coef() * p.var(term.var_index()).value();
    if (!(con.lb() <= body && body <= con.ub())) {
      std::puts("infeasible");
      return 1;
    }
  }
  std::puts("feasible");
}
```

and the same using ASL:

```c++
#include <cstdio>
#include <cstring>
#include <asl.h>

int main() {
  ASL *asl = ASL_alloc(ASL_read_fg);
  const char stub[] = "diet";
  FILE *f = jac0dim(stub, std::strlen(stub));
  if (asl->i.nlc_ != 0 || asl->i.n_lcon_ != 0) {
    std::puts("problem has nonlinear constraints");
    return 1;
  }
  asl->i.want_xpi0_ = 1;
  asl->i.Uvx_ = static_cast<real*>(malloc(asl->i.n_var_ * sizeof(real)));
  asl->i.Urhsx_ = static_cast<real*>(malloc(asl->i.n_con_ * sizeof(real)));
  fg_read(f, 0);
  for (int i = 0; i < asl->i.n_var_; ++i) {
    if (!(asl->i.LUv_[i] <= asl->i.X0_[i] && asl->i.X0_[i] <= asl->i.Uvx_[i])) {
      std::puts("infeasible");
      return 1;
    }
  }
  for (int i = 0; i < asl->i.n_con_; ++i) {
    double body = 0;
    for (cgrad *term = asl->i.Cgrad_[i]; term; term = term->next)
      body += term->coef * asl->i.X0_[term->varno];
    if (!(asl->i.LUrhs_[i] <= body && body <= asl->i.Urhsx_[i])) {
      std::puts("infeasible");
      return 1;
    }
  }
  std::puts("feasible");
}
```

Even this little example shows the advantage of the new API where you can work
with abstractions like variables and constraints rather than with a single big
`ASL` data structure. The new API provides iterators over problem components
which you can use with the C++ standard library algorithms. Here's an example
that finds a variable with nonzero value:

```c++
auto vars = p.vars();
auto var = std::find_if(vars.begin(), vars.end(),
                        [](mp::Problem::Variable v) { return v.value() != 0; });
```

The new API is nearly complete supporting all problems that can be represented in NL
files but it is still being documented and finalized. For now you can refer to
[the source](https://github.com/ampl/mp/blob/master/include/mp/problem.h) which is
pretty straightforward and commented. Also feel free to leave questions or comments below.
