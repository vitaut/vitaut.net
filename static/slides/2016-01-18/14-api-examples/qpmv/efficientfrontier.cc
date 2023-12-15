#include "ampl/ampl.h"

#include <algorithm>    // std::max_element
#include <cstdio>       // std::printf

int main(int argc, char **argv) {
  std::string modelDirectory(argc == 2 ? argv[1] : "models");
  modelDirectory += "/qpmv";

  ampl::AMPL ampl;
  // Number of steps of the efficient frontier
  const int steps = 10;

  ampl.setBoolOption("reset_initial_guesses", true);
  ampl.setBoolOption("send_statuses", false);
  ampl.setOption("solver", "cplex");

  // Load the AMPL model from file
  ampl.read(modelDirectory + "/qpmv.mod");
  ampl.read(modelDirectory + "/qpmvbit.run");

  // Set tables directory (parameter used in the script above)
  ampl.getParameter("data_dir").set(modelDirectory);
  // Read tables
  ampl.readTable("assetstable");
  ampl.readTable("astrets");

  ampl::Variable portfolioReturn = ampl.getVariable("portret");
  ampl::Parameter averageReturn = ampl.getParameter("averret");
  ampl::Parameter targetReturn = ampl.getParameter("targetret");
  ampl::Objective variance = ampl.getObjective("cst");

  // Relax the integrality
  ampl.setBoolOption("relax_integrality", true);
  // Solve the problem
  ampl.solve();
  // Calibrate the efficient frontier range
  double minret = portfolioReturn.value();
  ampl::DataFrame values = averageReturn.getValues();
  ampl::DataFrame::Column col = values.getColumn("averret");
  double maxret = std::max_element(col.begin(), col.end())->dbl();
  double stepsize = (maxret - minret) / steps;
  double returns[steps];
  double variances[steps];

  for (int i = 0; i < steps; i++) {
    std::printf("Solving for return = %g\n", maxret - (i - 1) * stepsize);
    // Set target return to the desired point
    targetReturn.set(maxret - (i - 1) * stepsize);
    ampl.eval("let stockopall:={};let stockrun:=stockall;");
    // Relax integrality
    ampl.setBoolOption("relax_integrality", true);
    ampl.solve();
    std::printf("QP result = %g\n", variance.value());
    // Adjust included stocks
    ampl.eval("let stockrun:={i in stockrun:weights[i]>0};");
    ampl.eval("let stockopall:={i in stockrun:weights[i]>0.5};");
    // Set integrality back
    ampl.setBoolOption("relax_integrality", false);
    ampl.solve();
    std::printf("QMIP result = %g\n", variance.value());
    // Store data of corrent frontier point
    returns[i] = maxret - (i - 1) * stepsize;
    variances[i] = variance.value();
  }

  // Display efficient frontier points
  std::printf("RETURN    VARIANCE\n");
  for (int i = 0; i < steps; i++)
    std::printf("%-6f  %-6f\n", returns[i], variances[i]);
  return 0;
}
