// Joueur automatique : sert au mode Bot du jeu (Paramètres) et aux tests d'équilibrage.
//
// - Mode Bot : G.bot.start() fait jouer le bot sur la partie en cours ; G.bot.stop() rend la main.
// - Console : BOT(3600, { origin: 'fluviale', rig: 1 }) simule une NOUVELLE partie en accéléré et
//   renvoie un journal ; BOT.live({ speed: 5 }) lance une nouvelle partie jouée en direct.
G.bot = (function () {
  const L = () => G.logic;
  const cnt = t => G.logic.countOf(t);
  const dF = (x, y) => Math.hypot(x - G.map.CX, y - G.map.CY);

  // Distance au plus proche bâtiment vérifiant `pred`.
  function nearest(x, y, pred) {
    let bd = 99;
    for (const b of G.run.buildings) if (!b.ruined && pred(b)) bd = Math.min(bd, Math.hypot(b.x - x, b.y - y));
    return bd;
  }

  // Score de placement : voisinage + proximité logistique (fournisseurs d'intrants, clients, réserves).
  function logisticScore(type, x, y) {
    const d = G.BUILDINGS[type];
    let s = 0;
    const ins = Object.keys(Object.assign({}, d.in || {}, d.consume || {}));
    for (const r of ins) s -= 0.06 * nearest(x, y, b => (G.BUILDINGS[b.type].out || {})[r] || G.logistics.isStore(b));
    if (d.out) {
      const outs = Object.keys(d.out);
      s -= 0.04 * nearest(x, y, b => { const bd = G.BUILDINGS[b.type]; return outs.some(r => (bd.in || {})[r] || (bd.consume || {})[r]) || G.logistics.isWarehouse(b); });
    }
    if (d.storage) s -= 0.05 * dF(x, y);
    return s;
  }

  // Électricité : un bâtiment électrique se place de préférence au contact du réseau,
  // une centrale au contact des bâtiments qui manquent de courant.
  function touchesNode(x, y) { return G.economy.DIRS.some(([dx, dy]) => { const n = G.economy.at(x + dx, y + dy); return n && G.power.isNode(n); }); }
  function elecScore(type, x, y) {
    const d = G.BUILDINGS[type];
    if (d.energyIn) {
      if (touchesNode(x, y)) return 3;
      // Sinon, il faut au moins une case libre autour pour y tirer un relais.
      const free = G.economy.DIRS.some(([dx, dy]) => L().canPlace('relais', x + dx, y + dy).ok);
      return free ? 0 : -50;
    }
    if (d.energyOut || d.relay) {
      let s = touchesNode(x, y) ? 2 : 0;
      for (const [dx, dy] of G.economy.DIRS) { const n = G.economy.at(x + dx, y + dy); if (n && G.BUILDINGS[n.type].energyIn) s += (n._power || 0) < 0.99 ? 2 : 0.5; }
      return s;
    }
    return 0;
  }

  function plantType() {
    const run = G.run;
    return ['centrale_nucleaire', 'centrale', 'eolienne', 'centrale_bois'].find(t => L().isUnlocked(t) && (t !== 'centrale_nucleaire' || run.res.uranium > 20) && (t !== 'centrale' || cnt('mine_charbon')));
  }

  // Voisin à démolir pour faire de la place à côté d'un bâtiment enclavé : de préférence superflu, sinon peu précieux.
  function sacrifice(b) {
    const run = G.run, R = run.res, pt = plantType();
    if (!pt) return null;
    const ns = G.economy.DIRS.map(([dx, dy]) => G.economy.at(b.x + dx, b.y + dy)).filter(n => n && !n.ruined && n.type !== 'forum');
    const ok = ns.filter(n => {
      const d = G.economy.def(n);
      return !CRITICAL.has(n.type) && !d.wonder && !d.storage && !d.road && !d.relay && !d.energyOut && !d.squad && !d.clock &&
        G.BUILDINGS[pt].terrain.includes(G.economy.terrainAt(n.x, n.y));
    });
    const score = n => {
      const d = G.economy.def(n), outs = Object.keys(d.out || {});
      const surplus = outs.length && (n._full || (n._eff || 0) < 0.05 || outs.every(r => !G.RESOURCES[r].uncapped && R[r] >= 1500));
      return (surplus ? 0 : d.pop ? 3 : 1) * 10 + (n.level || 1);
    };
    return ok.sort((a, c) => score(a) - score(c))[0] || null;
  }

  // Raccorde un bâtiment électrique isolé : une ligne de relais jusqu'au réseau le plus proche (8 cases max).
  function connect(b) {
    if (G.power.networks().netOf[b.bid] !== undefined || !L().isUnlocked('relais')) return;
    const W = G.map.W, prev = {}, start = [];
    for (const [dx, dy] of G.economy.DIRS) { const x = b.x + dx, y = b.y + dy; if (L().canPlace('relais', x, y).ok) { prev[y * W + x] = -1; start.push([x, y, 0]); } }
    // Enclavé (aucune case libre autour) : on sacrifie un voisin superflu pour poser une centrale à sa place.
    if (!start.length) {
      const n = sacrifice(b), pt = plantType();
      if (n && pt && L().canAfford(L().buildCost(pt))) { const x = n.x, y = n.y; L().demolish(n); L().build(pt, x, y); }
      return;
    }
    const q = start.slice();
    while (q.length) {
      const [x, y, dist] = q.shift(), i = y * W + x;
      if (touchesNode(x, y)) {
        const path = [];
        for (let j = i; j !== -1; j = prev[j]) path.push(j);
        if (path.every(j => L().canAfford(L().buildCost('relais')))) path.forEach(j => L().build('relais', j % W, (j / W) | 0));
        return;
      }
      if (dist >= 8) continue;
      for (const [dx, dy] of G.economy.DIRS) {
        const nx = x + dx, ny = y + dy, j = ny * W + nx;
        if (prev[j] !== undefined || !L().canPlace('relais', nx, ny).ok) continue;
        prev[j] = i; q.push([nx, ny, dist + 1]);
      }
    }
  }

  // Courant : bâtiments non raccordés, puis réseaux en déficit (nouvelle centrale à leur contact).
  function power() {
    const run = G.run, S = G.stats || {};
    run.buildings.filter(b => G.BUILDINGS[b.type].energyIn && !b.ruined && G.power.networks().netOf[b.bid] === undefined).slice(0, 2).forEach(connect);
    const plantType = () => ['centrale_nucleaire', 'centrale', 'eolienne', 'centrale_bois'].find(t => L().isUnlocked(t) && (t !== 'centrale_nucleaire' || run.res.uranium > 20) && (t !== 'centrale' || cnt('mine_charbon')));
    // Aucun réseau à rejoindre : une centrale directement au contact du bâtiment isolé.
    const lone = run.buildings.find(b => G.BUILDINGS[b.type].energyIn && !b.ruined && G.power.networks().netOf[b.bid] === undefined);
    const pt = plantType();
    if (lone && pt && L().canAfford(L().buildCost(pt)) && spendOk(L().buildCost(pt), pt)) {
      const spot = G.economy.DIRS.map(([dx, dy]) => ({ x: lone.x + dx, y: lone.y + dy })).find(p => L().canPlace(pt, p.x, p.y).ok);
      if (spot) { L().build(pt, spot.x, spot.y); return; }
    }
    const net = G.power.networks(), shortNets = new Set();
    run.buildings.forEach(b => {
      const id = net.netOf[b.bid];
      if (G.BUILDINGS[b.type].energyIn && !b.paused && id !== undefined && (b._power === undefined ? 1 : b._power) < 0.95) shortNets.add(id);
    });
    if (!shortNets.size) return;
    const plant = ['centrale_nucleaire', 'centrale', 'eolienne', 'centrale_bois'].find(t => L().isUnlocked(t) && (t !== 'centrale_nucleaire' || run.res.uranium > 20) && (t !== 'centrale' || cnt('mine_charbon')));
    if (!plant || !L().canAfford(L().buildCost(plant)) || !spendOk(L().buildCost(plant), plant)) return;
    // Une centrale ne sert que si elle touche le réseau en déficit.
    let bt = null, bs = -1;
    for (let y = 0; y < G.map.H; y++) for (let x = 0; x < G.map.W; x++) {
      if (!L().canPlace(plant, x, y).ok) continue;
      let s = 0;
      for (const [dx, dy] of G.economy.DIRS) { const n = G.economy.at(x + dx, y + dy); if (n && shortNets.has(net.netOf[n.bid])) s += G.power.isNode(n) ? 2 : 1; }
      s += G.economy.adjacency(plant, x, y).total;
      if (s > bs && s >= 1) { bs = s; bt = { x, y }; }
    }
    if (bt) L().build(plant, bt.x, bt.y);
  }

  function best(type, scoreFn) {
    let bt = null, bs = -1e9;
    for (let y = 0; y < G.map.H; y++) for (let x = 0; x < G.map.W; x++) {
      if (!L().canPlace(type, x, y).ok) continue;
      const s = G.economy.adjacency(type, x, y).total + logisticScore(type, x, y) + elecScore(type, x, y) + (scoreFn ? scoreFn(x, y) : 0);
      if (s > bs) { bs = s; bt = { x, y }; }
    }
    return bt;
  }

  // Épargne pour l'ère suivante : quand sa technologie est prête, les ressources exigées
  // ne sont plus dépensées ailleurs tant que le stock n'est pas réuni.
  function reserved() {
    const req = L().eraRequirements();
    return req && req.techOk ? req.cost : {};
  }
  let wantExtra = {}; // ressources qui manquent pour construire un bâtiment de la chaîne (remis à zéro à chaque décision)

  // Bâtiments indispensables à la chaîne de la fin de partie : ils passent avant le reste, et on leur fait de la place.
  const CRITICAL = new Set(['haut_fourneau', 'usine', 'electronicien', 'fonderie_alliages', 'raffinerie', 'orfevrerie', 'sculpteur', 'horloger', 'tour_horloge',
    'pas_de_tir', 'centrale', 'centrale_solaire', 'centrale_nucleaire', 'centre_recherche']);

  // Ce qu'il reste à livrer au pas de tir, avec les intrants en amont (acier et gemmes pour les alliages,
  // machines et or pour l'électronique, charbon pour le carburant) : on ne le dépense pas ailleurs.
  function padReserve() {
    const pad = G.run.buildings.find(b => b.type === 'pas_de_tir' && !b.done && !b.ruined);
    if (!pad) return {};
    const w = G.BUILDINGS.pas_de_tir.wonder.cost, rem = {}, out = {};
    for (const r in w) rem[r] = Math.max(0, w[r] - ((pad.progress || {})[r] || 0));
    for (const r in rem) if (rem[r] > 0) out[r] = rem[r];
    const up = (r, n) => { if (n > 0) out[r] = (out[r] || 0) + n; };
    up('acier', rem.alliages * 2.5); up('gemmes', rem.alliages * 0.5);
    up('machines', rem.electronique); up('or', rem.electronique * 0.5);
    up('charbon', rem.carburant * 1.6);
    return out;
  }

  function spendOk(cost, type) {
    const need = reserved(), run = G.run, pad = CRITICAL.has(type) ? {} : padReserve();
    return Object.keys(cost).every(r => (!need[r] || run.res[r] - cost[r] >= need[r]) && (!pad[r] || run.res[r] - cost[r] >= pad[r]));
  }

  // Fait de la place : démolit un bâtiment superflu (production abondante ou à l'arrêt, au-delà de 3 exemplaires du même type).
  function makeRoom() {
    const run = G.run, R = run.res, count = {};
    run.buildings.forEach(b => (count[b.type] = (count[b.type] || 0) + 1));
    const cands = run.buildings.filter(b => {
      const d = G.economy.def(b);
      if (b.ruined || b.type === 'forum' || CRITICAL.has(b.type) || d.pop || d.storage || d.wonder || d.road || d.relay || d.energyOut || d.squad || d.clock || d.tower || d.wall) return false;
      if (!d.terrain.includes('plaine') || count[b.type] <= 3) return false; // il faut libérer une case ordinaire
      const outs = Object.keys(d.out || {});
      if (!outs.length) return false;
      return b._full || (b._eff || 0) < 0.05 || outs.every(r => !G.RESOURCES[r].uncapped && R[r] >= 1500);
    }).sort((a, b) => ((b._full || (b._eff || 0) < 0.05) - (a._full || (a._eff || 0) < 0.05)) || ((a.level || 1) - (b.level || 1)));
    if (!cands.length) return false;
    L().demolish(cands[0]);
    return true;
  }

  // Les consommateurs d'une ressource épargnée sont mis en pause, sauf s'ils fabriquent eux-mêmes
  // une ressource exigée. Ils repartent dès que l'ère est franchie.
  function saveForEra() {
    const run = G.run, need = reserved();
    run.buildings.forEach(b => {
      const d = G.economy.def(b);
      if (!d.in || G.BUILDINGS[b.type].consume || d.wonder) return;
      const drains = Object.keys(d.in).some(r => need[r] && run.res[r] < need[r]);
      const feeds = Object.keys(d.out || {}).some(r => need[r] && run.res[r] < need[r]);
      const pause = drains && !feeds;
      if (pause && !b.paused) { b.paused = true; b._botPaused = true; }
      else if (!pause && b._botPaused) { b._botPaused = false; if (!b._botIdle) b.paused = false; }
    });
  }

  // Évite le gaspillage : un producteur dont toutes les productions sont déjà en très grande quantité est mis en pause
  // (ses intrants — fer, bois, charbon… — servent alors ailleurs) ; il redémarre quand le stock redescend.
  function balance() {
    const run = G.run, R = run.res, pad = padReserve(), era = reserved();
    run.buildings.forEach(b => {
      const d = G.economy.def(b);
      if (b.ruined || d.pop || d.storage || d.wonder || d.road || d.relay || d.energyOut || d.tower || d.squad || d.clock) return;
      const outs = Object.keys(d.out || {}).filter(r => !G.RESOURCES[r].uncapped);
      if (!outs.length || Object.keys(d.out).some(r => G.RESOURCES[r].uncapped)) return;
      const high = f => outs.every(r => R[r] >= Math.max(4000 * f, 2 * f * Math.max(pad[r] || 0, era[r] || 0)));
      if (!b.paused && high(1)) { b.paused = true; b._botIdle = true; }
      else if (b._botIdle && !outs.every(r => R[r] >= Math.max(2000, Math.max(pad[r] || 0, era[r] || 0)))) { b.paused = false; b._botIdle = false; }
    });
  }

  function tryBuild(type, scoreFn) {
    if (!L().isUnlocked(type)) return false;
    if (!L().canAfford(L().buildCost(type))) {
      // Un bâtiment de la chaîne qu'on ne peut pas payer : on signale ce qui manque pour que le bot le produise.
      if (CRITICAL.has(type)) { const c = L().buildCost(type); for (const r in c) if ((G.run.res[r] || 0) < c[r]) wantExtra[r] = true; }
      return false;
    }
    if (!spendOk(L().buildCost(type), type)) return false;
    let t = best(type, scoreFn);
    if (!t && CRITICAL.has(type) && makeRoom()) t = best(type, scoreFn);
    if (t) {
      const r = L().build(type, t.x, t.y);
      if (r.ok && G.BUILDINGS[type].energyIn) connect(r.b);
      return r.ok;
    }
    // Aucune case possible (gisement hors territoire) : on annexe jusqu'au plus proche.
    const allowed = G.BUILDINGS[type].terrain;
    if (!allowed.includes('plaine') && allowed.some(a => a.startsWith('g_') || a === 'foret' || a === 'eau' || a === 'colline')) {
      let tgt = null, bd = 1e9;
      for (let y = 0; y < G.map.H; y++) for (let x = 0; x < G.map.W; x++) {
        if (G.run.owned[y * G.map.W + x] || G.economy.at(x, y) || !allowed.includes(G.economy.terrainAt(x, y))) continue;
        const a = L().annexPath(x, y);
        if (a && a.path.length < bd) { bd = a.path.length; tgt = { x, y }; }
      }
      if (tgt && bd <= (allowed.some(a => G.TERRAIN[a] && G.TERRAIN[a].rare) ? 14 : 10)) L().annexTo(tgt.x, tgt.y);
    }
    return false;
  }

  const chain = [['chasseur', 1], ['tailleur', 1], ['tanneur', 1], ['foyer', 1], ['grotte', 1], ['mine_cuivre', 2], ['mine_etain', 2], ['fonderie', 2], ['entrepot', 1], ['atelier', 2], ['armurerie', 1],
    ['scierie', 2], ['charbonniere', 2], ['mine_fer', 2], ['bas_fourneau', 2], ['moulin', 2], ['boulangerie', 2], ['vignoble', 2], ['pressoir', 1], ['forge', 2], ['horloger', 1], ['tour_horloge', 1], ['forge_armes', 1], ['monastere', 2],
    ['mine_charbon', 2], ['centrale', 2], ['haut_fourneau', 3], ['usine', 2], ['bergerie', 2], ['filature', 1], ['ebenisterie', 1], ['universite', 2],
    ['carriere_marbre', 1], ['sculpteur', 1], ['mine_or', 2], ['orfevrerie', 1], ['mine_gemmes', 2],
    ['mine_uranium', 1], ['raffinerie', 2], ['electronicien', 2], ['centrale_solaire', 2], ['fonderie_alliages', 3], ['centre_recherche', 2]];

  // Fenêtres qui attendent une réponse : décrets, événements (premier choix abordable), ère.
  function answerModals() {
    const run = G.run;
    if (run.pending.length && (G.ui.modal === 'decree' || G.paused)) { L().chooseDecree(run.pending[0].options[0]); if (G.ui.modal === 'decree') G.ui.closeModal(); }
    if (G.ui.modal === 'event' && G.ui.event) {
      const i = G.ui.event.choices.findIndex(ch => G.chronicle.canChoose(ch));
      G.chronicle.choose(G.ui.event, Math.max(0, i));
      G.ui.event = null;
      G.ui.closeModal();
    }
    if (['era', 'offline', 'eventResult'].includes(G.ui.modal)) G.ui.closeModal();
  }

  // Une décision toutes les ~2 s de jeu. Les actions notables sont ajoutées au journal.
  function decide(log, t) {
    const run = G.run, S = G.stats || {}, R = G.rates || {};
    if (!run.wave.active) L().repairAll();
    if (L().launchReady()) { log.push('t=' + Math.round(t) + 's 🚀 décollage !'); L().launch(); return; }
    // Mines épuisées : on les démolit pour en ouvrir de nouvelles ailleurs.
    run.buildings.filter(b => b._depleted).forEach(b => L().demolish(b));
    (run.contracts || []).filter(c => c.type === 'deliver').forEach(c => G.chronicle.deliver(c.id));
    // Objectif final : dès que le pas de tir est débloqué, il passe avant tout le reste.
    if (L().isUnlocked('pas_de_tir') && !cnt('pas_de_tir')) tryBuild('pas_de_tir', (x, y) => -dF(x, y) * 0.2);
    Object.keys(G.TECHS).filter(id => L().techState(id) === 'ready').sort((a, b) => L().techCost(a) - L().techCost(b)).slice(0, 1).forEach(id => L().research(id));
    wantExtra = {};
    saveForEra();
    balance();
    if (L().advanceEra()) log.push('t=' + Math.round(t) + 's → ' + G.ERAS[run.era].name + ' (vagues ' + run.stats.wavesWon + ')');
    run.buildings.forEach(b => {
      const u = L().upgradeTarget(b);
      const fed = u && Object.keys(G.BUILDINGS[u].consume || {}).every(r => (R[r] || 0) > 0.05 || run.res[r] > 40);
      if (u && fed && L().canAfford(L().buildCost(u)) && spendOk(L().buildCost(u))) L().upgrade(b);
    });

    // Défense d'abord : sans elle, rien ne tient.
    if (G.defense.wavesOn()) defend(log, t);

    if (S.pop < S.jobs + 2) tryBuild('hutte');
    if ((R.nourriture || 0) < 0.3 && run.res.nourriture < 150) tryBuild(L().isUnlocked('peche') && cnt('peche') < 3 ? 'peche' : L().isUnlocked('ferme') ? 'ferme' : 'cueilleur');
    const E = Math.max(0, run.era - 1); // la Préhistoire compte comme l'Antiquité
    if (cnt('bucheron') < 2 + E * 2) tryBuild('bucheron');
    if (cnt('carriere') < 2 + E * 2) tryBuild('carriere');
    if (cnt('sages') < 2) tryBuild('sages');
    if (cnt('entrepot') < 1 + E * 2) tryBuild('entrepot');
    if (cnt('bibliotheque') < 2) tryBuild('bibliotheque');
    for (const [ty, n] of chain) if (cnt(ty) < n && L().isUnlocked(ty) && tryBuild(ty)) break;
    bottlenecks();
    power();
    if (run.time > 400 && !cnt('marche')) tryBuild('marche');
    // Merveille de l'ère : le chantier est bon marché, les porteurs l'alimentent ensuite.
    const wonder = Object.keys(G.BUILDINGS).find(id => G.BUILDINGS[id].wonder && G.BUILDINGS[id].era <= run.era && L().isUnlocked(id) && !cnt(id) &&
      (G.BUILDINGS[id].wonder.launch || !run.techs.t_vaisseau)); // une fois le vaisseau en vue, plus d'autres merveilles
    if (wonder && run.buildings.length > 30) tryBuild(wonder, (x, y) => -dF(x, y) * 0.2);
    run.buildings.forEach(b => { if (G.BUILDINGS[b.type].tower && !b.spec && (b.level || 1) >= 3) L().setSpec(b, 'rate'); });

    levelUps(log, t);

    // Territoire : peu d'achats « de remplissage » (le prix de chaque case grimpe de 8,5 %) et seulement s'ils restent
    // bon marché. On densifie avec les niveaux et on démolit le superflu ; les annexions utiles (gisements) passent par tryBuild.
    let freeFlat = 0;
    for (let i = 0; i < run.owned.length; i++) if (run.owned[i] && !G.grid[i] && ['plaine', 'fertile'].includes(G.visibleTerrain(run.tiles[i], run.era))) freeFlat++;
    const tc = L().tileCost();
    if (freeFlat < 4 && run.tilesBought < 14 + run.era * 8 && Object.keys(tc).every(r => tc[r] <= (run.res[r] || 0) * 0.25)) {
      let bt = null, bd = 99;
      for (let y = 0; y < G.map.H; y++) for (let x = 0; x < G.map.W; x++) if (L().canBuyTile(x, y) && dF(x, y) < bd) { bd = dF(x, y); bt = { x, y }; }
      if (bt && bd < 13) L().buyTile(bt.x, bt.y);
    }
  }

  // Défense : puissance de feu dimensionnée pour abattre la prochaine vague en ~25 s.
  function defend(log, t) {
    const run = G.run;
    const next = G.defense.composeWave(run);
    const need = next.reduce((s, e) => s + e.hp, 0) / 25;
    const towers = run.buildings.filter(b => G.BUILDINGS[b.type].tower && b.type !== 'forum' && !b.ruined);
    const squads = G.defense.C.units.filter(u => !u.dead).reduce((s, u) => s + u.dps, 0);
    const dps = towers.reduce((s, b) => s + G.defense.towerDamage(b), 0) + G.defense.towerDamage(run.buildings[0]) + squads * 0.6;
    // La meilleure tour débloquée que l'on peut payer (laser, puis artillerie, arbalétriers, archers).
    const order = ['tour_laser', 'artillerie', 'tour_arbaletriers', 'tour_archers'].filter(t => L().isUnlocked(t));
    const type = order.find(t => L().canAfford(L().buildCost(t))) || order[order.length - 1] || 'tour_archers';
    // Bâtiments hors de portée de toute tour et de toute caserne : ce sont eux que les ennemis dévorent.
    const covered = b => towers.concat([run.buildings[0]]).some(t => Math.hypot(t.x - b.x, t.y - b.y) <= G.defense.towerRange(t)) ||
      run.buildings.some(c => G.BUILDINGS[c.type].squad && !c.ruined && Math.hypot(c.x - b.x, c.y - b.y) <= G.SOLDIERS.radius);
    const exposed = run.buildings.filter(b => !b.ruined && !G.BUILDINGS[b.type].road && !G.BUILDINGS[b.type].tower && !covered(b));
    if (exposed.length >= 3) {
      const range = G.BUILDINGS[type].tower.range;
      if (tryBuild(type, (x, y) => exposed.filter(b => Math.hypot(b.x - x, b.y - y) <= range).length)) return;
    }
    if (dps < need) {
      // Une tour neuve tant qu'il y en a peu, sinon on monte en niveau la plus faible.
      const weakest = towers.filter(b => L().levelState(b) === 'ok').sort((a, b) => (a.level || 1) - (b.level || 1))[0];
      if (towers.length >= 3 + Math.max(0, run.era - 1) * 2 && weakest) {
        if (L().levelUp(weakest)) log.push('t=' + Math.round(t) + 's ⭐ tour niv. ' + weakest.level);
      } else {
        const sd = G.defense.C.sides[0];
        const dir = sd === undefined ? null : [[0, -1], [1, 0], [0, 1], [-1, 0]][sd];
        tryBuild(type, (x, y) => -Math.abs(dF(x, y) - 3.5) + (dir ? ((x - G.map.CX) * dir[0] + (y - G.map.CY) * dir[1]) * 0.4 : 0));
      }
    }
    if (run.wave.index >= 2 && cnt('caserne') < Math.max(1, run.era)) tryBuild('caserne', (x, y) => -dF(x, y) * 0.3);
    if (cnt('caserne') && cnt('armurerie') < 1) tryBuild('armurerie');
  }

  // Goulots : ressources qui manquent pour passer d'ère, ou que plusieurs bâtiments attendent
  // (pénurie ou porteurs débordés). On ajoute un producteur, ou à défaut on monte le niveau d'un existant.
  // Producteur d'une ressource, y compris via une recette (on préfère un bâtiment sans recette).
  function producerOf(r) {
    const ids = Object.keys(G.BUILDINGS).filter(id => L().isUnlocked(id) && !G.BUILDINGS[id].wonder);
    return ids.find(id => (G.BUILDINGS[id].out || {})[r] && !G.BUILDINGS[id].recipes) ||
      ids.find(id => (G.BUILDINGS[id].recipes || []).some(rc => rc.out[r]));
  }
  function buildFor(p, r) {
    if (!tryBuild(p)) return false;
    const nb = G.run.buildings[G.run.buildings.length - 1], rc = G.BUILDINGS[p].recipes;
    if (nb && nb.type === p && rc) L().setRecipe(nb, Math.max(0, rc.findIndex(x => x.out[r])));
    return true;
  }

  function bottlenecks() {
    const run = G.run, want = {}, req = L().eraRequirements();
    if (req && req.techOk) for (const r in req.cost) if (run.res[r] < req.cost[r]) want[r] = 3;
    for (const r in wantExtra) want[r] = (want[r] || 0) + 3;
    // On remonte la chaîne : un producteur à court d'intrants signale ce qui lui manque.
    run.buildings.forEach(b => { const r = b._slow || b._waiting || b._missing; if (r) want[r] = (want[r] || 0) + 1; });
    const list = Object.keys(want).filter(r => want[r] >= 3).sort((a, b) => want[b] - want[a]);
    for (const r of list) {
      const p = producerOf(r);
      if (!p) continue;
      if (cnt(p) < 8 && buildFor(p, r)) return;
      const lv = run.buildings.filter(b => b.type === p && L().levelState(b) === 'ok').sort((a, b) => (a.level || 1) - (b.level || 1))[0];
      if (lv && L().levelUp(lv)) return;
    }
  }

  // Densifier : chaque décision, on monte d'un niveau un bâtiment productif et bien approvisionné,
  // sans entamer plus de 60 % d'une réserve (il faut garder de quoi construire).
  function levelUps(log, t) {
    const run = G.run;
    const cand = run.buildings.filter(b => {
      const d = G.BUILDINGS[b.type];
      if (L().levelState(b) !== 'ok') return false;
      if (d.pop) return (G.stats.pop || 0) < (G.stats.jobs || 0) + 4 && (b._sat || 0) > 0.8;
      if (d.storage) return Object.keys(G.capR || {}).some(r => run.res[r] > G.capR[r] * 0.8);
      return (d.out || d.energyOut) && (b._eff || 0) > 0.8 && !b._full;
    }).sort((a, b) => (a.level || 1) - (b.level || 1));
    for (const b of cand) {
      const c = L().levelCost(b);
      if (Object.keys(c).some(r => c[r] > (run.res[r] || 0) * 0.6) || !spendOk(c, b.type)) continue;
      if (L().levelUp(b)) { log.push('t=' + Math.round(t) + 's ⭐ ' + G.BUILDINGS[b.type].name + ' niv. ' + b.level); break; }
    }
  }

  // ---------- Simulation accélérée ----------
  window.BOT = function (simSeconds, opts) {
    opts = opts || {};
    if (G.bot && G.bot.active) G.bot.stop();
    G.ui.closeModal();
    L().startRun(opts.origin || 'fluviale', opts.rig === undefined ? 1 : opts.rig);
    G.run.botRun = true; // partie du bot : jamais de succès
    G.paused = true; // le bot pilote lui-même la simulation
    const loreWas = G.meta.settings.lore;
    const metaSnap = JSON.stringify(G.meta); // la simulation ne doit rien débloquer pour le joueur
    G.botSim = true;
    G.meta.settings.lore = false; // pas de bavardage pendant une simulation éclair
    const run = G.run, log = [];
    let t = 0, nextAct = 0, minForum = Infinity, fled = 0, lastIdx = 0, rateAcc = 0;
    while (t < simSeconds && !run.over && !run.launched) { // la simulation s'arrête au décollage
      while (run.pending.length) L().chooseDecree(run.pending[0].options[0]);
      answerModals();
      G.paused = true;
      G.defense.update(0.05);
      if (Math.round(t * 20) % 4 === 0) { G.economy.tick(0.2); G.chronicle.update(0.2); }
      t += 0.05; run.time += 0.05;
      rateAcc += 0.05; if (rateAcc >= 1) { G.economy.sampleRates(rateAcc); rateAcc = 0; } // débits comme dans le vrai jeu
      minForum = Math.min(minForum, run.buildings[0].hp);
      if (run.wave.index > lastIdx) { if (run.stats.wavesWon < run.wave.index - fled) fled++; lastIdx = run.wave.index; }
      if (t < nextAct) continue;
      nextAct = t + 2;
      const eraBefore = run.era;
      decide(log, t);
      if (run.era !== eraBefore) { G.ui.closeModal(); G.paused = true; }
      if (Math.round(t) % 600 === 0) {
        const S = G.stats, cells = (run.transit || []).length;
        log.push('t=' + Math.round(t) + 's ère=' + run.era + ' pop=' + S.pop.toFixed(0) + '/' + S.jobs.toFixed(0) + ' vagues=' + run.stats.wavesWon + ' fuites=' + fled +
          ' forumMin=' + minForum.toFixed(0) + ' niv.moy=' + (run.buildings.reduce((s, b) => s + (b.level || 1), 0) / run.buildings.length).toFixed(2) + ' tours=' + run.buildings.filter(b => G.BUILDINGS[b.type].tower).length + ' savoir=' + run.res.savoir.toFixed(0) + ' techs=' + Object.keys(run.techs).length + ' bâtiments=' + run.buildings.length + ' transit=' + cells);
        // Chaîne de la fin de partie : stocks, flux (par minute) et état des producteurs clés.
        const R = G.rates || {}, rr = r => Math.round(run.res[r]) + '(' + (R[r] >= 0 ? '+' : '') + (R[r] * 60).toFixed(0) + ')';
        const st = id => { const l = run.buildings.filter(b => b.type === id && !b.ruined); return l.length ? id + '×' + l.length + ' eff' + (l.reduce((s, b) => s + (b._eff || 0), 0) / l.length).toFixed(2) : ''; };
        if (run.era >= 3) log.push('   chaîne : acier=' + rr('acier') + ' minerai=' + rr('minerai_fer') + ' charbon=' + rr('charbon') + ' machines=' + rr('machines') + ' elec=' + rr('electronique') + ' alliages=' + rr('alliages') + ' carb=' + rr('carburant') + ' gemmes=' + rr('gemmes') + ' | ' +
          ['mine_fer', 'mine_charbon', 'haut_fourneau', 'usine', 'electronicien', 'fonderie_alliages', 'raffinerie', 'mine_gemmes', 'mine_or'].map(st).filter(Boolean).join(' '));
      }
    }
    log.push('FIN t=' + Math.round(t) + 's chute=' + run.over + ' ère=' + run.era + ' vagues=' + run.stats.wavesWon + ' fuites=' + fled + ' héritage=' + L().heritageGain());
    G.paused = false;
    G.botSim = false;
    const restored = JSON.parse(metaSnap);
    for (const k in G.meta) delete G.meta[k];
    Object.assign(G.meta, restored);
    G.meta.settings.lore = loreWas;
    return log.join('\n');
  };

  // ---------- Mode Bot (dans le jeu) ----------
  // Le bot joue la partie en cours dans la vraie boucle de jeu : il répond aux choix de décrets
  // et ferme les fenêtres d'ère pour que la partie continue. Toutes les vitesses (×1 à ×10) lui sont permises.
  let timer = null;
  const bot = { active: false, log: [] };

  function stepLive() {
    const run = G.run;
    if (!run || run.over) { bot.stop(); return; }
    run.botUsed = true; // marque la partie : plus aucun succès, même après un rechargement
    answerModals();
    if (G.paused || G.userPaused) return;
    decide(bot.log, run.time);
  }

  bot.start = function (opts) {
    opts = opts || {};
    if (timer) clearInterval(timer);
    if (opts.newRun || !G.run || G.run.over) {
      G.ui.closeModal();
      L().startRun(opts.origin || 'fluviale', opts.rig === undefined ? 1 : opts.rig);
      G.run.botRun = true;
      document.body.style.setProperty('--era', G.ERAS[0].color);
      G.render.invalidate(); G.render.fit();
    }
    if (opts.speed) G.meta.settings.speed = opts.speed;
    bot.active = true;
    G.userPaused = false;
    timer = setInterval(stepLive, 400);
    G.ui.refresh(true);
    return 'Mode Bot actif (×' + G.meta.settings.speed + ')';
  };

  bot.stop = function () {
    if (timer) clearInterval(timer);
    timer = null;
    bot.active = false;
    // Hors mode Bot, la vitesse redevient celle que la partie autorise.
    if (G.meta && G.run) G.meta.settings.speed = Math.min(G.meta.settings.speed || 1, G.logic.maxSpeed());
    G.ui && G.ui.refresh(true);
  };

  bot.decide = decide;
  BOT.live = opts => bot.start(Object.assign({ newRun: true, speed: 5 }, opts));
  BOT.stop = () => bot.stop();
  return bot;
})();
