---
title: Measuring clock precision
date: 2023-12-17
---

I've been reading [Operating Systems: Three Easy Pieces][1], which is a great
book BTW, and one of the questions in the TLB section is

[1]: https://pages.cs.wisc.edu/~remzi/OSTEP/

> For timing, you’ll need to use a timer (e.g., `gettimeofday()`).
> How precise is such a timer? How long does an operation have to take
> in order for you to time it precisely? (this will help determine how
> many times, in a loop, you’ll have to repeat a page access
> in order to time it successfully)

[`gettimeofday`][2] is obviously not a suitable API for this because
it has only microsecond resolution so I was considering using
[`std::chrono::steady_clock`][3] instead. Unfortunately the standard
doesn't give a way to determine the actual clock resolution. We only know
that it is at least `clock::time_point::period` seconds. For `steady_clock`
the period is normally `std::ratio<1, 1000000000>` which gives us 1ns but
the real resolution is a multiple of that.

[2]: https://man7.org/linux/man-pages/man2/gettimeofday.2.html
[3]: https://en.cppreference.com/w/cpp/chrono/steady_clock

On POSIX `steady_clock` is normally implemented using [`clock_gettime`][4]
and the resolution can be as high as 1ns as reported by `clock_getres`.

[4]: https://pubs.opengroup.org/onlinepubs/000095399/functions/clock_gettime.html

However, you probably want to take into account the overhead of calling the
`now()` function and not just the resolution of the underlying API. The obvious
solution is to time our timer.

![I've heard you like timing](/img/yodawg.jpg)

This can be accomplished with the following simple program ([godbolt][5]):

[5]: https://www.godbolt.org/z/Kz54shnE4

```c++
#include <fmt/chrono.h>

int main() {
  const int num_measurements = 100;
  using clock = std::chrono::steady_clock;
  clock::time_point measurements[num_measurements];
  for (int i = 0; i < num_measurements; ++i) {
    measurements[i] = clock::now();
  }
  auto min_duration = clock::duration::max();
  for (int i = 1; i < num_measurements; ++i) {
    auto duration = measurements[i] - measurements[i - 1];
    if (duration != clock::duration() && duration < min_duration)
      min_duration = duration;
  }
  fmt::print("{}\n", min_duration);
}
```

On my M1 MacBook Pro with libc++ it gives ~41ns:

```
% ./clock
41ns
```

And on godbolt's Linux machine with libstdc++ it gives ~20ns.

I also posted a shorter version of this as a [StackOverflow answer][6].

[6]: https://stackoverflow.com/a/77675880/471164

If you know a better way to do this please let me know in a comment.

Happy timing!