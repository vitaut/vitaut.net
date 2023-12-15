package com.ampl.examples;

import com.ampl.Parameter;
import com.ampl.Variable;
import com.ampl.DataFrame;

public class CuttingStock {
  // Problem data
  public final static int overrun = 3;
  public final static int roll_width = 6450;
  public final static int widths[] = {677, 756, 1746, 1876};
  public final static int orders[] = {10, 40, 33, 10};

  public static void printSolution(Variable cut, Parameter rolls) {
    double[] cuttingPlan = cut.getValues().getColumnAsDoubles("val");
    DataFrame patterns = rolls.getValues();
    int numPatterns = patterns.getNumRows() / widths.length;
    for (int i = 0; i < numPatterns; ++i) {
      if (cuttingPlan[i] > 0) {
        for (int j = 0; j < widths.length; j++) {
          double value = (double)patterns.getRow(widths[j], i + 1)[2];
          if (value > 0)
            System.out.format("%s %4s %s\n", i + 1, widths[j], value);
        }
      }
    }
  }
}
