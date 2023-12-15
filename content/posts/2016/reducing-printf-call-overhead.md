---
title: Reducing printf call overhead with variadic templates
date: 2016-11-05
aliases: ['/2016/11/05/reducing-printf-call-overhead.html']
---

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img src="/img/performance.jpg" width="200"
       title="printf, I'm looking at you">
</div>

A few days ago I learned about a cool new project called
[`printpp`](https://github.com/tfc/pprintpp) which is a `printf` format string
preprocessor. It rewrites format strings from brace-delimited format into
`printf` format at compile time. Although the project mentions Python
formatting, the only thing they seem to have in common is delimiters.

Great thing about this approach is that it doesn't add any overhead to `printf`.
For example, the code

```c++
int main() {
  pprintf("{} hello {s}! {}\n", 1, "world", 2);
}
```

where `pprintf` is a macro defined by `pprintpp`, compiles to

```
0000000000400450 <main>:
  400450:       48 83 ec 08             sub    $0x8,%rsp
  400454:       41 b8 02 00 00 00       mov    $0x2,%r8d
  40045a:       b9 04 06 40 00          mov    $0x400604,%ecx
  40045f:       ba 01 00 00 00          mov    $0x1,%edx
  400464:       be 10 06 40 00          mov    $0x400610,%esi
  400469:       bf 01 00 00 00          mov    $0x1,%edi
  40046e:       31 c0                   xor    %eax,%eax
  400470:       e8 bb ff ff ff          callq  400430 <__printf_chk@plt>
  400475:       31 c0                   xor    %eax,%eax
  400477:       48 83 c4 08             add    $0x8,%rsp
  40047b:       c3                      retq
```

This is very nice in terms of binary code size, but can we do better in terms
of performance if we don't limit ourselves to `printf`? Notice that the compiler
generated a call to
[`__printf_chk`](https://github.com/lattera/glibc/blob/master/debug/printf_chk.c).
Let's have a look at this function:

```c++
/* Write formatted output to stdout from the format string FORMAT.  */
int
___printf_chk (int flag, const char *format, ...)
{
  va_list ap;
  int done;

  _IO_acquire_lock_clear_flags2 (stdout);
  if (flag > 0)
    stdout->_flags2 |= _IO_FLAGS2_FORTIFY;

  va_start (ap, format);
  done = vfprintf (stdout, format, ap);
  va_end (ap);

  if (flag > 0)
    stdout->_flags2 &= ~_IO_FLAGS2_FORTIFY;
  _IO_release_lock (stdout);

  return done;
}
```

Unsurprisingly this function does little but call `vfprintf`. Calling an
overload that takes `va_list` is common for functions that use varargs. Let's
use [Google Benchmark](https://github.com/google/benchmark) to measure the
effect of this extra call and vararg processing:

```c++
int __attribute__((noinline)) test_vprintf(const char *f, std::va_list) {
  benchmark::DoNotOptimize(f);
  return 0;
}

int test_printf(const char *format, ...) {
  std::va_list args;
  va_start(args, format);
  int result = test_vprintf(format, args);
  va_end(args);
  return result;
}

void varargs(benchmark::State& state) {
  while (state.KeepRunning())
    test_printf("%d", 42);
}

BENCHMARK(varargs);
```

and let's compare this to a method of passing formatting arguments via variadic
templates implemented in [the fmt library](https://github.com/fmtlib/fmt):

```c++
void __attribute__((noinline)) test_vprint(const char *f,
                                           fmt::format_args) {
  benchmark::DoNotOptimize(f);
}

typedef fmt::BasicFormatter<char> Formatter;

template <typename ... Args>
inline void test_print(const char *format, const Args & ... args) {
  test_vprint(format, fmt::make_format_args<Formatter>(args...));
}

void fmt_variadic(benchmark::State &state) {
  while (state.KeepRunning())
    test_print("{}", 42);
}

BENCHMARK(fmt_variadic);
```

Note that I'm using the experimental `std` branch of the fmt library for
cleaner C++11 API, but the results should be the same for the stock version
which is C++98 compatible.

The `test_print` function calls `make_format_args`
to place formatting arguments in an `fmt::format_args` object that is passed to
`test_vprint`. This looks very similar to the `printf` case but because
`test_print` and `fmt::make_format_args` are inline, compiler optimizes them away
and the effect is that the arguments are placed into `fmt::format_args`
at the caller site. And since `fmt::format_args` is not parameterized on
format argument types, there is no template code bloat.

Running this benchmark on my Early 2015 MacBook Pro gives the following result:

```
Run on (4 X 3100 MHz CPU s)
2016-11-05 17:32:39
Benchmark                 Time           CPU Iterations
-------------------------------------------------------
varargs                   5 ns          5 ns  133920031
fmt_variadic              2 ns          2 ns  355192920
```

The `fmt_variadic` method that uses variadic templates is 2.5 times faster but
the absolute difference is just 3ns per call. Does it really matter? To answer
this question, let's compare it to the total formatting time:

```c++
void test_sprintf(benchmark::State &state) {
  char buffer[64];
  while (state.KeepRunning())
    std::sprintf(buffer, "%d", 42);
}

BENCHMARK(test_sprintf);

void test_format(benchmark::State &state) {
  while (state.KeepRunning())
    fmt::format("{}", 42);
}

BENCHMARK(test_format);
```

```
Benchmark                 Time           CPU Iterations
-------------------------------------------------------
varargs                   5 ns          5 ns  133920031
fmt_variadic              2 ns          2 ns  355192920
test_sprintf             73 ns         72 ns    9571341
test_format              47 ns         47 ns   14373805
```

As you can see formatting is so fast that even varargs overhead is nontrivial.
Using varargs would slow down `fmt::format` by more than 6% and this is not
even the most efficient API fmt provides, because it returns `std::string`.

The situation becomes even more interesting when you take into account
positional arguments. The arguments in `va_list` can only be accessed
sequentially and need to be copied by a `printf`-like function to an array for
efficient access by index.

With variadic templates nothing prevents storing arguments in an array on
the caller side and this is exactly what fmt does. The effect is
easy to see on this benchmark:

```c++
void test_sprintf_pos(benchmark::State &state) {
  char buffer[64];
  while (state.KeepRunning())
    std::sprintf(buffer, "%1$d", 42);
}

BENCHMARK(test_sprintf_pos);

void test_format_pos(benchmark::State &state) {
  while (state.KeepRunning())
    fmt::format("{0}", 42);
}

BENCHMARK(test_format_pos);
```

```
Benchmark                 Time           CPU Iterations
-------------------------------------------------------
varargs                   5 ns          5 ns  133920031
fmt_variadic              2 ns          2 ns  355192920
test_sprintf             73 ns         72 ns    9571341
test_format              47 ns         47 ns   14373805
test_sprintf_pos         97 ns         97 ns    7242253
test_format_pos          49 ns         49 ns   13841652
```

Using positional arguments slows down `sprintf` by 33% and `fmt::format` by
only 4%.

Of course you don't get all this performance improvement completely for free.
The formatting code

```c++
int main() {
  fmt::print("{} hello {}! {}\n", 1, "world", 2);
}
```

compiles to the following binary code:

```
$ g++ test.cc -O3 -Lfmt -lfmt -fno-stack-protector
$ objdump -d a.out
...
0000000000401210 <main>:
  401210:       48 83 ec 38             sub    $0x38,%rsp
  401214:       be a2 02 00 00          mov    $0x2a2,%esi # <- type info
  401219:       bf c4 3a 41 00          mov    $0x413ac4,%edi
                                          # <- "{} hello {}! {}\n"
  40121e:       48 89 e2                mov    %rsp,%rdx # <- arg array ptr
  401221:       c7 04 24 01 00 00 00    movl   $0x1,(%rsp) 3 <- 1 (1st arg)
  401228:       48 c7 44 24 10 d5 3a    movq   $0x413ad5,0x10(%rsp)
  40122f:       41 00                     # <- "world" (2nd arg)
  401231:       c7 44 24 20 02 00 00    movl   $0x2,0x20(%rsp)
  401238:       00                        # <- 2 (3rd arg)
  401239:       e8 32 0c 00 00          callq  401e70 <_ZN3fmt5printENS_15BasicCStringRefIcEENS_7ArgListE>
  40123e:       31 c0                   xor    %eax,%eax
  401240:       48 83 c4 38             add    $0x38,%rsp
  401244:       c3                      retq
```

Since the earlier `printpp`'s `objdump` output seem to be obtained with GCC on
Linux I use the same platform here to get a meaningful comparison. I also
passed `-fno-stack-protector` to gcc because there was no stack protection code
in `printpp`'s case either.

Compared to `printf`, `fmt::print` requires 9 extra bytes to place arguments
in the array on stack, 3 more bytes to pass the pointer to the argument array,
and 3 fewer bytes due to no return value. So the total difference is just 9
bytes and the number of CPU instructions is the same.

The cool thing is that the type information is effectively passed for free
(compared to `printf`) because it takes the same amount of code as passing the
`flag` argument to [`__printf_chk`](http://refspecs.linuxbase.org/LSB_4.1.0/LSB-Core-generic/LSB-Core-generic/libc---printf-chk-1.html).

So replacing varargs with variadic templates may give nontrivial performance
improvement if you are willing to accept small increase in binary code.
If you want to keep your binaries as small as possible, but still want to enjoy
somewhat improved type safety compared to `printf`, check out
[pprintpp](https://github.com/tfc/pprintpp).

Not relying on `printf` also facilitates extensibility and, in particular,
formatting of user-defined types, but that's a topic for another blog post.

Benchmarks used in this post are available in the [format-benchmark](https://github.com/fmtlib/format-benchmark) repository
(see `vararg-benchmark.cc`).
