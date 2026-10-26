// Agrégation de tous les modificateurs actifs (technologies, décrets, origine,
// héritage, difficulté) en un seul objet consulté par l'économie et la défense.
G.mods = (function () {
  function empty() {
    return {
      prod: {}, popFlat: {}, unlocks: new Set(),
      cost: 0, tile: 0, adj: 0, towerDmg: 0, towerRate: 0, hp: 0, pop: 0, consume: 0,
      storage: 0, waveCount: 0, waveHp: 0, loot: 0, repair: 0, offline: 0, start: 0, waveInterval: 0, logi: 0,
    };
  }

  function apply(m, effects, times) {
    times = times || 1;
    for (const e of effects) {
      if (e.t === 'unlock') m.unlocks.add(e.b);
      else if (e.t === 'prod') m.prod[e.target] = (m.prod[e.target] || 0) + e.v * times;
      else if (e.t === 'popFlat') m.popFlat[e.target] = (m.popFlat[e.target] || 0) + e.v * times;
      else m[e.t] = (m[e.t] || 0) + e.v * times;
    }
  }

  function compute(run, meta) {
    const m = empty();
    for (const id in run.techs) apply(m, G.TECHS[id].effects, run.techs[id]);
    run.decrees.forEach(id => apply(m, G.DECREES_MAJOR[id].effects));
    run.minors.forEach(id => apply(m, G.DECREES_MINOR[id].effects));
    apply(m, G.ORIGINS[run.origin].effects);
    (run.timed || []).forEach(t => apply(m, t.effects)); // effets temporaires (événements)
    (run.buildings || []).forEach(b => { const w = G.BUILDINGS[b.type].wonder; if (w && b.done && !b.ruined) apply(m, w.effects); }); // merveilles
    // Saison en cours.
    if (G.SEASONS && run.time !== undefined) {
      const s = G.SEASONS.list[Math.floor(run.time / G.SEASONS.length) % G.SEASONS.list.length];
      if (s.food) m.prod['cat:food'] = (m.prod['cat:food'] || 0) + s.food;
      if (s.fish) m.prod.peche = (m.prod.peche || 0) + s.fish;
    }
    for (const id in meta.levels) {
      const lvl = meta.levels[id];
      if (lvl > 0) apply(m, G.HERITAGE[id].effect(lvl));
    }
    const rig = G.RIGUEUR[run.rigueur];
    m.waveHp += rig.waveHp || 0; m.waveCount += rig.waveCount || 0;
    m.start += rig.start || 0; m.waveInterval += rig.waveInterval || 0; m.offline += rig.offline || 0;
    return m;
  }

  // Multiplicateur de production d'un type de bâtiment (hors voisinage).
  function prodMult(m, type) {
    const def = G.BUILDINGS[type];
    let s = 1 + (m.prod.all || 0) + (m.prod['cat:' + def.cat] || 0) + (m.prod[type] || 0);
    if (def.out) for (const r in def.out) s += m.prod['res:' + r] || 0;
    return Math.max(0.1, s);
  }

  return { compute, prodMult };
})();
