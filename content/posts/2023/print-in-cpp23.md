---
title: std::print in C++23
date: 2023-12-24
---

![](/img/print.webp#floatright)

I just realized that 2023 is almost over and I haven't posted about the most
important feature of C++23. Which feature is that, you might ask? Unlike C++20
which had a bunch of massive new features like modules, concepts and the third
one, C++23 feels incremental.

The C++23 feature I am referring to is, of course,
[`std::print`][1], modeled after `fmt::print` from [the {fmt} library][2].
It feels deceptively small but it took ~3 years to get through the C++ committee
and it changes the most important aspect of C++, the way we write Hello World:

```c++
#include <print>

int main() {
  std::print("Hello, world!\n");
}
```

[1]: https://en.cppreference.com/w/cpp/io/print
[2]: https://github.com/fmtlib/fmt

`std::print` is fairly small in terms of the standard wording because it builds
on the foundation of C++20 [`std::format`][3]. It is also easy to implement with
libc++ already shipping it in version 17:
[godbolt](https://www.godbolt.org/z/5M4be4Kcs).

The API of `std::print` resembles that of `printf` but it has a number of
important advantages compared to both stdio and iostreams.

## Safety

`std::print` is fully type-safe with errors in format strings [caught at compile
time][5] by default. This eliminates the whole class of errors and a [common
source of vulnerabilities][4].

[3]: https://en.cppreference.com/w/cpp/utility/format/format
[4]: https://en.wikipedia.org/wiki/Uncontrolled_format_string
[5]: http://localhost:1313/posts/2021/safe-formatting-api/

```c++
std::print("{:d}", "I am not a number"); // compile error
```

## Unicode

`std::print` provides portable Unicode support. All you need to do is make
sure that the string literal encoding is UTF-8. This is normally the default on
POSIX and on Windows/MSVC it is enabled with a single compiler switch, `/utf-8`.
It is a good idea to use `/utf-8` even if you don't need `std::print`.

For example ([godbolt](https://www.godbolt.org/z/Ga4xE4sMf)):

```c++
#include <print>

int main() {
  std::print("Hello, {}!\n", "world");
  std::print("Olá, {}!\n", "Mundo");
  std::print("你好{}！\n", "世界");
}
```

prints:

```
Hello, world!
Olá, Mundo!
你好世界！
```

Neither stdio nor iostreams can be used to reliably print Unicode on Windows
and in fact very few languages do it correctly. One of notable exceptions is
Rust where `print!` works great with Unicode.

## Performance

Performance depends on the quality of implementation but there are important
factors that make `std::print` faster than its stdio and iostreams counterparts
by design:

* [More efficient argument passing mechanism][6] which is particularly
  beneficial for positional arguments.
* Locale-independent formatting by default. This has both reliability and
  performance implications.
* `std::print` can write directly to a C stream (`FILE`) bypassing the
  inefficient iostream buffering and extra synchronization.

Here are some [benchmark results][7] comparing {fmt}'s implementation of `print`
with other libraries:

| Library           | Method        | Run Time, s |
|-------------------|---------------|-------------|
| libc              | printf        |   0.91      |
| libc++            | std::ostream  |   2.49      |
| {fmt} 9.1         | fmt::print    |   0.74      |

On this benchmark `fmt::print` is ~20% faster than `printf` from Apple's libc.

[6]: https://vitaut.net/posts/2016/reducing-printf-call-overhead/
[7]: https://github.com/fmtlib/fmt?tab=readme-ov-file#benchmarks

## Atomicity

Like in `printf`, parts of messages printed with `std::print` from multiple
threads don't interleave. In iostreams they can interleave unless you use C++20
`std::syncstream`.

## Binary size

Again, this depends on the quality of implementation, but once `std::print`
implementations are stable and moved from headers to libraries we can expect
compact per-call binary code. Here is an example from the paper that uses {fmt}
that has already been optimized for binary size:

```c++
void printf_test(const char* name) {
  printf("Hello, %s!", name);
}
```

```text
__Z11printf_testPKc:
       0:       55      pushq   %rbp
       1:       48 89 e5        movq    %rsp, %rbp
       4:       48 89 fe        movq    %rdi, %rsi
       7:       48 8d 3d 08 00 00 00    leaq    8(%rip), %rdi
       e:       31 c0   xorl    %eax, %eax
      10:       5d      popq    %rbp
      11:       e9 00 00 00 00  jmp     0 <__Z11printf_testPKc+0x16>
```

```c++
void ostream_test(const char* name) {
  std::cout << "Hello, " << name << "!";
}
```

```text
__Z12ostream_testPKc:
       0:       55      pushq   %rbp
       1:       48 89 e5        movq    %rsp, %rbp
       4:       41 56   pushq   %r14
       6:       53      pushq   %rbx
       7:       48 89 fb        movq    %rdi, %rbx
       a:       48 8b 3d 00 00 00 00    movq    (%rip), %rdi
      11:       48 8d 35 6c 03 00 00    leaq    876(%rip), %rsi
      18:       ba 07 00 00 00  movl    $7, %edx
      1d:       e8 00 00 00 00  callq   0 <__Z12ostream_testPKc+0x22>
      22:       49 89 c6        movq    %rax, %r14
      25:       48 89 df        movq    %rbx, %rdi
      28:       e8 00 00 00 00  callq   0 <__Z12ostream_testPKc+0x2d>
      2d:       4c 89 f7        movq    %r14, %rdi
      30:       48 89 de        movq    %rbx, %rsi
      33:       48 89 c2        movq    %rax, %rdx
      36:       e8 00 00 00 00  callq   0 <__Z12ostream_testPKc+0x3b>
      3b:       48 8d 35 4a 03 00 00    leaq    842(%rip), %rsi
      42:       ba 01 00 00 00  movl    $1, %edx
      47:       48 89 c7        movq    %rax, %rdi
      4a:       5b      popq    %rbx
      4b:       41 5e   popq    %r14
      4d:       5d      popq    %rbp
      4e:       e9 00 00 00 00  jmp     0 <__Z12ostream_testPKc+0x53>
      53:       66 2e 0f 1f 84 00 00 00 00 00   nopw    %cs:(%rax,%rax)
      5d:       0f 1f 00        nopl    (%rax)
```

```c++
void print_test(const char* name) {
  print("Hello, {}!", name);
}
```

```text
__Z10print_testPKc:
       0:	55 	pushq	%rbp
       1:	48 89 e5 	movq	%rsp, %rbp
       4:	48 83 ec 10 	subq	$16, %rsp
       8:	48 89 7d f0 	movq	%rdi, -16(%rbp)
       c:	48 8d 3d 19 00 00 00 	leaq	25(%rip), %rdi
      13:	48 8d 4d f0 	leaq	-16(%rbp), %rcx
      17:	be 0a 00 00 00 	movl	$10, %esi
      1c:	ba 0d 00 00 00 	movl	$13, %edx
      21:	e8 00 00 00 00 	callq	0 <__Z10print_testPKc+0x26>
      26:	48 83 c4 10 	addq	$16, %rsp
      2a:	5d 	popq	%rbp
      2b:	c3 	retq
```

As you can see the code generated for `print` is somewhere in between `printf`
and `ostream`. Considering that `print`'s example adds runtime safety, error
handling and is more efficient, this seems like a reasonable tradeoff.

## Acknowledgements

Thanks to Corentin Jabot, Roger Orr, Peter Brett, Hubert Tong, the BSI C++
panel, the Unicode Study Group of the C++ committee, Tom Honermann and Tim Song
for their feedback, support, constructive criticism and contributions to the
`std::print` proposal.

Also thanks to my current and past managers at Facebook (now Meta) for
supporting my standardization work and the company for paying for my trips to
standards committee meetings.

And, of course, thanks to hundreds of [contributors][8]] to the {fmt} library
for their work.

[8]: https://github.com/fmtlib/fmt/graphs/contributors

## What’s next?

Now that we provide a safe, extensible and efficient formatting output facility,
the next obvious frontier is formatted input. It poses a completely different
set of challenges but we could apply some of the lessons from the `std::format`
and `std::print` work. If you are interested in formatted input, check out
the excellent [scnlib library](https://github.com/eliaskosunen/scnlib) by
Elias Kosunen.

## What took you so long?

> Why did they need 38 years for std::print?
>
> — celsheet on [Reddit][9]

[9]: https://www.reddit.com/r/cpp/comments/14vrqps/c23_the_next_c_standard/

I was too young to be involved with C++ 38 years ago so I don't have full
context but the `print` function in almost its current form has been available
in the {fmt} library (called C++ Format back then) since [version 0.10.0][10]
released 9.5 years ago. I intentionally didn't include I/O in the `std::format`
proposal to keep the scope manageable. It took extra 3 years for `std::print`
mostly because Unicode on Windows is very broken due to layers of legacy
codepages.

[10]: https://github.com/fmtlib/fmt/releases/tag/0.10.0
