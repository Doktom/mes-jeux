// Pêche Perchée V3 — profondeur RPG : niveaux, compétences, équipement spécifique, cuisine
// Ce fichier complète data.js (chargé après lui).
(() => {
  const D = G.D;
  const by = (list, id) => list.find((x) => x.id === id);

  // Départ minimaliste : une canne simple, rien d'autre. Le reste s'achète.
  D.reels.unshift({ id: 'm0', name: 'Pas de moulinet (tu tires à la main)', cost: 0, power: 0.72, desc: "Tu tires sur la ficelle avec tes petites pattes. C'est héroïque. C'est lent." });
  by(D.reels, 'm1').cost = 40;
  D.lines.unshift({ id: 'l0', name: 'La Ficelle du Bâton', cost: 0, res: 1.15, depth: 's', desc: "Fournie avec le bâton. Elle a déjà beaucoup vécu." });
  by(D.lines, 'l1').cost = 15;
  D.buckets.unshift({ name: 'Tes Poches (et ta bouche, en dernier recours)', cap: 3, cost: 0 });
  D.buckets[1].cost = 25;
  D.upgrades = D.upgrades.filter((u) => u.id !== 'u_bateau'); // remplacé par les vrais bateaux

  // ---------------------------------------------------------------- Niveaux d'exigence (progressivité)
  const L = (list, map) => list.forEach((x) => { x.lvl = map[x.id] || 1; });
  L(D.rods, { r2: 2, r3: 5, r4: 9, r5: 14, r6: 20 });
  L(D.reels, { m2: 2, m3: 6, m4: 11, m5: 17 });
  L(D.lines, { l2: 3, l3: 6, l4: 12, l5: 18 });
  L(D.baits, { b1: 2, b2: 3, b3: 7, b4: 12, b5: 1 });
  L(D.spots, { s2: 3, s3: 6, s4: 10, s5: 15 });
  L(D.upgrades, { u_filet: 5, u_aqua: 4, u_auto: 8, u_sonar: 9, u_bateau: 11 });
  D.buckets.forEach((b, i) => { b.lvl = [1, 1, 2, 4, 8, 12][i]; });

  // ---------------------------------------------------------------- Cannes spécialisées
  const extraRods = [
    { id: 'r_lune', name: 'Canne Lunaire', cost: 2600, lvl: 7, max: 40, ctrl: 0.31, range: 0.95, color: '#9fa8da', perk: { nightRare: 0.3 }, desc: "Brille la nuit, boude le jour. Comme un ado." },
    { id: 'r_fond', name: 'Canne du Fond de Panier', cost: 6000, lvl: 9, max: 100, ctrl: 0.32, range: 0.9, color: '#6d7f9a', perk: { deep: 0.35 }, desc: "Spécialiste du fond. Elle aime ce qui est enfoui : poissons, secrets, chaussettes." },
    { id: 'r_tempete', name: 'Canne Brise-Tempête', cost: 9500, lvl: 12, max: 140, ctrl: 0.33, range: 1.0, color: '#78909c', perk: { wetCalm: 0.2 }, desc: "Aime la pluie. A un parapluie intégré. L'orage, elle le prend pour un compliment." },
  ];
  D.rods = ['r1', 'r2', 'r3'].map((i) => by(D.rods, i)).concat(extraRods[0], by(D.rods, 'r4'), extraRods[1], extraRods[2], by(D.rods, 'r5'), by(D.rods, 'r6'));

  // ---------------------------------------------------------------- Hameçons, épuisettes, accessoires
  // perks : window (+s de fenêtre pour ferrer), loss (−% de recul hors zone), net (gain de remontée en fin de combat),
  //         radius (portée d'attraction des appâts), rare (+% de rareté), zone (+largeur de zone verte)
  D.hooks = [
    { id: 'h0', name: 'Un nœud (et beaucoup d\'espoir)', cost: 0, lvl: 1, perk: {}, desc: "Pas d'hameçon. Juste un nœud. Le poisson mord par politesse." },
    { id: 'hx', name: 'Épingle à Nourrice Tordue', cost: 10, lvl: 1, perk: { window: 0.03 }, desc: "Faite pour un pull, pas pour un poisson. Ça tient par la foi." },
    { id: 'h1', name: 'Hameçon Honnête', cost: 150, lvl: 2, perk: { window: 0.1 }, desc: "Il accroche ce qu'il faut, quand il faut." },
    { id: 'h2', name: 'Hameçon Barbelé de Compétition', cost: 900, lvl: 5, perk: { window: 0.15, loss: 0.12 }, desc: "Les poissons le détestent. Ils ne lâchent pas, c'est le but." },
    { id: 'h3', name: 'Hameçon Aimanté', cost: 4000, lvl: 9, perk: { window: 0.22, loss: 0.2, radius: 0.8 }, desc: "Les poissons s'en approchent sans savoir pourquoi. Moi non plus." },
    { id: 'h4', name: 'Hameçon Dimensionnel', cost: 28000, lvl: 16, perk: { window: 0.3, loss: 0.3, rare: 0.08 }, desc: "Pique dans plusieurs dimensions. Le poisson ne sait plus où il est. Toi non plus." },
  ];
  D.nets = [
    { id: 'n0', name: 'Mains nues', cost: 0, lvl: 1, perk: {}, desc: "Tu attrapes le poisson avec tes pattes. Il glisse. Tu insistes." },
    { id: 'nx', name: 'Passoire à Pâtes', cost: 15, lvl: 1, perk: { loss: 0.03 }, desc: "Aucune garantie. Aucune. Mais elle a des trous, comme ta technique." },
    { id: 'n1', name: 'Épuisette de Plage', cost: 300, lvl: 3, perk: { loss: 0.08, net: 0.12 }, desc: "Fait pour les crevettes. Fera pour les gardons." },
    { id: 'n2', name: 'Épuisette Télescopique', cost: 2200, lvl: 8, perk: { loss: 0.14, net: 0.25 }, desc: "Elle s'allonge. Elle s'allonge encore. Voilà, ça suffit." },
    { id: 'n3', name: 'Épuisette en Titane Poli', cost: 14000, lvl: 14, perk: { loss: 0.2, net: 0.4 }, desc: "Brillante, solide, vaniteuse. Elle se mire dans l'eau." },
    { id: 'n4', name: 'Épuisette Quantique', cost: 70000, lvl: 20, perk: { loss: 0.3, net: 0.6 }, desc: "Le poisson est déjà dedans avant que tu lances. Paradoxe confirmé." },
  ];
  D.accessories = [
    { id: 'a_lamp', name: 'Lanterne Frontale à Lucioles', icon: '🔦', cost: 700, lvl: 4, perk: { nightRare: 0.3, nightShadow: 0.4 }, desc: "Les lucioles sont payées en miel. Elles se plaignent." },
    { id: 'a_glasses', name: 'Lunettes Polarisées (Moches)', icon: '🕶️', cost: 500, lvl: 3, perk: { shadow: 0.35 }, desc: "Tu vois mieux les ombres. Tu es moins vu·e. Équilibre cosmique." },
    { id: 'a_cire', name: 'Ciré Jaune Ridicule', icon: '🧥', cost: 650, lvl: 4, perk: { wetCalm: 0.12, wetBite: 0.15 }, desc: "Sous la pluie, tu es jaune ET heureux·se." },
    { id: 'a_thermos', name: 'Thermos de Thé Tiède', icon: '🍵', cost: 1100, lvl: 5, perk: { zone: 0.02 }, desc: "Calme les nerfs. Ni chaud, ni froid : comme tes opinions." },
    { id: 'a_gants', name: 'Gants Collants', icon: '🧤', cost: 2000, lvl: 6, perk: { loss: 0.06 }, desc: "Ils collent. À tout. Y compris à toi. Surtout à toi." },
    { id: 'a_baro', name: 'Baromètre Sentimental', icon: '🌡️', cost: 1500, lvl: 6, perk: { forecast: 1 }, desc: "Prévoit la météo suivante. Ressent aussi les émotions du ciel." },
    { id: 'a_boussole', name: 'Boussole à Poisson', icon: '🧭', cost: 1800, lvl: 7, perk: { radius: 1.0 }, desc: "Indique toujours le poisson le plus proche. Ou le nord. Selon l'humeur." },
    { id: 'a_sac', name: 'Sac à Dos Magique', icon: '🎒', cost: 3500, lvl: 7, perk: { bucket: 4 }, desc: "Plus grand à l'intérieur. Roger y a élu domicile (+4 places au seau)." },
    { id: 'a_carnet', name: 'Carnet de Mamie', icon: '📔', cost: 2500, lvl: 8, perk: { xp: 0.1 }, desc: "Pleine de conseils. Dont 3 sont bons (+10 % d'expérience)." },
    { id: 'a_patte', name: 'Patte de Loutre Porte-Bonheur', icon: '🐾', cost: 6000, lvl: 10, perk: { rare: 0.08 }, desc: "Elle porte bonheur à tout le monde sauf à la loutre d'origine." },
  ];
  // appâts spécialisés
  D.baits.push(
    { id: 'b6', name: 'Mouche Artificielle', cost: 220, lvl: 4, rare: 1.6, speed: 1.4, depth: 's', desc: "Imite une mouche. Très mal. Mais en surface, ça marche." },
    { id: 'b7', name: 'Crevette Ancestrale', cost: 600, lvl: 8, rare: 2.4, speed: 1.4, depth: 'f', desc: "Fossilisée, délicieuse (pour un poisson). Idéale pour le fond." },
    { id: 'b8', name: 'Ver Luisant', cost: 450, lvl: 6, rare: 1.8, speed: 1.5, night: true, desc: "Brille la nuit (×1,8 de rareté). Le jour, il fait la sieste (×0,9)." },
  );

  // ---------------------------------------------------------------- Titres et compétences
  D.titles = {
    fish: [[1, 'Loutre Débutante'], [3, 'Apprentie Pêcheuse'], [6, 'Pêcheuse Honnête'], [10, 'Loutre Aguerrie'], [14, 'Pro du Bouchon'], [18, 'Maîtresse des Eaux'], [22, 'Légende Locale'], [26, 'Terreur des Poissons'], [30, 'Loutre Suprême (vraiment)']],
    cook: [[1, 'Marmiton·ne'], [3, 'Commis Maladroit·e'], [6, 'Cuisinier·ère Honnête'], [9, 'Sous-Chef'], [12, 'Chef de Partie'], [15, 'Chef Étoilé·e (au feutre)'], [18, 'Chef Triplement Étoilé·e'], [20, 'Maître Queue Suprême']],
  };
  D.maxLvl = { fish: 30, cook: 20 };
  // per : effet par rang (clé de perk). lvl : niveau du joueur nécessaire pour le 1er rang
  D.skills = [
    { id: 'patience', tree: 'fish', name: 'Patience de Loutre', icon: '⏳', max: 5, lvl: 1, perk: { bite: 0.06 }, desc: "Les poissons viennent plus vite (+6 % de vitesse de touche par rang)." },
    { id: 'poigne', tree: 'fish', name: 'Poigne de Fer', icon: '💪', max: 5, lvl: 2, perk: { zone: 0.012 }, desc: "Zone verte plus large au moulinage (+1,2 par rang)." },
    { id: 'reflexes', tree: 'fish', name: 'Réflexes de Félin (Aquatique)', icon: '⚡', max: 5, lvl: 3, perk: { window: 0.12 }, desc: "Plus de temps pour ferrer (+0,12 s par rang)." },
    { id: 'oeil', tree: 'fish', name: "Œil d'Aigle (de Mer)", icon: '👁️', max: 5, lvl: 4, perk: { shadow: 0.08, radius: 0.3 }, desc: "Ombres plus visibles et appâts plus attractifs." },
    { id: 'chance', tree: 'fish', name: 'Veine de Cocu', icon: '🍀', max: 5, lvl: 5, perk: { rare: 0.04 }, desc: "Plus de poissons rares (+4 % par rang)." },
    { id: 'endurance', tree: 'fish', name: 'Cœur Accroché', icon: '🫀', max: 3, lvl: 6, perk: { loss: 0.1 }, desc: "Le poisson regagne moins de terrain hors zone (−10 % par rang)." },
    { id: 'marchandage', tree: 'fish', name: 'Sens du Troc', icon: '🤝', max: 5, lvl: 7, perk: { sell: 0.03 }, desc: "Tu vends plus cher (+3 % par rang), même aux poissonnières." },
    { id: 'lanceur', tree: 'fish', name: 'Bras de Catapulte', icon: '🏹', max: 3, lvl: 8, perk: { cast: 0.06 }, desc: "Lancers plus longs (+6 % par rang)." },
    { id: 'gourmet', tree: 'cook', name: 'Palais de Gourmet', icon: '😋', max: 5, lvl: 1, perk: { dish: 0.06 }, desc: "Tes plats valent plus cher (+6 % par rang)." },
    { id: 'coupfeu', tree: 'cook', name: 'Coup de Feu', icon: '🔥', max: 5, lvl: 2, perk: { speed: 0.07 }, desc: "Cuisson plus rapide (−7 % de temps par rang)." },
    { id: 'econome', tree: 'cook', name: "Sens de l'Économie", icon: '🧮', max: 3, lvl: 3, perk: { save: 0.09 }, desc: "Chance de ne pas consommer un ingrédient (+9 % par rang)." },
    { id: 'palais', tree: 'cook', name: 'Doigté de Pâtissière', icon: '🎯', max: 5, lvl: 4, perk: { quality: 0.18 }, desc: "Meilleure qualité (étoiles) à chaque plat." },
    { id: 'antiburn', tree: 'cook', name: "Extincteur Intégré", icon: '🧯', max: 3, lvl: 5, perk: { burn: 0.1 }, desc: "Les plats ratés brûlent moins souvent (−10 % par rang)." },
    { id: 'banquet', tree: 'cook', name: 'Esprit de Banquet', icon: '🍽️', max: 3, lvl: 8, perk: { double: 0.07 }, desc: "Chance de cuisiner une portion en plus (+7 % par rang)." },
  ];

  // ---------------------------------------------------------------- Ingrédients (Marché aux Saveurs de Marguerite)
  // at : coins où l'ingrédient est vendu (sinon partout)
  D.ingredients = [
    { id: 'sel', name: 'Sel de Mer', icon: '🧂', price: 4 }, { id: 'beurre', name: 'Beurre Demi-Sel', icon: '🧈', price: 12 },
    { id: 'citron', name: 'Citron Acide', icon: '🍋', price: 10 }, { id: 'ail', name: 'Ail Pas Discret', icon: '🧄', price: 6 },
    { id: 'persil', name: 'Persil Frisé', icon: '🌿', price: 5 }, { id: 'huile', name: "Huile d'Olive", icon: '🫒', price: 9 },
    { id: 'patate', name: 'Pomme de Terre', icon: '🥔', price: 7 }, { id: 'oignon', name: 'Oignon Pleureur', icon: '🧅', price: 6 },
    { id: 'farine', name: 'Farine Blanche', icon: '🌾', price: 8 }, { id: 'oeuf', name: 'Œuf (de Mouette ?)', icon: '🥚', price: 10 },
    { id: 'creme', name: 'Crème Fraîche', icon: '🥛', price: 16 }, { id: 'riz', name: 'Riz Collant', icon: '🍚', price: 11 },
    { id: 'algue', name: 'Algue Croquante', icon: '🥬', price: 8 }, { id: 'piment', name: 'Piment Vexé', icon: '🌶️', price: 14 },
    { id: 'gingembre', name: 'Gingembre Nerveux', icon: '🫚', price: 18 }, { id: 'soja', name: 'Sauce Soja', icon: '🥢', price: 15 },
    { id: 'fromage', name: 'Fromage Qui Pue Artisanal', icon: '🧀', price: 40 },
    { id: 'vin', name: 'Vin Blanc Sec (Très)', icon: '🍷', price: 28, at: ['s2', 's3', 's4'] },
    { id: 'chocolat', name: 'Chocolat Noir Boudeur', icon: '🍫', price: 35, at: ['s3', 's4'] },
    { id: 'champi', name: 'Champignons Pas Nets', icon: '🍄', price: 60, at: ['s2', 's5'] },
    { id: 'safran', name: 'Safran Doré', icon: '🌼', price: 90, at: ['s3', 's4', 's5'] },
    { id: 'miel', name: 'Miel de Gelée', icon: '🍯', price: 30, at: ['s4'] },
    { id: 'coco', name: 'Noix de Coco Gélatineuse', icon: '🥥', price: 25, at: ['s4'] },
    { id: 'sucre', name: 'Sucre Glace (du Ciel)', icon: '🍬', price: 20, at: ['s4'] },
    { id: 'truffe', name: 'Truffe (Authentique, Presque)', icon: '🖤', price: 220, at: ['s4', 's5'] },
    { id: 'poussiere', name: "Poussière d'Étoile Culinaire", icon: '✨', price: 150, at: ['s5'] },
  ];

  // ---------------------------------------------------------------- Matériel de cuisine
  D.stoves = [
    { name: 'Réchaud de Fortune', cost: 80, lvl: 1, slots: 1, speed: 1.0, desc: "Une bougie, une boîte de conserve, beaucoup d'espoir. 1 plat à la fois." },
    { name: 'Réchaud de Camping', cost: 500, lvl: 3, slots: 2, speed: 1.15, desc: "Deux feux ! Un pour cuisiner, un pour se plaindre. 2 plats en parallèle." },
    { name: 'Cuisinière de Mamie', cost: 3000, lvl: 6, slots: 3, speed: 1.3, desc: "Elle sent le gâteau. Elle sent toujours le gâteau. 3 plats en parallèle." },
    { name: 'Piano de Cuisson Pro', cost: 15000, lvl: 11, slots: 4, speed: 1.6, desc: "Un vrai piano. Il ne joue pas, il fait mijoter. 4 plats en parallèle." },
    { name: 'Fourneau Stellaire', cost: 80000, lvl: 18, slots: 6, speed: 2.0, desc: "Alimenté par une étoile (en location). 6 plats en parallèle, très vite." },
  ];
  D.knives = [
    { name: 'Couteau Émoussé', cost: 15, lvl: 1, q: 0, desc: "Il coupe l'ambiance, surtout." },
    { name: 'Couteau de Cuisine', cost: 200, lvl: 2, q: 0.35, desc: "Un vrai couteau. Qui coupe. Quelle idée." },
    { name: 'Couteau de Chef', cost: 1500, lvl: 6, q: 0.7, desc: "Lourd, droit, sérieux. Il ne rit pas." },
    { name: "Couteau en Obsidienne", cost: 9000, lvl: 12, q: 1.1, desc: "Si tranchant qu'il coupe en deux les remords." },
    { name: 'Excalimbur, Couteau Légendaire', cost: 50000, lvl: 18, q: 1.6, desc: "Planté dans un rocher, il attendait un·e vrai·e chef. Il attendait aussi un déjeuner." },
  ];
  D.appliances = [
    { id: 'poele', name: 'Poêle Antiadhésive (Presque)', icon: '🍳', cost: 120, lvl: 1, desc: "Pour sauter, dorer, poêler. Colle un peu quand même." },
    { id: 'marmite', name: 'Marmite de Mamie', icon: '🍲', cost: 400, lvl: 3, desc: "Soupes, bouillons, ragoûts. A déjà tout mijoté." },
    { id: 'gril', name: 'Gril à Algues', icon: '🔥', cost: 900, lvl: 5, desc: "Grillades et brochettes. Sent le bord de mer." },
    { id: 'four', name: 'Four à Pain Fou', icon: '🥧', cost: 2500, lvl: 8, desc: "Gratins, papillotes, tartes. Parfois, il chante." },
    { id: 'fumoir', name: 'Fumoir de Contrebande', icon: '💨', cost: 6000, lvl: 10, desc: "Poisson fumé. Le fumoir aussi, d'ailleurs." },
    { id: 'mixeur', name: 'Mixeur Dopé', icon: '🌀', cost: 12000, lvl: 12, desc: "Rillettes, mousses, purées. 14 000 tours par minute, 0 respect pour les arêtes." },
    { id: 'siphon', name: 'Siphon Moléculaire', icon: '🧪', cost: 40000, lvl: 16, desc: "Cuisine moléculaire. Tu ne comprends pas. Ça se mange quand même." },
  ];
  D.methodNames = { poele: 'Poêle', marmite: 'Marmite', gril: 'Gril', four: 'Four', fumoir: 'Fumoir', mixeur: 'Mixeur', siphon: 'Siphon' };

  // ---------------------------------------------------------------- Recettes (apprises auprès du Chef Gaston)
  // fish : { kind: 'any' | 'rank' (min,max) | 'id' | 'junk' | 'lsd' }
  // prix du plat = poisson × mult + base + 60 % du prix des ingrédients, × étoiles
  // buff : { k: perk, v: valeur, dur: secondes }
  const any = { kind: 'any' };
  const rk = (min, max = 4) => ({ kind: 'rank', min, max });
  D.recipes = [
    { id: 'poele_beurre', name: 'Poisson Poêlé au Beurre', icon: '🍳', method: 'poele', fish: any, ing: { beurre: 1, sel: 1 }, time: 20, mult: 1.5, base: 8, lvl: 1, cost: 40, buff: { k: 'bite', v: 0.08, dur: 150 }, desc: "Le grand classique. Simple, honnête, gras." },
    { id: 'meuniere', name: 'Meunière Citronnée', icon: '🍋', method: 'poele', fish: any, ing: { beurre: 1, citron: 1, farine: 1 }, time: 25, mult: 1.8, base: 12, lvl: 2, cost: 120, buff: { k: 'window', v: 0.12, dur: 180 }, desc: "Enrobé de farine, parfumé au citron, arrosé de bonne humeur." },
    { id: 'filet_ail', name: 'Filet à l\'Ail & Persil', icon: '🧄', method: 'poele', fish: rk(0, 1), ing: { ail: 1, persil: 1, huile: 1 }, time: 22, mult: 1.9, base: 10, lvl: 3, cost: 150, buff: { k: 'zone', v: 0.02, dur: 180 }, desc: "Tu sentiras l'ail pendant 3 jours. Les poissons aussi." },
    { id: 'poele_piment', name: 'Poêlée Piment Vexé', icon: '🌶️', method: 'poele', fish: any, ing: { piment: 1, oignon: 1, huile: 1 }, time: 24, mult: 2.0, base: 14, lvl: 4, cost: 350, buff: { k: 'zone', v: 0.025, dur: 160 }, desc: "Ça pique. C'est mérité." },
    { id: 'soupe', name: 'Soupe de Poisson de la Mère-Loutre', icon: '🍲', method: 'marmite', fish: any, ing: { oignon: 1, patate: 1, sel: 1 }, time: 35, mult: 1.6, base: 16, lvl: 2, cost: 200, buff: { k: 'zone', v: 0.03, dur: 200 }, desc: "Réconfortante. Elle ressemble à celle de ta mère. Ta mère, elle, ressemble à une loutre." },
    { id: 'soupe_botte', name: 'Soupe de Botte (Réconfort)', icon: '👢', method: 'marmite', fish: { kind: 'id', id: 'botte' }, ing: { oignon: 1, sel: 1, patate: 1 }, time: 40, mult: 7, base: 30, lvl: 4, cost: 400, buff: { k: 'loss', v: 0.1, dur: 200 }, desc: "Une botte orpheline, deux oignons. Une cuisine anti-gaspi. Très anti." },
    { id: 'chaussette_farcie', name: 'Chaussette Farcie au Fromage', icon: '🧦', method: 'four', fish: { kind: 'id', id: 'chaussette' }, ing: { fromage: 1, ail: 1 }, time: 45, mult: 12, base: 40, lvl: 8, cost: 1200, buff: { k: 'sell', v: 0.08, dur: 240 }, desc: "La chaussette retrouve enfin un but dans la vie. Le fromage aussi." },
    { id: 'bouillabaisse', name: 'Bouillabaisse Dépressive', icon: '🍲', method: 'marmite', fish: rk(1), ing: { safran: 1, ail: 1, patate: 1, huile: 1 }, time: 50, mult: 2.6, base: 30, lvl: 6, cost: 900, buff: { k: 'rare', v: 0.1, dur: 240 }, desc: "Elle bout, elle pleure, elle est délicieuse. Une cuisine à fleur de peau." },
    { id: 'curry_algue', name: 'Curry de Poisson aux Algues', icon: '🍛', method: 'marmite', fish: any, ing: { piment: 1, creme: 1, riz: 1, algue: 1 }, time: 45, mult: 2.4, base: 24, lvl: 7, cost: 1000, buff: { k: 'xp', v: 0.12, dur: 240 }, desc: "Épicé, onctueux, marin. Le riz colle à tout, même à la conversation." },
    { id: 'grille_citron', name: 'Poisson Grillé au Citron', icon: '🔥', method: 'gril', fish: any, ing: { citron: 1, sel: 1, huile: 1 }, time: 25, mult: 2.0, base: 18, lvl: 4, cost: 450, buff: { k: 'bite', v: 0.1, dur: 200 }, desc: "Grillé, point final. Il n'y a pas de sens caché." },
    { id: 'brochette', name: 'Brochette Prestige', icon: '🍢', method: 'gril', fish: rk(1), ing: { piment: 1, oignon: 1, huile: 1 }, time: 30, mult: 2.4, base: 26, lvl: 6, cost: 800, buff: { k: 'sell', v: 0.06, dur: 240 }, desc: "Piquée au bout d'une pique. La pique, c'est le principe." },
    { id: 'bbq_algue', name: 'Barbecue d\'Algues & Poisson', icon: '🥬', method: 'gril', fish: any, ing: { algue: 1, soja: 1, gingembre: 1 }, time: 35, mult: 2.3, base: 22, lvl: 7, cost: 950, buff: { k: 'cast', v: 0.1, dur: 240 }, desc: "Mer et saveurs, version feu de camp." },
    { id: 'gratin', name: 'Gratin Dauphinois… de Poisson', icon: '🧀', method: 'four', fish: any, ing: { creme: 1, patate: 1, fromage: 1, sel: 1 }, time: 60, mult: 2.8, base: 40, lvl: 8, cost: 1500, buff: { k: 'xp', v: 0.15, dur: 300 }, desc: "Ça gratine. Ça gratine fort. Le dauphin n'est pas content d'être cité." },
    { id: 'papillote', name: 'Papillote Surprise', icon: '📦', method: 'four', fish: rk(0, 2), ing: { citron: 1, persil: 1, vin: 1 }, time: 45, mult: 3.0, base: 36, lvl: 9, cost: 1800, buff: { k: 'window', v: 0.2, dur: 300 }, desc: "Une surprise dans du papier cuit. Rarement un cadeau. Souvent un poisson." },
    { id: 'tarte', name: 'Tarte Salée de Poisson', icon: '🥧', method: 'four', fish: any, ing: { farine: 1, oeuf: 1, creme: 1, beurre: 1 }, time: 55, mult: 2.6, base: 38, lvl: 8, cost: 1400, buff: { k: 'zone', v: 0.04, dur: 280 }, desc: "Le salé s'invite à la pâtisserie. La pâtisserie fait semblant de ne pas voir." },
    { id: 'fume', name: 'Poisson Fumé Maison', icon: '💨', method: 'fumoir', fish: rk(1), ing: { sel: 1, algue: 1 }, time: 90, mult: 3.4, base: 50, lvl: 10, cost: 2500, buff: { k: 'rare', v: 0.14, dur: 300 }, desc: "Patience : 90 secondes de fumée. Le résultat est ahurissant (et un peu fumé)." },
    { id: 'gravlax', name: 'Gravlax Perché', icon: '🍣', method: 'fumoir', fish: { kind: 'id', id: 'saumon' }, ing: { sel: 1, sucre: 1, citron: 1 }, time: 80, mult: 5.5, base: 70, lvl: 11, cost: 3500, buff: { k: 'sell', v: 0.12, dur: 300 }, desc: "Un saumon mariné qui nage à contre-courant, même après sa mort." },
    { id: 'rillettes', name: 'Rillettes de Poisson', icon: '🫙', method: 'mixeur', fish: any, ing: { beurre: 1, citron: 1, ail: 1 }, time: 40, mult: 2.6, base: 44, lvl: 11, cost: 3000, buff: { k: 'loss', v: 0.14, dur: 300 }, desc: "Étalées sur du pain. Ou sur ta honte. Les deux marchent." },
    { id: 'mousse', name: 'Mousse de Poisson Fantôme', icon: '☁️', method: 'mixeur', fish: rk(2), ing: { creme: 1, oeuf: 1, truffe: 1 }, time: 55, mult: 3.6, base: 80, lvl: 13, cost: 5500, buff: { k: 'rare', v: 0.18, dur: 300 }, desc: "Légère, aérienne, un peu absente. Comme le poisson." },
    { id: 'choco', name: 'Poisson au Chocolat', icon: '🍫', method: 'mixeur', fish: any, ing: { chocolat: 1, creme: 1 }, time: 50, mult: 2.4, base: 60, lvl: 12, cost: 4000, buff: { k: 'xp', v: 0.1, dur: 240 }, desc: "Personne ne l'a demandé. Beaucoup le commanderont quand même." },
    { id: 'ceviche_psy', name: 'Sashimi Arc-en-Ciel', icon: '🌈', method: 'siphon', fish: { kind: 'lsd' }, ing: { soja: 1, gingembre: 1, citron: 1 }, time: 45, mult: 6.0, base: 120, lvl: 16, cost: 9000, buff: { k: 'trip', v: 1, dur: 1 }, desc: "Tranché fin, servi cru, vécu intensément. Attention : voyage inclus." },
    { id: 'espuma', name: 'Espuma de Poisson Cosmique', icon: '🫧', method: 'siphon', fish: rk(3), ing: { creme: 1, poussiere: 1 }, time: 60, mult: 7.0, base: 200, lvl: 17, cost: 15000, buff: { k: 'bite', v: 0.3, dur: 300 }, desc: "De la mousse qui fait « pschitt » dans l'espace. Personne ne t'entend." },
    { id: 'glace_poisson', name: 'Glace au Poisson (Vanille-Thon)', icon: '🍨', method: 'siphon', fish: any, ing: { sucre: 1, creme: 1, miel: 1 }, time: 50, mult: 3.0, base: 130, lvl: 15, cost: 7000, buff: { k: 'xp', v: 0.2, dur: 300 }, desc: "Sucrée-salée-glacée-incompréhensible. Un classique d'avant-garde." },
    { id: 'festin', name: 'Le Festin Légendaire', icon: '👑', method: 'four', fish: rk(4), ing: { truffe: 1, safran: 1, vin: 1, poussiere: 1 }, time: 120, mult: 12.0, base: 900, lvl: 18, cost: 30000, buff: { k: 'all', v: 0.2, dur: 600 }, desc: "Un banquet pour un poisson légendaire. Le dessert est inclus. Le remords aussi." },
  ];
  D.recipes.forEach((r) => { r.ingCost = Object.entries(r.ing).reduce((a, [id, n]) => a + n * by(D.ingredients, id).price, 0); });
  D.starMult = [0, 0.55, 0.8, 1, 1.3, 1.8];
  D.buffNames = { bite: 'Touches', window: 'Réflexes', zone: 'Poigne', rare: 'Chance', loss: 'Accroche', sell: 'Ventes', xp: 'Expérience', cast: 'Portée', all: 'Tout !' };

  // ---------------------------------------------------------------- PNJ de la cuisine
  D.npcs.marguerite = { name: 'Marguerite', role: "Marchande d'ingrédients", icon: '🧺',
    lines: ["Mes légumes sont frais. Mes blagues, moins.", "Un oignon, ça pleure pour toi. Mets-en deux, tu auras plus de soutien.", "Le prix change tous les jours. Le sourire, jamais.", "Je vends du safran. Si tu l'achètes, tu comprends pourquoi c'est cher. Si tu l'achètes pas, aussi."] };
  D.npcs.gaston = { name: 'Chef Gaston Fourchette', role: 'Chef (1 étoile, au feutre)', icon: '👨‍🍳',
    lines: ["La cuisine, c'est de l'amour. Et du beurre. Surtout du beurre.", "Un poisson bien cuisiné, c'est un poisson qui pardonne.", "J'ai trois étoiles. Deux sont dessinées. Ne les regarde pas de près.", "On ne rate jamais un plat. On invente une nouvelle recette. Parfois immangeable."] };

  // ---------------------------------------------------------------- Répliques
  Object.assign(D.quips, {
    levelUp: ["Niveau supérieur ! Les poissons murmurent ton nom. Ils ont tort, mais ils le murmurent.", "Tu montes en niveau ! Roger a failli applaudir, il y a eu un frémissement.", "Ding ! Un point de compétence ! Dépense-le dans le Carnet, ou garde-le pour les mauvais jours."],
    cookLevelUp: ["Niveau de cuisine supérieur ! Chef Gaston verse une larme (dans la sauce).", "Tu cuisines mieux ! Marguerite a même levé un sourcil."],
    cookStart: ["Ça grésille. Ça sent déjà bon.", "Le plat mijote. Il a des choses à te dire.", "Tu lances la cuisson. L'odeur attire les mouettes. Surveille Gégé."],
    cookDone: ["Le plat est prêt ! Il est beau. Il est chaud. Il est à toi.", "Ding ! Cuisson terminée. Les poissons, eux, n'ont pas applaudi."],
    cookBurn: ["Oups. C'est du charbon. Du charbon de poisson. Décoratif.", "Tu as réinventé le noir. Comme couleur. Et comme goût.", "Le plat est carbonisé. Roger refuse de le regarder."],
    cookStar: ["★ Un plat parfait ! Gaston te regarde. Il sanglote en silence.", "Cinq étoiles ! Même le fumet applaudit."],
    eatDish: ["Tu manges le plat. Ça donne des ailes (aux nageoires).", "Délicieux. Tu te sens… prêt·e.", "Miam. Roger t'observe. Il voudrait un morceau. Il n'a pas de bouche."],
    needStove: ["Il te faut un réchaud pour cuisiner. Marguerite en vend, pas cher (si on aime les bougies).", "Pas de réchaud, pas de cuisine. C'est la loi des fourneaux."],
    needAppliance: ["Il te manque l'appareil pour cette recette. Marguerite te le vendra avec un clin d'œil.", "Cette recette demande un ustensile que tu n'as pas. Un peu de shopping."],
    needIng: ["Il manque des ingrédients dans ton garde-manger. Marguerite a ce qu'il faut.", "Pas assez d'ingrédients. On ne cuisine pas avec de l'imagination (quoique)."],
    needFish: ["Aucun poisson de ton seau ne convient pour cette recette. Va pêcher, c'est le principe.", "Ce plat demande un poisson particulier. Il ne s'est pas encore laissé pêcher."],
    noSlot: ["Tous tes feux sont occupés. Attends qu'un plat soit prêt ou améliore ton réchaud."],
    needLvl: ["Niveau insuffisant. Les poissons n'aiment pas être pressés (ni les chefs)."],
    learn: ["Recette apprise ! Gaston te la murmure à l'oreille. Tu hoches la tête, tu n'as pas tout compris.", "Nouvelle recette ! Tu la connaîtras par cœur. Ou presque."],
    skillUp: ["Compétence améliorée !", "Ça se sent : tu es meilleur·e. Un tout petit peu. Mais meilleur·e."],
    dishSell: ["La Josiane goûte, grimace, puis paye. Un pro.", "Vendu ! La Josiane met le plat « en vitrine ». Il n'y a pas de vitrine.", "Le plat part comme des petits pains (de poisson)."],
    menu: ["C'est le menu du jour ! Ce plat vaut le double chez La Josiane.", "Aujourd'hui, la spécialité du ponton est à l'honneur."],
    forecast: "Le baromètre frémit : ça va changer…",
  });

  // ---------------------------------------------------------------- Succès supplémentaires
  const A = D.achievements;
  A.push(
    { id: 'a_lvl5', name: 'Loutre Qui Monte', desc: 'Atteindre le niveau 5', reward: 300, check: (S) => S.rpg.lvl >= 5 },
    { id: 'a_lvl15', name: 'Loutre Confirmée', desc: 'Atteindre le niveau 15', reward: 3000, check: (S) => S.rpg.lvl >= 15 },
    { id: 'a_lvl30', name: 'Niveau Maximum', desc: 'Atteindre le niveau 30', reward: 30000, check: (S) => S.rpg.lvl >= 30 },
    { id: 'a_cook1', name: 'Premier Plat', desc: 'Cuisiner un plat', reward: 200, check: (S) => (S.stats.cooked || 0) >= 1 },
    { id: 'a_cook25', name: 'Marmiton Acharné', desc: 'Cuisiner 25 plats', reward: 1500, check: (S) => (S.stats.cooked || 0) >= 25 },
    { id: 'a_burn5', name: 'Charbonnier', desc: 'Carboniser 5 plats', reward: 400, check: (S) => (S.stats.burnt || 0) >= 5 },
    { id: 'a_star5', name: 'Étoile Montante', desc: 'Réussir un plat 5 étoiles', reward: 1500, check: (S) => (S.stats.star5 || 0) >= 1 },
    { id: 'a_recipes8', name: 'Livre de Recettes', desc: 'Connaître 8 recettes', reward: 1200, check: (S) => S.cook.recipes.length >= 8 },
    { id: 'a_dishsell', name: 'Restaurateur', desc: 'Vendre 25 plats', reward: 2000, check: (S) => (S.stats.dishSold || 0) >= 25 },
    { id: 'a_clvl10', name: 'Chef de Partie', desc: 'Atteindre le niveau 10 de cuisine', reward: 4000, cos: 'hat_toque', check: (S) => S.rpg.clvl >= 10 },
    { id: 'a_festin', name: 'Banquet Royal', desc: 'Cuisiner le Festin Légendaire', reward: 10000, check: (S) => (S.stats.festin || 0) >= 1 },
    { id: 'a_dishorders', name: 'Traiteur', desc: 'Livrer 10 commandes de plats', reward: 2500, check: (S) => (S.stats.dishOrders || 0) >= 10 },
  );
  // chapeau de chef
  const cos = D.cosmetics;
  cos.splice(cos.findIndex((c) => c.id === 'hat_couronne'), 0, { id: 'hat_toque', slot: 'hat', name: 'Toque de Chef', cost: 600, desc: "Haute, blanche, imposante. Le poisson sait que tu es sérieux·se." });

  // ---------------------------------------------------------------- Moins de pluie : on réécrit les météos des coins
  const WX = {
    s1: ['clair', 'clair', 'clair', 'clair', 'clair', 'confettis', 'confettis', 'brouillard', 'pluie'],
    s2: ['clair', 'clair', 'clair', 'brouillard', 'brouillard', 'pluie', 'orage'],
    s3: ['clair', 'clair', 'clair', 'clair', 'brouillard', 'pluie', 'orage'],
    s4: ['clair', 'clair', 'clair', 'clair', 'sucre', 'sucre', 'pluie', 'orage'],
    s5: ['clair', 'clair', 'brouillard', 'meteores', 'meteores', 'meteores'],
  };
  D.spots.forEach((sp) => { sp.weathers = WX[sp.id]; });

  // ---------------------------------------------------------------- Ustensiles et techniques de cuisine (tout s'achète, tout se débloque)
  D.utensils = [
    { id: 'ecailleur', name: 'Écailleur à Poisson', icon: '🐠', cost: 25, lvl: 1, desc: "Gratte les écailles. Le poisson trouve ça très gênant." },
    { id: 'planche', name: 'Planche à Découper (en liège)', icon: '🪵', cost: 40, lvl: 1, desc: "Plate, solide, couverte de cicatrices. Comme ta dignité." },
    { id: 'bol', name: 'Bol & Fouet', icon: '🥣', cost: 70, lvl: 3, desc: "Pour fouetter, mélanger, mariner. Et pleurer, un peu." },
    { id: 'mortier', name: 'Mortier & Pilon', icon: '🫙', cost: 160, lvl: 4, desc: "Écrase les épices. Et les ennemis, au besoin." },
    { id: 'rouleau', name: 'Rouleau à Pâtisserie', icon: '🥖', cost: 220, lvl: 5, desc: "Étale la pâte. S'utilise aussi pour négocier avec les mouettes." },
  ];
  D.techs = [
    { id: 'ecailler', name: 'Écailler', icon: '🐠', cost: 30, lvl: 1, needs: { utensil: ['ecailleur'] }, desc: "Retirer les écailles sans en mettre partout. Spoiler : tu en mettras partout." },
    { id: 'vider', name: 'Vider', icon: '🔪', cost: 40, lvl: 1, needs: { knife: 1 }, desc: "Nécessite un couteau, même mauvais. Tu verras, c'est… instructif." },
    { id: 'cuire', name: 'Cuire', icon: '🔥', cost: 30, lvl: 1, needs: { stove: 1 }, desc: "Maîtriser le feu. Éviter de se brûler. Éviter de brûler le poisson. Le reste est un détail." },
    { id: 'fileter', name: 'Fileter', icon: '🥩', cost: 180, lvl: 3, needs: { utensil: ['planche'], knife: 2 }, desc: "Lever des filets proprement. Demande une planche et un vrai couteau." },
    { id: 'assaisonner', name: 'Assaisonner', icon: '🧂', cost: 200, lvl: 4, needs: { utensil: ['mortier'] }, desc: "Doser le sel, le poivre et le courage. Le courage, surtout." },
    { id: 'mariner', name: 'Mariner', icon: '🫗', cost: 300, lvl: 6, needs: { utensil: ['bol'] }, desc: "Laisser un poisson réfléchir dans un bain d'idées acides." },
    { id: 'patisserie', name: 'Pâtisserie Salée', icon: '🥐', cost: 450, lvl: 7, needs: { utensil: ['rouleau', 'bol'] }, desc: "Pâtes brisées, feuilletées, ou simplement déçues." },
  ];
  const TECH_DEFAULT = ['ecailler', 'vider', 'cuire'];
  const TECH_MAP = {
    soupe_botte: ['cuire'], chaussette_farcie: ['cuire'],
    filet_ail: [...TECH_DEFAULT, 'fileter'], poele_piment: [...TECH_DEFAULT, 'assaisonner'], bouillabaisse: [...TECH_DEFAULT, 'assaisonner'],
    curry_algue: [...TECH_DEFAULT, 'assaisonner'], brochette: [...TECH_DEFAULT, 'fileter'], bbq_algue: [...TECH_DEFAULT, 'assaisonner'],
    gratin: [...TECH_DEFAULT, 'fileter'], papillote: [...TECH_DEFAULT, 'fileter'], tarte: [...TECH_DEFAULT, 'patisserie'],
    fume: [...TECH_DEFAULT, 'mariner'], gravlax: [...TECH_DEFAULT, 'fileter', 'mariner'], rillettes: [...TECH_DEFAULT, 'fileter'],
    mousse: [...TECH_DEFAULT, 'fileter'], choco: [...TECH_DEFAULT, 'patisserie'], ceviche_psy: [...TECH_DEFAULT, 'fileter', 'mariner'],
    espuma: [...TECH_DEFAULT, 'fileter', 'assaisonner'], glace_poisson: [...TECH_DEFAULT, 'patisserie'],
    festin: [...TECH_DEFAULT, 'fileter', 'assaisonner', 'mariner', 'patisserie'],
  };
  D.recipes.forEach((r) => { r.tech = TECH_MAP[r.id] || TECH_DEFAULT; });

  // ---------------------------------------------------------------- Agriculture : le potager flottant de Tata Capucine
  // growth en secondes (continue hors ligne, 30 min max) ; wet : adore la pluie ; night : pousse mieux la nuit
  D.crops = [
    { id: 'persil', name: 'Persil', ing: 'persil', icon: '🌿', color: '#4caf50', seed: 4, time: 60, yield: [2, 4], lvl: 1, desc: "Pousse partout. Même dans tes rêves." },
    { id: 'oignon', name: 'Oignon', ing: 'oignon', icon: '🧅', color: '#d7a86e', seed: 5, time: 90, yield: [2, 4], lvl: 1, desc: "Il pleure déjà avant d'être coupé." },
    { id: 'ail', name: 'Ail', ing: 'ail', icon: '🧄', color: '#f5efe0', seed: 6, time: 100, yield: [2, 4], lvl: 2, desc: "Éloigne les vampires, les voisins et les rendez-vous galants." },
    { id: 'patate', name: 'Pomme de Terre', ing: 'patate', icon: '🥔', color: '#b08d57', seed: 7, time: 120, yield: [3, 5], lvl: 2, desc: "Elle pousse sous terre. Elle n'a rien demandé." },
    { id: 'sel', name: 'Marais Salant', ing: 'sel', icon: '🧂', color: '#e3f2fd', seed: 6, time: 90, yield: [3, 5], lvl: 3, desc: "On laisse sécher l'eau. C'est tout. On appelle ça un métier." },
    { id: 'ble', name: 'Blé', ing: 'farine', icon: '🌾', color: '#f2cf5b', seed: 6, time: 150, yield: [3, 5], lvl: 3, desc: "Se transforme en farine, puis en pain, puis en dette." },
    { id: 'piment', name: 'Piment', ing: 'piment', icon: '🌶️', color: '#e53935', seed: 10, time: 150, yield: [2, 3], lvl: 4, desc: "Vexé dès la naissance. Il se vengera en cuisine." },
    { id: 'algue', name: "Algue d'Élevage", ing: 'algue', icon: '🥬', color: '#26a69a', seed: 6, time: 150, yield: [3, 5], lvl: 4, wet: true, desc: "Adore la pluie. Pousse 1,5× plus vite quand il pleut." },
    { id: 'citronnier', name: 'Citronnier', ing: 'citron', icon: '🍋', color: '#ffeb3b', seed: 25, time: 240, yield: [2, 4], lvl: 5, desc: "Un arbre qui fait des grimaces. Il aime ça." },
    { id: 'gingembre', name: 'Gingembre', ing: 'gingembre', icon: '🫚', color: '#d4a85a', seed: 14, time: 180, yield: [2, 3], lvl: 5, desc: "Une racine nerveuse. Ne lui dis jamais de se calmer." },
    { id: 'riz', name: 'Riz de Paddy', ing: 'riz', icon: '🍚', color: '#fff8e1', seed: 12, time: 200, yield: [3, 5], lvl: 6, wet: true, desc: "Les pieds dans l'eau. Heureux sous la pluie." },
    { id: 'poule', name: 'Poule Pondeuse', ing: 'oeuf', icon: '🥚', color: '#fff3e0', seed: 30, time: 150, yield: [2, 4], lvl: 6, desc: "Pond des œufs. Pond aussi des commentaires." },
    { id: 'olivier', name: 'Olivier', ing: 'huile', icon: '🫒', color: '#8bc34a', seed: 35, time: 360, yield: [2, 3], lvl: 7, desc: "Lent, noble, rancunier. Une huile de caractère." },
    { id: 'champi', name: 'Champignons Pas Nets', ing: 'champi', icon: '🍄', color: '#b39ddb', seed: 40, time: 200, yield: [2, 3], lvl: 8, night: true, desc: "Poussent la nuit, deux fois plus vite. Ne pas se demander pourquoi." },
    { id: 'cannesucre', name: 'Canne à Sucre', ing: 'sucre', icon: '🍬', color: '#f8bbd0', seed: 28, time: 300, yield: [3, 5], lvl: 9, desc: "Du sucre qui pousse. La nature a de l'humour." },
    { id: 'cocotier', name: 'Cocotier', ing: 'coco', icon: '🥥', color: '#a1887f', seed: 45, time: 420, yield: [2, 3], lvl: 10, desc: "Attention aux chutes de noix. Casque conseillé." },
    { id: 'safran', name: 'Crocus à Safran', ing: 'safran', icon: '🌼', color: '#ffb300', seed: 120, time: 480, yield: [1, 2], lvl: 11, desc: "Chaque pistil est cueilli à la main. Chaque pistil coûte un rein." },
    { id: 'ruche', name: 'Ruche Orgueilleuse', ing: 'miel', icon: '🍯', color: '#ffc107', seed: 90, time: 400, yield: [2, 3], lvl: 12, desc: "Les abeilles travaillent dur. Toi, tu regardes. C'est le principe." },
    { id: 'truffier', name: 'Chêne à Truffes', ing: 'truffe', icon: '🖤', color: '#4e342e', seed: 400, time: 700, yield: [1, 1], lvl: 14, desc: "Il faut un cochon ou une loutre au nez fin. Tu as le nez fin." },
  ];
  D.farm = {
    plots: [{ cost: 40, lvl: 1 }, { cost: 90, lvl: 1 }, { cost: 180, lvl: 2 }, { cost: 350, lvl: 3 }, { cost: 700, lvl: 4 }, { cost: 1400, lvl: 6 }, { cost: 2800, lvl: 8 }, { cost: 5600, lvl: 10 }],
    cans: [
      { name: 'Arrosoir Percé', cost: 30, lvl: 1, dur: 90, desc: "Arrose le potager, la botte et ton pied. 90 s d'eau par plante." },
      { name: 'Arrosoir en Zinc', cost: 250, lvl: 4, dur: 180, desc: "Il tient l'eau, lui. 180 s d'eau par plante." },
      { name: 'Arrosage Automatique', cost: 1500, lvl: 8, dur: 360, desc: "Un tuyau et un rêve. 360 s d'eau par plante." },
      { name: "Irrigation de Loutre", cost: 9000, lvl: 12, dur: 900, desc: "Des canaux, des vannes, une mission. 900 s d'eau par plante." },
    ],
    tools: [
      { id: 'epouvantail', name: 'Épouvantail (à mouettes)', icon: '🧑‍🌾', cost: 400, lvl: 3, desc: "Protège les récoltes de Gégé la Mouette. Elle le trouve très beau, par ailleurs." },
      { id: 'serre', name: 'Serre Chauffée', icon: '🏡', cost: 2500, lvl: 6, desc: "Tout pousse 35 % plus vite. Le poisson, lui, regarde ça d'un œil jaloux." },
    ],
    levelCap: 15,
  };
  D.npcs.capucine = { name: 'Tata Capucine', role: 'Jardinière', icon: '🌱',
    lines: ["Une graine, c'est un poisson qui a choisi la terre. Moi j'ai choisi les deux.", "Arrose ! Une plante assoiffée est une plante qui te juge.", "Les poissons font le meilleur engrais. Surtout les chaussettes, étonnamment.", "Ça pousse, ça pousse… tout seul, mais avec ton amour. Et de l'eau."] };

  // ---------------------------------------------------------------- Bateaux et zones de pêche
  D.zones = [
    { id: 'rive', name: 'La Rive (ponton)', icon: '⚓', tier: 0, pos: [0, 0], wt: 1, rare: 1, normal: 1, desc: "Le ponton. Rassurant. Humide. Un classique." },
    { id: 'large', name: 'Le Large', icon: '🌊', tier: 1, pos: [1.5, -10], wt: 1.25, rare: 1.15, normal: 0.85, desc: "Loin de la rive, les poissons sont plus gros et moins polis." },
    { id: 'haute', name: 'La Haute Mer', icon: '🌅', tier: 2, pos: [4, -28], wt: 1.6, rare: 1.4, normal: 0.6, desc: "Plus de rive en vue. Ni de réseau. Ni de dignité." },
    { id: 'profond', name: 'Les Grands Fonds', icon: '🐙', tier: 3, pos: [-3, -50], wt: 2.1, rare: 1.8, normal: 0.4, desc: "L'eau y est sombre, dense et pleine de projets douteux." },
    { id: 'abysses', name: 'Les Abysses', icon: '🌑', tier: 4, pos: [2, -72], wt: 3.0, rare: 2.6, normal: 0.22, desc: "Le bout du bout. Les poissons y racontent des histoires qu'on ne peut pas répéter." },
  ];
  D.boats = [
    { id: 'bt1', name: 'Bateau Gonflable Licorne', size: 'Petit', tier: 1, cost: 8000, lvl: 8, desc: "Ça flotte. Ça brille. Ça couine. Accès : Le Large." },
    { id: 'bt2', name: 'Barque du Père Fouras', size: 'Moyen', tier: 2, cost: 30000, lvl: 12, desc: "En bois, solide, un peu moisie. Accès : La Haute Mer." },
    { id: 'bt3', name: 'Chaloupe à Moteur Capricieux', size: 'Grand', tier: 3, cost: 110000, lvl: 17, desc: "Un moteur qui démarre quand il veut. Accès : Les Grands Fonds." },
    { id: 'bt4', name: 'Chalutier Rose « Le Calamar Heureux »', size: 'Très grand', tier: 4, cost: 400000, lvl: 22, desc: "Rose, énorme, avec grue et filets. Accès : Les Abysses." },
  ];
  // espèces exclusives des zones (une par zone et par coin)
  const ZF = {
    s1: [
      ['grandeperche', 'Grande Perche des Roseaux', 'peu', [2, 6], 35, 1.2, '#7fd18b', 'm', 'saccade', "Elle a pris des muscles au large. Elle te salue d'une nageoire. Menaçante.", { zone: 'large' }],
      ['brochetfant', 'Brochet Fantôme du Nénuphar', 'rare', [5, 12], 70, 1.5, '#d7f0e0', 'm', 'farceur', "On ne le voit qu'à moitié. Il ne te voit qu'à moitié non plus. Respect mutuel.", { zone: 'haute' }],
      ['carpeancestrale', 'Carpe Ancestrale à Moustache', 'epique', [15, 40], 110, 1.7, '#e0b36a', 'f', 'lourd', "Elle était déjà là avant l'étang. Elle te juge sur ta canne.", { zone: 'profond' }],
      ['monstreetang', "Le Monstre de l'Étang de Tonton", 'legende', [60, 140], 380, 2.1, '#4db6ac', 'f', 'sprint', "Tonton Gérard jure l'avoir croisé en 1994. Il disait « un gros dentier ». C'était lui.", { zone: 'abysses' }],
    ],
    s2: [
      ['truitenostalgique', 'Truite Nostalgique', 'peu', [3, 9], 40, 1.3, '#b0bec5', 'm', 'fatigue', "Elle se souvient de l'eau d'avant. Elle était mieux, paraît-il.", { zone: 'large' }],
      ['silureremords', 'Silure du Remords', 'rare', [12, 35], 85, 1.6, '#607d8b', 'f', 'lourd', "Il traîne tout ce que tu n'aurais pas dû faire. C'est lourd.", { zone: 'haute' }],
      ['anguillelarmes', 'Anguille des Larmes Salées', 'epique', [6, 18], 160, 1.8, '#7e57c2', 'm', 'farceur', "Salée, mélancolique, électrique. Un trio rare.", { zone: 'profond' }],
      ['grosregret', 'Le Gros Regret', 'legende', [90, 200], 420, 2.2, '#37474f', 'f', 'lourd', "Tu n'aurais pas dû le pêcher. Mais tu l'as fait. Voilà, c'est toi.", { zone: 'abysses' }],
    ],
    s3: [
      ['saumonphilo', 'Saumon Philosophe', 'peu', [6, 18], 55, 1.3, '#ff8a65', 's', 'sprint', "Il remonte le courant en citant Camus. Il rate la moitié des mots.", { zone: 'large' }],
      ['esturgeonbavard', 'Esturgeon Bavard', 'rare', [30, 80], 130, 1.6, '#90a4ae', 'f', 'lourd', "Il parle de caviar sans arrêt. Le sien. C'est de moins en moins drôle.", { zone: 'haute' }],
      ['truitecathedrale', 'Truite Cathédrale', 'epique', [20, 60], 220, 1.9, '#80cbc4', 'm', 'saccade', "Immense, gothique, pleine d'échos. Elle chante le dimanche.", { zone: 'profond' }],
      ['fleuveluimeme', 'Le Fleuve Lui-Même', 'legende', [120, 280], 520, 2.3, '#4dd0e1', 'f', 'farceur', "Il s'est fait pêcher pour avoir une conversation. Ça risque d'être long.", { zone: 'abysses' }],
    ],
    s4: [
      ['thonframboise', 'Thon à la Framboise', 'peu', [25, 80], 70, 1.4, '#f06292', 'm', 'calme', "Rose, sucré, un peu collant. Il s'excuse de tout.", { zone: 'large' }],
      ['requingelifie', 'Requin Gélifié', 'rare', [80, 220], 160, 1.8, '#ce93d8', 'm', 'sprint', "Il tremble, il mord, il tremble. Une expérience éprouvante.", { zone: 'haute' }],
      ['baleineconfiture', 'Baleine Confiture', 'epique', [150, 400], 280, 2.0, '#e91e63', 'f', 'lourd', "Elle étale sa bonne humeur. Sur ton pont. Partout.", { zone: 'profond' }],
      ['krakenframboise', 'Le Kraken Framboise', 'legende', [300, 700], 640, 2.4, '#ad1457', 'f', 'farceur', "Huit tentacules, huit parfums. Il propose une dégustation.", { zone: 'abysses' }],
    ],
    s5: [
      ['meduse_gal', 'Méduse Galactique', 'peu', [80, 250], 140, 1.6, '#80deea', 's', 'farceur', "Elle contient une galaxie. Elle est timide.", { zone: 'large' }],
      ['poulpenebu', 'Poulpe Nébuleuse', 'rare', [200, 600], 320, 1.9, '#9575cd', 'm', 'saccade', "Huit bras, huit constellations. Il tricote un pull cosmique.", { zone: 'haute' }],
      ['raietrou', 'Raie Trou-de-Ver', 'epique', [400, 1100], 480, 2.1, '#5c6bc0', 'f', 'lourd', "Elle va d'ici à là-bas. Sans passer par ailleurs.", { zone: 'profond' }],
      ['leviathanlacte', 'Le Léviathan Lacté', 'legende', [900, 1900], 1100, 2.5, '#fff59d', 'f', 'sprint', "Il fait la taille d'une voie lactée. Une demi. Il a mangé le reste.", { zone: 'abysses' }],
    ],
  };
  D.spots.forEach((sp) => (ZF[sp.id] || []).forEach((f) => sp.fish.push(f)));

  // ---------------------------------------------------------------- Répliques supplémentaires
  Object.assign(D.quips, {
    needTech: ["Tu ne maîtrises pas toutes les techniques de cette recette. Chef Gaston t'attend (🧺 Marché → Techniques).", "Il te manque une technique. La cuisine, ça s'apprend. Un peu. Beaucoup. Passionnément."],
    techLearn: ["Technique acquise ! Tu hoches la tête comme si tu l'avais toujours su.", "Appris ! Chef Gaston se frotte les mains. Elles sentent le beurre."],
    techNeeds: ["Il te manque un ustensile ou un niveau pour apprendre ça."],
    ordersNew: ["De nouvelles commandes arrivent ! Les clients font la queue (de poisson).", "Le tableau a été mis à jour. Il sent le papier neuf."],
    ordersExpire: ["Une commande a expiré. Le client a trouvé un autre poisson. Ou une autre vie.", "Un client s'est lassé d'attendre et a pris des pâtes."],
    ordersWait: ["Les clients ont besoin de temps pour changer d'avis. Reviens dans un instant."],
    farm: ["Ça sent la terre humide. Et la réussite.", "Ton potager est le plus beau de l'étang. Il est aussi le seul."],
    farmReady: ["Une plante est prête à être récoltée !", "Ding ! Le potager te fait signe."],
    gullCrop: ["Gégé la Mouette a volé une récolte ! Un épouvantail, ça se achète, ça.", "Une mouette a pillé ton potager. Elle ne s'excuse pas."],
    boatBuy: ["Un bateau ! Plus gros, plus beau, plus cher. L'aventure commence au large.", "Tu as un bateau. Tu as aussi une dette. Mais tu as un bateau."],
    zoneGo: ["Cap sur le large. Roger a le mal de mer. Il n'a pas d'estomac, mais il fait semblant.", "La rive disparaît. Le courage aussi, un peu."],
    zoneBack: ["Retour au ponton. Les planches sont toujours là. Elles ont attendu."],
    needBoat: ["Il te faut un bateau plus grand pour aller là-bas. Jean-Michmich en vend (🛒 → Bateaux)."],
    saved: ["Partie sauvegardée. Roger ne l'oubliera pas.", "Sauvegarde faite. Ton avenir est entre de bonnes pattes."],
  });

  // ---------------------------------------------------------------- Succès supplémentaires
  D.achievements.push(
    { id: 'a_tech5', name: 'Cuisinier·ère Complet·e', desc: 'Apprendre 5 techniques de cuisine', reward: 1500, check: (S) => S.techs.length >= 5 },
    { id: 'a_farm1', name: 'Pouce Vert', desc: 'Faire une récolte', reward: 150, check: (S) => (S.stats.harvest || 0) >= 1 },
    { id: 'a_farm50', name: 'Fermière de Choc', desc: 'Faire 50 récoltes', reward: 2500, check: (S) => (S.stats.harvest || 0) >= 50 },
    { id: 'a_farmlvl', name: 'Maîtresse Jardinière', desc: 'Atteindre le niveau 8 de potager', reward: 3000, check: (S) => S.farm.lvl >= 8 },
    { id: 'a_boat', name: 'Loutre de Mer, Vraiment', desc: 'Acheter un premier bateau', reward: 500, check: (S) => S.boats.length >= 1 },
    { id: 'a_haute', name: 'Plus de Terre en Vue', desc: 'Pêcher en Haute Mer', reward: 2500, check: (S) => (S.stats.zoneCatch && S.stats.zoneCatch.haute) >= 1 },
    { id: 'a_abysses', name: 'Au Fond du Trou', desc: 'Pêcher dans les Abysses', reward: 20000, check: (S) => (S.stats.zoneCatch && S.stats.zoneCatch.abysses) >= 1 },
    { id: 'a_slot', name: 'Prévoyant·e', desc: 'Sauvegarder dans un emplacement', reward: 100, check: (S) => (S.stats.manualSaves || 0) >= 1 },
  );
})();
