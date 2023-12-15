---
title: Connecting a solver to AMPL
date: 2014-07-11
aliases: ['/2014/07/11/connecting-solver-to-ampl.html']
---

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img src="/img/connect.jpg" width="320">
</div>

I've been planning to write this post for a while, but it was hard to choose
the right solver. Most mainstream solvers already have AMPL interfaces and I din't
want to reimplement them. At the same time I didn't want to use an obscure solver
noone heard of.

Finally, I've found a good candidate for my post. The solver I'm going to use is
called [LocalSolver](http://www.localsolver.com/) and it is a relatively new one
(see [Constraint Programming History](
https://www.ibm.com/developerworks/community/blogs/jfp/entry/constraint_programming_history?lang=en))
based on local search techniques.

Connecting solvers to AMPL is usually done with the help of AMPL Solver
Library (ASL) which provides two APIs, a classic C API described in the
[Hooking Your Solver to AMPL](http://ampl.com/resources/hooking-your-solver-to-ampl/)
guide and a new C++ API introduced in [The AMPL Interface to Constraint Programming Solvers](
http://zverovich.net/slides/2013-01-06-ics/ampl-interface-to-constraint-programming-solvers.html).

The new C++ API is a natural object-oriented interface for connecting solvers
to AMPL. It provides classes for working with optimization problems, options and
expression trees. This API allows you to write type-safe and efficient driver code,
eliminates most of the boilerplate and has virtually zero overhead
compared to the C API.

Although the C++ API was initially designed for constraint programming solvers,
it can be used to connect other kinds of solvers as well. It has been used to
connect the following solvers: [IBM/ILOG CPLEX CP Optimizer](
http://www-01.ibm.com/software/commerce/optimization/cplex-cp-optimizer/),
[Gecode](http://www.gecode.org/), [JaCoP](http://jacop.osolpro.com/) and
[Sulum](http://sulumoptimization.com/).

In this post I'll use the C++ ASL API because it simplifies writing a
solver connection. Besides LocalSolver itself only provides C++ and not C API.
To get started, let's clone the [AMPL GitHub repository](https://github.com/ampl/ampl):

```
$ git clone https://github.com/ampl/ampl.git
```

The `solvers` directory contains AMPL drivers for a number of solvers
which can be used as examples. As I mentioned before,
[gecode](https://github.com/ampl/ampl/tree/master/solvers/gecode),
[ilogcp](https://github.com/ampl/ampl/tree/master/solvers/ilogcp),
[jacop](https://github.com/ampl/ampl/tree/master/solvers/jacop) and
[sulum](https://github.com/ampl/ampl/tree/master/solvers/sulum) are
written using the C++ API.

Let's create `solvers/localsolver` directory that will contain the driver code,
`localsolver.h`, `localsolver.cc` and `main.cc`. The first two files will
contain the solver interface and the last one will implement the `main` function.

Every solver interface should at least

- Provide access to solver options
- Convert problem from AMPL to native solver format
- Solve the problem
- Pass solution back to AMPL

LocalSolver provides a nice simple interface, so problem conversion is
pretty straightforward. For the purpose of this post, I'll only focus on linear
expressions, but converting nonlinear expressions is similar. In fact conversion
of a nonlinear expression is often done in [one line of code](
https://github.com/ampl/ampl/blob/cc270fc7c6e36781e9761af4469c2f321590f7f0/solvers/ilogcp/concert.h#L112).

Let's add class `NLToLocalSolverConverter` that will convert an AMPL problem 
represented by `ampl::Problem` class to a LocalSolver model `localsolver::LSModel`:

```c++
class NLToLocalSolverConverter {
 private:
  ls::LSModel &model_;
  std::vector<ls::LSExpression*> vars_;

  template<typename Term>
  ls::LSExpression *ConvertExpr(LinearExpr<Term> linear, NumericExpr nonlinear);

 public:
  NLToLocalSolverConverter(ls::LSModel &model) : model_(model) {}

  void Convert(const Problem &p);

  ls::LSExpression *const *vars() const { return &vars_[0]; }
};
```

I use `ls` as an alias to `localsolver` and omit the `ampl` namespace altogether
for brevity. The `NLToLocalSolverConverter` class contains a reference to
`LSModel` object and an array of `ls::LSExpression*` which point to expressions
representing decision variables. Both members are used by conversion methods such
as `ConvertExpr` The AMPL `Problem` object is passed to the `Convert` function
which converts variables, objective and constraints:

```c++
void NLToLocalSolverConverter::Convert(const Problem &p) {
  int num_vars = p.num_vars();
  vars_.resize(num_vars);

  // Convert continuous variables.
  int num_continuous_vars = p.num_continuous_vars();
  for (int j = 0; j < num_continuous_vars; ++j) {
    ls::LSExpression *var =
        model_.createExpression(ls::O_Float, p.var_lb(j), p.var_ub(j));
    vars_[j] = var;
  }

  // Convert discrete variables.
  for (int j = num_continuous_vars; j < num_vars; j++) {
    if (p.var_lb(j) != 0 && p.var_ub(j) != 1)
      throw Error("General integer variables are not supported.");
    ls::LSExpression *var = model_.createExpression(ls::O_Bool);
    vars_[j] = var;
  }

  // Convert objective.
  if (p.num_objs() != 0) {
    model_.addObjective(
        ConvertExpr(p.linear_obj_expr(0), p.nonlinear_obj_expr(0)),
        p.obj_type(0) == MIN ? ls::OD_Minimize : ls::OD_Maximize);
  }

  // Convert constraints.
  for (int i = 0, n = p.num_cons(); i < n; ++i) {
    ls::LSExpression *expr =
        ConvertExpr(p.linear_con_expr(i), p.nonlinear_con_expr(i));
    double lb = p.con_lb(i), ub = p.con_ub(i);
    if (lb <= negInfinity) {
      expr = model_.createExpression(ls::O_Leq, expr, ub);
    } else if (ub >= Infinity) {
      expr = model_.createExpression(ls::O_Geq, expr, lb);
    } else if (lb == ub) {
      expr = model_.createExpression(ls::O_Eq, expr, lb);
    } else {
      expr = model_.createExpression(ls::O_Geq, expr, lb);
      expr = model_.createExpression(ls::O_Leq, expr, ub);
    }
    model_.addConstraint(expr);
  }
}
```

The `ConvertExpr` method takes a linear and nonlinear part of objective or
constraint expression and converts it to a LocalSolver expression:

```c++
template <typename Term>
ls::LSExpression *NLToLocalSolverConverter::ConvertExpr(
    LinearExpr<Term> linear, NumericExpr nonlinear) {
  typename LinearExpr<Term>::iterator i = linear.begin(), end = linear.end();
  bool has_linear_part = i != end;
  ls::LSExpression *sum = 0;
  if (has_linear_part) {
    sum = model_.createExpression(ls::O_Sum);
    for (; i != end; ++i) {
      ls::LSExpression *term = vars_[i->var_index()];
      double coef = i->coef();
      if (coef != 1)
        term = model_.createExpression(ls::O_Prod, coef, term);
      sum->addOperand(term);
    }
  }
  return sum;
}
```

In the next post I'll extend this class showing how to use the `Visitor` design
pattern to traverse nonlinear expression trees.

Now that the conversion is implemented, let's add a class `LocalSolver`
representing the solver itself:

```c++
class LocalSolver : public Solver {
 private:
  ls::LocalSolver solver_;
  int timelimit_;

  int GetTimeLimit(const SolverOption &) const {
    return timelimit_;
  }

  void SetTimeLimit(const SolverOption &opt, int value) {
    if (value <= 0)
      throw InvalidOptionValue(opt, value);
    timelimit_ = value;
  }

 protected:
  void DoSolve(Problem &p);

 public:
  LocalSolver();
};
```

This class provides access to solver options (currently only `timelimit` and built-in
options). The constructor first passes the information about the solver such as its
name and version to the base `Solver` class. It also provides a text printed before the
option documentation when the user runs the solver with option `-=`.
Finally, the constructor adds a `timelimit` integer option with `AddIntOption`
method passing the description, getter and setter to it:

```c++
LocalSolver::LocalSolver() : Solver("localsolver", 0, 20140710), timelimit_(0) {
  std::string version = fmt::format("{}.{}",
      localsolver::LSVersion::getMajorVersionNumber(),
      localsolver::LSVersion::getMinorVersionNumber());
  set_long_name("localsolver " + version);
  set_version("LocalSolver " + version);

  set_option_header(
      "LocalSolver Options for AMPL\n"
      "----------------------------\n"
      "\n"
      "To set these options, assign a string specifying their values to "
      "the AMPL option ``localsolver_options``. For example::\n"
      "\n"
      "  ampl: option localsolver_options 'version timelimit=30;\n");

  AddIntOption("timelimit",
      "Time limit in seconds (positive integer). Default = no limit.",
      &LocalSolver::GetTimeLimit, &LocalSolver::SetTimeLimit);
}
```

All descriptions are written in a subset of 
[reStructuredText](http://docutils.sourceforge.net/rst.html) to allow
high quality rendering both in console and in the HTML documentation.
See [Gecode Options for AMPL](http://ampl.com/products/solvers/gecode-options/)
for example.

The `DoSolve` method uses `NLToLocalSolverConverter` described above to convert
the problem. Normally the solver options are set directly in the solver object,
but for some reason LocalSolver requires setting options after the model is
constructed, so we set the options in this method. Then we solve the problem,
convert the solution and pass it to AMPL with `HandleSolution`:

```c++
void LocalSolver::DoSolve(Problem &p) {
  steady_clock::time_point time = steady_clock::now();

  // Set up an optimization problem in LocalSolver.
  ls::LSModel &model = *solver_.getModel();
  NLToLocalSolverConverter converter(model);
  converter.Convert(p);
  model.close();

  // Set options. LS requires this to be done after the model is closed.
  ls::LSPhase &phase = *solver_.createPhase();
  if (timelimit_ != 0)
    phase.setTimeLimit(timelimit_);

  double setup_time = GetTimeAndReset(time);

  // Solve the problem.
  solver_.solve();

  // Convert solution status.
  int solve_code = 0;
  ls::LSSolution *sol = solver_.getSolution();
  const char *status = "unknown";
  switch (sol->getStatus()) {
  case ls::SS_Inconsistent:
    solve_code = INFEASIBLE;
    status = "infeasible problem";
    break;
  case ls::SS_Infeasible:
    // Solution is infeasible, but problem may be feasible.
    // This can only happen if stopped by a limit.
    solve_code = LIMIT;
    status = "infeasible solution";
    break;
  case ls::SS_Feasible:
    solve_code = SOLVED_MAYBE;
    status = "feasible solution";
    break;
  case ls::SS_Optimal:
    solve_code = SOLVED;
    status = "optimal solution";
    break;
  default:
    solve_code = FAILURE;
    status = "unknown solution status";
    break;
  }
  p.set_solve_code(solve_code);

  int num_vars = p.num_vars();;
  ls::LSExpression *const *vars = converter.vars();
  std::vector<double> solution(num_vars);
  int num_continuous_vars = p.num_continuous_vars();
  for (int i = 0; i < num_continuous_vars; ++i)
    solution[i] = vars[i]->getDoubleValue();
  for (int i = num_continuous_vars; i < num_vars; ++i)
    solution[i] = vars[i]->getValue();
  double solution_time = GetTimeAndReset(time);

  fmt::Writer w;
  w.write("{}: {}\n", long_name(), status);
  w.write("{}", solver_.getStatistics()->toString());
  double obj_val = std::numeric_limits<double>::quiet_NaN();
  if (p.num_objs() != 0) {
    obj_val = model.getObjective(0)->getDoubleValue();
    w.write("objective {}", ObjPrec(obj_val));
  }
  HandleSolution(p, w.c_str(),
      solution.empty() ? 0 : solution.data(), 0, obj_val);
  double output_time = GetTimeAndReset(time);

  if (timing()) {
    Print("Setup time = {:.6f}s\n"
          "Solution time = {:.6f}s\n"
          "Output time = {:.6f}s\n",
          setup_time, solution_time, output_time);
  }
}
```

The method also measures time of each step and reports it if the built-in `timing`
option is set.

Finally we provide two functions, a `CreateSolver` function that creates a `Solver`
object and is used for testing and introspection (e.g. to query options
programmatically):

```c++
SolverPtr CreateSolver(const char *) { return SolverPtr(new LocalSolver()); }
```

and a `main` method that constructs and runs the solver:

```c++
int main(int, char **argv) {
  try {
    return ampl::LocalSolver().Run(argv);
  } catch (const std::exception &e) {
    fmt::print(stderr, "Error: {}\n", e.what());
  }
  return 1;
}
```

The easiest way to build an AMPL driver is by using CMake, a cross-platform build
system. All we need for a new driver is to add the following line to
`solvers/CMakeLists.txt`:

```
add_ampl_solver(localsolver)
```

Now we can go to the top level `ampl` directory and build the code:

```
$ cmake .
$ make
```

which gives us a `localsolver` binary that can be used with AMPL:

```
ampl: model toy.ampl
ampl: option solver localsolver;
ampl: option localsolver_options 'timelimit=1';
ampl: solve;
localsolver 4.0: timelimit=1
Preprocess model 100% ...
Close model 100% ...
Initialize threads 100% ...
Push initial solutions 100% ...
...
feasible solution
running time = 1 sec, nb iterations = 508216, nb moves = 1015123
accepted = 1677 (0.165202%), improving = 856 (0.0843248%)
rejected = 1013446 (99.8348%), infeasible = 721134 (71.0391%)
objective 280
```

Here I solve a [toy knapsack problem](https://github.com/ampl/ampl.github.io/blob/master/models/toy.ampl)
from LocalSolver docs converted into AMPL.

As you can see connecting a solver to AMPL is not difficult. It took little time and only
~200 lines of code to write a fully functional LocalSolver connection with support for
continous variables, binary variables, linear objectives and constraints (including
range and equality constraints), the time limit option and statistics reporting.

The source code for the AMPL/LocalSolver interface is available in the
[solvers/localsolver](https://github.com/ampl/ampl/tree/master/solvers/localsolver) directory
[AMPL GitHub repository](https://github.com/ampl/ampl).

**Update**: Simplified CMake configuration. Now only a single call to <code>add_ampl_solver</code>
is required.
