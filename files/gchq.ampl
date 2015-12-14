param N > 0;
param MaxRun > 0;
set RC = 1..N; # row/column set

param RowRunLen{RC, 1..MaxRun} default 0;
param ColRunLen{RC, 1..MaxRun} default 0;

set KnownPos dimen 2;

set RowRuns = {r in RC, i in 1..MaxRun: RowRunLen[r, i] > 0};
set ColRuns = {c in RC, i in 1..MaxRun: ColRunLen[c, i] > 0};

# Start position of row and column runs.
var RowRunStart{(r, i) in RowRuns} integer >= 1 <= N;
var ColRunStart{(c, i) in ColRuns} integer >= 1 <= N;

# Row runs shoudn't overlap.
s.t. no_row_overlap{(r, i) in RowRuns: i < MaxRun}:
  RowRunStart[r, i] + RowRunLen[r, i] <= RowRunStart[r, i + 1] - 1;

# Column runs shoudn't overlap.
s.t. no_col_overlap{(c, i) in ColRuns: i < MaxRun}:
  ColRunStart[c, i] + ColRunLen[c, i] <= ColRunStart[c, i + 1] - 1;

# Each square in a row run should intersect some column run.
s.t. row_col_intersect{(r, i) in RowRuns, l in 0..RowRunLen[r, i] - 1}:
  exists{(c, j) in ColRuns} (c == RowRunStart[r, i] + l &&
                             ColRunStart[c, j] <= r &&
                             r < ColRunStart[c, j] + ColRunLen[c, j]);

# Each known position should belong to some row run.
s.t. known_pos{(r, c) in KnownPos}:
  exists{(r, i) in RowRuns}
    RowRunStart[r, i] <= c && c < RowRunStart[r, i] + RowRunLen[r, i];

data;

param N := 25;
param MaxRun := 9;

param ColRunLen (tr)
:  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 :=
1  .  .  1  .  .  .  .  .  .  .  .  .  .  .  .  2  .  .  .  .  .  1  .  .  .
2  .  .  3  1  1  .  .  .  .  2  .  1  .  .  .  2  .  .  .  .  .  3  .  .  .
3  .  .  1  3  3  .  7  .  2  2  .  2  .  3  .  1  1  .  .  .  .  1  .  1  .
4  .  1  3  1  1  1  1  .  1  1  .  3  .  3  .  1  3  .  7  .  1  1  1  1  7
5  7  1  1  1  1  1  1  .  2  2  1  1  4  1  1  1  3  .  1  1  3  1  3  2  1
6  2  2  3  5  4  1  1  .  1  1  7  1  1  1  2  1  2  .  4  1  1  2  1  2  3
7  1  2  1  1  1  2  1  1  8  1  3  1  1  1  5  1  1  6  1  1  3  1  4  2  2
8  1  1  3  3  3  1  1  1  2  1  2  1  2  3  2  2  8  2  1  1  7  1  3  6  1
9  7  1  1  1  1  1  7  3  1  2  1  1  6  1  2  1  1  1  3  4  1  4  3  1  1;

param RowRunLen
 :  1  2  3  4  5  6  7  8  9 :=
 1  .  .  .  .  7  3  1  1  7
 2  .  .  .  1  1  2  2  1  1
 3  .  1  3  1  3  1  1  3  1
 4  .  1  3  1  1  6  1  3  1
 5  .  1  3  1  5  2  1  3  1
 6  .  .  .  .  1  1  2  1  1
 7  .  .  7  1  1  1  1  1  7
 8  .  .  .  .  .  .  .  3  3
 9  1  2  3  1  1  3  1  1  2
10  .  .  .  1  1  3  2  1  1
11  .  .  .  4  1  4  2  1  2
12  .  1  1  1  1  1  4  1  3
13  .  .  .  2  1  1  1  2  5
14  .  .  .  3  2  2  6  3  1
15  .  .  .  1  9  1  1  2  1
16  .  .  .  2  1  2  2  3  1
17  .  .  3  1  1  1  1  5  1
18  .  .  .  .  .  1  2  2  5
19  .  .  7  1  2  1  1  1  3
20  .  .  1  1  2  1  2  2  1
21  .  .  .  1  3  1  4  5  1
22  .  .  .  1  3  1  3 10  2
23  .  .  .  1  3  1  1  6  6
24  .  .  .  1  1  2  1  1  2
25  .  .  .  .  7  2  1  2  5;

set KnownPos :=
 4  4
 4  5
 4 13
 4 14
 4 22
 9  7
 9  8
 9 11
 9 15
 9 16
 9 19
17  7
17 12
17 17
17 21
22  4
22  5
22 10
22 11
22 16
22 21
22 22;

option ilogcp_options 'logverbosity=normal';
option solver ilogcp;
solve;

printf{1..35} '██';
print;
for {r in RC} {
  printf{1..5} '██';
  for {c in RC} {
    if exists{(r, i) in RowRuns} RowRunStart[r, i] <= c && c < RowRunStart[r, i] + RowRunLen[r, i] then
      printf '  ';
    else
      printf '██';
  }
  printf{1..5} '██';
  print;
}
printf{1..35} '██';
