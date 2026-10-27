// Pêche Perchée V2 — cœur du jeu : état, pêche, systèmes (quêtes, succès, événements…)
(() => {
  'use strict';
  const D = G.D, W = G.world, A = G.audio, Q = D.quips;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
  const fmtKg = (w) => (w < 1 ? w.toFixed(2) : w < 100 ? w.toFixed(1) : Math.round(w)) + ' kg';
  G.util = { rand, pick, clamp, lerp, fmt, fmtKg };

  const fishById = {};
  D.spots.forEach((sp) => sp.fish.forEach((a) => {
    const o = a[10] || {};
    fishById[a[0]] = { id: a[0], name: a[1], rarity: a[2], w: a[3], v: a[4], fight: a[5], color: a[6], depth: a[7], beh: a[8], desc: a[9], junk: !!o.junk, lsd: !!o.lsd, zone: o.zone || null, night: !!o.night, weather: o.weather || null, spot: sp.id };
  }));
  G.fishById = fishById;
  const byId = (list, id) => list.find((x) => x.id === id);
  const cosById = (id) => byId(D.cosmetics, id);

  // ---------------------------------------------------------------- Sauvegarde
  const SAVE_KEY = 'pechePerchee_v2';
  function defaultState() {
    return {
      ver: 4, money: 0, rod: 'r1', rods: ['r1'], reel: 'm0', reels: ['m0'], line: 'l0', lines: ['l0'],
      bait: 'b0', baits: {}, bucketLvl: 0, bucket: [], spots: ['s1'], spot: 's1', depth: 's', boat: false,
      upgrades: [], dex: {}, aquarium: [], roger: { xp: 0, lvl: 0 },
      cos: { owned: ['hat_none', 'hat_bob', 'vest_orange', 'bob_classique'], hat: 'hat_bob', vest: 'vest_orange', bobber: 'bob_classique', deco: [] },
      quest: { step: 0, base: null, ready: false }, achievements: {}, orders: [],
      stats: { caught: 0, junk: 0, snaps: 0, snapStreak: 0, snapStreakMax: 0, escapes: 0, misses: 0, earned: 0, spent: 0, sells: 0, legend: 0, night: 0, weather: 0, orders: 0, contests: 0, gullsChased: 0, gullsStolen: 0, bottles: 0, casts: 0, maxW: 0, minW: 9999, rogerFed: 0, soldLetter: 0, merchantBuys: 0, eaten: 0, tripMax: 0, cooked: 0, burnt: 0, star5: 0, dishSold: 0, dishOrders: 0, festin: 0, harvest: 0, zoneCatch: {}, manualSaves: 0 },
      trip: { t: 0, lvl: 0 },
      rpg: { xp: 0, lvl: 1, cxp: 0, clvl: 1, skills: {}, init: false },
      hook: 'h0', hooks: ['h0'], net: 'n0', nets: ['n0'], acc: [],
      cook: { stove: 0, knife: 0, apps: [], recipes: [], mastery: {}, slots: [] },
      techs: [], utensils: [], boats: [], zone: 'rive', ordersCD: 0, savedAt: 0,
      farm: { owned: 0, plots: [null, null, null, null, null, null, null, null], lvl: 1, xp: 0, can: 0, tools: {} },
      pantry: {}, dishes: [], buffs: [], nextWeather: null,
      time: 0.12, weather: 'clair', weatherT: 150, contestCD: 0, opts: { music: true, sfx: true, softTrip: false }, seenWelcome: false, flags: { treasure: false },
    };
  }
  function merge(d, s) {
    for (const k in s) {
      if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) d[k] = Object.assign(d[k], s[k]);
      else d[k] = s[k];
    }
    return d;
  }
  function load() {
    const d = defaultState();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) { const o = JSON.parse(raw); const m = merge(d, o); m.legacy = !o.ver; return m; }
      const old = localStorage.getItem('pechePerchee_v1');
      if (old) { // reprise de la V1
        const o = JSON.parse(old);
        ['money', 'rod', 'rods', 'bait', 'baits', 'bucketLvl', 'spots', 'spot', 'dex'].forEach((k) => { if (o[k] !== undefined) d[k] = o[k]; });
        d.bucket = (o.bucket || []).filter((it) => fishById[it.id]);
        d.stats.caught = o.totalCaught || 0;
        d.migrated = true; d.legacy = true;
      }
    } catch (e) { /* stockage indisponible */ }
    return d;
  }
  let S = load();
  let saveT = 0, resetting = false;
  function save() { if (resetting) return; S.savedAt = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* tant pis */ } }

  const rod = () => byId(D.rods, S.rod);
  const reel = () => byId(D.reels, S.reel);
  const line = () => byId(D.lines, S.line);
  const bait = () => byId(D.baits, S.bait);
  const spot = () => byId(D.spots, S.spot);
  const spotIdx = () => D.spots.findIndex((s) => s.id === S.spot);
  const has = (u) => S.upgrades.includes(u);
  const bucketCap = () => D.buckets[S.bucketLvl].cap + perks().bucket;
  const aquaCap = () => (has('u_aqua') ? 10 : 4);
  G.aquaCap = aquaCap;

  // ---------------------------------------------------------------- Temps, météo, modificateurs
  function nightK(t = S.time) {
    if (t < 0.6) return 0;
    if (t < 0.68) return (t - 0.6) / 0.08;
    if (t < 0.92) return 1;
    return 1 - (t - 0.92) / 0.08;
  }
  const isNight = () => nightK() > 0.5;
  function clockStr() {
    const h = (6 + S.time * 24) % 24;
    return String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0');
  }
  // Bonus cumulés : matériel, compétences, accessoires, plats (buffs)
  const PERK_KEYS = ['bite', 'zone', 'window', 'shadow', 'radius', 'rare', 'loss', 'sell', 'cast', 'dish', 'speed', 'save', 'quality', 'burn', 'double', 'xp', 'net', 'nightRare', 'nightShadow', 'wetCalm', 'wetBite', 'deep', 'bucket', 'forecast'];
  function perks() {
    const p = {};
    PERK_KEYS.forEach((k) => (p[k] = 0));
    const add = (o, m = 1) => { if (!o) return; for (const k in o) if (k in p && typeof o[k] === 'number') p[k] += o[k] * m; };
    add(rod().perk);
    add((byId(D.hooks, S.hook) || {}).perk);
    add((byId(D.nets, S.net) || {}).perk);
    S.acc.forEach((id) => add((byId(D.accessories, id) || {}).perk));
    D.skills.forEach((sk) => { const n = S.rpg.skills[sk.id] || 0; if (n) add(sk.perk, n); });
    S.buffs.forEach((b) => {
      if (b.k === 'all') { ['bite', 'window', 'rare', 'sell', 'xp'].forEach((k) => (p[k] += b.v)); p.zone += b.v * 0.1; }
      else if (b.k in p) p[b.k] += b.v;
    });
    return p;
  }
  const zoneDef = () => byId(D.zones, S.zone) || D.zones[0];
  const tierOwned = () => S.boats.reduce((m, id) => Math.max(m, (byId(D.boats, id) || { tier: 0 }).tier), 0);
  function mods() {
    const w = D.weathers[S.weather].mods, b = bait(), pk = perks(), zd = zoneDef();
    const wet = S.weather === 'pluie' || S.weather === 'orage', night = isNight();
    return {
      bite: (w.bite || 1) * b.speed * (1 + pk.bite) * (wet ? 1 + pk.wetBite : 1),
      rare: (w.rare || 1) * b.rare * (night ? 1.15 + pk.nightRare : 1) * (S.roger.lvl >= 5 ? 1.2 : 1) * zd.rare * (S.trip.t > 0 ? 1 + 0.2 * S.trip.lvl : 1) * (1 + pk.rare) * (b.night ? (night ? 1.8 : 0.9) : 1),
      weight: (w.weight || 1) * zd.wt,
      fight: (w.fight || 1) * (wet ? 1 - pk.wetCalm : 1),
      price: w.price || 1,
    };
  }
  function todayKey() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function dailyFish(spId) {
    const sp = byId(D.spots, spId);
    const c = sp.fish.map((a) => fishById[a[0]]).filter((f) => f.rarity !== 'legende' && !f.junk && !f.weather && !f.zone);
    return c[hash(todayKey() + spId) % c.length];
  }

  function fishPool(depth, spId = S.spot) {
    const night = isNight();
    return byId(D.spots, spId).fish.map((a) => fishById[a[0]])
      .filter((f) => (!f.night || night) && (!f.weather || f.weather === S.weather) && (!f.zone || f.zone === S.zone) && (!depth || f.depth === depth));
  }
  function rollFish(depth, opt = {}) {
    let pool = fishPool(depth, opt.spot);
    if (!pool.length) pool = fishPool(null, opt.spot);
    if (opt.forceRare) { const r = pool.filter((f) => D.rarities[f.rarity].rank >= 2); if (r.length) pool = r; }
    if (opt.commonOnly) { const r = pool.filter((f) => D.rarities[f.rarity].rank <= 1); if (r.length) pool = r; }
    const m = mods();
    const weights = pool.map((f) => D.rarities[f.rarity].weight * (f.rarity === 'commun' ? 1 : m.rare * (depth === 'f' ? 1 + perks().deep : 1) * (bait().depth && bait().depth === depth ? 1.4 : 1)) * (f.night || f.weather ? 2 : 1) * (f.lsd && S.trip.t > 0 ? 3 : 1) * (f.zone ? 3 : zoneDef().normal));
    let r = Math.random() * weights.reduce((a, c) => a + c, 0);
    let fish = pool[0];
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { fish = pool[i]; break; } }
    const w = (fish.w[0] + (fish.w[1] - fish.w[0]) * Math.pow(Math.random(), 1.6)) * m.weight;
    return { fish, w };
  }

  // ---------------------------------------------------------------- Argent
  function earn(n) { n = Math.round(n); S.money += n; S.stats.earned += n; return n; }
  function spend(n) {
    if (S.money < n) { G.ui.say(pick(Q.poor)); A.sfx.escape(); return false; }
    S.money -= n; S.stats.spent += n; A.sfx.coin(); return true;
  }
  const sellMult = () => (S.roger.lvl >= 2 ? 1.1 : 1) * (1 + perks().sell);

  // ---------------------------------------------------------------- Ombres de poissons
  const shadows = [];
  let shadowSpawnT = 0.5;
  const bobPos = new THREE.Vector3();
  function area() { const r = W.rig.position; return { x0: r.x - 13, x1: r.x + 13, z0: r.z - 27, z1: r.z - 5 }; }
  function randIn(a) { return new THREE.Vector3(rand(a.x0, a.x1), 0, rand(a.z0, a.z1)); }
  function makeShadowMesh(fish, w) {
    const m = G.models.shadow();
    m.scale.setScalar(clamp(0.7 + Math.log10(1 + w) * 0.6, 0.6, 3.4));
    if (has('u_sonar')) m.userData.mat.color.set(D.rarities[fish.rarity].color);
    m.userData.mat.opacity = 0;
    W.scene.add(m);
    return m;
  }
  function spawnShadow(depth, fishRoll, extra) {
    depth = depth || pick(['s', 'm', 'f']);
    if (!fishPool(depth).length) return null;
    const r = fishRoll || rollFish(depth);
    const a = area();
    const s = Object.assign({ fish: r.fish, w: r.w, depth, pos: randIn(a), target: randIn(a), speed: rand(0.5, 1.1), state: 'roam', heading: rand(0, 6), fade: 0 }, extra || {});
    s.mesh = makeShadowMesh(r.fish, r.w);
    shadows.push(s);
    return s;
  }
  function removeShadow(s) { if (!s) return; W.scene.remove(s.mesh); const i = shadows.indexOf(s); if (i >= 0) shadows.splice(i, 1); }
  function resetShadows() { shadows.slice().forEach(removeShadow); for (let i = 0; i < 3; i++) spawnShadow(); shadowSpawnT = 1; }
  function spawnSchool() {
    const depth = pick(['s', 'm']);
    const pool = fishPool(depth).filter((f) => D.rarities[f.rarity].rank <= 1 && !f.junk);
    if (!pool.length) return;
    const fish = pick(pool), a = area(), z = rand(a.z0 + 6, a.z1 - 2);
    for (let i = 0; i < 7; i++) {
      const w = fish.w[0] + (fish.w[1] - fish.w[0]) * Math.random();
      const s = spawnShadow(depth, { fish, w }, { state: 'school', life: 45, vel: new THREE.Vector3(1.6, 0, 0), heading: 0 });
      if (s) s.pos.set(a.x0 - 3 - i * 1.3, 0, z + rand(-1.6, 1.6));
    }
    G.ui.say(pick(Q.school));
  }
  function updateShadows(dt, T) {
    const sb = perks().shadow + (isNight() ? perks().nightShadow : 0);
    const desired = 4 + (S.boat ? 1 : 0);
    const normal = shadows.filter((s) => s.state === 'roam' || s.state === 'approach' || s.state === 'flee').length;
    shadowSpawnT -= dt;
    if (normal < desired && shadowSpawnT <= 0) { spawnShadow(); shadowSpawnT = rand(2, 5); }
    const a = area();
    for (const s of shadows.slice()) {
      if (s.state === 'hooked') { s.mesh.visible = false; continue; }
      s.mesh.visible = true;
      if (s.state === 'school') {
        s.pos.addScaledVector(s.vel, dt);
        s.life -= dt;
        if (s.life <= 0 || s.pos.x > a.x1 + 6) { s.fade -= dt * 2; if (s.fade <= 0) { removeShadow(s); continue; } }
        else s.fade = Math.min(1, s.fade + dt);
      } else {
        const tgt = s.state === 'approach' ? bobPos : s.target;
        const sp = s.state === 'approach' ? 1.7 : s.state === 'flee' ? 3.2 : s.speed;
        const dx = tgt.x - s.pos.x, dz = tgt.z - s.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.05) { const step = Math.min(d, sp * dt); s.pos.x += (dx / d) * step; s.pos.z += (dz / d) * step; s.heading = Math.atan2(dz, dx); }
        if (s.state !== 'approach' && d < 0.5) { s.target = randIn(a); if (s.state === 'flee') s.state = 'roam'; }
        s.fade = Math.min(1, s.fade + dt);
      }
      s.mesh.userData.mat.opacity = Math.min(0.95, D.depths[s.depth].shadow * (1 + sb) * clamp(s.fade, 0, 1));
      if (s.fish.lsd) s.mesh.userData.mat.color.setHSL((T * 0.3 + s.pos.x * 0.05) % 1, 0.85, 0.6); // les ombres LSD scintillent
      s.mesh.position.set(s.pos.x, -0.35 - D.depths[s.depth].rank * 0.25, s.pos.z);
      s.mesh.rotation.y = -s.heading + Math.sin(T * 6 + s.pos.x) * 0.15;
    }
  }

  // ---------------------------------------------------------------- Pêche : machine à états
  let state = 'idle', holding = false, T = 0;
  const tipPos = new THREE.Vector3(), castFrom = new THREE.Vector3(), castTo = new THREE.Vector3(), reelBackFrom = new THREE.Vector3(), tmpV = new THREE.Vector3();
  let chargeT = 0, power = 0, castT = 0, waitT = 0, biteT = 0, nibbleCD = 0, reelBackT = 0, snapT = 0, tickT = 0, scanT = 0, rattled = false;
  let hooked = null, R = null, approacher = null, caughtMesh = null, caughtT = 0, lastCatch = null, gull = null, forceGull = false;
  let junkStreak = 0;
  const ROD_IDLE = -0.95;

  const $ = (s) => document.querySelector(s);
  const el = {
    hint: $('#hint'), power: $('#power'), powerFill: $('#power-fill'), reel: $('#reel'), reelZone: $('#reel-zone'), reelNeedle: $('#reel-needle'),
    reelProg: $('#reel-prog-fill'), reelWarn: $('#reel-warn'), reelName: $('#reel-beh'), bang: $('#bang'),
  };
  const HINTS = {
    idle: 'Maintiens clic / Espace pour charger · vise les ombres sous l\'eau',
    charging: 'Relâche pour lancer !', casting: '…',
    waiting: 'Attends que ça morde… (clic = remonter la ligne)',
    bite: 'ÇA MORD ! CLIQUE !',
    reeling: 'Maintiens pour mouliner · garde l\'aiguille dans le vert',
    reelback: '…', caught: 'Clic pour continuer', snapped: '…',
  };
  function setState(s) {
    state = s;
    const g = gull && gull.phase === 'dive';
    el.hint.textContent = g ? '🐦 CHASSE LA MOUETTE ! (clic / Espace)' : HINTS[s] || '';
    el.hint.classList.toggle('alert', s === 'bite' || !!g);
  }

  function startCharge() {
    if (S.bucket.length >= bucketCap()) { G.ui.say(pick(Q.full)); A.sfx.escape(); return; }
    chargeT = 0; power = 0;
    el.power.classList.remove('hidden');
    W.setHeroMode('charge');
    setState('charging');
  }
  function doCast() {
    el.power.classList.add('hidden');
    const b = bait();
    if (b.cost !== 0) {
      S.baits[b.id] = (S.baits[b.id] || 0) - 1;
      if (S.baits[b.id] <= 0) { delete S.baits[b.id]; S.bait = 'b0'; setTimeout(() => G.ui.say(`Plus de ${b.name}. Retour à la mie de pain.`), 1200); }
    }
    S.stats.casts++;
    W.rodTip.getWorldPosition(castFrom);
    const dist = (3.5 + power * 16 * rod().range + (S.boat ? 2 : 0)) * (1 + perks().cast);
    const r = W.rig.position;
    castTo.set(r.x + rand(-2.5, 2.5) + power * rand(-1.5, 1.5), 0, r.z - 2 - dist);
    castT = 0;
    A.sfx.whoosh();
    W.setHeroMode('cast');
    setState('casting');
    if (power < 0.12) G.ui.say(pick(Q.shortCast));
    else if (Math.random() < 0.25) G.ui.say(pick(Q.cast));
    G.ui.updateHUD();
  }
  function findApproacher(talk) {
    const radius = 4.5 + (bait().speed - 1) * 2 + (S.boat ? 1 : 0) + perks().radius + (bait().depth === S.depth ? 2.5 : 0);
    let best = null, bd = 1e9, other = false;
    shadows.forEach((s) => {
      if (s.state === 'hooked' || s.state === 'flee') return;
      const d = Math.hypot(s.pos.x - bobPos.x, s.pos.z - bobPos.z);
      if (d < radius) { if (s.depth === S.depth) { if (d < bd) { bd = d; best = s; } } else other = true; }
    });
    if (best) {
      best.state = 'approach'; approacher = best; waitT = 99;
      if (talk && Math.random() < 0.4) G.ui.say(pick(Q.approach));
    }
    return { best, other };
  }
  function land() {
    bobPos.copy(castTo);
    A.sfx.plop(); W.ripple(bobPos); W.splash(bobPos, 8);
    approacher = null; rattled = false; scanT = 0.5;
    const { best, other } = findApproacher(true);
    if (!best) {
      waitT = rand(7, 13) / mods().bite;
      if (other && Math.random() < 0.6) G.ui.say(pick(Q.wrongDepth));
      else if (Math.random() < 0.2) G.ui.say(pick(Q.noShadow));
    }
    nibbleCD = rand(1, 2.5);
    W.setHeroMode('wait');
    setState('waiting');
  }
  function bite() {
    clearFake(false);
    if (approacher) hooked = { fish: approacher.fish, w: approacher.w };
    else {
      hooked = rollFish(S.depth, { forceRare: S.flags.treasure });
      if (S.flags.treasure) { S.flags.treasure = false; G.ui.say("🗺️ La Carte au Trésor indiquait cet endroit… Quelque chose de rare a mordu !"); }
    }
    hooked.ratio = hooked.w / rod().max;
    biteT = 0.75 + 0.25 / Math.max(1, hooked.fish.fight) + (S.roger.lvl >= 1 ? 0.3 : 0) + perks().window;
    A.sfx.bite();
    W.ripple(bobPos, 1.3); W.splash(bobPos, 6);
    el.bang.classList.remove('hidden');
    W.setHeroMode('bite');
    setState('bite');
  }
  function hook() {
    el.bang.classList.add('hidden');
    const f = hooked.fish, m = mods();
    if (approacher) approacher.state = 'hooked';
    R = {
      t: 0, tension: 0.35, progress: 0.3, ph: 0,
      diff: f.fight * m.fight * (0.6 + 0.4 * clamp(hooked.ratio, 0, 3)),
      zoneW: clamp(rod().ctrl + perks().zone + (S.roger.lvl >= 3 ? 0.04 : 0) - 0.035 * f.fight, 0.12, 0.48),
      zoneC: 0.5, zoneTarget: 0.5, jerkT: rand(0.6, 1.4), start: bobPos.clone(), phase: rand(0, 10),
      beh: f.beh, sprintT: rand(2, 4), sprinting: 0, jumpT: rand(1.5, 3), cursed: !!bait().cursed,
    };
    holding = true;
    el.reel.classList.remove('hidden');
    el.reelWarn.textContent = hooked.ratio > 1 ? pick(Q.tooHeavy) : '';
    el.reelName.textContent = '🐟 ' + D.behaviors[f.beh].label + ' — ' + D.behaviors[f.beh].desc + (R.cursed ? ' 💀 Appât maudit !' : '');
    W.setHeroMode('reel');
    setState('reeling');
  }
  function endReel() { el.reel.classList.add('hidden'); el.reel.classList.remove('danger'); R = null; }
  function releaseApproacher(flee) { if (approacher) { approacher.state = flee ? 'flee' : 'roam'; approacher.target = randIn(area()); approacher = null; } }

  function snapLine() {
    endReel(); A.sfx.snap(); W.splash(bobPos, 10); W.shake(0.12);
    S.stats.snaps++; S.stats.snapStreak++; S.stats.snapStreakMax = Math.max(S.stats.snapStreakMax, S.stats.snapStreak);
    G.ui.say(S.stats.snapStreak >= 2 ? pick(Q.snapStreak) : pick(Q.snap));
    if (Math.random() < 0.35) setTimeout(() => G.ui.say(pick(Q.heroSad), D.hero), 2200);
    releaseApproacher(true);
    W.bobber.visible = false;
    snapT = 1.4;
    W.setHeroMode('sad');
    setState('snapped');
  }
  function startReelBack() {
    reelBackFrom.copy(bobPos); reelBackT = 0;
    el.bang.classList.add('hidden');
    setState('reelback');
  }
  function escapeFish() {
    endReel(); A.sfx.escape(); S.stats.escapes++;
    G.ui.say(pick(Q.escape)); releaseApproacher(true); hooked = null;
    W.setHeroMode('sad');
    startReelBack();
  }

  function landFish() {
    endReel();
    S.stats.snapStreak = 0;
    const { fish, w } = hooked;
    const m = mods();
    const daily = dailyFish(S.spot).id === fish.id;
    const price = Math.max(1, Math.round(fish.v * w * m.price * (daily ? 3 : 1)));
    const isNew = !S.dex[fish.id];
    S.dex[fish.id] = S.dex[fish.id] || { n: 0, best: 0 };
    S.dex[fish.id].n++;
    S.dex[fish.id].best = Math.max(S.dex[fish.id].best, w);
    const st = S.stats;
    st.caught++; if (fish.junk) st.junk++; if (fish.rarity === 'legende') st.legend++;
    if (fish.night) st.night++; if (fish.weather) st.weather++;
    st.maxW = Math.max(st.maxW, w); st.minW = Math.min(st.minW, w);
    st.zoneCatch[S.zone] = (st.zoneCatch[S.zone] || 0) + 1;
    const item = { id: fish.id, w: Math.round(w * 100) / 100, price, daily };
    S.bucket.push(item);
    addXp(fishXp(fish, price), 'fish');
    let double = false;
    if (S.roger.lvl >= 4 && Math.random() < 0.1 && S.bucket.length < bucketCap()) { S.bucket.push(Object.assign({}, item)); st.caught++; double = true; }
    if (contest) contest.me += w * (double ? 2 : 1);
    removeShadow(approacher); approacher = null;

    if (fish.rarity === 'legende') { A.sfx.legend(); W.confetti(bobPos); W.shake(0.15); } else A.sfx.catch();
    W.splash(bobPos, 16); W.ripple(bobPos, 1.6);
    caughtMesh = G.models.fish(fish, w);
    caughtMesh.position.copy(bobPos);
    caughtMesh.userData.from = bobPos.clone();
    W.scene.add(caughtMesh);
    caughtT = 0;
    W.bobber.visible = false;
    W.setHeroMode('joy');

    junkStreak = fish.junk ? junkStreak + 1 : 0;
    const quip = tripping() && Math.random() < 0.5 ? pick(Q.tripCatch) : junkStreak >= 2 ? pick(Q.junkStreak) : fish.junk ? pick(Q.junk) : pick(Q.catch[fish.rarity]);
    G.ui.say(quip, fish.rarity === 'legende' ? 'Narrateur (ému)' : 'Narrateur');
    if (Math.random() < 0.3) setTimeout(() => { if (state === 'caught' && !gull) G.ui.say(pick(Q.hero), D.hero, 2500); }, 2600);
    if (daily) setTimeout(() => G.ui.toast(pick(Q.dailyFish), '⭐'), 400);
    if (double) setTimeout(() => G.ui.toast('Roger a trouvé un 2e ' + fish.name + ' collé au premier !', '🪨'), 800);

    if (fish.lsd) setTimeout(() => G.ui.toast(pick(Q.lsdCatch), '🌈', 6500), 900);
    lastCatch = { fish, w, price, isNew, daily, double, item, trip: tripping() };
    G.ui.showCatch(lastCatch);
    setState('caught');

    if ((Math.random() < 0.12 || forceGull) && fish.rarity !== 'legende') { forceGull = false; startGull(); }
    else afterCatch();
    save(); G.ui.updateHUD();
  }
  function afterCatch() {
    if (S.bucket.length >= bucketCap() && has('u_auto')) {
      const total = S.bucket.reduce((a, it) => a + it.price, 0) * 0.8 * sellMult();
      S.bucket.forEach((it) => { if (it.id === 'lettre') S.stats.soldLetter++; });
      S.bucket = []; earn(total); S.stats.sells++;
      setTimeout(() => G.ui.toast(Q.autoSell[0] + ' +' + fmt(total) + ' 🪙', '🚚'), 1500);
      G.ui.updateHUD();
    }
  }
  function closeCatch() {
    if (gull && gull.phase === 'dive') { chaseGull(); return; }
    G.ui.hideCatch();
    if (caughtMesh) { W.scene.remove(caughtMesh); caughtMesh = null; }
    W.bobber.visible = true;
    hooked = null;
    W.setHeroMode('idle');
    setState('idle');
  }

  // ---------------------------------------------------------------- Gégé la Mouette
  const SHOW_OFF = new THREE.Vector3(0.9, 2.3, -2.8);
  const fishShow = () => W.rig.position.clone().add(SHOW_OFF);
  function hitSphere(obj, r) {
    obj.add(new THREE.Mesh(new THREE.SphereGeometry(r, 6, 4), new THREE.MeshBasicMaterial({ visible: false })));
  }
  function startGull() {
    const obj = G.models.gull();
    hitSphere(obj, 1.2);
    const to = fishShow();
    const from = to.clone().add(new THREE.Vector3(9, 7, -7));
    obj.position.copy(from);
    W.scene.add(obj); W.clickable(obj, 'gull');
    gull = { obj, t: 0, dur: 2.0, phase: 'dive', from, to };
    A.sfx.gull();
    G.ui.say(pick(Q.gull), 'Narrateur', 2200);
    G.ui.setCatchButton('🚫 CHASSER GÉGÉ !', true);
    setState('caught');
  }
  function chaseGull() {
    if (!gull || gull.phase !== 'dive') return;
    gull.phase = 'flee'; gull.t = 0; gull.from = gull.obj.position.clone();
    gull.to = gull.from.clone().add(new THREE.Vector3(14, 12, -10));
    S.stats.gullsChased++;
    A.sfx.pop(); A.sfx.gull();
    G.ui.say(pick(Q.gullChased));
    G.ui.setCatchButton(null);
    setState('caught');
    afterCatch();
  }
  function gullSteal() {
    gull.phase = 'steal'; gull.t = 0; gull.from = gull.obj.position.clone();
    gull.to = gull.from.clone().add(new THREE.Vector3(-16, 14, -12));
    const i = S.bucket.indexOf(lastCatch.item);
    if (i >= 0) S.bucket.splice(i, 1);
    if (contest) contest.me = Math.max(0, contest.me - lastCatch.w);
    S.stats.gullsStolen++;
    A.sfx.gull();
    if (caughtMesh) { W.scene.remove(caughtMesh); gull.obj.add(caughtMesh); caughtMesh.position.set(0, -0.5, -0.5); caughtMesh.scale.multiplyScalar(0.7); caughtMesh = null; }
    G.ui.say(pick(Q.gullStole));
    G.ui.setCatchButton('Bon…', false, true);
    setState('caught');
    save(); G.ui.updateHUD();
  }
  function updateGull(dt) {
    if (!gull) return;
    gull.t += dt;
    const o = gull.obj;
    o.userData.wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * Math.sin(T * 18) * 0.7));
    if (gull.phase === 'dive') {
      const k = Math.min(1, gull.t / gull.dur);
      o.position.lerpVectors(gull.from, gull.to, k); o.position.y += Math.sin(k * Math.PI) * 1.5;
      o.rotation.y = W.faceYaw(gull.from, gull.to);
      if (k >= 1) gullSteal();
    } else {
      const k = Math.min(1, gull.t / 2.5);
      o.position.lerpVectors(gull.from, gull.to, k);
      o.rotation.y = W.faceYaw(gull.from, gull.to);
      if (k >= 1) { W.unclickable(o); W.scene.remove(o); gull = null; if (state === 'caught') setState('caught'); }
    }
  }

  // ---------------------------------------------------------------- Événements : bouteilles, banc, marchand, filet, éclairs
  let bottle = null, bottleT = rand(90, 180), schoolT = rand(140, 260), merchant = null, merchantT = rand(150, 320), netT = 45, lightningT = 8, idleChat = 30;
  function spawnBottle() {
    const a = area();
    const obj = G.models.bottle(); hitSphere(obj, 1.3);
    bottle = { obj, pos: new THREE.Vector3(rand(a.x0 + 4, a.x1 - 4), 0, rand(a.z0 + 9, a.z1)), life: 80 };
    W.scene.add(obj); W.clickable(obj, 'bottle');
    G.ui.say(pick(Q.bottleSpawn));
  }
  function removeBottle() { if (!bottle) return; W.unclickable(bottle.obj); W.scene.remove(bottle.obj); bottle = null; }
  function collectBottle() {
    if (!bottle) return;
    W.splash(bottle.pos, 6); removeBottle(); A.sfx.pop();
    S.stats.bottles++;
    const msg = pick(D.bottleMessages);
    const r = Math.random(), si = spotIdx() + 1;
    let reward;
    if (r < 0.45) { const n = earn(rand(20, 150) * si * si); reward = `🪙 ${fmt(n)} pièces glissées dans la bouteille.`; }
    else if (r < 0.65) { const b = pick(['b1', 'b2', 'b3']); S.baits[b] = (S.baits[b] || 0) + 5; reward = `🪱 5 × ${byId(D.baits, b).name}.`; }
    else if (r < 0.8) { S.flags.treasure = true; reward = '🗺️ Une carte au trésor ! Ta prochaine touche « au hasard » sera rare ou mieux.'; }
    else if (r < 0.88 && !S.cos.owned.includes('hat_pirate')) { S.cos.owned.push('hat_pirate'); reward = '🏴‍☠️ Un Tricorne de Pirate Retraité ! (dans la garde-robe de Coco)'; }
    else reward = "…C'est tout. Juste un message. Le recyclage, c'est important.";
    G.ui.openPanel('bottle', null, { msg, reward });
    save(); G.ui.updateHUD();
  }
  function spawnMerchant() {
    if (merchant) return;
    const obj = G.models.kayak(); hitSphere(obj, 1.8);
    const owned = (it) => it.type === 'cos' && S.cos.owned.includes(it.id);
    const stock = D.merchantStock.filter((it) => !owned(it)).sort(() => Math.random() - 0.5).slice(0, 3).map((it) => Object.assign({}, it));
    merchant = { obj, x: W.rig.position.x - 30, z: W.rig.position.z - 11, t: 130, stock };
    obj.rotation.y = -Math.PI / 2;
    W.scene.add(obj); W.clickable(obj, 'merchant');
    A.sfx.horn();
    G.ui.say(pick(Q.merchantArrive), 'Narrateur', 4500);
    G.ui.updateHUD();
  }
  function removeMerchant(talk) {
    if (!merchant) return;
    W.unclickable(merchant.obj); W.scene.remove(merchant.obj); merchant = null;
    if (talk) G.ui.say(pick(Q.merchantLeave));
    if (G.ui.panel() === 'merchant') G.ui.closePanel();
    G.ui.updateHUD();
  }
  function updateEvents(dt) {
    const fishing = state === 'reeling' || state === 'bite';
    if (bottle) {
      bottle.obj.position.set(bottle.pos.x, W.waveH(bottle.pos.x, bottle.pos.z, T) + 0.05, bottle.pos.z);
      bottle.obj.rotation.y += dt * 0.4;
      bottle.pos.x += Math.sin(T * 0.2) * dt * 0.3;
      bottle.life -= dt; if (bottle.life <= 0) removeBottle();
    } else if ((bottleT -= dt) <= 0) { bottleT = rand(150, 300); spawnBottle(); }
    if ((schoolT -= dt) <= 0) { schoolT = rand(180, 340); if (!fishing) spawnSchool(); }
    if (merchant) {
      merchant.x += dt * 0.48; merchant.t -= dt;
      const o = merchant.obj;
      o.position.set(merchant.x, W.waveH(merchant.x, merchant.z, T) * 0.7 + 0.05, merchant.z);
      o.userData.paddle.rotation.x = Math.sin(T * 2) * 0.6;
      if (merchant.t <= 0) removeMerchant(true);
    } else if ((merchantT -= dt) <= 0) { merchantT = rand(240, 480); spawnMerchant(); }
    if (has('u_filet') && (netT -= dt) <= 0) {
      netT = 45;
      if (S.bucket.length < bucketCap() && Math.random() < 0.4) {
        const r = rollFish(pick(['s', 'm', 'f']), { commonOnly: true });
        const price = Math.max(1, Math.round(r.fish.v * r.w * mods().price));
        S.bucket.push({ id: r.fish.id, w: Math.round(r.w * 100) / 100, price });
        S.dex[r.fish.id] = S.dex[r.fish.id] || { n: 0, best: 0 }; S.dex[r.fish.id].n++; S.dex[r.fish.id].best = Math.max(S.dex[r.fish.id].best, r.w);
        S.stats.caught++;
        G.ui.toast(`${Q.net[0]} ${r.fish.name} (${fmtKg(r.w)})`, '🕸️');
        afterCatch(); G.ui.updateHUD();
      }
    }
    if (S.weather === 'orage' && (lightningT -= dt) <= 0) {
      lightningT = rand(7, 16);
      W.flash(); W.shake(0.06); setTimeout(() => A.sfx.thunder(), rand(150, 700));
      if (Math.random() < 0.2) G.ui.say(pick(Q.lightning));
    }
    if (state === 'idle' && !G.ui.isOpen() && (idleChat -= dt) <= 0) {
      idleChat = rand(25, 45);
      if (Math.random() < 0.4) G.ui.say(pick(D.roger.lines), 'Roger (pense-t-on)');
      else G.ui.say(pick(Q.idle));
    }
  }

  // ---------------------------------------------------------------- Jour / nuit / météo
  let wasNight = isNight();
  function setWeather(id, talk) {
    S.weather = id;
    W.setWeather(id);
    A.setRain(id === 'orage' ? 1 : id === 'pluie' ? 0.6 : 0);
    if (talk) G.ui.say(D.weathers[id].desc || pick(Q.weatherClear), 'Météo', 5000);
    G.ui.updateHUD();
  }
  // remplace quelques ombres (nouveaux poissons possibles avec la nuit ou la météo)
  function resetShadowsSoft() {
    shadows.filter((s) => s.state === 'roam').slice(0, 2).forEach((s) => {
      s.state = 'flee'; s.target = new THREE.Vector3(s.pos.x + 30, 0, s.pos.z);
      setTimeout(() => { if (s.state === 'flee' || s.state === 'roam') removeShadow(s); }, 4000);
    });
  }
  function updateTime(dt) {
    S.time = (S.time + dt / D.dayLength) % 1;
    const n = isNight();
    if (n !== wasNight) {
      wasNight = n;
      if (state === 'idle' || state === 'waiting') G.ui.say(pick(n ? Q.nightStart : Q.dayStart));
      resetShadowsSoft();
    }
    if ((S.weatherT -= dt) <= 0) {
      const nw = S.nextWeather && S.nextWeather !== S.weather && spot().weathers.includes(S.nextWeather) ? S.nextWeather : pick(spot().weathers.filter((w) => w !== S.weather));
      S.weatherT = ['pluie', 'orage'].includes(nw) ? rand(40, 80) : rand(130, 260);
      setWeather(nw, true);
      S.nextWeather = pick(spot().weathers.filter((w) => w !== nw));
      resetShadowsSoft();
    }
    A.setMood(spot().music, n);
  }

  // ---------------------------------------------------------------- Voyage psychédélique (manger un poisson LSD)
  const tripping = () => S.trip.t > 0;
  let fakeBang = null, fakeBangT = 8, tripSpeechT = 10, fakeShT = 3;
  const fakeSh = [];
  const fmtTime = (sec) => Math.floor(sec / 60) + ':' + String(Math.floor(sec % 60)).padStart(2, '0');
  function startTrip(fish) {
    const rank = D.rarities[fish.rarity].rank, was = tripping();
    S.trip.t = Math.min(600, S.trip.t + 130 + rank * 45);
    S.trip.lvl = Math.min(3, (was ? S.trip.lvl : 0) + 1);
    S.stats.eaten = (S.stats.eaten || 0) + 1;
    S.stats.tripMax = Math.max(S.stats.tripMax || 0, S.trip.lvl);
    A.sfx.trip();
    G.ui.say(pick(S.trip.lvl >= 3 ? Q.eatMax : was ? Q.eatMore : Q.eatStart), 'Narrateur', 5500);
    G.ui.toast(`<b>Voyage niveau ${S.trip.lvl}/3</b> · ${fmtTime(S.trip.t)}<br>Plus de poissons rares, et les poissons LSD adorent ça.`, '🌈', 6000);
    tripSpeechT = 7; fakeBangT = rand(6, 10);
  }
  function endTrip() {
    S.trip.t = 0; S.trip.lvl = 0;
    fakeSh.splice(0).forEach((f) => W.scene.remove(f.m));
    clearFake();
    G.ui.say(pick(Q.tripEnd), 'Narrateur', 6000);
    G.ui.updateHUD();
  }
  function clearFake(restore = true) {
    if (!fakeBang) return;
    fakeBang = null;
    if (state !== 'bite') el.bang.classList.add('hidden');
    if (restore) setState(state);
  }
  function startFakeBang() {
    fakeBang = { t: rand(0.9, 1.4) };
    el.bang.classList.remove('hidden');
    el.hint.textContent = HINTS.bite; el.hint.classList.add('alert');
    A.sfx.bite(); W.ripple(bobPos, 1.3);
  }
  function spawnFakeShadow() {
    const m = G.models.shadow();
    m.scale.setScalar(rand(0.9, 3.6)); m.userData.mat.opacity = 0;
    W.scene.add(m);
    fakeSh.push({ m, pos: randIn(area()), dir: rand(0, 6.28), sp: rand(0.4, 1.2), hue: Math.random(), rank: Math.floor(rand(0, 3)), t: 0, life: rand(6, 11) });
  }
  function updateTripFx(dt) {
    if (S.trip.t > 0 && (S.trip.t -= dt) <= 0) endTrip();
    const on = tripping();
    const lvl = on ? S.trip.lvl * clamp(S.trip.t / 8, 0, 1) : 0; // fondu à la descente
    W.setTrip(lvl); A.setTrip(lvl);
    if (on) {
      if ((fakeShT -= dt) <= 0) { fakeShT = rand(2, 4) / S.trip.lvl; if (fakeSh.length < 1 + S.trip.lvl * 2) spawnFakeShadow(); }
      if (fakeBang) {
        fakeBang.t -= dt;
        if (state !== 'waiting' || fakeBang.t <= 0) clearFake();
      } else if ((fakeBangT -= dt) <= 0) {
        fakeBangT = rand(10, 20) / S.trip.lvl;
        if (state === 'waiting' && waitT > 3) startFakeBang();
      }
      if ((tripSpeechT -= dt) <= 0) {
        tripSpeechT = rand(14, 24) / (0.6 + 0.2 * S.trip.lvl);
        if (!G.ui.isOpen() && state !== 'bite' && state !== 'reeling') G.ui.say(pick(Q.trip), pick(Q.tripSpeakers), 4500);
      }
    }
    for (let i = fakeSh.length - 1; i >= 0; i--) {
      const f = fakeSh[i];
      f.t += dt; f.dir += Math.sin(T * 0.7 + f.hue * 9) * dt * 0.8;
      f.pos.x += Math.cos(f.dir) * f.sp * dt; f.pos.z += Math.sin(f.dir) * f.sp * dt;
      f.m.position.set(f.pos.x, -0.4 - f.rank * 0.25, f.pos.z);
      f.m.rotation.y = -f.dir;
      f.m.userData.mat.color.setHSL((T * 0.4 + f.hue) % 1, 0.9, 0.62);
      f.m.userData.mat.opacity = 0.7 * Math.sin(Math.PI * Math.min(1, f.t / f.life));
      if (f.t >= f.life) { W.scene.remove(f.m); fakeSh.splice(i, 1); }
    }
  }

  // ---------------------------------------------------------------- Concours contre Brandon
  let contest = null;
  const CONTEST_REWARD = [150, 800, 3000, 12000, 50000];
  function startContest() {
    if (contest) return;
    if (S.contestCD > 0) { G.ui.say(`Brandon : « Je récupère. Reviens dans ${Math.ceil(S.contestCD)} secondes. Je suis une athlète. »`, 'Brandon'); return; }
    contest = { t: 120, me: 0, br: 0, nextB: rand(7, 12) };
    A.sfx.horn();
    G.ui.closePanel();
    G.ui.say(pick(Q.contestStart), 'Brandon');
    G.ui.updateContest(contest);
  }
  function updateContest(dt) {
    if (S.contestCD > 0) S.contestCD -= dt;
    if (!contest) return;
    contest.t -= dt;
    if ((contest.nextB -= dt) <= 0) {
      contest.nextB = rand(9, 16);
      const r = rollFish(pick(['s', 'm', 'f']));
      contest.br += r.w * rand(0.55, 1.0);
      W.splash(W.brandonRaft.position.clone().add(new THREE.Vector3(-0.5, 0, -2.5)), 10);
      if (Math.random() < 0.5) G.ui.say(pick(Q.contestBrandon) + ` (${r.fish.name}, ${fmtKg(r.w)})`, 'Brandon');
    }
    if (contest.t <= 0) {
      if (contest.me > contest.br) {
        const n = earn(CONTEST_REWARD[spotIdx()]);
        S.stats.contests++; addXp(60 + spotIdx() * 30, 'fish');
        A.sfx.legend();
        G.ui.say(pick(Q.contestWin) + ` +${fmt(n)} 🪙`, 'Concours', 6000);
        W.confetti(W.rig.position.clone().add(new THREE.Vector3(0, 2, -1)));
      } else {
        A.sfx.escape();
        G.ui.say(pick(Q.contestLose), 'Concours', 6000);
      }
      contest = null; S.contestCD = 180;
      save(); G.ui.updateHUD();
    }
    G.ui.updateContest(contest);
  }

  // ---------------------------------------------------------------- Commandes
  function genOrder() {
    if (S.cook.stove > 0 && S.cook.recipes.length && Math.random() < 0.4) return genDishOrder();
    const fishes = [];
    S.spots.forEach((id) => byId(D.spots, id).fish.forEach((a) => { const f = fishById[a[0]]; if (f.rarity !== 'legende' && !(f.zone && byId(D.zones, f.zone).tier > tierOwned())) fishes.push(f); }));
    const known = fishes.filter((f) => S.dex[f.id]);
    const f = pick(known.length && Math.random() < 0.8 ? known : fishes);
    const rank = D.rarities[f.rarity].rank;
    const qty = rank === 0 ? 2 + Math.floor(Math.random() * 2) : rank === 1 ? 1 + Math.floor(Math.random() * 2) : 1;
    const minW = Math.random() < 0.35 ? Math.round((f.w[0] + (f.w[1] - f.w[0]) * 0.45) * 100) / 100 : 0;
    const avgW = (f.w[0] + f.w[1]) / 2.4;
    const reward = Math.round(f.v * avgW * qty * 2.3 * (minW ? 1.5 : 1) * (f.night || f.weather ? 1.5 : 1) + 15);
    const [who, why] = pick(D.clients);
    return { id: Math.random().toString(36).slice(2, 8), fish: f.id, qty, minW, reward, who, why, t: Math.round(rand(300, 480)) };
  }
  function ensureOrders() { while (S.orders.length < 3) S.orders.push(genOrder()); S.orders.forEach((o) => { if (o.t === undefined) o.t = Math.round(rand(200, 420)); }); }
  function updateOrders(dt) {
    if (S.ordersCD > 0) S.ordersCD = Math.max(0, S.ordersCD - dt);
    let changed = false;
    for (let i = 0; i < S.orders.length; i++) {
      const o = S.orders[i];
      if ((o.t = (o.t === undefined ? 300 : o.t) - dt) <= 0) { S.orders[i] = genOrder(); changed = true; }
    }
    if (changed) { G.ui.toast(pick(Q.ordersExpire), '📋'); G.ui.refresh(); }
  }
  function orderMatches(o) {
    if (o.type === 'dish') return S.dishes.filter((d) => d.rid === o.rid && d.q >= o.minQ);
    return S.bucket.filter((it) => it.id === o.fish && it.w >= o.minW);
  }

  // ---------------------------------------------------------------- Prophétie & succès
  function questBase() { return Object.assign({}, S.stats); }
  function questProgress() {
    const step = D.quest[S.quest.step];
    if (!step) return null;
    if (!S.quest.base) S.quest.base = questBase();
    const [c, m] = step.prog(S, S.quest.base);
    return { step, cur: clamp(c, 0, m), max: m, done: c >= m };
  }
  function checkQuest() {
    const p = questProgress();
    if (p && p.done && !S.quest.ready) {
      S.quest.ready = true;
      A.sfx.quest();
      G.ui.toast('Objectif accompli : « ' + p.step.title + ' ». Va voir Tonton Gérard !', '📜');
      G.ui.updateTicker();
    }
  }
  function checkAchievements() {
    D.achievements.forEach((a) => {
      if (S.achievements[a.id]) return;
      if (a.check(S, D, G)) {
        S.achievements[a.id] = Date.now();
        earn(a.reward); addXp(30, 'fish');
        if (a.cos && !S.cos.owned.includes(a.cos)) S.cos.owned.push(a.cos);
        A.sfx.achievement();
        G.ui.toast(`<b>Succès : ${a.name}</b><br>${a.desc} · +${fmt(a.reward)} 🪙${a.cos ? ' · 🎁 ' + cosById(a.cos).name : ''}`, '🏆', 6000);
        G.ui.updateHUD();
      }
    });
  }

  // ---------------------------------------------------------------- RPG : niveaux, compétences, exigences
  const needXp = (i, tree) => (tree === 'cook' ? Math.round(30 * Math.pow(i, 1.6)) : Math.round(35 * Math.pow(i, 1.55)));
  const cumXp = (l, tree) => { let t = 0; for (let i = 1; i < l; i++) t += needXp(i, tree); return t; };
  const lvlOf = (xp, tree) => { const mx = D.maxLvl[tree]; let l = 1; while (l < mx && xp >= cumXp(l + 1, tree)) l++; return l; };
  const treeLvl = (tree) => (tree === 'cook' ? S.rpg.clvl : S.rpg.lvl);
  const spentPts = (tree) => D.skills.filter((k) => k.tree === tree).reduce((a, k) => a + (S.rpg.skills[k.id] || 0), 0);
  const skillPts = (tree) => treeLvl(tree) - 1 - spentPts(tree);
  const titleOf = (tree) => { const l = treeLvl(tree); let t = D.titles[tree][0][1]; D.titles[tree].forEach(([lv, n]) => { if (l >= lv) t = n; }); return t; };
  function lvlInfo(tree) {
    const key = tree === 'cook' ? 'cxp' : 'xp', l = treeLvl(tree), max = l >= D.maxLvl[tree];
    const cur = S.rpg[key] - cumXp(l, tree), need = max ? 1 : needXp(l, tree);
    return { lvl: l, max, xp: S.rpg[key], cur: max ? 1 : cur, need, pct: max ? 100 : clamp(cur / need * 100, 0, 100), title: titleOf(tree), pts: skillPts(tree) };
  }
  const fishXp = (fish, price) => Math.round((6 + D.rarities[fish.rarity].rank * 10 + Math.sqrt(price) * 1.3) * (fish.junk ? 0.5 : 1));
  function addXp(n, tree = 'fish') {
    n = Math.max(1, Math.round(n * (1 + perks().xp)));
    const key = tree === 'cook' ? 'cxp' : 'xp', lk = tree === 'cook' ? 'clvl' : 'lvl';
    S.rpg[key] += n;
    const nl = lvlOf(S.rpg[key], tree);
    while (S.rpg[lk] < nl) { S.rpg[lk]++; levelUp(tree); }
  }
  function levelUp(tree) {
    const cook = tree === 'cook', l = treeLvl(tree), bonus = l * 25;
    earn(bonus); A.sfx.levelup();
    G.ui.toast(`<b>${cook ? 'Cuisine' : 'Pêche'} niveau ${l} !</b><br>${titleOf(tree)} · +1 point de compétence · +${fmt(bonus)} 🪙`, cook ? '👨‍🍳' : '⭐', 6500);
    G.ui.say(pick(cook ? Q.cookLevelUp : Q.levelUp), 'Narrateur', 4500);
    if (!cook) W.confetti(W.rig.position.clone().add(new THREE.Vector3(0, 2.5, -1)));
    G.ui.updateHUD();
  }
  function reqLvl(item) {
    if (S.rpg.lvl >= (item.lvl || 1)) return true;
    G.ui.say(pick(Q.needLvl) + ` (niveau de pêche ${item.lvl} requis)`); A.sfx.escape(); return false;
  }
  function reqCLvl(item) {
    if (S.rpg.clvl >= (item.lvl || 1)) return true;
    G.ui.say(pick(Q.needLvl) + ` (niveau de cuisine ${item.lvl} requis)`); A.sfx.escape(); return false;
  }

  // ---------------------------------------------------------------- Cuisine
  const ck = () => S.cook;
  const stoveTier = () => (S.cook.stove > 0 ? D.stoves[S.cook.stove - 1] : null);
  const knifeTier = () => (S.cook.knife > 0 ? D.knives[S.cook.knife - 1] : { name: 'Aucun couteau (tes dents)', q: -0.6 });
  const hasTech = (id) => S.techs.includes(id);
  const techMissing = (r) => (r.tech || []).filter((t) => !hasTech(t));
  const recipeById = (id) => byId(D.recipes, id);
  const ingById = (id) => byId(D.ingredients, id);
  const knows = (rid) => S.cook.recipes.includes(rid);
  const dailyMenu = () => D.recipes[hash(todayKey() + 'menu') % D.recipes.length];
  const dailyDiscount = () => D.ingredients[hash(todayKey() + 'disc') % D.ingredients.length].id;
  const ingAvailable = (ing) => !ing.at || ing.at.includes(S.spot);
  function ingPrice(ing) {
    const f = 0.85 + (hash(todayKey() + ing.id) % 100) / 100 * 0.45;
    return Math.max(1, Math.round(ing.price * f * (dailyDiscount() === ing.id ? 0.65 : 1)));
  }
  function fishMatches(spec, f) {
    switch (spec.kind) {
      case 'any': return !f.junk;
      case 'rank': { const r = D.rarities[f.rarity].rank; return !f.junk && r >= spec.min && r <= spec.max; }
      case 'id': return f.id === spec.id;
      case 'junk': return !!f.junk;
      case 'lsd': return !!f.lsd;
    }
    return false;
  }
  const dishPrice = (d) => Math.round(d.value * sellMult() * (dailyMenu().id === d.rid ? 2 : 1));
  const stars = (q) => (q > 0 ? '★'.repeat(q) + '☆'.repeat(5 - q) : '💀');
  function finishCook(sl) {
    const r = recipeById(sl.rid), f = fishById[sl.fish.id], pk = perks(), kn = knifeTier();
    const mastery = S.cook.mastery[sl.rid] || 0;
    const score = 2.0 + kn.q + pk.quality + (S.rpg.clvl - 1) * 0.04 + Math.min(mastery, 30) * 0.025 + D.rarities[f.rarity].rank * 0.1 + (Math.random() * 2.2 - 1.1);
    const q = clamp(Math.round(score), 1, 5);
    const burned = q === 1 && Math.random() < 0.4 - pk.burn;
    S.cook.mastery[sl.rid] = mastery + 1;
    S.stats.cooked++;
    let dish;
    if (burned) {
      dish = { rid: sl.rid, q: 0, value: 1 };
      S.stats.burnt++;
      A.sfx.snap(); G.ui.toast(`${pick(Q.cookBurn)}`, '💨');
    } else {
      const val = Math.round((sl.fish.price * r.mult + r.base + r.ingCost * 0.6) * D.starMult[q] * (1 + pk.dish));
      dish = { rid: sl.rid, q, value: val };
      if (q === 5) S.stats.star5++;
      if (r.id === 'festin') S.stats.festin++;
      A.sfx.cookDone();
      G.ui.toast(`<b>${r.icon} ${r.name}</b> ${stars(q)}<br>Prêt ! Vaut ${fmt(val)} 🪙 · ${q === 5 ? pick(Q.cookStar) : pick(Q.cookDone)}`, '🍽️', 5500);
    }
    const n = !burned && Math.random() < pk.double ? 2 : 1;
    for (let k = 0; k < n; k++) S.dishes.push(Object.assign({}, dish));
    if (n === 2) G.ui.toast('Portion en plus ! Esprit de banquet.', '🍽️');
    addXp(burned ? 6 : 12 + Math.sqrt(dish.value) * 2.2 + q * 4, 'cook');
  }
  let cookT = 0;
  function updateCook(dt) {
    if ((cookT -= dt) > 0) return;
    cookT = 0.5;
    const now = Date.now(), slots = S.cook.slots;
    let changed = false;
    for (let i = slots.length - 1; i >= 0; i--) if (now >= slots[i].end) { finishCook(slots.splice(i, 1)[0]); changed = true; }
    W.setCooking(slots.length);
    if (changed) { G.ui.updateHUD(); G.ui.refresh(); save(); }
  }
  function addBuff(r, sc, q) {
    const b = r.buff;
    if (!b || b.k === 'trip') return;
    const dur = b.dur * (q >= 4 ? 1.3 : 1);
    const nb = { rid: r.id, name: r.name, icon: r.icon, k: b.k, v: b.v * sc, t: dur, max: dur };
    const ex = S.buffs.find((x) => x.rid === r.id);
    if (ex) Object.assign(ex, nb); else S.buffs.push(nb);
    while (S.buffs.length > 5) S.buffs.shift();
  }
  function updateBuffs(dt) {
    for (let i = S.buffs.length - 1; i >= 0; i--) {
      S.buffs[i].t -= dt;
      if (S.buffs[i].t <= 0) { G.ui.toast(`L'effet de « ${S.buffs[i].name} » s'estompe.`, '🍽️'); S.buffs.splice(i, 1); G.ui.updateHUD(); }
    }
  }
  function latestSpotAvg() {
    const idx = Math.max(...S.spots.map((id) => D.spots.findIndex((x) => x.id === id)));
    const arr = D.spots[idx].fish.map((a) => fishById[a[0]]).filter((f) => !f.junk && !f.zone && f.rarity !== 'legende');
    return arr.reduce((a, f) => a + f.v * (f.w[0] + f.w[1]) / 2, 0) / arr.length;
  }
  function genDishOrder() {
    const r = pick(S.cook.recipes.map(recipeById));
    const minQ = clamp(Math.floor(rand(1, 1 + S.rpg.clvl / 4)), 1, 4);
    const qty = Math.random() < 0.3 ? 2 : 1;
    const unit = r.mult * latestSpotAvg() * 0.35 + r.base + r.ingCost * 0.6;
    const reward = Math.round(unit * D.starMult[Math.max(3, minQ)] * 1.6 * qty + 20);
    const [who, why] = pick(D.clients);
    return { type: 'dish', id: Math.random().toString(36).slice(2, 8), rid: r.id, minQ, qty, reward, who, why, t: Math.round(rand(300, 480)) };
  }
  function deliverDish(i, o) {
    const m = orderMatches(o).sort((a, b) => a.q - b.q).slice(0, o.qty);
    if (m.length < o.qty) return;
    m.forEach((d) => S.dishes.splice(S.dishes.indexOf(d), 1));
    earn(o.reward); S.stats.orders++; S.stats.dishOrders++; A.sfx.coin();
    addXp(20 + Math.sqrt(o.reward), 'cook'); addXp(10, 'fish');
    G.ui.say(`${o.who} se régale. Il·elle en reprendrait. +${fmt(o.reward)} 🪙`, 'Commandes');
    S.orders.splice(i, 1, genOrder());
  }

  // ---------------------------------------------------------------- Potager
  const farmNeed = (i) => Math.round(25 * Math.pow(i, 1.5));
  const farmCum = (l) => { let t = 0; for (let i = 1; i < l; i++) t += farmNeed(i); return t; };
  function farmInfo() {
    const f = S.farm, l = f.lvl, max = l >= D.farm.levelCap, cur = f.xp - farmCum(l), need = max ? 1 : farmNeed(l);
    return { lvl: l, max, cur: max ? 1 : cur, need, pct: max ? 100 : clamp(cur / need * 100, 0, 100) };
  }
  function addFarmXp(n) {
    const f = S.farm; f.xp += Math.round(n);
    while (f.lvl < D.farm.levelCap && f.xp >= farmCum(f.lvl + 1)) {
      f.lvl++; A.sfx.levelup();
      G.ui.toast(`<b>Potager niveau ${f.lvl} !</b><br>Nouvelles cultures et parcelles à débloquer chez Tata Capucine.`, '🌱', 6000);
    }
  }
  const reqFLvl = (it) => { if (S.farm.lvl >= (it.lvl || 1)) return true; G.ui.say(pick(Q.needLvl) + ` (niveau de potager ${it.lvl} requis)`); A.sfx.escape(); return false; };
  function tickFarm(dt, offline) {
    const f = S.farm, raining = !offline && (S.weather === 'pluie' || S.weather === 'orage');
    f.plots.forEach((p) => {
      if (!p || p.ready) return;
      const c = byId(D.crops, p.crop); if (!c) return;
      const wetT = raining ? dt : Math.min(dt, p.water);
      if (p.water > 0) p.water = Math.max(0, p.water - dt);
      if (wetT <= 0) return;
      let sp = (f.tools.serre ? 1.35 : 1) * (p.fert ? 1.5 : 1);
      if (c.wet && raining) sp *= 1.5;
      if (c.night) sp *= isNight() ? 2 : 0.6;
      p.growth += wetT * sp;
      if (p.growth >= c.time) { p.ready = true; p.growth = c.time; if (!offline) { A.sfx.cookDone(); G.ui.toast(`${c.icon} ${c.name} : ${pick(Q.farmReady)}`, '🌱'); } }
    });
  }
  let farmSyncT = 0, farmRaidT = 60;
  function syncFarm() {
    const f = S.farm, raining = S.weather === 'pluie' || S.weather === 'orage';
    W.setFarm(f.plots.map((p, i) => {
      const owned = i < f.owned; if (!p) return { owned };
      const c = byId(D.crops, p.crop);
      return { owned, crop: p.crop, frac: p.growth / c.time, ready: p.ready, wet: p.water > 0 || raining };
    }), f.tools);
  }
  function updateFarm(dt) {
    tickFarm(dt, false);
    if ((farmRaidT -= dt) <= 0) {
      farmRaidT = 75;
      const ready = S.farm.plots.map((p, i) => (p && p.ready ? i : -1)).filter((i) => i >= 0);
      if (ready.length && !S.farm.tools.epouvantail && Math.random() < 0.25) {
        const i = pick(ready); S.farm.plots[i] = null; A.sfx.gull(); G.ui.toast(pick(Q.gullCrop), '🐦'); G.ui.refresh();
      }
    }
    if ((farmSyncT -= dt) <= 0) { farmSyncT = 1; syncFarm(); }
  }

  // ---------------------------------------------------------------- Menu : sauvegardes
  const SLOT = (n) => 'pechePerchee_slot' + n;
  function slotsInfo() {
    return [1, 2, 3].map((n) => { try { const raw = localStorage.getItem(SLOT(n)); return { n, meta: raw ? JSON.parse(raw).meta : null }; } catch (e) { return { n, meta: null }; } });
  }
  function importText(text) {
    let o; try { o = JSON.parse(text); } catch (e) { G.ui.say("Ce fichier n'est pas une sauvegarde valide. (Il n'est même pas du JSON.)"); return false; }
    const data = o && o.data ? o.data : o;
    if (!data || typeof data.money !== 'number' || !data.rpg && !data.stats) { G.ui.say("Ce fichier n'a pas l'air d'être une partie de Pêche Perchée."); return false; }
    resetting = true; try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* rien */ }
    location.reload(); return true;
  }

  // ---------------------------------------------------------------- Actions (appelées par l'UI)
  function refreshGear() { W.setRodColor(rod().color); W.applyCosmetics(S.cos, D); }
  function addRogerXP(n) {
    S.roger.xp += n;
    const L = D.roger.levels;
    while (S.roger.lvl < L.length - 1 && S.roger.xp >= L[S.roger.lvl + 1]) {
      S.roger.lvl++;
      W.setRogerLevel(S.roger.lvl);
      A.sfx.achievement();
      G.ui.toast(`<b>Roger passe niveau ${S.roger.lvl + 1} !</b><br>${D.roger.perks[S.roger.lvl]}`, '🪨', 6000);
    }
  }
  const act = {
    buyRod(id) { const r = byId(D.rods, id); if (!reqLvl(r)) return; if (spend(r.cost)) { S.rods.push(id); S.rod = id; refreshGear(); G.ui.say(pick(Q.buy), 'Jean-Michmich'); } },
    equipRod(id) { S.rod = id; refreshGear(); },
    buyReel(id) { const r = byId(D.reels, id); if (!reqLvl(r)) return; if (spend(r.cost)) { S.reels.push(id); S.reel = id; G.ui.say(pick(Q.buy), 'Jean-Michmich'); } },
    equipReel(id) { S.reel = id; },
    buyLine(id) { const r = byId(D.lines, id); if (!reqLvl(r)) return; if (spend(r.cost)) { S.lines.push(id); S.line = id; G.ui.say(pick(Q.buy) + ' Change de profondeur en bas à gauche.', 'Jean-Michmich'); } },
    equipLine(id) { S.line = id; if (D.depths[S.depth].rank > D.depths[line().depth].rank) S.depth = line().depth; },
    buyBait(id) { const b = byId(D.baits, id); if (!reqLvl(b)) return; if (spend(b.cost)) { S.baits[id] = (S.baits[id] || 0) + D.baitPack; if (state === 'idle') S.bait = id; } },
    equipBait(id) { if (state !== 'idle') return G.ui.say("On ne change pas d'appât en pleine action. C'est le règlement."); S.bait = id; },
    buyBucket(i) { i = +i; if (!reqLvl(D.buckets[i])) return; if (spend(D.buckets[i].cost)) { S.bucketLvl = i; G.ui.say(pick(Q.buy), 'Jean-Michmich'); } },
    buyUpgrade(id) {
      const u = byId(D.upgrades, id);
      if (!reqLvl(u) || !spend(u.cost)) return;
      S.upgrades.push(id); G.ui.say(pick(Q.buy), 'Jean-Michmich');
      if (id === 'u_sonar') shadows.forEach((s) => s.mesh.userData.mat.color.set(D.rarities[s.fish.rarity].color));
    },
    sell(i) {
      const it = S.bucket.splice(+i, 1)[0];
      if (!it) return;
      if (it.id === 'lettre') S.stats.soldLetter++;
      earn(it.price * sellMult()); S.stats.sells++; A.sfx.coin();
      if (Math.random() < 0.35) G.ui.say(pick(Q.sell), 'La Josiane');
    },
    sellAll() {
      if (!S.bucket.length) return;
      const total = S.bucket.reduce((a, c) => a + c.price, 0) * sellMult();
      S.bucket.forEach((it) => { if (it.id === 'lettre') S.stats.soldLetter++; });
      S.bucket = []; earn(total); S.stats.sells++; A.sfx.coin();
      G.ui.say(`+${fmt(total)} pièces. ` + pick(Q.sell), 'La Josiane');
    },
    feedRoger(i) {
      const it = S.bucket.splice(+i, 1)[0];
      if (!it) return;
      S.stats.rogerFed++;
      addRogerXP(it.price);
      A.sfx.pop();
      G.ui.say(pick(D.roger.feed), 'Roger');
    },
    keepFish(i) {
      if (S.aquarium.length >= aquaCap()) return G.ui.say("L'aquarium est plein. Les poissons commencent à parler de syndicat.");
      const it = S.bucket.splice(+i, 1)[0];
      if (!it) return;
      S.aquarium.push(it); W.refreshAquarium(S.aquarium); A.sfx.plop();
      G.ui.say(`${fishById[it.id].name} emménage dans l'aquarium. Il trouve la déco « correcte ».`);
    },
    aquaSell(j) { const it = S.aquarium.splice(+j, 1)[0]; if (!it) return; earn(it.price * sellMult()); S.stats.sells++; A.sfx.coin(); W.refreshAquarium(S.aquarium); },
    aquaRelease(j) { const it = S.aquarium.splice(+j, 1)[0]; if (!it) return; W.refreshAquarium(S.aquarium); A.sfx.plop(); G.ui.say(`${fishById[it.id].name} retourne à l'eau. Il ne t'écrira pas.`); },
    buySpot(id) { const sp = byId(D.spots, id); if (!reqLvl(sp)) return; if (spend(sp.cost)) { S.spots.push(id); G.ui.say(`${sp.name} débloqué ! ` + pick(Q.buy)); } },
    travel(id) {
      if (!['idle', 'caught'].includes(state)) return G.ui.say('Finis ta pêche avant de partir. Le poisson attend une réponse.');
      if (contest) return G.ui.say("« Tu fuis le concours ? Typique. » (Termine d'abord le concours.)", 'Brandon');
      if (state === 'caught') closeCatch();
      S.spot = id; W.applySpot(spot()); removeBottle();
      S.weatherT = rand(120, 240); setWeather(pick(spot().weathers.filter((w) => w !== 'orage')), false);
      S.nextWeather = pick(spot().weathers.filter((w) => w !== S.weather));
      resetShadows(); ensureOrders();
      G.ui.closePanel(); A.sfx.whoosh();
      G.ui.say(spot().desc, spot().name, 5500);
      setTimeout(() => G.ui.say(pick(Q.travel)), 5800);
    },
    buyCos(id) { const c = cosById(id); if (spend(c.cost)) { S.cos.owned.push(id); act.equipCos(id); G.ui.say(pick(D.npcs.coco.lines), 'Coco'); } },
    equipCos(id) {
      const c = cosById(id);
      if (c.slot === 'deco') { const i = S.cos.deco.indexOf(id); if (i >= 0) S.cos.deco.splice(i, 1); else S.cos.deco.push(id); }
      else S.cos[c.slot] = id;
      W.applyCosmetics(S.cos, D);
    },
    claimQuest() {
      const p = questProgress();
      if (!p || !p.done) return;
      earn(p.step.reward); addXp(40 + S.quest.step * 12, 'fish');
      if (p.step.cos && !S.cos.owned.includes(p.step.cos)) { S.cos.owned.push(p.step.cos); S.cos.hat = p.step.cos; W.applyCosmetics(S.cos, D); }
      S.quest.step++; S.quest.base = questBase(); S.quest.ready = false;
      A.sfx.quest(); W.confetti(W.gerardWrap.position.clone().add(new THREE.Vector3(0, 1, 0)));
      G.ui.toast(`Prophétie : « ${p.step.title} » accomplie ! +${fmt(p.step.reward)} 🪙`, '📜');
      checkQuest();
    },
    deliver(i) {
      const o = S.orders[+i]; if (!o) return;
      if (o.type === 'dish') return deliverDish(+i, o);
      const m = orderMatches(o).sort((a, b) => a.price - b.price).slice(0, o.qty);
      if (m.length < o.qty) return;
      m.forEach((it) => S.bucket.splice(S.bucket.indexOf(it), 1));
      earn(o.reward); S.stats.orders++; A.sfx.coin();
      G.ui.say(`${o.who} est ravi·e. Enfin, satisfait·e. +${fmt(o.reward)} 🪙`, 'Commandes');
      S.orders.splice(+i, 1, genOrder());
    },
    refuseOrder(i) { S.orders.splice(+i, 1, genOrder()); G.ui.say("Le client part en claquant la porte. Il n'y avait pas de porte. Il a claqué l'air."); },
    startContest,
    buyMerchant(i) {
      if (!merchant) return;
      const it = merchant.stock[+i]; if (!it || !spend(it.cost)) return;
      merchant.stock.splice(+i, 1);
      S.stats.merchantBuys++;
      let msg = '';
      if (it.type === 'bait') { S.baits[it.id] = (S.baits[it.id] || 0) + it.qty; msg = 'Appât Maudit acquis. Les poissons vont devenir fous. Ta ligne aussi.'; }
      else if (it.type === 'cos') { S.cos.owned.push(it.id); msg = `${cosById(it.id).name} acquis. Ne dis à personne d'où il vient.`; }
      else if (it.type === 'treasure') { S.flags.treasure = true; msg = 'La carte indique « ICI ». Partout. Ta prochaine touche au hasard sera rare.'; }
      else if (it.type === 'box') {
        const r = Math.random();
        const pool = D.cosmetics.filter((c) => c.cost && !S.cos.owned.includes(c.id));
        if (r < 0.35 && pool.length) { const c = pick(pool); S.cos.owned.push(c.id); msg = `La boîte contenait : ${c.name} !`; }
        else if (r < 0.75) { const n = earn(it.cost * rand(0.3, 2.6)); msg = `La boîte contenait ${fmt(n)} pièces. ${n > it.cost ? 'Bénéfice !' : 'Arnaque !'}`; }
        else if (r < 0.9) { S.baits.b3 = (S.baits.b3 || 0) + 5; msg = "La boîte contenait 5 Fromages Qui Puent. Ça explique l'odeur."; }
        else { if (S.bucket.length < bucketCap()) S.bucket.push({ id: 'chaussette', w: 0.2, price: 4 }); msg = 'La boîte contenait… une chaussette. Juste une chaussette. Elle est dans ton seau.'; }
      }
      G.ui.say(msg, 'Le Marchand Louche', 5000);
    },
    refreshOrders() {
      if (S.ordersCD > 0) return G.ui.say(pick(Q.ordersWait) + ` (${Math.ceil(S.ordersCD)} s)`);
      S.orders.length = 0; ensureOrders(); S.ordersCD = 40;
      A.sfx.pop(); G.ui.toast(pick(Q.ordersNew), '📋');
    },
    saveSlot(n) {
      S.stats.manualSaves++; save();
      const meta = { t: Date.now(), lvl: S.rpg.lvl, clvl: S.rpg.clvl, money: S.money, spot: spot().name, caught: S.stats.caught };
      try { localStorage.setItem(SLOT(n), JSON.stringify({ meta, data: S })); G.ui.toast(pick(Q.saved) + ` (emplacement ${n})`, '💾'); A.sfx.achievement(); }
      catch (e) { G.ui.say("Impossible de sauvegarder (stockage plein ou bloqué)."); }
    },
    loadSlot(n) {
      let o; try { o = JSON.parse(localStorage.getItem(SLOT(n))); } catch (e) { o = null; }
      if (!o || !o.data) return G.ui.say('Cet emplacement est vide.');
      G.ui.confirm(`Charger l'emplacement ${n} ? La partie en cours sera remplacée (pense à sauvegarder avant).`, 'Charger', () => {
        resetting = true; try { localStorage.setItem(SAVE_KEY, JSON.stringify(o.data)); } catch (e) { /* rien */ }
        location.reload();
      });
    },
    deleteSlot(n) { G.ui.confirm(`Effacer l'emplacement ${n} ?`, 'Effacer', () => { localStorage.removeItem(SLOT(n)); G.ui.refresh(); }); },
    quickSave() { save(); G.ui.toast(pick(Q.saved), '💾'); A.sfx.click(); },
    exportSave() {
      save();
      const blob = new Blob([JSON.stringify({ game: 'peche-perchee', ver: 4, data: S })], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'peche-perchee-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    },
    buyUtensil(id) {
      const u = byId(D.utensils, id); if (!u || S.utensils.includes(id) || !reqCLvl(u)) return;
      if (spend(u.cost)) { S.utensils.push(id); W.refreshKitchen(S.cook, S.utensils); G.ui.say(`${u.name} acheté(e). Ça sent le travail bien fait. Ou le travail à faire.`, 'Marguerite'); }
    },
    learnTech(id) {
      const t = byId(D.techs, id); if (!t || hasTech(id) || !reqCLvl(t)) return;
      const n = t.needs || {}, miss = [];
      (n.utensil || []).forEach((u) => { if (!S.utensils.includes(u)) miss.push(byId(D.utensils, u).name); });
      if (n.knife && S.cook.knife < n.knife) miss.push(D.knives[n.knife - 1].name);
      if (n.stove && S.cook.stove < n.stove) miss.push(D.stoves[n.stove - 1].name);
      if (miss.length) return G.ui.say(pick(Q.techNeeds) + ' Il te faut : ' + miss.join(', ') + '.', 'Chef Gaston');
      if (spend(t.cost)) { S.techs.push(id); A.sfx.quest(); addXp(14, 'cook'); G.ui.say(pick(Q.techLearn), 'Chef Gaston'); }
    },
    buyPlot() {
      const pl = D.farm.plots[S.farm.owned]; if (!pl || !reqFLvl(pl)) return;
      if (spend(pl.cost)) { S.farm.owned++; A.sfx.pop(); G.ui.say(pick(Q.farm), 'Tata Capucine'); }
    },
    buyCan() {
      const c = D.farm.cans[S.farm.can]; if (!c || !reqFLvl(c)) return;
      if (spend(c.cost)) { S.farm.can++; G.ui.say(`${c.name} ! Ça mouille, ça pousse, ça réjouit.`, 'Tata Capucine'); }
    },
    buyFarmTool(id) {
      const t = byId(D.farm.tools, id); if (!t || S.farm.tools[id] || !reqFLvl(t)) return;
      if (spend(t.cost)) { S.farm.tools[id] = true; G.ui.say(`${t.name} installé(e).`, 'Tata Capucine'); }
    },
    plant(arg) {
      const [i, cid] = String(arg).split(':'), f = S.farm, c = byId(D.crops, cid);
      if (!c || +i >= f.owned || f.plots[+i] || !reqFLvl(c)) return;
      if (spend(c.seed)) { f.plots[+i] = { crop: cid, growth: 0, water: 0, fert: false, ready: false }; A.sfx.pop(); }
    },
    plantAll(cid) {
      const c = byId(D.crops, cid), f = S.farm; if (!c || !reqFLvl(c)) return;
      let n = 0;
      for (let i = 0; i < f.owned; i++) if (!f.plots[i]) { if (!spend(c.seed)) break; f.plots[i] = { crop: cid, growth: 0, water: 0, fert: false, ready: false }; n++; }
      if (n) A.sfx.pop(); else if (!f.plots.slice(0, f.owned).some((p) => !p)) G.ui.say('Toutes tes parcelles sont occupées.');
    },
    water(i) {
      const f = S.farm, p = f.plots[+i];
      if (!f.can) return G.ui.say("Il te faut un arrosoir (boutique de Tata Capucine) ! Ou de la pluie.");
      if (p && !p.ready) { p.water = D.farm.cans[f.can - 1].dur; A.sfx.plop(); }
    },
    waterAll() {
      const f = S.farm;
      if (!f.can) return G.ui.say("Il te faut un arrosoir (boutique de Tata Capucine) ! Ou de la pluie.");
      const dur = D.farm.cans[f.can - 1].dur; let n = 0;
      f.plots.forEach((p) => { if (p && !p.ready) { p.water = dur; n++; } });
      if (n) A.sfx.plop();
    },
    fertilize(arg) {
      const [i, bi] = String(arg).split(':'), p = S.farm.plots[+i], it = S.bucket[+bi];
      if (!p || p.ready || p.fert || !it) return;
      S.bucket.splice(+bi, 1); p.fert = true; A.sfx.pop(); G.ui.say(`${fishById[it.id].name} devient engrais. Il aurait préféré une autre carrière.`, 'Tata Capucine');
    },
    harvest(i) {
      const f = S.farm, p = f.plots[+i]; if (!p || !p.ready) return;
      const c = byId(D.crops, p.crop);
      let n = c.yield[0] + Math.floor(Math.random() * (c.yield[1] - c.yield[0] + 1)) + (p.fert ? 1 : 0) + (Math.random() < f.lvl * 0.03 ? 1 : 0);
      S.pantry[c.ing] = (S.pantry[c.ing] || 0) + n; S.stats.harvest++;
      f.plots[+i] = null; addFarmXp(6 + c.time / 18); A.sfx.pop();
      G.ui.toast(`${c.icon} +${n} ${byId(D.ingredients, c.ing).name}`, '🌱');
    },
    harvestAll() { S.farm.plots.forEach((p, i) => { if (p && p.ready) act.harvest(i); }); },
    buyHook(id) { const h = byId(D.hooks, id); if (!reqLvl(h)) return; if (spend(h.cost)) { S.hooks.push(id); S.hook = id; G.ui.say(pick(Q.buy), 'Jean-Michmich'); } },
    equipHook(id) { S.hook = id; },
    buyNet(id) { const n = byId(D.nets, id); if (!reqLvl(n)) return; if (spend(n.cost)) { S.nets.push(id); S.net = id; G.ui.say(pick(Q.buy), 'Jean-Michmich'); } },
    equipNet(id) { S.net = id; },
    buyAcc(id) { const a = byId(D.accessories, id); if (!reqLvl(a)) return; if (spend(a.cost)) { S.acc.push(id); G.ui.say(pick(Q.buy), 'Jean-Michmich'); } },
    buySkill(id) {
      const sk = byId(D.skills, id), tree = sk.tree;
      if (treeLvl(tree) < sk.lvl) return G.ui.say(pick(Q.needLvl) + ` (niveau ${sk.lvl} requis)`);
      if ((S.rpg.skills[id] || 0) >= sk.max) return;
      if (skillPts(tree) <= 0) return G.ui.say('Plus de point de compétence. Monte de niveau (en pêchant ou en cuisinant).');
      S.rpg.skills[id] = (S.rpg.skills[id] || 0) + 1; A.sfx.achievement(); G.ui.say(pick(Q.skillUp));
    },
    respec(tree) {
      if (!spentPts(tree)) return G.ui.say('Rien à oublier. Ton cerveau est déjà vide.');
      if (!spend(150 * treeLvl(tree))) return;
      D.skills.filter((k) => k.tree === tree).forEach((k) => delete S.rpg.skills[k.id]);
      G.ui.say('Compétences oubliées. Tu as tout à réapprendre, comme au premier jour.');
    },
    buyIng(arg) {
      const [id, q] = String(arg).split(':'); const qty = +q || 1, ing = ingById(id);
      if (!ing || !ingAvailable(ing)) return;
      if (spend(ingPrice(ing) * qty)) { S.pantry[id] = (S.pantry[id] || 0) + qty; A.sfx.pop(); if (Math.random() < 0.25) G.ui.say(pick(D.npcs.marguerite.lines), 'Marguerite'); }
    },
    buyStove() {
      const t = D.stoves[S.cook.stove]; if (!t || !reqCLvl(t)) return;
      if (spend(t.cost)) { S.cook.stove++; W.refreshKitchen(S.cook, S.utensils); G.ui.say(`${t.name} installé sur la cuisine flottante !`, 'Marguerite'); }
    },
    buyKnife() {
      const t = D.knives[S.cook.knife]; if (!t || !reqCLvl(t)) return;
      if (spend(t.cost)) { S.cook.knife++; W.refreshKitchen(S.cook, S.utensils); G.ui.say(`${t.name} acquis. Il brille d'un éclat inquiétant.`, 'Marguerite'); }
    },
    buyApp(id) {
      const a = byId(D.appliances, id); if (!a || S.cook.apps.includes(id) || !reqCLvl(a)) return;
      if (spend(a.cost)) { S.cook.apps.push(id); W.refreshKitchen(S.cook, S.utensils); G.ui.say(`${a.name} installé(e). Les recettes « ${D.methodNames[id]} » sont ouvertes.`, 'Marguerite'); }
    },
    learnRecipe(rid) {
      const r = recipeById(rid); if (!r || knows(rid) || !reqCLvl(r)) return;
      if (spend(r.cost)) { S.cook.recipes.push(rid); A.sfx.quest(); G.ui.say(pick(Q.learn), 'Chef Gaston'); }
    },
    startCook(arg) {
      const [rid, idx] = String(arg).split(':'), r = recipeById(rid), it = S.bucket[+idx];
      if (!r || !it || !knows(rid)) return;
      const st = stoveTier(); if (!st) return G.ui.say(pick(Q.needStove), 'Chef Gaston');
      if (techMissing(r).length) return G.ui.say(pick(Q.needTech) + ' Manque : ' + techMissing(r).map((t) => byId(D.techs, t).name).join(', ') + '.', 'Chef Gaston');
      if (!S.cook.apps.includes(r.method)) return G.ui.say(pick(Q.needAppliance), 'Chef Gaston');
      if (S.cook.slots.length >= st.slots) return G.ui.say(pick(Q.noSlot));
      const f = fishById[it.id]; if (!fishMatches(r.fish, f)) return G.ui.say(pick(Q.needFish));
      for (const [id, n] of Object.entries(r.ing)) if ((S.pantry[id] || 0) < n) return G.ui.say(pick(Q.needIng), 'Chef Gaston');
      const pk = perks();
      Object.entries(r.ing).forEach(([id, n]) => { if (Math.random() >= pk.save) S.pantry[id] -= n; });
      S.bucket.splice(+idx, 1);
      const dur = r.time * Math.max(0.35, 1 - pk.speed) / st.speed;
      S.cook.slots.push({ rid, fish: { id: it.id, w: it.w, price: it.price }, start: Date.now(), end: Date.now() + dur * 1000 });
      A.sfx.sizzle(); W.setCooking(S.cook.slots.length); G.ui.say(pick(Q.cookStart), 'Cuisine');
    },
    sellDish(i) {
      const d = S.dishes[+i]; if (!d) return;
      S.dishes.splice(+i, 1); earn(dishPrice(d)); S.stats.dishSold++; S.stats.sells++; A.sfx.coin();
      if (Math.random() < 0.4) G.ui.say(pick(Q.dishSell), 'La Josiane');
    },
    sellAllDishes() {
      if (!S.dishes.length) return;
      const total = S.dishes.reduce((a, d) => a + dishPrice(d), 0);
      S.stats.dishSold += S.dishes.length; S.dishes = []; earn(total); S.stats.sells++; A.sfx.coin();
      G.ui.say(`+${fmt(total)} pièces. ` + pick(Q.dishSell), 'La Josiane');
    },
    eatDish(i) {
      const d = S.dishes[+i]; if (!d) return;
      const r = recipeById(d.rid);
      S.dishes.splice(+i, 1);
      if (d.q === 0) return G.ui.say('Tu manges du charbon. Il est… croquant. Aucun effet, à part une dent en moins.');
      const sc = [0, 0.6, 0.8, 1, 1.25, 1.6][d.q];
      if (r.buff.k === 'trip') startTrip({ rarity: 'rare' }); else addBuff(r, sc, d.q);
      A.sfx.pop(); G.ui.say(pick(Q.eatDish));
    },
    eatFish(i) {
      const it = S.bucket[+i]; if (!it) return;
      const f = fishById[it.id];
      if (!f.lsd) { G.ui.say(pick(Q.eatNo)); return; }
      S.bucket.splice(+i, 1); startTrip(f);
    },
    eatCatch() {
      if (state !== 'caught' || !lastCatch || !lastCatch.fish.lsd || gull) return;
      const i = S.bucket.indexOf(lastCatch.item);
      if (i < 0) return;
      S.bucket.splice(i, 1); startTrip(lastCatch.fish); closeCatch();
    },
    toggleSoftTrip() { S.opts.softTrip = !S.opts.softTrip; W.setTripMotion(S.opts.softTrip ? 0.3 : 1); },
    toggleMusic() { S.opts.music = !S.opts.music; A.setMusic(S.opts.music); },
    toggleSfx() { S.opts.sfx = !S.opts.sfx; A.setSfx(S.opts.sfx); },
    buyBoat(id) {
      const b = byId(D.boats, id); if (!b || S.boats.includes(id) || !reqLvl(b)) return;
      if (spend(b.cost)) { S.boats.push(id); A.sfx.quest(); G.ui.say(pick(Q.boatBuy) + ' (' + b.name + ')'); }
    },
    setZone(zid) {
      const z = byId(D.zones, zid); if (!z || z.id === S.zone) return;
      if (state !== 'idle') return G.ui.say('Termine ta pêche avant de changer de zone. Le poisson ne bouge pas, lui.');
      if (contest) return G.ui.say("Termine d'abord le concours : Brandon est un sale gagnant.", 'Brandon');
      if (z.tier > tierOwned()) return G.ui.say(pick(Q.needBoat));
      S.zone = zid; S.boat = z.tier > 0;
      W.setZone(z, tierOwned()); resetShadows(); hangBobber(); removeBottle();
      A.sfx.whoosh(); G.ui.closePanel();
      G.ui.say(z.tier > 0 ? pick(Q.zoneGo) + ' ' + z.desc : pick(Q.zoneBack), z.name, 5000);
    },
    cycleDepth() {
      if (state !== 'idle' && state !== 'caught') return G.ui.say('On change de profondeur avant de lancer. Pas pendant. Logique.');
      const max = D.depths[line().depth].rank;
      const order = ['s', 'm', 'f'].filter((d) => D.depths[d].rank <= max);
      if (order.length === 1) return G.ui.say('Ton fil dentaire ne descend pas plus bas. Achète un meilleur fil chez Jean-Michmich.');
      S.depth = order[(order.indexOf(S.depth) + 1) % order.length];
    },
    cycleBait() {
      if (state !== 'idle') return G.ui.say("On ne change pas d'appât en pleine action. C'est le règlement.");
      const owned = D.baits.filter((b) => b.cost === 0 || S.baits[b.id] > 0);
      if (owned.length === 1) return G.ui.say("Tu n'as que de la mie de pain. Roger ricane (intérieurement).");
      S.bait = owned[(owned.findIndex((b) => b.id === S.bait) + 1) % owned.length].id;
    },
    newGame() { act.reset(); },
    reset() {
      G.ui.confirm('Tout effacer ? Les poissons oublieront ton nom. Roger, jamais. (Tes emplacements de sauvegarde sont conservés.)', 'Nouvelle partie', () => {
        resetting = true;
        try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem('pechePerchee_v1'); } catch (e) { /* rien */ }
        location.reload();
      });
    },
  };
  // chaque action sauvegarde et rafraîchit l'UI
  Object.keys(act).forEach((k) => { const f = act[k]; act[k] = (...a) => { const r = f(...a); if (resetting) return r; save(); G.ui.updateHUD(); G.ui.refresh(); checkQuest(); return r; }; });

  // ---------------------------------------------------------------- Entrées
  function press() {
    A.ensure();
    if (G.ui.isOpen()) return;
    if (gull && gull.phase === 'dive') { chaseGull(); return; }
    switch (state) {
      case 'idle': startCharge(); break;
      case 'waiting':
        if (fakeBang) { clearFake(); G.ui.say(pick(Q.fakeBang)); A.sfx.pop(); break; }
        G.ui.say('Tu remontes la ligne. Le poisson imaginaire est déçu.'); releaseApproacher(false); W.setHeroMode('idle'); startReelBack(); break;
      case 'bite': hook(); break;
      case 'reeling': holding = true; break;
      case 'caught': closeCatch(); break;
    }
  }
  function release() { if (state === 'charging') doCast(); holding = false; }
  const NPC_PANELS = { capucine: 'ferme', farm: 'ferme', marguerite: ['marche', 'ing'], gaston: ['marche', 'rec'], kitchen: 'cuisine', josiane: 'josiane', jm: 'jm', coco: 'coco', gerard: 'gerard', brandon: ['gerard', 'concours'], board: ['gerard', 'commandes'], roger: ['carnet', 'roger'], aquarium: ['carnet', 'aquarium'], merchant: 'merchant' };
  const canvas = document.querySelector('#scene');
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return; // le clic droit sert à la caméra
    e.preventDefault(); A.ensure();
    if (G.ui.isOpen()) return;
    const id = W.pickAt(e.clientX, e.clientY);
    if (id === 'gull') { chaseGull(); return; }
    if (id === 'bottle' && !['reeling', 'bite', 'charging'].includes(state)) { collectBottle(); return; }
    if (id && NPC_PANELS[id] && (state === 'idle' || state === 'waiting')) {
      A.sfx.click();
      const p = NPC_PANELS[id];
      if (Array.isArray(p)) G.ui.openPanel(p[0], p[1]); else G.ui.openPanel(p);
      return;
    }
    press();
  });
  window.addEventListener('pointerup', (e) => { if (e.button > 0) return; release(); });
  window.addEventListener('pointercancel', release);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) press(); }
    if (e.code === 'Escape') { if (G.ui.isOpen()) G.ui.closePanel(); else if (!['charging', 'reeling', 'bite'].includes(state)) G.ui.openPanel('menu'); }
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') release(); });
  window.addEventListener('blur', () => { holding = false; if (state === 'charging') doCast(); });
  window.addEventListener('beforeunload', () => { if (!resetting) save(); });

  // ---------------------------------------------------------------- Boucle
  function hangBobber() {
    W.rodTip.getWorldPosition(tipPos);
    bobPos.set(tipPos.x + Math.sin(T * 1.7) * 0.05, tipPos.y - 0.9, tipPos.z + Math.cos(T * 1.3) * 0.05);
  }
  let hudT = 0, achT = 0;
  function update(dt) {
    T += dt;
    let rodTarget = ROD_IDLE, rodWobble = 0;
    const m = mods();

    switch (state) {
      case 'idle': hangBobber(); break;
      case 'charging':
        chargeT += dt;
        power = 1 - Math.abs(((chargeT * 0.85) % 2) - 1);
        el.powerFill.style.width = (power * 100).toFixed(1) + '%';
        rodTarget = lerp(ROD_IDLE, 0.55, power);
        hangBobber();
        break;
      case 'casting': {
        castT += dt / 0.75;
        rodTarget = -1.25;
        const t = Math.min(castT, 1);
        bobPos.lerpVectors(castFrom, castTo, t);
        bobPos.y = lerp(castFrom.y, 0.05, t) + Math.sin(Math.PI * t) * (2 + power * 3);
        if (castT >= 1) land();
        break;
      }
      case 'waiting': {
        bobPos.y = W.waveH(bobPos.x, bobPos.z, T) + 0.05;
        if (!approacher && (scanT -= dt) <= 0) { scanT = 0.5; findApproacher(true); }
        if (approacher && waitT > 50 && Math.hypot(approacher.pos.x - bobPos.x, approacher.pos.z - bobPos.z) < 0.7) waitT = rand(0.5, 1.8) / m.bite;
        waitT -= dt;
        nibbleCD -= dt;
        if (nibbleCD <= 0 && waitT > 1.2 && waitT < 50 && Math.random() < 0.5 * dt) {
          nibbleCD = rand(2, 4); W.ripple(bobPos, 0.6); bobPos.y -= 0.1;
          if (Math.random() < 0.5) G.ui.say(pick(Q.nibble));
        }
        if (S.roger.lvl >= 1 && !rattled && waitT < 0.7 && waitT > 0) { rattled = true; A.sfx.rattle(); W.roger.position.y += 0.05; setTimeout(() => (W.roger.position.y -= 0.05), 150); }
        if (waitT <= 0) bite();
        break;
      }
      case 'bite':
        biteT -= dt;
        bobPos.y = W.waveH(bobPos.x, bobPos.z, T) - 0.18 + Math.sin(T * 30) * 0.06;
        rodWobble = Math.sin(T * 25) * 0.04;
        if (biteT <= 0) { G.ui.say(pick(Q.miss)); S.stats.misses++; A.sfx.escape(); hooked = null; releaseApproacher(true); W.setHeroMode('sad'); startReelBack(); }
        break;
      case 'reeling': {
        R.t += dt;
        const half = R.zoneW / 2, swing = 0.5 - half;
        const res = line().res * (R.cursed ? 1.6 : 1);
        let diff = R.diff;
        if (R.beh === 'fatigue') diff *= lerp(1.6, 0.55, clamp(R.t / 9, 0, 1));
        let zoneSpeed = 0.55 + 0.45 * diff;
        if (R.beh === 'sprint') {
          R.sprintT -= dt;
          if (R.sprintT <= 0) {
            if (R.sprinting > 0) { R.sprinting = 0; R.sprintT = rand(2.5, 4.5); }
            else { R.sprinting = 1.3; R.sprintT = 1.3; W.splash(bobPos, 6); A.sfx.whoosh(); }
          }
          if (R.sprinting > 0) { R.sprinting -= dt; zoneSpeed *= 2.6; R.tension += 0.3 * diff * res * dt; }
        }
        if (R.beh === 'farceur') {
          R.jumpT -= dt;
          if (R.jumpT <= 0) { R.jumpT = rand(1.8, 3.2); R.zoneTarget = rand(half, 1 - half); A.sfx.boing(); }
          R.zoneC += (R.zoneTarget - R.zoneC) * Math.min(1, dt * 6);
        } else {
          R.ph += dt * zoneSpeed;
          R.zoneC = 0.5 + swing * Math.sin(R.ph + R.phase) * (0.6 + 0.4 * Math.sin(R.t * 0.43 + 1.7));
        }
        if (R.beh === 'lourd') R.tension += 0.2 * diff * res * dt;
        R.tension += (holding ? 0.85 : -0.7) * dt;
        if ((R.jerkT -= dt) <= 0) {
          const sac = R.beh === 'saccade';
          R.jerkT = rand(0.5, 1.6) / Math.max(0.5, diff) * (sac ? 0.45 : 1);
          R.tension += rand(0.04, 0.13) * diff * Math.max(1, hooked.ratio) * res * (sac ? 0.6 : 1);
          W.ripple(bobPos, 0.7);
        }
        R.tension = clamp(R.tension, 0, 1.05);
        const inZone = Math.abs(R.tension - R.zoneC) < half;
        const gain = 0.17 * reel().power / (0.6 + diff * 0.6) / Math.max(1, hooked.ratio * hooked.ratio);
        const pk = perks();
        R.progress += inZone ? gain * (R.progress > 0.8 ? 1 + pk.net : 1) * dt : -0.1 * Math.max(0.1, 1 - pk.loss) * dt;
        if (holding && (tickT -= dt) <= 0) { A.sfx.tick(); tickT = 0.07; }

        el.reelZone.style.left = ((R.zoneC - half) * 100) + '%';
        el.reelZone.style.width = (R.zoneW * 100) + '%';
        el.reelZone.style.background = inZone ? '#8bd49a' : '#c6e9cd';
        el.reelNeedle.style.left = (clamp(R.tension, 0, 1) * 100) + '%';
        el.reelProg.style.width = (clamp(R.progress, 0, 1) * 100) + '%';
        el.reel.classList.toggle('danger', R.tension > 0.85);

        const r = W.rig.position, k = clamp(R.progress, 0, 1);
        bobPos.x = lerp(R.start.x, r.x + 0.3, k) + Math.sin(R.t * 2.3) * 1.2 * (1 - k) * (R.sprinting > 0 ? 2 : 1);
        bobPos.z = lerp(R.start.z, r.z - 3.2, k);
        bobPos.y = W.waveH(bobPos.x, bobPos.z, T) - 0.1 + Math.sin(R.t * 18) * 0.04 * diff;
        rodTarget = -0.55 + R.tension * 0.25;
        rodWobble = Math.sin(R.t * 30) * 0.02 * (1 + R.tension * 2);
        if (R.tension > 0.85) W.shake(0.02);
        if (Math.random() < dt * 3) W.splash(bobPos, 1);

        if (R.tension >= 1) snapLine();
        else if (R.progress <= 0) escapeFish();
        else if (R.progress >= 1) landFish();
        break;
      }
      case 'reelback': {
        reelBackT += dt / 0.6;
        W.rodTip.getWorldPosition(tipPos);
        const t = Math.min(reelBackT, 1);
        bobPos.lerpVectors(reelBackFrom, tmpV.set(tipPos.x, tipPos.y - 0.9, tipPos.z), t);
        bobPos.y += Math.sin(Math.PI * t) * 1.2;
        if (reelBackT >= 1) { setState('idle'); setTimeout(() => { if (state === 'idle') W.setHeroMode('idle'); }, 800); }
        break;
      }
      case 'snapped':
        snapT -= dt; hangBobber();
        if (snapT <= 0) { W.bobber.visible = true; hooked = null; setState('idle'); setTimeout(() => { if (state === 'idle') W.setHeroMode('idle'); }, 600); }
        break;
      case 'caught':
        hangBobber();
        if (caughtMesh) {
          caughtT += dt;
          const show = fishShow();
          const t = Math.min(caughtT / 0.8, 1);
          if (t < 1) {
            caughtMesh.position.lerpVectors(caughtMesh.userData.from, show, t);
            caughtMesh.position.y += Math.sin(Math.PI * t) * 2.2;
            caughtMesh.rotation.z = t * Math.PI * 4;
          } else {
            caughtMesh.position.copy(show); caughtMesh.position.y += Math.sin(caughtT * 3) * 0.1;
            caughtMesh.rotation.z = Math.sin(caughtT * 8) * 0.3;
            caughtMesh.rotation.y = caughtT * 1.2;
          }
        }
        break;
    }

    W.rodPivot.rotation.x = lerp(W.rodPivot.rotation.x, rodTarget, Math.min(1, dt * (state === 'casting' ? 18 : 8))) + rodWobble;
    W.bobber.position.copy(bobPos);
    W.rodTip.getWorldPosition(tipPos);
    let sag = 0.4;
    if (['idle', 'charging', 'caught', 'snapped'].includes(state)) sag = 0;
    else if (state === 'reeling') sag = 0.25 * (1 - (R ? R.tension : 0.5));
    else if (state === 'casting') sag = 0.1;
    W.updateLine(tipPos, bobPos, sag, state !== 'snapped' && state !== 'caught');

    if (state === 'bite' || fakeBang) { const p = W.project(tmpV.copy(bobPos).setY(bobPos.y + 0.6)); el.bang.style.left = p.x + 'px'; el.bang.style.top = p.y + 'px'; }

    updateShadows(dt, T);
    updateGull(dt);
    updateEvents(dt);
    updateTime(dt);
    updateContest(dt);
    updateTripFx(dt);
    updateCook(dt); updateBuffs(dt); updateOrders(dt); updateFarm(dt);
    W.animateHero(T, dt, R ? R.tension : 0);
    W.update(T, dt, S.time, nightK());

    if ((hudT -= dt) <= 0) { hudT = 0.25; G.ui.updateTicker(); }
    if ((achT -= dt) <= 0) { achT = 1; checkAchievements(); checkQuest(); }
    if ((saveT -= dt) <= 0) { saveT = 10; save(); }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    W.render();
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- API pour l'UI & démarrage
  G.game = {
    get S() { return S; }, D, fishById, rod, reel, line, bait, spot, spotIdx, bucketCap, aquaCap, has, mods, isNight, nightK, clockStr,
    dailyFish, questProgress, orderMatches, sellMult, cosById,
    perks, lvlInfo, titleOf, skillPts, treeLvl, ingPrice, ingAvailable, dailyDiscount, dailyMenu, dishPrice, stars, fishMatches, recipeById, ingById, knows, stoveTier, knifeTier,
    forecast: () => (perks().forecast ? { w: S.nextWeather, t: S.weatherT } : null),
    zoneDef, tierOwned, farmInfo, hasTech, techMissing, slotsInfo, importText, syncFarm,
    contest: () => contest, merchant: () => merchant, state: () => state, act, trip: () => S.trip, fmtTime,
  };

  if (!byId(D.spots, S.spot)) S.spot = 's1';
  [['rod', D.rods], ['reel', D.reels], ['line', D.lines], ['bait', D.baits]].forEach(([k, list]) => { if (!byId(list, S[k])) S[k] = list[0].id; });
  if (!D.weathers[S.weather]) S.weather = 'clair';
  if (!S.rpg.init) { S.rpg.init = true; if (S.stats.caught > 0) { S.rpg.xp = Math.round(S.stats.caught * 14 + S.stats.orders * 20); S.rpg.lvl = lvlOf(S.rpg.xp, 'fish'); } }
  [['hook', D.hooks], ['net', D.nets]].forEach(([k, list]) => { if (!byId(list, S[k])) S[k] = list[0].id; });
  if (S.legacy) { // sauvegardes d'avant le « départ minimaliste »
    S.bucketLvl += 1;
    S.cook.knife += 1;
    if (S.cook.stove > 0 || S.cook.recipes.length > 1 || S.stats.cooked > 0) { S.techs = D.techs.map((t) => t.id); S.utensils = D.utensils.map((u) => u.id); }
    if (S.upgrades.includes('u_bateau')) { S.boats = ['bt1']; S.upgrades = S.upgrades.filter((u) => u !== 'u_bateau'); S.zone = S.boat ? 'large' : 'rive'; }
    S.legacy = false; S.ver = 4;
  }
  S.boat = S.zone !== 'rive';
  if (!byId(D.zones, S.zone)) { S.zone = 'rive'; S.boat = false; }
  ensureOrders();
  { const off = S.savedAt ? Math.min(1800, (Date.now() - S.savedAt) / 1000) : 0; if (off > 5) tickFarm(off, true); }
  if (!S.nextWeather || !spot().weathers.includes(S.nextWeather)) S.nextWeather = pick(spot().weathers.filter((w) => w !== S.weather));
  W.applySpot(spot());
  W.setZone(zoneDef(), tierOwned()); syncFarm();
  W.setRogerLevel(S.roger.lvl);
  W.refreshAquarium(S.aquarium);
  W.refreshKitchen(S.cook, S.utensils); W.setCooking(S.cook.slots.length);
  refreshGear();
  setWeather(S.weather, false);
  A.setMusic(S.opts.music); A.setSfx(S.opts.sfx); W.setTripMotion(S.opts.softTrip ? 0.3 : 1);
  ensureOrders();
  resetShadows();
  hangBobber();
  G.ui.updateHUD();
  setState('idle');
  if (!S.seenWelcome) {
    S.seenWelcome = true; save();
    setTimeout(() => G.ui.say(S.migrated ? 'Bienvenue dans la V2 ! Tu es désormais une loutre. Ne pose pas de questions. Ton argent et ton matériel ont suivi.' : Q.welcome, 'Narrateur', 6500), 600);
    setTimeout(() => G.ui.say("Vise les ombres sous l'eau. Et va voir Tonton Gérard, il fait la planche à droite du ponton. Il a une prophétie.", 'Narrateur', 6500), 7400);
  } else {
    setTimeout(() => G.ui.say(`Re-bonjour, Loutrec. Tu as ${fmt(S.money)} pièces et ${S.bucket.length} trucs dans ton seau. Roger t'attendait. Immobile.`), 600);
  }
  requestAnimationFrame(loop);

  // Debug console : PP.money(1000), PP.time(0.7) (nuit), PP.weather('orage'), PP.merchant(), PP.bottle(), PP.school(), PP.gull()
  window.PP = {
    state: () => S, money: (n) => { earn(n); save(); G.ui.updateHUD(); }, time: (t) => { S.time = t; },
    xp: (n = 500, tree = 'fish') => { addXp(n, tree); G.ui.updateHUD(); }, ing: (n = 5) => { D.ingredients.forEach((i) => (S.pantry[i.id] = (S.pantry[i.id] || 0) + n)); },
    boat: (tier = 4) => { D.boats.filter((b) => b.tier <= tier).forEach((b) => { if (!S.boats.includes(b.id)) S.boats.push(b.id); }); G.ui.updateHUD(); }, farm: () => { S.farm.owned = 8; S.farm.can = 4; S.farm.lvl = 15; S.farm.tools = { epouvantail: true, serre: true }; },
    trip: (l = 1, t = 180) => { S.trip.t = t; S.trip.lvl = l; }, lsd: () => { S.bucket.push({ id: 'tiedye', w: 0.5, price: 90 }); G.ui.updateHUD(); },
    weather: (w) => setWeather(w, true), merchant: spawnMerchant, bottle: spawnBottle, school: spawnSchool, gull: () => { forceGull = true; },
  };
})();
