model cut.mod;

param price {WIDTHS} default 0.0;

var Use {WIDTHS} integer >= 0;

minimize Reduced_Cost:
  1 - sum {i in WIDTHS} price[i] * Use[i];

subj to Width_Limit:
  sum {i in WIDTHS} i * Use[i] <= roll_width;
