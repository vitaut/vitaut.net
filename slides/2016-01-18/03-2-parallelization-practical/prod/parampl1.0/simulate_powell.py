#!/usr/bin/env python

import os
import sys
import time


WORK_DIR = "c:\\ampl\\ampl_mswin64"
LOG_SUBDIR = "p_logs"

AMPL_FILE_1 = "powell_1"
AMPL_FILE_P = "powell_p"



def sim(n, p, ex):

	os.environ['p20_n'] = str(n);
	os.environ['p20_p'] = str(p);
	os.environ['p20_ex'] = str(ex);

	sys.stdout.write("N: " + str(n) + ", p: " + str(p) + ", ex: " + str(ex) + "...\n");
	sys.stdout.flush();
	
	if p == 1:
		cmd = WORK_DIR + "\\ampl " + WORK_DIR + "\\" + AMPL_FILE_1 + " > " + WORK_DIR + "\\" + LOG_SUBDIR + "\\powell_" + str(n) + "_" + str(p) + "_" + str(ex) + "_log.txt";
	else:
		cmd = WORK_DIR + "\\ampl " + WORK_DIR + "\\" + AMPL_FILE_P + " > " + WORK_DIR + "\\" + LOG_SUBDIR + "\\powell_" + str(n) + "_" + str(p) + "_" + str(ex) + "_log.txt";
	
	t1 = time.time();
	os.system(cmd);
	t2 = time.time();
	
	sys.stdout.write("Execution time: " + str(t2 - t1) + "s.\n\n");
	sys.stdout.flush();

	

if __name__=="__main__":	
		
	for n in [6720]:
		for p in [1, 2, 3, 4, 5, 6]:
#			for i in [1,2]:
				sim(n, p, 1);
				sim(n, p, 2);
				if p > 1:
					sim(n, p, 3);
