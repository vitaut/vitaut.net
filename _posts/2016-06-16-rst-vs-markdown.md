---
layout: post
title: reStructuredText vs Markdown for documentation
date: 2016-06-16
---

{{ page.title }}
================

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img border="0" src="/img/our-their.jpg" width="320"
       title="Let the holy markup language war begin!">
</div>

In this post I am going to share my experience of using
[Markdown](https://en.wikipedia.org/wiki/Markdown) and
[reStructuredText](https://en.wikipedia.org/wiki/ReStructuredText) (RST)
for technical documentation. As a library developer I have to write a fair amount of
it, for example, the [fmt library documentation](http://fmtlib.net),
and I've used both languages extensively. In fact, I'm writing this blog post
in Markdown.

At first sight RST and Markdown look very similar. Both are lightweight markup languages
that emphasize plain-text readability. Both are widely used for API documentation,
RST in [Sphinx](http://www.sphinx-doc.org/en/stable/), the standard Python
documentation system, and Markdown in [Doxygen](http://www.stack.nl/~dimitri/doxygen/)
(optionally), [MkDocs](http://www.mkdocs.org/), the
[Rust Standard Library](https://doc.rust-lang.org/std/) documentation, and other.

So what are the differences? According to John Gruber, the inventor of Markdown,
"Markdown’s syntax is intended for one purpose: to be used as a format for writing for the web."
([source](http://daringfireball.net/projects/markdown/syntax#philosophy)) and, in particular,
it supports inline HTML. reStructuredText on the other hand is specifically designed for writing
technical documentation. But what does it mean in practice?

The first important difference is extensibility and semantics. Since Markdown is designed
for the web, HTML is the way to extend it. If there is something you can't express with the
lightweight markup you have to write HTML (actually there is another option which I'll cover later).
It has its advantages and disadvantages.
It's great when all you need is to produce a web page and that's why I use Markdown right now.
However, it's not so great when you need to write an API documentation.

reStructuredText provides standard extension mechanisms called
[directives](http://docutils.sourceforge.net/docs/ref/rst/directives.html) and
[roles](http://docutils.sourceforge.net/docs/ref/rst/roles.html)
which make all the difference. For example, you can use the math role to write
a mathematical equation:

{% highlight rst %}
The area of a circle is :math:`A_\text{c} = (\pi/4) d^2`.
{% endhighlight %}

and it will be rendered nicely both in HTML using a Javascript library such
as MathJax and in PDF via LaTeX or directly. With Markdown you'll probably have
to use MathJax and HTML to PDF conversion which is suboptimal or something like
Pandoc to convert to another format first.

In addition to this, Sphinx provides a set of roles and directives for different
language constructs, for example, `:py:class:` for a Python class or `:cpp:enum:`
for a C++ enum. This is very important because it adds semantics to otherwise
purely presentational markup:


{% highlight rst %}
The :meth:`str.format` method and the :class:`Formatter` class share the same
syntax for format strings (although in the case of :class:`Formatter`,
subclasses can define their own format string syntax).
{% endhighlight %}

I briefly mentioned this in my
[review of the Julia language](http://zverovich.net/2016/05/13/giving-up-on-julia.html)
which uses rudimentary Markdown in its apidocs, but I'm not sure many people
understood it so I'm glad to have an opportunity to elaborate.

From the practical standpoint, it gives you cross-references with nice features
like overload resolution for languages that support overloading and simplifies
documentation of heterogeneous projects. And you can use the default roles to
avoid writing them manually most of the time.

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img border="0" src="/img/flavor.jpg" width="240"
       title="Sometimes less is more.">
</div>

Although Markdown itself doesn't seem to provide similar standard extension
mechanisms like RST's roles and directives, it is still possible to extend its
syntax. This brings us to one of the issues with Markdown:
there are almost as many "flavors" of it as there are flavors of Lay's.
With a zoo of subtly incompatible and even incomplete implementations of Markdown
you have to keep in mind which version you are using in
order to avoid mistakes.
The [Markdown Flavors](https://github.com/jgm/CommonMark/wiki/Markdown-Flavors)
page lists over 30!

As a markup format, Markdown is quite reasonable. A few issues that I had is
invisible markup which IMHO is a very bad idea:

> When you do want to insert a `<br />` break tag using Markdown, you end a
> line with two or more spaces, then type return.

weird image syntax, some [escaping issues](https://github.com/github/markup/issues/363),
and compatibility problems that I mentioned earlier.

The only notable issue with RST that I had was inability to use nested
markup. It was not critical though and I ended up using styles which turned out to be
better than manual formatting anyway.

And last but not least is support for multiple languages. Even if your project
is written in a single language right now, chances are that you may want to provide
an API for a different language in the future. Being able to use the same documentation
system may save you and your users a lot of time. Unfortunately few documentation
systems support multiple languages. Doxygen and Sphinx are arguably
the most popular polyglot systems, at least among those that use Markdown and RST.
Sphinx produces way better output while Doxygen works with more languages.
Note that C++ support in Sphinx improved considerably in
[version 1.4 and later](http://www.sphinx-doc.org/en/stable/changes.html#release-1-4-released-mar-28-2016)
thanks to amazing work by [Jakob Lykke Andersen](https://github.com/jakobandersen).
Currently Sphinx supports Python, C, C++ and Javascript out-of-the box and Java
(and other JVM-based languages) via [javasphinx](https://bronto.github.io/javasphinx/).

So why so many documentation systems are using Markdown? I think the reason lies
in its simplicity. It is easy to add support for some "flavor" or subset of Markdown,
possibly extending it for your own purposes. While it works in a short term, it
creates a headache for users who have to learn quirks of yet another Markdown
implementation and struggle with its limitations. Writing for the web is what
Markdown was designed for and where it shines.

In contrast, Sphinx and RST were designed for writing documentation and have the
advantage of consistency, extensibility, semantic rather than presentational markup,
support for multiple languages (*), standard API. So I think they are a better
choice in a long term. If you are writing such documentation, I encourage you to
try [Sphinx](http://www.sphinx-doc.org/en/stable/) and if you are developing a
documentation system for a language, consider adding a
[Sphinx domain](http://www.sphinx-doc.org/en/stable/domains.html) for it.

[*] Although Doxygen also has it.
