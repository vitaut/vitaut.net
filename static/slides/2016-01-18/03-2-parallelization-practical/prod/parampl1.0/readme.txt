Parampl v.1.0
Author: Artur Olszak
Institute of Computer Science, Warsaw University of Technology                                                                                          
Version: 1.0 (01.01.2014)

Copyright (c) 2013, Artur Olszak, Institute of Computer Science, Warsaw University of Technology
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL ARTUR OLSZAK BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.


*** 1. Parampl ***

Parampl is a simple tool for parallel execution of AMPL programs. Parampl introduces explicit asynchronous execution of AMPL subproblems from within the program code. The mechanism allows dispatching subproblems to separate threads of execution, synchronization of  the threads and coordination of the results in the AMPL program flow. It is able to take advantage of multiple processing units while computing the solutions. A modeller is able to define complex optimization tasks in a decomposed way, taking advantage of the problem structure and formulate algorithms solving optimization problems as subtasks.


*** 2. Installation ***

Execute "parampl.py install" to generate the files required by Parampl:
- paramplsub
- paramplret


*** 3. Design and use of Parampl ***

Let us consider a very simple AMPL program, which solves sequentially the same problem for two sets of parameters p1, p2 and stores the results in one vector res:

var x{i in 1..3} >= 0;

param res {i in 1..6};
param p1 {iter in 1..2};    param p2 {iter in 1..2};
param iter;

minimize obj:
   p1[iter] - x[1]^2 - 2*x[2]^2 - x[3]^2 - x[1]*x[2] - x[1]*x[3];

subject to c1:
   8*x[1] + 14*x[2] + 7*x[3] - p2[iter] = 0;

subject to c2:
   x[1]^2 + x[2]^2 + x[3]^2 -25 >= 0;

let p1[1] := 1000;     let p1[2] := 500;
let p2[1] := 56;       let p2[2] := 98;

for {i in 1..2} {
   let {k in 1..3} x[k] := 2;     # define the initial point.
   let iter := i;
   solve;
   for {j in 1..3} {              # store the solution
      let res[(i-1)*3 + j] := x[j];
   };
};

display res;


Individual calls of the solve command will block until the solution is calculated. Using Parampl, it is possible to solve multiple problems in parallel. Parampl is a program written in Python programming language, which is accessed from AMPL programs by calling two AMPL commands:

- paramplsub   - submits the current problem to be processed in a separate thread of execution and returns:

write ("bparampl_problem_" & $parampl_queue_id);
shell 'python parampl.py submit'; 


- paramplret   - retrieves the solution (blocking operation) of the first submitted task, not yet retrieved:

shell 'python parampl.py retrieve';
if shell_exitcode == 0 then {
  solution ("parampl_problem_" & $parampl_queue_id & ".sol");
  remove ("parampl_problem_" & $parampl_queue_id & ".sol");
}


Before calling these scripts, Parampl must be configured within the AMPL program - the solver to be used and the queueId should be set. The queueId is a unique identifier of the task queue, which is a part of the names of temporary files created by Parampl, which allows executing Parampl in the same working directory for different problems and ensures that the temporary problem, solution and jobs files are not overwritten. The options for the chosen solver should be set in the standard way, e.g.:

option  parampl_options  'solver=ipopt';
option  parampl_queue_id  'powelltest';
option  ipopt_options  'mu_init=1e-6 max_iter=10000';


The paramplsub script saves the current problem to a .nl file (using AMPL command write) and executes Parampl with the parameter submit. When executed with the parameter submit, Parampl generates a unique identifier for the task, the generated .nl file is renamed to a temporary file, and the solver is executed in a separate process passing the .nl file to it. The tasks submitted in this way are executed in parallel in separate processes. After calculating the solution, the solver creates a solution (.sol) file with the file name corresponding to the temporary problem file passed to the solver upon execution.

Information about the tasks being currently processed by Parampl is stored in the jobs file - new tasks are appended to this file. The file simply stores the list of the task identifiers being currently executed (jobs that have been submitted and have not yet been retrieved):

2 3 4 5


The temporary file names for the problem (.nl) and solution (.sol) files are composed of the queueId and the task identifier. The jobs file name also contains the queueId, so multiple problems may be solved using Parampl at the same time as long as the queueId value is different for each of them.

The paramplret script executes Parampl with the parameter retrieve, which is a blocking call, waiting for the first submitted task from the jobs file (not yet retrieved) to finish. The solution file is then renamed to the .sol file known by the paramplret script and is then passed to AMPL using AMPL command solution. At this point, the temporary .nl file is deleted, and the task id is removed from the jobs file. After calling the script paramplret, the solution is loaded to the main AMPL program flow as if the solve command was called.

When the solver generates the solution file, the paramplret command does not immediately load the solution back to AMPL. Depending on the solver and the problem size, the file generation may take more time, and the file might be incomplete if the AMPL solution command is called immediately after the solution file is created. The blocking call parampl retrieve does not wait for the solution file itself to be generated, but for the notification (.not) file which is created after the solver process terminates. Calling Parampl with parameter submit does not directly run the solver process, but creates another instance of Parampl (executed in background) which executes the solver and generates the notification (.not) file after the solver process returns. This ensures that the solution file is complete before reading it back to AMPL. The logic of Parampl is presented below:

parampl submit:
  jobs = loadJobsFromFile("parampl_jobfile_queueId")
  taskId = generateNextTaskId(jobs)
  jobs.append(taskId)
  saveJobsToFile("parampl_jobfile_queueId", jobs)
  rename("parampl_problem_queueId.nl", "parampl_job_queueId_taskId.nl")
  executeInBackground("parampl executeSolver queueId taskId")
  # "submit" terminates, but "parampl executeSolver"
  # is still being executed in the background

parampl retrieve:
  jobs = loadJobsFromFile("parampl_jobfile_queueId")
  taskId = jobs.getAndRemoveFirst()
  saveJobsToFile("parampl_jobfile_queueId", jobs)
  waitForFile("parampl_job_queueId_taskId.not")  # blocking
  rename("parampl_job_queueId_taskId.sol", "parampl_problem_queueId.sol")
  delete("parampl_job_queueId_taskId.nl")
  delete("parampl_job_queueId_taskId.not")

parampl executeSolver:
  # execute the solver and wait until the solver process returns:
  execBlocking("solver parampl_job_queueId_taskId.nl -AMPL")
  # generate notification file after the solver returns:
  generateNotfiticationFile("parampl_job_queueId_taskId.not")


The sequential problem presented before may be run in parallel as follows:

for {i in 1..2} {
    # Define the initial point.
    let x[1] := 2;
    let x[2] := 2;
    let x[3] := 2;

    let iter := i;

    # execute solver (non blocking execution):
    commands paramplsub;
};

# the tasks are now being executed in parallel...

for {i in 1..2} {
    # retrieve solution from the solver:
    commands paramplret;

    # store the solution
    for {j in 1..3} {
        let res[(i-1)*3 + j] := x[j];
    };
};

In the above scenario, both problems are first submitted to Parampl, which creates a separate process for solving each of them (parallel execution of the solvers). In the second loop, the solutions for both subtasks are retrieved back to AMPL and may be then processed.


*** 4. Important information ***

The Parampl scripts require Python to be accessible from the working directory.

