---
title: Migrating to a safer API with {fmt} 8.x
date: 2022-01-29
aliases: ['/2022/01/29/migrating-to-safer-api.html']
---

<div style="clear:right; float:right; margin-left:1em; margin-bottom:1em; width: 50%">
  <img src="/img/cateyes.jpg" width="100%" title="I can see your bugs">
</div>

We recently migrated a large codebase from {fmt} 7.x to 8.1.1 and in this
blog post I'll show some of the fun issues discovered thanks to improved
diagnostics in the new version of this library.

Let's start with this piece of questionable code:

```c++
std::string format_error(
    std::uint_least8_t squishiness) {
  static const std::string format =
    "Invalid squishiness: {}";
  return fmt::format(format, squishiness);
}
```

It looks relatively innocent but there are multiple problems with it:

1. Unnecessary `std::string` construction
2. Unnecessary synchronization to initialize this `std:string` object
2. The format string can't be statically checked

The generated code is pretty bad too ([godbolt](https://godbolt.org/z/dexPY9zeh)):

```
format_error[abi:cxx11](unsigned char):
  push r12
  mov r12, rdi
  push rbp
  push rbx
  mov ebx, esi
  sub rsp, 16
  movzx eax, BYTE PTR guard variable for format_error[abi:cxx11](unsigned char)::format[rip]
  mov rbp, rsp
  test al, al
  jne .L3
  mov edi, OFFSET FLAT:guard variable for format_error[abi:cxx11](unsigned char)::format
  mov rbp, rsp
  call __cxa_guard_acquire
  test eax, eax
  jne .L13
.L3:
  mov rsi, QWORD PTR format_error[abi:cxx11](unsigned char)::format[rip]
  movzx ebx, bl
  mov r8, rbp
  mov rdi, r12
  mov rdx, QWORD PTR format_error[abi:cxx11](unsigned char)::format[rip+8]
  mov ecx, 2
  mov DWORD PTR [rsp], ebx
  call fmt::v8::vformat[abi:cxx11](fmt::v8::basic_string_view<char>, fmt::v8::basic_format_args<fmt::v8::basic_format_context<fmt::v8::appender, char> >)
  add rsp, 16
  mov rax, r12
  pop rbx
  pop rbp
  pop r12
  ret
.L13:
  xor edx, edx
  mov rsi, rbp
  mov edi, OFFSET FLAT:format_error[abi:cxx11](unsigned char)::format
  mov QWORD PTR format_error[abi:cxx11](unsigned char)::format[rip], OFFSET FLAT:format_error[abi:cxx11](unsigned char)::format+16
  mov QWORD PTR [rsp], 23
  call std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> >::_M_create(unsigned long&, unsigned long)
  mov rdx, QWORD PTR [rsp]
  mov esi, OFFSET FLAT:format_error[abi:cxx11](unsigned char)::format
  mov edi, OFFSET FLAT:_ZNSt7__cxx1112basic_stringIcSt11char_traitsIcESaIcEED1Ev
  movdqa xmm0, XMMWORD PTR .LC0[rip]
  mov QWORD PTR format_error[abi:cxx11](unsigned char)::format[rip], rax
  mov QWORD PTR format_error[abi:cxx11](unsigned char)::format[rip+16], rdx
  mov edx, 31520
  movups XMMWORD PTR [rax], xmm0
  mov WORD PTR [rax+20], dx
  mov rdx, QWORD PTR format_error[abi:cxx11](unsigned char)::format[rip]
  mov DWORD PTR [rax+16], 980644709
  mov BYTE PTR [rax+22], 125
  mov rax, QWORD PTR [rsp]
  mov QWORD PTR format_error[abi:cxx11](unsigned char)::format[rip+8], rax
  mov BYTE PTR [rdx+rax], 0
  mov edx, OFFSET FLAT:__dso_handle
  call __cxa_atexit
  mov edi, OFFSET FLAT:guard variable for format_error[abi:cxx11](unsigned char)::format
  call __cxa_guard_release
  jmp .L3
  mov rbp, rax
  jmp .L5
format_error[abi:cxx11](unsigned char) [clone .cold]:
.L5:
  mov edi, OFFSET FLAT:guard variable for format_error[abi:cxx11](unsigned char)::format
  call __cxa_guard_abort
  mov rdi, rbp
  call _Unwind_Resume
.LC0:
  .quad 2334106421097295433
  .quad 7956005061626524019
```

As of fmt 8.x and C++20 this example no longer compiles because format strings
must be known at compile time by default. And the fix is super easy: just move
the format string to the `fmt::format` where it belongs or make it a `constexpr`
C string or a `string_view`:

```c++
std::string format_error(std::uint_least8_t squishiness) {
  return fmt::format("Invalid squishiness: {}", squishiness);
}
```

This is not only cleaner but also safer and faster. The generated code becomes
much simpler too ([godbolt](https://godbolt.org/z/jKfv83Th5)):

```
.LC0:
  .string "Invalid squishiness: {}"
format_error[abi:cxx11](unsigned char):
  push r12
  movzx esi, sil
  mov ecx, 2
  mov edx, 23
  mov r12, rdi
  sub rsp, 16
  mov DWORD PTR [rsp], esi
  mov r8, rsp
  mov esi, OFFSET FLAT:.LC0
  call fmt::v8::vformat[abi:cxx11](fmt::v8::basic_string_view<char>, fmt::v8::basic_format_args<fmt::v8::basic_format_context<fmt::v8::appender, char> >)
  add rsp, 16
  mov rax, r12
  pop r12
  ret
```

Another case that we discovered involves choosing between multiple static format
strings at runtime:

```c++
std::string quote(std::string_view s, bool single) {
  return fmt::format(single ? "'{}'" : "\"{}\"", s);
}
```

Again, this no longer compiles because the format string is not known at compile
time. However, you can easily refactor the code to fix the issue:

```c++
std::string quote(std::string_view s, bool single) {
  return single ? fmt::format("'{}'", s) : fmt::format("\"{}\"", s);
}
```

Alternatively you can move the part that changes into a formatting argument:

```c++
std::string quote(std::string_view s, bool single) {
  return fmt::format("{0}{1}{0}", single ? '\'' : '"', s);
}
```

In other cases the format string can be fully dynamic. For example, {fmt} is
occasionally used as a basic template engine:

```c++
std::string tmpl = load_template("/path/to/template");
auto result = fmt::format(tmpl,
                          fmt::arg("first_name", "Ijon"),
                          fmt::arg("last_name", "Tichy"));
```

Putting aside the fact that {fmt} is not a template engine and you are probably
better off using something like mustache instead, you can opt out of
compile-time checks by wrapping your format string in
[`fmt::runtime`](
https://fmt.dev/latest/api.html#_CPPv4I0EN3fmt7runtimeE13basic_runtimeI6char_tI1SEERK1S):

```c++
std::string tmpl = load_template("/path/to/template");
auto result = fmt::format(fmt::runtime(tmpl),
                          fmt::arg("first_name", "Ijon"),
                          fmt::arg("last_name", "Tichy"));
```

This is still safe with errors reported at runtime as exceptions.

Now let's move to actual bugs. One class of bugs that we've fixed can be
illustrated on this example:

```c++
void print_indexed(const std::vector<int>& v) {
  for (size_t i = 0; i < v.size(); ++i)
    fmt::print("{}: {}\n", index, v[i]);
}
```

Can you spot an error?

It is not very hard to see in this example because the code was intentionally
simplified but in real code it may be quite challenging. The problem is that
the programmer accidentally typed `index` instead of `i`. But what is `index`?
It is, of course, a [POSIX function](
https://pubs.opengroup.org/onlinepubs/009604499/functions/index.html).

{fmt} 8.x forbids formatting of function pointers so this no longer compiles.

Here's a small variation of our first example that illustrates another class of
bugs:

```c++
void log_error(std::uint_least8_t squishiness) {
  fmt::format("Invalid squishiness: {}", squishiness);
}
```

The problem here is that the programmer formatted the error message but forgot
to actually write it to the log. {fmt} 8.x warns about this because
`std::format` and other formatting functions are now annotated with
`[[nodiscard]]`.

And finally, let's looks at this example:

```c++
void fancy_print(squishiness s) {
  fmt::print("|{:^10}|{:^10}|", "squishiness", s);
}
```

It looks perfectly fine except that the programmer didn't implement any format
specifier support for `squishiness` and you cannot see it from the call site.
As a result this throws `format_error` when run. Fortunately, with {fmt} 8.x and
C++20 this is detected at compile time too
([godbolt](https://godbolt.org/z/P7TE39d6s)).
To fix this you can reuse one of the standard formatters that support width and
alignment ([godbolt](https://godbolt.org/z/aojT6dfo6)):

```c++
template <>
struct fmt::formatter<squishiness> : formatter<std::string_view> {
  auto format(squishiness s, format_context& ctx) const {
    return formatter<std::string_view>::format("very squishy", ctx);
  }
};
```

Conclusion: Migration to {fmt} 8.x turned out to be highly beneficial,
eliminating several classes of bugs. This was not only due to compile-time
format string checks which are now enabled by default but also stricter
pointer diagnostic and `[[nodiscard]]`.
