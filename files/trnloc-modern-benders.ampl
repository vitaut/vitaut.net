model trnloc-scenario.ampl;
data trnloc.dat;

suffix stage IN;
option auxfiles rc;
write gtrnloc1;

shell './smpswriter trnloc1';
shell './fortsp --smps-obj-sense=minimize --sp-alg=intlshaped trnloc1';