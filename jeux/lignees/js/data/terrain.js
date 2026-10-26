// Types de terrain de la grille.
// buildable : peut accueillir des bâtiments "génériques" (terrain: 'land').
// revealEra : les gisements restent cachés (affichés comme colline) avant cette ère.
G.TERRAIN = {
  plaine:   { name: 'Plaine',          color: '#cfe3b1', buildable: true },
  fertile:  { name: 'Terre fertile',   color: '#b6d690', buildable: true, desc: 'Fermes +50 %' },
  foret:    { name: 'Forêt',           color: '#9fc48d', buildable: false },
  colline:  { name: 'Colline',         color: '#ddd1b6', buildable: true },
  eau:      { name: 'Eau',             color: '#a8d2e4', buildable: false },
  montagne: { name: 'Montagne',        color: '#bdb7ae', buildable: false, desc: 'Infranchissable pour la construction' },
  g_cuivre:  { name: 'Gisement de cuivre',  color: '#ddd1b6', ore: '#d98b5a', revealEra: 1, buildable: false },
  g_etain:   { name: "Gisement d'étain",    color: '#ddd1b6', ore: '#b9c0cc', revealEra: 1, buildable: false },
  g_fer:     { name: 'Gisement de fer',     color: '#ddd1b6', ore: '#8d6e63', revealEra: 2, buildable: false },
  g_charbon: { name: 'Gisement de charbon', color: '#ddd1b6', ore: '#3f3d3c', revealEra: 3, buildable: false },
  g_marbre:  { name: 'Gisement de marbre',  color: '#ddd1b6', ore: '#f4f1ea', revealEra: 1, buildable: false, rare: true },
  g_or:      { name: 'Gisement d\'or',      color: '#ddd1b6', ore: '#e3b83b', revealEra: 2, buildable: false, rare: true },
  g_uranium: { name: 'Gisement d\'uranium', color: '#ddd1b6', ore: '#8fd16b', revealEra: 4, buildable: false, rare: true },
  g_gemmes:  { name: 'Gisement de gemmes',  color: '#ddd1b6', ore: '#5ec4c9', revealEra: 3, buildable: false, rare: true },
};

// Terrain visible pour le joueur (un gisement non révélé ressemble à une colline).
G.visibleTerrain = function (t, era) {
  const def = G.TERRAIN[t];
  if (def.revealEra !== undefined && era < def.revealEra) return 'colline';
  return t;
};
