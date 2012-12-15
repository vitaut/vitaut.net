---
layout: post
title: Making string formatting fast
date: 2012-12-15
---

{{ page.title }}
================

In [one of the previous posts](http://zverovich.net/2012/12/12/a-better-string-formatting-library-for-cplusplus.html)
I've introduced [format](https://github.com/vitaut/format), a new formatting
library for C++ and briefly described its API on a few examples.
In this post I'll compare its performance with other libraries
and discuss some design aspects that make it fast.

To measure performance I used a benchmark by [Chris Foster](https://github.com/c42f),
the author of [tinyformat](https://github.com/c42f/tinyformat) library.
I changed the benchmark to include my new formatting library and ran it three
times taking the best time for each method:

{% highlight text %}
============== ========
test name      run time
============== ========
libc printf     1.28s
std::ostream    2.09s
format          1.32s
tinyformat      2.55s
boost::format  10.42s
============== ========
{% endhighlight %}

The instructions on running the tests are available
[here](https://github.com/vitaut/format#running-the-tests) so you can easily
reproduce the results.

As you can see, the format library is only slightly slower then `printf` and
both methods are considerably faster than the alternatives. Boost Format
is exceptionally slow, almost 8 times slower than the format library.
Poor performance of Boost Format is also confirmed
[here](http://accu.org/index.php/journals/1539), see section
Efficiency.

Now that we see that the format library is almost as fast as plain old
`printf`, let's see how it is achieved without compromising safety
and extensibility.

One of the main things that affects performance is dynamic memory allocation.
As shown in [this article](http://accu.org/index.php/journals/1539) Boost
Format makes lots of allocations (from 16 to 41 depending on a compiler) for
a simple formatting operation. FastFormat library does from 1 to 3
allocations for the same example. The format library can avoid any
allocation if the number of format arguments is less or equal to 10
and the output fits into a 500 character buffer. These limits are tentative
and can be easily adjusted if necessary.

To avoid memory allocation it is necessary that all the formatting arguments
were provided at once. Consider the following example:

{% highlight c++ %}
boost::format fmter("%1%-%2%");
fmter % std::string("X");
fmter % 37;
{% endhighlight %}

As you can see, Boost Format allows passing arguments in different statements.
I think that the combination of this feature with positional arguments support
is the main reason why Boost Format is so slow. Notice that we pass a
temporary `std::string` as the first argument. This temporary is destroyed
at the end of the full expression in which it appears. Boost Format has two
options: either save the argument and format it later or format it immediately
according to all the specifications for this argument in the format string
and store the output somewhere. Both alternatives are very inefficient.

This particular example may look artificial because there is no need to
construct a temporary string here, but a temporary string may be returned by
some function instead.

`Printf` on the other hand takes all formatting arguments at once, but it
only support built-in types:

{% highlight c++ %}
printf("%s-%d", std::string("X").c_str(), 37);
{% endhighlight %}

`Printf` has the advantage that it doesn't have to worry about the lifetime
of the arguments, so there is no need to copy them.

So it is clear that for the formatting to be efficient all the arguments
should be supplied at once. But how can it be done if the arguments are
passed using an overloaded operator? I've found the solution to this problem
in [Clang](http://clang.llvm.org/)'s source code, namely
[DiagnosticEngine](http://clang.llvm.org/doxygen/classclang_1_1DiagnosticsEngine.html).
The main idea is that a formatting function returns a temporary object that
accepts arguments through overloaded operator `<<` and the formatting is
performed in the destructor of this temporary object.

Here is an annotated example that uses the format library:

{% highlight c++ %}
   fmt::Format("{0}-{1}") << std::string("X") << 37;
// ^ Format returns a     ^ formatter receives     ^ formatter is
//   formatter object       arguments                destroyed
{% endhighlight %}

In this case the formatting happens before the temporary string is destroyed.
(There is one more detail that makes it possible, but I'll discuss it in a
different post.) So there is no need to copy arguments, it is enough to store
references or pointers to them and use when necessary avoiding dynamic memory
allocations. This is the main thing that makes format so fast.

Another thing that allows format to avoid dynamic allocations in many cases is
a special array data structure optimized for small size. If the number of
elements is smaller than some number defined at compile time this data
structure stores them in a fixed sized array in the object itself.
It uses dynamic allocation for larger sizes and can grow as `std::vector`.

The rest is just careful implementation and avoiding unnecessary work.
For example, my initial implementation used `snprintf` for all built-in
types which was inefficient because it required constructing a new format
string for each argument that had to be parsed by `snprintf`. This was
a lot of extra work, so the new implementation formats integers, strings
and characters itself and only uses `snprintf` to format floating-point
numbers. It might be possible to get additional improvement by using
[`dtoa`](http://www.netlib.org/fp/dtoa.c) function written by my colleague
David Gay instead of `snprintf`.

I've done profiling of the speed test executable used in the benchmark with
[gperftools](http://code.google.com/p/gperftools/) and here are the results:

{% highlight text %}
Total: 342 samples
      86  25.1%  25.1%      153  44.7% ___printf_fp
      55  16.1%  41.2%      317  92.7% format::Formatter::DoFormat
      43  12.6%  53.8%      202  59.1% _IO_vfprintf_internal
      43  12.6%  66.4%       52  15.2% hack_digit.14957
      15   4.4%  70.8%       15   4.4% __memmove_ssse3_back
      12   3.5%  74.3%      239  69.9% format::Formatter::FormatDouble
       9   2.6%  76.9%        9   2.6% __mpn_mul_1
       9   2.6%  79.5%      338  98.8% speedTest
       8   2.3%  81.9%        8   2.3% __mpn_extract_double
       6   1.8%  83.6%        6   1.8% __strchrnul
       6   1.8%  85.4%        6   1.8% format::Formatter::FormatInt
       5   1.5%  86.8%        6   1.8% _IO_old_init
       5   1.5%  88.3%        5   1.5% _IO_str_init_static_internal
       5   1.5%  89.8%      227  66.4% ___vsnprintf_chk
       4   1.2%  90.9%        4   1.2% _IO_default_xsputn_internal
       4   1.2%  92.1%        9   2.6% _IO_no_init
       4   1.2%  93.3%        4   1.2% _init
       3   0.9%  94.2%        9   2.6% _IO_fwrite_internal
       3   0.9%  95.0%        3   0.9% __GI___isinf
       3   0.9%  95.9%        3   0.9% __strlen_sse2
       3   0.9%  96.8%      329  96.2% format::ActiveFormatter::~ActiveFormatter
       2   0.6%  97.4%        6   1.8% _IO_new_file_xsputn
       2   0.6%  98.0%        2   0.6% __mempcpy_sse2
       2   0.6%  98.5%        2   0.6% __strlen_sse2_pminub
       1   0.3%  98.8%        1   0.3% __GI___isnan
       1   0.3%  99.1%        7   2.0% __find_specmb
       1   0.3%  99.4%        1   0.3% __libc_write
       1   0.3%  99.7%        1   0.3% __write_nocancel
       1   0.3% 100.0%        1   0.3% munmap_chunk
{% endhighlight %}

The second column gives percentage of profiling samples in this function and
the fifth gives percentage of profiling samples in this function and its
callees. As can be seen from the profile about 70% of samples point to
formatting of `double`s (`FormatDouble`). `FormatInt` which does integer
and pointer formatting looks pretty efficient. `DoFormat` does most of the
job parsing the format string, copying the literal parts and formatting
strings and characters.

When I started the project I was not sure if it is possible to be as fast as
`printf` and at the same time be type safe, support user-defined types and
positional arguments. It turned out that it is possible with the right design
and careful implementation.
