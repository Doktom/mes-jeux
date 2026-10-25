// Défense : minuterie des vagues, ennemis, tours et projectiles.
// Les vagues n'avancent qu'en jeu : elles sont suspendues hors ligne.
// L'état de combat (ennemis, projectiles) est transitoire et n'est pas sauvegardé.
G.defense = (function () {
  const C = { enemies: [], projectiles: [], floaters: [], spawnQueue: [], sides: [], units: [], loot: 0, spawnClock: 0, lastSpawn: 0 };
  const FLEE_AFTER = 90; // secondes après la dernière apparition avant la fuite des survivants

  function reset() {
    C.enemies.length = 0; C.projectiles.length = 0; C.spawnQueue.length = 0; C.sides = []; C.loot = 0; C.forumWarned = false;
  }

  function wavesOn() { return !!G.RIGUEUR[G.run.rigueur].waves; }

  // Portée d'une tour : +0,5 case par niveau au-delà du premier.
  function towerRange(b) {
    const d = G.BUILDINGS[b.type];
    return d.tower ? d.tower.range + 0.5 * ((b.level || 1) - 1) + (b.spec === 'range' ? 1.5 : 0) : 0;
  }

  function interval() { return G.WAVES.interval * Math.max(0.4, 1 + G.M.waveInterval); }

  // Composition d'une vague (sans la faire apparaître) : utilisée en jeu et hors ligne.
  function composeWave(run) {
    const roster = G.ENEMIES[run.era];
    const n = run.wave.inEra;
    const hpMult = Math.pow(G.WAVES.hpGrowth, n) * (1 + G.M.waveHp);
    const count = Math.max(2, Math.round((3 + n * 0.6) * (1 + G.M.waveCount)));
    const heavyShare = Math.min(0.5, Math.max(0, n - 2) * 0.04);
    // Voleurs dès la 3e vague de l'ère, sapeurs dès la 5e.
    const thiefShare = n >= 2 ? 0.15 : 0, sapperShare = n >= 4 ? 0.1 : 0;
    const list = [];
    for (let i = 0; i < count; i++) {
      const f = i / count;
      list.push(f < heavyShare ? 'heavy' : f < heavyShare + thiefShare ? 'thief' : f < heavyShare + thiefShare + sapperShare ? 'sapper' : 'basic');
    }
    if ((run.wave.index + 1) % G.WAVES.bossEvery === 0) list.push('boss');
    return list.map(kind => {
      const t = roster[kind];
      return { kind, name: t.name, hp: t.hp * hpMult, maxHp: t.hp * hpMult, speed: t.speed, dmg: t.dmg * (1 + n * 0.03), r: t.r, color: t.color };
    });
  }

  function startWave() {
    const run = G.run;
    run.wave.active = true;
    const list = composeWave(run);
    if (!C.sides.length) pickSides(run);
    const nSides = C.sides.length;
    C.spawnQueue = list.map((e, i) => ({ e, at: i * 0.6, side: C.sides[i % nSides] }));
    C.spawnClock = 0;
    C.loot = 0;
    C.hadBoss = list.some(e => e.kind === 'boss');
    C.stolen = 0; C.thiefWarned = false;
    G.ui && G.ui.toast('⚔️ Une vague attaque !', 'danger');
    const boss = list.find(e => e.kind === 'boss');
    G.lore && G.lore.say(boss ? 'bossStart' : 'waveStart', { enemy: list[0].name, boss: boss && boss.name, n: list.length });
  }

  // Côtés d'arrivée, choisis dès le début du préavis pour que le joueur puisse s'y préparer.
  function pickSides(run) {
    C.sides = G.util.shuffle([0, 1, 2, 3], Math.random).slice(0, run.wave.inEra >= 6 ? 2 : 1);
  }

  // Zone d'arrivée : le territoire possédé élargi de SPAWN_MARGIN cases (bornée par la carte),
  // pour que la marche d'approche reste la même quelle que soit la taille de la carte.
  const SPAWN_MARGIN = 6;
  function spawnBox() {
    const run = G.run, W = G.map.W, H = G.map.H;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (run.owned[y * W + x]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return {
      x0: Math.max(0.3, x0 - SPAWN_MARGIN), y0: Math.max(0.3, y0 - SPAWN_MARGIN),
      x1: Math.min(W - 0.3, x1 + 1 + SPAWN_MARGIN), y1: Math.min(H - 0.3, y1 + 1 + SPAWN_MARGIN),
    };
  }

  function spawnPoint(side) {
    const b = spawnBox(), u = 0.1 + Math.random() * 0.8;
    const tx = b.x0 + (b.x1 - b.x0) * u, ty = b.y0 + (b.y1 - b.y0) * u;
    if (side === 0) return { x: tx, y: b.y0 };
    if (side === 1) return { x: b.x1, y: ty };
    if (side === 2) return { x: tx, y: b.y1 };
    return { x: b.x0, y: ty };
  }

  function nearestBuilding(x, y) {
    let best = null, bd = Infinity;
    for (const b of G.run.buildings) {
      if (b.ruined || G.BUILDINGS[b.type].road) continue;
      const d = (b.x + 0.5 - x) ** 2 + (b.y + 0.5 - y) ** 2;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  function nearestStore(x, y) {
    let best = null, bd = Infinity;
    for (const b of G.run.buildings) {
      if (!G.logistics.isStore(b)) continue;
      const d = (b.x + 0.5 - x) ** 2 + (b.y + 0.5 - y) ** 2;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // Voleur : fond sur la cellule en transit la plus proche, s'en empare, et s'enfuit avec deux
  // prises vers le bord de la zone d'arrivée. Renvoie false s'il n'a rien à voler (il attaque alors
  // les bâtiments comme les autres).
  function updateThief(e, dt) {
    const now = G.run.lt || 0;
    if (e.escaping || (e.loot && e.loot.length >= 2)) {
      e.escaping = true;
      const b = spawnBox();
      const exits = [{ x: e.x, y: b.y0 }, { x: e.x, y: b.y1 }, { x: b.x0, y: e.y }, { x: b.x1, y: e.y }];
      const ex = exits.sort((p, q) => Math.hypot(p.x - e.x, p.y - e.y) - Math.hypot(q.x - e.x, q.y - e.y))[0];
      const d = Math.hypot(ex.x - e.x, ex.y - e.y);
      if (d < 0.3) e.escaped = true;
      else { e.x += (ex.x - e.x) / d * e.speed * 1.15 * dt; e.y += (ex.y - e.y) / d * e.speed * 1.15 * dt; }
      e.attacking = false;
      return true;
    }
    const list = G.run.transit || [];
    let best = -1, bd = Infinity, bp = null;
    for (let i = 0; i < list.length; i++) {
      const q = G.logistics.pos(list[i], now), d = Math.hypot(q.x - e.x, q.y - e.y);
      if (d < bd) { bd = d; best = i; bp = q; }
    }
    if (best < 0) { if (e.loot && e.loot.length) { e.escaping = true; return true; } return false; }
    if (bd < e.r + 0.25) {
      const p = list.splice(best, 1)[0];
      (e.loot || (e.loot = [])).push({ r: p.r, q: p.q });
      floater(e.x, e.y - 0.3, '💰 ' + G.RESOURCES[p.r].icon, '#b8913e', 1.2);
      if (!C.thiefWarned) { C.thiefWarned = true; G.lore && G.lore.say('thief', { enemy: e.name.toLowerCase() }); }
      return true;
    }
    e.x += (bp.x - e.x) / bd * e.speed * dt; e.y += (bp.y - e.y) / bd * e.speed * dt;
    e.attacking = false;
    return true;
  }

  function towerDamage(b) {
    const d = G.BUILDINGS[b.type];
    if (!d.tower || b.ruined || b.paused) return 0;
    const eff = b._eff === undefined ? 1 : b._eff;
    return d.tower.dps * G.economy.lv(b).tower * G.economy.mastery(b.type) * eff * (b._boosted ? d.boost.mult : 1) * Math.max(0.1, 1 + (b._adj || 0)) * Math.max(0.1, 1 + G.M.towerDmg);
  }

  function update(dt) {
    const run = G.run;
    if (run.over) return;

    if (!wavesOn()) {
      // Mode Paisible : aucune vague, mais les soldats restent actifs (et inoccupés).
    } else if (!run.wave.active) {
      run.wave.timer -= dt;
      if (run.wave.timer <= G.WAVES.warning && !C.sides.length) {
        pickSides(run);
        const SIDES = ['du nord', "de l'est", 'du sud', "de l'ouest"];
        G.lore && G.lore.say('waveWarn', { side: C.sides.map(s => SIDES[s]).join(' et '), enemy: G.ENEMIES[run.era].basic.name.toLowerCase() });
      }
      if (run.wave.timer <= 0) startWave();
    } else {
      // Apparition échelonnée.
      C.spawnClock += dt;
      while (C.spawnQueue.length && C.spawnQueue[0].at <= C.spawnClock) {
        const s = C.spawnQueue.shift();
        const p = spawnPoint(s.side);
        C.lastSpawn = C.spawnClock;
        C.enemies.push(Object.assign(s.e, { x: p.x, y: p.y, target: null, phase: Math.random() * 6 }));
      }
    }

    updateUnits(dt);

    // Ennemis : marchent vers le bâtiment le plus proche puis l'attaquent.
    // Un ennemi bloqué par un soldat se retourne contre lui.
    for (const e of C.enemies) {
      const bl = e.blocker;
      if (bl && !bl.dead && Math.hypot(bl.x - e.x, bl.y - e.y) <= e.r + bl.r + 0.2) {
        e.attacking = true;
        bl.hp -= e.dmg * dt;
        if (bl.hp <= 0) killUnit(bl);
        continue;
      }
      e.blocker = null;
      if (e.kind === 'thief' && updateThief(e, dt)) continue;
      if (e.kind === 'sapper' && (!e.target || e.target.ruined || !G.logistics.isStore(e.target))) e.target = nearestStore(e.x, e.y);
      if (!e.target || e.target.ruined) e.target = nearestBuilding(e.x, e.y);
      if (!e.target) continue;
      const tx = e.target.x + 0.5, ty = e.target.y + 0.5;
      const dx = tx - e.x, dy = ty - e.y, dist = Math.hypot(dx, dy);
      if (dist > 0.5 + e.r) {
        e.x += (dx / dist) * e.speed * dt;
        e.y += (dy / dist) * e.speed * dt;
        e.attacking = false;
      } else {
        e.attacking = true;
        e.target.hp -= e.dmg * (e.kind === 'sapper' ? 3 : 1) * dt;
        if (e.target.type === 'forum' && !C.forumWarned && e.target.hp < G.economy.maxHp(e.target) * 0.5) {
          C.forumWarned = true;
          G.lore && G.lore.say('forumHurt', {});
        }
        if (e.target.hp <= 0) ruin(e.target);
      }
    }

    // Tours.
    const rateMult = 1 + G.M.towerRate;
    for (const b of run.buildings) {
      const d = G.BUILDINGS[b.type];
      if (!d.tower || b.ruined || b.paused) continue;
      b._cd = (b._cd || 0) - dt;
      if (b._cd > 0 || !C.enemies.length) continue;
      const cx = b.x + 0.5, cy = b.y + 0.5;
      const range = towerRange(b);
      let target = null, bd = range * range;
      for (const e of C.enemies) {
        const dd = (e.x - cx) ** 2 + (e.y - cy) ** 2;
        if (dd <= bd) { bd = dd; target = e; }
      }
      if (!target) continue;
      const rate = d.tower.rate * rateMult * (b.spec === 'rate' ? 1.5 : 1);
      const dmg = towerDamage(b) / d.tower.rate;
      if (dmg <= 0) continue;
      b._cd = 1 / rate;
      const splash = d.tower.splash || (b.spec === 'splash' ? 0.8 : 0);
      C.projectiles.push({ x: cx, y: cy, target, tx: target.x, ty: target.y, dmg, splash, color: G.CAT_COLOR.military, big: !!splash });
    }

    // Projectiles.
    for (const p of C.projectiles) {
      if (p.target && p.target.hp > 0) { p.tx = p.target.x; p.ty = p.target.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy), step = 9 * dt;
      if (dist <= step) {
        p.done = true;
        if (p.splash) {
          for (const e of C.enemies) if (Math.hypot(e.x - p.tx, e.y - p.ty) <= p.splash) hit(e, p.dmg);
          floater(p.tx, p.ty, '💥', '#c0504d', 0.6);
        } else if (p.target && p.target.hp > 0) hit(p.target, p.dmg);
      } else { p.x += (dx / dist) * step; p.y += (dy / dist) * step; }
    }
    C.projectiles = C.projectiles.filter(p => !p.done);

    // Ennemis vaincus.
    C.enemies = C.enemies.filter(e => {
      if (e.escaped) { C.stolen += (e.loot || []).length; return false; }
      if (e.hp > 0) return true;
      if (e.loot && e.loot.length) {
        e.loot.forEach(l => G.logistics.add(l.r, l.q, { x: e.x, y: e.y }));
        run.stats.recovered = (run.stats.recovered || 0) + 1;
        floater(e.x, e.y - 0.3, '💰 récupéré', '#3f7d58', 1.4);
      }
      run.stats.kills++;
      C.loot += e.maxHp;
      return false;
    });

    // Fin de vague : victoire, ou fuite des survivants après FLEE_AFTER secondes.
    if (run.wave.active && !C.spawnQueue.length) {
      if (!C.enemies.length) endWave(true);
      else if (C.spawnClock > C.lastSpawn + FLEE_AFTER) flee();
    }

    // Textes flottants.
    for (const f of C.floaters) { f.life -= dt; f.y -= dt * 0.6; }
    C.floaters = C.floaters.filter(f => f.life > 0);
  }

  // ---------- Soldats des casernes ----------
  // Chaque caserne active entretient une escouade (G.SOLDIERS). Les soldats attendent autour de la
  // caserne, interceptent les ennemis qui entrent dans leur rayon, les bloquent au corps à corps,
  // et reviennent après un délai quand ils tombent. L'escouade n'est pas sauvegardée : elle se reforme.
  function squadSize(b) {
    const d = G.BUILDINGS[b.type];
    if (!d.squad || b.ruined || b.paused || (b._eff !== undefined && b._eff < 0.3)) return 0;
    return G.SOLDIERS.base + G.SOLDIERS.perLevel * ((b.level || 1) - 1);
  }

  function unitStats(b) {
    const S = G.SOLDIERS.eras[Math.min(G.run.era, G.SOLDIERS.eras.length - 1)], k = G.economy.lv(b);
    return {
      name: S.name, color: S.color, speed: S.speed,
      maxHp: S.hp * k.hp * (1 + G.M.hp), dps: S.dps * k.tower * G.economy.mastery(b.type) * Math.max(0.1, 1 + G.M.towerDmg),
    };
  }

  function killUnit(u) {
    u.dead = true; u.hp = 0; u.target = null;
    u.respawn = G.SOLDIERS.respawn;
    floater(u.x, u.y - 0.2, '✝', '#5b6b80', 1);
  }

  // Point d'ancrage et rayon d'une escouade selon l'ordre donné à sa caserne.
  function squadAnchor(b) {
    const o = G.SQUAD_ORDERS[b.order || 'defend'] || G.SQUAD_ORDERS.defend, f = G.run.buildings[0];
    if (b.order === 'forum') return { x: f.x + 0.5, y: f.y + 0.5, r: o.radius };
    if (b.order === 'rally' && b.rally) return { x: b.rally.x + 0.5, y: b.rally.y + 0.5, r: o.radius };
    return { x: b.x + 0.5, y: b.y + 0.5, r: G.SOLDIERS.radius };
  }

  function updateUnits(dt) {
    const run = G.run, homes = {};
    for (const b of run.buildings) if (G.BUILDINGS[b.type].squad) homes[b.bid] = b;
    // Effectifs : on complète ou on réduit chaque escouade selon l'état de sa caserne.
    for (const bid in homes) {
      const b = homes[bid], want = squadSize(b), mine = C.units.filter(u => u.home === b.bid);
      for (let i = mine.length; i < want; i++) {
        const st = unitStats(b);
        C.units.push(Object.assign(st, { home: b.bid, slot: i, x: b.x + 0.5, y: b.y + 0.5, hp: st.maxHp, r: 0.15, dead: false, target: null, phase: Math.random() * 6 }));
      }
      if (mine.length > want) mine.slice(want).forEach(u => (u.gone = true));
    }
    C.units = C.units.filter(u => !u.gone && homes[u.home]);

    for (const u of C.units) {
      const home = homes[u.home], an = squadAnchor(home), hx = an.x, hy = an.y, R = an.r;
      if (u.dead) {
        u.respawn -= dt;
        if (u.respawn <= 0) Object.assign(u, unitStats(home), { dead: false, x: home.x + 0.5, y: home.y + 0.5 });
        if (!u.dead) u.hp = u.maxHp;
        continue;
      }
      // Cible : l'ennemi le plus proche du soldat, dans le rayon de la caserne.
      if (!u.target || u.target.hp <= 0 || Math.hypot(u.target.x - hx, u.target.y - hy) > R + 1) {
        u.target = null;
        let bd = Infinity;
        for (const e of C.enemies) {
          if (Math.hypot(e.x - hx, e.y - hy) > R) continue;
          const d = Math.hypot(e.x - u.x, e.y - u.y);
          if (d < bd) { bd = d; u.target = e; }
        }
      }
      let tx, ty, reach = 0.05;
      if (u.target) { tx = u.target.x; ty = u.target.y; reach = u.r + u.target.r + 0.15; }
      else {
        const n = Math.max(1, squadSize(home)), a = (u.slot / n) * Math.PI * 2 + 0.6;
        tx = hx + Math.cos(a) * 0.62; ty = hy + Math.sin(a) * 0.62;
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.05 * dt); // repos : les soldats se soignent
      }
      const dx = tx - u.x, dy = ty - u.y, dist = Math.hypot(dx, dy);
      if (dist > reach) {
        const step = Math.min(dist - reach, u.speed * dt);
        u.x += (dx / dist) * step; u.y += (dy / dist) * step;
        u.fighting = false;
      } else if (u.target) {
        u.fighting = true;
        hit(u.target, u.dps * dt);
        if (!u.target.blocker || u.target.blocker.dead) u.target.blocker = u;
      } else u.fighting = false;
    }
  }

  function hit(e, dmg) {
    e.hp -= dmg;
    e.flash = 0.12;
  }

  function ruin(b) {
    b.hp = 0;
    b.ruined = true;
    G.adjDirty = true;
    floater(b.x + 0.5, b.y + 0.3, 'En ruine', '#8e3f4f', 1.6);
    if (G.BUILDINGS[b.type].wonder) G.logic.recomputeMods();
    if (b.type === 'forum') G.logic.endRun('fall');
    else G.lore && G.lore.say('ruin', { building: G.BUILDINGS[b.type].name.toLowerCase() });
  }

  // Butin : répartit une valeur entre les ressources de base de l'ère.
  const LOOT_RES = [['nourriture', 'bois', 'pierre'], ['nourriture', 'bois', 'pierre', 'bronze'], ['pain', 'planches', 'fer', 'outils'], ['acier', 'machines', 'pain', 'charbon'], ['alliages', 'electronique', 'carburant', 'acier']];
  function giveLoot(value) {
    const list = LOOT_RES[G.run.era];
    const per = value / list.length;
    const out = [];
    list.forEach(r => { const g = G.economy.add(r, per); if (g >= 1) out.push(G.RESOURCES[r].icon + ' ' + G.util.fmt(g)); });
    return out;
  }

  // Les survivants repartent en emportant une part des réserves (3 % par ennemi, 30 % max).
  function flee() {
    const share = Math.min(0.3, C.enemies.length * 0.03);
    G.logistics.scaleAll(1 - share);
    G.ui && G.ui.toast('🏃 ' + C.enemies.length + ' pillards s\'enfuient avec ' + Math.round(share * 100) + ' % de vos réserves', 'danger');
    G.lore && G.lore.say('flee', { pct: Math.round(share * 100) });
    endWave(false);
  }

  function endWave(won) {
    const run = G.run;
    run.wave.active = false;
    run.wave.index++; run.wave.inEra++;
    run.wave.timer = interval();
    const f = run.buildings[0];
    if (won) {
      run.stats.wavesWon++;
      const gained = giveLoot(C.loot * 0.6 * (1 + G.M.loot));
      floater(f.x + 0.5, f.y, 'Vague repoussée !', '#3f7d58', 2.5);
      G.ui && G.ui.toast('🛡️ Vague ' + run.wave.index + ' repoussée' + (gained.length ? ' — butin : ' + gained.join('  ') : '') + (C.stolen ? ' · ' + C.stolen + ' cellule(s) volée(s)' : ''), 'good');
      if (run.stats.wavesWon % G.WAVES.bossEvery === 0) run.pending.push(G.logic.makeChoice(run, G.meta, 'minor'));
      G.lore && G.lore.say(C.hadBoss ? 'bossWon' : 'waveWon', { n: run.stats.wavesWon, kills: run.stats.kills });
    }
    reset();
  }

  function floater(x, y, text, color, life) {
    C.floaters.push({ x, y, text, color, life: life || 1.2, max: life || 1.2 });
  }

  return { C, update, reset, startWave, interval, towerDamage, towerRange, wavesOn, floater, composeWave, spawnBox, squadSize, unitStats, squadAnchor };
})();
