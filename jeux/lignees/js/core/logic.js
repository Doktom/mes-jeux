// Actions du joueur et règles de progression : construction, expansion, recherche,
// décrets, changement d'ère, fin de partie et héritage.
G.logic = (function () {
  const B = G.BUILDINGS;

  function recomputeMods() {
    G.M = G.mods.compute(G.run, G.meta);
    G.adjDirty = true;
  }

  // ---------- Coûts ----------
  function countOf(type) { return G.run.buildings.filter(b => b.type === type).length; }

  function scaleCost(cost, mult) {
    const out = {};
    for (const r in cost) out[r] = Math.ceil(cost[r] * mult);
    return out;
  }

  function buildCost(type) {
    // Les routes ne renchérissent pas : on en pose beaucoup.
    const mult = (B[type].road || B[type].relay ? 1 : Math.pow(G.COST_GROWTH, countOf(type))) * Math.max(0.2, 1 + G.M.cost);
    return scaleCost(B[type].cost || {}, mult);
  }

  function canAfford(cost) {
    for (const r in cost) if ((G.run.res[r] || 0) < cost[r]) return false;
    return true;
  }

  // Paiement prélevé dans les stocks les plus proches du chantier (site : {x, y}).
  function pay(cost, site) { G.logistics.take(cost, site || G.run.buildings[0]); }

  function tileCost() {
    const n = G.run.tilesBought;
    const m = Math.pow(1.085, n) * Math.max(0.2, 1 + G.M.tile);
    const c = { bois: 12 * m, pierre: 6 * m };
    if (G.run.era >= 2) c.planches = 4 * m;
    // Outils (toujours abondants) plutôt qu'acier ou alliages : sinon on ne peut pas s'agrandir pour construire
    // les hauts fourneaux qui fabriquent justement l'acier.
    if (G.run.era >= 3) c.outils = 2 * m;
    return scaleCost(c, 1);
  }

  // ---------- Déblocages ----------
  function isUnlocked(type) {
    const d = B[type];
    if (d.special) return false;
    if (d.era > G.run.era) return false;
    if (!d.tech) return true;
    return G.M.unlocks.has(type);
  }

  // ---------- Placement ----------
  // Cases occupées par un bâtiment posé en (x, y) : une seule, ou n×n pour les grands (pas de tir).
  function footprint(type, x, y) {
    const n = B[type].size || 1, cells = [];
    for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) cells.push({ x: x + dx, y: y + dy });
    return cells;
  }

  function canPlace(type, x, y) {
    const run = G.run, W = G.map.W;
    if (B[type].unique && countOf(type) > 0) return { ok: false, why: 'Bâtiment unique : déjà construit' };
    const allowed = B[type].terrain, big = (B[type].size || 1) > 1;
    for (const c of footprint(type, x, y)) {
      if (c.x < 0 || c.y < 0 || c.x >= W || c.y >= G.map.H) return { ok: false, why: 'Hors carte' };
      if (!run.owned[c.y * W + c.x]) return { ok: false, why: big ? 'Les ' + (B[type].size * B[type].size) + ' cases doivent être dans votre territoire' : 'Hors de votre territoire' };
      if (G.economy.at(c.x, c.y)) return { ok: false, why: 'Case occupée' };
      if (!allowed.includes(G.economy.terrainAt(c.x, c.y))) return { ok: false, why: 'Terrain requis : ' + allowed.map(a => G.TERRAIN[a].name).join(', ') + (big ? ' (sur les ' + (B[type].size * B[type].size) + ' cases)' : '') };
    }
    return { ok: true };
  }

  function build(type, x, y) {
    const p = canPlace(type, x, y);
    if (!p.ok) return p;
    const cost = buildCost(type);
    if (!canAfford(cost)) return { ok: false, why: 'Ressources insuffisantes' };
    pay(cost, { x, y });
    if (B[type].storage) G.run.stats.builtWarehouse = true;
    const b = { bid: G.run.nextBid++, type, x, y, level: 1, hp: 0, paused: false, ruined: false };
    b.hp = G.economy.maxHp(b);
    G.run.buildings.push(b);
    G.economy.rebuildGrid();
    G.render && G.render.puff(x, y);
    return { ok: true, b };
  }

  function demolish(b) {
    if (b.type === 'forum') return;
    // Remboursement : moitié du coût de construction et des niveaux achetés.
    const refund = scaleCost(B[b.type].cost || {}, b.ruined ? 0 : 0.5);
    if (!b.ruined) for (const r in b.spent || {}) refund[r] = (refund[r] || 0) + Math.floor(b.spent[r] * 0.5);
    G.run.buildings = G.run.buildings.filter(o => o !== b);
    for (const r in refund) G.economy.add(r, refund[r], b);
    [b.inp, b.out, b.store].forEach(st => { for (const r in st || {}) G.economy.add(r, st[r], b); }); // contenu des stocks locaux
    G.economy.rebuildGrid();
    G.logistics.recount();
  }

  function repairCost(b) {
    const lvl = 1 + 0.5 * ((b.level || 1) - 1);
    return scaleCost(B[b.type].cost || { bois: 50, pierre: 50 }, 0.4 * lvl * Math.max(0.1, 1 + G.M.repair));
  }

  function repair(b) {
    const c = repairCost(b);
    if (!canAfford(c)) return false;
    pay(c, b);
    b.ruined = false;
    b.hp = G.economy.maxHp(b);
    G.adjDirty = true;
    if (B[b.type].wonder) recomputeMods();
    return true;
  }

  function repairAll() {
    let n = 0;
    G.run.buildings.filter(b => b.ruined).forEach(b => { if (repair(b)) n++; });
    return n;
  }

  function upgradeTarget(b) {
    const to = B[b.type].upgradeTo;
    return to && isUnlocked(to) ? to : null;
  }

  function upgrade(b) {
    const to = upgradeTarget(b);
    if (!to || b.ruined) return false;
    const cost = buildCost(to);
    if (!canAfford(cost)) return false;
    pay(cost, b);
    b.type = to;
    b.hp = G.economy.maxHp(b);
    G.economy.rebuildGrid();
    G.render && G.render.puff(b.x, b.y);
    return true;
  }

  // ---------- Niveaux ----------
  function maxLevel() { const m = G.LEVELS.maxByEra; return m[Math.min(G.run.era, m.length - 1)] + ((G.meta.levels || {}).h_niveaux || 0); }

  // Coût pour passer du niveau actuel au suivant.
  function levelCost(b) {
    const K = G.LEVELS, lvl = b.level || 1;
    const mult = K.costBase * Math.pow(K.costGrowth, lvl - 1) * Math.max(0.2, 1 + G.M.cost);
    const c = scaleCost(B[b.type].cost || K.baseCost, mult);
    const extra = K.extra[lvl + 1] || {};
    for (const r in extra) c[r] = (c[r] || 0) + extra[r];
    return c;
  }

  // 'ok', 'max' (plafond de l'ère), 'ruined' ou 'poor'.
  function levelState(b) {
    if (b.ruined) return 'ruined';
    if (B[b.type].road) return 'none';
    if ((b.level || 1) >= maxLevel()) return 'max';
    return canAfford(levelCost(b)) ? 'ok' : 'poor';
  }

  function levelUp(b) {
    if (levelState(b) !== 'ok') return false;
    const c = levelCost(b);
    pay(c, b);
    b.spent = b.spent || {};
    for (const r in c) b.spent[r] = (b.spent[r] || 0) + c[r];
    const ratio = b.hp / G.economy.maxHp(b);
    b.level = (b.level || 1) + 1;
    b.hp = G.economy.maxHp(b) * Math.max(ratio, 0.999);
    G.adjDirty = true;
    G.render && G.render.puff(b.x, b.y, true);
    G.lore && G.lore.say('levelUp', { building: B[b.type].name.toLowerCase(), level: b.level });
    return true;
  }

  // Monter d'un niveau tous les bâtiments du même type et du même niveau que b.
  // Renvoie la liste concernée, le coût unitaire et le nombre qu'on peut se payer.
  function levelAllInfo(b) {
    const list = G.run.buildings.filter(o => o.type === b.type && (o.level || 1) === (b.level || 1) && levelState(o) !== 'ruined' && (o.level || 1) < maxLevel());
    const c = levelCost(b);
    let afford = list.length;
    for (const r in c) afford = Math.min(afford, Math.floor((G.run.res[r] || 0) / c[r]));
    const total = {};
    for (const r in c) total[r] = c[r] * list.length;
    return { list, cost: c, total, afford: Math.max(0, afford) };
  }

  function levelUpAll(b) {
    const info = levelAllInfo(b);
    let n = 0;
    for (const o of info.list) { if (levelState(o) !== 'ok' || !levelUp(o)) break; n++; }
    return n;
  }

  // ---------- Marché ----------
  // Offres d'échange renouvelées toutes les 3 minutes ; le niveau du marché améliore les cours.
  function market() { return G.run.buildings.find(b => b.type === 'marche' && !b.ruined); }

  function refreshTrades() {
    const run = G.run, m = market();
    run.trades = [];
    if (!m) return;
    const lvl = m.level || 1;
    const avail = G.RESOURCE_ORDER.filter(r => G.VALUES[r] && G.RESOURCES[r].era <= run.era);
    const have = avail.filter(r => (run.res[r] || 0) >= 30);
    const nice = n => Math.max(5, Math.round(n / 5) * 5);
    for (let i = 0; i < 2 + lvl && have.length; i++) {
      const give = have[Math.floor(Math.random() * have.length)];
      const others = avail.filter(r => r !== give);
      const get = others[Math.floor(Math.random() * others.length)];
      const a = nice(Math.min(run.res[give] * 0.4, 400));
      const rate = Math.min(1.15, (0.55 + Math.random() * 0.35) * (1 + 0.08 * (lvl - 1)));
      run.trades.push({ give, a, get, b: nice(a * G.VALUES[give] / G.VALUES[get] * rate) });
    }
    run.tradeTimer = 180;
  }

  function trade(i) {
    const run = G.run, t = (run.trades || [])[i], m = market();
    if (!t || !m || (run.res[t.give] || 0) < t.a) return false;
    pay({ [t.give]: t.a }, m);
    G.economy.add(t.get, t.b, m);
    run.trades.splice(i, 1);
    run.stats.trades = (run.stats.trades || 0) + 1;
    return true;
  }

  // ---------- Tours et casernes ----------
  function setSpec(b, spec) {
    if (!B[b.type].tower || b.spec || (b.level || 1) < 3 || !G.TOWER_SPECS[spec]) return false;
    b.spec = spec;
    return true;
  }

  // ---------- Recettes ----------
  // Changer de recette : les stocks devenus inutiles retournent aux réserves les plus proches.
  function setRecipe(b, i) {
    const d = B[b.type];
    if (!d.recipes || !d.recipes[i] || (b.recipe || 0) === i) return false;
    const next = d.recipes[i];
    for (const r in b.out || {}) if (!next.out[r]) { G.economy.add(r, b.out[r], b); delete b.out[r]; }
    for (const r in b.inp || {}) if (!next.in[r]) { G.economy.add(r, b.inp[r], b); delete b.inp[r]; }
    b.recipe = i;
    G.adjDirty = true;
    G.logistics.recount();
    return true;
  }

  // ---------- Vitesse de jeu ----------
  // ×0,5 à ×3 toujours ; ×5 avec une Tour de l'horloge approvisionnée ; ×10 si elle est au niveau 2.
  function maxSpeed() {
    let best = 3;
    for (const b of G.run.buildings) {
      if (!B[b.type].clock || b.ruined || b.paused || (b._eff || 0) < 0.5) continue;
      best = Math.max(best, (b.level || 1) >= 2 ? 10 : 5);
    }
    return best;
  }

  // ---------- Territoire ----------
  function canBuyTile(x, y) {
    const run = G.run, W = G.map.W;
    if (x < 0 || y < 0 || x >= W || y >= G.map.H || run.owned[y * W + x]) return false;
    return G.economy.DIRS.some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < W && ny < G.map.H && run.owned[ny * W + nx];
    });
  }

  function buyTile(x, y) {
    if (!canBuyTile(x, y)) return false;
    const c = tileCost();
    if (!canAfford(c)) return false;
    pay(c, { x, y });
    G.run.owned[y * G.map.W + x] = true;
    G.run.tilesBought++;
    return true;
  }

  // Chemin d'annexion le plus court (cases non possédées) entre le territoire et (x, y),
  // et son coût total : chaque case achetée renchérit la suivante.
  function annexPath(x, y) {
    const run = G.run, W = G.map.W, H = G.map.H;
    if (x < 0 || y < 0 || x >= W || y >= H || run.owned[y * W + x]) return null;
    const prev = new Int32Array(W * H).fill(-2), queue = [];
    for (let i = 0; i < W * H; i++) if (run.owned[i]) { prev[i] = -1; queue.push(i); }
    const target = y * W + x;
    for (let qi = 0; qi < queue.length && prev[target] === -2; qi++) {
      const i = queue[qi], cx = i % W, cy = (i / W) | 0;
      for (const [dx, dy] of G.economy.DIRS) {
        const nx = cx + dx, ny = cy + dy, j = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev[j] !== -2) continue;
        prev[j] = i; queue.push(j);
      }
    }
    const path = [];
    for (let i = target; i >= 0 && !run.owned[i]; i = prev[i]) path.unshift({ x: i % W, y: (i / W) | 0 });
    const total = {}, bought = run.tilesBought;
    for (let k = 0; k < path.length; k++) {
      run.tilesBought = bought + k;
      const c = tileCost();
      for (const r in c) total[r] = (total[r] || 0) + c[r];
    }
    run.tilesBought = bought;
    return { path, cost: total };
  }

  function annexTo(x, y) {
    const a = annexPath(x, y);
    if (!a || !a.path.length || !canAfford(a.cost)) return 0;
    let n = 0;
    for (const t of a.path) if (buyTile(t.x, t.y)) n++; else break;
    if (n >= 3) G.lore && G.lore.say('annex', { n });
    return n;
  }

  // Cadeau de transition d'ère : un anneau de territoire gratuit.
  function growTerritory() {
    const run = G.run, W = G.map.W, add = [];
    for (let y = 0; y < G.map.H; y++) for (let x = 0; x < W; x++) if (canBuyTile(x, y)) add.push(y * W + x);
    add.forEach(i => (run.owned[i] = true));
    return add.length;
  }

  // ---------- Recherche ----------
  function techCost(id) {
    const t = G.TECHS[id];
    const lvl = G.run.techs[id] || 0;
    return Math.ceil(t.cost * (G.TECH_COST_MULT || 1) * (t.repeat ? Math.pow(t.repeat, lvl) : 1) / 10) * 10;
  }

  function techState(id) {
    const t = G.TECHS[id], run = G.run;
    if (!t.repeat && run.techs[id]) return 'done';
    if (t.era > run.era) return 'future';
    if (!t.req.every(r => run.techs[r])) return 'locked';
    return run.res.savoir >= techCost(id) ? 'ready' : 'available';
  }

  function research(id) {
    if (techState(id) !== 'ready') return false;
    G.run.res.savoir -= techCost(id);
    G.run.techs[id] = (G.run.techs[id] || 0) + 1;
    // Animation : le savoir part des bâtiments savants vers le forum.
    if (G.render) G.run.buildings.filter(b => !b.ruined && (B[b.type].out || {}).savoir).slice(0, 4)
      .forEach(b => G.render.visual(b, G.run.buildings[0], 'savoir', techCost(id) / 4));
    recomputeMods();
    const t = G.TECHS[id];
    const unl = t.effects.filter(e => e.t === 'unlock').map(e => B[e.b].name);
    G.ui && G.ui.toast('🔬 ' + t.name + (unl.length ? ' — débloque : ' + unl.join(', ') : ''), 'info');
    G.lore && G.lore.say(Object.keys(G.run.techs).length === 1 ? 'firstResearch' : 'research', { tech: t.name });
    return true;
  }

  // ---------- Décrets ----------
  function makeChoice(run, meta, kind) {
    const pool = kind === 'major' ? G.DECREES_MAJOR : G.DECREES_MINOR;
    const owned = kind === 'major' ? run.decrees : [];
    const ids = Object.keys(pool).filter(id => !owned.includes(id));
    const n = 3 + ((meta.levels.h_eclaire || 0) > 0 ? 1 : 0);
    return { kind, options: G.util.shuffle(ids, Math.random).slice(0, n) };
  }

  function chooseDecree(id) {
    const run = G.run, choice = run.pending[0];
    if (!choice || !choice.options.includes(id)) return;
    if (choice.kind === 'major') run.decrees.push(id);
    else {
      run.minors.push(id);
      if (G.DECREES_MINOR[id].instant === 'cache') {
        ['nourriture', 'bois', 'pierre'].forEach(r => G.economy.add(r, G.logistics.storeCapTotal() * 0.5));
      }
    }
    run.pending.shift();
    recomputeMods();
  }

  function reroll() {
    const run = G.run;
    if (run.rerolls <= 0 || !run.pending[0]) return;
    run.rerolls--;
    run.pending[0] = makeChoice(run, G.meta, run.pending[0].kind);
  }

  // ---------- Ères ----------
  function eraRequirements() {
    const era = G.ERAS[G.run.era];
    if (!era.advance) return null;
    const a = era.advance;
    return { tech: a.tech, techOk: !!G.run.techs[a.tech], cost: a.cost, costOk: canAfford(a.cost) };
  }

  function advanceEra() {
    const req = eraRequirements();
    if (!req || !req.techOk || !req.costOk) return false;
    const run = G.run;
    pay(req.cost, run.buildings[0]);
    run.era++;
    run.wave.inEra = 0;
    if (!run.wave.active) run.wave.timer = Math.max(run.wave.timer, G.WAVES.eraGrace);
    const tiles = growTerritory();
    run.pending.push(makeChoice(run, G.meta, 'major'));
    recomputeMods();
    G.ui && G.ui.eraTransition(run.era, tiles);
    // Atteindre l'ère industrielle débloque le niveau de difficulté suivant.
    const meta = G.meta;
    if (run.era >= 3 && run.rigueur >= meta.maxRigueur && meta.maxRigueur < G.RIGUEUR.length - 1) {
      meta.maxRigueur++;
      run.unlockedRig = true;
      G.ui && G.ui.toast('🔓 Nouvelle difficulté débloquée : ' + G.RIGUEUR[meta.maxRigueur].name, 'good');
      G.lore && G.lore.say('rigUnlock', { name: G.RIGUEUR[meta.maxRigueur].name });
    }
    G.lore && G.lore.say('era' + run.era, {});
    gainGlory((G.GLORY.era[run.era] || 0) + ((G.meta.levels || {}).h_gloire || 0), 'nouvelle ère : ' + G.ERAS[run.era].name);
    return true;
  }

  // ---------- Gloire, cartes et maîtrise (héritage) ----------
  // Pas de gloire pour une partie jouée par le bot : elle doit être méritée.
  function gainGlory(n, why) {
    const run = G.run, meta = G.meta;
    if (!n || G.botSim) return;
    if ((run.botRun || (G.bot && G.bot.active)) && !meta.settings.botGlory) return;
    meta.glory = (meta.glory || 0) + n;
    run.gloryEarned = (run.gloryEarned || 0) + n;
    G.ui && G.ui.toast('✨ +' + n + ' gloire — ' + why, 'good');
  }

  function cardTypes() {
    return Object.keys(B).filter(id => !B[id].special && !B[id].road && !B[id].wonder && !B[id].upgradeFrom);
  }

  function masteryCost(type) {
    const lvl = (G.meta.mastery || {})[type] || 1;
    return lvl >= G.GLORY.maxMastery ? null : Math.pow(2, lvl - 1);
  }

  function buyCard(type) {
    const meta = G.meta, c = G.GLORY.cardCost(B[type].era);
    if ((meta.glory || 0) < c) return false;
    meta.glory -= c;
    meta.cards = meta.cards || {};
    meta.cards[type] = (meta.cards[type] || 0) + 1;
    return true;
  }

  // Paquet : cartes au hasard parmi les bâtiments des ères déjà atteintes.
  function buyPack() {
    const meta = G.meta;
    if ((meta.glory || 0) < G.GLORY.packCost) return null;
    meta.glory -= G.GLORY.packCost;
    meta.cards = meta.cards || {};
    const pool = cardTypes().filter(id => B[id].era <= (meta.stats.bestEra || 0)), got = [];
    for (let i = 0; i < G.GLORY.packSize; i++) {
      const t = pool[Math.floor(Math.random() * pool.length)];
      meta.cards[t] = (meta.cards[t] || 0) + 1;
      got.push(t);
    }
    return got;
  }

  function masteryUp(type) {
    const meta = G.meta, cost = masteryCost(type);
    meta.cards = meta.cards || {};
    if (cost === null || (meta.cards[type] || 0) < cost) return false;
    meta.cards[type] -= cost;
    meta.mastery = meta.mastery || {};
    meta.mastery[type] = ((meta.mastery[type]) || 1) + 1;
    if (G.run && !G.run.over) G.adjDirty = true;
    return true;
  }

  // Maîtrise en série : tout ce que les cartes possédées permettent, bâtiment par bâtiment.
  function masteryPlan() {
    const meta = G.meta, plan = [];
    cardTypes().forEach(t => {
      let cards = (meta.cards || {})[t] || 0, lvl = (meta.mastery || {})[t] || 1, spent = 0;
      const from = lvl;
      while (lvl < G.GLORY.maxMastery && cards >= Math.pow(2, lvl - 1)) { const c = Math.pow(2, lvl - 1); cards -= c; spent += c; lvl++; }
      if (lvl > from) plan.push({ type: t, from, to: lvl, spent });
    });
    return plan;
  }

  function masteryUpAll() {
    const plan = masteryPlan();
    plan.forEach(p => { for (let l = p.from; l < p.to; l++) masteryUp(p.type); });
    return plan;
  }

  // ---------- Lancement du vaisseau ----------
  function launchReady() { return G.run.buildings.some(b => B[b.type].wonder && B[b.type].wonder.launch && b.done && !b.ruined); }

  function launch() {
    if (!launchReady() || G.run.over) return false;
    G.run.launched = true;
    gainGlory(G.GLORY.launch, 'le vaisseau a quitté la planète');
    G.lore && G.lore.say('launch', {});
    endRun('launch');
    return true;
  }

  // ---------- Fin de partie et héritage ----------
  function heritageGain() {
    const run = G.run;
    const eraScore = [0, 10, 30, 60, 100][run.era] || 0;
    const raw = eraScore + run.stats.wavesWon * 1.5 + 5 * Math.log10(run.stats.produced + 1) + G.chronicle.heritageBonus() + (run.launched ? 50 : 0);
    // Quitter la planète : héritage majoré de moitié, plus un bonus fixe.
    const launch = run.launched ? 1.5 : 1;
    const mult = G.RIGUEUR[run.rigueur].heritage * (1 + (G.ORIGINS[run.origin].heritageMult || 0)) * launch;
    return Math.floor(raw * mult);
  }

  function endRun(reason) {
    const run = G.run, meta = G.meta;
    if (run.over) return;
    run.over = true;
    const gain = heritageGain();
    meta.heritage += gain;
    meta.heritageTotal += gain;
    meta.stats.runs++;
    meta.stats.bestEra = Math.max(meta.stats.bestEra, run.era);
    meta.stats.bestWaves = Math.max(meta.stats.bestWaves, run.stats.wavesWon);
    const unlockedRig = !!run.unlockedRig;
    meta.history.unshift({ origin: run.origin, rigueur: run.rigueur, era: run.era, waves: run.stats.wavesWon, time: run.time, gain, reason });
    meta.history = meta.history.slice(0, 10);
    G.defense.reset();
    G.state.save();
    G.ui && G.ui.runEnded(reason, gain, unlockedRig);
  }

  function buyHeritage(id) {
    const h = G.HERITAGE[id], meta = G.meta;
    const lvl = meta.levels[id] || 0;
    if (lvl >= h.max) return false;
    const c = h.cost(lvl);
    if (meta.heritage < c) return false;
    meta.heritage -= c;
    meta.levels[id] = lvl + 1;
    return true;
  }

  function unlockOrigin(id) {
    const o = G.ORIGINS[id], meta = G.meta;
    if (meta.origins[id] || meta.heritage < o.cost) return false;
    meta.heritage -= o.cost;
    meta.origins[id] = true;
    return true;
  }

  function startRun(originId, rigueur) {
    G.defense.reset();
    G.defense.C.floaters.length = 0;
    G.defense.C.units.length = 0;
    G.M = G.mods.compute({ techs: {}, decrees: [], minors: [], origin: originId, rigueur }, G.meta);
    G.run = G.state.newRun(G.meta, originId, rigueur);
    recomputeMods();
    G.economy.rebuildGrid();
    G.logistics.recount();
    G.rates = {}; G.delta = {}; G.flowAgg = {}; G.hist = [];
    G.state.save();
    G.lore && G.lore.say('start', { origin: G.ORIGINS[originId].name });
  }

  // ---------- Conseiller ----------
  function hint() {
    const run = G.run, has = t => run.buildings.some(b => b.type === t), R = G.rates || {}, S = G.stats || {};
    const req = eraRequirements();
    if (run.buildings.some(b => b.ruined)) return 'Des bâtiments sont en ruine : réparez-les depuis l\'onglet Civilisation ou en cliquant dessus.';
    if (!has('bucheron')) return 'Construisez un bûcheron 🪓 sur une forêt pour obtenir du bois.';
    if (!has('ferme') && !has('peche') && !has('cueilleur')) return run.era === 0 ? 'Construisez un cueilleur 🧺 près des forêts pour nourrir votre peuple.' : 'Construisez une ferme 🌾 sur une plaine pour nourrir votre peuple.';
    if (!has('hutte')) return 'Construisez des huttes 🛖 : chaque habitant est un travailleur.';
    const hungry = run.buildings.find(b => G.BUILDINGS[b.type].consume && !b.ruined && b._sat < 0.9);
    if (hungry) {
      const c = G.BUILDINGS[hungry.type].consume;
      const miss = Object.keys(c).filter(r => run.res[r] < 1).map(r => G.RESOURCES[r].name.toLowerCase());
      if (miss.length) return 'Vos logements manquent de ' + miss.join(' et ') + ' : leur population chute.';
    }
    if (S.workRatio < 0.98) return 'Main-d\'œuvre insuffisante : construisez des logements ou mettez des bâtiments en pause.';
    if ((R.nourriture || 0) < -0.01 && run.res.nourriture < 50) return 'Votre nourriture s\'épuise : ajoutez des fermes.';
    if (!has('carriere')) return 'Construisez une carrière ⛏️ sur une colline pour la pierre.';
    if (G.defense.wavesOn() && !has('tour_archers') && run.wave.timer < 150) return 'Une vague approche : une tour d\'archers 🏹 près du forum vous protégera.';
    if (!has('sages')) return 'Le cercle des sages 🧙 produit le savoir nécessaire à la recherche.';
    if (Object.keys(run.techs).length === 0 && run.res.savoir >= 30) return 'Vous avez assez de savoir : ouvrez l\'onglet Recherche.';
    if (S.unpowered > 0) return S.unpowered + ' bâtiment(s) électrique(s) non raccordé(s) : placez-les au contact d\'une centrale ou d\'un relais électrique 🗼 relié à une centrale.';
    if (S.energyNeed > S.energyProd + 0.01) return 'Énergie insuffisante sur un réseau : ajoutez une centrale au contact du réseau (bois, charbon, éolienne…).';
    const waiting = run.buildings.find(b => b._waiting && !b.ruined);
    if (waiting) return G.BUILDINGS[waiting.type].name + ' attend : ' + G.RESOURCES[waiting._waiting].icon + ' ' + G.RESOURCES[waiting._waiting].name.toLowerCase() + '. Aucune source n\'en a en stock : produisez-en ou construisez un entrepôt.';
    const slow = run.buildings.filter(b => b._slow && !b.ruined);
    if (slow.length >= 2) return 'Les porteurs ne suivent pas (' + slow.length + ' bâtiments attendent ' + G.RESOURCES[slow[0]._slow].icon + ') : un entrepôt plus proche, ou monter le niveau du fournisseur, augmente le débit.';
    for (const r of G.RESOURCE_ORDER) if (!G.RESOURCES[r].uncapped && G.capR && run.res[r] >= G.capR[r] - 1 && G.capR[r] > 0) return 'Stock de ' + G.RESOURCES[r].name.toLowerCase() + ' plein : construisez un entrepôt ou transformez-le.';
    if (req && req.techOk && req.costOk) return 'Tout est prêt : passez à l\'ère suivante depuis l\'onglet Civilisation !';
    if (req && req.techOk) return 'Réunissez les ressources demandées pour passer à l\'ère suivante (onglet Civilisation).';
    if (run.tilesBought >= 6 && run.buildings.every(b => (b.level || 1) === 1)) return 'Place limitée ? Cliquez un bâtiment pour le monter de niveau : il produit davantage sans prendre de case.';
    return 'Optimisez : regroupez les bâtiments complémentaires pour profiter des bonus de voisinage.';
  }

  return {
    recomputeMods, buildCost, canAfford, tileCost, isUnlocked, canPlace, footprint, build, demolish, repairCost, repair, repairAll,
    upgradeTarget, upgrade, maxLevel, levelCost, levelState, levelUp, levelAllInfo, levelUpAll, maxSpeed, setRecipe, launchReady, launch, gainGlory, cardTypes, masteryCost, buyCard, buyPack, masteryUp, masteryPlan, masteryUpAll, market, refreshTrades, trade, setSpec, canBuyTile, annexPath, annexTo, buyTile, techCost, techState, research, makeChoice, chooseDecree, reroll,
    eraRequirements, advanceEra, heritageGain, endRun, buyHeritage, unlockOrigin, startRun, hint, countOf,
  };
})();
