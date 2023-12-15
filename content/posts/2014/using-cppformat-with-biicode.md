---
title: Using C++ Format with Biicode
date: 2014-12-30
aliases: ['/2014/12/30/using-cppformat-with-biicode.html']
---

<div class="separator"
     style="clear:right; float:right; margin-left:1em; margin-bottom:1em">
  <img border="0" src="/img/bee.jpg" width="320" 
  title="A mandatory image of a bee.">
</div>

As a first experiment with [Biicode](http://www.biicode.com/), a C/C++ dependency manager,
I decided to publish [C++ Format](https://github.com/cppformat/cppformat) there and this
short post is about my initial experience with the service and how you can use the library
with Biicode.

First of all, I really like the idea of a dependency manager for C++.
This is something I've been looking for a long time after using such systems in other languages,
namely [PyPI/pip](https://pypi.python.org/pypi) in Python and [Maven](http://maven.apache.org/)
in Java world.

My initial impression of Biicode was quite positive. It was easy to install on my Linux box,
and creating and building the first project was a matter of a few simple commands.
However, the documentation could be a bit better if it explained some of the basic concepts
such as "blocks" before they are used.

I was happy to learn that Biicode is based on the [CMake](http://www.cmake.org/) build system,
so potentially it could be easy to migrate my projects that already use CMake.
Unfortunately I didn't find
anything in the documentation on how to import existing projects other than simply cloning
the repo into the `block/<user>` directory, but the latter didn't work with my projects.
So I created a stripped down version of C++ Format with only the files needed by the
client code and imported it as [vitaut/cppformat](http://www.biicode.com/vitaut/cppformat).

Now I'm going to demonstrate how to use C++ Format with Biicode on a small example.
First let's create a Biicode project with a "Hello World" example:

```
$ bii init
Successfully initialized biicode project
$ bii new myuser/myblock --hello=cpp
```

Open `blocks/myuser/myblock/main.cpp` and replace the code with the following:

```c++
#include "vitaut/cppformat/format.h"

int main() {
  fmt::print("Hello world!\n");
}
```

Now let's resolve dependencies:

```
$ bii find
INFO: Processing changes...
INFO: Finding missing dependencies in server
INFO: Looking for vitaut/cppformat...
INFO: >> Block candidate: vitaut/vitaut/cppformat/master
INFO: >> Version vitaut/cppformat: 0 (DEV) valid due to your policy!
INFO: Found blocks: vitaut/cppformat: 0
INFO: Analyzing compatibility for found dependencies... 
INFO: All dependencies resolved
Find resolved new dependencies:
        vitaut/cppformat: 0
INFO: Saving files from: vitaut/cppformat
```

Isn't it beautiful? Biicode resolved dependencies based on includes only, no
configuration was needed.

And finally build the example:

```
$ bii cpp:build
...
[100%] Built target myuser_myblock_main
$ bin/myuser_myblock_main 
Hello world!
```

As you can reusing the code with Biicode is dead simple. So I encourage you
to try it out together with C++ Format!
