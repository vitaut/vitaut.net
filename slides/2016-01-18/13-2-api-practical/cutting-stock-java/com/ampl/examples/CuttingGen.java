// Cutting stock with column generation via knapsack problem.

package com.ampl.examples;

import java.io.IOException;
import java.util.Arrays;
import com.ampl.AMPL;
import com.ampl.Variable;
import com.ampl.Constraint;
import com.ampl.Parameter;
import com.ampl.DataFrame;
import com.ampl.Tuple;
import static com.ampl.examples.CuttingStock.*;

class CuttingGen {

  // Solves a 0-1 knapsack problem using dynamic programming.
  private static double solve01Knapsack(
    int[] weights, double[] values, int capacity, boolean[] solution) {
    double[][] obj = new double[solution.length + 1][capacity + 1];
    boolean[][] sol = new boolean[solution.length + 1][capacity + 1];
    for (int i = 1; i <= solution.length; i++) {
      for (int c = 1; c <= capacity; c++) {
        double objWithoutItem = obj[i - 1][c];
        int weight = weights[i - 1];
        double objWithItem = weight <= c ?
          obj[i - 1][c - weight] + values[i - 1] : Integer.MIN_VALUE;
        boolean take = sol[i][c] = objWithItem > objWithoutItem;
        obj[i][c] = take ? objWithItem : objWithoutItem;
      }
    }
    for (int i = solution.length - 1, c = capacity; i >= 0; i--) {
       if (sol[i + 1][c]) {
         solution[i] = true;
         c = c - weights[i];
       } else {
         solution[i] = false;
       }
    }
    return obj[solution.length][capacity];
  }

  public static void main(String[] args) throws IOException {
    AMPL ampl = new AMPL();
    try {
      // Load cutting-stock model from file
      ampl.read("cut.mod");
      Variable cut = ampl.getVariable("Cut");
      Constraint limits = ampl.getConstraint("FinishedRollLimits");
      Parameter nPatternsParam = ampl.getParameter("nPatterns");
      Parameter rolls = ampl.getParameter("rolls");

      // Send data to AMPL model
      ampl.getParameter("overrun").set(overrun);
      int numPatterns = widths.length;
      nPatternsParam.set(numPatterns);
      DataFrame widthOrder = new DataFrame(1, "WIDTHS", "order");
      widthOrder.setColumn("WIDTHS", widths);
      widthOrder.setColumn("order", orders);
      ampl.setData(widthOrder, "WIDTHS");

      // Send initial patterns to AMPL model
      DataFrame initPatterns = new DataFrame(2, "WIDTHS", "PATTERNS", "rolls");
      int maxpat[] = new int[widths.length];
      for (int i = 0; i < widths.length; i++) {
        maxpat[i] = roll_width / widths[i];
        initPatterns.addRow(widths[i], i + 1, maxpat[i]);
      }
      ampl.setData(initPatterns);

      // Set solve options
      ampl.setOption("solver" ,"gurobi");
      ampl.setBoolOption("relax_integrality", true);

      while (true) {
        ampl.solve();

        // Get dual values to a DataFrame object
        double[] dualPrices = limits.getValues().getColumnAsDoubles("dual");

        int numKnapsackVars = 0;
        for (int i = 0; i < widths.length; i++)
          numKnapsackVars += dualPrices[i] > 0 ? maxpat[i] : 0;

        int[] weights = new int[numKnapsackVars];
        double[] values = new double[numKnapsackVars];
        for (int i = 0, fromIndex = 0; i < widths.length; i++) {
          if (dualPrices[i] > 0) {
            int toIndex = fromIndex + maxpat[i];
            Arrays.fill(weights, fromIndex, toIndex, widths[i]);
            Arrays.fill(values, fromIndex, toIndex, dualPrices[i]);
            fromIndex = toIndex;
          }
        }

        boolean[] knapsackSol = new boolean[numKnapsackVars];
        double value = solve01Knapsack(weights, values, roll_width, knapsackSol);
        if (value < 1.000001)
          break;

        int numItems = 0;
        for (int i = 0; i < numKnapsackVars; i++)
          if (knapsackSol[i]) ++numItems;
        int[] widthlist = new int[numItems];
        for (int i = 0, j = 0; i < numKnapsackVars; i++)
          if (knapsackSol[i]) widthlist[j++] = weights[i];

        nPatternsParam.set(++numPatterns);
        for (int i = 0; i < widths.length; i++) {
          int count = 0;
          for (int j = 0; j < numItems; j++)
            if (widthlist[j] == widths[i])
              ++count;
          rolls.set(new Tuple(widths[i], numPatterns), count);
        }
      }

      ampl.setBoolOption("relax_integrality", false);
      ampl.solve();
      printSolution(cut, rolls);
    } finally {
      ampl.close();
    }
  }
}
