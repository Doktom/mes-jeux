// Ères, technologies, décrets, origines, héritage, difficulté et ennemis.
//
// Format commun des effets (agrégés par G.mods) :
//   { t: 'prod', target: 'all' | 'cat:<cat>' | '<buildingId>' | 'res:<ressource>', v: +0.25 }
//   { t: 'cost' | 'tile' | 'adj' | 'towerDmg' | 'towerRate' | 'hp' | 'pop' | 'consume'
//        | 'storage' | 'waveCount' | 'waveHp' | 'loot' | 'repair' | 'offline' | 'start', v }
//   { t: 'popFlat', target: '<buildingId>', v: +1 }
//   { t: 'unlock', b: '<buildingId>' }

G.ERAS = [
  {
    id: 0, name: 'Préhistoire', short: 'Préhistoire', color: '#dcc3a0',
    intro: 'Un feu, quelques huttes, la forêt tout autour. Cueillez, taillez, survivez : l\'agriculture vous attend.',
    storageMult: 0.8,
    advance: { tech: 't_agriculture', cost: { bois: 120, pierre: 60, nourriture: 80, outils: 5, vetements: 10 } },
  },
  {
    id: 1, name: 'Antiquité', short: 'Antiquité', color: '#e9c98b',
    intro: 'Les champs se dessinent, les premiers métaux brillent. Nourrissez votre peuple, taillez la pierre et découvrez le bronze.',
    storageMult: 1,
    advance: { tech: 't_fer', cost: { pierre: 220, bronze: 50, outils: 30 } },
  },
  {
    id: 2, name: 'Moyen Âge', short: 'Moyen Âge', color: '#b9c7e6',
    intro: 'Le fer change le monde. De nouveaux gisements apparaissent, vos huttes peuvent devenir des maisons.',
    storageMult: 2.5,
    advance: { tech: 't_imprimerie', cost: { fer: 250, outils: 200, planches: 300, pain: 150 } },
  },
  {
    id: 3, name: 'Ère industrielle', short: 'Industrie', color: '#c9b8e8',
    intro: 'La vapeur s\'éveille. Le charbon affleure, l\'énergie devient votre nouvelle contrainte.',
    storageMult: 6,
    advance: { tech: 't_electricite', cost: { acier: 1200, machines: 500, textiles: 300, bijoux: 40 } },
  },
  {
    id: 4, name: 'Ère spatiale', short: 'Espace', color: '#9fd3e6',
    intro: 'L\'électricité, l\'électronique, puis les étoiles. Un dernier défi : construire un vaisseau et quitter la planète.',
    storageMult: 14,
    advance: null, // dernière ère : la partie s'achève par le lancement du vaisseau spatial
  },
];

// Multiplicateur appliqué au coût en savoir de toutes les technologies.
G.TECH_COST_MULT = 1.35;

G.TECHS = {
  // Préhistoire
  t_cueillette: { era: 0, name: 'Cueillette', cost: 20, req: [], effects: [{ t: 'prod', target: 'cueilleur', v: 0.25 }], desc: 'Cueilleurs +25 %.' },
  t_feu:        { era: 0, name: 'Maîtrise du feu', cost: 15, req: [], effects: [{ t: 'unlock', b: 'foyer' }], desc: 'Grand foyer : les huttes voisines logent +25 %.' },
  t_silex:      { era: 0, name: 'Taille du silex', cost: 20, req: [], effects: [{ t: 'unlock', b: 'tailleur' }], desc: 'Tailleur de silex : les premiers outils.' },
  t_tannage:    { era: 0, name: 'Tannage', cost: 25, req: [], effects: [{ t: 'unlock', b: 'tanneur' }], desc: 'Tanneur : peaux → vêtements.' },
  t_art:        { era: 0, name: 'Art rupestre', cost: 35, req: ['t_feu'], effects: [{ t: 'unlock', b: 'grotte' }, { t: 'unlock', b: 'cercle_pierres' }], desc: 'Grotte ornée (savoir) et Cercle de pierres (merveille).' },
  t_agriculture: { era: 0, name: 'Agriculture', cost: 60, req: ['t_silex'], effects: [], desc: 'Permet de passer à l\'Antiquité (fermes).', eraKey: true },

  // Antiquité
  t_peche:      { era: 1, name: 'Pêche', cost: 30, req: [], effects: [{ t: 'unlock', b: 'peche' }], desc: 'Débloque la pêcherie.' },
  t_irrigation: { era: 1, name: 'Irrigation', cost: 60, req: [], effects: [{ t: 'prod', target: 'ferme', v: 0.25 }], desc: 'Fermes +25 %.' },
  t_bronze:     { era: 1, name: 'Métallurgie du bronze', cost: 60, req: [], effects: [{ t: 'unlock', b: 'mine_cuivre' }, { t: 'unlock', b: 'mine_etain' }, { t: 'unlock', b: 'fonderie' }], desc: 'Mines de cuivre et d\'étain, fonderie.' },
  t_ecriture:   { era: 1, name: 'Écriture', cost: 80, req: [], effects: [{ t: 'unlock', b: 'bibliotheque' }], desc: 'Débloque la bibliothèque.' },
  t_outils:     { era: 1, name: 'Outillage', cost: 100, req: ['t_bronze'], effects: [{ t: 'unlock', b: 'atelier' }], desc: 'Débloque l\'atelier (outils).' },
  t_tactique:   { era: 1, name: 'Tactique militaire', cost: 120, req: ['t_bronze'], effects: [{ t: 'unlock', b: 'armurerie' }, { t: 'unlock', b: 'caserne' }], desc: 'Armurerie et caserne.' },
  t_urbanisme:  { era: 1, name: 'Urbanisme', cost: 150, req: ['t_ecriture'], effects: [{ t: 'popFlat', target: 'hutte', v: 1 }, { t: 'tile', v: -0.15 }], desc: 'Huttes +1 habitant, expansion −15 %.' },
  t_fer:        { era: 1, name: 'Âge du Fer', cost: 250, req: ['t_outils', 't_tactique', 't_urbanisme'], effects: [], desc: 'Permet de passer au Moyen Âge.', eraKey: true },

  // Moyen Âge
  t_charbon:    { era: 2, name: 'Charbonnage', cost: 200, req: [], effects: [{ t: 'unlock', b: 'charbonniere' }, { t: 'unlock', b: 'mine_fer' }, { t: 'unlock', b: 'bas_fourneau' }], desc: 'Charbonnière, mine de fer, bas fourneau.' },
  t_meunerie:   { era: 2, name: 'Meunerie', cost: 220, req: [], effects: [{ t: 'unlock', b: 'moulin' }, { t: 'unlock', b: 'boulangerie' }, { t: 'unlock', b: 'maison' }], desc: 'Moulin, boulangerie et maisons.' },
  t_maconnerie: { era: 2, name: 'Maçonnerie', cost: 250, req: [], effects: [{ t: 'unlock', b: 'rempart' }, { t: 'hp', v: 0.2 }], desc: 'Remparts, bâtiments +20 % PV.' },
  t_forge:      { era: 2, name: 'Forge', cost: 320, req: ['t_charbon'], effects: [{ t: 'unlock', b: 'forge' }], desc: 'Débloque la forge (outils en fer).' },
  t_arbalete:   { era: 2, name: 'Arbalète', cost: 350, req: ['t_charbon'], effects: [{ t: 'unlock', b: 'forge_armes' }, { t: 'unlock', b: 'tour_arbaletriers' }], desc: 'Forge d\'armes et tour d\'arbalétriers.' },
  t_monastere:  { era: 2, name: 'Monachisme', cost: 320, req: ['t_meunerie'], effects: [{ t: 'unlock', b: 'monastere' }], desc: 'Débloque le monastère.' },
  t_guildes:    { era: 2, name: 'Guildes', cost: 600, req: ['t_forge'], effects: [{ t: 'prod', target: 'cat:craft', v: 0.25 }], desc: 'Artisanat +25 %.' },
  t_viticulture: { era: 2, name: 'Viticulture', cost: 260, req: ['t_meunerie'], effects: [{ t: 'unlock', b: 'vignoble' }, { t: 'unlock', b: 'pressoir' }], desc: 'Vignoble et pressoir : le vin rend les maisons heureuses.' },
  t_sculpture:  { era: 2, name: 'Sculpture', cost: 300, req: ['t_maconnerie'], effects: [{ t: 'unlock', b: 'carriere_marbre' }, { t: 'unlock', b: 'sculpteur' }], desc: 'Carrière de marbre (ressource rare) et atelier de sculpteur.' },
  t_orfevrerie: { era: 2, name: 'Orfèvrerie', cost: 450, req: ['t_forge'], effects: [{ t: 'unlock', b: 'mine_or' }, { t: 'unlock', b: 'orfevrerie' }], desc: 'Mine d\'or (ressource rare) et orfèvrerie : des bijoux.' },
  t_horlogerie: { era: 2, name: 'Horlogerie', cost: 400, req: ['t_forge'], effects: [{ t: 'unlock', b: 'horloger' }, { t: 'unlock', b: 'tour_horloge' }], desc: 'Atelier d\'horloger et Tour de l\'horloge (vitesse ×5 et ×10).' },
  t_imprimerie: { era: 2, name: 'Imprimerie', cost: 1200, req: ['t_guildes', 't_arbalete', 't_monastere'], effects: [], desc: 'Permet de passer à l\'ère industrielle.', eraKey: true },

  // Ère industrielle
  t_vapeur:     { era: 3, name: 'Machine à vapeur', cost: 1500, req: [], effects: [{ t: 'unlock', b: 'mine_charbon' }, { t: 'unlock', b: 'centrale' }, { t: 'unlock', b: 'centrale_bois' }, { t: 'unlock', b: 'relais' }], desc: 'Mine de charbon, centrales à vapeur et à bois, relais électriques.' },
  t_eolien:     { era: 3, name: 'Énergie éolienne', cost: 1800, req: ['t_vapeur'], effects: [{ t: 'unlock', b: 'eolienne' }], desc: 'Éoliennes : de l\'électricité sans combustible.' },
  t_acier:      { era: 3, name: 'Sidérurgie', cost: 2000, req: ['t_vapeur'], effects: [{ t: 'unlock', b: 'haut_fourneau' }], desc: 'Débloque le haut fourneau (acier).' },
  t_meca:       { era: 3, name: 'Mécanisation', cost: 3000, req: ['t_acier'], effects: [{ t: 'unlock', b: 'usine' }], desc: 'Débloque l\'usine mécanique.' },
  t_textile:    { era: 3, name: 'Industrie textile', cost: 2500, req: ['t_acier'], effects: [{ t: 'unlock', b: 'bergerie' }, { t: 'unlock', b: 'filature' }, { t: 'unlock', b: 'immeuble' }], desc: 'Bergerie, filature et immeubles.' },
  t_mobilier:   { era: 3, name: 'Mobilier', cost: 2200, req: ['t_textile'], effects: [{ t: 'unlock', b: 'ebenisterie' }], desc: 'Ébénisterie : des meubles pour le confort des immeubles.' },
  t_universite: { era: 3, name: 'Universités', cost: 3500, req: ['t_meca'], effects: [{ t: 'unlock', b: 'universite' }], desc: 'Débloque l\'université.' },
  t_artillerie: { era: 3, name: 'Artillerie', cost: 2500, req: ['t_acier'], effects: [{ t: 'unlock', b: 'artillerie' }, { t: 'unlock', b: 'mur_acier' }], desc: 'Batterie d\'artillerie et mur d\'acier.' },

  t_mineralogie: { era: 3, name: 'Minéralogie', cost: 2600, req: ['t_acier'], effects: [{ t: 'unlock', b: 'mine_gemmes' }], desc: 'Mine de gemmes (ressource rare).' },
  t_electricite: { era: 3, name: 'Électricité', cost: 5000, req: ['t_meca', 't_universite'], effects: [], desc: 'Permet de passer à l\'ère spatiale.', eraKey: true },

  // Ère spatiale : la course vers les étoiles
  t_informatique: { era: 4, name: 'Informatique', cost: 9000, req: [], effects: [{ t: 'unlock', b: 'electronicien' }, { t: 'unlock', b: 'centre_recherche' }, { t: 'unlock', b: 'residence' }], desc: 'Électronique, centre de recherche, résidences.' },
  t_raffinage:   { era: 4, name: 'Raffinage', cost: 8000, req: [], effects: [{ t: 'unlock', b: 'raffinerie' }], desc: 'Raffinerie : charbon → carburant.' },
  t_solaire:     { era: 4, name: 'Énergie solaire', cost: 11000, req: ['t_informatique'], effects: [{ t: 'unlock', b: 'centrale_solaire' }, { t: 'unlock', b: 'tour_laser' }], desc: 'Centrale solaire et tour laser.' },
  t_materiaux:   { era: 4, name: 'Matériaux composites', cost: 12000, req: ['t_informatique'], effects: [{ t: 'unlock', b: 'fonderie_alliages' }], desc: 'Fonderie d\'alliages : acier + gemmes.' },
  t_nucleaire:   { era: 4, name: 'Énergie nucléaire', cost: 14000, req: ['t_informatique', 't_materiaux'], effects: [{ t: 'unlock', b: 'centrale_nucleaire' }, { t: 'unlock', b: 'mine_uranium' }], desc: 'Mine d\'uranium (ressource rare) et centrale nucléaire.' },
  t_fusees:      { era: 4, name: 'Fusées', cost: 20000, req: ['t_materiaux', 't_raffinage'], effects: [{ t: 'prod', target: 'res:carburant', v: 0.25 }], desc: 'Carburant +25 %. Première étape vers l\'espace.' },
  t_survie:      { era: 4, name: 'Systèmes de survie', cost: 20000, req: ['t_informatique', 't_solaire'], effects: [{ t: 'prod', target: 'res:electronique', v: 0.25 }], desc: 'Électronique +25 %. Il faudra respirer, là-haut.' },
  t_vaisseau:    { era: 4, name: 'Vaisseau interstellaire', cost: 40000, req: ['t_fusees', 't_survie'], effects: [{ t: 'unlock', b: 'pas_de_tir' }], desc: 'Débloque le pas de tir : construisez le vaisseau et quittez la planète.' },

  // Technologies répétables (progression sans limite)
  r_rationalisation: { era: 3, name: 'Rationalisation', cost: 6000, req: ['t_meca'], repeat: 1.6, effects: [{ t: 'prod', target: 'all', v: 0.1 }], desc: 'Production +10 % (répétable).' },
  r_doctrine:        { era: 3, name: 'Doctrine défensive', cost: 6000, req: ['t_artillerie'], repeat: 1.6, effects: [{ t: 'towerDmg', v: 0.15 }, { t: 'hp', v: 0.1 }], desc: 'Tours +15 %, PV +10 % (répétable).' },
};

// Décrets majeurs : un choix parmi 3 au début de chaque nouvelle ère.
// Les décrets "risk" offrent un gros gain avec une contrepartie.
G.DECREES_MAJOR = {
  d_synergie:    { name: 'Urbanisme organique', icon: '🧩', effects: [{ t: 'adj', v: 0.5 }], desc: 'Bonus de voisinage ×1,5.' },
  d_greniers:    { name: 'Greniers abondants', icon: '🌾', effects: [{ t: 'prod', target: 'cat:food', v: 0.4 }], desc: 'Production de nourriture +40 %.' },
  d_artisans:    { name: 'Maîtres artisans', icon: '🔨', effects: [{ t: 'prod', target: 'cat:craft', v: 0.3 }], desc: 'Bâtiments d\'artisanat +30 %.' },
  d_batisseurs:  { name: 'Bâtisseurs', icon: '🏗️', effects: [{ t: 'cost', v: -0.25 }], desc: 'Coûts de construction −25 %.' },
  d_frontieres:  { name: 'Frontières ouvertes', icon: '🗺️', effects: [{ t: 'tile', v: -0.4 }], desc: 'Expansion du territoire −40 %.' },
  d_garnison:    { name: 'Garnison d\'élite', icon: '🛡️', effects: [{ t: 'towerDmg', v: 0.4 }], desc: 'Dégâts des tours +40 %.' },
  d_erudits:     { name: 'Érudits', icon: '📜', effects: [{ t: 'prod', target: 'res:savoir', v: 0.5 }], desc: 'Savoir +50 %.' },
  d_natalite:    { name: 'Natalité', icon: '👶', effects: [{ t: 'pop', v: 0.3 }], desc: 'Logements +30 % de population.' },
  d_logistique:  { name: 'Logistique', icon: '📦', effects: [{ t: 'storage', v: 0.75 }, { t: 'prod', target: 'all', v: 0.1 }], desc: 'Stockage +75 %, production +10 %.' },
  d_pacte:       { name: 'Pacte de sang', icon: '🩸', risk: true, effects: [{ t: 'towerDmg', v: 0.8 }, { t: 'waveCount', v: 0.25 }], desc: 'Tours +80 % de dégâts, mais vagues +25 % d\'ennemis.' },
  d_lumieres:    { name: 'Siècle des lumières', icon: '💡', risk: true, effects: [{ t: 'prod', target: 'res:savoir', v: 1 }, { t: 'towerDmg', v: -0.25 }], desc: 'Savoir ×2, mais tours −25 %.' },
  d_austerite:   { name: 'Austérité', icon: '⚖️', risk: true, effects: [{ t: 'consume', v: -0.4 }, { t: 'prod', target: 'all', v: -0.1 }], desc: 'Consommation des habitants −40 %, production −10 %.' },
  d_conquete:    { name: 'Esprit de conquête', icon: '🏴', risk: true, effects: [{ t: 'loot', v: 1.5 }, { t: 'waveHp', v: 0.2 }], desc: 'Butin des vagues ×2,5, mais ennemis +20 % PV.' },
};

// Faveurs mineures : un choix parmi 3 toutes les 5 vagues repoussées. Cumulables.
G.DECREES_MINOR = {
  m_butin:      { name: 'Pillards pillés', icon: '💰', effects: [{ t: 'loot', v: 0.5 }], desc: 'Butin des vagues +50 %.' },
  m_murs:       { name: 'Mortier renforcé', icon: '🧱', effects: [{ t: 'hp', v: 0.3 }], desc: 'PV des bâtiments +30 %.' },
  m_prod:       { name: 'Ardeur au travail', icon: '💪', effects: [{ t: 'prod', target: 'all', v: 0.08 }], desc: 'Production +8 %.' },
  m_savoir:     { name: 'Curiosité', icon: '🔭', effects: [{ t: 'prod', target: 'res:savoir', v: 0.15 }], desc: 'Savoir +15 %.' },
  m_tours:      { name: 'Entraînement', icon: '🎯', effects: [{ t: 'towerDmg', v: 0.15 }], desc: 'Dégâts des tours +15 %.' },
  m_cadence:    { name: 'Cadence', icon: '⏱️', effects: [{ t: 'towerRate', v: 0.15 }], desc: 'Cadence de tir +15 %.' },
  m_stock:      { name: 'Silos', icon: '🏚️', effects: [{ t: 'storage', v: 0.3 }], desc: 'Stockage +30 %.' },
  m_reparation: { name: 'Charpentiers', icon: '🪛', effects: [{ t: 'repair', v: -0.5 }], desc: 'Réparations −50 %.' },
  m_cache:      { name: 'Cache oubliée', icon: '🎁', instant: 'cache', effects: [], desc: 'Remplit immédiatement 50 % de vos réserves de base.' },
  m_expansion:  { name: 'Éclaireurs', icon: '🧭', effects: [{ t: 'tile', v: -0.15 }], desc: 'Expansion −15 %.' },
};

// Origines : choisies au début de chaque partie, elles orientent la carte et le style de jeu.
G.ORIGINS = {
  fluviale: {
    name: 'Cité fluviale', icon: '🌊', unlocked: true,
    desc: 'Beaucoup d\'eau. Pêcherie disponible dès le départ, fermes +15 %.',
    map: { eau: 1.8 }, effects: [{ t: 'unlock', b: 'peche' }, { t: 'prod', target: 'ferme', v: 0.15 }],
  },
  forets: {
    name: 'Peuple des forêts', icon: '🌲', cost: 25,
    desc: 'Forêts denses. Bûcherons +30 %, +100 bois au départ.',
    map: { foret: 1.8 }, effects: [{ t: 'prod', target: 'bucheron', v: 0.3 }], start: { bois: 100 },
  },
  collines: {
    name: 'Clan des collines', icon: '⛰️', cost: 40,
    desc: 'Collines et gisements abondants. Carrières et mines +25 %.',
    map: { colline: 1.8, ore: 1.6 }, effects: [{ t: 'prod', target: 'carriere', v: 0.25 }, { t: 'prod', target: 'cat:raw', v: 0.1 }],
  },
  guerriers: {
    name: 'Tribu guerrière', icon: '⚔️', cost: 60,
    desc: 'Tours +30 %, butin +50 %, mais vagues +15 % d\'ennemis. Héritage +15 %.',
    map: {}, effects: [{ t: 'towerDmg', v: 0.3 }, { t: 'loot', v: 0.5 }, { t: 'waveCount', v: 0.15 }], heritageMult: 0.15,
  },
};

// Arbre d'héritage : bonus permanents achetés entre les parties.
G.HERITAGE = {
  h_fondations: { name: 'Fondations', icon: '🏺', max: 5, cost: l => 8 + l * 8, effect: l => [{ t: 'start', v: 0.5 * l }], desc: 'Ressources de départ +50 % par niveau.' },
  h_artisans:   { name: 'Savoir-faire ancestral', icon: '🧰', max: 10, cost: l => Math.round(12 * Math.pow(1.35, l)), effect: l => [{ t: 'prod', target: 'all', v: 0.05 * l }], desc: 'Production +5 % par niveau.' },
  h_memoire:    { name: 'Mémoire des anciens', icon: '📖', max: 5, cost: l => 10 + l * 10, effect: l => [{ t: 'prod', target: 'res:savoir', v: 0.1 * l }], desc: 'Savoir +10 % par niveau.' },
  h_fortif:     { name: 'Tradition martiale', icon: '🏰', max: 5, cost: l => 10 + l * 10, effect: l => [{ t: 'towerDmg', v: 0.1 * l }], desc: 'Dégâts des tours +10 % par niveau.' },
  h_absence:    { name: 'Intendants', icon: '🕰️', max: 4, cost: l => 15 + l * 15, effect: l => [{ t: 'offline', v: 0.1 * l }], desc: 'Efficacité hors ligne +10 % par niveau (base 60 %).' },
  h_terres:     { name: 'Terres ancestrales', icon: '🗺️', max: 2, cost: l => [50, 120][l], effect: l => [], desc: 'Territoire de départ agrandi d\'un anneau par niveau.' },
  h_eclaire:    { name: 'Conseil éclairé', icon: '🦉', max: 1, cost: () => 70, effect: l => [], desc: '4 choix de décrets au lieu de 3.' },
  h_relance:    { name: 'Oracles', icon: '🎲', max: 3, cost: l => 25 + l * 25, effect: l => [], desc: '+1 relance de décret par partie, par niveau.' },
  h_porteurs:   { name: 'Guilde des porteurs', icon: '🚚', max: 3, cost: l => [40, 90, 160][l], effect: l => [], desc: '+1 porteur pour chaque bâtiment, par niveau.' },
  h_vitesse:    { name: 'Sandales légères', icon: '👟', max: 5, cost: l => 15 + l * 15, effect: l => [{ t: 'logi', v: 0.1 * l }], desc: 'Porteurs +10 % plus rapides par niveau.' },
  h_stockage:   { name: 'Greniers ancestraux', icon: '🏚️', max: 5, cost: l => 12 + l * 12, effect: l => [{ t: 'storage', v: 0.2 * l }], desc: 'Stockage +20 % par niveau.' },
  h_gisements:  { name: 'Sourciers', icon: '🪄', max: 4, cost: l => 20 + l * 20, effect: l => [], desc: 'Gisements +25 % plus riches par niveau (sans effet tant que les gisements sont inépuisables).' },
  h_archives:   { name: 'Archives', icon: '🗃️', max: 3, cost: l => [30, 70, 140][l], effect: l => [], desc: 'Commencez avec des technologies déjà connues (Préhistoire, puis Antiquité).' },
  h_niveaux:    { name: 'Maîtres d\'œuvre', icon: '🏗️', max: 2, cost: l => [80, 200][l], effect: l => [], desc: 'Niveau maximum des bâtiments +1, par niveau.' },
  h_contrats:   { name: 'Réseau de notaires', icon: '📜', max: 2, cost: l => [40, 100][l], effect: l => [], desc: '+1 contrat simultané et récompenses +25 %, par niveau.' },
  h_gloire:     { name: 'Hérauts', icon: '📯', max: 3, cost: l => [50, 110, 200][l], effect: l => [], desc: '+1 gloire ✨ à chaque ère atteinte, par niveau.' },
};

// Difficulté, choisie avant de fonder la partie.
// Paisible : aucun envahisseur. Les niveaux + se débloquent un à un : atteindre l'ère industrielle
// en Paisible débloque +, l'atteindre en + débloque ++, etc.
G.RIGUEUR = [
  { name: 'Paisible', icon: '🕊️', waves: false, heritage: 0.75, desc: 'Aucun envahisseur : construisez et optimisez en paix.' },
  { name: 'Difficulté +', icon: '⚔️', waves: true, waveHp: 0, waveCount: 0, heritage: 1.25, desc: 'Des vagues d\'envahisseurs attaquent votre cité. Tours, murs et casernes deviennent indispensables.' },
  { name: 'Difficulté ++', icon: '⚔️', waves: true, waveHp: 0.5, waveCount: 0.2, heritage: 1.6, start: -0.2, waveInterval: -0.15, desc: 'Ennemis robustes et nombreux, vagues plus fréquentes. Ressources de départ −20 %.' },
  { name: 'Difficulté +++', icon: '☠️', waves: true, waveHp: 1.2, waveCount: 0.4, heritage: 2, start: -0.35, waveInterval: -0.25, offline: -0.2, desc: 'Vagues brutales et rapprochées, ressources de départ −35 %, production hors ligne réduite.' },
];

// Ennemis par ère. speed en cases/s, dmg en dégâts/s au contact.
// thief : vole les cellules en transit puis s'enfuit (le butin revient si on l'abat).
// sapper : vise les réserves (forum, entrepôts) et inflige ×3 dégâts aux bâtiments.
G.ENEMIES = [
  { thief: { name: 'Renard', hp: 8, speed: 1.0, dmg: 1, r: 0.14, color: '#d39a5c' },
    sapper: { name: 'Pyromane', hp: 18, speed: 0.5, dmg: 4, r: 0.18, color: '#c96a3a' },
    basic: { name: 'Loup', hp: 10, speed: 0.6, dmg: 3, r: 0.17, color: '#a7a19a' },
    heavy: { name: 'Ours', hp: 35, speed: 0.45, dmg: 7, r: 0.24, color: '#8a6a50' },
    boss:  { name: 'Mammouth', hp: 180, speed: 0.3, dmg: 10, r: 0.38, color: '#6e5440' } },
  { thief: { name: 'Chapardeur', hp: 12, speed: 0.9, dmg: 2, r: 0.15, color: '#c9a04a' },
    sapper: { name: 'Incendiaire', hp: 30, speed: 0.5, dmg: 6, r: 0.2, color: '#c96a3a' },
    basic: { name: 'Pillard', hp: 18, speed: 0.55, dmg: 4, r: 0.18, color: '#d98080' },
    heavy: { name: 'Guerrier', hp: 50, speed: 0.4, dmg: 9, r: 0.24, color: '#b85d5d' },
    boss:  { name: 'Chef barbare', hp: 260, speed: 0.3, dmg: 12, r: 0.36, color: '#8e3f4f' } },
  { thief: { name: 'Brigand', hp: 30, speed: 0.95, dmg: 5, r: 0.16, color: '#c4983f' },
    sapper: { name: 'Sapeur', hp: 90, speed: 0.5, dmg: 14, r: 0.22, color: '#c0603a' },
    basic: { name: 'Maraudeur', hp: 40, speed: 0.6, dmg: 8, r: 0.2, color: '#d98a6a' },
    heavy: { name: 'Chevalier', hp: 110, speed: 0.5, dmg: 16, r: 0.26, color: '#a8664d' },
    boss:  { name: 'Seigneur de guerre', hp: 1200, speed: 0.3, dmg: 35, r: 0.4, color: '#7a3f35' } },
  { thief: { name: 'Voleur de fret', hp: 80, speed: 1.0, dmg: 12, r: 0.17, color: '#b8913e' },
    sapper: { name: 'Dynamiteur', hp: 260, speed: 0.5, dmg: 40, r: 0.24, color: '#b0533a' },
    basic: { name: 'Fantassin', hp: 100, speed: 0.65, dmg: 16, r: 0.2, color: '#9d8fb8' },
    heavy: { name: 'Blindé', hp: 320, speed: 0.38, dmg: 32, r: 0.3, color: '#6f6391' },
    boss:  { name: 'Cuirassé', hp: 5000, speed: 0.25, dmg: 120, r: 0.45, color: '#4a3f6b' } },
  { thief: { name: 'Pirate de données', hp: 220, speed: 1.1, dmg: 30, r: 0.17, color: '#7fb2c4' },
    sapper: { name: 'Saboteur', hp: 700, speed: 0.55, dmg: 100, r: 0.24, color: '#c0603a' },
    basic: { name: 'Commando', hp: 300, speed: 0.7, dmg: 40, r: 0.2, color: '#7a9cb0' },
    heavy: { name: 'Char d\'assaut', hp: 1000, speed: 0.4, dmg: 80, r: 0.3, color: '#55707f' },
    boss:  { name: 'Méga-drone', hp: 16000, speed: 0.3, dmg: 300, r: 0.46, color: '#2f4757' } },
];

G.WAVES = {
  firstDelay: 300,  // secondes avant la toute première vague
  interval: 170,    // secondes entre deux vagues
  warning: 30,      // préavis affiché
  eraGrace: 240,    // répit après un changement d'ère
  hpGrowth: 1.07,   // PV ×1.07 par vague
  bossEvery: 5,
};

// Soldats des casernes : chaque caserne active entretient une escouade qui intercepte les ennemis.
// Statistiques par ère, multipliées par le niveau de la caserne et les bonus (dégâts des tours, PV).
G.SOLDIERS = {
  base: 2,          // soldats par caserne au niveau 1
  perLevel: 1,      // +1 soldat par niveau
  radius: 5,        // rayon d'interception autour de la caserne (cases)
  respawn: 20,      // secondes avant le retour d'un soldat tombé
  eras: [
    { name: 'Chasseur',   hp: 35,  dps: 4,  speed: 1.0, color: '#6a8fc0' },
    { name: 'Hoplite',    hp: 60,  dps: 7,  speed: 1.0, color: '#5b84c4' },
    { name: 'Sergent',    hp: 170, dps: 16, speed: 1.1, color: '#4a72b3' },
    { name: 'Fusilier',   hp: 480, dps: 45, speed: 1.2, color: '#3b5f9c' },
    { name: 'Garde spatial', hp: 1400, dps: 130, speed: 1.3, color: '#2f5d8a' },
  ],
};

// Saisons : un cycle de 4 saisons de 4 minutes de jeu chacune.
// food : bonus de production des bâtiments de nourriture ; fish : bonus propre aux pêcheries ;
// heating : bois de chauffage réclamé par chaque logement (par seconde, au niveau 1).
G.SEASONS = {
  length: 240,
  list: [
    { name: 'Printemps', icon: '🌱', food: 0.1, sun: 1, wind: 1.1, desc: 'Nourriture +10 %.' },
    { name: 'Été', icon: '☀️', food: 0.25, sun: 1.4, wind: 0.8, desc: 'Nourriture +25 %. Grand soleil, peu de vent.' },
    { name: 'Automne', icon: '🍂', food: 0, sun: 0.8, wind: 1.3, desc: 'Venteux. Faites des réserves de bois : l\'hiver arrive.' },
    { name: 'Hiver', icon: '❄️', food: -0.4, fish: -0.25, heating: 0.03, sun: 0.5, wind: 1.2, desc: 'Nourriture −40 % (pêcheries −65 %), soleil ×0,5. Chaque logement brûle du bois de chauffage.' },
  ],
};

// Gisements épuisables : quantité extractible par case de gisement.
// Gisements inépuisables : une case de ressource ne s'épuise jamais. Mettre false pour rétablir l'épuisement.
G.DEPOSITS_INFINITE = true;
G.DEPOSITS = { g_cuivre: 1500, g_etain: 1200, g_fer: 3000, g_charbon: 4000, g_marbre: 2500, g_or: 1500, g_gemmes: 1200, g_uranium: 1500 };

// Bonheur : confort moyen des logements (0 à 1) → bonus de production.
G.HAPPINESS = { prod: 0.2 };

// Commerce : valeur relative des ressources sur le marché.
G.VALUES = {
  nourriture: 1, bois: 1, pierre: 1.2, cuivre: 2, etain: 2.5, bronze: 5, outils: 8, armes: 8,
  minerai_fer: 2, planches: 2.5, charbon_bois: 2.5, fer: 6, farine: 2, pain: 3, rouages: 15, raisin: 1.5, vin: 5,
  charbon: 3, laine: 2.5, acier: 14, machines: 30, textiles: 8, meubles: 20,
  peaux: 1.5, vetements: 5, uranium: 50, marbre: 6, sculptures: 30, or: 25, bijoux: 60, gemmes: 40, electronique: 80, alliages: 70, carburant: 20,
};

// Spécialisations des tours (au niveau 3) et ordres des casernes.
G.TOWER_SPECS = {
  range: { name: 'Longue-vue', icon: '🔭', desc: 'Portée +1,5 case.' },
  rate: { name: 'Cadence', icon: '⚡', desc: 'Cadence de tir +50 %.' },
  splash: { name: 'Mitraille', icon: '💥', desc: 'Dégâts de zone (rayon 0,8 case).' },
};
G.SQUAD_ORDERS = {
  defend: { name: 'Défendre la caserne', icon: '🛡️', radius: 5 },
  forum: { name: 'Garder le forum', icon: '🏛️', radius: 4 },
  rally: { name: 'Point de ralliement', icon: '🚩', radius: 3.5 },
};

// Gloire ✨ : monnaie permanente gagnée en atteignant les ères et en achevant des merveilles.
// Elle achète des cartes de bâtiment ; les cartes montent la maîtrise d'un type de bâtiment.
// Maîtrise : niveau n = production et stocks ×n. Passer au niveau n+1 coûte 2^(n-1) cartes (1, 2, 4, 8…).
G.GLORY = {
  era: [0, 2, 3, 4, 6],   // gloire gagnée en atteignant chaque ère (index = ère atteinte)
  wonder: 5,              // par merveille achevée
  launch: 15,             // en lançant le vaisseau
  cardCost: era => 1 + era, // prix d'une carte précise, selon l'ère du bâtiment
  packCost: 5,            // paquet de 3 cartes au hasard
  packSize: 3,
  maxMastery: 10,
};
