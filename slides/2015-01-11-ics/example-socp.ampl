var x;
var y;
var u >= 0;
var v >= 0;
minimize obj: u + v;
s.t. c1: (x + 2) ^ 2 + (y + 1) ^ 2 <= u ^ 2;
s.t. c2: (x + y) ^ 2 <= v ^ 2;