# Pokémon optimization problem in AMPL.
# Author: Victor Zverovich

# Set of Pokémon such as Arcanine or Rhydon.
set Pokemon;

# Set of Pokémon types such as Fire or Rock.
set Types;

# Type of each Pokémon.
param Type{Pokemon} symbolic in Types;

# Secondary Pokémon type, e.g. Flying in Rock/Flying. None if there is no
# secondary type.
param Type2{Pokemon} symbolic in Types default 'None';

# Attack advantage of Pokémon of type t over Pokémon of type u.
param Advantage{t in Types, u in Types} default 1;

# Pokémon IDs.
set IDs;

# Pokémon kind such as Arcanine or Rhydon.
param Kind{IDs} symbolic in Pokemon;

# Pokémon combat power.
param CP{IDs} integer > 0;

# Pokémon attack type or None if unknown.
param Attack{IDs} symbolic in Types default 'None';

# Attack power.
param Power{IDs} integer >= 0 default 0;

# Special attack type or None if unknown.
param Attack2{IDs} symbolic in Types default 'None';

# Special attack power.
param Power2{IDs} integer >= 0 default 0;

# Fraction of attacks that are special, e.g. 0.1 means that 10% of attacks
# are special.
param Attack2Fraction = 0.1;

# Pokémon's owner.
param User{IDs} symbolic default 'self';

# Pokémon that belong to me.
set MyPokemon = {i in IDs: User[i] = 'self'};

# Pokémon that belong to others.
set TheirPokemon = {i in IDs: User[i] != 'self'};

# Estimated average damage of Pokémon i attacking Pokémon j.
param Damage{i in IDs, j in IDs}
  = (Advantage[Attack[i], Type[Kind[j]]] *
     Advantage[Attack[i], Type2[Kind[j]]] * Power[i] * (1 - Attack2Fraction) +
     Advantage[Attack2[i], Type[Kind[j]]] *
     Advantage[Attack2[i], Type2[Kind[j]]] * Power2[i] * Attack2Fraction) / 2;

# Pokémon in an other team's gym.
param GymLevel;
param Defenders{1..GymLevel} symbolic in IDs;

# Fighting rounds.
set Rounds = 1..GymLevel;

# Specifies whether Pokémon p will fight in round r.
var use{p in MyPokemon, r in Rounds} binary;

var damage{r in Rounds} =
  sum{i in MyPokemon, j in {Defenders[r]}}
    use[i, r] * Damage[i, j] * log(CP[i]);

maximize total_damage: sum{r in Rounds} damage[r];

# Use at most one Pokémon in round r.
s.t. assign1{r in Rounds}: sum{p in MyPokemon} use[p, r] <= 1;

# Use Pokémon p in at most one round.
s.t. assign2{p in MyPokemon}: sum{r in Rounds} use[p, r] <= 1;

data;

set Types :=
  None
  Normal   Fire   Water  Electric Grass   Ice
  Fighting Poison Ground Flying   Psychic Bug
  Rock     Ghost  Dragon Dark     Steel   Fairy;

param:
 Pokemon:    Type     Type2 :=
  Aerodactyl Rock     Flying
  Arbok      Poison   .
  Arcanine   Fire     .
  Flareon    Fire     .
  Golduck    Water    .
  Golem      Rock     Ground
  Jynx       Psychic  Ice
  Machoke    Fighting .
  Magmar     Fire     .
  Parasect   Bug      Grass
  Pidgeot    Flying   Normal
  Ponyta     Fire     .
  Primeape   Fighting .
  Rhydon     Ground   Rock
  Sandslash  Ground   .
  Snorlax    Normal   .
  Vaporeon   Water    .;

# Data from http://pokemondb.net/type.
param Advantage:
         Normal Fire Water Electric Grass Ice Fighting Poison Ground Flying Psychic Bug Rock Ghost Dragon Dark Steel Fairy :=
Normal     .     .     .      .       .    .     .       .      .      .       .     .   0.5   0     .     .    0.5    .
Fire       .    0.5   0.5     .       2    2     .       .      .      .       .     2   0.5   .    0.5    .     2     .
Water      .     2    0.5     .      0.5   .     .       .      2      .       .     .    2    .    0.5    .     .     .
Electric   .     .     2     0.5     0.5   .     .       .      0      2       .     .    .    .    0.5    .     .     .
Grass      .    0.5    2      .      0.5   .     .      0.5     2     0.5      .    0.5   2    .    0.5    .    0.5    .
Ice        .    0.5   0.5     .       2   0.5    .       .      2      2       .     .    .    .     2     .    0.5    .
Fighting   2     .     .      .       .    2     .      0.5     .     0.5     0.5   0.5   2    0     .     2     2    0.5
Poison     .     .     .      .       2    .     .      0.5    0.5     .       .     .   0.5  0.5    .     .     0     2
Ground     .     2     .      2      0.5   .     .       2      .      0       .    0.5   2    .     .     .     2     .
Flying     .     .     .     0.5      2    .     2       .      .      .       .     2   0.5   .     .     .    0.5    .
Psychic    .     .     .      .       .    .     2       2      .      .      0.5    .    .    .     .     0    0.5    .
Bug        .    0.5    .      .       2    .    0.5     0.5     .     0.5      2     .    .   0.5    .     2    0.5   0.5
Rock       .     2     .      .       .    2    0.5      .     0.5     2       .     2    .    .     .     .    0.5    .
Ghost      0     .     .      .       .    .     .       .      .      .       2     .    .    2     .    0.5    .     .
Dragon     .     .     .      .       .    .     .       .      .      .       .     .    .    .     2     .    0.5    0
Dark       .     .     .      .       .    .    0.5      .      .      .       2     .    .    2     .    0.5    .    0.5
Steel      .    0.5   0.5    0.5      .    2     .       .      .      .       .     .    2    .     .     .    0.5    2
Fairy      .    0.5    .      .       .    .     2      0.5     .      .       .     .    .    .     2     2    0.5    .;

param:
 IDs: Kind        CP   Attack   Power Attack2  Power2 User:=
  m1  Arcanine   1535  Dark        6  Ground     30   .
  m2  Arcanine   1356  Fire        7  Fire       50   .
  m3  Rhydon     1057  Ground      6  Bug        55   .
  m4  Arcanine    968  Dark        6  Fire       50   .
  m5  Flareon     927  Fire       10  Fire       60   .
  m6  Sandslash   767  Ground     12  Ground     60   .
  m7  Primeape    751  Fighting    6  Fighting   25   .
  m8  Aerodactyl  677  Dark        6  Steel      40   .
  m9  Sandslash   669  Steel      12  Ground     30   .
 m10  Golem       668  Ground     12  Rock       30   .
 m11  Parasect    627  Bug         6  Poison     20   .
 m12  Arbok       596  Poison     10  Poison     60   .
 m13  Machoke     584  Fighting    5  Fighting   30   .
 m14  Primeape    576  Fighting    5  Fighting   55   .
  o1  Arcanine   1001  .           .  .           .   Wizzy264
  o2  Primeape    604  .           .  .           .   Drewceratops1
  o3  Arcanine   1157  .           .  .           .   EzekiaIIII
  o4  Arcanine    995  .           .  .           .   OGKUSHDADDYBIGD
  o5  Magmar      402  .           .  .           .   Sentilesdal
  o6  Pidgeot     483  .           .  .           .   RocketShorts
  o7  Snorlax     979  .           .  .           .   Mynuz
  o8  Ponyta      102  .           .  .           .   JustJeffed
  o9  Vaporeon   1106  .           .  .           .   BlackTrainer420
 o10  Arcanine   1179  .           .  .           .   KungPaoMetapod;

param GymLevel := 3;

param Defenders :=
  1 o5
  2 o6
  3 o7;

option solver cplex;
solve;

# Pokémon type including secondary type e.g. 'Rock/Flying' for output.
param PrintType{p in Pokemon} symbolic =
  Type[p] & if Type2[p] != 'None' then '/' & Type2[p] else '';

print 'Attack party:';
for{r in Rounds, i in MyPokemon, j in {Defenders[r]},
    p in {Kind[i]}, q in {Kind[j]}: use[i, r] != 0} {
  printf '%d %s %d (%s %s:%d %s:%d) vs ', r, p, CP[i], PrintType[p],
         Attack[i], Power[i], Attack2[i], Power2[i];
  printf '%s %d (%s): %g\n', q, CP[j], PrintType[q], Damage[i, j];
}

display Damage;
