set PROD;  # products
param T > 0;  # number of weeks

param rate {PROD} > 0;     # tons produced per hour
param avail {1..T} >= 0;   # hours available in week

param revenue {PROD, 1..T};      # revenue per ton
param market {PROD, 1..T} >= 0;  # limit on tons sold in week

var Make {p in PROD, t in 1..T} >= 0, <= market[p, t]; # tons produced

maximize Total_Profit: sum {p in PROD, t in 1..T} revenue[p, t] * Make[p, t];

               # Objective: total profits from all products

subject to Time{t in 1..T}: sum {p in PROD} (1/rate[p]) * Make[p, t] <= avail[t];

               # Constraint: total of hours used by all
               # products may not exceed hours available
