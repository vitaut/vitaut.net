// Cutting stock with pre-generation of all patterns.

package com.ampl.examples;

import java.util.Arrays;
import java.util.ArrayList;
import java.util.List;
import java.util.Collections;
import java.io.IOException;
import com.ampl.AMPL;
import com.ampl.DataFrame;
import static com.ampl.examples.CuttingStock.*;

class CuttingAll {

  private static void sortDescending(int[] array) {
    Integer[] sort_array = new Integer[array.length];
    for (int i = 0; i < array.length; i++)
      sort_array[i] = array[i];
    Arrays.sort(sort_array, Collections.reverseOrder());
    for (int i = 0; i < array.length; i++)
      array[i] = sort_array[i];
  }

  // roll_width: remaining roll width
  // widths: ordered widths (sorted)
  // startIndex: index of the first width to use in the pattern
  // patterns: output patterns concatenated into a single array
  //
  // patterns[i * widths.length + j] gives the number of widths j in pattern i.
  // For example:
  //   patterns: [0, 0, 0, 4,  <- pattern 0: 4 of width 3
  //              1, 3, 2, 0]  <- pattern 1: 1 of width 1, 3 of width 2, 2 of width 3
  private static void patternGen(
      int roll_width, int[] widths, int startIndex, List<Integer> patterns) {
    if (startIndex == widths.length - 1) {
      for (int i = 0; i < widths.length - 1; i++)
        patterns.add(0);
      patterns.add(roll_width / widths[startIndex]);
    } else {
      for (int n = roll_width / widths[startIndex]; n >= 0; --n) {
        int patternIndex = patterns.size() + startIndex;
        patternGen(roll_width - n * widths[startIndex], widths, startIndex + 1, patterns);
        for (; patternIndex < patterns.size(); patternIndex += widths.length)
          patterns.set(patternIndex, n);
      }
    }
  }

  public static void main(String[] args) throws IOException {
    int[] sortedWidths = widths.clone();
    sortDescending(sortedWidths);
    ArrayList<Integer> patterns = new ArrayList<>();
    patternGen(roll_width, sortedWidths, 0, patterns);
    
    // Initialize and load cutting-stock model from file
    AMPL ampl = new AMPL();
    try {
      ampl.read("cut.mod");

      // Send data to AMPL model
      ampl.getParameter("overrun").setValues(overrun);
      int numPatterns = patterns.size() / widths.length;
      ampl.getParameter("nPatterns").setValues(numPatterns);

      DataFrame widthOrder = new DataFrame(1, "WIDTHS", "order");
      widthOrder.setColumn("WIDTHS", widths);
      widthOrder.setColumn("order", orders);
      ampl.setData(widthOrder, "WIDTHS");

      DataFrame allPatterns = new DataFrame(2, "WIDTHS", "PATTERNS", "rolls");
      for (int i = 0; i < widths.length; i++) {
        for (int j = 0; j < numPatterns; j++) {
          allPatterns.addRow(
            sortedWidths[i], j + 1, patterns.get(j * widths.length + i));
        }
      }
      ampl.setData(allPatterns);

      // Solve
      ampl.setOption("solver", "gurobi");
      ampl.solve();
      printSolution(ampl.getVariable("Cut"), ampl.getParameter("rolls"));
    } finally {
      ampl.close();
    }
  }
}
