// Point d'entrée : chargement, progression hors ligne, boucle de jeu et sauvegarde automatique.
(function () {
  const ECO_STEP = 0.2;      // pas de simulation économique (s)
  const COMBAT_STEP = 0.05;  // pas de simulation des combats (s)
  const OFFLINE_CAP = 12 * 3600;

  let last = performance.now(), ecoAcc = 0, rateAcc = 0, uiAcc = 0, saveAcc = 0;

  function boot() {
    const saved = G.state.load();
    G.meta = saved && saved.meta ? Object.assign(G.state.newMeta(), saved.meta) : G.state.newMeta();
    // Thème graphique : celui de la sauvegarde (import compris) s'il diffère de celui du navigateur.
    if (G.meta.settings && G.meta.settings.theme && G.meta.settings.theme !== G.theme.id) G.theme.apply(G.meta.settings.theme);
    else G.meta.settings.theme = G.theme.id;
    // V1.4 : les difficultés ont changé de sens (Paisible = sans ennemis, + à +++ à débloquer).
    if (!G.meta.metaV || G.meta.metaV < 2) { G.meta.maxRigueur = G.meta.stats.bestEra >= 2 ? 1 : 0; G.meta.metaV = 2; }
    // V1.5 : une ère (Préhistoire) s'insère au début, les ères existantes sont décalées d'un cran.
    if (G.meta.metaV < 3) {
      G.meta.stats.bestEra = (G.meta.stats.bestEra || 0) + 1;
      (G.meta.history || []).forEach(h => (h.era = (h.era || 0) + 1));
      if (saved && saved.run && !saved.run.over) saved.run.era = (saved.run.era || 0) + 1;
      G.meta.metaV = 3;
    }
    G.render.init(document.getElementById('map'));
    G.ui.init();

    if (saved && saved.run && !saved.run.over) {
      G.run = saved.run;
      if (G.map.migrate(G.run)) setTimeout(() => G.ui.toast("🗺️ La carte s'est agrandie : de nouvelles terres vous entourent.", 'info'), 400);
      G.logistics.migrate(G.run);
      G.map.addRares(G.run);
      G.map.restoreDeposits(G.run);
      G.logic.recomputeMods();
      G.economy.rebuildGrid();
      G.logistics.recount();
      G.economy.tick(0.01);
      document.body.style.setProperty('--era', G.ERAS[G.run.era].color);
      G.run.wave.active = false; // une vague interrompue par la fermeture est rejouée
      const elapsed = Math.min(OFFLINE_CAP, (Date.now() - saved.savedAt) / 1000);
      if (elapsed > 30) offline(elapsed);
      G.ui.refresh(true);
    } else {
      // Première visite (ou partie terminée) : écran de fondation.
      G.ui.metaScreen('new');
      if (!saved) setTimeout(() => G.ui.toast('Bienvenue ! Choisissez une origine puis fondez votre civilisation.', 'info'), 300);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { G.hiddenAt = Date.now(); G.state.save(); }
      else if (G.hiddenAt && G.run && !G.run.over) {
        const gone = (Date.now() - G.hiddenAt) / 1000;
        G.hiddenAt = null;
        if (gone > 30) { offline(Math.min(OFFLINE_CAP, gone)); G.ui.refresh(true); }
        last = performance.now();
      }
    });
    window.addEventListener('beforeunload', () => G.state.save());
    requestAnimationFrame(frame);
  }

  // Simulation accélérée de l'absence : l'économie tourne à efficacité réduite,
  // les invasions sont suspendues (la minuterie des vagues ne tourne pas hors ligne).
  function offline(seconds) {
    const run = G.run;
    const eff = Math.min(1, 0.6 + G.M.offline);
    const before = Object.assign({}, run.res);
    const rep = { seconds, eff, gains: {} };
    const step = 2;
    let t = 0;
    G.defense.reset();
    G.offlineSim = true;
    while (t < seconds) {
      const dt = Math.min(step, seconds - t);
      G.economy.tick(dt, eff);
      run.time += dt;
      G.chronicle.update(dt, true);
      t += dt;
    }
    G.offlineSim = false;
    for (const r in run.res) rep.gains[r] = run.res[r] - before[r];
    G.delta = {};
    G.ui.offlineModal(rep);
    G.lore && G.lore.say('offline', { time: G.util.fmtTime(seconds) });
  }

  function frame(now) {
    const realDt = Math.min(0.25, (now - last) / 1000);
    last = now;
    const time = now / 1000;

    if (G.run && !G.run.over && !G.paused && !G.userPaused) {
      const dt = realDt * G.ui.speed();
      // Combat à pas fixe pour rester stable en vitesse accélérée.
      let rem = dt;
      while (rem > 0) {
        const s = Math.min(COMBAT_STEP, rem);
        G.defense.update(s);
        rem -= s;
        if (G.run.over) break;
      }
      ecoAcc += dt;
      while (ecoAcc >= ECO_STEP && !G.run.over) { G.economy.tick(ECO_STEP); G.chronicle.update(ECO_STEP); ecoAcc -= ECO_STEP; }
      G.run.time += dt;
      G.ecoLag = ecoAcc; // pour interpoler la position des cellules entre deux pas économiques
      rateAcc += dt;
      if (rateAcc >= 1) { G.economy.sampleRates(rateAcc); rateAcc = 0; }
    }

    uiAcc += realDt;
    if (uiAcc >= 0.25) { uiAcc = 0; G.ui.refresh(); }
    saveAcc += realDt;
    if (saveAcc >= 10) { saveAcc = 0; G.state.save(); }

    G.render.draw(time);
    requestAnimationFrame(frame);
  }

  window.addEventListener('load', boot);
})();
