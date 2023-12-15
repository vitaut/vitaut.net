---
title: Simple usage of C++20 modules
date: 2023-04-17
aliases: ['/2023/04/17/simple-cxx20-modules.html']
---

<div class="separator" style="clear:right; float:right; margin-left:1em; margin-bottom:1em; width: 50%">
<a href="/img/easy.jpg">
  <img border="0" src="/img/easy.jpg" width="100%"
       title="Easiest thing in the world">
</a>
</div>

In my [previous post](
https://www.zverovich.net/2023/04/10/cxx20-modules-in-clang.html) I showed
how to compile {fmt} as a C++20 module with clang. Although taking only two
commands, ideally it's not something you should be doing manually. So in this
post, I'll talk about module support in CMake, everyone's favorite not a build
system.

My first attempt was to use the CMake's built-in functionality advertised in
["import CMake; C++20 Modules"](https://www.kitware.com/import-cmake-c20-modules/).
And after some struggle I made it to work with clang but unfortunately it was
very limited. Here are some of the problems and limitations that I discovered:

1. It only worked with `ninja` and while I don't have anything against this
   build system it's an extra hassle to get this additional dependency installed
   while `make` is usually available by default. This restriction also likely
   means that you cannot use such a CMake config with IDEs.

2. Native CMake support only worked with clang 16 while the fmt module can
   be built manually with clang 15.

3. It required the latest version of CMake and a lot of ceremony to set up,
   including some incomprehensible things like
   ```cmake
   set(CMAKE_EXPERIMENTAL_CXX_MODULE_CMAKE_API
       "2182bf5c-ef0d-489a-91da-49dbc3090d2a")
   ```

4. There were issues in dynamic dependency extraction both in `clang-scan-deps`
   and CMake itself.

In general I think that it's a noble goal to try addressing the general case of
extracting dependency information from source files and some progress has been
made in that direction. However, in the {fmt} case this is completely
unnecessary because there is a single static module.

Then I remembered that back in 2018 I wrote [https://github.com/vitaut/modules](
https://github.com/vitaut/modules), a simle CMake library for using modules in
clang. It is amazing that clang had module support (somewhat different from
C++20 modules) 5 years ago! I brought it up to date, simplified a bit and
added gcc support.

Here's an example of using this library:

`hello.cc` (module):
```c++
module;

#include <cstdio>

export module hello;

export void hello() { std::printf("Hello, modules!\n"); }
```

`main.cc` (module consumer):
```c++
import hello;

int main() { hello(); }
```

`CMakeLists.txt` (build config):
```cmake
cmake_minimum_required(VERSION 3.11)
project(HELLO CXX)

include(modules.cmake)

add_module_library(hello hello.cc)

add_executable(main main.cc)
target_link_libraries(main hello)
```

The main difference from the usual CMake code is that `add_library` is
replaced with `add_module_library` defined in [`modules.cmake`](
https://github.com/vitaut/modules/blob/master/modules.cmake) which adds a
library together with module-specific build rules such as the ones for building
`.pcm` files in clang.

And the usage is trivial:

```
$ CXX=clang++ cmake .
$ make
$ ./main
Hello, modules!
```

It works with clang 15+, gcc 12+ (but note that module support in gcc is
incomplete), pretty much any version of CMake and any generator. The only
limitation is that it assumes a static mapping between sources and modules.

I used `add_module_library` to add C++20 module support for clang in {fmt}.
It is possible to build the fmt module with gcc as well but unfortunatley the
result is not particularly usable yet. Hopefully the situation will improve in
upcoming releases of gcc. But building simpler code such as the above example
already works in gcc. MSVC has partial module support and thanks to Daniela
Engert {fmt} already contains all the necessary workarounds for MSVC bugs.
The only thing that is missing is integration into `add_module_library` which 
should be relatively straightforward.

Here's an example of using {fmt} as a C++20 module with CMake.

`example.cc`:
```c++
import fmt;

int main() {
  fmt::print("Hello, modules!\n");
}
```

`CMakeLists.txt`:
```cmake
cmake_minimum_required(VERSION 3.11)
project(HELLO CXX)

set(CMAKE_CXX_EXTENSIONS OFF)
add_subdirectory(fmt)
add_executable(hello hello.cc)
target_link_libraries(hello fmt)
```

Building with clang:
```
CXX=clang++ cmake -DFMT_MODULE=ON .
make
```

Running:
```
./hello
```
prints
```
Hello, modules!
```

As you can see using modules is very simple. The only minor wrinkle is that you
need to disable clang extensions by setting `CMAKE_CXX_EXTENSIONS` to `OFF`.
Otherwise everything just works.

Happy modularizing!
