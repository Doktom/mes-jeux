// Moteur économique : population, main-d'œuvre, énergie et production.
//
// Modèle : chaque bâtiment a une efficacité de base = main-d'œuvre × énergie × intrants.
// Les intrants sont pris dans le stock d'entrée du bâtiment, rempli par les porteurs (voir
// logistics.js) ; la production s'accumule dans son stock de sortie. Les bonus (voisinage,
// technologies, décrets…) multiplient uniquement la production. Optimiser = produire plus avec autant.
G.economy = (function () {
  const W = () => G.map.W;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // ---------- Grille et voisinage ----------
  function rebuildGrid() {
    G.grid = new Array(G.map.W * G.map.H).fill(null);
    G.run.buildings.forEach(b => (G.grid[b.y * W() + b.x] = b));
    // Bâtiments de plus d'une case (pas de tir 2×2) : les cases voisines pointent vers eux, sans écraser un autre bâtiment.
    G.run.buildings.forEach(b => {
      const n = G.BUILDINGS[b.type].size || 1;
      for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) {
        const i = (b.y + dy) * W() + b.x + dx;
        if ((dx || dy) && b.x + dx < W() && b.y + dy < G.map.H && !G.grid[i]) G.grid[i] = b;
      }
    });
    G.adjDirty = true;
    G.buildVer = (G.buildVer || 0) + 1; // réseaux électriques à recalculer
    // Les chemins des porteurs ne dépendent que des routes : on ne les invalide que si elles changent.
    const roads = G.run.buildings.filter(b => G.BUILDINGS[b.type].road && !b.ruined).map(b => b.bid).join(',');
    if (roads !== G.roadKey) { G.roadKey = roads; G.gridVer = (G.gridVer || 0) + 1; }
  }

  function at(x, y) {
    if (x < 0 || y < 0 || x >= G.map.W || y >= G.map.H) return null;
    return G.grid[y * W() + x];
  }

  function terrainAt(x, y) {
    if (x < 0 || y < 0 || x >= G.map.W || y >= G.map.H) return null;
    return G.visibleTerrain(G.run.tiles[y * W() + x], G.run.era);
  }

  // Détail du voisinage d'un type de bâtiment posé en (x, y). Sert aussi à l'aperçu de placement.
  function adjacency(type, x, y) {
    const def = G.BUILDINGS[type];
    const parts = [];
    let total = 0;
    const tb = def.terrainBonus && def.terrainBonus[terrainAt(x, y)];
    if (tb) { total += tb; parts.push({ x, y, v: tb, label: G.TERRAIN[terrainAt(x, y)].name }); }
    if (!def.adj) return { total, parts };
    const posMult = 1 + G.M.adj;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      const nb = at(nx, ny);
      const nt = terrainAt(nx, ny);
      if (nt === null) continue;
      for (const rule of def.adj) {
        let match = false;
        if (rule.b) match = nb && !nb.ruined && nb.type === rule.b;
        else if (rule.tag) match = nb && !nb.ruined && (G.BUILDINGS[nb.type].tags || []).includes(rule.tag);
        else if (rule.t) match = !nb && nt === rule.t;
        if (match) {
          const v = rule.v > 0 ? rule.v * posMult : rule.v;
          total += v;
          parts.push({ x: nx, y: ny, v });
        }
      }
    }
    return { total, parts };
  }

  function refreshAdjacency() {
    G.run.buildings.forEach(b => (b._adj = adjacency(b.type, b.x, b.y).total));
    G.adjDirty = false;
  }

  // ---------- Maîtrise (héritage) ----------
  // Multiplicateur permanent d'un type de bâtiment : niveau n → production et stocks ×n.
  function mastery(type) { return (G.meta && G.meta.mastery && G.meta.mastery[type]) || 1; }

  // ---------- Niveaux ----------
  // Multiplicateurs liés au niveau d'un bâtiment (voir G.LEVELS).
  function lv(b) {
    const n = (b.level || 1) - 1, K = G.LEVELS;
    return {
      io: 1 + K.io * n, work: 1 + K.work * n, pop: 1 + K.pop * n, tower: 1 + K.tower * n, store: 1 + K.store * n,
      hp: 1 + (G.BUILDINGS[b.type].wall ? K.wallHp : K.hp) * n,
    };
  }

  // ---------- Recettes ----------
  // Définition effective d'un bâtiment : la recette choisie remplace ses intrants et ses produits.
  const defCache = {};
  function def(b) {
    const d = G.BUILDINGS[b.type];
    if (!d.recipes) return d;
    const i = Math.min(b.recipe || 0, d.recipes.length - 1), key = b.type + ':' + i;
    return defCache[key] || (defCache[key] = Object.assign({}, d, { in: d.recipes[i].in, out: d.recipes[i].out, recipeName: d.recipes[i].name }));
  }

  // ---------- Saisons ----------
  function season() {
    const S = G.SEASONS;
    return S.list[Math.floor(((G.run && G.run.time) || 0) / S.length) % S.list.length];
  }
  function seasonIndex() { return Math.floor(((G.run && G.run.time) || 0) / G.SEASONS.length) % G.SEASONS.list.length; }

  // ---------- Stocks locaux ----------
  function stock(b, key) { return b[key] || (b[key] = {}); }

  // Besoins vitaux d'un logement (par seconde) : ses besoins, plus le bois de chauffage en hiver.
  function survival(b) {
    const d = G.BUILDINGS[b.type], out = {};
    if (!d.consume) return out;
    const k = lv(b).pop;
    for (const r in d.consume) out[r] = d.consume[r] * k * (1 + G.M.consume);
    const heat = season().heating;
    if (heat) out.bois = (out.bois || 0) + heat * k;
    return out;
  }

  // Confort d'un logement : biens facultatifs qui rendent les habitants heureux.
  function comfort(b) {
    const d = G.BUILDINGS[b.type], out = {};
    if (d.comfort) for (const r in d.comfort) out[r] = d.comfort[r] * lv(b).pop;
    return out;
  }

  // Besoins par seconde d'un bâtiment à pleine efficacité : intrants, besoins et confort des habitants, armes des tours.
  function needs(b) {
    const d = def(b), k = lv(b), n = {};
    // Chantier de merveille : il réclame ce qui manque encore (40 au plus par livraison en attente).
    if (d.wonder) {
      if (b.done) return n;
      for (const r in d.wonder.cost) {
        const rem = d.wonder.cost[r] - ((b.progress && b.progress[r]) || 0);
        if (rem > 0.01) n[r] = Math.min(rem, 40) / G.LOGI.inBuffer;
      }
      return n;
    }
    if (d.in) for (const r in d.in) n[r] = d.in[r] * k.io;
    if (d.consume) {
      const sv = survival(b), cf = comfort(b);
      for (const r in sv) n[r] = (n[r] || 0) + sv[r];
      for (const r in cf) n[r] = (n[r] || 0) + cf[r];
    }
    if (d.boost) n[d.boost.res] = (n[d.boost.res] || 0) + d.boost.rate * k.tower;
    return n;
  }

  function inCap(b, r) {
    const n = needs(b)[r] || 0;
    return n > 0 ? Math.max(3, n * G.LOGI.inBuffer * mastery(b.type)) : 0;
  }

  function outCap(b, d, r) {
    const dd = def(b);
    return Math.max(10, ((dd.out && dd.out[r]) || 0) * lv(b).io * (b._mult || 1) * G.LOGI.outBuffer);  // _mult inclut la maîtrise
  }

  // ---------- Tick ----------
  // dt en secondes ; outMult réduit la production (hors ligne).
  function tick(dt, outMult) {
    outMult = outMult || 1;
    const run = G.run, M = G.M;
    if (G.adjDirty) refreshAdjacency();
    const delta = G.delta || (G.delta = {});
    const now = run.lt = (run.lt || 0) + dt; // horloge logistique (temps de jeu)
    G.logistics.arrive(now);

    const active = run.buildings.filter(b => !b.ruined && !b.paused);

    // 1. Logements : les besoins sont pris dans le stock d'entrée, livré par les porteurs.
    let pop = 0, popMax = 0;
    run.buildings.forEach(b => (b._pop = 0));
    let comfortSum = 0, comfortW = 0;
    active.filter(b => G.BUILDINGS[b.type].consume).forEach(b => {
      const d = G.BUILDINGS[b.type], k = lv(b).pop, inp = stock(b, 'inp');
      let s = 1, cs = 1;
      const sv = survival(b), cf = comfort(b);
      for (const r in sv) {
        const want = sv[r] * dt;
        const used = Math.min(inp[r] || 0, want);
        inp[r] = (inp[r] || 0) - used; delta[r] = (delta[r] || 0) - used;
        if (want > 0) s = Math.min(s, used / want);
      }
      for (const r in cf) {
        const want = cf[r] * dt;
        const used = Math.min(inp[r] || 0, want);
        inp[r] = (inp[r] || 0) - used; delta[r] = (delta[r] || 0) - used;
        if (want > 0) cs = Math.min(cs, used / want);
      }
      // Satisfaction et confort lissés : les livraisons arrivent par paquets.
      b._sat = b._sat === undefined ? s : b._sat + (s - b._sat) * Math.min(1, dt / 3);
      if (Object.keys(cf).length) b._comfort = b._comfort === undefined ? cs : b._comfort + (cs - b._comfort) * Math.min(1, dt / 5);
      const base = (d.pop + (M.popFlat[b.type] || 0)) * k * mastery(b.type) * Math.max(0.2, 1 + M.pop + (b._adj || 0));
      b._pop = base * (0.25 + 0.75 * b._sat); // un logement mal approvisionné garde un quart de ses habitants
      pop += b._pop; popMax += base;
      if (b._comfort !== undefined) { comfortSum += b._comfort * base; comfortW += base; }
    });
    // Chantiers de merveilles : les matériaux livrés rejoignent l'ouvrage.
    run.buildings.forEach(b => {
      const w = G.BUILDINGS[b.type].wonder;
      if (!w || b.done || b.ruined || !b.inp) return;
      const pr = b.progress || (b.progress = {});
      for (const r in b.inp) {
        const room = Math.max(0, (w.cost[r] || 0) - (pr[r] || 0)), used = Math.min(room, b.inp[r]);
        pr[r] = (pr[r] || 0) + used;
        if (b.inp[r] - used > 0.01) G.logistics.add(r, b.inp[r] - used, b); // surplus rendu aux réserves
        b.inp[r] = 0;
      }
      if (Object.keys(w.cost).every(r => (pr[r] || 0) >= w.cost[r] - 0.01)) {
        b.done = true;
        G.logic.recomputeMods();
        G.render && G.render.puff(b.x, b.y, true);
        G.ui && G.ui.toast('🏆 Merveille achevée : ' + G.BUILDINGS[b.type].name + ' — ' + w.bonus, 'good');
        G.logic.gainGlory(G.GLORY.wonder, 'merveille achevée');
        G.lore && G.lore.say('wonder', { name: G.BUILDINGS[b.type].name });
      }
    });

    // Bonheur : confort moyen pondéré par la population ; il dope toute la production.
    const happiness = comfortW > 0 ? comfortSum / comfortW : 0;
    const forum = run.buildings[0];
    if (!forum.ruined) { const fp = G.BUILDINGS.forum.pop * lv(forum).pop; forum._pop = fp; pop += fp; popMax += fp; }

    // 2. Main-d'œuvre.
    const workers = active.filter(b => G.BUILDINGS[b.type].workers);
    let jobs = 0;
    workers.forEach(b => (jobs += G.BUILDINGS[b.type].workers * lv(b).work));
    const workRatio = jobs > 0 ? Math.min(1, pop / jobs) : 1;

    // 3. Énergie : chaque réseau électrique (centrales et relais qui se touchent) répartit sa production
    // entre les consommateurs qui le touchent. Les centrales ne tournent qu'à hauteur de la demande.
    const grid = G.power.networks(), netOf = grid.netOf;
    const netNeed = {}, netCap = {}, netProd = {};
    let energyProd = 0, energyNeed = 0, unpowered = 0;
    workers.forEach(b => {
      const d = G.BUILDINGS[b.type];
      if (!d.energyIn) return;
      const need = d.energyIn * lv(b).io;
      energyNeed += need;
      const id = netOf[b.bid];
      if (id === undefined) { unpowered++; return; }
      netNeed[id] = (netNeed[id] || 0) + need;
    });
    run.buildings.forEach(b => {
      const d = G.BUILDINGS[b.type];
      if (!d.energyOut || b.ruined || b.paused) return;
      const id = netOf[b.bid];
      netCap[id] = (netCap[id] || 0) + d.energyOut * lv(b).io * (b._mult || 1) * G.power.weather(d);
    });
    // Part de sa capacité qu'une centrale doit fournir (0 = veille, rien à alimenter).
    const throttle = b => { const id = netOf[b.bid]; return netCap[id] > 0 ? Math.min(1, (netNeed[id] || 0) / netCap[id]) : 0; };
    const powerRatio = b => {
      const id = netOf[b.bid];
      if (id === undefined) return 0;
      return netNeed[id] > 0 ? Math.min(1, (netProd[id] || 0) / netNeed[id]) : 1;
    };

    // 4. Production. Les centrales passent en premier pour que l'énergie soit disponible.
    const producers = run.buildings.filter(b => {
      const d = def(b);
      return d.in || d.out || d.energyOut || d.tower;
    });
    producers.sort((a, b) => (G.BUILDINGS[b.type].energyOut ? 1 : 0) - (G.BUILDINGS[a.type].energyOut ? 1 : 0));

    function runGroup(group, energyRatio) {
      group.forEach(b => {
        const d = def(b), k = lv(b);
        const inp = d.in || d.boost ? stock(b, 'inp') : null;
        const out = d.out ? stock(b, 'out') : null;
        b._missing = null; b._full = false; b._boosted = false;

        let base = baseEff(b, d, workRatio, energyRatio(b));
        if (d.energyOut) { b._throttle = throttle(b); base *= b._throttle; }
        // Mine : son gisement doit encore exister.
        const dep = depositOf(b);
        b._depleted = dep === false;
        if (b._depleted) base = 0;
        if (out) for (const r in d.out) if (!G.RESOURCES[r].uncapped && (out[r] || 0) >= outCap(b, d, r) - 1e-6) { b._full = true; base = 0; }

        // Intrants : le plus rare dans le stock d'entrée limite l'efficacité.
        let f = 1;
        if (d.in && base > 0) for (const r in d.in) {
          const wanted = d.in[r] * k.io * base * dt;
          const ratio = wanted > 0 ? Math.min(1, (inp[r] || 0) / wanted) : 1;
          if (ratio < f) { f = ratio; b._missing = ratio < 0.99 ? r : null; }
        }
        const eff = base * f;
        b._eff = eff;
        if (d.in && eff > 0) for (const r in d.in) {
          const used = Math.min(inp[r] || 0, d.in[r] * k.io * eff * dt);
          inp[r] = (inp[r] || 0) - used; delta[r] = (delta[r] || 0) - used;
        }

        const mult = G.mods.prodMult(M, b.type) * mastery(b.type) * Math.max(0.1, 1 + (b._adj || 0)) * (1 + G.HAPPINESS.prod * happiness) * outMult;
        b._mult = mult;
        if (out && eff > 0) for (const r in d.out) {
          const amt = d.out[r] * k.io * eff * mult * dt;
          // Le savoir n'est pas transporté : il rejoint directement le savoir commun.
          const pt = run.prodTotal || (run.prodTotal = {});
          if (G.RESOURCES[r].uncapped) { run.res[r] += amt; delta[r] = (delta[r] || 0) + amt; run.stats.produced += amt; pt[r] = (pt[r] || 0) + amt; continue; }
          const added = Math.min(amt, outCap(b, d, r) - (out[r] || 0));
          out[r] = (out[r] || 0) + added;
          pt[r] = (pt[r] || 0) + added;
          if (dep !== null && dep !== false) deplete(b, dep, added);
          delta[r] = (delta[r] || 0) + added;
          run.stats.produced += added;
        }
        if (d.energyOut) {
          const e = d.energyOut * k.io * eff * mult * G.power.weather(d);
          b._eout = e;
          energyProd += e;
          const id = netOf[b.bid];
          if (id !== undefined) netProd[id] = (netProd[id] || 0) + e;
        }

        // Intrant optionnel (armes des tours), livré dans le stock d'entrée.
        const boostUse = d.boost ? d.boost.rate * k.tower * dt : 0;
        if (d.boost && eff > 0 && (inp[d.boost.res] || 0) >= boostUse) {
          inp[d.boost.res] -= boostUse;
          delta[d.boost.res] = (delta[d.boost.res] || 0) - boostUse;
          b._boosted = true;
        }
      });
    }

    const plants = producers.filter(b => G.BUILDINGS[b.type].energyOut);
    const others = producers.filter(b => !G.BUILDINGS[b.type].energyOut);
    runGroup(plants, () => 1);
    runGroup(others, powerRatio);
    run.buildings.forEach(b => { if (G.BUILDINGS[b.type].energyIn) b._power = powerRatio(b); });
    powerAlerts();
    const energyRatio = energyNeed > 0 ? Math.min(1, energyProd / energyNeed) : 1;

    // 5. Transport : départs des cellules, puis totaux affichés.
    G.logistics.dispatch(now);
    G.logistics.recount();

    // 6. Régénération des bâtiments endommagés hors combat.
    if (!run.wave.active) run.buildings.forEach(b => {
      if (b.ruined) return;
      const max = maxHp(b);
      if (b.hp < max) b.hp = Math.min(max, b.hp + max * 0.02 * dt);
    });

    G.stats = { pop, popMax, jobs, workRatio, energyProd, energyNeed, energyRatio, unpowered, networks: grid.count, happiness, hasComfort: comfortW > 0 };
  }

  // ---------- Gisements épuisables ----------
  // Renvoie l'index de la case exploitée par une mine (null si ce n'est pas une mine, false si épuisée).
  function depositOf(b) {
    const d = G.BUILDINGS[b.type];
    if (!d.terrain || !d.terrain[0].startsWith('g_')) return null;
    const i = b.y * W() + b.x;
    if (G.run.tiles[i] !== d.terrain[0]) return false;
    const deps = G.run.deposits || (G.run.deposits = {});
    if (deps[i] === undefined) deps[i] = (G.DEPOSITS[d.terrain[0]] || 2000) * (1 + 0.25 * ((G.meta.levels || {}).h_gisements || 0));
    return i;
  }

  function deplete(b, i, amount) {
    if (G.DEPOSITS_INFINITE) return; // gisements inépuisables
    const deps = G.run.deposits;
    deps[i] -= amount;
    if (deps[i] > 0) {
      const max = G.DEPOSITS[G.run.tiles[i]] || 2000;
      if (deps[i] < max * 0.15 && !b._warnedLow) { b._warnedLow = true; G.lore && G.lore.say('depleting', { building: G.BUILDINGS[b.type].name.toLowerCase() }); }
      return;
    }
    // Épuisé : la case redevient une simple colline.
    G.run.tiles[i] = 'colline';
    G.terrainVer = (G.terrainVer || 0) + 1;
    G.ui && G.ui.toast('⛏️ Gisement épuisé : ' + G.BUILDINGS[b.type].name + ' à l\'arrêt. Cherchez un nouveau filon !', 'warn');
  }

  function baseEff(b, d, workRatio, energyRatio) {
    if (b.ruined || b.paused) return 0;
    let e = 1;
    if (d.workers) e *= workRatio;
    if (d.energyIn) e *= energyRatio;
    return e;
  }

  function maxHp(b) { return G.BUILDINGS[b.type].hp * (1 + G.M.hp) * lv(b).hp; }

  // Alerte : bâtiments qui ont besoin d'électricité et n'en reçoivent pas (hors réseau ou réseau à plat) depuis quelques secondes.
  function powerAlerts() {
    if (G.botSim || G.offlineSim || !G.ui) return;
    const run = G.run;
    let st = G.pwAlert;
    if (!st || st.seed !== run.seed) st = G.pwAlert = { seed: run.seed, since: {}, notified: {}, last: -999 };
    const bad = [], netOf = G.power.networks().netOf;
    run.buildings.forEach(b => {
      const none = G.BUILDINGS[b.type].energyIn && !b.paused && !b.ruined && (netOf[b.bid] === undefined || (b._power !== undefined && b._power < 0.05));
      if (!none) { delete st.since[b.bid]; delete st.notified[b.bid]; return; }
      if (st.since[b.bid] === undefined) st.since[b.bid] = run.time;
      if (run.time - st.since[b.bid] > 6 && !st.notified[b.bid]) bad.push(b);
    });
    if (!bad.length || run.time - st.last < 25) return;
    const count = {};
    bad.forEach(b => { const n = G.BUILDINGS[b.type].name; count[n] = (count[n] || 0) + 1; st.notified[b.bid] = true; });
    st.last = run.time;
    G.ui.toast('🔌 Sans électricité : ' + Object.keys(count).map(n => n + (count[n] > 1 ? ' ×' + count[n] : '')).join(', ') + '. Posez-les au contact d\'une centrale ou d\'un relais, ou produisez plus d\'énergie.', 'warn');
  }

  // Taux nets lissés, mis à jour chaque seconde.
  function sampleRates(window) {
    G.rates = G.rates || {};
    const d = G.delta || {};
    G.RESOURCE_ORDER.forEach(r => {
      const v = (d[r] || 0) / window;
      G.rates[r] = G.rates[r] === undefined ? v : G.rates[r] * 0.5 + v * 0.5;
    });
    G.delta = {};
  }

  // Raccourcis vers la logistique (les stocks sont répartis dans les bâtiments).
  function add(r, amount, near) { return G.logistics.add(r, amount, near); }
  function capOf(r) { return G.logistics.capOf(r); }

  return { rebuildGrid, at, terrainAt, adjacency, refreshAdjacency, tick, maxHp, sampleRates, add, capOf, needs, survival, comfort, inCap, outCap, lv, stock, def, season, seasonIndex, depositOf, mastery, DIRS };
})();
