// Rendu de la carte sur canvas : terrain (mis en cache), bâtiments, combats, effets.
// Gère aussi la caméra (zoom molette, déplacement par glisser).
G.render = (function () {
  const TS = 48; // taille d'une case en unités monde
  let canvas, ctx, dpr = 1, cw = 0, ch = 0;
  const cam = { z: 1, ox: 0, oy: 0 };
  let terrainCache = null, terrainKey = '';
  const puffs = [];
  const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

  function init(c) {
    canvas = c;
    ctx = c.getContext('2d');
    resize();
    fit();
    // Recentre la carte quand la zone d'affichage change de taille.
    new ResizeObserver(() => {
      const oldW = cw, oldH = ch;
      resize();
      cam.ox += (cw - oldW) / 2;
      cam.oy += (ch - oldH) / 2;
    }).observe(canvas.parentElement);
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const r = canvas.parentElement.getBoundingClientRect();
    cw = r.width; ch = r.height;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  }

  // Cadre la vue sur le cœur de la carte (territoire de départ + marge) au lancement.
  function fit() {
    const view = (G.map.START_RADIUS * 2 + 5) * TS;
    cam.z = G.util.clamp(Math.min(cw, ch) / view, 0.35, 3);
    const cx = (G.map.CX + 0.5) * TS, cy = (G.map.CY + 0.5) * TS;
    cam.ox = cw / 2 - cx * cam.z;
    cam.oy = ch / 2 - cy * cam.z;
  }

  function zoomAt(sx, sy, factor) {
    const nz = G.util.clamp(cam.z * factor, 0.35, 3);
    const f = nz / cam.z;
    cam.ox = sx - (sx - cam.ox) * f;
    cam.oy = sy - (sy - cam.oy) * f;
    cam.z = nz;
  }

  function pan(dx, dy) { cam.ox += dx; cam.oy += dy; }

  function screenToTile(sx, sy) {
    return { x: Math.floor((sx - cam.ox) / (TS * cam.z)), y: Math.floor((sy - cam.oy) / (TS * cam.z)) };
  }

  function hash(x, y, k) {
    let h = (x * 374761393 + y * 668265263 + (k || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // ---------- Couche terrain (cache) ----------
  function buildTerrain() {
    const run = G.run, W = G.map.W, H = G.map.H;
    const off = document.createElement('canvas');
    off.width = W * TS; off.height = H * TS;
    const c = off.getContext('2d');
    c.fillStyle = '#e7ebe0';
    c.fillRect(0, 0, off.width, off.height);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = G.visibleTerrain(run.tiles[y * W + x], run.era);
      const def = G.TERRAIN[t];
      const px = x * TS, py = y * TS;
      c.fillStyle = def.color;
      rr(c, px + 1, py + 1, TS - 2, TS - 2, 7);
      c.fill();
      drawDecor(c, t, x, y, px, py);
    }
    // Voile sur les cases hors territoire.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (run.owned[y * W + x]) continue;
      c.fillStyle = 'rgba(244,242,236,0.55)';
      c.fillRect(x * TS, y * TS, TS, TS);
    }
    // Frontière du territoire.
    c.strokeStyle = 'rgba(70,80,90,0.55)';
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    c.beginPath();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!run.owned[y * W + x]) continue;
      const o = (dx, dy) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < W && ny < H && run.owned[ny * W + nx]; };
      const px = x * TS, py = y * TS;
      if (!o(0, -1)) { c.moveTo(px, py); c.lineTo(px + TS, py); }
      if (!o(0, 1)) { c.moveTo(px, py + TS); c.lineTo(px + TS, py + TS); }
      if (!o(-1, 0)) { c.moveTo(px, py); c.lineTo(px, py + TS); }
      if (!o(1, 0)) { c.moveTo(px + TS, py); c.lineTo(px + TS, py + TS); }
    }
    c.stroke();
    terrainCache = off;
  }

  function drawDecor(c, t, x, y, px, py) {
    const def = G.TERRAIN[t];
    if (t === 'foret') {
      for (let i = 0; i < 3; i++) {
        const tx = px + 10 + hash(x, y, i) * (TS - 20), ty = py + 12 + hash(x, y, i + 9) * (TS - 22);
        c.fillStyle = '#7fae74';
        c.beginPath(); c.arc(tx, ty, 7 + hash(x, y, i + 3) * 3, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#93bf86';
        c.beginPath(); c.arc(tx - 2, ty - 2, 4, 0, Math.PI * 2); c.fill();
      }
    } else if (t === 'colline' || def.ore) {
      c.fillStyle = 'rgba(160,140,110,0.35)';
      c.beginPath(); c.ellipse(px + TS * 0.38, py + TS * 0.62, 13, 8, 0, Math.PI, 0); c.fill();
      c.beginPath(); c.ellipse(px + TS * 0.66, py + TS * 0.7, 10, 6, 0, Math.PI, 0); c.fill();
      if (def.ore) {
        for (let i = 0; i < 4; i++) {
          c.fillStyle = def.ore;
          c.beginPath();
          c.arc(px + 12 + hash(x, y, i) * (TS - 24), py + 12 + hash(x, y, i + 5) * (TS - 26), 3.5, 0, Math.PI * 2);
          c.fill();
        }
      }
    } else if (t === 'fertile') {
      c.fillStyle = 'rgba(110,150,70,0.35)';
      for (let i = 0; i < 6; i++) c.fillRect(px + 8 + hash(x, y, i) * (TS - 16), py + 8 + hash(x, y, i + 7) * (TS - 16), 2, 4);
    } else if (t === 'montagne') {
      c.fillStyle = '#a19a90';
      c.beginPath(); c.moveTo(px + 8, py + TS - 9); c.lineTo(px + TS / 2, py + 9); c.lineTo(px + TS - 8, py + TS - 9); c.closePath(); c.fill();
      c.fillStyle = '#f1efea';
      c.beginPath(); c.moveTo(px + TS / 2 - 6, py + 19); c.lineTo(px + TS / 2, py + 9); c.lineTo(px + TS / 2 + 6, py + 19); c.closePath(); c.fill();
    } else if (t === 'plaine') {
      c.fillStyle = 'rgba(120,160,90,0.18)';
      if (hash(x, y, 1) < 0.5) c.fillRect(px + 8 + hash(x, y, 2) * 30, py + 10 + hash(x, y, 3) * 28, 2, 4);
    }
  }

  // ---------- Image ----------
  function draw(time) {
    if (!G.run) return;
    const run = G.run, W = G.map.W;
    const key = run.seed + ':' + run.era + ':' + (G.terrainVer || 0) + ':' + run.owned.reduce((s, v) => s + (v ? 1 : 0), 0);
    if (key !== terrainKey) { buildTerrain(); terrainKey = key; }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--map-bg') || '#e9ece4';
    ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * cam.ox, dpr * cam.oy);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(terrainCache, 0, 0);

    drawWater(time);
    drawPlacementZones();
    drawAnnexPath(time);
    drawHover();
    drawBuildings(time);
    drawGrid(time);
    drawTransit();
    drawVisuals(time);
    drawPlacement();
    drawRanges();
    drawCombat(time);
    drawPuffs();
    drawWaveArrows(time);
    drawSeason(time);
    drawRelations(time);
    drawLogiView(time);
  }

  // Bâtiments liés au bâtiment sélectionné : même type (or), et en vue « chaîne » fournisseurs (bleu) et clients (orange) reliés par des flèches.
  function drawRelations(time) {
    const sel = G.ui.selected;
    if (!sel || sel.kind !== 'building' || !G.run.buildings.includes(sel.b)) return;
    const R = G.ui.relations(sel.b), chain = G.ui.chainView, pulse = 0.55 + 0.35 * Math.sin(time * 4);
    const ring = (b, col, w, dash) => {
      const n = G.BUILDINGS[b.type].size || 1;
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash(dash || []);
      rr(ctx, b.x * TS + 1, b.y * TS + 1, TS * n - 2, TS * n - 2, 11); ctx.stroke(); ctx.setLineDash([]);
    };
    const mark = (b) => { const n = G.BUILDINGS[b.type].size || 1; ctx.font = Math.round(TS * 0.46 * n) + 'px ' + EMOJI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(G.BUILDINGS[b.type].icon, (b.x + n / 2) * TS, (b.y + n / 2) * TS + 1); };
    const arrow = (a, b, col) => {
      const x1 = (a.x + 0.5) * TS, y1 = (a.y + 0.5) * TS, x2 = (b.x + 0.5) * TS, y2 = (b.y + 0.5) * TS, ang = Math.atan2(y2 - y1, x2 - x1);
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const mx = x1 + (x2 - x1) * 0.6, my = y1 + (y2 - y1) * 0.6;
      ctx.beginPath(); ctx.moveTo(mx + Math.cos(ang) * 9, my + Math.sin(ang) * 9); ctx.lineTo(mx + Math.cos(ang + 2.5) * 9, my + Math.sin(ang + 2.5) * 9); ctx.lineTo(mx + Math.cos(ang - 2.5) * 9, my + Math.sin(ang - 2.5) * 9); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    };
    if (chain) {
      ctx.fillStyle = 'rgba(250,249,245,0.5)'; ctx.fillRect(0, 0, G.map.W * TS, G.map.H * TS);
      R.sup.forEach(x => arrow(x.b, sel.b, '#3d8fd4'));
      R.cli.forEach(x => arrow(sel.b, x.b, '#e58a1f'));
      R.sup.forEach(x => { mark(x.b); ring(x.b, '#3d8fd4', 4); });
      R.cli.forEach(x => { mark(x.b); ring(x.b, '#e58a1f', 4); });
      mark(sel.b);
    }
    ctx.globalAlpha = pulse;
    R.same.forEach(b => { if (chain) mark(b); ring(b, '#d4a017', 3.5, [7, 4]); });
    ctx.globalAlpha = 1;
  }

  // Vue logistique : carte voilée, liaisons tracées selon le trafic récent, état des bâtiments.
  function drawLogiView(time) {
    if (!G.ui.logiView) return;
    const W = G.map.W * TS, H = G.map.H * TS;
    ctx.fillStyle = 'rgba(250,249,245,0.55)';
    ctx.fillRect(0, 0, W, H);
    const map = {};
    G.run.buildings.forEach(b => (map[b.bid] = b));
    ctx.lineCap = 'round';
    // Les 250 liaisons les plus actives : au-delà, la carte devient illisible.
    const links = Object.values(G.flowAgg || {}).filter(e => e.q >= 0.5).sort((p, q) => q.q - p.q).slice(0, 250);
    for (const e of links) {
      const a = map[e.a], b = map[e.b];
      if (!a || !b) continue;
      ctx.strokeStyle = G.RESOURCES[e.r].color;
      ctx.globalAlpha = Math.min(0.9, 0.25 + e.q / 40);
      ctx.lineWidth = Math.min(9, 1.2 + Math.sqrt(e.q) * 0.9);
      ctx.beginPath(); ctx.moveTo((a.x + 0.5) * TS, (a.y + 0.5) * TS); ctx.lineTo((b.x + 0.5) * TS, (b.y + 0.5) * TS); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const b of G.run.buildings) {
      const d = G.BUILDINGS[b.type];
      if (d.road || b.ruined) continue;
      const bad = b._waiting || b._slow || b._missing, warn = b._full || (G.logistics.srcStock(b) && b._free <= 0);
      ctx.strokeStyle = bad ? '#d06b5d' : warn ? '#e0a23f' : '#5fa77a';
      ctx.lineWidth = bad || warn ? 3 : 1.5;
      if (warn && !bad) ctx.setLineDash([5, 4]);
      rr(ctx, b.x * TS + 3, b.y * TS + 3, TS - 6, TS - 6, 10); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = Math.round(TS * 0.4) + 'px ' + EMOJI_FONT;
      ctx.fillText(d.icon, (b.x + 0.5) * TS, (b.y + 0.5) * TS + 1);
    }
  }

  // Hiver : voile bleuté et quelques flocons sur la carte.
  function drawSeason(time) {
    if (G.economy.seasonIndex() !== 3) return;
    const W = G.map.W * TS, H = G.map.H * TS;
    ctx.fillStyle = 'rgba(225,235,250,0.22)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 140; i++) {
      const x = (hash(i, 1) * W + time * 12 * (0.5 + hash(i, 2))) % W;
      const y = (hash(i, 3) * H + time * 30 * (0.6 + hash(i, 4))) % H;
      ctx.beginPath(); ctx.arc(x, y, 1.2 + hash(i, 5) * 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawWater(time) {
    const run = G.run, W = G.map.W;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5;
    for (let y = 0; y < G.map.H; y++) for (let x = 0; x < W; x++) {
      if (run.tiles[y * W + x] !== 'eau' || G.grid[y * W + x]) continue;
      const px = x * TS, py = y * TS;
      for (let i = 0; i < 2; i++) {
        const yy = py + 16 + i * 14 + Math.sin(time * 1.2 + x + i) * 2;
        ctx.beginPath();
        for (let k = 0; k <= 4; k++) {
          const xx = px + 10 + k * 7;
          const yk = yy + Math.sin(time * 2 + k + x * 0.7 + i) * 1.5;
          k ? ctx.lineTo(xx, yk) : ctx.moveTo(xx, yk);
        }
        ctx.stroke();
      }
    }
  }

  function drawHover() {
    const h = G.ui.hover;
    if (!h) return;
    const run = G.run;
    if (h.x < 0 || h.y < 0 || h.x >= G.map.W || h.y >= G.map.H) return;
    const owned = run.owned[h.y * G.map.W + h.x];
    if (!G.ui.placing) {
      ctx.strokeStyle = owned ? 'rgba(60,70,80,0.35)' : (G.logic.canBuyTile(h.x, h.y) ? 'rgba(80,140,100,0.8)' : 'rgba(60,70,80,0.2)');
      ctx.lineWidth = 2;
      rr(ctx, h.x * TS + 2, h.y * TS + 2, TS - 4, TS - 4, 7);
      ctx.stroke();
    }
    const sel = G.ui.selected;
    if (sel && sel.kind === 'tile') {
      ctx.strokeStyle = 'rgba(80,140,100,0.95)';
      ctx.lineWidth = 3;
      rr(ctx, sel.x * TS + 2, sel.y * TS + 2, TS - 4, TS - 4, 7);
      ctx.stroke();
    }
  }

  function drawBuildings(time) {
    const sel = G.ui.selected;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Routes d'abord, sous les bâtiments.
    for (const b of G.run.buildings) if (G.BUILDINGS[b.type].road) drawRoad(b, sel);
    for (const b of G.run.buildings) {
      const d = G.BUILDINGS[b.type];
      if (d.road) continue;
      const big = d.size || 1;
      if (big > 1) { ctx.save(); ctx.translate(b.x * TS * (1 - big), b.y * TS * (1 - big)); ctx.scale(big, big); } // bâtiment 2×2 : dessiné à l'échelle
      const px = b.x * TS, py = b.y * TS;
      const eff = b._eff === undefined ? 1 : b._eff;
      const working = !b.ruined && !b.paused && (eff > 0.05 || d.pop || d.storage || d.wall);
      let pulse = working && (d.out || d.energyOut) ? 1 + Math.sin(time * 2.4 + b.bid) * 0.025 : 1;
      if (b._bumpReq) { b._bumpReq = false; b._bump = time; }
      if (b._bump) { const k = (time - b._bump) / 0.25; if (k < 1) pulse += Math.sin(k * Math.PI) * 0.06; else b._bump = 0; }
      const s = (TS - 8) * pulse, o = (TS - s) / 2;

      // Ombre douce puis corps.
      ctx.fillStyle = 'rgba(40,50,60,0.16)';
      rr(ctx, px + o + 1, py + o + 3, s, s, 10); ctx.fill();
      ctx.fillStyle = b.ruined ? '#b9b4ad' : b.paused ? '#dedbd6' : (G.CAT_COLOR[d.cat] || '#ddd');
      rr(ctx, px + o, py + o, s, s, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      rr(ctx, px + o + 1, py + o + 1, s - 2, s - 2, 9); ctx.stroke();

      if (d.wall) {
        ctx.fillStyle = 'rgba(90,80,70,0.18)';
        for (let i = 0; i < 3; i++) ctx.fillRect(px + o + 5, py + o + 8 + i * 11, s - 10, 3);
      }

      const site = d.wonder && !b.done;
      if (d.wonder && b.done && !b.ruined) {
        ctx.strokeStyle = 'rgba(212,160,23,' + (0.55 + Math.sin(time * 2) * 0.25) + ')'; ctx.lineWidth = 3;
        rr(ctx, px + o - 2, py + o - 2, s + 4, s + 4, 12); ctx.stroke();
      }
      ctx.globalAlpha = b.ruined ? 0.35 : b.paused ? 0.5 : site ? 0.45 : 1;
      ctx.font = Math.round(TS * 0.46) + 'px ' + EMOJI_FONT;
      ctx.fillText(d.icon, px + TS / 2, py + TS / 2 + 1);
      ctx.globalAlpha = 1;
      if (site) {
        const w = d.wonder.cost, pr = b.progress || {};
        const f = Object.keys(w).reduce((a, r) => a + Math.min(1, (pr[r] || 0) / w[r]), 0) / Object.keys(w).length;
        ctx.font = Math.round(TS * 0.3) + 'px ' + EMOJI_FONT;
        ctx.fillText('🏗️', px + TS - 12, py + TS - 12);
        ctx.strokeStyle = '#d4a017'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(px + TS / 2, py + TS / 2, TS * 0.36, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
      }

      if (b.ruined) {
        ctx.strokeStyle = 'rgba(80,60,60,0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px + 12, py + 14); ctx.lineTo(px + 22, py + 26); ctx.lineTo(px + 18, py + 34); ctx.stroke();
      }

      // Barre d'efficacité (bâtiments productifs).
      if (!b.ruined && (d.workers || d.in) && !b.paused) {
        const bw = s - 14;
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        rr(ctx, px + o + 7, py + o + s - 7, bw, 3.5, 2); ctx.fill();
        ctx.fillStyle = eff > 0.95 ? '#5fa77a' : eff > 0.5 ? '#e0b24f' : '#d06b5d';
        rr(ctx, px + o + 7, py + o + s - 7, Math.max(2, bw * Math.min(1, eff)), 3.5, 2); ctx.fill();
      }

      // Badges d'état.
      let badge = null;
      if (b.paused) badge = '⏸';
      else if (d.energyIn && G.power.networks().netOf[b.bid] === undefined) badge = '🔌';
      else if (d.energyOut && b._throttle === 0) badge = '💤';
      else if (b._full) badge = '📦';
      else if (b._missing) badge = G.RESOURCES[b._missing].icon;
      else if (d.consume && b._sat < 0.95) badge = '⚠️';
      if (badge && !b.ruined) {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(px + TS - 9, py + 9, 8, 0, Math.PI * 2); ctx.fill();
        ctx.font = '10px ' + EMOJI_FONT;
        ctx.fillText(badge, px + TS - 9, py + 9.5);
      }
      // Niveau : pastilles dorées en bas à gauche.
      const lvl = b.level || 1;
      if (lvl > 1 && !b.ruined) {
        const lx = px + o + 3, ly = py + o + 3;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        rr(ctx, lx, ly + s - 17, 8 + (lvl - 1) * 6, 10, 5); ctx.fill();
        ctx.fillStyle = '#d4a017';
        for (let i = 0; i < lvl - 1; i++) { ctx.beginPath(); ctx.arc(lx + 7 + i * 6, ly + s - 12, 2.2, 0, Math.PI * 2); ctx.fill(); }
      }

      if (b._boosted) {
        ctx.fillStyle = '#c0504d';
        ctx.beginPath(); ctx.arc(px + 9, py + 9, 3, 0, Math.PI * 2); ctx.fill();
      }

      // Points de vie.
      const max = G.economy.maxHp(b);
      if (!b.ruined && b.hp < max - 0.5) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        rr(ctx, px + 6, py - 3, TS - 12, 5, 2.5); ctx.fill();
        ctx.fillStyle = '#d06b5d';
        rr(ctx, px + 6, py - 3, (TS - 12) * Math.max(0, b.hp / max), 5, 2.5); ctx.fill();
      }

      if (sel && sel.kind === 'building' && sel.b === b) {
        ctx.strokeStyle = '#3d6fb6'; ctx.lineWidth = 3;
        rr(ctx, px + 1, py + 1, TS - 2, TS - 2, 11); ctx.stroke();
      }
      if (big > 1) ctx.restore();
    }
  }

  // Route : pavé central relié aux routes et bâtiments voisins.
  function drawRoad(b, sel) {
    const cx = (b.x + 0.5) * TS, cy = (b.y + 0.5) * TS, w = TS * 0.42;
    ctx.fillStyle = '#d6c7a4';
    const link = (dx, dy) => { const n = G.economy.at(b.x + dx, b.y + dy); return n && !n.ruined; };
    ctx.beginPath(); ctx.arc(cx, cy, w / 2, 0, Math.PI * 2); ctx.fill();
    for (const [dx, dy] of G.economy.DIRS) {
      if (!link(dx, dy)) continue;
      if (dx) ctx.fillRect(dx > 0 ? cx : cx - TS / 2, cy - w / 2, TS / 2, w);
      else ctx.fillRect(cx - w / 2, dy > 0 ? cy : cy - TS / 2, w, TS / 2);
    }
    ctx.fillStyle = 'rgba(150,130,95,0.35)';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx - 6 + i * 6, cy + (i % 2 ? 3 : -3), 1.6, 0, Math.PI * 2); ctx.fill(); }
    if (sel && sel.kind === 'building' && sel.b === b) {
      ctx.strokeStyle = '#3d6fb6'; ctx.lineWidth = 2.5;
      rr(ctx, b.x * TS + 3, b.y * TS + 3, TS - 6, TS - 6, 8); ctx.stroke();
    }
  }

  function drawPlacement() {
    const type = G.ui.placing, h = G.ui.hover;
    if (!type || !h) return;
    const p = G.logic.canPlace(type, h.x, h.y);
    const px = h.x * TS, py = h.y * TS, big = G.BUILDINGS[type].size || 1;
    ctx.save(); ctx.translate(px * (1 - big), py * (1 - big)); ctx.scale(big, big);
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = p.ok ? 'rgba(255,255,255,0.8)' : 'rgba(230,140,130,0.6)';
    rr(ctx, px + 4, py + 4, TS - 8, TS - 8, 10); ctx.fill();
    ctx.font = Math.round(TS * 0.46) + 'px ' + EMOJI_FONT;
    ctx.fillText(G.BUILDINGS[type].icon, px + TS / 2, py + TS / 2 + 1);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = p.ok ? '#5fa77a' : '#d06b5d';
    ctx.lineWidth = 3;
    rr(ctx, px + 2, py + 2, TS - 4, TS - 4, 10); ctx.stroke();
    ctx.restore();

    if (p.ok) {
      const adj = G.economy.adjacency(type, h.x, h.y);
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      for (const part of adj.parts) {
        if (part.x === h.x && part.y === h.y) continue;
        const col = part.v > 0 ? '#3f8f5f' : '#c0504d';
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        rr(ctx, part.x * TS + 5, part.y * TS + 5, TS - 10, TS - 10, 9); ctx.stroke();
      }
      // Somme des bonus par case voisine.
      const byTile = {};
      adj.parts.forEach(pt => { const k = pt.x + ',' + pt.y; byTile[k] = (byTile[k] || 0) + pt.v; });
      for (const k in byTile) {
        const [x, y] = k.split(',').map(Number);
        if (x === h.x && y === h.y) continue; // le bonus de terrain est inclus dans le total
        badge(x * TS + TS / 2, y * TS + TS / 2, byTile[k], '');
      }
      // Total du voisinage au-dessus de la case survolée.
      if (adj.parts.length) badge(h.x * TS + TS / 2, h.y * TS - 4, adj.total, 'Total ');
      if (G.BUILDINGS[type].tower) ring(h.x, h.y, G.BUILDINGS[type].tower.range);
    }
  }

  function badge(tx, ty, v, prefix) {
    const label = prefix + (v >= 0 ? '+' : '') + Math.round(v * 100) + '%';
    const w = ctx.measureText(label).width + 14;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    rr(ctx, tx - w / 2, ty - 9, w, 18, 9); ctx.fill();
    ctx.fillStyle = v >= 0 ? '#3f8f5f' : '#c0504d';
    ctx.fillText(label, tx, ty + 1);
  }

  function ring(x, y, range, blue) {
    ctx.fillStyle = blue ? 'rgba(91,132,196,0.07)' : 'rgba(208,107,93,0.08)';
    ctx.strokeStyle = blue ? 'rgba(91,132,196,0.55)' : 'rgba(208,107,93,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.arc((x + 0.5) * TS, (y + 0.5) * TS, range * TS, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawRanges() {
    const sel = G.ui.selected;
    if (sel && sel.kind === 'building' && G.BUILDINGS[sel.b.type].tower) ring(sel.b.x, sel.b.y, G.defense.towerRange(sel.b));
    if (sel && sel.kind === 'building' && G.BUILDINGS[sel.b.type].squad) { const a = G.defense.squadAnchor(sel.b); ring(a.x - 0.5, a.y - 0.5, a.r, true); }
  }

  function drawCombat(time) {
    const C = G.defense.C;
    for (const e of C.enemies) {
      const bob = e.attacking ? Math.sin(time * 14 + e.phase) * 0.05 : Math.sin(time * 7 + e.phase) * 0.04;
      const x = e.x * TS, y = (e.y + bob) * TS, r = e.r * TS;
      ctx.fillStyle = 'rgba(40,30,30,0.18)';
      ctx.beginPath(); ctx.ellipse(x, e.y * TS + r * 0.9, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = e.flash > 0 ? '#fff' : e.color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(60,30,30,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
      if (e.kind === 'boss') { ctx.font = Math.round(r) + 'px ' + EMOJI_FONT; ctx.fillText('👑', x, y - r - 4); }
      if (e.kind === 'thief' || e.kind === 'sapper') {
        ctx.font = Math.round(r * 1.6) + 'px ' + EMOJI_FONT;
        ctx.fillText(e.kind === 'sapper' ? '🔥' : e.loot && e.loot.length ? '💰' : '🫳', x, y - r - 5);
      }
      if (e.flash > 0) e.flash -= 1 / 60;
      if (e.hp < e.maxHp) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - r, y - r - 7, r * 2, 3);
        ctx.fillStyle = '#d06b5d'; ctx.fillRect(x - r, y - r - 7, r * 2 * Math.max(0, e.hp / e.maxHp), 3);
      }
    }
    // Soldats des casernes : petits ronds bleus casqués, qui sautillent en combattant.
    for (const u of C.units) {
      if (u.dead) continue;
      const bob = u.fighting ? Math.abs(Math.sin(time * 16 + u.phase)) * 0.06 : Math.sin(time * 3 + u.phase) * 0.02;
      const x = u.x * TS, y = (u.y - bob) * TS, r = u.r * TS;
      ctx.fillStyle = 'rgba(30,40,60,0.18)';
      ctx.beginPath(); ctx.ellipse(x, u.y * TS + r * 0.9, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = u.color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#d4a017'; // casque
      ctx.beginPath(); ctx.arc(x, y - r * 0.15, r * 0.62, Math.PI, 0); ctx.fill();
      if (u.fighting && cam.z >= 1.2) { ctx.font = Math.round(r * 1.1) + 'px ' + EMOJI_FONT; ctx.fillText('⚔️', x + r * 1.1, y - r * 0.9); }
      if (u.hp < u.maxHp) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - r, y - r - 6, r * 2, 2.5);
        ctx.fillStyle = '#5fa77a'; ctx.fillRect(x - r, y - r - 6, r * 2 * Math.max(0, u.hp / u.maxHp), 2.5);
      }
    }
    for (const p of C.projectiles) {
      ctx.fillStyle = p.big ? '#5c5470' : '#6d4c41';
      ctx.beginPath(); ctx.arc(p.x * TS, p.y * TS, p.big ? 5 : 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.font = 'bold 13px Inter, system-ui, sans-serif';
    for (const f of C.floaters) {
      ctx.globalAlpha = Math.min(1, f.life / (f.max * 0.4));
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const w = ctx.measureText(f.text).width + 12;
      rr(ctx, f.x * TS - w / 2, f.y * TS - 10, w, 20, 10); ctx.fill();
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x * TS, f.y * TS + 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawWaveArrows(time) {
    const C = G.defense.C;
    if (!C.sides.length) return;
    // Flèches au bord de la zone d'arrivée des ennemis, pointant vers la cité.
    const bx = G.defense.spawnBox();
    const x0 = bx.x0 * TS, y0 = bx.y0 * TS, x1 = bx.x1 * TS, y1 = bx.y1 * TS, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    ctx.fillStyle = 'rgba(208,107,93,' + (0.35 + Math.sin(time * 4) * 0.15) + ')';
    for (const s of C.sides) {
      const pts = s === 0 ? [[mx, y0 + 26], [mx - 16, y0 + 6], [mx + 16, y0 + 6]]
        : s === 1 ? [[x1 - 26, my], [x1 - 6, my - 16], [x1 - 6, my + 16]]
        : s === 2 ? [[mx, y1 - 26], [mx - 16, y1 - 6], [mx + 16, y1 - 6]]
        : [[x0 + 26, my], [x0 + 6, my - 16], [x0 + 6, my + 16]];
      ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.lineTo(...pts[1]); ctx.lineTo(...pts[2]); ctx.closePath(); ctx.fill();
    }
  }

  // gold : montée de niveau (anneau doré).
  function puff(x, y, gold) { puffs.push({ x: x + 0.5, y: y + 0.5, t: 0, gold: !!gold }); }

  function drawPuffs() {
    for (const p of puffs) {
      p.t += 1 / 60;
      const k = p.t / 0.6;
      ctx.strokeStyle = p.gold ? 'rgba(212,160,23,' + (1 - k) + ')' : 'rgba(255,255,255,' + (1 - k) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x * TS, p.y * TS, TS * (0.3 + k * 0.5), 0, Math.PI * 2); ctx.stroke();
    }
    for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].t > 0.6) puffs.splice(i, 1);
  }

  // ---------- Cellules de ressources ----------
  // Les cellules en transit viennent de la logistique (run.transit) : leur position dépend du temps
  // de jeu, donc de la vitesse de jeu et de la distance réelle. Elles vont en ligne droite, à vitesse
  // constante, avec un léger arc pour distinguer les allers croisés.
  function cellPos(ax, ay, bx, by, k, bend) {
    const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1;
    const off = Math.sin(k * Math.PI) * Math.min(0.35, d * 0.06) * bend;
    return { x: (ax + 0.5 + dx * k - (dy / d) * off) * TS, y: (ay + 0.5 + dy * k + (dx / d) * off) * TS };
  }

  function drawCell(x, y, r, a) {
    const def = G.RESOURCES[r];
    const big = cam.z >= 1.7;
    ctx.globalAlpha = a;
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(x, y, big ? 4.6 : 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.1; ctx.stroke();
    if (big) { ctx.font = '6px ' + EMOJI_FONT; ctx.fillText(def.icon, x, y + 0.3); }
  }

  function drawTransit() {
    const list = G.run.transit;
    if (!list || !list.length) return;
    const now = (G.run.lt || 0) + (G.paused ? 0 : Math.min(0.2, G.ecoLag || 0));
    for (const p of list) {
      const q = G.logistics.pos(p, now);
      drawCell(q.x * TS, q.y * TS, p.r, Math.min(1, q.k * 8, (1 - q.k) * 8 + 0.3));
    }
    ctx.globalAlpha = 1;
  }

  // Animation purement visuelle des dépenses (construction, niveaux, recherche…) :
  // quelques cellules partent des stocks prélevés vers le chantier.
  const visuals = [];
  function visual(from, to, r, q) {
    if (visuals.length > 300) return;
    const n = G.util.clamp(Math.round(q / 8), 1, 4);
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(to.x - from.x, to.y - from.y);
      visuals.push({ r, ax: from.x, ay: from.y, bx: to.x, by: to.y, t: -i * 0.12, dur: 0.5 + d * 0.12, to });
    }
  }

  let visClock = 0;
  function drawVisuals(time) {
    const dt = visClock ? Math.min(0.1, time - visClock) : 0;
    visClock = time;
    for (let i = visuals.length - 1; i >= 0; i--) {
      const f = visuals[i];
      f.t += dt;
      if (f.t < 0) continue;
      const k = f.t / f.dur;
      if (k >= 1) { f.to._bumpReq = true; visuals.splice(i, 1); continue; }
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const pos = cellPos(f.ax, f.ay, f.bx, f.by, e, 2.5);
      drawCell(pos.x, pos.y, f.r, Math.min(1, k * 6, (1 - k) * 6));
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Aides au placement ----------
  // Cases où le bâtiment choisi peut être construit : vert dans le territoire, pointillés ambre au-delà.
  // Réseau électrique : un petit éclair jaune sur chaque contact entre bâtiments raccordés.
  function drawGrid(time) {
    const net = G.power.networks();
    if (!net.count) return;
    ctx.fillStyle = 'rgba(240,190,40,' + (0.75 + Math.sin(time * 3) * 0.2) + ')';
    for (const b of G.run.buildings) {
      if (!G.power.isNode(b)) continue;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const n = G.economy.at(b.x + dx, b.y + dy);
        if (!n || net.netOf[n.bid] === undefined || net.netOf[n.bid] !== net.netOf[b.bid]) continue;
        if (G.power.isNode(n) && (dx < 0 || dy < 0)) continue; // nœud-nœud : un seul contact dessiné
        const cx = (b.x + 0.5 + dx * 0.5) * TS, cy = (b.y + 0.5 + dy * 0.5) * TS;
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawPlacementZones() {
    const type = G.ui.placing;
    if (!type) return;
    const run = G.run, W = G.map.W, allowed = G.BUILDINGS[type].terrain, pd = G.BUILDINGS[type];
    if (pd.energyIn || pd.energyOut || pd.relay) {
      ctx.strokeStyle = 'rgba(240,190,40,0.9)'; ctx.lineWidth = 3;
      for (const b of run.buildings) if (G.power.isNode(b)) { rr(ctx, b.x * TS + 2, b.y * TS + 2, TS - 4, TS - 4, 10); ctx.stroke(); }
    }
    for (let y = 0; y < G.map.H; y++) for (let x = 0; x < W; x++) {
      if (G.logic.footprint(type, x, y).some(c => c.x >= W || c.y >= G.map.H || G.grid[c.y * W + c.x] || !allowed.includes(G.economy.terrainAt(c.x, c.y)))) continue;
      const px = x * TS, py = y * TS;
      // Case au contact du réseau : en jaune pour un bâtiment électrique.
      const touches = (pd.energyIn || pd.energyOut || pd.relay) && G.economy.DIRS.some(([dx, dy]) => { const n = G.economy.at(x + dx, y + dy); return n && G.power.isNode(n); });
      if (run.owned[y * W + x] && touches) {
        ctx.fillStyle = 'rgba(240,190,40,0.3)';
        rr(ctx, px + 3, py + 3, TS - 6, TS - 6, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(200,150,20,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
      } else if (run.owned[y * W + x]) {
        ctx.fillStyle = 'rgba(95,167,122,0.26)';
        rr(ctx, px + 3, py + 3, TS - 6, TS - 6, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(63,143,95,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(197,138,29,0.6)'; ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        rr(ctx, px + 5, py + 5, TS - 10, TS - 10, 8); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // Chemin d'annexion vers la case sélectionnée hors du territoire.
  function drawAnnexPath(time) {
    const a = G.ui.annex;
    if (!a || !a.path) return;
    ctx.strokeStyle = 'rgba(63,143,95,' + (0.55 + Math.sin(time * 4) * 0.25) + ')';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    for (const t of a.path) { rr(ctx, t.x * TS + 4, t.y * TS + 4, TS - 8, TS - 8, 8); ctx.stroke(); }
    ctx.setLineDash([]);
  }

  function invalidate() { terrainKey = ''; visuals.length = 0; }

  return { init, resize, fit, zoomAt, pan, screenToTile, draw, puff, visual, invalidate, cam };
})();
