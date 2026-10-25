// Chronique : contrats (objectifs datés), événements à choix et effets temporaires.
//
// - Contrats : jusqu'à 3 à la fois (produire, livrer au forum, posséder N bâtiments, atteindre un niveau).
//   Réussis, ils rapportent de l'héritage et une faveur ou des ressources. Ratés, ils disparaissent.
// - Événements : toutes les 5 à 7 minutes de jeu, Maître Hulotte présente un dilemme (G.EVENTS).
// - Effets temporaires (run.timed) : modificateurs à durée limitée, intégrés au calcul des bonus.
G.chronicle = (function () {
  const MAX_CONTRACTS = 3;
  const U = () => G.util;

  function ensure(run) {
    run.contracts = run.contracts || [];
    run.timed = run.timed || [];
    run.prodTotal = run.prodTotal || {};
    run.bonusHeritage = run.bonusHeritage || 0;
    if (run.contractTimer === undefined) run.contractTimer = 45;
    if (run.eventTimer === undefined) run.eventTimer = 360;
  }

  // Arrondi « joli » pour les objectifs (5, 10, 25, 50…).
  function nice(n) {
    const steps = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
    const s = steps.find(v => n / v < 10) || 5000;
    return Math.max(s, Math.round(n / s) * s);
  }

  // Production actuelle d'une ressource (unités par seconde).
  function prodRate(r) {
    let v = 0;
    for (const b of G.run.buildings) {
      const d = G.economy.def(b);
      if (!b.ruined && d.out && d.out[r]) v += d.out[r] * G.economy.lv(b).io * (b._eff || 0) * (b._mult || 1);
    }
    return v;
  }

  // ---------- Contrats ----------
  function makeContract(run) {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const taken = new Set(run.contracts.map(c => c.r || c.b));
    const resList = G.RESOURCE_ORDER.filter(r => !G.RESOURCES[r].uncapped && G.RESOURCES[r].era <= run.era && !taken.has(r) && prodRate(r) > 0.02);
    const types = [];
    if (resList.length) types.push('produce', 'produce', 'deliver');
    const owned = [...new Set(run.buildings.map(b => b.type))].filter(t => t !== 'forum' && !taken.has(t) && !G.BUILDINGS[t].road && G.logic.isUnlocked(t));
    if (owned.length) types.push('build', 'level');
    if (!types.length) return null;
    const type = pick(types), mins = 10 + run.era * 3;
    const c = { id: Date.now() + Math.random(), type, start: run.time, until: run.time + mins * 60 };
    if (type === 'produce' || type === 'deliver') {
      c.r = pick(resList);
      const rate = prodRate(c.r);
      c.amount = nice(type === 'produce' ? Math.max(20, rate * 60 * mins * 0.55) : Math.max(20, rate * 60 * mins * 0.3 + (run.res[c.r] || 0) * 0.5));
      c.base = run.prodTotal[c.r] || 0;
    } else if (type === 'build') {
      c.b = pick(owned);
      c.amount = G.logic.countOf(c.b) + 2 + Math.floor(Math.random() * 2);
    } else {
      const max = G.logic.maxLevel();
      const cands = owned.filter(t => run.buildings.some(b => b.type === t && (b.level || 1) < max));
      if (!cands.length) return null;
      c.b = pick(cands);
      c.amount = Math.min(max, Math.max(...run.buildings.filter(b => b.type === c.b).map(b => b.level || 1)) + 1);
    }
    // Récompense : héritage, plus une faveur ou des ressources.
    const notaires = (G.meta.levels || {}).h_contrats || 0;
    c.heritage = Math.round((2 + run.era * 2) * (1 + 0.25 * notaires));
    if (Math.random() < 0.45) c.favor = true;
    else {
      const list = G.CONTRACT_REWARDS[Math.min(run.era, G.CONTRACT_REWARDS.length - 1)];
      c.reward = {};
      G.util.shuffle(list, Math.random).slice(0, 2).forEach(r => (c.reward[r] = nice(50 * (run.era + 1) * (1 + 0.25 * notaires))));
    }
    return c;
  }

  function progress(c) {
    const run = G.run;
    if (c.type === 'produce') return (run.prodTotal[c.r] || 0) - c.base;
    if (c.type === 'deliver') return Math.min(run.res[c.r] || 0, c.amount);
    if (c.type === 'build') return G.logic.countOf(c.b);
    return Math.max(0, ...run.buildings.filter(b => b.type === c.b).map(b => b.level || 1));
  }

  function label(c) {
    const R = r => G.RESOURCES[r].icon + ' ' + G.RESOURCES[r].name.toLowerCase(), B = t => G.BUILDINGS[t].icon + ' ' + G.BUILDINGS[t].name.toLowerCase();
    if (c.type === 'produce') return 'Produire ' + U().fmt(c.amount) + ' ' + R(c.r);
    if (c.type === 'deliver') return 'Livrer ' + U().fmt(c.amount) + ' ' + R(c.r) + ' au forum';
    if (c.type === 'build') return 'Posséder ' + c.amount + ' × ' + B(c.b);
    return 'Un(e) ' + B(c.b) + ' au niveau ' + c.amount;
  }

  function complete(c) {
    const run = G.run;
    run.contracts = run.contracts.filter(o => o !== c);
    run.bonusHeritage += c.heritage;
    let txt = '🌳 +' + c.heritage;
    if (c.favor) { run.pending.push(G.logic.makeChoice(run, G.meta, 'minor')); txt += ' · une faveur'; }
    if (c.reward) for (const r in c.reward) { G.logistics.add(r, c.reward[r]); txt += ' · ' + G.RESOURCES[r].icon + ' ' + U().fmt(c.reward[r]); }
    run.stats.contracts = (run.stats.contracts || 0) + 1;
    G.ui && G.ui.toast('📜 Contrat rempli : ' + label(c) + ' — ' + txt, 'good');
    G.lore && G.lore.say('contractDone', { what: label(c) });
    run.contractTimer = Math.min(run.contractTimer, 30);
  }

  // Contrat de livraison : on remet les ressources au forum (animation depuis les stocks).
  function deliver(id) {
    const run = G.run, c = run.contracts.find(o => o.id === id);
    if (!c || c.type !== 'deliver' || (run.res[c.r] || 0) < c.amount) return false;
    G.logistics.take({ [c.r]: c.amount }, run.buildings[0]);
    complete(c);
    return true;
  }

  // ---------- Événements ----------
  function ctx() {
    const run = G.run;
    return {
      era: run.era,
      pick: a => a[Math.floor(Math.random() * a.length)],
      R: r => G.RESOURCES[r].name.toLowerCase(),
    };
  }

  function rollEvent() {
    const run = G.run, c = ctx();
    const ids = G.util.shuffle(Object.keys(G.EVENTS).filter(id => id !== run.lastEvent), Math.random);
    for (const id of ids) {
      const ev = G.EVENTS[id](run, c);
      if (ev) { ev.id = id; return ev; }
    }
    return null;
  }

  function canChoose(ch) { return !ch.cost || G.logic.canAfford(ch.cost); }

  function choose(ev, i) {
    const run = G.run, ch = ev.choices[i];
    if (!ch || !canChoose(ch)) return null;
    if (ch.cost) G.logistics.take(ch.cost, run.buildings[0]);
    const e = ch.effects || {};
    if (e.res) for (const r in e.res) G.logistics.add(r, e.res[r]);
    if (e.savoir) run.res.savoir += e.savoir;
    if (e.heritage) run.bonusHeritage += e.heritage;
    if (e.timed) run.timed.push(Object.assign({}, e.timed, { until: run.time + e.timed.dur }));
    if (e.ruin && run.buildings.includes(e.ruin) && !e.ruin.ruined) { e.ruin.ruined = true; e.ruin.hp = 0; G.adjDirty = true; }
    G.logic.recomputeMods();
    run.lastEvent = ev.id;
    return ch.result;
  }

  // ---------- Mise à jour ----------
  // Appelée à chaque pas économique ; `offline` : pas d'événement ni de nouveau contrat en absence.
  function update(dt, offline) {
    const run = G.run;
    ensure(run);
    // Saisons.
    const si = G.economy.seasonIndex();
    if (run.season !== si) {
      const first = run.season === undefined;
      run.season = si;
      G.logic.recomputeMods();
      if (!first && !offline) {
        const s = G.SEASONS.list[si];
        G.ui && G.ui.toast(s.icon + ' ' + s.name + ' : ' + s.desc, si === 3 ? 'warn' : 'info');
        G.lore && G.lore.say('season' + si, {});
      }
    }
    // Effets temporaires expirés.
    const before = run.timed.length;
    run.timed = run.timed.filter(t => t.until > run.time);
    if (run.timed.length !== before) G.logic.recomputeMods();

    // Contrats : progression, réussite, échec, renouvellement.
    for (const c of run.contracts.slice()) {
      if (c.type !== 'deliver' && progress(c) >= c.amount) complete(c);
      else if (run.time > c.until) {
        run.contracts = run.contracts.filter(o => o !== c);
        if (!offline) { G.ui && G.ui.toast('⌛ Contrat expiré : ' + label(c), 'warn'); G.lore && G.lore.say('contractFail', {}); }
      }
    }
    if (!offline && run.contracts.length < MAX_CONTRACTS + ((G.meta.levels || {}).h_contrats || 0)) {
      run.contractTimer -= dt;
      if (run.contractTimer <= 0) {
        const c = makeContract(run);
        run.contractTimer = 90 + Math.random() * 60;
        if (c) {
          run.contracts.push(c);
          G.ui && G.ui.toast('📜 Nouveau contrat : ' + label(c), 'info');
          if (run.stats.contracts === undefined) G.lore && G.lore.say('contractFirst', {});
        }
      }
    }

    if (!offline) { checkAchievements(dt); sampleHistory(dt); }

    // Marché : offres renouvelées périodiquement.
    if (G.logic.market()) {
      run.tradeTimer = (run.tradeTimer === undefined ? 0 : run.tradeTimer) - dt;
      if (run.tradeTimer <= 0 || !run.trades) G.logic.refreshTrades();
    }

    // Événements (jamais pendant une vague ni en absence).
    if (!offline && !run.wave.active) {
      run.eventTimer -= dt;
      if (run.eventTimer <= 0 && G.ui && !G.ui.modal) {
        run.eventTimer = 300 + Math.random() * 120;
        const ev = rollEvent();
        if (ev) G.ui.eventModal(ev);
      }
    }
  }

  // ---------- Succès ----------
  // Pas de succès en mode Bot ni pendant les simulations : ils doivent être mérités.
  let achAcc = 0, histAcc = 0;
  function checkAchievements(dt) {
    achAcc += dt;
    if (achAcc < 5 || G.botSim || (G.bot && G.bot.active) || G.run.botRun || G.run.botUsed) return; // botUsed : le bot a joué dans cette partie
    achAcc = 0;
    const meta = G.meta, run = G.run;
    meta.achievements = meta.achievements || {};
    for (const id in G.ACHIEVEMENTS) {
      const a = G.ACHIEVEMENTS[id];
      if (meta.achievements[id] || !a.check(run, meta)) continue;
      meta.achievements[id] = true;
      meta.heritage += a.reward; meta.heritageTotal += a.reward;
      G.ui && G.ui.toast('🏅 Succès : ' + a.name + ' — 🌳 +' + a.reward, 'good');
      G.lore && G.lore.say('achievement', { name: a.name });
    }
  }

  // ---------- Historique (courbes du tableau de bord) ----------
  // Un échantillon toutes les 10 s de jeu, sur les 15 dernières minutes (non sauvegardé).
  function sampleHistory(dt) {
    histAcc += dt;
    if (histAcc < 10) return;
    histAcc = 0;
    const h = G.hist || (G.hist = []);
    h.push({ t: G.run.time, pop: (G.stats && G.stats.pop) || 0, savoir: G.run.res.savoir, res: Object.assign({}, G.run.res) });
    if (h.length > 90) h.shift();
  }

  // Héritage gagné via la Chronique (contrats, événements).
  function heritageBonus() { return (G.run && G.run.bonusHeritage) || 0; }

  return { update, deliver, progress, label, canChoose, choose, rollEvent, heritageBonus, ensure, makeContract };
})();
