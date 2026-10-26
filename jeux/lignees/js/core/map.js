// Génération procédurale de la carte. Même graine + même origine = même carte.
G.map = (function () {
  const W = 31, H = 31;
  const CX = 15, CY = 15;
  const START_RADIUS = 4; // territoire de départ : 9×9 cases

  function generate(seed, originId) {
    const r = G.util.rng(seed);
    const w = (G.ORIGINS[originId] && G.ORIGINS[originId].map) || {};
    const tiles = new Array(W * H).fill('plaine');
    const idx = (x, y) => y * W + x;
    const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const nearCenter = (x, y, d) => Math.abs(x - CX) <= d && Math.abs(y - CY) <= d;

    function blob(type, count, rmin, rmax, protect) {
      for (let i = 0; i < count; i++) {
        const cx = Math.floor(r() * W), cy = Math.floor(r() * H);
        const rad = rmin + r() * (rmax - rmin);
        for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) {
          for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
            if (!inside(x, y) || nearCenter(x, y, protect)) continue;
            const d = Math.hypot(x - cx, y - cy) + (r() - 0.5) * 1.2;
            if (d <= rad) tiles[idx(x, y)] = type;
          }
        }
      }
    }

    // Reliefs et végétation.
    blob('fertile', 9, 1.2, 2.6, 1);
    blob('colline', Math.round(11 * (w.colline || 1)), 1.2, 2.8, 1);
    blob('foret', Math.round(15 * (w.foret || 1)), 1.2, 3, 1);
    blob('montagne', 7, 0.6, 1.6, START_RADIUS + 1);

    // Rivière : marche aléatoire d'un bord à l'autre.
    const rivers = (w.eau || 1) > 1.5 ? 2 : 1;
    for (let k = 0; k < rivers; k++) {
      const vertical = r() < 0.5;
      let p = Math.floor(3 + r() * (W - 6));
      for (let s = 0; s < W; s++) {
        const x = vertical ? p : s, y = vertical ? s : p;
        if (!nearCenter(x, y, 1)) tiles[idx(x, y)] = 'eau';
        if (r() < 0.45) p += r() < 0.5 ? -1 : 1;
        p = G.util.clamp(p, 1, W - 2);
        if (nearCenter(vertical ? p : s, vertical ? s : p, 1)) p += (p < CX ? -2 : 2);
      }
    }
    blob('eau', Math.round(2 * (w.eau || 1)), 1, 2.2, 3);

    // Terres fertiles le long de l'eau.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (tiles[idx(x, y)] !== 'plaine') continue;
      const nearWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy) && tiles[idx(x + dx, y + dy)] === 'eau');
      if (nearWater && r() < 0.45) tiles[idx(x, y)] = 'fertile';
    }

    // Gisements : placés sur des collines, en petits amas.
    const oreMult = w.ore || 1;
    function deposit(type, clusters, minD, maxD) {
      for (let i = 0; i < clusters; i++) {
        const cands = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const d = Math.max(Math.abs(x - CX), Math.abs(y - CY));
          if (d >= minD && d <= maxD && tiles[idx(x, y)] === 'colline') cands.push([x, y]);
        }
        let x, y;
        if (cands.length) [x, y] = G.util.pick(cands, r);
        else { // pas de colline disponible : on en crée une
          const ang = r() * Math.PI * 2, d = minD + r() * (maxD - minD);
          x = G.util.clamp(Math.round(CX + Math.cos(ang) * d), 0, W - 1);
          y = G.util.clamp(Math.round(CY + Math.sin(ang) * d), 0, H - 1);
        }
        tiles[idx(x, y)] = type;
        const extra = 1 + Math.floor(r() * 2);
        for (let e = 0; e < extra; e++) {
          const [dx, dy] = G.util.pick([[1, 0], [-1, 0], [0, 1], [0, -1]], r);
          if (inside(x + dx, y + dy) && !nearCenter(x + dx, y + dy, 1) && tiles[idx(x + dx, y + dy)] !== 'eau') tiles[idx(x + dx, y + dy)] = type;
        }
      }
    }
    const R = START_RADIUS;
    deposit('g_cuivre', 1, 2, 3);                       // garanti dans la zone de départ
    deposit('g_etain', 1, R, R + 2);                    // juste à la frontière
    deposit('g_cuivre', Math.round(2 * oreMult), R + 2, 14);
    deposit('g_etain', Math.round(2 * oreMult), R + 3, 14);
    deposit('g_fer', 1, R, R + 2);
    deposit('g_fer', Math.round(3 * oreMult), R + 2, 14);
    deposit('g_charbon', 1, R + 1, R + 3);
    deposit('g_charbon', Math.round(3 * oreMult), R + 3, 14);

    // Garanties de la zone de départ : de quoi démarrer sans blocage.
    function ensure(type, min) {
      let count = 0;
      const free = [];
      for (let y = CY - R; y <= CY + R; y++) for (let x = CX - R; x <= CX + R; x++) {
        if (tiles[idx(x, y)] === type) count++;
        else if (!nearCenter(x, y, 1) && (tiles[idx(x, y)] === 'plaine')) free.push([x, y]);
      }
      const sh = G.util.shuffle(free, r);
      for (let i = 0; count < min && i < sh.length; i++, count++) tiles[idx(sh[i][0], sh[i][1])] = type;
    }
    ensure('foret', 8);
    ensure('colline', 5);

    // Gisements rares, loin du centre (placés après les garanties pour ne pas changer les cartes existantes).
    deposit('g_marbre', 2, R + 3, 12);
    deposit('g_or', 2, R + 5, 14);
    deposit('g_gemmes', 2, R + 7, 15);
    deposit('g_uranium', 2, R + 8, 15);

    tiles[idx(CX, CY)] = 'plaine';
    return tiles;
  }

  function initialOwned(radius) {
    const owned = new Array(W * H).fill(false);
    for (let y = CY - radius; y <= CY + radius; y++)
      for (let x = CX - radius; x <= CX + radius; x++) owned[y * W + x] = true;
    return owned;
  }

  // Ancienne sauvegarde sur une carte plus petite : on régénère une carte à la taille actuelle
  // (même graine) et on y recopie l'ancienne au centre, bâtiments et territoire compris.
  function migrate(run) {
    if (run.tiles.length === W * H) return false;
    const oldW = Math.round(Math.sqrt(run.tiles.length)), off = CX - (oldW - 1) / 2;
    const tiles = generate(run.seed, run.origin), owned = new Array(W * H).fill(false);
    for (let y = 0; y < oldW; y++) for (let x = 0; x < oldW; x++) {
      const i = (y + off) * W + (x + off);
      tiles[i] = run.tiles[y * oldW + x];
      owned[i] = run.owned[y * oldW + x];
    }
    run.tiles = tiles; run.owned = owned;
    run.buildings.forEach(b => { b.x += off; b.y += off; });
    return true;
  }

  // Parties d'avant les ressources rares : on y sème les gisements rares de la carte régénérée,
  // sur les cases libres.
  const RARES = ['g_marbre', 'g_or', 'g_gemmes', 'g_uranium'];
  function addRares(run) {
    const missing = RARES.filter(r => !run.tiles.includes(r));
    if (!missing.length) return false;
    const fresh = generate(run.seed, run.origin), used = new Set(run.buildings.map(b => b.y * W + b.x));
    fresh.forEach((t, i) => { if (missing.includes(t) && !used.has(i)) run.tiles[i] = t; });
    return true;
  }

  // Gisements inépuisables : une case épuisée dans une ancienne partie (devenue colline) retrouve son gisement.
  function restoreDeposits(run) {
    if (!G.DEPOSITS_INFINITE || !run.deposits || run.tiles.length !== W * H) return 0;
    const fresh = generate(run.seed, run.origin);
    let n = 0;
    for (const k in run.deposits) {
      const i = +k;
      if (run.deposits[k] <= 0 && run.tiles[i] === 'colline' && String(fresh[i]).startsWith('g_')) { run.tiles[i] = fresh[i]; delete run.deposits[k]; n++; }
    }
    if (n) G.terrainVer = (G.terrainVer || 0) + 1;
    return n;
  }

  return { W, H, CX, CY, START_RADIUS, generate, initialOwned, migrate, addRares, restoreDeposits };
})();
