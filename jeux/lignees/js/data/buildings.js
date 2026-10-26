// Définition des bâtiments (données pures, aucune logique).
//
// terrain  : liste de terrains visibles autorisés ; 'land' = plaine, fertile ou colline.
// cost     : coût de base (augmente de COST_GROWTH par exemplaire déjà construit).
// workers  : main-d'œuvre requise à pleine efficacité.
// in / out : consommation / production par seconde à 100 % d'efficacité.
// pop / consume : logements (population fournie, besoins par seconde).
// energyIn / energyOut : énergie consommée / fournie (flux, non stockable).
// tower    : défense { dps, range (cases), rate (tirs/s), splash (rayon) }.
// boost    : intrant optionnel qui multiplie l'effet s'il est disponible.
// adj      : bonus de voisinage (4 voisins orthogonaux).
//            { b: id bâtiment } | { tag: étiquette } | { t: terrain libre }, v: bonus par voisin.
// tags     : étiquettes utilisées par les voisinages et les bonus ('industry', 'mine', ...).
// tech     : technologie requise ; era : ère d'apparition.
const LAND = ['plaine', 'fertile', 'colline'];
const FLAT = ['plaine', 'fertile'];

G.BUILDINGS = {
  // ---------- Antiquité ----------
  forum: {
    name: 'Forum', icon: '🏛️', era: 0, cat: 'core', special: true, terrain: LAND,
    hp: 800, pop: 6, tower: { dps: 8, range: 3, rate: 1 }, carriers: 3, carry: 3,
    desc: 'Cœur de votre civilisation. Sa réserve garde les ressources de départ, le butin et les remboursements. S\'il tombe, la partie est terminée.',
  },
  hutte: {
    name: 'Hutte', icon: '🛖', era: 0, cat: 'housing', terrain: FLAT,
    cost: { bois: 12 }, pop: 4, consume: { nourriture: 0.12 }, comfort: { bois: 0.012, vetements: 0.008 }, hp: 60,
    adj: [{ tag: 'industry', v: -0.15 }, { b: 'foyer', v: 0.25 }], upgradeTo: 'maison',
    desc: 'Loge 4 habitants. Les voisins industriels réduisent la population.',
  },
  cueilleur: {
    name: 'Cueilleur', icon: '🧺', era: 0, cat: 'food', terrain: FLAT,
    cost: { bois: 10 }, workers: 2, out: { nourriture: 0.4 }, hp: 50,
    adj: [{ t: 'foret', v: 0.15 }],
    desc: 'Baies et racines. +15 % par forêt voisine non exploitée.',
  },
  chasseur: {
    name: 'Cabane de chasseur', icon: '🍖', era: 0, cat: 'food', terrain: FLAT,
    cost: { bois: 15 }, workers: 2, out: { nourriture: 0.25, peaux: 0.12 }, hp: 60,
    adj: [{ t: 'foret', v: 0.2 }],
    desc: 'Gibier et peaux. +20 % par forêt voisine non exploitée.',
  },
  tanneur: {
    name: 'Tanneur', icon: '👘', era: 0, cat: 'craft', terrain: LAND, tech: 't_tannage',
    cost: { bois: 20, pierre: 10 }, workers: 2, in: { peaux: 0.12 }, out: { vetements: 0.06 }, hp: 60,
    adj: [{ b: 'chasseur', v: 0.15 }],
    desc: 'Peaux → vêtements, le confort des huttes.',
  },
  tailleur: {
    name: 'Tailleur de silex', icon: '🔪', era: 0, cat: 'craft', terrain: LAND, tech: 't_silex',
    cost: { bois: 15, pierre: 15 }, workers: 2, in: { pierre: 0.15, bois: 0.05 }, out: { outils: 0.03 }, hp: 60,
    adj: [{ b: 'carriere', v: 0.15 }],
    desc: 'Pierre + bois → outils de pierre. Lent, mais c\'est un début.',
  },
  foyer: {
    name: 'Grand foyer', icon: '🏕️', era: 0, cat: 'housing', terrain: FLAT, tech: 't_feu',
    cost: { bois: 25, pierre: 10 }, hp: 80,
    desc: 'Le cœur du village. Chaque hutte voisine loge +25 % d\'habitants.',
  },
  grotte: {
    name: 'Grotte ornée', icon: '🖐️', era: 0, cat: 'science', terrain: ['colline'], tech: 't_art', tags: ['science'],
    cost: { bois: 20 }, workers: 1, in: { nourriture: 0.05 }, out: { savoir: 0.2 }, hp: 80,
    adj: [{ b: 'sages', v: 0.15 }, { tag: 'science', v: 0.1 }],
    desc: 'Peintures et récits sur les parois d\'une colline : du savoir.',
  },
  cercle_pierres: {
    name: 'Cercle de pierres', icon: '🗿', era: 0, cat: 'wonder', terrain: LAND, tech: 't_art', unique: true,
    cost: { pierre: 30, bois: 30 }, hp: 600,
    wonder: { cost: { pierre: 250, bois: 200, vetements: 20, outils: 10 }, effects: [{ t: 'prod', target: 'all', v: 0.1 }], bonus: 'Production +10 %.' },
    desc: 'Merveille de la Préhistoire. Une fois achevée : production +10 % pour toute la partie.',
  },
  ferme: {
    name: 'Ferme', icon: '🌾', era: 1, cat: 'food', terrain: FLAT,
    cost: { bois: 18 }, workers: 2, out: { nourriture: 0.6 }, hp: 60,
    terrainBonus: { fertile: 0.5 }, adj: [{ t: 'eau', v: 0.15 }, { b: 'ferme', v: 0.05 }],
    desc: 'Terre fertile +50 %. Bonus près de l\'eau et des autres fermes.',
  },
  bucheron: {
    name: 'Bûcheron', icon: '🪓', era: 0, cat: 'raw', terrain: ['foret'],
    cost: { bois: 8 }, workers: 2, out: { bois: 0.5 }, hp: 60,
    adj: [{ t: 'foret', v: 0.1 }],
    desc: 'Se construit en forêt. +10 % par forêt voisine non exploitée.',
  },
  carriere: {
    name: 'Carrière', icon: '⛏️', era: 0, cat: 'raw', terrain: ['colline'], tags: ['industry'],
    cost: { bois: 20 }, workers: 2, out: { pierre: 0.4 }, hp: 80,
    adj: [{ t: 'colline', v: 0.1 }],
    desc: 'Se construit sur colline. +10 % par colline voisine libre.',
  },
  sages: {
    name: 'Cercle des sages', icon: '🧙', era: 0, cat: 'science', terrain: LAND, tags: ['science'],
    cost: { bois: 25, pierre: 15 }, workers: 2, in: { nourriture: 0.15 }, out: { savoir: 0.25 }, hp: 60,
    adj: [{ b: 'hutte', v: 0.1 }, { tag: 'science', v: 0.15 }],
    desc: 'Produit du savoir. Aime la compagnie des habitants et des savants.',
  },
  entrepot: {
    name: 'Entrepôt', icon: '📦', era: 0, cat: 'storage', terrain: LAND,
    cost: { bois: 40, pierre: 25 }, storage: 300, carriers: 4, carry: 4, hp: 120,
    desc: 'Stocke jusqu\'à 300 de chaque ressource. Reçoit les surplus des producteurs proches et ravitaille les bâtiments alentour (4 porteurs).',
  },
  tour_archers: {
    name: 'Tour d\'archers', icon: '🏹', era: 0, cat: 'military', terrain: LAND,
    cost: { bois: 35, pierre: 25 }, workers: 2, in: { nourriture: 0.05 }, hp: 150,
    tower: { dps: 6, range: 3.5, rate: 1 }, boost: { res: 'armes', rate: 0.02, mult: 1.5 },
    adj: [{ b: 'caserne', v: 0.3 }],
    desc: 'Défend la cité. Armes disponibles : dégâts ×1,5. Caserne voisine +30 %.',
  },
  route: {
    name: 'Route', icon: '🛤️', era: 0, cat: 'storage', terrain: LAND, road: true,
    cost: { pierre: 2 }, hp: 40,
    desc: 'Les porteurs y vont 2,5 fois plus vite. Glissez la souris pour en tracer plusieurs. Les ennemis l\'ignorent.',
  },
  palissade: {
    name: 'Palissade', icon: '🪵', era: 0, cat: 'military', terrain: LAND, wall: true,
    cost: { bois: 6 }, hp: 160,
    desc: 'Mur bon marché qui attire et retient les assaillants.',
  },
  peche: {
    name: 'Pêcherie', icon: '🎣', era: 1, cat: 'food', terrain: ['eau'], tech: 't_peche',
    cost: { bois: 25 }, workers: 2, out: { nourriture: 0.8 }, hp: 60,
    adj: [{ t: 'eau', v: 0.05 }],
    desc: 'Se construit sur l\'eau.',
  },
  mine_cuivre: {
    name: 'Mine de cuivre', icon: '⛏️', era: 1, cat: 'raw', terrain: ['g_cuivre'], tech: 't_bronze', tags: ['industry', 'mine'],
    cost: { bois: 35, pierre: 15 }, workers: 3, out: { cuivre: 0.35 }, hp: 80,
    desc: 'Se construit sur un gisement de cuivre.',
  },
  mine_etain: {
    name: 'Mine d\'étain', icon: '⛏️', era: 1, cat: 'raw', terrain: ['g_etain'], tech: 't_bronze', tags: ['industry', 'mine'],
    cost: { bois: 35, pierre: 15 }, workers: 3, out: { etain: 0.25 }, hp: 80,
    desc: 'Se construit sur un gisement d\'étain.',
  },
  fonderie: {
    name: 'Fonderie', icon: '🔥', era: 1, cat: 'craft', terrain: LAND, tech: 't_bronze', tags: ['industry'],
    cost: { pierre: 50, bois: 25 }, workers: 3, in: { cuivre: 0.4, etain: 0.2, bois: 0.1 }, out: { bronze: 0.2 }, hp: 100,
    adj: [{ tag: 'mine', v: 0.15 }],
    desc: 'Cuivre + étain → bronze. +15 % par mine voisine.',
  },
  atelier: {
    name: 'Atelier', icon: '🔨', era: 1, cat: 'craft', terrain: LAND, tech: 't_outils',
    cost: { bois: 40, pierre: 30, bronze: 10 }, workers: 2, in: { bronze: 0.1, bois: 0.2 }, out: { outils: 0.1 }, hp: 80,
    recipes: [{ name: 'Outils', in: { bronze: 0.1, bois: 0.2 }, out: { outils: 0.1 } }, { name: 'Armes', in: { bronze: 0.1 }, out: { armes: 0.12 } }],
    adj: [{ b: 'fonderie', v: 0.2 }],
    desc: 'Bronze + bois → outils. +20 % par fonderie voisine.',
  },
  armurerie: {
    name: 'Armurerie', icon: '🗡️', era: 1, cat: 'craft', terrain: LAND, tech: 't_tactique',
    cost: { bois: 30, pierre: 30, bronze: 15 }, workers: 2, in: { bronze: 0.1 }, out: { armes: 0.15 }, hp: 80,
    adj: [{ b: 'caserne', v: 0.15 }, { b: 'fonderie', v: 0.1 }],
    desc: 'Bronze → armes, qui renforcent les tours.',
  },
  caserne: {
    name: 'Caserne', icon: '⚔️', era: 1, cat: 'military', terrain: LAND, tech: 't_tactique',
    cost: { pierre: 60, bronze: 20 }, workers: 3, in: { nourriture: 0.15 }, hp: 260, squad: true,
    desc: 'Entretient une escouade de soldats qui interceptent les ennemis à 5 cases à la ronde (+1 soldat par niveau). Chaque tour voisine gagne +30 % de dégâts.',
  },
  bibliotheque: {
    name: 'Bibliothèque', icon: '📚', era: 1, cat: 'science', terrain: LAND, tech: 't_ecriture', tags: ['science'],
    cost: { pierre: 60, outils: 8 }, workers: 3, in: { nourriture: 0.2 }, out: { savoir: 0.7 }, hp: 80,
    adj: [{ tag: 'science', v: 0.15 }],
    desc: 'Savoir. +15 % par bâtiment savant voisin.',
  },

  // ---------- Moyen Âge ----------
  scierie: {
    name: 'Scierie', icon: '🪚', era: 2, cat: 'craft', terrain: LAND,
    cost: { bois: 40, pierre: 30 }, workers: 2, in: { bois: 0.6 }, out: { planches: 0.3 }, hp: 90,
    recipes: [{ name: 'Planches', in: { bois: 0.6 }, out: { planches: 0.3 } }, { name: 'Charbon de bois', in: { bois: 0.5 }, out: { charbon_bois: 0.22 } }],
    adj: [{ b: 'bucheron', v: 0.15 }],
    desc: 'Bois → planches. +15 % par bûcheron voisin.',
  },
  charbonniere: {
    name: 'Charbonnière', icon: '⚫', era: 2, cat: 'craft', terrain: LAND, tech: 't_charbon', tags: ['industry'],
    cost: { bois: 30, pierre: 30 }, workers: 2, in: { bois: 0.5 }, out: { charbon_bois: 0.25 }, hp: 80,
    adj: [{ t: 'foret', v: 0.1 }],
    desc: 'Bois → charbon de bois. +10 % par forêt voisine.',
  },
  mine_fer: {
    name: 'Mine de fer', icon: '⛏️', era: 2, cat: 'raw', terrain: ['g_fer'], tech: 't_charbon', tags: ['industry', 'mine'],
    cost: { planches: 20, pierre: 40 }, workers: 4, out: { minerai_fer: 0.4 }, hp: 120,
    desc: 'Se construit sur un gisement de fer (révélé au Moyen Âge).',
  },
  bas_fourneau: {
    name: 'Bas fourneau', icon: '🏭', era: 2, cat: 'craft', terrain: LAND, tech: 't_charbon', tags: ['industry'],
    cost: { pierre: 80, planches: 20 }, workers: 3, in: { minerai_fer: 0.4, charbon_bois: 0.2 }, out: { fer: 0.2 }, hp: 120,
    adj: [{ tag: 'mine', v: 0.15 }, { b: 'charbonniere', v: 0.1 }],
    desc: 'Minerai de fer + charbon de bois → fer.',
  },
  moulin: {
    name: 'Moulin', icon: '🌀', era: 2, cat: 'craft', terrain: FLAT, tech: 't_meunerie',
    cost: { planches: 25, pierre: 20 }, workers: 2, in: { nourriture: 0.6 }, out: { farine: 0.4 }, hp: 90,
    adj: [{ b: 'ferme', v: 0.1 }],
    desc: 'Nourriture → farine. +10 % par ferme voisine.',
  },
  boulangerie: {
    name: 'Boulangerie', icon: '🥖', era: 2, cat: 'craft', terrain: LAND, tech: 't_meunerie',
    cost: { planches: 20, pierre: 30 }, workers: 2, in: { farine: 0.4, bois: 0.1 }, out: { pain: 0.4 }, hp: 90,
    adj: [{ b: 'moulin', v: 0.15 }, { b: 'maison', v: 0.05 }],
    desc: 'Farine → pain, nécessaire aux maisons.',
  },
  maison: {
    name: 'Maison', icon: '🏠', era: 2, cat: 'housing', terrain: FLAT, tech: 't_meunerie', upgradeFrom: 'hutte', upgradeTo: 'immeuble',
    cost: { planches: 12, pierre: 15 }, pop: 10, consume: { nourriture: 0.15, pain: 0.08 }, comfort: { vin: 0.03 }, hp: 120,
    adj: [{ tag: 'industry', v: -0.15 }],
    desc: 'Amélioration de la hutte. Loge 10 habitants, consomme du pain.',
  },
  forge: {
    name: 'Forge', icon: '⚒️', era: 2, cat: 'craft', terrain: LAND, tech: 't_forge', tags: ['industry'],
    cost: { pierre: 60, planches: 30, fer: 10 }, workers: 3, in: { fer: 0.15, planches: 0.1 }, out: { outils: 0.3 }, hp: 110,
    recipes: [{ name: 'Outils', in: { fer: 0.15, planches: 0.1 }, out: { outils: 0.3 } }, { name: 'Armes', in: { fer: 0.1 }, out: { armes: 0.3 } }, { name: 'Rouages', in: { fer: 0.08, outils: 0.05 }, out: { rouages: 0.07 } }],
    adj: [{ b: 'bas_fourneau', v: 0.2 }],
    desc: 'Fer + planches → outils (bien plus efficace que l\'atelier).',
  },
  vignoble: {
    name: 'Vignoble', icon: '🍇', era: 2, cat: 'food', terrain: ['colline'], tech: 't_viticulture',
    cost: { planches: 20, pierre: 15 }, workers: 2, out: { raisin: 0.3 }, hp: 70,
    adj: [{ t: 'colline', v: 0.1 }, { b: 'vignoble', v: 0.05 }],
    desc: 'Raisin sur les coteaux. +10 % par colline libre voisine.',
  },
  pressoir: {
    name: 'Pressoir', icon: '🍷', era: 2, cat: 'craft', terrain: LAND, tech: 't_viticulture',
    cost: { planches: 30, pierre: 30 }, workers: 2, in: { raisin: 0.3 }, out: { vin: 0.2 }, hp: 90,
    adj: [{ b: 'vignoble', v: 0.15 }],
    desc: 'Raisin → vin, le confort des maisons et des immeubles.',
  },
  ebenisterie: {
    name: 'Ébénisterie', icon: '🪑', era: 3, cat: 'craft', terrain: LAND, tech: 't_mobilier',
    cost: { planches: 60, acier: 15 }, workers: 3, in: { planches: 0.2, textiles: 0.06 }, out: { meubles: 0.1 }, hp: 140,
    adj: [{ b: 'scierie', v: 0.15 }, { b: 'filature', v: 0.1 }],
    desc: 'Planches + textiles → meubles, le grand confort des immeubles.',
  },
  // Merveilles : une par ère, uniques. On pose le chantier, puis les porteurs y livrent les matériaux.
  biblio_alex: {
    name: 'Grande Bibliothèque', icon: '🏛️', era: 1, cat: 'wonder', terrain: LAND, unique: true,
    cost: { pierre: 40, bois: 40 }, hp: 900,
    wonder: { cost: { pierre: 500, bois: 350, bronze: 80, outils: 60 }, effects: [{ t: 'prod', target: 'res:savoir', v: 0.5 }], bonus: 'Savoir +50 %.' },
    desc: 'Merveille de l\'Antiquité. Une fois achevée : savoir +50 % pour toute la partie.',
  },
  cathedrale: {
    name: 'Cathédrale', icon: '⛪', era: 2, cat: 'wonder', terrain: LAND, unique: true,
    cost: { pierre: 100, planches: 60 }, hp: 2000,
    wonder: { cost: { pierre: 1500, planches: 600, fer: 150, vin: 200, sculptures: 60 }, effects: [{ t: 'pop', v: 0.15 }, { t: 'prod', target: 'all', v: 0.05 }], bonus: 'Population +15 %, production +5 %.' },
    desc: 'Merveille du Moyen Âge. Une fois achevée : population +15 % et production +5 %.',
  },
  exposition: {
    name: 'Exposition universelle', icon: '🎡', era: 3, cat: 'wonder', terrain: LAND, unique: true,
    cost: { acier: 60, planches: 100 }, hp: 4000,
    wonder: { cost: { acier: 800, machines: 300, textiles: 300, meubles: 150, bijoux: 60 }, effects: [{ t: 'prod', target: 'all', v: 0.2 }, { t: 'logi', v: 0.25 }], bonus: 'Production +20 %, porteurs +25 % plus rapides.' },
    desc: 'Merveille industrielle. Une fois achevée : production +20 % et porteurs +25 % plus rapides.',
  },
  marche: {
    name: 'Marché', icon: '🏪', era: 1, cat: 'storage', terrain: FLAT, unique: true,
    cost: { bois: 60, pierre: 40 }, hp: 150,
    desc: 'Permet d\'échanger vos surplus contre ce qui vous manque (onglet Civilisation). Chaque niveau améliore les cours et ajoute une offre.',
  },
  // Ressources rares et leurs ateliers
  carriere_marbre: {
    name: 'Carrière de marbre', icon: '🏛️', era: 2, cat: 'raw', terrain: ['g_marbre'], tech: 't_sculpture', tags: ['industry', 'mine'],
    cost: { planches: 30, outils: 15 }, workers: 3, out: { marbre: 0.25 }, hp: 120,
    desc: 'Ressource rare : se construit sur un gisement de marbre.',
  },
  sculpteur: {
    name: 'Atelier de sculpteur', icon: '🗿', era: 2, cat: 'craft', terrain: LAND, tech: 't_sculpture',
    cost: { planches: 40, pierre: 40, outils: 10 }, workers: 2, in: { marbre: 0.2, outils: 0.02 }, out: { sculptures: 0.08 }, hp: 100,
    adj: [{ b: 'carriere_marbre', v: 0.2 }],
    recipes: [{ name: 'Sculptures', in: { marbre: 0.2, outils: 0.02 }, out: { sculptures: 0.08 } }, { name: 'Pierre de taille', in: { marbre: 0.2 }, out: { pierre: 1.2 } }],
    desc: 'Marbre → sculptures, pour les merveilles et le marché.',
  },
  mine_or: {
    name: 'Mine d\'or', icon: '⛏️', era: 2, cat: 'raw', terrain: ['g_or'], tech: 't_orfevrerie', tags: ['industry', 'mine'],
    cost: { planches: 40, fer: 20 }, workers: 4, out: { or: 0.15 }, hp: 140,
    desc: 'Ressource rare : se construit sur un gisement d\'or (révélé au Moyen Âge).',
  },
  orfevrerie: {
    name: 'Orfèvrerie', icon: '💍', era: 2, cat: 'craft', terrain: LAND, tech: 't_orfevrerie',
    cost: { planches: 40, pierre: 60, fer: 15 }, workers: 2, in: { or: 0.1 }, out: { bijoux: 0.06 }, hp: 110,
    adj: [{ b: 'mine_or', v: 0.2 }],
    recipes: [{ name: 'Bijoux', in: { or: 0.1 }, out: { bijoux: 0.06 } }, { name: 'Parures', in: { or: 0.08, gemmes: 0.04 }, out: { bijoux: 0.15 } }],
    desc: 'Or → bijoux : luxe des résidences, merveilles, très recherchés au marché.',
  },
  horloger: {
    name: 'Atelier d\'horloger', icon: '🔧', era: 2, cat: 'craft', terrain: LAND, tech: 't_horlogerie',
    cost: { planches: 40, pierre: 40, fer: 20 }, workers: 2, in: { fer: 0.05, outils: 0.05 }, out: { rouages: 0.08 }, hp: 90,
    adj: [{ b: 'forge', v: 0.15 }],
    desc: 'Fer + outils → rouages, qui font tourner la Tour de l\'horloge.',
  },
  tour_horloge: {
    name: 'Tour de l\'horloge', icon: '🕰️', era: 2, cat: 'core', terrain: LAND, tech: 't_horlogerie', clock: true,
    cost: { pierre: 150, planches: 60, rouages: 30 }, workers: 1, in: { rouages: 0.02 }, hp: 300,
    desc: 'Tant qu\'elle est approvisionnée en rouages, débloque la vitesse de jeu ×5 (et ×10 au niveau 2).',
  },
  forge_armes: {
    name: 'Forge d\'armes', icon: '🛡️', era: 2, cat: 'craft', terrain: LAND, tech: 't_arbalete', tags: ['industry'],
    cost: { pierre: 50, planches: 20, fer: 15 }, workers: 3, in: { fer: 0.1 }, out: { armes: 0.35 }, hp: 110,
    adj: [{ b: 'caserne', v: 0.15 }],
    desc: 'Fer → armes.',
  },
  tour_arbaletriers: {
    name: 'Tour d\'arbalétriers', icon: '🏯', era: 2, cat: 'military', terrain: LAND, tech: 't_arbalete',
    cost: { pierre: 80, planches: 30, fer: 10 }, workers: 3, in: { pain: 0.05 }, hp: 320,
    tower: { dps: 14, range: 3.5, rate: 0.9 }, boost: { res: 'armes', rate: 0.04, mult: 1.5 },
    adj: [{ b: 'caserne', v: 0.3 }],
    desc: 'Tour puissante. Armes : dégâts ×1,5. Caserne voisine +30 %.',
  },
  rempart: {
    name: 'Rempart', icon: '🧱', era: 2, cat: 'military', terrain: LAND, tech: 't_maconnerie', wall: true,
    cost: { pierre: 25 }, hp: 650,
    desc: 'Mur de pierre très résistant.',
  },
  monastere: {
    name: 'Monastère', icon: '⛪', era: 2, cat: 'science', terrain: LAND, tech: 't_monastere', tags: ['science'],
    cost: { pierre: 120, planches: 40, outils: 20 }, workers: 4, in: { pain: 0.15 }, out: { savoir: 1.6 }, hp: 150,
    adj: [{ b: 'ferme', v: 0.1 }, { tag: 'science', v: 0.1 }],
    desc: 'Grand producteur de savoir.',
  },

  // ---------- Ère industrielle ----------
  mine_charbon: {
    name: 'Mine de charbon', icon: '⛏️', era: 3, cat: 'raw', terrain: ['g_charbon'], tech: 't_vapeur', tags: ['industry', 'mine'],
    cost: { planches: 40, fer: 30 }, workers: 5, out: { charbon: 0.6 }, hp: 150,
    desc: 'Se construit sur un gisement de charbon (révélé à l\'ère industrielle).',
  },
  relais: {
    name: 'Relais électrique', icon: '🗼', era: 3, cat: 'energy', terrain: LAND, tech: 't_vapeur', relay: true,
    cost: { fer: 6, planches: 8 }, hp: 80,
    desc: 'Prolonge le réseau électrique. Tout bâtiment électrique qui le touche y est raccordé.',
  },
  centrale_bois: {
    name: 'Centrale à bois', icon: '🪵', era: 3, cat: 'energy', terrain: LAND, tech: 't_vapeur', tags: ['industry'],
    cost: { pierre: 80, fer: 30 }, workers: 3, in: { bois: 0.5 }, energyOut: 6, hp: 160,
    desc: 'Bois → 6 ⚡. Simple et pratique, mais gourmande.',
  },
  eolienne: {
    name: 'Éolienne', icon: '🌬️', era: 3, cat: 'energy', terrain: LAND, tech: 't_eolien', weather: 'wind',
    cost: { acier: 10, planches: 40 }, workers: 1, energyOut: 5, hp: 120,
    adj: [{ t: 'colline', v: 0.15 }, { t: 'plaine', v: 0.05 }],
    desc: '5 ⚡ sans combustible, selon le vent (automne et hiver venteux). Aime les collines dégagées.',
  },
  centrale: {
    name: 'Centrale à vapeur', icon: '♨️', era: 3, cat: 'energy', terrain: LAND, tech: 't_vapeur', tags: ['industry'],
    cost: { pierre: 150, fer: 60, outils: 30 }, workers: 4, in: { charbon: 0.4 }, energyOut: 14, hp: 200,
    desc: 'Charbon → 14 ⚡ pour les bâtiments électriques qui la touchent (ou touchent un relais relié).',
  },
  haut_fourneau: {
    name: 'Haut fourneau', icon: '🏭', era: 3, cat: 'craft', terrain: LAND, tech: 't_acier', tags: ['industry'],
    cost: { pierre: 200, fer: 80, outils: 30 }, workers: 4, energyIn: 3, in: { minerai_fer: 0.6, charbon: 0.3 }, out: { acier: 0.3 }, hp: 200,
    adj: [{ tag: 'mine', v: 0.15 }],
    desc: 'Minerai de fer + charbon → acier. Consomme 3 ⚡.',
  },
  usine: {
    name: 'Usine mécanique', icon: '⚙️', era: 3, cat: 'craft', terrain: LAND, tech: 't_meca', tags: ['industry'],
    cost: { acier: 40, planches: 60 }, workers: 5, energyIn: 4, in: { acier: 0.2, planches: 0.2 }, out: { machines: 0.15 }, hp: 200,
    recipes: [{ name: 'Machines', in: { acier: 0.2, planches: 0.2 }, out: { machines: 0.15 } }, { name: 'Outils', in: { acier: 0.1 }, out: { outils: 0.5 } }, { name: 'Meubles', in: { planches: 0.3, textiles: 0.1 }, out: { meubles: 0.15 } }],
    adj: [{ b: 'haut_fourneau', v: 0.15 }],
    desc: 'Acier + planches → machines. Consomme 4 ⚡.',
  },
  bergerie: {
    name: 'Bergerie', icon: '🐑', era: 3, cat: 'raw', terrain: FLAT, tech: 't_textile',
    cost: { planches: 30, fer: 10 }, workers: 2, out: { laine: 0.4 }, hp: 90,
    adj: [{ t: 'plaine', v: 0.08 }],
    desc: 'Produit de la laine. +8 % par plaine libre voisine.',
  },
  filature: {
    name: 'Filature', icon: '🧵', era: 3, cat: 'craft', terrain: LAND, tech: 't_textile', tags: ['industry'],
    cost: { acier: 20, planches: 40 }, workers: 3, energyIn: 2, in: { laine: 0.4 }, out: { textiles: 0.3 }, hp: 150,
    adj: [{ b: 'bergerie', v: 0.15 }],
    desc: 'Laine → textiles. Consomme 2 ⚡.',
  },
  immeuble: {
    name: 'Immeuble', icon: '🏢', era: 3, cat: 'housing', terrain: FLAT, tech: 't_textile', upgradeFrom: 'maison',
    cost: { acier: 10, planches: 20, pierre: 40 }, pop: 24, consume: { nourriture: 0.2, pain: 0.12, textiles: 0.06 }, comfort: { vin: 0.04, meubles: 0.02 }, hp: 250,
    adj: [{ tag: 'industry', v: -0.15 }],
    desc: 'Amélioration de la maison. Loge 24 habitants.',
  },
  mine_gemmes: {
    name: 'Mine de gemmes', icon: '💎', era: 3, cat: 'raw', terrain: ['g_gemmes'], tech: 't_mineralogie', tags: ['industry', 'mine'],
    cost: { acier: 30, machines: 10 }, workers: 4, energyIn: 2, out: { gemmes: 0.12 }, hp: 160,
    desc: 'Ressource rare : se construit sur un gisement de gemmes (révélé à l\'ère industrielle).',
  },
  universite: {
    name: 'Université', icon: '🎓', era: 3, cat: 'science', terrain: LAND, tech: 't_universite', tags: ['science'],
    cost: { acier: 40, machines: 10, pierre: 200 }, workers: 5, energyIn: 3, in: { pain: 0.2 }, out: { savoir: 5 }, hp: 250,
    adj: [{ tag: 'science', v: 0.15 }],
    desc: 'Savoir en grande quantité. Consomme 3 ⚡.',
  },
  artillerie: {
    name: 'Batterie d\'artillerie', icon: '💥', era: 3, cat: 'military', terrain: LAND, tech: 't_artillerie',
    cost: { acier: 50, fer: 60 }, workers: 4, in: { pain: 0.1 }, hp: 600,
    tower: { dps: 45, range: 5, rate: 0.5, splash: 1 }, boost: { res: 'armes', rate: 0.06, mult: 1.5 },
    adj: [{ b: 'caserne', v: 0.3 }],
    desc: 'Tirs à longue portée avec dégâts de zone.',
  },
  mur_acier: {
    name: 'Mur d\'acier', icon: '🔲', era: 3, cat: 'military', terrain: LAND, tech: 't_artillerie', wall: true,
    cost: { acier: 15, pierre: 30 }, hp: 2200,
    desc: 'Mur quasiment infranchissable.',
  },

  // ---------- Ère spatiale ----------
  electronicien: {
    name: 'Usine d\'électronique', icon: '💻', era: 4, cat: 'craft', terrain: LAND, tech: 't_informatique', tags: ['industry'],
    cost: { acier: 120, machines: 40 }, workers: 5, energyIn: 5, in: { machines: 0.08, or: 0.04 }, out: { electronique: 0.08 }, hp: 260,
    desc: 'Machines + or → électronique.',
  },
  fonderie_alliages: {
    name: 'Fonderie d\'alliages', icon: '🧪', era: 4, cat: 'craft', terrain: LAND, tech: 't_materiaux', tags: ['industry'],
    cost: { acier: 150, electronique: 10 }, workers: 5, energyIn: 6, in: { acier: 0.2, gemmes: 0.04 }, out: { alliages: 0.08 }, hp: 280,
    desc: 'Acier + gemmes → alliages composites, coque du vaisseau.',
  },
  raffinerie: {
    name: 'Raffinerie', icon: '🛢️', era: 4, cat: 'craft', terrain: LAND, tech: 't_raffinage', tags: ['industry'],
    cost: { acier: 100, machines: 20 }, workers: 4, energyIn: 2, in: { charbon: 0.4 }, out: { carburant: 0.25 }, hp: 240,
    desc: 'Charbon → carburant pour le vaisseau.',
  },
  centrale_solaire: {
    name: 'Panneaux solaires', icon: '🔆', era: 4, cat: 'energy', terrain: LAND, tech: 't_solaire', weather: 'sun',
    cost: { alliages: 10, electronique: 10, acier: 30 }, workers: 1, energyOut: 12, hp: 150,
    desc: '12 ⚡ sans combustible, selon le soleil (été ×1,4, hiver ×0,5).',
  },
  centrale_nucleaire: {
    name: 'Centrale nucléaire', icon: '⚛️', era: 4, cat: 'energy', terrain: LAND, tech: 't_nucleaire', tags: ['industry'],
    cost: { acier: 300, alliages: 60, electronique: 40 }, workers: 6, in: { uranium: 0.03 }, energyOut: 90, hp: 900,
    desc: 'Uranium → 90 ⚡. Une seule suffit à alimenter une ville entière.',
  },
  mine_uranium: {
    name: 'Mine d\'uranium', icon: '☢️', era: 4, cat: 'raw', terrain: ['g_uranium'], tech: 't_nucleaire', tags: ['industry', 'mine'],
    cost: { acier: 80, electronique: 10 }, workers: 4, energyIn: 3, out: { uranium: 0.08 }, hp: 200,
    desc: 'Ressource rare : se construit sur un gisement d\'uranium (révélé à l\'ère spatiale).',
  },
  centre_recherche: {
    name: 'Centre de recherche', icon: '🔬', era: 4, cat: 'science', terrain: LAND, tech: 't_informatique', tags: ['science'],
    cost: { acier: 150, electronique: 20 }, workers: 6, energyIn: 6, in: { electronique: 0.03, pain: 0.2 }, out: { savoir: 14 }, hp: 260,
    adj: [{ tag: 'science', v: 0.15 }],
    desc: 'Savoir en très grande quantité pour la course à l\'espace.',
  },
  residence: {
    name: 'Résidence', icon: '🏙️', era: 4, cat: 'housing', terrain: FLAT, tech: 't_informatique', upgradeFrom: 'immeuble',
    cost: { acier: 30, electronique: 5, pierre: 80 }, pop: 50, consume: { nourriture: 0.3, pain: 0.15, textiles: 0.08 }, comfort: { meubles: 0.03, bijoux: 0.01, electronique: 0.01 }, hp: 400,
    adj: [{ tag: 'industry', v: -0.15 }],
    desc: 'Amélioration de l\'immeuble. Loge 50 habitants exigeants.',
  },
  tour_laser: {
    name: 'Tour laser', icon: '🔦', era: 4, cat: 'military', terrain: LAND, tech: 't_solaire',
    cost: { alliages: 30, electronique: 20 }, workers: 3, energyIn: 3, hp: 1200,
    tower: { dps: 160, range: 6, rate: 2 }, adj: [{ b: 'caserne', v: 0.3 }],
    desc: 'Tirs rapides et précis à très longue portée. Consomme 3 ⚡.',
  },
  pas_de_tir: {
    name: 'Pas de tir', icon: '🚀', era: 4, cat: 'wonder', terrain: LAND, tech: 't_vaisseau', unique: true, size: 2,
    cost: { acier: 300, alliages: 50 }, hp: 6000,
    wonder: { cost: { alliages: 1200, electronique: 900, carburant: 1500, bijoux: 100, sculptures: 60 }, effects: [], launch: true, bonus: 'Le vaisseau est prêt : lancez-le pour quitter la planète.' },
    desc: 'Occupe 2×2 cases. Le vaisseau interstellaire. Achevé, il peut décoller : la partie se termine en triomphe et transmet un héritage majoré.',
  },
};

// Catégories de l'onglet Construire.
G.BUILD_CATEGORIES = [
  { id: 'housing', name: 'Habitat', color: '#f3c9d8' },
  { id: 'food', name: 'Nourriture', color: '#f6dc8f' },
  { id: 'raw', name: 'Extraction', color: '#dcc6a6' },
  { id: 'craft', name: 'Artisanat', color: '#ecbca4' },
  { id: 'energy', name: 'Énergie', color: '#cdbbee' },
  { id: 'science', name: 'Savoir', color: '#bccbf1' },
  { id: 'storage', name: 'Logistique', color: '#cfd8dc' },
  { id: 'military', name: 'Défense', color: '#eaa9a9' },
  { id: 'wonder', name: 'Merveilles', color: '#f0d27a' },
  { id: 'core', name: 'Cœur', color: '#f2e1a8' },
];
G.CAT_COLOR = {};
G.BUILD_CATEGORIES.forEach(c => (G.CAT_COLOR[c.id] = c.color));

G.COST_GROWTH = 1.07;

// Logistique : les ressources voyagent en cellules portées par les porteurs du bâtiment expéditeur.
// Un porteur reste occupé pendant tout l'aller-retour : la distance réduit le débit.
G.LOGI = {
  speed: 1.5,           // cases par seconde
  load: 0.3,            // secondes de chargement par trajet
  carriers: 2,          // porteurs par défaut (forum et entrepôts : voir leur définition)
  carry: 2,             // quantité par cellule par défaut
  perLevelCarriers: 1,  // +1 porteur par niveau
  perLevelCarry: 0.5,   // +50 % de charge par niveau
  forumCap: 250,        // capacité de la réserve du forum, par ressource
  roadFactor: 0.4,      // coût d'un pas sur route (×2,5 de vitesse)
  surplusShare: 0.4,    // au-delà de cette part de son stock de sortie, un producteur envoie le surplus à l'entrepôt
  inBuffer: 20,         // secondes d'intrants stockables à l'entrée
  outBuffer: 40,        // secondes de production stockables à la sortie
};

// Niveaux des bâtiments : un bâtiment monte de niveau sur place, sans occuper de nouvelle case.
// Chaque niveau au-delà du premier ajoute les pourcentages ci-dessous (cumul linéaire).
G.LEVELS = {
  maxByEra: [2, 3, 4, 5, 6],    // niveau maximum selon l'ère
  costBase: 1.5,                // coût du niveau 2 = 1,5 × coût de construction
  costGrowth: 1.9,              // puis ×1,9 par niveau
  baseCost: { bois: 60, pierre: 60 }, // pour le forum, qui n'a pas de coût de construction
  extra: { 3: { outils: 8 }, 4: { outils: 20, fer: 10 }, 5: { acier: 15, machines: 10 }, 6: { electronique: 10, alliages: 10 } },
  io: 0.75,     // production, consommation, énergie et stocks du bâtiment
  work: 0.5,    // main-d'œuvre requise
  pop: 0.5,     // habitants (et besoins) des logements
  hp: 0.25,     // points de vie
  wallHp: 0.6,  // points de vie des murs
  tower: 0.4,   // dégâts des tours
  store: 0.75,  // capacité des entrepôts
};
