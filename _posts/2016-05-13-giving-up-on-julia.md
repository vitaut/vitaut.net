---
layout: post
title: Giving up on Julia
date: 2016-05-13
---

{{ page.title }}
================

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img border="0" src="/img/optional-ts.jpg" width="240" title="Optional type system">
</div>

When I first learned about the Julia programming language, I became very
enthusiastic about it. Just look at the feature list from their website:

* Multiple dispatch: providing ability to define function behavior across
  many combinations of argument types
* Dynamic type system: types for documentation, optimization, and dispatch
* Good performance, approaching that of statically-compiled languages like C
* Built-in package manager
* Lisp-like macros and other metaprogramming facilities
* Call Python functions: use the PyCall package
* Call C functions directly: no wrappers or special APIs
* Powerful shell-like capabilities for managing other processes
* Designed for parallelism and distributed computation
* Coroutines: lightweight “green” threading
* User-defined types are as fast and compact as built-ins
* Automatic generation of efficient, specialized code for different argument types
* Elegant and extensible conversions and promotions for numeric and other types
* Efficient support for Unicode, including but not limited to UTF-8
* MIT licensed: free and open source

Other than the dynamic type system, what not to like about this?

However, as I learned more about the language and experimented with it,
I because increasingly disenchanted with it, and I'll explain why in this post.

Performance
-----------

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img border="0" src="/img/jit.jpg" width="240">
</div>

The first disappointment came when I looked at the microbenchmarks, results of which are
reported on the Julia website. Even cursory glance over one of them revealed major flaws
which I reported in [this issue](https://github.com/JuliaLang/julia/issues/4662).
Others reported [similar](https://github.com/JuliaLang/julia/issues/13042)
[issues](https://github.com/JuliaLang/julia/pull/14229) elsewhere.

Being considerably slower than C or C++ is nothing to be ashamed of. Most languages are.
What's disappointing is the striking difference between the claimed
performance and the observed one. For example, a trivial hello world program
in Julia runs ~27x slower than Python's version and ~187x slower than the one in C.
Note that these are results on Linux and, although I don't use Windows myself, I've been
told that the difference on that platform is even worse.

{% highlight julia %}
# test.jl
println("Hello, World!")
{% endhighlight %}

{% highlight python %}
# test.py
print("Hello, World!")
{% endhighlight %}

{% highlight c %}
#include <stdio.h>

int main() {
  printf("Hello, World!\n");
}
{% endhighlight %}

{% highlight none %}
$ time julia test.jl
Hello, World!

real	0m0.371s
user	0m0.240s
sys	0m0.312s

$ time python test.py
Hello, World!

real	0m0.014s
user	0m0.004s
sys	0m0.004s

$ gcc -O3 test.c
$ time ./a.out
Hello, World!

real	0m0.002s
user	0m0.000s
sys	0m0.000s
{% endhighlight %}

If you ignore startup time, Julia might have good performance for simple array/matrix
operations and loops, but we already know how to [make them fast in Python](
https://www.ibm.com/developerworks/community/blogs/jfp/entry/Python_Meets_Julia_Micro_Performance)
and other languages.

And it's not just scripts, Julia's REPL which should ideally be optimized for
responsiveness takes long to start and has noticeable JIT (?) lags.
What's even more worrying is that there doesn't seem to be much progress there.
The REPL was a pain to use a year ago and it still is.

In addition to that, Julia programs have excessive memory consumption.
The above hello world example in Julia uses 18x more memory than Python
and 92x more memory than the C version.

Possible reason for this is the use of [LLVM](http://llvm.org/) for JIT. LLVM is great as a compiler backend
for statically-typed compiled languages, but it has been known not to work equally well in
the context of dynamic languages. [Unladen Swallow](https://en.wikipedia.org/wiki/Unladen_Swallow) and
a recent [migration of WebKit away from LLVM](https://webkit.org/blog/5852/introducing-the-b3-jit-compiler/)
are notable examples.

Language
--------

While there are some nice features in the design of the language that one would
expect from a modern programming language (Go excluded), the syntax is not one of them.
It is quite obscure and can only be enjoyed if you are a big fan of MATLAB.
Of course, it's hard to compete with Python in readability, but the choice of unbalanced
`end`s for blocks and `::`s for attaching types makes the Julia code appear unnecessarily
noisy IMHO. It is often said that [code is read more
than it is written](https://blogs.msdn.microsoft.com/oldnewthing/20070406-00/?p=27343)
and in my opinion Julia has definitely room for improvement here. The expression syntax
is more reasonable, but there is still some unorthodox choice of operators, punctuators and
the syntax for multiline comments that creates WTF moments every now and then
(who has come up with this stuff: #= \ // $ ?).

One-based indexing is another [questionable design decision](https://github.com/JuliaLang/julia/issues/558).
While it may be convenient in some cases, it adds a source of mistakes and extra work when
interoperating with popular programming languages that all (surprise!) use 0-based indexing,
for example:

{% highlight julia %}
ret = @grb_ccall(delconstrs, Cint, (
                 Ptr{Void},
                 Cint,
                 Ptr{Cint}),
                 model, convert(Cint,numdel), idx.-1)
{% endhighlight %}

Of course, one might argue that Julia is not intended to be a general-purpose programming language,
but a language for numerical computing. However, as Python shows you don't have
to sacrifice one for the other.

And the last issue that I want to mention in this section is apidocs. The standard documentation
system is a step back even compared to [Doxygen](http://www.stack.nl/~dimitri/doxygen/),
not to mention [Sphinx](http://www.sphinx-doc.org/en/stable/). Instead of using
semantic markup it relies on rudimentary Markdown-based format with focus on presentation.
Apart from obvious limitations of Markdown, this makes documentation of heterogeneous
projects more difficult.

Safety
------

JNA- and ctypes-like FFI is convenient, there is no doubt about it. But making it the
default way to interface with native APIs is a major safety issue. C and C++ have
headers for a reason and redeclaring everything by hand is not only time-consuming,
but also error-prone. A little mistake in your `ccall` and you just happily segfaulted,
and that's an optimistic scenario. And now try to correctly wrap `strerror_r` or similar.
Interestingly, when trying to illustrate this I got a segfault just by using a code
from the Julia documentation with `libc` changed to `libc.so.6` because the original
example didn't work:

{% highlight julia %}
julia> val = ccall((:getenv, "libc.so.6"), Ptr{UInt8}, (Ptr{UInt8},), var)
signal (11): Segmentation fault
{% endhighlight %}

So this "feature" instead of eliminating boilerplate eliminates type checking.
In fact, there is more boilerplate per function in `ccall` than in, say,
[pybind11](https://github.com/pybind/pybind11).
This is another area where Python and even Java with their C API win. There is a way
to abuse FFI there too, but at least it's not actively encouraged.

Libraries
---------

Another area where Julia is lacking at the moment is libraries, including the standard
library. As [has been pointed out elsewhere](http://danluu.com/julialang/) "Base APIs outside of
the niche Julia targets often don’t make sense" and the general-purpose APIs are somewhat limited.

For example, text formatting is one of the most basic and commonly used language facilities
one could probably think of and Julia is even behind C++98 there. The standard library
provides `@printf` and `@sprintf` but they are not extensible.
You can't even make them [format a complex number](https://github.com/JuliaLang/julia/issues/346).
There is a rudimentary string interpolation, but in its current form it only seems
to be useful for very basic formatting.

Being macros, `@printf`/`@sprintf` generate custom code for every format string
in the hope that it will be more efficient than parsing it at runtime.
However, as [Stefan Karpinski wrote](http://stackoverflow.com/q/19783030/471164)
he had "hard enough time matching C, let alone beating it". To be more specific,
let's have a look at a simple printf example in C:

{% highlight c %}
void f(char *buffer, const char *a, double b) {
  sprintf(buffer, "this is a %s %15.1f", a, b);
}
{% endhighlight %}

It compiles to just a few instructions:

{% highlight asm %}
f:
.LFB23:
	.cfi_startproc
	movq	%rsi, %r8
	movl	$.LC0, %ecx
	movq	$-1, %rdx
	movl	$1, %esi
	movl	$1, %eax
	jmp	__sprintf_chk
	.cfi_endproc
{% endhighlight %}

And here's the Julia version:

{% highlight julia %}
function f(a, b)
  @sprintf("this is a %s %g", a, b)
end
{% endhighlight %}

If you run `code_native(f, (ASCIItString, Float64))` and look at the output, you'll
see almost 500 instructions (which I won't list here for obvious reasons leaving it as
an exercise for the reader). Now multiply this by the number of times `@(s)printf` is
called. Since text formatting is used very often, this may create enormous code bloat
problems. The C version may not be safe, but [there are safe alternatives that don't
sacrifice code compactness](https://github.com/fmtlib/fmt#compile-time-and-code-bloat).

The libraries for unit testing are also very basic, at least compared to the ones
in C++ and Java. FactCheck is arguably the most popular choice but, apart from
the weird API, it is quite limited and hardly developed any more.

Text formatting and unit testing are two areas that should be relevant to almost
any project. I'm sure there are some nice libraries in other areas, but lack of solid
infrastructure undermines the usability of the language and, in the case of unit
testing, reliability.

Development
-----------

I am no stranger to large unfamiliar codebases, but when considering whether to
contribute to Julia and looking at the repo, I found a mish-mash of C, C++, Julia
and Lisp, which put me off even though I had some experience with LLVM used in
the backend. The reason for that is not dislike of any particular language in the
set but that such a mix of languages in one project requires people with a unique
expertise or working within a narrow scope. As [Dan Luu put it](http://danluu.com/julialang/):

> A small team of highly talented developers who can basically hold all of the code
> in their collective heads can make great progress while eschewing anything that
> isn’t just straight coding at the cost of making it more difficult for other people
> to contribute. Is that worth it? It’s hard to say.

I am not sure that such approach scales
very well and other people [reported slowdown in Julia development
](http://www.davideaversa.it/2015/12/the-most-promising-languages-of-2016/):

> Julia instead is slowing down and it disappeared from my radar during the last 9 months.

Summary
-------

To summarize, I see the following problems with the language and its infrastructure right now:

* Performance issues including long startup time and JIT lags
* Somewhat obscure syntax and problems with interoperability with other languages
* Poor text formatting facilities in the language and lack of good unit testing frameworks
* Unsafe interface to native APIs by default
* Unnecessarily complicated codebase and insufficient attention to bug fixing

Despite all this, I think the language can find
its niche as an open-source alternative to MATLAB because its syntax might
be appealing to MATLAB users. I doubt it can seriously challenge
Python as the de-facto standard for numerical computing.
Although I decided to switch my attention to other new languages such as Rust which
show more promise, I wish Julia developers the best of luck and hope that a bit of
(hopefully fair) criticism will be useful and at least some of the issues can be addressed
in the future versions of the language.

**Update**: Changed `AbstractString` to `ASCIIString` as suggested by 3JPLW on Hacker News.
This brings the instruction count down but highlights unnecessarily complicated string
API in Julia 0.4.
