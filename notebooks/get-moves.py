#!/usr/bin/env python
# coding: utf-8
# Get Pokémon GO move data from http://www.pokemongodb.net.

from __future__ import print_function
from bs4 import BeautifulSoup
import re, urllib
import pandas as pd

def get_moves(kind, moves):
    r = urllib.urlopen('http://www.pokemongodb.net/2016/04/{}-move.html'.format(kind)).read()
    soup = BeautifulSoup(r, "html.parser")
    for tr in soup.table.find_all('tr')[2:]:
        move, type, rank, dps, power, seconds, energy = [td.contents[0] for td in tr.find_all('td')]
        move = move.contents[0]
        if move.endswith('STAB'):
            continue
        move = ''.join(move.split(' '))
        type = re.sub('.*/(.*)-type-moves.html', r'\1', type['href']).title()
        moves.append({'Move': move, 'Type': type, 'Power': power, 'Cooldown': seconds})

moves = []
for kind in ['fast', 'charge']:
  get_moves(kind, moves)
df = pd.DataFrame(moves, columns=('Move', 'Type', 'Power', 'Cooldown')).set_index('Move')
pd.set_option('display.max_rows', len(df))
print(df)
