// État du jeu : méta-progression (persistante) + partie en cours (run), sauvegarde.
G.state = (function () {
  const SAVE_KEY = 'lignees_save_v1';

  function newMeta() {
    return {
      heritage: 0,
      heritageTotal: 0,
      levels: {},                  // niveaux de l'arbre d'héritage
      origins: { fluviale: true }, // origines débloquées
      maxRigueur: 0,               // seul le mode Paisible est disponible au départ
      stats: { runs: 0, bestEra: 0, bestWaves: 0 },
      history: [],
      settings: { speed: 1 },
      achievements: {},            // succès débloqués (id → true)
      glory: 0,                    // gloire ✨ (achète des cartes de bâtiment)
      cards: {},                   // cartes possédées par type de bâtiment
      mastery: {},                 // maîtrise par type de bâtiment (1 = ×1)
    };
  }

  function newRun(meta, originId, rigueur) {
    const seed = Math.floor(Math.random() * 2 ** 31);
    const radius = G.map.START_RADIUS + (meta.levels.h_terres || 0);
    const run = {
      seed, origin: originId, rigueur,
      era: 0, time: 0,
      tiles: G.map.generate(seed, originId),
      owned: G.map.initialOwned(radius),
      buildings: [], nextBid: 1,
      res: {},
      techs: {},
      decrees: [], minors: [],
      pending: [],                  // choix de décrets en attente
      rerolls: meta.levels.h_relance || 0,
      tilesBought: 0,
      wave: { index: 0, inEra: 0, timer: G.WAVES.firstDelay, active: false },
      stats: { produced: 0, kills: 0, wavesWon: 0 },
      gloryV2: true, gloryPaid: 0,   // la gloire de la partie est versée à la fin
      over: false,
    };
    G.RESOURCE_ORDER.forEach(k => (run.res[k] = 0));

    // Le forum au centre.
    run.buildings.push({ bid: run.nextBid++, type: 'forum', x: G.map.CX, y: G.map.CY, level: 1, hp: G.BUILDINGS.forum.hp, paused: false, ruined: false });

    // Ressources de départ, modulées par l'héritage, l'origine et la difficulté.
    const mods = G.mods.compute(run, meta);
    const startMult = Math.max(0.2, 1 + mods.start);
    const base = { bois: 60, pierre: 30, nourriture: 40 };
    const originStart = G.ORIGINS[originId].start || {};
    for (const k in base) run.res[k] = Math.round(base[k] * startMult);
    for (const k in originStart) run.res[k] += originStart[k];
    // Les ressources de départ sont rangées dans la réserve du forum.
    run.buildings[0].store = {};
    for (const k in run.res) if (run.res[k] > 0 && !G.RESOURCES[k].uncapped) run.buildings[0].store[k] = run.res[k];
    run.transit = []; run.lt = 0;
    // Archives (héritage) : technologies déjà connues au départ.
    const arch = meta.levels.h_archives || 0;
    const known = [['t_cueillette', 't_agriculture'], ['t_peche', 't_irrigation', 't_bronze'], ['t_ecriture', 't_outils']];
    for (let i = 0; i < arch; i++) known[i].forEach(t => (run.techs[t] = 1));

    // Décret fondateur : un premier choix dès le départ.
    run.pending.push(G.logic.makeChoice(run, meta, 'major'));
    return run;
  }

  function save() {
    if (!G.meta || G.wiping) return; // pas de sauvegarde pendant un effacement
    try {
      const data = { v: 1, meta: G.meta, run: G.run, savedAt: Date.now() };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* stockage indisponible : on continue sans sauvegarde */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function exportSave() {
    save();
    try { return btoa(unescape(encodeURIComponent(localStorage.getItem(SAVE_KEY) || ''))); }
    catch (e) { return ''; }
  }

  function importSave(str) {
    const json = decodeURIComponent(escape(atob(str.trim())));
    const data = JSON.parse(json);
    if (!data.meta) throw new Error('Sauvegarde invalide');
    localStorage.setItem(SAVE_KEY, json);
  }

  // ---------- Emplacements de sauvegarde ----------
  // Chaque emplacement est une copie complète (progression + partie en cours), indépendante des autres.
  const SLOTS = 6, SLOT_KEY = i => 'lignees_slot_' + i;

  function slotInfo(i) {
    try {
      const raw = localStorage.getItem(SLOT_KEY(i));
      if (!raw) return null;
      const s = JSON.parse(raw), run = s.data.run, meta = s.data.meta;
      return {
        name: s.name, savedAt: s.savedAt, heritage: meta.heritage, glory: meta.glory || 0,
        run: run && !run.over ? { era: run.era, time: run.time, origin: run.origin, rigueur: run.rigueur } : null,
      };
    } catch (e) { return null; }
  }

  function saveSlot(i, name) {
    save();
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    localStorage.setItem(SLOT_KEY(i), JSON.stringify({ name: name || ('Lignée ' + (i + 1)), savedAt: Date.now(), data }));
  }

  // Charger un emplacement remplace la sauvegarde active, puis la page se recharge.
  function loadSlot(i) {
    const raw = localStorage.getItem(SLOT_KEY(i));
    if (!raw) return false;
    G.wiping = true; // pas de sauvegarde automatique par-dessus
    localStorage.setItem(SAVE_KEY, JSON.stringify(JSON.parse(raw).data));
    location.reload();
    return true;
  }

  function deleteSlot(i) { localStorage.removeItem(SLOT_KEY(i)); }

  // Repartir de zéro dans un nouvel emplacement : la sauvegarde active est effacée (pensez à la ranger avant).
  function blank() {
    G.wiping = true;
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }

  function wipe() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
  }

  return { newMeta, newRun, save, load, exportSave, importSave, wipe, SLOTS, slotInfo, saveSlot, loadSlot, deleteSlot, blank };
})();
