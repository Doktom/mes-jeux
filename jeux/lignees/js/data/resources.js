// Ressources. group : 'base' (extraites), 'craft' (transformées), 'special'.
// era : ère où la ressource apparaît dans l'interface.
// Chaque ressource a un usage identifiable (voir DESIGN.md, section Ressources).
G.RESOURCES = {
  nourriture: { name: 'Nourriture', icon: '🌾', group: 'base', era: 1, color: '#e8c35a' },
  peaux:      { name: 'Peaux',      icon: '🐾', group: 'base', era: 0, color: '#b5835a' },
  vetements:  { name: 'Vêtements',  icon: '👘', group: 'craft', era: 0, color: '#c99a6b' },
  bois:       { name: 'Bois',       icon: '🪵', group: 'base', era: 1, color: '#b0835a' },
  pierre:     { name: 'Pierre',     icon: '🪨', group: 'base', era: 1, color: '#9ea3a8' },
  cuivre:     { name: 'Cuivre',     icon: '🟠', group: 'base', era: 1, color: '#d98b5a' },
  etain:      { name: 'Étain',      icon: '⚪', group: 'base', era: 1, color: '#c3c8d0' },
  bronze:     { name: 'Bronze',     icon: '🥉', group: 'craft', era: 1, color: '#c7894a' },
  outils:     { name: 'Outils',     icon: '🔨', group: 'craft', era: 1, color: '#8a8f99' },
  armes:      { name: 'Armes',      icon: '🗡️', group: 'craft', era: 1, color: '#b86b6b' },

  minerai_fer:   { name: 'Minerai de fer',   icon: '🟤', group: 'base', era: 2, color: '#8d6e63' },
  planches:      { name: 'Planches',         icon: '🪚', group: 'craft', era: 2, color: '#c9a273' },
  charbon_bois:  { name: 'Charbon de bois',  icon: '⚫', group: 'craft', era: 2, color: '#5f5a57' },
  fer:           { name: 'Fer',              icon: '🔩', group: 'craft', era: 2, color: '#7d8590' },
  farine:        { name: 'Farine',           icon: '🥣', group: 'craft', era: 2, color: '#efe3c8' },
  marbre:        { name: 'Marbre',           icon: '🤍', group: 'base', era: 2, color: '#e9e4da', rare: true },
  sculptures:    { name: 'Sculptures',       icon: '🗿', group: 'craft', era: 2, color: '#cfc6b4' },
  pain:          { name: 'Pain',             icon: '🍞', group: 'craft', era: 2, color: '#d9a35f' },
  or:            { name: 'Or',               icon: '🪙', group: 'base', era: 2, color: '#e3b83b', rare: true },
  bijoux:        { name: 'Bijoux',           icon: '💍', group: 'craft', era: 2, color: '#d9a7c7' },
  rouages:       { name: 'Rouages',          icon: '⏱️', group: 'craft', era: 2, color: '#b89a5e' },
  raisin:        { name: 'Raisin',           icon: '🍇', group: 'base', era: 2, color: '#8e6bb8' },
  vin:           { name: 'Vin',              icon: '🍷', group: 'craft', era: 2, color: '#9c3d54' },

  charbon:   { name: 'Charbon',   icon: '🪨', group: 'base', era: 3, color: '#3f3d3c' },
  laine:     { name: 'Laine',     icon: '🧶', group: 'base', era: 3, color: '#efe6f2' },
  acier:     { name: 'Acier',     icon: '🛠️', group: 'craft', era: 3, color: '#6d7c8c' },
  machines:  { name: 'Machines',  icon: '⚙️', group: 'craft', era: 3, color: '#7f8ea3' },
  textiles:  { name: 'Textiles',  icon: '🧵', group: 'craft', era: 3, color: '#c7a6d9' },
  gemmes:    { name: 'Gemmes',    icon: '💎', group: 'base', era: 3, color: '#5ec4c9', rare: true },
  meubles:   { name: 'Meubles',   icon: '🪑', group: 'craft', era: 3, color: '#a87b51' },

  uranium:      { name: 'Uranium',      icon: '☢️', group: 'base', era: 4, color: '#8fd16b', rare: true },
  electronique: { name: 'Électronique', icon: '💾', group: 'craft', era: 4, color: '#5d8fd6' },
  alliages:     { name: 'Alliages',     icon: '🧪', group: 'craft', era: 4, color: '#9fb4c7' },
  carburant:    { name: 'Carburant',    icon: '🛢️', group: 'craft', era: 4, color: '#3f5262' },

  savoir: { name: 'Savoir', icon: '📜', group: 'special', era: 1, color: '#7b93d6', uncapped: true },
};

// Ordre d'affichage.
G.RESOURCE_ORDER = Object.keys(G.RESOURCES);
