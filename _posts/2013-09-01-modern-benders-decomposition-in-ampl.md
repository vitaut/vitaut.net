---
layout: post
title: Modern Benders decomposition in AMPL
date: 2013-09-01
---

{{ page.title }}
================

I was thinking of how to implement Benders decomposition in AMPL
in the way Paul Rubin calls "modern approach" in his great blog post,
[Benders Decomposition Then and Now](http://orinanobworld.blogspot.com/2011/10/benders-decomposition-then-and-now.html).
And experimenting with [smpswriter](https://github.com/vitaut/ampl/tree/master/solvers/smpswriter),
a program I recently wrote to convert deterministic equivalent problems written
in AMPL into stochastic programming (SP) problems in [SMPS](http://myweb.dal.ca/gassmann/smps2.htm),
I realized that it can already be done and this is what this post is about.

As it often happens in mathematics, one thing is a special case of another or we
can somehow reduce the problem to another one we know solution for.
There is even a joke about it:

> a mathematician and an engineer arrive in the kitchen to make tea; both fill
> a pot with water, put the pot on the stove and boil water – a trivial problem.
> The next day, they go to make tea again, but find that the pot is already full
> of water. The engineer will put the pot on the stove; the mathematician will
> throw out the water – "reducing the problem to a previously solved problem".

With this in mind, we can think of deterministic
[mixed-integer programming](http://en.wikipedia.org/wiki/Integer_programming)
as a special case of stochastic mixed-integer programming. Not sure if it is of
much use because stochastic programming problems are generally more difficult to
solve. However it allows to see that the modern Benders decomposition is in fact
a variant of the [integer L-shaped method](http://www.sciencedirect.com/science/article/pii/016763779390002X).

So with the help of smpswriter, one can use any SP solver implementing the integer
L-shaped method, and [FortSP](http://www.optirisk-systems.com/products_fortsp.asp)
is one such solver, to apply modern Benders decomposition to MIP problems.
Now I'll show how it can be done using as an example a location-transportation
problem for which there is an implementation of old-school Benders decomposition.

Here is the implementation of the original Benders decomposition in AMPL:
* [trnloc1.mod](http://www.ampl.com/NEW/LOOP2/trnloc1.mod) - model
* [trnloc.dat](http://www.ampl.com/NEW/LOOP2/trnloc.dat) - data
* [trnloc1.run](http://www.ampl.com/NEW/LOOP2/trnloc1.run) - script

Let's measure how fast it is:

{% highlight text %}
$ time ampl trnloc1.run
...
RE-SOLVING MASTER PROBLEM

CPLEX 12.4.0.0: optimal integer solution; objective 5735206.9
...
real	0m0.740s
user	0m1.072s
sys	0m0.136s
{% endhighlight %}

To apply the integer L-shaped method I took the original location-transportation
problem ([trnloc.mod](http://www.ampl.com/NEW/LOOP2/trnloc.mod)) without
Benders, added a dummy scenario set <code>SCEN</code> and marked variables
that should belong to a subproblem with <code>suffix stage 2</code>.
I also modified the objective and constraints introducing scenario indexing where
necessary. So this has become a deterministic equivalent of an SP problem with
a single scenario:

{% highlight python %}
# -----------------------------------------
# LOCATION-TRANSPORTATION PROBLEM
# WRITTEN AS A SINGLE-SCENARIO "SP" PROBLEM
# -----------------------------------------

set ORIG;   # shipment origins (warehouses)
set DEST;   # shipment destinations (stores)
set SCEN = {1}; # dummy scenario set 

param supply {ORIG} > 0;
param demand {DEST} > 0;

var Build {ORIG} binary;    # 1 iff it is built
param fix_cost {ORIG} > 0;

var Ship {ORIG,DEST,SCEN} >= 0 suffix stage 2;  # amounts shipped
param var_cost {ORIG,DEST} > 0;

minimize Total_Cost:
   sum {i in ORIG} fix_cost[i] * Build[i] +
   sum {i in ORIG, j in DEST} var_cost[i,j] * Ship[i,j,1];

subj to Supply {i in ORIG, s in SCEN}:
   sum {j in DEST} Ship[i,j,s] <= supply[i] * Build[i];

subj to Demand {j in DEST, s in SCEN}:
   sum {i in ORIG} Ship[i,j,s] = demand[j];
{% endhighlight %}

With these changes it is possible to use smpswriter to convert the problem to
SMPS and pass it to FortSP which can be done in a few lines of AMPL code:

{% highlight python %}
model trnloc-scenario.ampl;
data trnloc.dat;

suffix stage IN;
option auxfiles rc;
write gtrnloc1;

shell './smpswriter trnloc1';
shell './fortsp --smps-obj-sense=minimize --sp-alg=intlshaped trnloc1';
{% endhighlight %}

Let's run this script and measure time:

{% highlight text %}
$ time ampl trnloc-modern-benders.ampl
...
Optimal solution found, objective = 5.73521e+06.
Solution time = 0.075748 s.

real	0m0.091s
user	0m0.072s
sys	0m0.012s
{% endhighlight %}

<p>
<strike>And fortunately for my case</strike> as expected, the modern Benders
decomposition is much faster in this example. Of course this is a very small
problem and the overheads in the implementation of the original Benders
decomposition will be smaller relative to the solution time in large
problems. But I think it is as good illustration.
</p>

Here are the files I used to test the modern Benders decomposition:
* [trnloc-scenario.mod](/files/trnloc-scenario.ampl) - model
* [trnloc.dat](http://www.ampl.com/NEW/LOOP2/trnloc.dat) - data (the same as before)
* [trnloc-modern-benders.ampl](/files/trnloc-modern-benders.ampl) - script

Apart from performance benefits this approach requires much less modifications
to the original problem compared to the implementation of Benders in AMPL
itself. In fact the model [trnloc-scenario.mod](/files/trnloc-scenario.ampl)
can be used without Benders with any solver in which case stage suffixes are
simply ignored. It can be improved even more by making scenario set optional.
Then the only modification to the model would be to partition your variables
into master and subproblem using the stage suffix.
