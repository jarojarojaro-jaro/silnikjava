"""Materiały wokseli (uint8 w siatce świata). Kolejność = numer; 0 to powietrze.

Nowy materiał: dopisz nazwę na końcu listy i jego teksturę w render.textures().
"""

NAMES = [
    'AIR', 'GRASS', 'DIRT', 'STONE', 'STONE_D', 'SAND', 'WATER', 'LOG_OAK', 'LOG_BIRCH',
    'LEAF_GOLD', 'LEAF_ORANGE', 'LEAF_PINE', 'PLANKS', 'BRICK_RED', 'PLASTER', 'ROOF',
    'GLASS_LAMP', 'IRON', 'LANT_LIGHT', 'COBBLE', 'MOSS', 'WINDOW', 'DOOR', 'ROCK_SEA',
    'BOAT', 'BOAT_RED', 'SAIL', 'FOX', 'FOX_WHITE', 'FOX_DARK', 'LEAF_GREEN', 'CHIMNEY',
    'SNOW', 'LACQUER', 'ROOF_GREEN', 'LANT_STONE', 'PAPER_LIGHT', 'WOOD_DARK', 'LEAF_RED',
]
for _i, _n in enumerate(NAMES):
    globals()[_n] = _i

# świecące: kolor i siła emisji (ramka materiału zostaje ciemna)
EMISSIVE = {
    GLASS_LAMP: ((1.0, 0.86, 0.55), 2.2),
    LANT_LIGHT: ((1.0, 0.70, 0.36), 3.0),
    WINDOW: ((1.0, 0.70, 0.36), 2.0),
    PAPER_LIGHT: ((1.0, 0.78, 0.45), 2.4),
}
