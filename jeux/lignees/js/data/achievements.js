// Succès de la Chronique : défis permanents (d'une partie à l'autre), récompensés en héritage.
// check(run, meta) est évalué régulièrement pendant la partie.
G.ACHIEVEMENTS = {
  moyen_age:   { icon: '🏰', name: 'Les pierres et le fer', desc: 'Atteindre le Moyen Âge.', reward: 5, check: run => run.era >= 2 },
  industrie:   { icon: '🏭', name: 'Vapeur et acier', desc: 'Atteindre l\'ère industrielle.', reward: 10, check: run => run.era >= 3 },
  spatial:     { icon: '🛰️', name: 'La tête dans les étoiles', desc: 'Atteindre l\'ère spatiale.', reward: 15, check: run => run.era >= 4 },
  decollage:   { icon: '🚀', name: 'Adieu, planète', desc: 'Lancer le vaisseau interstellaire.', reward: 40, check: run => !!run.launched },
  rares:       { icon: '💎', name: 'Chercheur de trésors', desc: 'Extraire les trois ressources rares (marbre, or, gemmes) dans une même partie.', reward: 10, check: run => ['marbre', 'or', 'gemmes'].every(r => (run.prodTotal || {})[r] > 0) },
  sans_entrepot: { icon: '🎒', name: 'Tout dans les poches', desc: 'Atteindre le Moyen Âge sans avoir construit d\'entrepôt.', reward: 10, check: run => run.era >= 2 && !run.stats.builtWarehouse },
  niveau5:     { icon: '⭐', name: 'Chef-d\'œuvre', desc: 'Monter un bâtiment au niveau 5.', reward: 8, check: run => run.buildings.some(b => (b.level || 1) >= 5) },
  dix_niveau4: { icon: '🌟', name: 'Ville dense', desc: 'Avoir 10 bâtiments de niveau 4 ou plus.', reward: 10, check: run => run.buildings.filter(b => (b.level || 1) >= 4).length >= 10 },
  routes:      { icon: '🛤️', name: 'Tous les chemins…', desc: 'Poser 50 routes.', reward: 5, check: run => run.buildings.filter(b => G.BUILDINGS[b.type].road).length >= 50 },
  contrats:    { icon: '📜', name: 'Homme de parole', desc: 'Remplir 10 contrats dans une même partie.', reward: 10, check: run => (run.stats.contracts || 0) >= 10 },
  merveille:   { icon: '🏛️', name: 'Pour la postérité', desc: 'Achever une merveille.', reward: 8, check: run => run.buildings.some(b => G.BUILDINGS[b.type].wonder && b.done) },
  merveilles3: { icon: '🏆', name: 'Les trois merveilles', desc: 'Achever les trois merveilles dans une même partie.', reward: 25, check: run => run.buildings.filter(b => G.BUILDINGS[b.type].wonder && b.done).length >= 3 },
  heureux:     { icon: '😄', name: 'Peuple comblé', desc: 'Atteindre 90 % de bonheur avec au moins 200 habitants.', reward: 8, check: () => (G.stats.happiness || 0) >= 0.9 && (G.stats.pop || 0) >= 200 },
  pop500:      { icon: '👥', name: 'Métropole', desc: 'Atteindre 500 habitants.', reward: 10, check: () => (G.stats.pop || 0) >= 500 },
  vagues20:    { icon: '🛡️', name: 'Rempart vivant', desc: 'Repousser 20 vagues dans une même partie.', reward: 12, check: run => run.stats.wavesWon >= 20 },
  chef:        { icon: '👑', name: 'Tombeur de chefs', desc: 'Repousser une vague menée par un chef.', reward: 5, check: run => run.stats.wavesWon >= G.WAVES.bossEvery },
  marchand:    { icon: '🏪', name: 'Sens des affaires', desc: 'Conclure 10 échanges au marché dans une même partie.', reward: 5, check: run => (run.stats.trades || 0) >= 10 },
  butin:       { icon: '💰', name: 'Rends-moi ça !', desc: 'Récupérer un butin en abattant un voleur.', reward: 5, check: run => (run.stats.recovered || 0) >= 1 },
  horloge:     { icon: '🕰️', name: 'Maître du temps', desc: 'Débloquer la vitesse ×10.', reward: 8, check: () => G.logic.maxSpeed() >= 10 },
};
