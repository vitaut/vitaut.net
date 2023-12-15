#include "ampl/ampl.h"

#include <algorithm>  // std::max_element
#include <memory>
#include <mutex>
#include <numeric>
#include <thread>

struct Data {
  // The last processed step index.
  int last_step;
  std::mutex mutex;

  double maxret;
  double step_size;
  std::vector<double> returns;
  std::vector<double> variances;

  Data() : last_step(0), maxret(0), step_size(0) {}
};

class Worker {
 private:
  Data &data_;
  std::string modelDirectory_;
  bool loaded_;
  std::thread thread_;
  ampl::AMPL ampl_;

  void load() {
    if (loaded_) return;

    ampl_.setBoolOption("reset_initial_guesses", true);
    ampl_.setBoolOption("send_statuses", false);
    ampl_.setOption("solver", "cplex");
    ampl_.setOption("cplex_options", "threads=12");

    // Load the AMPL model.
    ampl_.read(modelDirectory_ + "/qpmv.mod");

    // Read data.
    ampl_.read(modelDirectory_ + "/qpmvbit.run");
    ampl_.getParameter("data_dir").set(modelDirectory_);
    ampl_.readTable("assetstable");
    ampl_.readTable("astrets");

    loaded_ = true;
  }

  void run() {
    for (;;) {
      auto step = 0;
      {
        std::lock_guard<std::mutex> guard(data_.mutex);
        if (data_.last_step == 0)
          return;  // No more steps to process.
        step = --data_.last_step;
      }
      load();
      ampl::Parameter targetReturn = ampl_.getParameter("targetret");
      ampl::Objective variance = ampl_.getObjective("cst");
      fmt::print("Solving for return = {}\n",
                 data_.maxret - (step - 1) * data_.step_size);
      // Set target return to the desired point
      targetReturn.set(data_.maxret - (step - 1) * data_.step_size);
      ampl_.eval("let stockopall:={};let stockrun:=stockall;");
      // Relax integrality
      ampl_.setBoolOption("relax_integrality", true);
      ampl_.solve();
      fmt::print("QP result = {}\n", variance.value());
      // Adjust included stocks
      ampl_.eval("let stockrun:={i in stockrun:weights[i]>0};");
      ampl_.eval("let stockopall:={i in stockrun:weights[i]>0.5};");
      // Set integrality back
      ampl_.setBoolOption("relax_integrality", false);
      ampl_.solve();
      fmt::print("QMIP result = {}\n", variance.value());
      // Store data of corrent frontier point
      data_.returns[step] = data_.maxret - (step - 1) * data_.step_size;
      data_.variances[step] = variance.value();
    }
  }

 public:
  Worker(Data &data, const char *modelDirectory)
    : data_(data), modelDirectory_(modelDirectory), loaded_(false) {
  }

  void solveRelaxation() {
    load();
    // Relax the integrality
    ampl_.setBoolOption("relax_integrality", true);
    // Solve the problem
    ampl_.solve();
  }

  double portfolioReturn() const {
    return ampl_.getVariable("portret").value();
  }

  ampl::DataFrame averageReturns() const {
    return ampl_.getParameter("averret").getValues();
  }

  void start() {
    thread_ = std::thread([this]() { run(); });
  }

  void join() {
    thread_.join();
  }
};

int main(int argc, char **argv) {
  if (argc != 3) {
    fmt::print("Usage: {} <models-dir> <num-workers>\n", argv[0]);
    return 1;
  }
  const char *modelDirectory = argv[1];

  unsigned num_workers = std::atoi(argv[2]);
  Data data;
  std::vector<std::unique_ptr<Worker>> workers;
  for (unsigned i = 0; i < num_workers; ++i) {
     workers.push_back(std::unique_ptr<Worker>(
                         new Worker(data, modelDirectory)));
  }

  workers[0]->solveRelaxation();

  // Number of steps of the efficient frontier
  auto num_steps = 20;

  // Calibrate the efficient frontier range
  double minret = workers[0]->portfolioReturn();
  ampl::DataFrame values = workers[0]->averageReturns();
  ampl::DataFrame::Column col = values.getColumn("averret");
  data.maxret = std::max_element(col.begin(), col.end())->dbl();
  data.step_size = (data.maxret - minret) / num_steps;
  data.last_step = num_steps;
  data.returns.resize(num_steps);
  data.variances.resize(num_steps);

  std::for_each(workers.begin(), workers.end(),
                [] (std::unique_ptr<Worker> &w) { w->start(); });
  std::for_each(workers.begin(), workers.end(),
                [] (std::unique_ptr<Worker> &w) { w->join(); });

  // Display efficient frontier points
  fmt::print("RETURN    VARIANCE\n");
  for (int i = 0; i < num_steps; i++)
    fmt::print("{:<6}  {:<6}\n", data.returns[i], data.variances[i]);
}
