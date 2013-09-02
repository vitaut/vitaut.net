
# -----------------------------------------
# LOCATION-TRANSPORTATION PROBLEM
# WRITTEN AS A SINGLE-SCENARIO "SP" PROBLEM
# -----------------------------------------

set ORIG;   # shipment origins (warehouses)
set DEST;   # shipment destinations (stores)
set SCEN = {1}; # dummy scenario set 

param supply {ORIG} > 0;
param demand {DEST} > 0;

var Build {ORIG} binary;    # 1 iff it is built
param fix_cost {ORIG} > 0;

var Ship {ORIG,DEST,SCEN} >= 0 suffix stage 2;  # amounts shipped
param var_cost {ORIG,DEST} > 0;

minimize Total_Cost:
   sum {i in ORIG} fix_cost[i] * Build[i] +
   sum {i in ORIG, j in DEST} var_cost[i,j] * Ship[i,j,1];

subj to Supply {i in ORIG, s in SCEN}:
   sum {j in DEST} Ship[i,j,s] <= supply[i] * Build[i];

subj to Demand {j in DEST, s in SCEN}:
   sum {i in ORIG} Ship[i,j,s] = demand[j];
