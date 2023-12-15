# New parameters:
param roll_width > 0;           # raw roll width
param maxPatterns integer >= 0; # max number of patterns

param nPatterns integer >= 0 <= maxPatterns;
set PATTERNS = 1..nPatterns;  # patterns
set WIDTHS ordered by reversed Reals; # finished widths

param order {WIDTHS} >= 0;    # rolls of width j ordered

param rolls {WIDTHS,PATTERNS} >= 0 default 0;
                              # rolls of width i in pattern j

var Cut {PATTERNS} integer >= 0;
                              # raw rolls to cut in each pattern

minimize TotalRawRolls: sum {p in PATTERNS} Cut[p];

subject to FinishedRollLimits {w in WIDTHS}:
   order[w] <= sum {p in PATTERNS} rolls[w,p] * Cut[p];