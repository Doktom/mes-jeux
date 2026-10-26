// Interface DOM : barre supérieure, ressources, onglets, panneau de sélection,
// infobulles, notifications, fenêtres modales et saisie sur la carte.
G.ui = (function () {
  const U = G.util;
  const $ = s => document.querySelector(s);
  const ui = { hover: null, placing: null, selected: null, tab: 'build', modal: null, pointerDown: false };

  // ---------- Helpers HTML ----------
  // Infobulle d'une ressource demandée : besoin, stock, bilan et bâtiments qui la produisent.
  function costTip(r, need) {
    const d = G.RESOURCES[r], have = G.run.res[r] || 0, rate = (G.rates || {})[r] || 0;
    const makers = Object.keys(G.BUILDINGS).filter(id => {
      const b = G.BUILDINGS[id];
      return !b.road && !b.upgradeFrom && G.logic.isUnlocked(id) && ((b.out && b.out[r]) || (b.recipes || []).some(x => x.out && x.out[r]));
    }).map(id => G.BUILDINGS[id].icon + ' ' + G.BUILDINGS[id].name);
    return '<b>' + d.icon + ' ' + d.name + '</b><br>' + (need ? 'Nécessaire : ' + U.fmt(need) + '<br>' : '') +
      'En stock : ' + U.fmt(have) + (need ? (have >= need ? ' ✔' : ' — il manque ' + U.fmt(need - have)) : '') +
      (Math.abs(rate) > 0.005 ? '<br>Bilan : ' + U.fmtRate(rate) : '') +
      '<br>' + (d.uncapped ? 'Produit par les bâtiments savants.' : makers.length ? 'Produit par : ' + makers.slice(0, 6).join(', ') + (makers.length > 6 ? '…' : '') : 'Ressource de base (gisement, forêt, eau…).');
  }

  function costHtml(cost, opts) {
    opts = opts || {};
    return Object.keys(cost).map(r => {
      const ok = (G.run.res[r] || 0) >= cost[r];
      return '<span class="chip ' + (ok ? '' : 'lack') + '" data-tip="' + costTip(r, cost[r]) + '">' + G.RESOURCES[r].icon + ' ' + U.fmt(cost[r]) + '</span>';
    }).join('');
  }

  function flowHtml(obj, mult) {
    return Object.keys(obj).map(r => G.RESOURCES[r].icon + ' ' + U.fmt(obj[r] * (mult || 1), 2)).join(' ');
  }

  function setHTML(el, html) {
    if (!el || el._html === html) return;
    if (ui.pointerDown && el.contains(document.querySelector(':active'))) return;
    el.innerHTML = html;
    el._html = html;
  }

  function pct(v) { return Math.round(v * 100) + ' %'; }

  // ---------- Barre supérieure ----------
  function renderTop() {
    const run = G.run, S = G.stats || {}, era = G.ERAS[run.era];
    const w = run.wave;
    const forum = run.buildings[0];
    const fmax = G.economy.maxHp(forum);
    let waveTxt;
    if (!G.defense.wavesOn()) waveTxt = '<span class="pill" data-tip="Mode Paisible : aucun envahisseur. Atteignez l’ère industrielle pour débloquer les difficultés.">🕊️ Paisible</span>';
    else if (w.active) waveTxt = '<span class="pill danger pulse">⚔️ Vague ' + (w.index + 1) + ' en cours · ' + G.defense.C.enemies.length + ' ennemis</span>';
    else {
      const next = G.defense.composeWave(run);
      const boss = next.some(e => e.kind === 'boss');
      const warn = w.timer <= G.WAVES.warning;
      const SIDES = ['du nord', "de l'est", 'du sud', "de l'ouest"];
      const from = G.defense.C.sides.length ? ' · ' + G.defense.C.sides.map(s => SIDES[s]).join(' et ') : '';
      waveTxt = '<span class="pill ' + (warn ? 'warn pulse' : '') + '" data-tip="Prochaine vague : ' + next.length + ' ennemis' + (boss ? ' dont un chef 👑' : '') + '. La direction est annoncée ' + G.WAVES.warning + ' s avant l’attaque.">⏳ Vague ' + (w.index + 1) + (boss ? ' 👑' : '') + ' dans ' + U.fmtTime(w.timer) + from + '</span>';
    }
    const energy = S.energyNeed > 0 || S.energyProd > 0
      ? '<span class="pill ' + (S.energyRatio < 0.99 || S.unpowered ? 'warn' : '') + '" data-tip="Électricité produite / demandée, sur ' + (S.networks || 0) + ' réseau(x). Un bâtiment électrique doit toucher une centrale ou un relais 🗼.' + (S.unpowered ? ' ' + S.unpowered + ' bâtiment(s) non raccordé(s) !' : '') + '">⚡ ' + U.fmt(S.energyProd, 1) + ' / ' + U.fmt(S.energyNeed, 1) + (S.unpowered ? ' · 🔌 ' + S.unpowered : '') + '</span>' : '';
    const html =
      '<div class="brand">Lignées <small>V1</small></div>' +
      '<span class="pill era" style="--c:' + era.color + '">' + era.name + '</span>' +
      '<span class="pill ' + (S.workRatio < 0.98 ? 'warn' : '') + '" data-tip="Population / emplois. Si les emplois dépassent la population, tous les bâtiments ralentissent.">👥 ' + U.fmt(S.pop || 0) + ' / ' + U.fmt(S.jobs || 0) + ' emplois</span>' +
      energy + seasonHtml() + waveTxt + timedHtml() +
      '<span class="pill ' + (forum.hp < fmax * 0.5 ? 'danger' : '') + '" data-tip="Points de vie du forum. À zéro, la civilisation tombe.">🏛️ ' + U.fmt(forum.hp) + ' / ' + U.fmt(fmax) + '</span>' +
      '<span class="spacer"></span>' +
      speedHtml() +
      '<button class="btn ghost" data-action="dash">📊 Tableau de bord</button>' +
      '<button class="btn ghost" data-action="help">❔ Aide</button>' +
      '<button class="btn ghost" data-action="heritageView">🌳 Héritage</button>' +
      '<button class="btn ghost" data-action="settings">⚙️</button>';
    setHTML($('#topbar'), html);
  }

  // Saison en cours (et temps restant), bonheur des habitants.
  function seasonHtml() {
    const s = G.economy.season(), L = G.SEASONS.length, left = L - (G.run.time % L);
    let h = '<span class="pill season s' + G.economy.seasonIndex() + '" data-tip="' + s.name + ' : ' + s.desc + ' Encore ' + U.fmtTime(left) + '.">' + s.icon + ' ' + s.name + ' · ' + U.fmtTime(left) + '</span>';
    const S = G.stats || {};
    if (S.hasComfort) {
      const v = S.happiness || 0;
      h += '<span class="pill ' + (v < 0.4 ? 'warn' : '') + '" data-tip="Bonheur : confort moyen des logements (bois pour les huttes, vin pour les maisons, vin et meubles pour les immeubles). Production +' + Math.round(G.HAPPINESS.prod * v * 100) + ' % (max +' + Math.round(G.HAPPINESS.prod * 100) + ' %).">' + (v > 0.75 ? '😄' : v > 0.4 ? '🙂' : '😐') + ' ' + Math.round(v * 100) + ' %</span>';
    }
    return h;
  }

  // Effets temporaires des événements, avec le temps restant.
  function timedHtml() {
    return (G.run.timed || []).map(t => '<span class="pill timed" data-tip="' + t.label + ' — encore ' + U.fmtTime(t.until - G.run.time) + '">' + t.icon + ' ' + U.fmtTime(t.until - G.run.time) + '</span>').join('');
  }

  // ---------- Vitesse de jeu ----------
  const SPEEDS = [0.5, 1, 2, 3, 5, 10];

  // Vitesse effective : celle choisie, plafonnée par ce que la partie autorise (sauf en mode Bot).
  function speed() {
    const s = G.meta.settings.speed || 1;
    return G.bot && G.bot.active ? Math.min(s, 20) : Math.min(s, G.logic.maxSpeed());
  }

  function speedHtml() {
    const max = G.bot && G.bot.active ? 10 : G.logic.maxSpeed(), cur = speed();
    let h = '<div class="speed">' +
      '<button class="sp-btn pause ' + (G.userPaused ? 'on' : '') + '" data-action="gamePause" data-tip="Pause (Espace)">' + (G.userPaused ? '▶' : '⏸') + '</button>';
    for (const v of SPEEDS) {
      const locked = v > max;
      const tip = locked ? (v === 5 ? 'Débloqué par une Tour de l’horloge approvisionnée en rouages (technologie Horlogerie, Moyen Âge).' : 'Débloqué par une Tour de l’horloge de niveau 2 approvisionnée en rouages.') : 'Vitesse ×' + String(v).replace('.', ',');
      h += '<button class="sp-btn ' + (!G.userPaused && cur === v ? 'on' : '') + (locked ? ' locked' : '') + '" ' + (locked ? '' : 'data-action="speed:' + v + '"') + ' data-tip="' + tip + '">' +
        (locked ? '🔒' : '') + '×' + String(v).replace('.', ',') + '</button>';
    }
    return h + '</div>';
  }

  // Panneau du mode Bot et bandeau de pause, posés sur la carte.
  function renderOverlay() {
    let el = $('#overlay-ctrl');
    if (!el) { el = document.createElement('div'); el.id = 'overlay-ctrl'; $('#center').appendChild(el); }
    let html = '';
    if (G.userPaused) html += '<div class="paused-banner" data-action="gamePause">⏸ Jeu en pause — Espace ou clic pour reprendre</div>';
    let mb = $('#mapbtns');
    if (!mb) { mb = document.createElement('div'); mb.id = 'mapbtns'; $('#center').appendChild(mb); }
    setHTML(mb, '<button class="btn ' + (ui.logiView ? 'primary' : '') + '" data-action="logiView" data-tip="Affiche le trafic des porteurs et l’état des bâtiments (rouge : en attente, orange : sortie pleine ou porteurs saturés).">🚚 Vue logistique</button>');
    if (G.bot && G.bot.active) {
      html += '<div class="botbar"><b>🤖 Mode Bot</b><span>Vitesse</span>' +
        [1, 2, 3, 5, 10, 20].map(v => '<button class="sp-btn ' + ((G.meta.settings.speed || 1) === v ? 'on' : '') + '" data-action="speed:' + v + '">×' + v + '</button>').join('') +
        '<button class="btn ghost" data-action="botStop">✋ Reprendre la main</button></div>';
    }
    setHTML(el, html);
  }

  // ---------- Ressources ----------
  function renderResources() {
    const run = G.run, R = G.rates || {};
    const groups = [['base', 'Matières premières'], ['craft', 'Produits'], ['special', 'Spécial']];
    let html = '';
    for (const [g, label] of groups) {
      const items = G.RESOURCE_ORDER.filter(r => G.RESOURCES[r].group === g && (G.RESOURCES[r].era <= run.era || run.res[r] > 0));
      if (!items.length) continue;
      html += '<div class="res-group"><h4>' + label + '</h4>';
      for (const r of items) {
        const d = G.RESOURCES[r], v = run.res[r], cap = G.economy.capOf(r), rate = R[r] || 0;
        const fill = cap === Infinity ? 0 : Math.min(1, v / cap);
        html += '<div class="res" data-tip="' + resTip(r) + '">' +
          '<span class="ic">' + d.icon + '</span><span class="nm">' + d.name + '</span>' +
          '<span class="val">' + U.fmt(v) + '</span>' +
          '<span class="rate ' + (rate > 0.005 ? 'pos' : rate < -0.005 ? 'neg' : '') + '">' + (Math.abs(rate) > 0.005 ? U.fmtRate(rate) : '') + '</span>' +
          (cap !== Infinity ? '<span class="bar"><i style="width:' + (fill * 100).toFixed(1) + '%;background:' + d.color + '"></i></span>' : '') +
          '</div>';
      }
      html += '</div>';
    }
    setHTML($('#resources'), html);
    setHTML($('#hint'), '<b>Conseil</b><p>' + G.logic.hint() + '</p>');
  }

  // Bâtiments liés au bâtiment sélectionné : même type, fournisseurs (produisent ce qu'il consomme) et clients (consomment ce qu'il produit).
  function relations(b) {
    const c = ui._rel, now = performance.now();
    if (c && c.b === b && c.ver === G.buildVer && now - c.t < 1000) return c;
    const d = G.economy.def(b), need = Object.keys(G.economy.needs(b)), outs = Object.keys(d.out || {}).filter(r => !G.RESOURCES[r].uncapped);
    const rel = { b, ver: G.buildVer, t: now, same: [], sup: [], cli: [] };
    G.run.buildings.forEach(o => {
      if (o === b || o.ruined) return;
      if (o.type === b.type) rel.same.push(o);
      const od = G.economy.def(o);
      if (od.road || od.relay) return;
      const give = Object.keys(od.out || {}).filter(r => need.includes(r));
      if (give.length) rel.sup.push({ b: o, rs: give });
      if (outs.length) { const on = Object.keys(G.economy.needs(o)).filter(r => outs.includes(r)); if (on.length) rel.cli.push({ b: o, rs: on }); }
    });
    ui._rel = rel;
    return rel;
  }

  // Bloc « chaîne de production » du panneau de sélection : bouton et résumé.
  function chainBox(b) {
    let h = '<button class="btn ' + (ui.chainView ? 'primary' : '') + '" data-action="chainView" data-tip="Met en évidence sur la carte les fournisseurs (bleu) et les clients (orange) de ce bâtiment, reliés par des flèches. Les bâtiments du même type sont toujours entourés d\'or.">🔗 Chaîne de production</button>';
    if (ui.chainView) {
      const R = relations(b), line = (list, label) => '<div class="chain-line"><b>' + label + ' (' + list.length + ')</b>' +
        (list.length ? ' ' + list.slice(0, 12).map(x => '<span class="chip" data-tip="' + G.BUILDINGS[x.b.type].name + ' — ' + x.rs.map(r => G.RESOURCES[r].name).join(', ') + '">' + G.BUILDINGS[x.b.type].icon + x.rs.map(r => G.RESOURCES[r].icon).join('') + '</span>').join('') + (list.length > 12 ? ' …' : '') : ' <span class="muted">aucun</span>') + '</div>';
      h += '<div class="chain-box">' + line(R.sup, '⬅ Fournisseurs') + line(R.cli, '➡ Clients') + '<div class="chain-line"><b>Même type (' + R.same.length + ')</b></div></div>';
    }
    return h;
  }

  // Où se trouve une ressource : réserves (forum, entrepôts), stocks de sortie des producteurs, transit.
  function resTip(r) {
    const d = G.RESOURCES[r];
    if (d.uncapped) return d.name + ' : produit par les bâtiments savants, il n\'est pas transporté.';
    let stores = 0, prods = 0, tr = 0;
    for (const b of G.run.buildings) {
      if (b.ruined) continue;
      if (G.logistics.isStore(b)) stores += (b.store && b.store[r]) || 0;
      else prods += (b.out && b.out[r]) || 0;
    }
    for (const p of G.run.transit || []) if (p.r === r) tr += p.q;
    return d.name + ' — capacité ' + U.fmt(G.economy.capOf(r)) + '<br>Réserves (forum, entrepôts) : ' + U.fmt(stores) +
      '<br>Stocks de sortie des producteurs : ' + U.fmt(prods) + '<br>En transit : ' + U.fmt(tr);
  }

  // ---------- Onglets ----------
  function renderTabs() {
    const tabs = [['build', '🏗️ Construire'], ['research', '🔬 Recherche'], ['civ', '🏛️ Civilisation']];
    const readyTech = Object.keys(G.TECHS).some(id => G.logic.techState(id) === 'ready');
    const req = G.logic.eraRequirements();
    const civAlert = (req && req.techOk && req.costOk) || G.run.buildings.some(b => b.ruined) ||
      (G.run.contracts || []).some(c => c.type === 'deliver' && (G.run.res[c.r] || 0) >= c.amount);
    setHTML($('#tabs'), tabs.map(([id, l]) =>
      '<button class="tab ' + (ui.tab === id ? 'on' : '') + '" data-action="tab:' + id + '">' + l +
      ((id === 'research' && readyTech) || (id === 'civ' && civAlert) ? '<i class="dot"></i>' : '') + '</button>').join(''));
    if (ui.tab === 'build') renderBuild();
    else if (ui.tab === 'research') renderResearch();
    else renderCiv();
  }

  function renderBuild() {
    const run = G.run;
    let html = '';
    if (ui.placing) html += '<div class="placing">Placement : <b>' + G.BUILDINGS[ui.placing].name + '</b><br><small>Les cases possibles sont en vert (pointillés : hors territoire). Clic pour construire · clic droit ou Échap pour arrêter</small></div>';
    const selT = ui.selected && ui.selected.kind === 'tile' ? G.economy.terrainAt(ui.selected.x, ui.selected.y) : null;
    const selOwned = selT && G.run.owned[ui.selected.y * G.map.W + ui.selected.x];
    if (selT) html += '<div class="placing fitnote">Case sélectionnée : <b>' + G.TERRAIN[selT].name + '</b><br><small>' +
      (selOwned ? 'Les bâtiments constructibles ici sont en surbrillance : cliquez-en un pour le construire directement.' : 'Constructions possibles en surbrillance (annexez d\'abord la case).') + '</small></div>';
    for (const cat of G.BUILD_CATEGORIES) {
      const list = Object.keys(G.BUILDINGS).filter(id => {
        const d = G.BUILDINGS[id];
        return d.cat === cat.id && !d.special && d.era <= run.era && !d.upgradeFrom && (d.cat !== 'military' || G.defense.wavesOn()) && !(d.unique && G.logic.countOf(id));
      });
      const ups = Object.keys(G.BUILDINGS).filter(id => G.BUILDINGS[id].cat === cat.id && G.BUILDINGS[id].upgradeFrom && G.BUILDINGS[id].era <= run.era);
      if (!list.length && !ups.length) continue;
      html += '<h4 class="cat"><i style="background:' + cat.color + '"></i>' + cat.name + '</h4><div class="cards">';
      for (const id of list) {
        const d = G.BUILDINGS[id];
        const unlocked = G.logic.isUnlocked(id);
        if (!unlocked) {
          const tech = d.tech && G.TECHS[d.tech];
          html += '<div class="card locked" data-tip-b="' + id + '"><span class="ic">' + d.icon + '</span><div><b>' + d.name + '</b><small>🔒 ' + (tech ? tech.name : '') + '</small></div></div>';
          continue;
        }
        const cost = G.logic.buildCost(id);
        const ok = G.logic.canAfford(cost);
        const n = G.logic.countOf(id);
        const fit = selT ? (d.terrain.includes(selT) ? ' fit' : ' unfit') : '';
        html += '<div class="card ' + (ok ? '' : 'poor') + (ui.placing === id ? ' on' : '') + fit + '" data-action="place:' + id + '" data-tip-b="' + id + '">' +
          '<span class="ic" style="background:' + cat.color + '">' + d.icon + '</span>' +
          '<div><b>' + d.name + (n ? ' <em>×' + n + '</em>' : '') + '</b><div class="costs">' + costHtml(cost) + '</div></div></div>';
      }
      for (const id of ups) {
        const d = G.BUILDINGS[id];
        html += '<div class="card upgrade ' + (G.logic.isUnlocked(id) ? '' : 'locked') + '" data-tip-b="' + id + '"><span class="ic">' + d.icon + '</span><div><b>' + d.name + '</b><small>' +
          (G.logic.isUnlocked(id) ? '⬆️ Améliorez une ' + G.BUILDINGS[d.upgradeFrom].name.toLowerCase() + ' en cliquant dessus' : '🔒 ' + G.TECHS[d.tech].name) + '</small></div></div>';
      }
      html += '</div>';
    }
    setHTML($('#panel'), html);
  }

  // Panneau Recherche : résumé et accès à l'arbre ; les recherches possibles sont listées pour aller vite.
  function techCardHtml(id) {
    const run = G.run, t = G.TECHS[id], st = G.logic.techState(id), lvl = run.techs[id] || 0;
    const reqs = t.req.filter(r => !run.techs[r]).map(r => G.TECHS[r].name), cost = G.logic.techCost(id);
    return '<div class="tech ' + st + (t.eraKey ? ' key' : '') + '"' + (st === 'ready' ? ' data-action="research:' + id + '"' : '') + '>' +
      '<div class="th"><b>' + (t.eraKey ? '⭐ ' : '') + t.name + (t.repeat && lvl ? ' <em>niv. ' + lvl + '</em>' : '') + '</b>' +
      (st === 'done' ? '<span class="ok">✔</span>' : '<span class="chip ' + (st === 'ready' ? '' : 'lack') + '">📜 ' + U.fmt(cost) + '</span>') + '</div>' +
      '<small>' + t.desc + '</small>' +
      (st === 'locked' && reqs.length ? '<small class="req">Requiert : ' + reqs.join(', ') + '</small>' : '') + '</div>';
  }

  function renderResearch() {
    const run = G.run, ids = Object.keys(G.TECHS);
    const by = s => ids.filter(id => G.logic.techState(id) === s);
    const done = by('done').length, ready = by('ready'), avail = by('available').sort((a, b) => G.logic.techCost(a) - G.logic.techCost(b));
    let html = '<p class="muted">Dépensez le savoir 📜 (' + U.fmt(run.res.savoir) + ') pour débloquer bâtiments et bonus. ' + done + ' recherche(s) terminée(s).</p>' +
      '<button class="btn primary tree-open" data-action="techTree">🌳 Ouvrir l\'arbre des technologies' + (ready.length ? ' <span class="chip">' + ready.length + ' prête(s)</span>' : '') + '</button>';
    if (ready.length) html += '<h4 class="cat"><i style="background:var(--good)"></i>Prêtes à rechercher</h4><div class="techs">' + ready.map(id => techCardHtml(id)).join('') + '</div>';
    if (avail.length) html += '<h4 class="cat"><i style="background:var(--warn)"></i>Bientôt accessibles <small>(savoir insuffisant)</small></h4><div class="techs">' + avail.slice(0, 4).map(id => techCardHtml(id)).join('') + '</div>';
    if (!ready.length && !avail.length) html += '<p class="muted">Rien à rechercher pour l\'instant : consultez l\'arbre pour voir les prochaines étapes.</p>';
    setHTML($('#panel'), html);
  }

  // ---------- Arbre des technologies ----------
  const TREE = { w: 214, h: 96, gx: 62, gy: 14, head: 40, gap: 22 };

  function techTreeLayout() {
    const run = G.run, last = Math.min(run.era + 1, G.ERAS.length - 1), pos = {}, bands = [], groups = [];
    let y0 = 0, width = 0;
    for (let e = 0; e <= last; e++) groups.push({ key: e, ids: Object.keys(G.TECHS).filter(id => G.TECHS[id].era === e && !G.TECHS[id].post) });
    if (run.launched || run.techs.t_vaisseau) groups.push({ key: 'post', ids: Object.keys(G.TECHS).filter(id => G.TECHS[id].post) });
    for (const g of groups) {
      const e = g.key, ids = g.ids;
      if (!ids.length) continue;
      const depth = {};
      const dep = id => depth[id] !== undefined ? depth[id] : (depth[id] = G.TECHS[id].req.filter(r => ids.includes(r)).reduce((m, r) => Math.max(m, dep(r) + 1), 0));
      ids.forEach(dep);
      const cols = [], row = {};
      ids.forEach(id => (cols[depth[id]] = cols[depth[id]] || []).push(id));
      let rows = 1;
      cols.forEach(col => {
        const bary = id => { const ps = G.TECHS[id].req.filter(r => row[r] !== undefined); return ps.length ? ps.reduce((a, r) => a + row[r], 0) / ps.length : 99; };
        col.sort((a, b) => bary(a) - bary(b) || a.localeCompare(b));
        let cur = 0;
        col.forEach(id => { const bv = bary(id), r = Math.max(cur, bv === 99 ? 0 : Math.round(bv)); row[id] = r; cur = r + 1; });
        rows = Math.max(rows, cur);
      });
      if (e === 'post') { ids.forEach((id, i) => { depth[id] = i % 3; row[id] = Math.floor(i / 3); }); rows = Math.ceil(ids.length / 3); cols.length = 3; } // recherches infinies : grille de 3 colonnes
      ids.forEach(id => { pos[id] = { x: depth[id] * (TREE.w + TREE.gx), y: y0 + TREE.head + row[id] * (TREE.h + TREE.gy) }; });
      const h = TREE.head + rows * (TREE.h + TREE.gy) - TREE.gy + 14;
      bands.push({ era: e, y: y0, h });
      width = Math.max(width, cols.length * (TREE.w + TREE.gx) - TREE.gx);
      y0 += h + TREE.gap;
    }
    return { pos, bands, width, height: y0 - TREE.gap };
  }

  function techNodeHtml(id, p) {
    const run = G.run, t = G.TECHS[id], st = G.logic.techState(id), lvl = run.techs[id] || 0, cost = G.logic.techCost(id);
    const reqs = t.req.filter(r => !run.techs[r]).map(r => G.TECHS[r].name);
    const unl = t.effects.filter(e => e.t === 'unlock').map(e => G.BUILDINGS[e.b]);
    const ic = unl.slice(0, 6).map(b => '<i title="' + b.name + '">' + b.icon + '</i>').join('') + (unl.length > 6 ? '<i>+' + (unl.length - 6) + '</i>' : '');
    let foot;
    if (st === 'done') foot = '<span class="ok">✔ Découverte</span>';
    else if (st === 'locked') foot = '<span class="req">' + (t.post && !run.launched ? '🔒 Après le décollage du vaisseau' : '🔒 Requiert : ' + reqs.join(', ')) + '</span>';
    else if (st === 'future') foot = '<span class="req">Ère future</span>';
    else foot = '<span class="chip ' + (st === 'ready' ? 'good' : 'lack') + '">📜 ' + U.fmt(cost) + '</span>' +
      (st === 'available' ? '<span class="miss">manque ' + U.fmt(cost - run.res.savoir) + '</span>' : '<span class="go">Rechercher ▸</span>');
    return '<div class="tn ' + st + (t.eraKey ? ' key' : '') + '" style="left:' + p.x + 'px;top:' + p.y + 'px" title="' + t.desc.replace(/"/g, '&quot;') + '"' + (st === 'ready' ? ' data-action="research:' + id + '"' : '') + '>' +
      '<div class="tn-h"><b>' + (t.eraKey ? '⭐ ' : '') + t.name + '</b>' + (t.repeat && lvl ? '<em>niv. ' + lvl + '</em>' : '') + '</div>' +
      (ic ? '<div class="tn-u">' + ic + '</div>' : '') +
      '<div class="tn-d">' + t.desc + '</div><div class="tn-f">' + foot + '</div></div>';
  }

  function techTreeHtml() {
    const run = G.run, L = techTreeLayout(), ids = Object.keys(L.pos);
    let edges = '', bg = '', nodes = '';
    ids.forEach(id => G.TECHS[id].req.forEach(r => {
      const a = L.pos[r], b = L.pos[id];
      if (!a || !b) return;
      const x1 = a.x + TREE.w, y1 = a.y + TREE.h / 2, x2 = b.x, y2 = b.y + TREE.h / 2, k = Math.max(24, (x2 - x1) / 2);
      edges += '<path class="' + (run.techs[r] ? 'on' : '') + (G.logic.techState(id) === 'ready' ? ' go' : '') + '" d="M' + x1 + ' ' + y1 + ' C' + (x1 + k) + ' ' + y1 + ' ' + (x2 - k) + ' ' + y2 + ' ' + x2 + ' ' + y2 + '"/>';
    }));
    L.bands.forEach(b => {
      const E = b.era === 'post' ? G.POST_ERA : G.ERAS[b.era], all = Object.keys(G.TECHS).filter(id => b.era === 'post' ? G.TECHS[id].post : (G.TECHS[id].era === b.era && !G.TECHS[id].post));
      const n = all.filter(id => G.logic.techState(id) === 'done').length;
      bg += '<div class="tb ' + (b.era > run.era ? 'future' : '') + '" style="top:' + b.y + 'px;height:' + b.h + 'px;--c:' + E.color + '"><span>' + E.name + (b.era > run.era ? ' · ère future' : '') + ' <small>' + n + ' / ' + all.length + '</small></span></div>';
    });
    ids.forEach(id => (nodes += techNodeHtml(id, L.pos[id])));
    const cnt = s => Object.keys(G.TECHS).filter(id => G.logic.techState(id) === s).length;
    ui._treeBands = L.bands;
    return '<div class="tree-head"><div><h2>🌳 Arbre des technologies</h2><span class="muted">Chaque recherche débloque des bâtiments ou des bonus. Cliquez sur une recherche prête pour la lancer.</span></div>' +
      '<span class="pill">📜 <b id="tree-sav">' + U.fmt(run.res.savoir) + '</b> savoir</span><button class="btn ghost" data-action="closeModal">✕ Fermer</button></div>' +
      '<div class="tree-legend"><span class="lg done">✔ Découverte (' + cnt('done') + ')</span><span class="lg ready">Prête (' + cnt('ready') + ')</span><span class="lg available">Savoir insuffisant (' + cnt('available') + ')</span><span class="lg locked">Prérequis manquants (' + cnt('locked') + ')</span><span class="lg key">⭐ Clé d\'ère</span></div>' +
      '<div class="tree-scroll" id="tree-scroll"><div class="tree" style="width:' + (L.width + 2) + 'px;height:' + L.height + 'px">' + bg +
      '<svg class="tree-edges" width="' + (L.width + 2) + '" height="' + L.height + '">' + edges + '</svg>' + nodes + '</div></div>';
  }

  function techTreeModal(keepScroll) {
    const sc = $('#tree-scroll'), sl = sc ? sc.scrollLeft : 0, st = sc ? sc.scrollTop : 0;
    const first = ui.modal !== 'tech';
    openModal('tech', techTreeHtml(), { noPause: true, cls: 'wide techmodal' });
    ui._treeSig = techTreeSig();
    const el = $('#tree-scroll');
    if (!el) return;
    if (keepScroll && !first) { el.scrollLeft = sl; el.scrollTop = st; }
    else { const b = (ui._treeBands || []).find(x => x.era === (G.run.launched ? 'post' : G.run.era)); el.scrollTop = b ? Math.max(0, b.y - 6) : 0; }
  }

  function techTreeSig() { return Object.keys(G.TECHS).map(id => G.logic.techState(id)[0] + (G.run.techs[id] || 0)).join('') + G.run.era + (G.run.launched ? 'L' : ''); }

  // Liste lisible d'exigences : une ligne par ressource, avec le stock actuel, la quantité demandée et une jauge.
  // `have` donne ce qui est déjà livré (merveille en chantier) ; sinon on compare au stock.
  function reqRowsHtml(cost, have) {
    const R = G.run.res;
    let okCount = 0;
    const rows = Object.keys(cost).map(r => {
      const need = cost[r], cur = have ? (have[r] || 0) : (R[r] || 0), stock = R[r] || 0;
      const ok = cur >= need;
      if (ok) okCount++;
      const f = Math.min(1, cur / need);
      return '<div class="rq ' + (ok ? 'ok' : 'lack') + '" data-tip="' + costTip(r, need) + '"><span class="ic">' + G.RESOURCES[r].icon + '</span><span class="nm">' + G.RESOURCES[r].name + '</span>' +
        '<span class="qty"><b>' + U.fmt(cur) + '</b> / ' + U.fmt(need) + '</span><span class="mk">' + (ok ? '✔' : '✖') + '</span>' +
        '<span class="rbar"><i style="width:' + (f * 100).toFixed(0) + '%"></i></span>' +
        '<small>' + (ok ? (have ? 'Livré' : 'En stock') : (have ? 'Reste ' + U.fmt(need - cur) + ' à livrer' + (stock > 0 ? ' · ' + U.fmt(stock) + ' en stock' : ' · aucun en stock') : 'Manque ' + U.fmt(need - cur))) + '</small></div>';
    }).join('');
    return '<div class="reqs"><div class="rq-sum ' + (okCount === Object.keys(cost).length ? 'ok' : '') + '">' + okCount + ' / ' + Object.keys(cost).length + ' ressources réunies</div>' + rows + '</div>';
  }

  // Après le décollage : la partie continue, des recherches infinies rapportent un peu de gloire.
  function postLaunchHtml() {
    const run = G.run, ids = Object.keys(G.TECHS).filter(id => G.TECHS[id].post);
    const lv = ids.reduce((a, id) => a + (run.techs[id] || 0), 0), ready = ids.filter(id => G.logic.techState(id) === 'ready').length;
    return '<div class="box era-box" style="--c:' + G.POST_ERA.color + '"><h3>🌌 Au-delà des étoiles</h3>' +
      '<p class="muted">Le vaisseau a décollé, la lignée continue. Les recherches interstellaires sont <b>infinies</b> : chaque niveau renforce votre civilisation et rapporte un peu de gloire ✨ (versée à la fin de la partie).</p>' +
      '<div class="kv"><span>Niveaux interstellaires</span><b>' + lv + '</b></div><div class="kv"><span>Gloire de cette partie</span><b>✨ ' + (run.gloryEarned || 0) + '</b></div>' +
      '<button class="btn primary" data-action="techTree">🌳 Ouvrir l\'arbre' + (ready ? ' (' + ready + ' prête' + (ready > 1 ? 's' : '') + ')' : '') + '</button>' +
      '<small class="muted">Quand vous le voulez, transmettez l\'héritage : il est majoré (×1,5 et +50) grâce au décollage.</small></div>';
  }

  // Marché : offres d'échange en cours.
  function marketHtml() {
    const run = G.run, m = G.logic.market();
    if (!m) return '';
    let h = '<div class="box"><h3>🏪 Marché <small class="muted">niv. ' + (m.level || 1) + ' · nouvelles offres dans ' + U.fmtTime(run.tradeTimer || 0) + '</small></h3>';
    const list = run.trades || [];
    if (!list.length) h += '<p class="muted">Aucune offre pour l\'instant : les marchands attendent que vos réserves se remplissent.</p>';
    list.forEach((t, i) => {
      const ok = (run.res[t.give] || 0) >= t.a;
      h += '<div class="trade"><span>' + G.RESOURCES[t.give].icon + ' ' + U.fmt(t.a) + ' ' + G.RESOURCES[t.give].name.toLowerCase() + '</span><b>→</b><span>' + G.RESOURCES[t.get].icon + ' ' + U.fmt(t.b) + ' ' + G.RESOURCES[t.get].name.toLowerCase() + '</span>' +
        '<button class="btn ' + (ok ? 'primary' : '') + '" ' + (ok ? 'data-action="trade:' + i + '"' : 'disabled') + '>Échanger</button></div>';
    });
    return h + '</div>';
  }

  // Contrats de la Chronique : objectif, progression, temps restant, récompense.
  function contractsHtml() {
    const run = G.run, list = run.contracts || [];
    let h = '<div class="box"><h3>📜 Contrats de la Chronique</h3>';
    if (!list.length) h += '<p class="muted">Maître Hulotte rédige de nouveaux contrats… Revenez dans un instant.</p>';
    for (const c of list) {
      const p = G.chronicle.progress(c), f = Math.min(1, p / c.amount), left = c.until - run.time;
      const rew = '🌳 ' + c.heritage + (c.favor ? ' · 🎁 une faveur' : '') + (c.reward ? Object.keys(c.reward).map(r => ' · ' + G.RESOURCES[r].icon + ' ' + U.fmt(c.reward[r])).join('') : '');
      h += '<div class="contract"><div class="c-head"><b>' + G.chronicle.label(c) + '</b><span class="' + (left < 120 ? 'neg' : 'muted') + '">⌛ ' + U.fmtTime(left) + '</span></div>' +
        '<span class="sbar"><i style="width:' + (f * 100).toFixed(1) + '%"></i></span>' +
        '<div class="c-foot"><small>' + U.fmt(Math.min(p, c.amount)) + ' / ' + U.fmt(c.amount) + '</small><small>Récompense : ' + rew + '</small></div>' +
        (c.type === 'deliver' ? '<button class="btn ' + (f >= 1 ? 'primary' : '') + '" ' + (f >= 1 ? 'data-action="deliver:' + c.id + '"' : 'disabled') + '>📦 Livrer au forum</button>' : '') + '</div>';
    }
    return h + '</div>';
  }

  function renderCiv() {
    const run = G.run, req = G.logic.eraRequirements();
    let html = '';
    // Passage d'ère.
    if (req) {
      const next = G.ERAS[run.era + 1];
      html += '<div class="box era-box" style="--c:' + next.color + '"><h3>Vers : ' + next.name + '</h3>' +
        '<div class="rq tech ' + (req.techOk ? 'ok' : 'lack') + '"><span class="ic">🔬</span><span class="nm">Technologie</span><span class="qty"><b>' + G.TECHS[req.tech].name + '</b></span><span class="mk">' + (req.techOk ? '✔' : '✖') + '</span>' +
        '<small>' + (req.techOk ? 'Découverte' : 'À rechercher (📜 ' + U.fmt(G.logic.techCost(req.tech)) + ')') + '</small></div>' +
        reqRowsHtml(req.cost) +
        '<button class="btn primary" ' + (req.techOk && req.costOk ? 'data-action="advance"' : 'disabled') + '>Entrer dans le ' + next.name + '</button>' +
        '<small class="muted">Récompenses : un anneau de territoire gratuit, un nouveau décret, de nouveaux bâtiments.</small></div>';
    } else if (run.launched) {
      html += postLaunchHtml();
    } else {
      const pad = run.buildings.find(b => G.BUILDINGS[b.type].wonder && G.BUILDINGS[b.type].wonder.launch);
      html += '<div class="box era-box" style="--c:' + G.ERAS[run.era].color + '"><h3>🚀 Objectif final : quitter la planète</h3>' +
        '<p class="muted">Recherchez <b>Vaisseau interstellaire</b>, construisez le <b>pas de tir</b>, livrez-lui les matériaux, puis lancez le vaisseau. La partie s\'achève en triomphe : héritage ×1,5 et +50 points.</p>' +
        (G.logic.launchReady() ? '<button class="btn primary big" data-action="launch">🚀 Lancer le vaisseau</button>' :
          '<div class="rq tech ' + (run.techs.t_vaisseau ? 'ok' : 'lack') + '"><span class="ic">🔬</span><span class="nm">Technologie</span><span class="qty"><b>Vaisseau interstellaire</b></span><span class="mk">' + (run.techs.t_vaisseau ? '✔' : '✖') + '</span></div>' +
          '<div class="rq tech ' + (pad ? 'ok' : 'lack') + '"><span class="ic">🚀</span><span class="nm">Pas de tir (2×2 cases)</span><span class="qty"><b>' + (pad ? 'Construit' : 'À construire') + '</b></span><span class="mk">' + (pad ? '✔' : '✖') + '</span>' +
          (pad ? '' : '<small>Coût : ' + Object.keys(G.BUILDINGS.pas_de_tir.cost).map(r => G.RESOURCES[r].icon + ' ' + U.fmt(G.BUILDINGS.pas_de_tir.cost[r])).join(' · ') + '</small>') + '</div>' +
          (pad ? '<h4 class="cat">Matériaux à livrer au vaisseau</h4>' + reqRowsHtml(G.BUILDINGS.pas_de_tir.wonder.cost, pad.progress || {}) : '')) + '</div>';
    }
    html += contractsHtml();
    html += marketHtml();
    // Ruines.
    const ruins = run.buildings.filter(b => b.ruined);
    if (ruins.length) {
      const total = {};
      ruins.forEach(b => { const c = G.logic.repairCost(b); for (const r in c) total[r] = (total[r] || 0) + c[r]; });
      html += '<div class="box warnbox"><h3>' + ruins.length + ' bâtiment(s) en ruine</h3><div class="costs">' + costHtml(total) + '</div><button class="btn" data-action="repairAll">🪛 Tout réparer</button></div>';
    }
    // Décrets.
    html += '<div class="box"><h3>Décrets</h3>';
    if (!run.decrees.length && !run.minors.length) html += '<p class="muted">Aucun décret pour l\'instant.</p>';
    run.decrees.forEach(id => { const d = G.DECREES_MAJOR[id]; html += '<div class="decree-line"><span>' + d.icon + '</span><div><b>' + d.name + '</b><small>' + d.desc + '</small></div></div>'; });
    const minorCount = {};
    run.minors.forEach(id => (minorCount[id] = (minorCount[id] || 0) + 1));
    for (const id in minorCount) { const d = G.DECREES_MINOR[id]; html += '<div class="decree-line minor"><span>' + d.icon + '</span><div><b>' + d.name + (minorCount[id] > 1 ? ' ×' + minorCount[id] : '') + '</b><small>' + d.desc + '</small></div></div>'; }
    html += '</div>';
    // Partie.
    const o = G.ORIGINS[run.origin];
    html += '<div class="box"><h3>Votre lignée</h3>' +
      '<div class="kv"><span>Origine</span><b>' + o.icon + ' ' + o.name + '</b></div>' +
      '<div class="kv"><span>Difficulté</span><b>' + G.RIGUEUR[run.rigueur].name + '</b></div>' +
      '<div class="kv"><span>Durée</span><b>' + U.fmtTime(run.time) + '</b></div>' +
      '<div class="kv"><span>Vagues repoussées</span><b>' + run.stats.wavesWon + '</b></div>' +
      '<div class="kv"><span>Ennemis vaincus</span><b>' + run.stats.kills + '</b></div>' +
      '<div class="kv"><span data-tip="La gloire s\'accumule pendant la partie et n\'est versée qu\'à la transmission de l\'héritage (fin de partie).">Gloire accumulée ⓘ</span><b>✨ ' + (run.gloryEarned || 0) + '</b></div>' +
      '<div class="kv"><span>Héritage si la partie s\'arrêtait</span><b>🌳 ' + G.logic.heritageGain() + '</b></div>' +
      '<button class="btn ghost" data-action="abdicate">🏳️ Transmettre l\'héritage (finir la partie)</button></div>';
    setHTML($('#panel'), html);
  }

  // Chemin d'annexion mis en cache (recalculé si la case ou le territoire change).
  function annexInfo(x, y) {
    const key = x + ',' + y + ':' + G.run.tilesBought + ':' + G.run.era;
    if (!ui.annex || ui.annex.key !== key) { ui.annex = G.logic.annexPath(x, y); if (ui.annex) ui.annex.key = key; }
    return ui.annex;
  }

  // ---------- Panneau de sélection ----------
  function renderSelection() {
    const sel = ui.selected;
    const el = $('#selection');
    if (!sel || sel.kind !== 'tile') ui.annex = null;
    if (!sel) { el.classList.add('hidden'); setHTML(el, ''); return; }
    el.classList.remove('hidden');
    let html = '<button class="close" data-action="deselect">✕</button>';
    if (sel.kind === 'tile') {
      const t = G.economy.terrainAt(sel.x, sel.y);
      const def = G.TERRAIN[t];
      const owned = G.run.owned[sel.y * G.map.W + sel.x];
      html += '<h3>' + def.name + '</h3>' + (def.desc ? '<p class="muted">' + def.desc + '</p>' : '');
      const fits = Object.keys(G.BUILDINGS).filter(id => G.logic.isUnlocked(id) && G.BUILDINGS[id].terrain.includes(t) && !G.BUILDINGS[id].upgradeFrom);
      if (fits.length) html += '<p class="muted">Constructible : ' + fits.map(id => G.BUILDINGS[id].icon + ' ' + G.BUILDINGS[id].name).join(', ') + '</p>';
      if (!owned) {
        if (G.logic.canBuyTile(sel.x, sel.y)) {
          const c = G.logic.tileCost();
          html += '<div class="costs">' + costHtml(c) + '</div><button class="btn primary" ' + (G.logic.canAfford(c) ? 'data-action="buyTile"' : 'disabled') + '>🗺️ Annexer cette case</button>';
        } else {
          const a = annexInfo(sel.x, sel.y);
          if (a && a.path.length) html += '<p class="muted">Cette case est à ' + a.path.length + ' cases de votre territoire. Le chemin le plus court est surligné sur la carte.</p>' +
            '<div class="costs">' + costHtml(a.cost) + '</div><button class="btn primary" ' + (G.logic.canAfford(a.cost) ? 'data-action="annexTo"' : 'disabled') + '>🗺️ Annexer jusqu\'ici (' + a.path.length + ' cases)</button>';
        }
      }
    } else {
      const b = sel.b, d = G.economy.def(b);
      if (!G.run.buildings.includes(b)) { ui.selected = null; return; }
      const max = G.economy.maxHp(b);
      const status = b.ruined ? '<span class="tag bad">En ruine</span>' : b.paused ? '<span class="tag">En pause</span>' :
        b._depleted ? '<span class="tag bad">Gisement épuisé</span>' :
        b._full ? '<span class="tag warn">Sortie pleine</span>' : b._waiting ? '<span class="tag warn">Attend : ' + G.RESOURCES[b._waiting].name + '</span>' :
        b._slow ? '<span class="tag warn" data-tip="Du stock existe, mais tous les porteurs des sources sont en route.">Livraison lente : ' + G.RESOURCES[b._slow].name + '</span>' :
        b._missing ? '<span class="tag warn">Manque : ' + G.RESOURCES[b._missing].name + '</span>' : '<span class="tag good">Actif</span>';
      const k = G.economy.lv(b), lvl = b.level || 1, maxL = G.logic.maxLevel();
      html += '<h3>' + d.icon + ' ' + d.name + ' ' + status + '</h3><p class="muted">' + (d.desc || '') + '</p>';
      if (G.economy.mastery(b.type) > 1) html += '<div class="kv"><span data-tip="Bonus permanent acheté avec des cartes (écran Lignées → Maîtrise)">Maîtrise ⓘ</span><b class="pos">×' + G.economy.mastery(b.type) + ' production et stocks</b></div>';
      html += '<div class="kv"><span>Niveau</span><b class="lvl-pips">' + '<i class="on"></i>'.repeat(lvl) + '<i></i>'.repeat(Math.max(0, maxL - lvl)) + ' ' + lvl + ' / ' + maxL + '</b></div>';
      html += '<div class="kv"><span>Points de vie</span><b>' + U.fmt(b.hp) + ' / ' + U.fmt(max) + '</b></div>';
      if (d.pop) {
        const base = (b.type === 'forum' ? d.pop : d.pop + (G.M.popFlat[b.type] || 0)) * k.pop;
        html += '<div class="kv"><span>Habitants</span><b>' + U.fmt(b._pop || 0, 1) + ' / ' + U.fmt(b.type === 'forum' ? base : base * Math.max(0.2, 1 + G.M.pop + (b._adj || 0)), 1) + '</b></div>';
        if (d.comfort) html += '<div class="kv"><span>Confort</span><b>' + flowHtml(G.economy.comfort(b)) + ' /s · ' + pct(b._comfort === undefined ? 0 : b._comfort) + '</b></div>';
        if (d.consume) html += '<div class="kv"><span>Besoins</span><b>' + flowHtml(G.economy.survival(b)) + ' /s</b></div>' +
          '<div class="kv"><span>Satisfaction</span><b>' + pct(b._sat === undefined ? 1 : b._sat) + '</b></div>';
      }
      if (d.workers || d.in || d.out || d.energyOut) {
        const S = G.stats;
        html += '<div class="kv"><span>Efficacité</span><b>' + pct(b._eff || 0) + '</b></div>';
        if (d.workers) html += '<div class="kv sub"><span>Main-d\'œuvre (' + U.fmt(d.workers * k.work, 1) + ')</span><b>' + pct(S.workRatio) + '</b></div>';
        if (d.energyIn) html += '<div class="kv sub"><span>Électricité (' + U.fmt(d.energyIn * k.io, 1) + ' ⚡)</span><b class="' + (G.power.networks().netOf[b.bid] === undefined ? 'neg' : '') + '">' +
          (G.power.networks().netOf[b.bid] === undefined ? '🔌 non raccordé' : pct(b._power === undefined ? 1 : b._power)) + '</b></div>';
        if (d.in) html += '<div class="kv"><span>Consomme</span><b>' + flowHtml(d.in, (b._eff || 0) * k.io) + ' /s</b></div>';
        if (d.out || d.energyOut) {
          const m = b._mult || 1;
          html += '<div class="kv"><span>Bonus total</span><b class="' + (m >= 1 ? 'pos' : 'neg') + '">×' + m.toFixed(2) + '</b></div>';
          html += '<div class="kv sub"><span>dont voisinage</span><b>' + ((b._adj || 0) >= 0 ? '+' : '') + Math.round((b._adj || 0) * 100) + ' %</b></div>';
          if (d.out) html += '<div class="kv"><span>Produit</span><b class="pos">' + flowHtml(d.out, (b._eff || 0) * m * k.io) + ' /s</b></div>';
          if (d.energyOut) html += '<div class="kv"><span>Produit</span><b class="pos">⚡ ' + U.fmt(b._eout || 0, 1) + ' / ' + U.fmt(d.energyOut * m * k.io * G.power.weather(d), 1) + (b._throttle === 0 ? ' (veille)' : '') + '</b></div>' +
            (d.weather ? '<div class="kv sub"><span>Météo (' + G.economy.season().name.toLowerCase() + ')</span><b>×' + String(G.power.weather(d)).replace('.', ',') + '</b></div>' : '');
        }
      }
      if (B0(b).recipes) html += '<div class="opt"><span>Recette</span><div class="seg">' + B0(b).recipes.map((rc, i) =>
        '<button class="sp-btn ' + ((b.recipe || 0) === i ? 'on' : '') + '" data-action="recipe:' + i + '" data-tip="' + flowHtml(rc.in) + ' → ' + flowHtml(rc.out) + ' /s">' + rc.name + '</button>').join('') + '</div></div>';
      if (Object.keys(G.economy.needs(b)).length && !G.logistics.isStore(b)) html += '<div class="opt"><span data-tip="Les bâtiments prioritaires sont livrés en premier quand les porteurs ne suffisent pas.">Priorité ⓘ</span><div class="seg">' +
        [[0, 'Basse'], [1, 'Normale'], [2, 'Haute']].map(([v, l]) => '<button class="sp-btn ' + ((b.prio === undefined ? 1 : b.prio) === v ? 'on' : '') + '" data-action="prio:' + v + '">' + l + '</button>').join('') + '</div></div>';
      const dep = G.economy.depositOf(b);
      if (dep !== null && dep !== false && G.DEPOSITS_INFINITE) {
        html += '<div class="kv"><span>Gisement</span><b class="pos">∞ inépuisable</b></div>';
      } else if (dep !== null && dep !== false) {
        const left = G.run.deposits[dep], rate = Object.keys(d.out || {}).reduce((s, r) => s + d.out[r] * k.io * (b._eff || 0) * (b._mult || 1), 0);
        html += '<div class="kv"><span>Gisement restant</span><b>' + U.fmt(left) + (rate > 0.001 ? ' (~' + U.fmtTime(left / rate) + ')' : '') + '</b></div>';
      } else if (dep === false) html += '<p class="muted">Ce gisement est épuisé : démolissez la mine et cherchez un nouveau filon.</p>';
      if (G.logistics.isStore(b)) html += storeHtml(b);
      else if (d.in || d.out || d.consume || d.boost) html += stocksHtml(b, d);
      if (G.logistics.srcStock(b)) html += carrierHtml(b);
      if (d.energyOut || d.relay || d.energyIn) html += gridHtml(b);
      if (d.wonder) html += wonderHtml(b, d);
      if (d.wonder && d.wonder.launch && b.done && !b.ruined && !G.run.launched) html += '<button class="btn primary big" data-action="launch">🚀 Lancer le vaisseau</button>';
      if (d.tower && (b.level || 1) >= 3 && b.type !== 'forum') {
        if (b.spec) html += '<div class="kv"><span>Spécialisation</span><b>' + G.TOWER_SPECS[b.spec].icon + ' ' + G.TOWER_SPECS[b.spec].name + '</b></div>';
        else html += '<div class="upbox lvlbox"><b>🎯 Choisir une spécialisation</b><small>Définitive. Une seule par tour.</small><div class="ev-choices">' +
          Object.keys(G.TOWER_SPECS).map(k => '<button class="btn" data-action="spec:' + k + '">' + G.TOWER_SPECS[k].icon + ' ' + G.TOWER_SPECS[k].name + ' — <small>' + G.TOWER_SPECS[k].desc + '</small></button>').join('') + '</div></div>';
      } else if (d.tower && b.type !== 'forum') html += '<small class="muted">🎯 Au niveau 3, cette tour pourra se spécialiser (portée, cadence ou zone).</small>';
      if (d.squad) html += '<div class="opt"><span>Ordre</span><div class="seg">' + Object.keys(G.SQUAD_ORDERS).map(k =>
        '<button class="sp-btn ' + ((b.order || 'defend') === k ? 'on' : '') + '" data-action="order:' + k + '" data-tip="' + G.SQUAD_ORDERS[k].name + '">' + G.SQUAD_ORDERS[k].icon + '</button>').join('') + '</div></div>' +
        (b.order === 'rally' ? '<small class="muted">' + (ui.rallyFor === b ? '👉 Cliquez une case de la carte pour placer le point de ralliement.' : 'Point de ralliement ' + (b.rally ? 'placé.' : 'non défini.') + ' <a href="#" data-action="order:rally">Déplacer</a>') + '</small>' : '');
      if (d.squad) {
        const n = G.defense.squadSize(b), us = G.defense.C.units.filter(u => u.home === b.bid), st = G.defense.unitStats(b);
        const dead = us.filter(u => u.dead);
        html += '<div class="stocks"><h5>🛡️ Escouade</h5><div class="kv"><span>' + st.name + 's</span><b>' + (us.length - dead.length) + ' / ' + n + '</b></div>' +
          '<div class="kv sub"><span>Par soldat</span><b>❤️ ' + U.fmt(st.maxHp) + ' · ⚔️ ' + U.fmt(st.dps, 1) + '/s</b></div>' +
          (dead.length ? '<div class="kv sub"><span>Renfort</span><b>dans ' + Math.ceil(Math.min(...dead.map(u => u.respawn))) + ' s</b></div>' : '') +
          (n ? '' : '<small class="note">Caserne inactive : sans nourriture ni main-d’œuvre, pas de soldats.</small>') + '</div>';
      }
      if (d.clock) html += '<div class="kv"><span>Vitesse débloquée</span><b>' + ((b._eff || 0) >= 0.5 ? '×' + ((b.level || 1) >= 2 ? 10 : 5) : '— (manque de rouages)') + '</b></div>';
      if (d.tower) {
        html += '<div class="kv"><span>Dégâts / s</span><b>' + U.fmt(G.defense.towerDamage(b), 1) + '</b></div>' +
          '<div class="kv"><span>Portée</span><b>' + String(G.defense.towerRange(b)).replace('.', ',') + ' cases</b></div>';
        if (d.boost) html += '<div class="kv sub"><span>Armes (×' + d.boost.mult + ')</span><b>' + (b._boosted ? '✔ approvisionnée' : '✗ sans armes') + '</b></div>';
      }
      html += '<div class="actions">';
      if (b.ruined) {
        const c = G.logic.repairCost(b);
        html += '<div class="costs">' + costHtml(c) + '</div><button class="btn primary" ' + (G.logic.canAfford(c) ? 'data-action="repair"' : 'disabled') + '>🪛 Réparer</button>';
      } else if (b.type !== 'forum' && (d.workers || d.in)) {
        html += '<button class="btn" data-action="pause">' + (b.paused ? '▶️ Reprendre' : '⏸ Pause') + '</button>';
      }
      if (!b.ruined) html += chainBox(b);
      html += levelBox(b, d);
      const up = G.logic.upgradeTarget(b);
      if (up && !b.ruined) {
        const c = G.logic.buildCost(up);
        html += '<div class="upbox"><b>⬆️ ' + G.BUILDINGS[up].name + '</b><small>' + G.BUILDINGS[up].desc + '</small><div class="costs">' + costHtml(c) + '</div>' +
          '<button class="btn primary" ' + (G.logic.canAfford(c) ? 'data-action="upgrade"' : 'disabled') + '>Améliorer</button></div>';
      } else if (d.upgradeTo && !b.ruined && G.BUILDINGS[d.upgradeTo].era <= G.run.era + 1) {
        html += '<small class="muted">Amélioration future : ' + G.BUILDINGS[d.upgradeTo].name + ' (🔒 ' + G.TECHS[G.BUILDINGS[d.upgradeTo].tech].name + ')</small>';
      }
      if (b.type !== 'forum') html += '<button class="btn ghost danger" data-action="demolish">🗑️ Démolir' + (b.ruined ? '' : ' (50 % remboursé)') + '</button>';
      html += '</div>';
    }
    setHTML(el, html);
  }

  // Stocks locaux : réserve d'intrants à l'entrée, production en attente à la sortie.
  function stocksHtml(b, d) {
    const row = (r, v, cap, kind) => {
      const f = cap > 0 ? Math.min(1, v / cap) : 0;
      return '<div class="stock ' + kind + (kind === 'out' && f > 0.98 ? ' full' : kind === 'in' && f < 0.02 ? ' empty' : '') + '">' +
        '<span>' + G.RESOURCES[r].icon + ' ' + G.RESOURCES[r].name + '</span><b>' + U.fmt(v, 1) + ' / ' + U.fmt(cap, 1) + '</b>' +
        '<span class="sbar"><i style="width:' + (f * 100).toFixed(1) + '%;background:' + G.RESOURCES[r].color + '"></i></span></div>';
    };
    let h = '<div class="stocks"><h5 data-tip="Le bâtiment garde une réserve d’intrants pour continuer à tourner quelques secondes en cas de pénurie. Sa production attend à la sortie quand l’entrepôt commun est plein ; si la sortie déborde, le bâtiment s’arrête. Les stocks grandissent avec le niveau.">📦 Stocks du bâtiment ⓘ</h5>';
    const nd = G.economy.needs(b), ins = Object.keys(nd);
    if (ins.length) { h += '<small>Entrée (livrée par les porteurs)</small>'; for (const r of ins) h += row(r, (b.inp || {})[r] || 0, G.economy.inCap(b, r), 'in'); }
    const outs = Object.keys(d.out || {}).filter(r => !G.RESOURCES[r].uncapped);
    if (outs.length) { h += '<small>Sortie (à expédier)</small>'; for (const r of outs) h += row(r, (b.out || {})[r] || 0, G.economy.outCap(b, d, r), 'out'); }
    return h + '</div>';
  }

  function B0(b) { return G.BUILDINGS[b.type]; }

  // Réseau électrique d'un bâtiment : production et demande totales, nombre de raccordés.
  function gridHtml(b) {
    const net = G.power.networks(), id = net.netOf[b.bid];
    if (id === undefined) return '<p class="muted">🔌 Ce bâtiment ne touche aucune centrale ni aucun relais électrique relié : il ne reçoit pas de courant.</p>';
    let prod = 0, need = 0, nb = 0;
    for (const o of G.run.buildings) {
      if (net.netOf[o.bid] !== id) continue;
      const d = G.BUILDINGS[o.type];
      if (d.energyOut) prod += o._eout || 0;
      if (d.energyIn && !o.paused && !o.ruined) { need += d.energyIn * G.economy.lv(o).io; nb++; }
    }
    return '<div class="stocks"><h5 data-tip="Les centrales et relais qui se touchent forment un réseau. Les bâtiments électriques qui le touchent se partagent son courant.">⚡ Réseau électrique ⓘ</h5>' +
      '<div class="kv"><span>Production / demande</span><b class="' + (prod + 0.01 < need ? 'neg' : 'pos') + '">' + U.fmt(prod, 1) + ' / ' + U.fmt(need, 1) + ' ⚡</b></div>' +
      '<div class="kv sub"><span>Bâtiments alimentés</span><b>' + nb + '</b></div></div>';
  }

  // Chantier de merveille : matériaux livrés / demandés.
  function wonderHtml(b, d) {
    const w = d.wonder, pr = b.progress || {};
    if (b.done) return '<div class="stocks"><h5>🏆 Merveille achevée</h5><small class="note">' + w.bonus + '</small></div>';
    let h = '<div class="stocks"><h5>🏗️ Chantier en cours</h5><small class="note">Les porteurs livrent les matériaux depuis vos réserves et producteurs. Bonus une fois achevée : ' + w.bonus + '</small>';
    for (const r in w.cost) {
      const v = pr[r] || 0, f = Math.min(1, v / w.cost[r]);
      h += '<div class="stock"><span>' + G.RESOURCES[r].icon + ' ' + G.RESOURCES[r].name + '</span><b>' + U.fmt(v) + ' / ' + U.fmt(w.cost[r]) + '</b>' +
        '<span class="sbar"><i style="width:' + (f * 100).toFixed(1) + '%;background:' + G.RESOURCES[r].color + '"></i></span></div>';
    }
    return h + '</div>';
  }

  // Contenu d'une réserve (forum, entrepôt) et, pour un entrepôt, les ressources acceptées.
  function storeHtml(b) {
    const cap = G.logistics.storeCap(b), st = b.store || {};
    const items = G.RESOURCE_ORDER.filter(r => (st[r] || 0) >= 0.5);
    let h = '<div class="stocks"><h5>🏚️ Réserve · ' + U.fmt(cap) + ' max par ressource</h5>';
    if (!items.length) h += '<small>Vide</small>';
    for (const r of items) {
      const f = Math.min(1, st[r] / cap);
      h += '<div class="stock"><span>' + G.RESOURCES[r].icon + ' ' + G.RESOURCES[r].name + '</span><b>' + U.fmt(st[r]) + '</b>' +
        '<span class="sbar"><i style="width:' + (f * 100).toFixed(1) + '%;background:' + G.RESOURCES[r].color + '"></i></span></div>';
    }
    if (b.type === 'forum') h += '<small class="note">Le forum ne reçoit pas de livraisons : il garde les ressources de départ, le butin et les remboursements.</small>';
    else {
      const res = G.RESOURCE_ORDER.filter(r => !G.RESOURCES[r].uncapped && G.RESOURCES[r].era <= G.run.era);
      h += '<small>Accepte (cliquer pour changer)</small><div class="accept">' + res.map(r => '<button class="acc ' + (!b.accept || b.accept.includes(r) ? 'on' : '') + '" data-action="accept:' + r + '" data-tip="' + G.RESOURCES[r].name + '">' + G.RESOURCES[r].icon + '</button>').join('') +
        '</div><div class="seg"><button class="sp-btn" data-action="acceptAll">Tout</button><button class="sp-btn" data-action="acceptNone">Rien</button></div>';
    }
    return h + '</div>';
  }

  // Porteurs : nombre, charge, occupation et débit selon la distance.
  function carrierHtml(b) {
    const L = G.logistics, n = L.carriers(b), busy = (b.trips || []).filter(t => t > (G.run.lt || 0)).length;
    const tp = d => U.fmtFlow(L.throughput(b, d));
    return '<div class="stocks"><h5 data-tip="Chaque porteur emporte une cellule de ressources et reste occupé pendant l’aller-retour. Plus la destination est loin, plus le débit baisse : gardez les chaînes de production courtes.">🚚 Porteurs ⓘ</h5>' +
      '<div class="kv"><span>En route</span><b>' + busy + ' / ' + n + '</b></div>' +
      '<div class="kv"><span>Charge par cellule</span><b>' + U.fmt(L.carry(b), 1) + '</b></div>' +
      '<div class="kv sub"><span>Débit max à 2 / 5 / 10 cases</span><b>' + tp(2) + ' · ' + tp(5) + ' · ' + tp(10) + '</b></div></div>';
  }

  // Montée de niveau : gains du niveau suivant, coût et bouton.
  function levelBox(b, d) {
    const st = G.logic.levelState(b), lvl = b.level || 1, K = G.LEVELS;
    if (st === 'ruined' || st === 'none') return '';
    if (st === 'max') {
      const next = K.maxByEra.findIndex(m => m > lvl);
      return '<small class="muted">' + (next < 0 ? '⭐ Niveau maximum atteint.' : '🔒 Niveau ' + (lvl + 1) + ' disponible : ' + G.ERAS[next].name + '.') + '</small>';
    }
    const gains = [];
    const p = v => '+' + Math.round(v * 100) + ' %';
    if (d.out || d.in || d.energyOut) gains.push(p(K.io) + ' production et stocks');
    if (d.workers) gains.push(p(K.work) + ' emplois');
    if (d.pop) gains.push(p(K.pop) + ' habitants' + (d.consume ? ' (et besoins)' : ''));
    if (d.tower) gains.push(p(K.tower) + ' dégâts, +0,5 case de portée');
    if (d.storage) gains.push(p(K.store) + ' capacité');
    gains.push(p(d.wall ? K.wallHp : K.hp) + ' PV');
    const c = G.logic.levelCost(b);
    let all = '';
    const info = G.logic.levelAllInfo(b);
    if (info.list.length > 1) {
      all = '<div class="lvl-all"><small>Tous les ' + d.name.toLowerCase() + 's de niveau ' + lvl + ' : <b>' + info.list.length + '</b> (coût total)</small><div class="costs">' + costHtml(info.total) + '</div>' +
        '<button class="btn" ' + (info.afford > 0 ? 'data-action="levelUpAll"' : 'disabled') + '>⭐ Monter ' + (info.afford >= info.list.length ? 'les ' + info.list.length : info.afford + ' sur ' + info.list.length) + ' au niveau ' + (lvl + 1) + '</button></div>';
    }
    return '<div class="upbox lvlbox"><b>⭐ Niveau ' + (lvl + 1) + '</b><small>' + gains.join(' · ') + '</small><div class="costs">' + costHtml(c) + '</div>' +
      '<button class="btn primary" ' + (st === 'ok' ? 'data-action="levelUp"' : 'disabled') + '>Monter de niveau</button>' + all + '</div>';
  }

  // ---------- Infobulles ----------
  function buildingTip(id) {
    const d = G.BUILDINGS[id];
    let h = '<b>' + d.icon + ' ' + d.name + '</b><p>' + (d.desc || '') + '</p>';
    if (d.cost && G.run) {
      const c = G.logic.buildCost(id);
      h += '<div class="tt-cost"><b>Coût :</b> ' + Object.keys(c).map(r => {
        const have = G.run.res[r] || 0;
        return '<span class="' + (have >= c[r] ? 'ok' : 'lack') + '">' + U.fmt(c[r]) + ' ' + G.RESOURCES[r].name.toLowerCase() + ' <small>(' + U.fmt(have) + ' en stock)</small></span>';
      }).join(', ') + '</div>';
    }
    h += '<div class="tt-row">Terrain : ' + d.terrain.map(t => G.TERRAIN[t].name).join(', ') + '</div>';
    if (d.workers) h += '<div class="tt-row">👥 ' + d.workers + ' travailleurs</div>';
    if (d.pop) h += '<div class="tt-row">🏠 ' + d.pop + ' habitants · besoins ' + flowHtml(d.consume) + ' /s</div>';
    if (d.in) h += '<div class="tt-row">Consomme : ' + flowHtml(d.in) + ' /s</div>';
    if (d.out) h += '<div class="tt-row">Produit : ' + flowHtml(d.out) + ' /s</div>';
    if (d.wonder) h += '<div class="tt-row">🏗️ Chantier : ' + Object.keys(d.wonder.cost).map(r => U.fmt(d.wonder.cost[r]) + ' ' + G.RESOURCES[r].name.toLowerCase()).join(', ') + ' livrés par les porteurs</div>';
    if (d.recipes) h += '<div class="tt-row">Recettes au choix : ' + d.recipes.map(r => r.name).join(' · ') + '</div>';
    if (d.comfort) h += '<div class="tt-row">Confort : ' + flowHtml(d.comfort) + ' /s (rend heureux)</div>';
    if (d.energyIn) h += '<div class="tt-row">Énergie : ' + d.energyIn + ' ⚡</div>';
    if (d.energyOut) h += '<div class="tt-row">Fournit : ' + d.energyOut + ' ⚡</div>';
    if (d.tower) h += '<div class="tt-row">⚔️ ' + d.tower.dps + ' dégâts/s · portée ' + d.tower.range + '</div>';
    if (d.hp) h += '<div class="tt-row">❤️ ' + d.hp + ' PV</div>';
    if (G.economy.mastery(id) > 1) h += '<div class="tt-row">🎴 Maîtrise ×' + G.economy.mastery(id) + ' (héritage)</div>';
    if (d.out || d.storage) h += '<div class="tt-row">🚚 ' + (d.carriers || G.LOGI.carriers) + ' porteurs × ' + (d.carry || G.LOGI.carry) + ' par cellule</div>';
    if (d.adj) h += '<div class="tt-row">Voisinage : ' + d.adj.map(a => (a.v > 0 ? '+' : '') + Math.round(a.v * 100) + ' % par ' +
      (a.b ? G.BUILDINGS[a.b].name.toLowerCase() : a.tag ? ({ industry: 'bâtiment industriel', mine: 'mine', science: 'bâtiment savant' })[a.tag] : G.TERRAIN[a.t].name.toLowerCase() + ' libre')).join(', ') + '</div>';
    return h;
  }

  function updateTooltip(ev) {
    const tip = $('#tooltip');
    const el = ev.target.closest && ev.target.closest('[data-tip],[data-tip-b]');
    if (!el) { tip.classList.remove('show'); return; }
    tip.innerHTML = el.dataset.tipB ? buildingTip(el.dataset.tipB) : el.dataset.tip;
    tip.classList.add('show');
    const r = tip.getBoundingClientRect();
    let x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = window.innerHeight - r.height - 8;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }

  // ---------- Notifications ----------
  function toast(text, kind) {
    const box = $('#toasts');
    if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.textContent = text;
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 4200);
    setTimeout(() => t.remove(), 4800);
    while (box.children.length > 5) box.firstChild.remove();
  }

  // ---------- Fenêtres modales ----------
  function openModal(kind, html, opts) {
    ui.modal = kind;
    G.paused = !(opts && opts.noPause);
    const root = $('#modal-root');
    root.innerHTML = '<div class="overlay ' + (opts && opts.cls || '') + '"><div class="modal">' + html + '</div></div>';
    root._html = null;
  }

  function closeModal() {
    ui.modal = null;
    G.paused = false;
    $('#modal-root').innerHTML = '';
  }

  // Événement : Maître Hulotte présente un dilemme ; chaque choix peut avoir un coût.
  function eventModal(ev) {
    ui.event = ev;
    let html = '<div class="event"><div class="ev-head"><span class="lore-face">' + G.LORE.icon + '</span><div><small>' + G.LORE.name + (ev.chapter ? ' · ' + ev.chapter : ' rapporte…') + '</small><h2>' + ev.icon + ' ' + ev.title + '</h2></div></div>' +
      '<p>' + ev.text + '</p><div class="ev-choices">';
    ev.choices.forEach((ch, i) => {
      const ok = G.chronicle.canChoose(ch);
      html += '<button class="choice ev" ' + (ok ? 'data-action="evChoice:' + i + '"' : 'disabled') + '><b>' + ch.label + '</b>' + (ch.cost ? '<div class="costs">' + costHtml(ch.cost) + '</div>' : '') + '</button>';
    });
    openModal('event', html + '</div></div>', { cls: 'soft' });
  }

  function eventResult(text) {
    openModal('eventResult', '<div class="event"><div class="ev-head"><span class="lore-face">' + G.LORE.icon + '</span><div><small>' + G.LORE.name + '</small><h2>' + ui.event.icon + ' ' + ui.event.title + '</h2></div></div>' +
      '<p>' + text + '</p><button class="btn primary" data-action="closeModal">Continuer</button></div>', { cls: 'soft' });
    ui.event = null;
  }

  function decreeModal() {
    const choice = G.run.pending[0];
    const pool = choice.kind === 'major' ? G.DECREES_MAJOR : G.DECREES_MINOR;
    const title = choice.kind === 'major' ? (G.run.decrees.length ? 'Un nouveau décret' : 'Décret fondateur') : 'Faveur du peuple';
    const sub = choice.kind === 'major' ? 'Choisissez la loi qui façonnera votre civilisation. Les décrets marqués ⚠️ sont puissants mais risqués.'
      : 'Votre peuple célèbre ' + G.run.stats.wavesWon + ' vagues repoussées. Choisissez une faveur.';
    let html = '<h2>' + title + '</h2><p class="muted">' + sub + '</p><div class="choices">';
    choice.options.forEach(id => {
      const d = pool[id];
      html += '<button class="choice ' + (d.risk ? 'risk' : '') + '" data-action="decree:' + id + '"><span class="big">' + d.icon + '</span><b>' + d.name + '</b><small>' + d.desc + '</small>' + (d.risk ? '<em>⚠️ Risqué</em>' : '') + '</button>';
    });
    html += '</div>';
    if (G.run.rerolls > 0) html += '<button class="btn ghost" data-action="reroll">🎲 Relancer (' + G.run.rerolls + ')</button>';
    openModal('decree', html, { cls: 'soft' });
  }

  // Cinématique de changement d'ère (désactivable, jamais en mode Bot) puis fenêtre des récompenses.
  function cinemaOn() { return G.meta.settings.cine !== false && !(G.bot && G.bot.active) && !G.botSim && !G.offlineSim && G.cinematic; }

  function eraTransition(era, tiles) {
    G.render.invalidate();
    document.body.style.setProperty('--era', G.ERAS[era].color);
    if (cinemaOn()) G.cinematic.play(era, () => eraModal(era, tiles));
    else eraModal(era, tiles);
  }

  // Le vaisseau décolle : cinématique, puis la partie reprend.
  function launched() {
    if (cinemaOn()) G.cinematic.play('launch', () => toast('🚀 Le vaisseau a décollé ! Les recherches interstellaires infinies sont ouvertes.', 'good'));
    else toast('🚀 Le vaisseau a décollé ! Les recherches interstellaires infinies sont ouvertes.', 'good');
  }

  function eraModal(era, tiles) {
    const e = G.ERAS[era];
    G.render.invalidate();
    document.body.style.setProperty('--era', e.color);
    openModal('era', '<div class="era-splash" style="--c:' + e.color + '"><small>Une nouvelle ère commence</small><h1>' + e.name + '</h1><p>' + e.intro + '</p>' +
      '<ul><li>🗺️ +' + tiles + ' cases de territoire</li><li>📜 Un nouveau décret à choisir</li><li>🏗️ Nouveaux bâtiments et technologies</li></ul>' +
      '<button class="btn primary" data-action="closeModal">Continuer</button></div>', { cls: 'era' });
  }

  function runEnded(reason, gain, unlockedRig) {
    const run = G.run;
    const title = reason === 'fall' ? 'Votre civilisation est tombée' : reason === 'launch' ? 'Votre peuple a conquis les étoiles : la lignée transmet son héritage' : 'Votre lignée transmet son héritage';
    openModal('end', (reason === 'launch' ? '<div class="launch-anim"><span>🚀</span></div>' : '') + '<h2>' + title + '</h2>' +
      '<div class="kv"><span>Ère atteinte</span><b>' + G.ERAS[run.era].name + '</b></div>' +
      '<div class="kv"><span>Vagues repoussées</span><b>' + run.stats.wavesWon + '</b></div>' +
      '<div class="kv"><span>Durée</span><b>' + U.fmtTime(run.time) + '</b></div>' +
      '<div class="gain">🌳 +' + gain + ' points d\'héritage' + (run.gloryEarned ? ' · ✨ +' + run.gloryEarned + ' gloire' : '') + '</div>' +
      (unlockedRig ? '<p class="good">Nouvelle difficulté débloquée : ' + G.RIGUEUR[G.meta.maxRigueur].name + '</p>' : '') +
      '<button class="btn primary" data-action="metaScreen">Continuer</button>');
  }

  // Maîtrise : gloire → cartes → multiplicateur permanent par type de bâtiment.
  function cardsHtml() {
    const meta = G.meta, glory = meta.glory || 0, best = meta.stats.bestEra || 0, cards = meta.cards || {}, mast = meta.mastery || {};
    let h = '<p class="muted">La <b>gloire ✨</b> s\'accumule <b>peu à peu</b> pendant la partie (paliers de population, de bâtiments, de recherches, de vagues, de durée…), avec les nouvelles ères (' + G.GLORY.era.slice(1).join(', ') + '), les merveilles (' + G.GLORY.wonder + '), le décollage du vaisseau (' + G.GLORY.launch + ') puis les recherches infinies. Elle n\'est versée qu\'à la fin de la partie. ' +
      'Elle achète des <b>cartes de bâtiment</b>. Avec assez de cartes, la <b>maîtrise</b> d\'un bâtiment monte : niveau 2 = production et stocks ×2, niveau 3 = ×3… Il faut 1 carte pour le niveau 2, puis 2, 4, 8… Ces bonus sont permanents.</p>' +
      '<div class="pack"><button class="btn primary" ' + (glory >= G.GLORY.packCost ? 'data-action="buyPack"' : 'disabled') + '>🎴 Paquet de ' + G.GLORY.packSize + ' cartes au hasard — ✨ ' + G.GLORY.packCost + '</button><small class="muted">Parmi les bâtiments des ères que vous avez déjà atteintes.</small></div>' +
      (() => { const pl = G.logic.masteryPlan(), n = pl.reduce((a, p) => a + p.to - p.from, 0);
        return '<div class="pack"><button class="btn ' + (n ? 'gold' : '') + '" ' + (n ? 'data-action="masteryAll"' : 'disabled') + '>⬆️ Tout monter d\'un coup' + (n ? ' — ' + n + ' niveau' + (n > 1 ? 'x' : '') + ' sur ' + pl.length + ' bâtiment' + (pl.length > 1 ? 's' : '') : '') + '</button><small class="muted">' + (n ? 'Utilise toutes les cartes qui le permettent.' : 'Aucune maîtrise n\'est possible avec vos cartes actuelles.') + '</small></div>'; })();
    for (let e = 0; e < G.ERAS.length; e++) {
      const ids = G.logic.cardTypes().filter(id => G.BUILDINGS[id].era === e);
      if (!ids.length) continue;
      const locked = e > best;
      h += '<h4 class="cat"><i style="background:' + G.ERAS[e].color + '"></i>' + G.ERAS[e].name + (locked ? ' <small>(atteignez cette ère pour acheter ses cartes)</small>' : '') + '</h4><div class="mcards">';
      for (const id of ids) {
        const d = G.BUILDINGS[id], lvl = mast[id] || 1, have = cards[id] || 0, need = G.logic.masteryCost(id), price = G.GLORY.cardCost(e);
        h += '<div class="mcard ' + (lvl > 1 ? 'up' : '') + (locked ? ' locked' : '') + '"><span class="ic">' + d.icon + '</span><b>' + d.name + '</b>' +
          '<span class="mx">×' + lvl + '</span>' +
          (need === null ? '<small>Maîtrise maximale</small>' : '<small>🎴 ' + have + ' / ' + need + ' pour ×' + (lvl + 1) + '</small><span class="sbar"><i style="width:' + Math.min(100, have / need * 100).toFixed(0) + '%"></i></span>') +
          '<div class="row">' + (locked ? '' : '<button class="btn" ' + (glory >= price ? 'data-action="buyCard:' + id + '"' : 'disabled') + '>🎴 ✨ ' + price + '</button>') +
          (!locked && G.logic.cardMaxBuy(id) >= 2 ? '<button class="btn" data-action="buyCardMax:' + id + '" data-tip="Achète autant de cartes que votre gloire le permet (sans dépasser la maîtrise maximale).">Max ×' + G.logic.cardMaxBuy(id) + '</button>' : '') +
          (need !== null && have >= need ? '<button class="btn primary" data-action="mastery:' + id + '">⬆️ ×' + (lvl + 1) + '</button>' : '') + '</div></div>';
      }
      h += '</div>';
    }
    return h;
  }

  // Effet concret d'une maîtrise ×n selon le type de bâtiment.
  function masteryEffect(d, n) {
    const bits = [];
    if (d.out || d.energyOut) bits.push('production ×' + n);
    if (d.pop) bits.push('habitants ×' + n);
    if (d.tower || d.squad) bits.push('dégâts ×' + n);
    bits.push('stocks ×' + n);
    return bits.join(', ');
  }

  // Petite fenêtre posée par-dessus l'écran Lignées : résumé des montées de maîtrise.
  function masteryRecap(plan) {
    const levels = plan.reduce((a, p) => a + p.to - p.from, 0), cards = plan.reduce((a, p) => a + p.spent, 0);
    const rows = plan.map(p => { const d = G.BUILDINGS[p.type];
      return '<div class="rc-row"><span class="ic">' + d.icon + '</span><div><b>' + d.name + '</b><small>' + masteryEffect(d, p.to) + '</small></div>' +
        '<span class="rc-lv">×' + p.from + ' <i>→</i> <b>×' + p.to + '</b></span><span class="rc-cards">🎴 −' + p.spent + '</span></div>'; }).join('');
    const el = document.createElement('div');
    el.className = 'overlay recap';
    el.innerHTML = '<div class="modal recap-modal"><h2>⬆️ Maîtrise renforcée</h2><p class="muted">' + levels + ' niveau' + (levels > 1 ? 'x' : '') + ' gagné' + (levels > 1 ? 's' : '') + ' sur ' + plan.length +
      ' bâtiment' + (plan.length > 1 ? 's' : '') + ' · 🎴 ' + cards + ' carte' + (cards > 1 ? 's' : '') + ' utilisée' + (cards > 1 ? 's' : '') + '. Bonus permanents, valables dès maintenant.</p><div class="rc-list">' + rows + '</div>' +
      '<button class="btn primary" data-action="closeRecap">Parfait</button></div>';
    $('#modal-root').appendChild(el);
  }

  // Écran de méta-progression : nouvelle partie, héritage, historique.
  function metaScreen(tab) {
    ui.metaTab = tab || ui.metaTab || 'new';
    ui.newOrigin = ui.newOrigin && G.meta.origins[ui.newOrigin] ? ui.newOrigin : 'fluviale';
    if (ui.newRig === undefined || ui.newRig > G.meta.maxRigueur) ui.newRig = 0;
    const meta = G.meta, inRun = G.run && !G.run.over;
    let html = '<div class="meta-head"><h1>Lignées</h1><span class="pill">🌳 ' + meta.heritage + ' points d\'héritage</span><span class="pill glory">✨ ' + (meta.glory || 0) + ' gloire</span>' +
      (inRun ? '<button class="btn ghost" data-action="closeModal">✕ Retour à la partie</button>' : '') + '</div>' +
      '<div class="meta-tabs">' + [['new', 'Nouvelle civilisation'], ['tree', 'Héritage'], ['cards', 'Maîtrise'], ['ach', 'Succès'], ['hist', 'Chroniques']].map(([id, l]) =>
        '<button class="tab ' + (ui.metaTab === id ? 'on' : '') + '" data-action="metaTab:' + id + '">' + l + '</button>').join('') + '</div>';
    if (ui.metaTab === 'new') {
      if (inRun) html += '<p class="warnbox box">Une partie est en cours. En fonder une nouvelle l\'abandonnera <b>sans</b> héritage : utilisez plutôt « Transmettre l\'héritage » dans l\'onglet Civilisation.</p>';
      html += '<h3>Origine</h3><div class="choices">';
      for (const id in G.ORIGINS) {
        const o = G.ORIGINS[id], unl = meta.origins[id];
        html += '<button class="choice ' + (ui.newOrigin === id ? 'on' : '') + (unl ? '' : ' locked') + '" data-action="' + (unl ? 'origin:' + id : 'unlockOrigin:' + id) + '">' +
          '<span class="big">' + o.icon + '</span><b>' + o.name + '</b><small>' + o.desc + '</small>' + (unl ? '' : '<em>🔒 Débloquer : 🌳 ' + o.cost + '</em>') + '</button>';
      }
      html += '</div><h3>Difficulté</h3><div class="rig">';
      G.RIGUEUR.forEach((r, i) => {
        const unl = i <= meta.maxRigueur;
        html += '<button class="rig-btn ' + (ui.newRig === i ? 'on' : '') + '" ' + (unl ? 'data-action="rig:' + i + '"' : 'disabled') + ' data-tip="' + r.desc + ' Héritage ×' + String(r.heritage).replace('.', ',') + (unl ? '' : ' — atteignez l’ère industrielle en ' + (G.RIGUEUR[i - 1] || {}).name + ' pour débloquer') + '">' + (unl ? r.icon + ' ' : '🔒 ') + r.name + '<small>×' + r.heritage + '</small></button>';
      });
      html += '</div><p class="muted">' + G.RIGUEUR[ui.newRig].desc + '</p><button class="btn primary big" data-action="startRun">Fonder la civilisation</button>';
    } else if (ui.metaTab === 'tree') {
      html += '<p class="muted">Les points d\'héritage s\'obtiennent à la fin de chaque partie (ère atteinte, vagues repoussées, production totale). Ces bonus sont permanents.</p><div class="heritage">';
      for (const id in G.HERITAGE) {
        const h = G.HERITAGE[id], lvl = meta.levels[id] || 0, maxed = lvl >= h.max;
        const c = maxed ? 0 : h.cost(lvl);
        html += '<button class="herit ' + (maxed ? 'max' : meta.heritage >= c ? 'ok' : '') + '" ' + (maxed ? '' : 'data-action="heritage:' + id + '"') + '>' +
          '<span class="big">' + h.icon + '</span><b>' + h.name + '</b><small>' + h.desc + '</small>' +
          '<span class="lvl">' + '●'.repeat(lvl) + '○'.repeat(h.max - lvl) + '</span><em>' + (maxed ? 'Maximum' : '🌳 ' + c) + '</em></button>';
      }
      html += '</div>';
    } else if (ui.metaTab === 'cards') {
      html += cardsHtml();
    } else if (ui.metaTab === 'ach') {
      const got = meta.achievements || {}, ids = Object.keys(G.ACHIEVEMENTS);
      html += '<p class="muted">' + ids.filter(id => got[id]).length + ' / ' + ids.length + ' succès. Chacun rapporte de l\'héritage, une seule fois. Ils ne se débloquent pas en mode Bot.</p><div class="heritage">';
      for (const id of ids) {
        const a = G.ACHIEVEMENTS[id];
        html += '<div class="herit ' + (got[id] ? 'max' : '') + '" style="' + (got[id] ? '' : 'opacity:.55') + '"><span class="big">' + (got[id] ? a.icon : '🔒') + '</span><b>' + a.name + '</b><small>' + a.desc + '</small><em>' + (got[id] ? '✔ Obtenu' : '🌳 ' + a.reward) + '</em></div>';
      }
      html += '</div>';
    } else {
      html += '<div class="kv"><span>Parties jouées</span><b>' + meta.stats.runs + '</b></div><div class="kv"><span>Meilleure ère</span><b>' + G.ERAS[meta.stats.bestEra].name + '</b></div>' +
        '<div class="kv"><span>Record de vagues</span><b>' + meta.stats.bestWaves + '</b></div><div class="kv"><span>Héritage total gagné</span><b>' + meta.heritageTotal + '</b></div><h3>Dernières lignées</h3>';
      if (!meta.history.length) html += '<p class="muted">Aucune partie terminée.</p>';
      meta.history.forEach(h => {
        html += '<div class="hist">' + G.ORIGINS[h.origin].icon + ' ' + G.ORIGINS[h.origin].name + ' · ' + G.RIGUEUR[h.rigueur].name + ' · ' + G.ERAS[h.era].name + ' · ' + h.waves + ' vagues · ' + U.fmtTime(h.time) + ' · <b>🌳 +' + h.gain + '</b> ' + (h.reason === 'fall' ? '(chute)' : h.reason === 'launch' ? '(🚀 décollage)' : '(transmise)') + '</div>';
      });
    }
    openModal('meta', html, { cls: 'meta' });
  }

  function settingsModal() {
    const on = G.bot && G.bot.active;
    openModal('settings', '<h2>Paramètres</h2>' +
      '<h3>Mode Bot</h3><p class="muted">Le bot joue votre partie en cours à votre place. Un petit panneau sur la carte permet de choisir la vitesse (×1 à ×20) et de reprendre la main.</p>' +
      '<div class="rig"><button class="rig-btn ' + (on ? 'on' : '') + '" data-action="botStart">🤖 Activer</button>' +
      '<button class="rig-btn ' + (on ? '' : 'on') + '" data-action="botStop">✋ Désactivé</button></div>' +
      '<label class="toggle"><input type="checkbox" data-action="botGlory:' + (G.meta.settings.botGlory ? 'off' : 'on') + '" ' + (G.meta.settings.botGlory ? 'checked' : '') + '> Gagner de la gloire ✨ pendant que le bot joue (les succès restent réservés à vos parties)</label>' +
      '<h3>Chroniqueur</h3><div class="rig">' +
      '<button class="rig-btn ' + (G.meta.settings.lore !== false ? 'on' : '') + '" data-action="lore:on">🦉 Activé</button>' +
      '<button class="rig-btn ' + (G.meta.settings.lore === false ? 'on' : '') + '" data-action="lore:off">Silencieux</button></div>' +
      '<h3>Cinématiques</h3><p class="muted">Une courte scène illustrée à chaque nouvelle ère et au décollage du vaisseau.</p><div class="rig">' +
      '<button class="rig-btn ' + (G.meta.settings.cine !== false ? 'on' : '') + '" data-action="cine:on">🎬 Activées</button>' +
      '<button class="rig-btn ' + (G.meta.settings.cine === false ? 'on' : '') + '" data-action="cine:off">Désactivées</button></div>' +
      '<h3>Emplacements de sauvegarde</h3><p class="muted">Chaque emplacement garde une copie complète (héritage, gloire, cartes et partie en cours). Charger un emplacement remplace la partie active.</p>' + slotsHtml() +
      '<button class="btn ghost" data-action="blankGame">✨ Nouvelle lignée vierge (repartir de zéro)</button>' +
      '<h3>Sauvegarde active</h3><p class="muted">Sauvegarde automatique toutes les 10 secondes dans ce navigateur.</p>' +
      '<textarea id="save-box" placeholder="Collez une sauvegarde ici pour l\'importer"></textarea>' +
      '<div class="row"><button class="btn" data-action="export">📤 Exporter</button><button class="btn" data-action="import">📥 Importer</button><button class="btn ghost danger" data-action="wipe">🗑️ Tout effacer</button></div>' +
      '<button class="btn primary" data-action="closeModal">Fermer</button>');
  }

  function slotsHtml() {
    let h = '<div class="slots">';
    for (let i = 0; i < G.state.SLOTS; i++) {
      const s = G.state.slotInfo(i);
      h += '<div class="slot"><div><b>' + (s ? s.name : 'Emplacement ' + (i + 1)) + '</b><small>' + (s ? new Date(s.savedAt).toLocaleString() + ' · 🌳 ' + s.heritage + ' · ✨ ' + s.glory +
        (s.run ? ' · ' + G.ERAS[s.run.era].name + ', ' + U.fmtTime(s.run.time) : ' · pas de partie en cours') : 'Vide') + '</small></div><div class="row">' +
        '<button class="btn" data-action="slotSave:' + i + '">💾 ' + (s ? 'Écraser' : 'Sauvegarder ici') + '</button>' +
        (s ? '<button class="btn" data-action="slotLoad:' + i + '">📂 Charger</button><button class="btn ghost danger" data-action="slotDel:' + i + '">🗑️</button>' : '') + '</div></div>';
    }
    return h + '</div>';
  }

  function helpModal() {
    openModal('help', '<h2>Comment jouer</h2><div class="help">' +
      '<p><b>🎯 But :</b> faire grandir votre civilisation de l\'Antiquité à l\'ère industrielle, et repousser des vagues d\'ennemis de plus en plus fortes.</p>' +
      '<p><b>🏗️ Construire :</b> choisissez un bâtiment à droite puis cliquez sur une case. Chaque bâtiment exige un terrain précis.</p>' +
      '<p><b>🧩 Voisinage :</b> pendant le placement, les cases voisines affichent leurs bonus (vert) ou malus (rouge). Bien agencer sa ville est la clé.</p>' +
      '<p><b>👥 Main-d\'œuvre :</b> les logements fournissent des habitants ; si les emplois dépassent la population, tout ralentit.</p>' +
      '<p><b>⭐ Niveaux :</b> cliquez un bâtiment pour le monter de niveau : plus de production sur la même case. Le niveau maximum augmente à chaque ère.</p>' +
      '<p><b>📦 Stocks :</b> chaque bâtiment garde une petite réserve d’intrants et de produits. On voit les ressources circuler entre les bâtiments et les entrepôts.</p>' +
      '<p><b>🗺️ Territoire :</b> l\'espace est la ressource la plus précieuse. Cliquez une case hors frontière pour l\'annexer.</p>' +
      '<p><b>⚔️ Vagues :</b> les ennemis attaquent le bâtiment le plus proche. Tours et murs protègent la ville ; si le forum tombe, la partie s\'achève.</p>' +
      '<p><b>📜 Ères et décrets :</b> chaque ère apporte un décret, des bâtiments, des gisements et un anneau de territoire. Toutes les 5 vagues, une faveur.</p>' +
      '<p><b>🌳 Héritage :</b> à la fin d\'une partie, vous gagnez des points permanents. Chaque lignée rend la suivante plus forte.</p>' +
      '<p><b>🕰️ Absence :</b> la production continue hors ligne (60 % de base, améliorable via l’héritage). Les vagues sont suspendues : elles ne frappent que lorsque vous jouez.</p>' +
      '<p><b>🖱️ Contrôles :</b> molette = zoom · glisser = déplacer · clic droit / Échap = annuler.</p>' +
      '</div><button class="btn primary" data-action="closeModal">Compris</button>');
  }

  function offlineModal(rep) {
    openModal('offline', '<h2>Pendant votre absence…</h2><p class="muted">' + U.fmtTime(rep.seconds) + ' se sont écoulées (efficacité ' + Math.round(rep.eff * 100) + ' %).</p>' +
      '<div class="gains">' + Object.keys(rep.gains).filter(r => Math.abs(rep.gains[r]) >= 1).map(r => '<span class="chip ' + (rep.gains[r] < 0 ? 'lack' : '') + '">' + G.RESOURCES[r].icon + ' ' + (rep.gains[r] > 0 ? '+' : '') + U.fmt(rep.gains[r]) + '</span>').join('') + '</div>' +
      '<p class="muted">🛡️ Les envahisseurs ne frappent pas en votre absence.</p>' +
      '<button class="btn primary" data-action="closeModal">Reprendre</button>');
  }

  // Confirmation intégrée au jeu (les boîtes natives confirm() sont bloquées dans certains navigateurs intégrés).
  function confirmModal(title, text, okLabel, onOk, onCancel, danger) {
    ui.confirmOk = onOk; ui.confirmCancel = onCancel || null;
    openModal('confirm', '<h2>' + title + '</h2><p>' + text + '</p><div class="row">' +
      '<button class="btn ghost" data-action="confirmCancel">Annuler</button>' +
      '<button class="btn primary' + (danger ? ' danger-fill' : '') + '" data-action="confirmOk">' + okLabel + '</button></div>');
  }

  function startRun() {
    closeModal();
    G.logic.startRun(ui.newOrigin, ui.newRig);
    document.body.style.setProperty('--era', G.ERAS[0].color);
    G.render.invalidate(); G.render.fit();
    ui.selected = null; ui.placing = null; ui.tab = 'build';
  }

  // ---------- Tableau de bord ----------
  function dashHtml() {
    const run = G.run, S = G.stats || {}, R = G.rates || {}, L = G.logistics;
    const prod = {}, cons = {}, consPop = {}, transit = {}, inStores = {}, inProd = {}, types = {};
    let carriersTot = 0, carriersBusy = 0;
    for (const b of run.buildings) {
      const d = G.economy.def(b), k = G.economy.lv(b), eff = b._eff || 0;
      const T = types[b.type] || (types[b.type] = { n: 0, lvl: 0, eff: 0, effN: 0, ruined: 0, missing: 0, full: 0, waiting: 0, paused: 0 });
      T.n++; T.lvl += b.level || 1;
      if (b.ruined) { T.ruined++; continue; }
      if (b.paused) T.paused++;
      if (d.workers || d.in || d.out) { T.eff += eff; T.effN++; }
      if (b._missing) T.missing++;
      if (b._full) T.full++;
      if (b._waiting) T.waiting++;
      if (d.out) for (const r in d.out) prod[r] = (prod[r] || 0) + d.out[r] * k.io * eff * (b._mult || 1);
      if (d.in) for (const r in d.in) cons[r] = (cons[r] || 0) + d.in[r] * k.io * eff;
      if (d.consume && !b.paused) {
        const sv = G.economy.survival(b), cf = G.economy.comfort(b);
        for (const r in sv) consPop[r] = (consPop[r] || 0) + sv[r] * (b._sat === undefined ? 1 : b._sat);
        for (const r in cf) consPop[r] = (consPop[r] || 0) + cf[r] * (b._comfort || 0);
      }
      if (d.boost && b._boosted) cons[d.boost.res] = (cons[d.boost.res] || 0) + d.boost.rate * k.tower;
      if (L.isStore(b)) for (const r in b.store || {}) inStores[r] = (inStores[r] || 0) + b.store[r];
      else for (const r in b.out || {}) inProd[r] = (inProd[r] || 0) + b.out[r];
      if (L.srcStock(b)) { carriersTot += L.carriers(b); carriersBusy += (b.trips || []).filter(t => t > (run.lt || 0)).length; }
    }
    let cells = 0;
    for (const p of run.transit || []) { transit[p.r] = (transit[p.r] || 0) + p.q; cells++; }
    const fl = v => (v > 0.0005 ? U.fmtFlow(v) : '—');
    let h = '<div class="dash-head"><h2>📊 Tableau de bord</h2><button class="btn ghost" data-action="closeModal">✕ Fermer</button></div>' +
      '<p class="muted">Mis à jour en direct (le jeu continue). Production et consommation au rythme actuel ; « Bilan » = variation mesurée des stocks.</p>' +
      '<div class="dash-cards">' +
      '<div><small>Population / emplois</small><b>' + U.fmt(S.pop || 0) + ' / ' + U.fmt(S.jobs || 0) + '</b><em>' + pct(S.workRatio === undefined ? 1 : S.workRatio) + ' de main-d\'œuvre</em></div>' +
      '<div><small>Électricité</small><b>⚡ ' + U.fmt(S.energyProd || 0, 1) + ' / ' + U.fmt(S.energyNeed || 0, 1) + '</b><em>' + (S.networks || 0) + ' réseau(x)' + (S.unpowered ? ' · 🔌 ' + S.unpowered + ' non raccordé(s)' : '') + '</em></div>' +
      '<div><small>Porteurs occupés</small><b>🚚 ' + carriersBusy + ' / ' + carriersTot + '</b><em>' + cells + ' cellules en transit</em></div>' +
      '<div><small>Savoir</small><b>📜 ' + U.fmt(run.res.savoir) + '</b><em>' + fl(prod.savoir || 0) + '</em></div>' +
      '<div><small>Population (15 min)</small>' + spark((G.hist || []).map(h => h.pop), '#3d6fb6', 150, 34) + '</div>' +
      '</div><h3>Ressources</h3><div class="dash-table"><table><thead><tr><th>Ressource</th><th>Stock</th><th>Capacité</th><th>Production</th><th>Conso. bâtiments</th><th>Conso. habitants</th><th>Bilan</th><th>En transit</th><th>Réserves / producteurs</th><th>15 dernières min</th></tr></thead><tbody>';
    for (const r of G.RESOURCE_ORDER) {
      const d = G.RESOURCES[r];
      if (d.uncapped) continue;
      if (d.era > run.era && !run.res[r] && !prod[r] && !cons[r]) continue;
      const cap = G.economy.capOf(r), net = R[r] || 0, full = run.res[r] >= cap - 1 && cap > 0;
      h += '<tr><td>' + d.icon + ' ' + d.name + '</td><td class="' + (full ? 'warn' : '') + '">' + U.fmt(run.res[r]) + '</td><td>' + U.fmt(cap) + '</td>' +
        '<td class="pos">' + fl(prod[r] || 0) + '</td><td class="neg">' + fl(cons[r] || 0) + '</td><td class="neg">' + fl(consPop[r] || 0) + '</td>' +
        '<td class="' + (net > 0.005 ? 'pos' : net < -0.005 ? 'neg' : '') + '">' + (Math.abs(net) > 0.005 ? U.fmtRate(net) : '—') + '</td>' +
        '<td>' + (transit[r] ? U.fmt(transit[r]) : '—') + '</td><td>' + U.fmt(inStores[r] || 0) + ' / ' + U.fmt(inProd[r] || 0) + '</td><td>' + spark((G.hist || []).map(h => h.res[r] || 0), d.color) + '</td></tr>';
    }
    h += '</tbody></table></div><h3>Bâtiments</h3><div class="dash-table"><table><thead><tr><th>Bâtiment</th><th>Nombre</th><th>Niveau moyen</th><th>Efficacité</th><th>Alertes</th></tr></thead><tbody>';
    const ids = Object.keys(types).sort((a, b) => G.BUILD_CATEGORIES.findIndex(c => c.id === G.BUILDINGS[a].cat) - G.BUILD_CATEGORIES.findIndex(c => c.id === G.BUILDINGS[b].cat));
    for (const id of ids) {
      const T = types[id], d = G.BUILDINGS[id], al = [];
      if (T.ruined) al.push('<span class="tag bad">' + T.ruined + ' en ruine</span>');
      if (T.paused) al.push('<span class="tag">' + T.paused + ' en pause</span>');
      if (T.waiting) al.push('<span class="tag warn">' + T.waiting + ' attend une livraison</span>');
      if (T.missing) al.push('<span class="tag warn">' + T.missing + ' manque d\'intrants</span>');
      if (T.full) al.push('<span class="tag warn">' + T.full + ' sortie pleine</span>');
      h += '<tr><td>' + d.icon + ' ' + d.name + '</td><td>' + T.n + '</td><td>' + (T.lvl / T.n).toFixed(1) + '</td>' +
        '<td>' + (T.effN ? pct(T.eff / T.effN) : '—') + '</td><td>' + (al.join(' ') || '<span class="muted">—</span>') + '</td></tr>';
    }
    return h + '</tbody></table></div>';
  }

  // Petite courbe SVG d'une série de valeurs.
  function spark(vals, color, w, h) {
    w = w || 110; h = h || 22;
    if (vals.length < 2) return '<span class="muted">—</span>';
    const max = Math.max(...vals), min = Math.min(...vals), span = max - min || 1;
    const pts = vals.map((v, i) => (i / (vals.length - 1) * w).toFixed(1) + ',' + (h - 2 - (v - min) / span * (h - 4)).toFixed(1)).join(' ');
    return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  }

  function dashModal() {
    openModal('dash', '<div id="dash">' + dashHtml() + '</div>', { noPause: true, cls: 'wide' });
  }

  // ---------- Actions ----------
  function act(action, el) {
    const [name, arg] = action.split(':');
    const run = G.run;
    switch (name) {
      case 'tab': ui.tab = arg; break;
      case 'techTree': techTreeModal(false); break;
      case 'chainView': ui.chainView = !ui.chainView; ui._rel = null; break;
      case 'buyCardMax': { const n = G.logic.buyCardMax(arg); if (n) { G.state.save(); toast('🎴 ' + n + ' cartes ' + G.BUILDINGS[arg].name, 'good'); } metaScreen(); break; }
      case 'masteryAll': { const plan = G.logic.masteryUpAll(); if (plan.length) { G.state.save(); metaScreen(); masteryRecap(plan); } break; }
      case 'closeRecap': { const r = document.querySelector('.overlay.recap'); if (r) r.remove(); break; }
      case 'place': {
        // Une case de votre territoire est sélectionnée : on construit directement dessus si possible.
        const s = ui.selected;
        if (s && s.kind === 'tile' && G.run.owned[s.y * G.map.W + s.x] && G.logic.canPlace(arg, s.x, s.y).ok) {
          const r = G.logic.build(arg, s.x, s.y);
          if (r.ok) ui.selected = { kind: 'building', b: r.b }; else toast(r.why, 'warn');
          break;
        }
        ui.placing = ui.placing === arg ? null : arg; ui.selected = null; break;
      }
      case 'annexTo': { const n = G.logic.annexTo(ui.selected.x, ui.selected.y); if (n) { toast('🗺️ ' + n + ' case(s) annexée(s)', 'good'); ui.annex = null; } break; }
      case 'dash': dashModal(); break;
      case 'showDone': ui.showDone = !ui.showDone; break;
      case 'botGlory': G.meta.settings.botGlory = arg === 'on'; settingsModal(); break;
      case 'slotSave': {
        const i = +arg, s = G.state.slotInfo(i);
        const name = (G.run && !G.run.over ? G.ORIGINS[G.run.origin].name + ' · ' + G.ERAS[G.run.era].name : 'Lignée ' + (i + 1));
        const doSave = () => { G.state.saveSlot(i, name); toast('💾 Partie sauvegardée dans l’emplacement ' + (i + 1), 'good'); settingsModal(); };
        if (s) confirmModal('Écraser l’emplacement ?', 'L’emplacement « ' + s.name + ' » sera remplacé par la partie actuelle.', 'Écraser', doSave, settingsModal);
        else doSave();
        break;
      }
      case 'slotLoad': {
        const i = +arg, s = G.state.slotInfo(i);
        confirmModal('Charger « ' + s.name + ' » ?', 'La partie active sera remplacée. Pensez à la sauvegarder dans un emplacement d’abord si vous voulez la garder.', '📂 Charger', () => G.state.loadSlot(i), settingsModal);
        break;
      }
      case 'slotDel': {
        const i = +arg, s = G.state.slotInfo(i);
        confirmModal('Supprimer « ' + s.name + ' » ?', 'Cet emplacement sera effacé définitivement.', 'Supprimer', () => { G.state.deleteSlot(i); settingsModal(); }, settingsModal, true);
        break;
      }
      case 'blankGame':
        confirmModal('Nouvelle lignée vierge ?', 'La sauvegarde active (héritage, gloire, cartes, partie) sera effacée pour repartir de zéro. Les emplacements ne sont pas touchés : sauvegardez d’abord votre partie si vous voulez la garder.', 'Repartir de zéro', () => G.state.blank(), settingsModal, true);
        break;
      case 'launch':
        confirmModal('Lancer le vaisseau ?', 'Le vaisseau décolle ! La partie continue : de nouvelles <b>recherches infinies</b> s\'ouvrent et rapportent un peu de gloire ✨. Quand vous transmettrez l\'héritage, il sera majoré (×1,5 et +50).', '🚀 Décollage !', () => G.logic.launch());
        break;
      case 'logiView': ui.logiView = !ui.logiView; break;
      case 'recipe': G.logic.setRecipe(ui.selected.b, +arg); break;
      case 'spec': G.logic.setSpec(ui.selected.b, arg); break;
      case 'order': {
        const b = ui.selected.b;
        b.order = arg;
        if (arg === 'rally') { ui.rallyFor = b; toast('🚩 Cliquez une case de la carte pour placer le point de ralliement', 'info'); }
        else ui.rallyFor = null;
        break;
      }
      case 'trade': if (G.logic.trade(+arg)) toast('🏪 Échange conclu', 'good'); break;
      case 'prio': ui.selected.b.prio = +arg; break;
      case 'accept': {
        const b = ui.selected.b, all = G.RESOURCE_ORDER.filter(r => !G.RESOURCES[r].uncapped);
        const acc = b.accept ? b.accept.slice() : all.slice();
        const i = acc.indexOf(arg);
        if (i >= 0) acc.splice(i, 1); else acc.push(arg);
        b.accept = acc.length >= all.length ? null : acc;
        break;
      }
      case 'acceptAll': ui.selected.b.accept = null; break;
      case 'acceptNone': ui.selected.b.accept = []; break;
      case 'evChoice': { const res = ui.event && G.chronicle.choose(ui.event, +arg); if (res) eventResult(res); break; }
      case 'deliver': G.chronicle.deliver(+arg); break;
      case 'cine': G.meta.settings.cine = arg === 'on'; settingsModal(); break;
      case 'lore': G.meta.settings.lore = arg === 'on'; if (arg !== 'on') G.lore.hide(); settingsModal(); break;
      case 'research': G.logic.research(arg); break;
      case 'decree': G.logic.chooseDecree(arg); closeModal(); break;
      case 'reroll': G.logic.reroll(); decreeModal(); break;
      case 'advance': G.logic.advanceEra(); break;
      case 'repairAll': toast('🪛 ' + G.logic.repairAll() + ' bâtiment(s) réparé(s)'); break;
      case 'deselect': ui.selected = null; break;
      case 'pause': ui.selected.b.paused = !ui.selected.b.paused; break;
      case 'repair': G.logic.repair(ui.selected.b); break;
      case 'upgrade': G.logic.upgrade(ui.selected.b); break;
      case 'levelUp': if (G.logic.levelUp(ui.selected.b)) toast('⭐ ' + G.BUILDINGS[ui.selected.b.type].name + ' passe au niveau ' + ui.selected.b.level, 'good'); break;
      case 'demolish': G.logic.demolish(ui.selected.b); ui.selected = null; break;
      case 'buyTile': if (G.logic.buyTile(ui.selected.x, ui.selected.y)) ui.selected = null; break;
      case 'closeModal': closeModal(); break;
      case 'settings': settingsModal(); break;
      case 'help': helpModal(); break;
      case 'heritageView': metaScreen('tree'); break;
      case 'metaScreen': metaScreen('new'); break;
      case 'metaTab': metaScreen(arg); break;
      case 'origin': ui.newOrigin = arg; metaScreen(); break;
      case 'buyCard': if (G.logic.buyCard(arg)) { G.state.save(); toast('🎴 Carte ' + G.BUILDINGS[arg].name + ' obtenue', 'good'); } metaScreen(); break;
      case 'buyPack': { const got = G.logic.buyPack(); if (got) { G.state.save(); toast('🎴 ' + got.map(t => G.BUILDINGS[t].icon + ' ' + G.BUILDINGS[t].name).join(' · '), 'good'); } metaScreen(); break; }
      case 'mastery': if (G.logic.masteryUp(arg)) { G.state.save(); toast('⬆️ Maîtrise ' + G.BUILDINGS[arg].name + ' : ×' + G.meta.mastery[arg], 'good'); } metaScreen(); break;
      case 'unlockOrigin': if (G.logic.unlockOrigin(arg)) ui.newOrigin = arg; G.state.save(); metaScreen(); break;
      case 'rig': ui.newRig = +arg; metaScreen(); break;
      case 'heritage': G.logic.buyHeritage(arg); if (G.run && !G.run.over) G.logic.recomputeMods(); G.state.save(); metaScreen(); break;
      case 'startRun':
        if (G.run && !G.run.over) confirmModal('Abandonner la partie ?', 'La partie en cours sera perdue <b>sans</b> gagner d\'héritage.', 'Abandonner et fonder', startRun, () => metaScreen());
        else startRun();
        break;
      case 'abdicate':
        confirmModal('Transmettre l\'héritage ?', 'La partie se termine et votre lignée gagne <b>🌳 ' + G.logic.heritageGain() + ' points d\'héritage</b>.', 'Transmettre', () => G.logic.endRun('abdicate'));
        break;
      case 'confirmOk': { const cb = ui.confirmOk; ui.confirmOk = ui.confirmCancel = null; closeModal(); if (cb) cb(); break; }
      case 'confirmCancel': { const cb = ui.confirmCancel; ui.confirmOk = ui.confirmCancel = null; closeModal(); if (cb) cb(); break; }
      case 'speed': G.meta.settings.speed = +arg; G.userPaused = false; break;
      case 'gamePause': G.userPaused = !G.userPaused; break;
      case 'botStart': closeModal(); G.bot.start({ speed: Math.max(1, Math.min(10, G.meta.settings.speed || 1)) }); toast('🤖 Le bot prend les commandes', 'info'); break;
      case 'botStop': if (G.bot.active) { G.bot.stop(); toast('✋ Vous reprenez la main', 'info'); } if (ui.modal === 'settings') settingsModal(); break;
      case 'levelUpAll': { const n = G.logic.levelUpAll(ui.selected.b); if (n) toast('⭐ ' + n + ' × ' + G.BUILDINGS[ui.selected.b.type].name + ' niveau ' + ui.selected.b.level, 'good'); break; }
      case 'export': $('#save-box').value = G.state.exportSave(); $('#save-box').select(); toast('Sauvegarde copiée dans la zone de texte'); break;
      case 'import':
        try { G.state.importSave($('#save-box').value); location.reload(); }
        catch (e) { toast('Sauvegarde invalide', 'danger'); }
        break;
      case 'wipe':
        confirmModal('Tout effacer ?', 'Toute la progression (partie en cours et héritage) sera effacée définitivement.', 'Tout effacer',
          () => { G.wiping = true; G.state.wipe(); location.reload(); }, settingsModal, true);
        break;
    }
    refresh(true);
  }

  // ---------- Saisie sur la carte ----------
  function bindCanvas(canvas) {
    let down = null;
    canvas.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      down = { x: e.offsetX, y: e.offsetY, lx: e.offsetX, ly: e.offsetY, drag: false };
      if (ui.placing && G.BUILDINGS[ui.placing].road) { down.paint = true; paintRoad(G.render.screenToTile(e.offsetX, e.offsetY), down); }
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      ui.hover = G.render.screenToTile(e.offsetX, e.offsetY);
      if (down && down.paint) { paintRoad(ui.hover, down); return; }
      if (down) {
        if (!down.drag && Math.hypot(e.offsetX - down.x, e.offsetY - down.y) > 6) down.drag = true;
        if (down.drag) { G.render.pan(e.offsetX - down.lx, e.offsetY - down.ly); canvas.style.cursor = 'grabbing'; }
        down.lx = e.offsetX; down.ly = e.offsetY;
      }
    });
    canvas.addEventListener('pointerup', e => {
      if (!down) return;
      const wasDrag = down.drag || down.paint;
      down = null;
      canvas.style.cursor = '';
      if (!wasDrag) clickTile(G.render.screenToTile(e.offsetX, e.offsetY));
    });
    canvas.addEventListener('pointerleave', () => { ui.hover = null; });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      G.render.zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); cancel(); });
  }

  // Tracé continu des routes : une route par case survolée, bouton enfoncé.
  function paintRoad(t, down) {
    if (!t || (down.last && down.last.x === t.x && down.last.y === t.y)) return;
    down.last = t;
    if (G.logic.canPlace(ui.placing, t.x, t.y).ok) G.logic.build(ui.placing, t.x, t.y);
    refresh(true);
  }

  function cancel() {
    if (ui.placing) ui.placing = null; else ui.selected = null;
    refresh(true);
  }

  function clickTile(t) {
    if (!G.run || G.run.over || ui.modal) return;
    if (t.x < 0 || t.y < 0 || t.x >= G.map.W || t.y >= G.map.H) return;
    if (ui.rallyFor) {
      ui.rallyFor.rally = { x: t.x, y: t.y };
      ui.selected = { kind: 'building', b: ui.rallyFor };
      ui.rallyFor = null;
      toast('🚩 Point de ralliement placé', 'good');
      refresh(true);
      return;
    }
    if (ui.placing) {
      const r = G.logic.build(ui.placing, t.x, t.y);
      if (!r.ok) {
        if (r.why) toast(r.why, 'warn');
        // Un clic sur un bâtiment existant en mode placement le sélectionne.
        const b = G.economy.at(t.x, t.y);
        if (b) { ui.placing = null; ui.selected = { kind: 'building', b }; }
      } else if (!G.logic.canAfford(G.logic.buildCost(ui.placing))) ui.placing = null;
    } else {
      const b = G.economy.at(t.x, t.y);
      ui.selected = b ? { kind: 'building', b } : { kind: 'tile', x: t.x, y: t.y };
      ui.annex = null;
      if (!b) ui.tab = 'build';
    }
    refresh(true);
  }

  // ---------- Boucle de rafraîchissement ----------
  function refresh(force) {
    if (!G.run) return;
    if (force) ['#topbar', '#panel', '#tabs', '#selection', '#resources'].forEach(s => { const el = $(s); if (el) el._html = null; });
    renderTop();
    renderResources();
    renderTabs();
    renderSelection();
    renderOverlay();
    if (ui.modal === 'dash') { const el = $('#dash'); if (el) setHTML(el, dashHtml()); }
    if (ui.modal === 'tech' && !ui.pointerDown) {
      const sv = $('#tree-sav'); if (sv) sv.textContent = U.fmt(G.run.res.savoir);
      if (ui._treeSig !== techTreeSig()) techTreeModal(true);
    }
    G.lore.check();
    // Ouvre automatiquement les choix de décrets en attente.
    if (!ui.modal && !G.run.over && G.run.pending.length) decreeModal();
  }

  function init() {
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-action]');
      if (el && !el.disabled) act(el.dataset.action, el);
    });
    document.addEventListener('pointerdown', () => (ui.pointerDown = true));
    document.addEventListener('pointerup', () => (ui.pointerDown = false));
    document.addEventListener('mousemove', updateTooltip);
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && !/INPUT|TEXTAREA/.test(e.target.tagName) && G.run && !G.run.over && !ui.modal) {
        e.preventDefault();
        G.userPaused = !G.userPaused;
        refresh(true);
        return;
      }
      if (e.key === 'Escape') {
        if (ui.modal === 'confirm') act('confirmCancel');
        else if (ui.modal && ['settings', 'help', 'meta', 'tech'].includes(ui.modal) && G.run && !G.run.over) closeModal();
        else cancel();
      }
    });
    bindCanvas($('#map'));
  }

  Object.assign(ui, { relations, launched, init, refresh, toast, eraTransition, runEnded, metaScreen, offlineModal, helpModal, closeModal, speed, eventModal });
  return ui;
})();
