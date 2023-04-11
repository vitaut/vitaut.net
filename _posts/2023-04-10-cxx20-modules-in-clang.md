---
layout: post
title: C++20 modules in clang
date: 2023-04-10
---

{{ page.title }}
================

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em; width: 50%">
<a href="/img/its-alive.jpg">
  <img border="0" src="/img/its-alive.jpg" width="100%"
       title="The reports of modules death are greatly exaggerated.">
</a>
</div>

Out of three headline C++20 features (modules, coroutines and the third one),
modules are, in my opinion, are by far the most important for the daily use.
Modules aim to replace the legacy header system inherited from C and based on
primitive textual inclusion with a more scalable, hermetic and fine-grained
system.

There has been slow but steady progress on implementing modules in various
compilers and build systems. I recently read a blog post ["import CMake; C++20
Modules"](https://www.kitware.com/import-cmake-c20-modules/) and, among other
things, learned that Clang 16 supports modules out of the box. So I decided to
give it a try and build [{fmt}](https://github.com/fmtlib/fmt) as a module.
This post is a summary of initial efforts.

Thanks to Daniela Engert, who has done heroic work modularizing {fmt},
reported in her talk ["A (short) Tour of C++ Modules"](
https://www.youtube.com/watch?v=XAL4GlBt_Yk) there were very few issues when
compiling it as a module with clang.

The main class of issues can be illustrated on the following example
([godbolt](https://godbolt.org/z/GPb36G5WT)):

```c++
// test.cc
module;

export module test;

export {
template <typename T>
class Classy {
 public:
  void funky();
};

template <typename T>
void Classy<T>::funky() {
}
// ...
}
```

when compiled with clang it gives the following error:

```
$ clang++-16 -std=c++20 --precompile -x c++-module test.cc
test.cc:14:17: error: cannot export 'funky' as it is not at namespace scope
void Classy<T>::funky() {
     ~~~~~~~~~~~^
```

The error can be fixed by moving the definition of the member function either
to the class body or outside of the `export` block, e.g.:

```c++
export {
template <typename T>
class Classy {
 public:
  void funky() {}
};
// ...
}
```

This and other issues which are too obscure to discuss here are now solved and
{fmt} can be compiled out of the box with clang:

```
git clone https://github.com/fmtlib/fmt.git
cd fmt
clang++-16 -std=c++20 --precompile -x c++-module src/fmt.cc -I include
clang++-16 -std=c++20 -c fmt.pcm
```

Right now it is a manual process but the plan is to add CMake support later.
The above commands produce two files, `fmt.pcm` which encodes the module
interface using [pulse-code modulation](
https://en.wikipedia.org/wiki/Pulse-code_modulation) and `fmt.o` which is a
usual object file.

Once the module is built, it can be consumed as follows:

```c++
// example.cc
import fmt;

int main() {
  fmt::print("Hello, modules!\n");
}
```

```
clang++-16 -std=c++20 -fprebuilt-module-path=. fmt.o example.cc -o example
./example
```

As expected, this prints

```
Hello, modules!
```

Unfortunately, it doesn't give a measurable build speed up compared to using
the lightweight core API. Looking at the compilation time trace we can see that
much time is spent generating and optimizing code:

<img border="0" src="/img/time-trace.png" width="100%">

But there is almost no code in `example.cc`! It looks like clang is ignoring the
`extern template` and recompiles templates instead of using explicit
instantiations from `fmt.o`.

To confirm this I put together a simple repro ([godbolt](
https://godbolt.org/z/6vGo87r5M)). It consists of two files, `foo.cxx` which
defines a module with a function template and its explicit instantiation and
`main.cxx` which calls this instantiation.

`foo.cxx`:
```c++
module;
#include <iostream>

export module foo;

export template <typename T>
void hello_world(T val) {
  std::cout << val;
}

template void hello_world(char);
```

`main.cxx`:
```c++
import foo;

int main() {
  hello_world('x');
}
```

This builds the module and generate an assembly for `main`:

```
clang++-16 -std=c++20 --precompile -x c++-module foo.cxx
clang++-16 -std=c++20 -c foo.pcm
clang++-16 -std=c++20 -fprebuilt-module-path=. -S main.cxx
```

Inspecting `main.s` shows that the `hello_world<char>` instantiation is emitted
there:

```asm
        .text
        .file   "main.cxx"
        .section        .text._ZW3foo11hello_worldIcEvT_,"axG",@progbits,void hello_world@foo<char>(char),comdat
        .weak   void hello_world@foo<char>(char)      # -- Begin function void hello_world@foo<char>(char)
        .p2align        4, 0x90
        .type   void hello_world@foo<char>(char),@function
void hello_world@foo<char>(char):             # @void hello_world@foo<char>(char)
        .cfi_startproc
# %bb.0:
        pushq   %rbp
        .cfi_def_cfa_offset 16
        .cfi_offset %rbp, -16
        movq    %rsp, %rbp
        .cfi_def_cfa_register %rbp
        subq    $16, %rsp
        movb    %dil, %al
        movb    %al, -1(%rbp)
        movq    std::cout@GOTPCREL(%rip), %rdi
        movsbl  -1(%rbp), %esi
        callq   std::basic_ostream<char, std::char_traits<char> >& std::operator<< <std::char_traits<char> >(std::basic_ostream<char, std::char_traits<char> >&, char)@PLT
        addq    $16, %rsp
        popq    %rbp
        .cfi_def_cfa %rsp, 8
        retq
```

This happens regardless of whether we use `extern template` or not in `foo.cxx`.
For comparison, compiling the following program:

`foo.h`:
```c++
#include <iostream>

template <typename T>
void hello_world(T val) {
  std::cout << val;
}

extern template void hello_world(char);
```

```c++
#include "foo.h"

int main() {
  hello_world('x');
}
```

doesn't generate `hello_world<char>`.

Going back to the {fmt} case we can see that the object files consuming the
module is ~200x larger than the one consuming headers:

```
-rw-rw-r-- 1 vagrant vagrant     2624 Apr 10 23:46 test-header.o
-rw-rw-r-- 1 vagrant vagrant   542072 Apr 10 19:41 test-module.o
```

Almost all of these are unnecessary template instantiations.
This suggests that we can expect substantial build speed improvement once
clang stops emitting them either by recognizing `extern template` or some
other means.

Happy modularizing!
