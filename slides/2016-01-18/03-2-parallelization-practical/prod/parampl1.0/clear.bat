@@echo off

if [%1] == [] goto error1

	del parampl_problem_%1.nl
	del parampl_problem_%1.sol
	del parampl_job_%1_*.nl
	del parampl_job_%1_*.sol
	del parampl_job_%1_*.not
	del parampl_jobfile_%1
	goto end

:error1
	@echo %%1 is not set
	
:end
