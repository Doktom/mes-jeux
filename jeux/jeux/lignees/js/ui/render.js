// Rendu de la carte sur canvas : terrain (mis en cache), bâtiments, combats, effets.
// Gère aussi la caméra (zoom molette, déplacement par glisser).
// Toutes les couleurs et les parti pris graphiques viennent de la palette du thème actif (G.theme.canvas) :
// « Chronique enluminée » (parchemin, encre) ou « Vapeur 1900 » (laiton, rivets, rails).
G.render = (function () {
  const TS = 48; // taille d'une case en unités monde
  let canvas, ctx, dpr = 1, cw = 0, ch = 0;
  const cam = { z: 1, ox: 0, oy: 0 };
  let terrainCache = null, terrainKey = '';
  const puffs = [];
  const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  const PAD = 60; // marge de l'ombre portée de la carte
  let P = G.theme.canvas;
  let shadowCache = null, deskPattern = null, sprites = {};

  function init(c) {
    canvas = c;
    ctx = c.getContext('2d');
    resize();
    fit();
    restyle();
    // Recentre la carte quand la zone d'affichage change de taille.
    new ResizeObserver(() => {
      const oldW = cw, oldH = ch;
      resize();
      cam.ox += (cw - oldW) / 2;
      cam.oy += (ch - oldH) / 2;
    }).observe(canvas.parentElement);
  }

  // Changement de thème : on oublie tout ce qui a été dessiné avec l'ancienne palette.
  function restyle() {
    P = G.theme.canvas;
    terrainKey = ''; deskPattern = null; shadowCache = null; sprites = {};
    if (document.fonts && document.fonts.load) {
      document.fonts.load('600 14px ' + P.serif);
      document.fonts.load('700 12px ' + P.title);
    }
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

  // ---------- Outils de dessin ----------
  // Éclaircit ou assombrit une couleur #rrggbb (a entre -1 et 1).
  function shade(hex, a) {
    const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * (1 + a))));
    return 'rgb(' + f(n >> 16 & 255) + ',' + f(n >> 8 & 255) + ',' + f(n & 255) + ')';
  }

  // Rectangle aux angles coupés (plaque de gravure ou de laiton).
  function cut(c, x, y, w, h, k) {
    c.beginPath();
    c.moveTo(x + k, y); c.lineTo(x + w - k, y); c.lineTo(x + w, y + k); c.lineTo(x + w, y + h - k);
    c.lineTo(x + w - k, y + h); c.lineTo(x + k, y + h); c.lineTo(x, y + h - k); c.lineTo(x, y + k); c.closePath();
  }

  function starPath(c, x, y, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r;
      i ? c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad) : c.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    c.closePath();
  }

  // Roue dentée : un trou central est ajouté par l'appelant s'il le souhaite.
  function gearPath(c, x, y, r, teeth) {
    c.beginPath();
    const n = teeth * 2;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, rad = i % 2 ? r * 0.74 : r;
      c.lineTo(x + Math.cos(a0) * rad, y + Math.sin(a0) * rad);
      c.lineTo(x + Math.cos(a1 - (a1 - a0) * 0.15) * rad, y + Math.sin(a1 - (a1 - a0) * 0.15) * rad);
    }
    c.closePath();
  }

  function diamond(c, x, y, r) {
    c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.8, y); c.lineTo(x, y + r); c.lineTo(x - r * 0.8, y); c.closePath();
  }

  // Les émojis sont dessinés une fois dans un sprite teinté, puis simplement recopiés.
  function sprite(icon) {
    let sp = sprites[icon];
    if (sp) return sp;
    const size = 72, o = document.createElement('canvas');
    o.width = o.height = size;
    const x = o.getContext('2d');
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = Math.round(size * 0.74) + 'px ' + EMOJI_FONT;
    if ('filter' in x) x.filter = P.iconFilter;
    x.fillText(icon, size / 2, size / 2 + size * 0.04);
    return (sprites[icon] = o);
  }

  function icon(ic, cx, cy, px) { ctx.drawImage(sprite(ic), cx - px / 2, cy - px / 2, px, px); }

  // Trait légèrement tremblé le long d'un bord de case.
  function inkEdge(c, x0, y0, x1, y1, seed) {
    c.beginPath(); c.moveTo(x0, y0);
    const n = 4;
    for (let i = 1; i <= n; i++) {
      const t = i / n, j = (hash(seed, i, 1) - 0.5) * 2.4;
      c.lineTo(x0 + (x1 - x0) * t + (x1 === x0 ? j : 0), y0 + (y1 - y0) * t + (y1 === y0 ? j : 0));
    }
    c.stroke();
  }

  function tree(c, x, y, s, k) {
    c.lineWidth = 1.1; c.strokeStyle = P.treeStroke;
    if (k < 0.5) { // conifère : trois chevrons empilés
      c.fillStyle = P.treeA;
      c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.7, y + s * 0.05); c.lineTo(x - s * 0.7, y + s * 0.05); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x, y - s * 0.4); c.lineTo(x + s * 0.95, y + s * 0.7); c.lineTo(x - s * 0.95, y + s * 0.7); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x, y + s * 0.7); c.lineTo(x, y + s * 1.05); c.stroke();
    } else { // feuillu : couronne ronde sur tronc
      c.fillStyle = P.treeB;
      c.beginPath(); c.moveTo(x, y + s * 1.05); c.lineTo(x, y + s * 0.3); c.stroke();
      c.beginPath(); c.arc(x, y - s * 0.1, s * 0.78, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.arc(x - s * 0.25, y - s * 0.3, s * 0.25, Math.PI, Math.PI * 1.7); c.stroke();
    }
  }

  // Colline hachurée : arc de crête et traits d'ombre.
  function mound(c, x, y, w, h) {
    c.fillStyle = P.moundFill; c.strokeStyle = P.moundStroke; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(x, y, w, h, 0, Math.PI, 0); c.closePath(); c.fill();
    c.beginPath(); c.ellipse(x, y, w, h, 0, Math.PI, 0); c.stroke();
    c.lineWidth = 0.9;
    for (let i = 1; i < w; i += 3) {
      const top = y - h * Math.sqrt(Math.max(0, 1 - (i * i) / (w * w)));
      c.beginPath(); c.moveTo(x + i, top + 1.5); c.lineTo(x + i - 1.2, y); c.stroke();
    }
  }

  function peak(c, x, y, w, h) {
    c.fillStyle = P.peakFill; c.strokeStyle = P.peakStroke; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(x - w, y); c.lineTo(x, y - h); c.lineTo(x + w, y); c.closePath(); c.fill(); c.stroke();
    c.lineWidth = 0.9;
    for (let t = 0.12; t < 0.9; t += 0.13) {
      const px = x + w * t, py = y - h * (1 - t);
      c.beginPath(); c.moveTo(px, py + 1); c.lineTo(px - 3.5, py + 7 + h * 0.18 * t); c.stroke();
    }
    c.strokeStyle = P.peakRidge;
    c.beginPath(); c.moveTo(x - w * 0.35, y - h * 0.65); c.lineTo(x - w * 0.05, y - h * 0.45); c.lineTo(x + w * 0.1, y - h * 0.62); c.stroke();
  }

  function tuft(c, x, y) {
    c.strokeStyle = P.tuft; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2.5, y - 4); c.moveTo(x, y); c.lineTo(x, y - 5.5); c.moveTo(x, y); c.lineTo(x + 2.5, y - 4); c.stroke();
  }

  // Rivet : petit dôme métallique avec un reflet.
  function rivet(c, x, y, r) {
    c.fillStyle = P.plaque.rivet; c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 0.8;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.65)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); c.fill();
  }

  // ---------- Fond : bureau ----------
  // Bureau de bois (veines verticales) ou plaque de fonte rivetée, selon le thème.
  function desk() {
    if (deskPattern) return deskPattern;
    const sz = 256, o = document.createElement('canvas');
    o.width = o.height = sz;
    const c = o.getContext('2d');
    if (P.desk === 'iron') {
      c.fillStyle = '#242120'; c.fillRect(0, 0, sz, sz);
      for (let i = 0; i < 260; i++) { // acier brossé : fins traits horizontaux
        c.fillStyle = hash(i, 5, 1) < 0.5 ? 'rgba(255,235,200,' + (0.015 + hash(i, 5, 2) * 0.03) + ')' : 'rgba(0,0,0,' + (0.05 + hash(i, 5, 3) * 0.08) + ')';
        c.fillRect(hash(i, 5, 4) * sz * 0.2, hash(i, 5, 5) * sz, sz * (0.4 + hash(i, 5, 6) * 0.7), 1);
      }
      c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, sz - 3, sz - 3);
      c.strokeStyle = 'rgba(255,225,170,0.07)'; c.lineWidth = 1; c.strokeRect(4.5, 4.5, sz - 9, sz - 9);
      for (const [x, y] of [[14, 14], [sz - 14, 14], [14, sz - 14], [sz - 14, sz - 14]]) {
        c.fillStyle = '#4a4036'; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1;
        c.beginPath(); c.arc(x, y, 4.2, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,230,180,0.28)'; c.beginPath(); c.arc(x - 1.3, y - 1.3, 1.5, 0, Math.PI * 2); c.fill();
      }
    } else {
      c.fillStyle = '#35261a'; c.fillRect(0, 0, sz, sz);
      for (let i = 0; i < 150; i++) {
        c.fillStyle = hash(i, 3, 3) < 0.5 ? 'rgba(20,10,2,' + (0.05 + hash(i, 3, 4) * 0.09) + ')' : 'rgba(110,75,40,' + (0.04 + hash(i, 3, 5) * 0.07) + ')';
        c.fillRect(hash(i, 3, 1) * sz, 0, 1 + hash(i, 3, 2) * 3.5, sz);
      }
      for (let i = 0; i < 520; i++) { c.fillStyle = 'rgba(0,0,0,0.06)'; c.fillRect(hash(i, 4, 1) * sz, hash(i, 4, 2) * sz, 1, 6 + hash(i, 4, 3) * 16); }
    }
    return (deskPattern = ctx.createPattern(o, 'repeat'));
  }

  // Ombre portée de la carte, calculée une seule fois.
  function buildShadow() {
    const w = G.map.W * TS, h = G.map.H * TS, o = document.createElement('canvas');
    o.width = w + PAD * 2; o.height = h + PAD * 2;
    const c = o.getContext('2d');
    c.shadowColor = 'rgba(0,0,0,0.65)'; c.shadowBlur = 30; c.shadowOffsetX = 7; c.shadowOffsetY = 11;
    c.fillStyle = '#000'; c.fillRect(PAD, PAD, w, h);
    shadowCache = o;
  }

  // ---------- Cadre de la carte ----------
  function mapFrame(c, w, h) { if (P.frame === 'brass') brassFrame(c, w, h); else tickFrame(c, w, h); }

  // Bande graduée en alternance, double filet, fleurons d'angle.
  function tickFrame(c, w, h) {
    const seg = TS / 4;
    c.fillStyle = P.ink;
    for (let i = 0; i * seg < w; i += 2) { c.fillRect(i * seg, 5, seg, 7); c.fillRect(i * seg, h - 12, seg, 7); }
    for (let i = 0; i * seg < h; i += 2) { c.fillRect(5, i * seg, 7, seg); c.fillRect(w - 12, i * seg, 7, seg); }
    c.strokeStyle = P.ink; c.lineWidth = 2.4; c.strokeRect(5, 5, w - 10, h - 10);
    c.lineWidth = 1; c.strokeRect(12, 12, w - 24, h - 24);
    c.fillStyle = P.paper;
    for (const [x, y] of [[0, 0], [w - 24, 0], [0, h - 24], [w - 24, h - 24]]) c.fillRect(x, y, 24, 24);
    c.strokeStyle = P.ink; c.lineWidth = 1.4;
    for (const [x, y] of [[12, 12], [w - 12, 12], [12, h - 12], [w - 12, h - 12]]) {
      c.fillStyle = P.gold; starPath(c, x, y, 8); c.fill(); c.stroke();
      c.beginPath(); c.arc(x, y, 11, 0, Math.PI * 2); c.stroke();
    }
  }

  // Bande de laiton poli : dégradé métallique, rivets réguliers, engrenages aux angles.
  function brassFrame(c, w, h) {
    const bw = 16;
    const band = (x, y, bwid, bhei, vertical) => {
      const g = vertical ? c.createLinearGradient(x, 0, x + bwid, 0) : c.createLinearGradient(0, y, 0, y + bhei);
      g.addColorStop(0, '#6a4e22'); g.addColorStop(0.25, '#e2bf6e'); g.addColorStop(0.55, '#a98234'); g.addColorStop(0.8, '#c9a050'); g.addColorStop(1, '#4e3817');
      c.fillStyle = g; c.fillRect(x, y, bwid, bhei);
    };
    band(0, 0, w, bw, false); band(0, h - bw, w, bw, false);
    band(0, 0, bw, h, true); band(w - bw, 0, bw, h, true);
    c.strokeStyle = '#140f0b'; c.lineWidth = 2.2; c.strokeRect(1, 1, w - 2, h - 2);
    c.lineWidth = 1.6; c.strokeRect(bw, bw, w - bw * 2, h - bw * 2);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(bw, bw, w - bw * 2, 3); c.fillRect(bw, bw, 3, h - bw * 2); // ombre intérieure
    const step = TS / 2;
    for (let x = 34; x < w - 30; x += step) { rivet(c, x, bw / 2, 2.4); rivet(c, x, h - bw / 2, 2.4); }
    for (let y = 34; y < h - 30; y += step) { rivet(c, bw / 2, y, 2.4); rivet(c, w - bw / 2, y, 2.4); }
    for (const [x, y] of [[bw, bw], [w - bw, bw], [bw, h - bw], [w - bw, h - bw]]) {
      const g = c.createRadialGradient(x - 3, y - 3, 2, x, y, 18);
      g.addColorStop(0, '#f0d28a'); g.addColorStop(0.6, '#b08a3c'); g.addColorStop(1, '#5e4420');
      c.fillStyle = g; c.strokeStyle = '#140f0b'; c.lineWidth = 1.6;
      gearPath(c, x, y, 17, 10); c.fill(); c.stroke();
      c.fillStyle = '#1d1712'; c.beginPath(); c.arc(x, y, 6.5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = P.gold; c.beginPath(); c.arc(x, y, 2.6, 0, Math.PI * 2); c.fill();
    }
  }

  // Rose des vents (en pixels d'écran), posée en haut à droite de la carte.
  function drawCompass(cx, cy, r) {
    const K = P.compass;
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = K.face; ctx.strokeStyle = K.ring; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r - 5, 0, Math.PI * 2); ctx.stroke();
    const arm = (a, len, w, light) => {
      ctx.save(); ctx.rotate(a);
      ctx.fillStyle = light ? K.light : K.dark; ctx.strokeStyle = K.ring; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(w, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = light ? K.dark : K.light;
      ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(-w, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    };
    for (let i = 0; i < 4; i++) arm(Math.PI / 4 + i * Math.PI / 2, r * 0.55, r * 0.14, i % 2 === 0);
    for (let i = 0; i < 4; i++) arm(i * Math.PI / 2, r * 0.86, r * 0.17, false);
    ctx.fillStyle = K.north; ctx.beginPath(); ctx.moveTo(0, -r * 0.86); ctx.lineTo(r * 0.17, 0); ctx.lineTo(-r * 0.17, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = K.hub; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = 'bold ' + Math.round(r * 0.42) + 'px ' + P.title; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = K.text;
    ctx.fillText('N', 0, -r - r * 0.34);
    ctx.restore();
  }

  // ---------- Couche terrain (cache) ----------
  function buildTerrain() {
    const run = G.run, W = G.map.W, H = G.map.H;
    const off = document.createElement('canvas');
    off.width = W * TS; off.height = H * TS;
    const c = off.getContext('2d');
    const tileAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? null : G.visibleTerrain(run.tiles[y * W + x], run.era);
    c.fillStyle = P.paper;
    c.fillRect(0, 0, off.width, off.height);

    // 1. Lavis : une teinte par type de terrain, légèrement variable d'une case à l'autre.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const def = G.TERRAIN[tileAt(x, y)];
      c.fillStyle = shade(def.color, (hash(x, y, 77) - 0.5) * P.washVar);
      c.fillRect(x * TS, y * TS, TS, TS);
    }

    // 2. Quadrillage de géomètre, très discret.
    c.strokeStyle = P.grid; c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i <= W; i++) { c.moveTo(i * TS + 0.5, 0); c.lineTo(i * TS + 0.5, H * TS); }
    for (let j = 0; j <= H; j++) { c.moveTo(0, j * TS + 0.5); c.lineTo(W * TS, j * TS + 0.5); }
    c.stroke();

    // 3. Littoral : double trait le long de chaque rive.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (tileAt(x, y) !== 'eau') continue;
      const px = x * TS, py = y * TS;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = tileAt(x + dx, y + dy);
        if (n === null || n === 'eau') continue;
        const ex = dx > 0 ? px + TS : px, ey = dy > 0 ? py + TS : py;
        c.strokeStyle = P.shore; c.lineWidth = 1.8;
        if (dx) inkEdge(c, ex, py, ex, py + TS, x * 31 + y);
        else inkEdge(c, px, ey, px + TS, ey, x * 17 + y);
        c.strokeStyle = P.shoreSoft; c.lineWidth = 1;
        if (dx) inkEdge(c, ex - dx * 4, py + 2, ex - dx * 4, py + TS - 2, x * 13 + y);
        else inkEdge(c, px + 2, ey - dy * 4, px + TS - 2, ey - dy * 4, x * 7 + y);
      }
    }

    // 4. Décors dessinés au trait.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) drawDecor(c, tileAt(x, y), x, y, x * TS, y * TS);

    // 5. Terre inconnue : lavis sombre et hachures en dehors du territoire.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (run.owned[y * W + x]) continue;
      const px = x * TS, py = y * TS;
      c.fillStyle = P.unownedFill; c.fillRect(px, py, TS, TS);
      c.strokeStyle = P.unownedHatch; c.lineWidth = 1;
      c.beginPath();
      for (let k = 1; k < 4; k++) { c.moveTo(px + k * 14, py); c.lineTo(px, py + k * 14); c.moveTo(px + TS, py + k * 14 + 6); c.lineTo(px + k * 14 + 6, py + TS); }
      c.stroke();
    }

    // 6. Frontière du territoire : trait en tirets et points.
    c.strokeStyle = P.border; c.lineWidth = 2.4; c.lineCap = 'round';
    c.setLineDash([9, 4, 2, 4]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!run.owned[y * W + x]) continue;
      const o = (dx, dy) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < W && ny < H && run.owned[ny * W + nx]; };
      const px = x * TS, py = y * TS;
      c.beginPath();
      if (!o(0, -1)) { c.moveTo(px, py); c.lineTo(px + TS, py); }
      if (!o(0, 1)) { c.moveTo(px, py + TS); c.lineTo(px + TS, py + TS); }
      if (!o(-1, 0)) { c.moveTo(px, py); c.lineTo(px, py + TS); }
      if (!o(1, 0)) { c.moveTo(px + TS, py); c.lineTo(px + TS, py + TS); }
      c.stroke();
    }
    c.setLineDash([]);

    // 7. Matière : grain, taches, bords assombris, puis cadre.
    for (let i = 0; i < W * H * 16; i++) {
      c.fillStyle = hash(i, 9, 1) < 0.6 ? 'rgba(' + P.grainDark + ',' + (0.03 + hash(i, 9, 2) * 0.06) + ')' : 'rgba(' + P.grainLight + ',' + (0.05 + hash(i, 9, 3) * 0.08) + ')';
      c.fillRect(hash(i, 9, 4) * off.width, hash(i, 9, 5) * off.height, 1 + hash(i, 9, 6) * 1.6, 1);
    }
    for (let i = 0; i < 9; i++) {
      const sx = hash(i, 11, 1) * off.width, sy = hash(i, 11, 2) * off.height, sr = 70 + hash(i, 11, 3) * 150;
      const g = c.createRadialGradient(sx, sy, 0, sx, sy, sr);
      g.addColorStop(0, 'rgba(' + P.stain + ',' + P.stainA + ')'); g.addColorStop(1, 'rgba(' + P.stain + ',0)');
      c.fillStyle = g; c.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    }
    const edge = c.createRadialGradient(off.width / 2, off.height / 2, off.width * 0.36, off.width / 2, off.height / 2, off.width * 0.78);
    edge.addColorStop(0, 'rgba(' + P.edge + ',0)'); edge.addColorStop(1, 'rgba(' + P.edge + ',' + P.edgeA + ')');
    c.fillStyle = edge; c.fillRect(0, 0, off.width, off.height);
    mapFrame(c, off.width, off.height);

    terrainCache = off;
    buildShadow();
  }

  function drawDecor(c, t, x, y, px, py) {
    const def = G.TERRAIN[t];
    if (t === 'foret') {
      for (let i = 0; i < 4; i++) {
        const tx = px + 11 + hash(x, y, i) * (TS - 22), ty = py + 14 + hash(x, y, i + 9) * (TS - 28);
        tree(c, tx, ty, 6.5 + hash(x, y, i + 3) * 2.5, hash(x, y, i + 21));
      }
    } else if (t === 'colline' || def.ore) {
      mound(c, px + TS * 0.36, py + TS * 0.64, 13, 9);
      mound(c, px + TS * 0.7, py + TS * 0.74, 10, 7);
      if (def.ore) {
        for (let i = 0; i < 4; i++) {
          const gx = px + 12 + hash(x, y, i) * (TS - 24), gy = py + 10 + hash(x, y, i + 5) * (TS - 30);
          c.fillStyle = def.ore; c.strokeStyle = P.ink; c.lineWidth = 1;
          diamond(c, gx, gy, def.rare ? 5 : 4); c.fill(); c.stroke();
        }
        if (def.rare) { c.fillStyle = P.gold; c.strokeStyle = P.ink; c.lineWidth = 0.8; starPath(c, px + TS - 9, py + 9, 4.5); c.fill(); c.stroke(); }
      }
    } else if (t === 'fertile') {
      c.strokeStyle = P.furrow; c.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const yy = py + 11 + i * 9 + hash(x, y, i) * 2;
        c.beginPath(); c.moveTo(px + 8, yy); c.quadraticCurveTo(px + TS / 2, yy - 3, px + TS - 8, yy); c.stroke();
      }
      if (hash(x, y, 31) < 0.6) tuft(c, px + 12 + hash(x, y, 32) * 24, py + 22 + hash(x, y, 33) * 8);
    } else if (t === 'montagne') {
      peak(c, px + TS * 0.32, py + TS * 0.8, 12, 20);
      peak(c, px + TS * 0.64, py + TS * 0.88, 15, 29);
    } else if (t === 'plaine') {
      if (hash(x, y, 1) < 0.7) tuft(c, px + 9 + hash(x, y, 2) * 30, py + 16 + hash(x, y, 3) * 24);
      if (hash(x, y, 4) < 0.35) tuft(c, px + 9 + hash(x, y, 5) * 30, py + 16 + hash(x, y, 6) * 24);
    }
  }

  // ---------- Image ----------
  function draw(time) {
    if (!G.run) return;
    const run = G.run, W = G.map.W;
    const key = run.seed + ':' + run.era + ':' + (G.terrainVer || 0) + ':' + run.owned.reduce((s, v) => s + (v ? 1 : 0), 0);
    if (key !== terrainKey || !shadowCache) { buildTerrain(); terrainKey = key; }

    // Bureau, puis carte posée dessus avec son ombre.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = desk();
    ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * cam.ox, dpr * cam.oy);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(shadowCache, -PAD, -PAD);
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
    drawLogiView(time);

    // Par-dessus tout, en pixels d'écran : vignette et rose des vents.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const m = Math.min(cw, ch), vg = ctx.createRadialGradient(cw / 2, ch / 2, m * 0.38, cw / 2, ch / 2, Math.max(cw, ch) * 0.72);
    vg.addColorStop(0, 'rgba(' + P.vignette + ',0)'); vg.addColorStop(1, 'rgba(' + P.vignette + ',' + P.vignetteA + ')');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, cw, ch);
    drawCompass(cw - 54, 56, 34);
  }

  // Vue logistique : carte voilée, liaisons tracées selon le trafic récent, état des bâtiments.
  function drawLogiView(time) {
    if (!G.ui.logiView) return;
    const W = G.map.W * TS, H = G.map.H * TS, L = P.logi;
    ctx.fillStyle = L.veil;
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
      ctx.globalAlpha = Math.min(0.9, 0.3 + e.q / 40);
      ctx.lineWidth = Math.min(9, 1.4 + Math.sqrt(e.q) * 0.9);
      ctx.beginPath(); ctx.moveTo((a.x + 0.5) * TS, (a.y + 0.5) * TS); ctx.lineTo((b.x + 0.5) * TS, (b.y + 0.5) * TS); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const b of G.run.buildings) {
      const d = G.BUILDINGS[b.type];
      if (d.road || b.ruined) continue;
      const bad = b._waiting || b._slow || b._missing, warn = b._full || (G.logistics.srcStock(b) && b._free <= 0);
      ctx.strokeStyle = bad ? L.bad : warn ? L.warn : L.ok;
      ctx.lineWidth = bad || warn ? 3 : 1.6;
      if (warn && !bad) ctx.setLineDash([5, 4]);
      cut(ctx, b.x * TS + 3, b.y * TS + 3, TS - 6, TS - 6, 5); ctx.stroke();
      ctx.setLineDash([]);
      icon(d.icon, (b.x + 0.5) * TS, (b.y + 0.5) * TS + 0.5, TS * 0.5);
    }
  }

  // Hiver : voile froid et quelques flocons sur la carte.
  function drawSeason(time) {
    if (G.economy.seasonIndex() !== 3) return;
    const W = G.map.W * TS, H = G.map.H * TS, S = P.season;
    ctx.fillStyle = S.veil;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 140; i++) {
      const x = (hash(i, 1) * W + time * 12 * (0.5 + hash(i, 2))) % W;
      const y = (hash(i, 3) * H + time * 30 * (0.6 + hash(i, 4))) % H;
      ctx.fillStyle = S.snowShade;
      ctx.beginPath(); ctx.arc(x + 0.8, y + 1, 1.3 + hash(i, 5) * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = S.snow;
      ctx.beginPath(); ctx.arc(x, y, 1.2 + hash(i, 5) * 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawWater(time) {
    const run = G.run, W = G.map.W;
    ctx.strokeStyle = P.wave;
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    for (let y = 0; y < G.map.H; y++) for (let x = 0; x < W; x++) {
      if (run.tiles[y * W + x] !== 'eau' || G.grid[y * W + x]) continue;
      const px = x * TS, py = y * TS;
      for (let i = 0; i < 2; i++) {
        const yy = py + 16 + i * 14 + Math.sin(time * 1.2 + x + i) * 2;
        ctx.beginPath();
        for (let k = 0; k <= 4; k++) {
          const xx = px + 10 + k * 7;
          const yk = yy + Math.sin(time * 2 + k * 1.4 + x * 0.7 + i) * 2;
          k ? ctx.lineTo(xx, yk) : ctx.moveTo(xx, yk);
        }
        ctx.stroke();
      }
    }
  }

  function drawHover() {
    const h = G.ui.hover;
    if (!h) return;
    const run = G.run, H = P.hover;
    if (h.x < 0 || h.y < 0 || h.x >= G.map.W || h.y >= G.map.H) return;
    const owned = run.owned[h.y * G.map.W + h.x];
    if (!G.ui.placing) {
      ctx.strokeStyle = owned ? H.own : (G.logic.canBuyTile(h.x, h.y) ? H.buy : H.none);
      ctx.lineWidth = 1.8; ctx.setLineDash([5, 3]);
      cut(ctx, h.x * TS + 2, h.y * TS + 2, TS - 4, TS - 4, 4);
      ctx.stroke(); ctx.setLineDash([]);
    }
    const sel = G.ui.selected;
    if (sel && sel.kind === 'tile') {
      ctx.strokeStyle = P.accent; ctx.lineWidth = 2.6;
      cut(ctx, sel.x * TS + 2, sel.y * TS + 2, TS - 4, TS - 4, 4);
      ctx.stroke();
    }
  }

  // ---------- Bâtiments ----------
  // Plaque d'un bâtiment : ombre dure, corps teinté, reflet, contour, filet intérieur, rivets éventuels.
  function drawPlaque(x0, y0, s, base) {
    const q = P.plaque, k = q.k;
    ctx.fillStyle = q.shadow; cut(ctx, x0 + 2.5, y0 + 3, s, s, k); ctx.fill();
    cut(ctx, x0, y0, s, s, k); ctx.fillStyle = base; ctx.fill();
    const gl = ctx.createLinearGradient(0, y0, 0, y0 + s);
    gl.addColorStop(0, q.glossTop); gl.addColorStop(0.55, q.glossMid); gl.addColorStop(1, q.glossBot);
    cut(ctx, x0, y0, s, s, k); ctx.fillStyle = gl; ctx.fill();
    ctx.strokeStyle = q.outline; ctx.lineWidth = q.outlineW; cut(ctx, x0, y0, s, s, k); ctx.stroke();
    ctx.strokeStyle = q.rim; ctx.lineWidth = q.rimW; cut(ctx, x0 + q.rimInset, y0 + q.rimInset, s - q.rimInset * 2, s - q.rimInset * 2, Math.max(2, k - 2)); ctx.stroke();
    if (q.rivets) for (const [rx, ry] of [[x0 + 6, y0 + 6], [x0 + s - 6, y0 + 6], [x0 + 6, y0 + s - 6], [x0 + s - 6, y0 + s - 6]]) rivet(ctx, rx, ry, 1.6);
  }

  function drawBuildings(time) {
    const sel = G.ui.selected, q = P.plaque, lb = P.label, gg = P.gauge;
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
      let pulse = working && (d.out || d.energyOut) ? 1 + Math.sin(time * 2.4 + b.bid) * 0.02 : 1;
      if (b._bumpReq) { b._bumpReq = false; b._bump = time; }
      if (b._bump) { const k = (time - b._bump) / 0.25; if (k < 1) pulse += Math.sin(k * Math.PI) * 0.06; else b._bump = 0; }
      const s = (TS - 8) * pulse, o = (TS - s) / 2, x0 = px + o, y0 = py + o;

      drawPlaque(x0, y0, s, b.ruined ? P.ruined : b.paused ? P.paused : (G.CAT_COLOR[d.cat] || '#ddd'));

      if (d.wall) {
        ctx.strokeStyle = P.wall; ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x0 + 5, y0 + 10 + i * 10); ctx.lineTo(x0 + s - 5, y0 + 10 + i * 10); ctx.stroke(); }
      }

      const site = d.wonder && !b.done;
      if (d.wonder && b.done && !b.ruined) {
        ctx.strokeStyle = 'rgba(' + P.puff.gold + ',' + (0.6 + Math.sin(time * 2) * 0.25) + ')'; ctx.lineWidth = 3;
        cut(ctx, x0 - 3, y0 - 3, s + 6, s + 6, 7); ctx.stroke();
      }
      ctx.globalAlpha = b.ruined ? 0.35 : b.paused ? 0.5 : site ? 0.45 : 1;
      icon(d.icon, px + TS / 2, py + TS / 2 + 0.5, TS * 0.54);
      ctx.globalAlpha = 1;
      if (site) {
        const w = d.wonder.cost, pr = b.progress || {};
        const f = Object.keys(w).reduce((a, r) => a + Math.min(1, (pr[r] || 0) / w[r]), 0) / Object.keys(w).length;
        icon('🏗️', px + TS - 12, py + TS - 12, 14);
        ctx.strokeStyle = P.gold; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(px + TS / 2, py + TS / 2, TS * 0.36, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.stroke();
      }

      if (b.ruined) { // fissures
        ctx.strokeStyle = P.crack; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x0 + 8, y0 + 6); ctx.lineTo(x0 + 17, y0 + 18); ctx.lineTo(x0 + 12, y0 + 26); ctx.lineTo(x0 + 22, y0 + s - 6);
        ctx.moveTo(x0 + s - 8, y0 + 8); ctx.lineTo(x0 + s - 16, y0 + 20); ctx.stroke();
      }

      // Jauge d'efficacité.
      if (!b.ruined && (d.workers || d.in) && !b.paused) {
        const bw = s - 14;
        ctx.fillStyle = gg.track; ctx.fillRect(px + o + 7, py + o + s - 8, bw, 4);
        ctx.fillStyle = eff > 0.95 ? gg.good : eff > 0.5 ? gg.mid : gg.bad;
        ctx.fillRect(px + o + 7, py + o + s - 8, Math.max(2, bw * Math.min(1, eff)), 4);
        ctx.strokeStyle = gg.outline; ctx.lineWidth = 0.8; ctx.strokeRect(px + o + 7, py + o + s - 8, bw, 4);
      }

      // Badges d'état : médaillon.
      let badge = null;
      if (b.paused) badge = '⏸';
      else if (d.energyIn && G.power.networks().netOf[b.bid] === undefined) badge = '🔌';
      else if (d.energyOut && b._throttle === 0) badge = '💤';
      else if (b._full) badge = '📦';
      else if (b._missing) badge = G.RESOURCES[b._missing].icon;
      else if (d.consume && b._sat < 0.95) badge = '⚠️';
      if (badge && !b.ruined) {
        ctx.fillStyle = lb.fill; ctx.strokeStyle = lb.stroke; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(px + TS - 9, py + 9, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        icon(badge, px + TS - 9, py + 9.5, 11);
      }

      // Niveau : étoiles d'or ou petits engrenages (au-delà de 4, un seul signe et un nombre).
      const lvl = b.level || 1;
      if (lvl > 1 && !b.ruined) {
        const n = lvl - 1, ly = py + o + s - 15, lx = px + o + 9;
        ctx.lineWidth = 0.9; ctx.strokeStyle = P.ink; ctx.fillStyle = P.gold;
        const mark = (x, r) => {
          if (P.level === 'cog') { gearPath(ctx, x, ly, r + 0.6, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(x, ly, r * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = P.gold; }
          else { starPath(ctx, x, ly, r); ctx.fill(); ctx.stroke(); }
        };
        if (n <= 4) for (let i = 0; i < n; i++) mark(lx + i * 8, 4);
        else {
          mark(lx, 4.5);
          ctx.font = 'bold 11px ' + P.serif; ctx.fillStyle = lb.text; ctx.textAlign = 'left'; ctx.fillText('×' + n, lx + 6.5, ly + 0.5); ctx.textAlign = 'center';
        }
      }

      if (b._boosted) { // sceau de cire (ou voyant rouge)
        ctx.fillStyle = P.seal; ctx.strokeStyle = P.ink; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(px + 9, py + 9, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,230,210,0.6)'; ctx.beginPath(); ctx.arc(px + 8, py + 8, 1, 0, Math.PI * 2); ctx.fill();
      }

      // Points de vie.
      const max = G.economy.maxHp(b);
      if (!b.ruined && b.hp < max - 0.5) {
        ctx.fillStyle = gg.track; ctx.fillRect(px + 6, py - 3, TS - 12, 5);
        ctx.fillStyle = gg.bad; ctx.fillRect(px + 6, py - 3, (TS - 12) * Math.max(0, b.hp / max), 5);
        ctx.strokeStyle = gg.outline; ctx.lineWidth = 0.8; ctx.strokeRect(px + 6, py - 3, TS - 12, 5);
      }

      if (sel && sel.kind === 'building' && sel.b === b) drawSelection(px, py);
      if (big > 1) ctx.restore();
    }
  }

  // Sélection : double filet (garance et or) ou halo ambré (vapeur).
  function drawSelection(px, py) {
    if (P.select === 'glow') {
      ctx.save();
      ctx.shadowColor = 'rgba(255,196,90,0.9)'; ctx.shadowBlur = 14;
      ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 3; cut(ctx, px + 1, py + 1, TS - 2, TS - 2, 6); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = 'rgba(20,14,8,0.8)'; ctx.lineWidth = 1; cut(ctx, px + 4.5, py + 4.5, TS - 9, TS - 9, 4); ctx.stroke();
    } else {
      ctx.strokeStyle = P.accent; ctx.lineWidth = 3; cut(ctx, px + 1, py + 1, TS - 2, TS - 2, 6); ctx.stroke();
      ctx.strokeStyle = P.gold; ctx.lineWidth = 1; cut(ctx, px + 4, py + 4, TS - 8, TS - 8, 4); ctx.stroke();
    }
  }

  // Route : chemin en pointillés (carte ancienne) ou voie ferrée (vapeur).
  function drawRoad(b, sel) {
    const cx = (b.x + 0.5) * TS, cy = (b.y + 0.5) * TS, R = P.road;
    const link = (dx, dy) => { const n = G.economy.at(b.x + dx, b.y + dy); return n && !n.ruined; };
    ctx.lineCap = 'round';
    if (R.kind === 'rail') {
      for (const [dx, dy] of G.economy.DIRS) {
        if (!link(dx, dy)) continue;
        const nx = -dy, ny = dx; // normale
        ctx.strokeStyle = R.sleeper; ctx.lineWidth = 2.6;
        for (let t = 4; t < TS / 2 + 2; t += 6) { // traverses
          const x = cx + dx * t, y = cy + dy * t;
          ctx.beginPath(); ctx.moveTo(x - nx * 6, y - ny * 6); ctx.lineTo(x + nx * 6, y + ny * 6); ctx.stroke();
        }
        ctx.strokeStyle = R.rail; ctx.lineWidth = 1.6; // rails
        for (const side of [-3.2, 3.2]) { ctx.beginPath(); ctx.moveTo(cx + nx * side, cy + ny * side); ctx.lineTo(cx + dx * TS / 2 + nx * side, cy + dy * TS / 2 + ny * side); ctx.stroke(); }
      }
      ctx.fillStyle = R.hub; ctx.strokeStyle = R.hubStroke; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(cx, cy, 1.8, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = R.line; ctx.lineWidth = 2.4;
      ctx.setLineDash([5, 4]);
      for (const [dx, dy] of G.economy.DIRS) {
        if (!link(dx, dy)) continue;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx * TS / 2, cy + dy * TS / 2); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = R.hub; ctx.strokeStyle = R.hubStroke; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (sel && sel.kind === 'building' && sel.b === b) {
      ctx.strokeStyle = P.select === 'glow' ? '#ffd27a' : P.accent; ctx.lineWidth = 2.5;
      cut(ctx, b.x * TS + 3, b.y * TS + 3, TS - 6, TS - 6, 5); ctx.stroke();
    }
  }

  function drawPlacement() {
    const type = G.ui.placing, h = G.ui.hover, K = P.place;
    if (!type || !h) return;
    const p = G.logic.canPlace(type, h.x, h.y);
    const px = h.x * TS, py = h.y * TS, big = G.BUILDINGS[type].size || 1;
    ctx.save(); ctx.translate(px * (1 - big), py * (1 - big)); ctx.scale(big, big);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = p.ok ? K.ghost : K.bad;
    cut(ctx, px + 4, py + 4, TS - 8, TS - 8, 5); ctx.fill();
    icon(G.BUILDINGS[type].icon, px + TS / 2, py + TS / 2 + 0.5, TS * 0.54);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = p.ok ? K.ok : K.no;
    ctx.lineWidth = 2.6;
    cut(ctx, px + 2, py + 2, TS - 4, TS - 4, 6); ctx.stroke();
    ctx.restore();

    if (p.ok) {
      const adj = G.economy.adjacency(type, h.x, h.y);
      ctx.font = 'bold 13px ' + P.serif;
      for (const part of adj.parts) {
        if (part.x === h.x && part.y === h.y) continue;
        ctx.strokeStyle = part.v > 0 ? K.adjGood : K.adjBad; ctx.lineWidth = 2;
        cut(ctx, part.x * TS + 5, part.y * TS + 5, TS - 10, TS - 10, 5); ctx.stroke();
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
    const label = prefix + (v >= 0 ? '+' : '') + Math.round(v * 100) + '%', lb = P.label;
    const w = ctx.measureText(label).width + 14;
    ctx.fillStyle = lb.fill; ctx.strokeStyle = lb.stroke; ctx.lineWidth = 1.2;
    cut(ctx, tx - w / 2, ty - 9, w, 18, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = v >= 0 ? lb.good : lb.bad;
    ctx.fillText(label, tx, ty + 1);
  }

  function ring(x, y, range, blue) {
    const R = blue ? P.ring.squad : P.ring.tower;
    ctx.fillStyle = R[0];
    ctx.strokeStyle = R[1];
    ctx.lineWidth = 1.6;
    ctx.setLineDash([7, 4, 2, 4]);
    ctx.beginPath(); ctx.arc((x + 0.5) * TS, (y + 0.5) * TS, range * TS, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawRanges() {
    const sel = G.ui.selected;
    if (sel && sel.kind === 'building' && G.BUILDINGS[sel.b.type].tower) ring(sel.b.x, sel.b.y, G.defense.towerRange(sel.b));
    if (sel && sel.kind === 'building' && G.BUILDINGS[sel.b.type].squad) { const a = G.defense.squadAnchor(sel.b); ring(a.x - 0.5, a.y - 0.5, a.r, true); }
  }

  function drawCombat(time) {
    const C = G.defense.C, lb = P.label, gg = P.gauge;
    for (const e of C.enemies) {
      const bob = e.attacking ? Math.sin(time * 14 + e.phase) * 0.05 : Math.sin(time * 7 + e.phase) * 0.04;
      const x = e.x * TS, y = (e.y + bob) * TS, r = e.r * TS;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(x, e.y * TS + r * 0.9, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = e.flash > 0 ? lb.fill : e.color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6; ctx.stroke();
      // Petit pavois en croix : on lit « ennemi » d'un coup d'œil.
      ctx.strokeStyle = P.enemyCross; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - r * 0.5, y - r * 0.5); ctx.lineTo(x + r * 0.5, y + r * 0.5); ctx.moveTo(x + r * 0.5, y - r * 0.5); ctx.lineTo(x - r * 0.5, y + r * 0.5); ctx.stroke();
      if (e.kind === 'boss') icon('👑', x, y - r - 6, Math.max(14, r * 1.2));
      if (e.kind === 'thief' || e.kind === 'sapper') icon(e.kind === 'sapper' ? '🔥' : e.loot && e.loot.length ? '💰' : '🫳', x, y - r - 7, Math.max(12, r * 1.5));
      if (e.flash > 0) e.flash -= 1 / 60;
      if (e.hp < e.maxHp) {
        ctx.fillStyle = gg.track; ctx.fillRect(x - r, y - r - 8, r * 2, 3.5);
        ctx.fillStyle = gg.bad; ctx.fillRect(x - r, y - r - 8, r * 2 * Math.max(0, e.hp / e.maxHp), 3.5);
        ctx.strokeStyle = gg.outline; ctx.lineWidth = 0.7; ctx.strokeRect(x - r, y - r - 8, r * 2, 3.5);
      }
    }
    // Soldats des casernes : bleus, casque doré, qui sautillent en combattant.
    for (const u of C.units) {
      if (u.dead) continue;
      const bob = u.fighting ? Math.abs(Math.sin(time * 16 + u.phase)) * 0.06 : Math.sin(time * 3 + u.phase) * 0.02;
      const x = u.x * TS, y = (u.y - bob) * TS, r = u.r * TS;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(x, u.y * TS + r * 0.9, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = u.color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = P.helmet; // casque
      ctx.beginPath(); ctx.arc(x, y - r * 0.15, r * 0.62, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 0.8; ctx.stroke();
      if (u.fighting && cam.z >= 1.2) icon('⚔️', x + r * 1.1, y - r * 0.9, Math.max(10, r * 1.4));
      if (u.hp < u.maxHp) {
        ctx.fillStyle = gg.track; ctx.fillRect(x - r, y - r - 6, r * 2, 3);
        ctx.fillStyle = gg.good; ctx.fillRect(x - r, y - r - 6, r * 2 * Math.max(0, u.hp / u.maxHp), 3);
        ctx.strokeStyle = gg.outline; ctx.lineWidth = 0.7; ctx.strokeRect(x - r, y - r - 6, r * 2, 3);
      }
    }
    for (const p of C.projectiles) {
      ctx.save();
      if (P.select === 'glow') { ctx.shadowColor = p.big ? 'rgba(255,140,60,0.9)' : 'rgba(255,200,100,0.9)'; ctx.shadowBlur = 8; }
      ctx.fillStyle = p.big ? P.projectileBig : P.projectile;
      ctx.beginPath(); ctx.arc(p.x * TS, p.y * TS, p.big ? 5 : 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = P.projectileRim; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(p.x * TS, p.y * TS, p.big ? 5 : 3, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.font = 'bold 14px ' + P.serif;
    for (const f of C.floaters) {
      ctx.globalAlpha = Math.min(1, f.life / (f.max * 0.4));
      const w = ctx.measureText(f.text).width + 14;
      ctx.fillStyle = lb.fill; ctx.strokeStyle = lb.stroke; ctx.lineWidth = 1.1;
      cut(ctx, f.x * TS - w / 2, f.y * TS - 10, w, 20, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = P.select === 'glow' ? lb.text : f.color;
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
    ctx.fillStyle = 'rgba(' + P.waveArrow + ',' + (0.5 + Math.sin(time * 4) * 0.2) + ')'; ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
    for (const s of C.sides) {
      const pts = s === 0 ? [[mx, y0 + 28], [mx - 18, y0 + 6], [mx + 18, y0 + 6]]
        : s === 1 ? [[x1 - 28, my], [x1 - 6, my - 18], [x1 - 6, my + 18]]
        : s === 2 ? [[mx, y1 - 28], [mx - 18, y1 - 6], [mx + 18, y1 - 6]]
        : [[x0 + 28, my], [x0 + 6, my - 18], [x0 + 6, my + 18]];
      ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.lineTo(...pts[1]); ctx.lineTo(...pts[2]); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  // gold : montée de niveau (anneau doré).
  function puff(x, y, gold) { puffs.push({ x: x + 0.5, y: y + 0.5, t: 0, gold: !!gold }); }

  function drawPuffs() {
    const U = P.puff;
    for (const p of puffs) {
      p.t += 1 / 60;
      const k = p.t / 0.6;
      ctx.strokeStyle = 'rgba(' + (p.gold ? U.gold : U.plain) + ',' + (1 - k) + ')';
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.arc(p.x * TS, p.y * TS, TS * (0.3 + k * 0.5), 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(' + U.edge + ',' + (0.5 * (1 - k)) + ')'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.x * TS, p.y * TS, TS * (0.3 + k * 0.5) + 2, 0, Math.PI * 2); ctx.stroke();
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
    ctx.fillStyle = def.color; ctx.strokeStyle = P.ink; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, big ? 5 : 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (big) icon(def.icon, x, y, 8);
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
  // Réseau électrique : un contact (losange, étincelle) sur chaque jonction entre bâtiments raccordés.
  function drawGrid(time) {
    const net = G.power.networks();
    if (!net.count) return;
    for (const b of G.run.buildings) {
      if (!G.power.isNode(b)) continue;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const n = G.economy.at(b.x + dx, b.y + dy);
        if (!n || net.netOf[n.bid] === undefined || net.netOf[n.bid] !== net.netOf[b.bid]) continue;
        if (G.power.isNode(n) && (dx < 0 || dy < 0)) continue; // nœud-nœud : un seul contact dessiné
        const cx = (b.x + 0.5 + dx * 0.5) * TS, cy = (b.y + 0.5 + dy * 0.5) * TS;
        ctx.save();
        if (P.select === 'glow') { ctx.shadowColor = 'rgba(' + P.spark + ',0.95)'; ctx.shadowBlur = 9; }
        ctx.fillStyle = 'rgba(' + P.spark + ',' + (0.8 + Math.sin(time * 3) * 0.2) + ')'; ctx.strokeStyle = P.sparkStroke; ctx.lineWidth = 1;
        diamond(ctx, cx, cy, 5); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Cases où le bâtiment choisi peut être construit : vert dans le territoire, pointillés au-delà.
  function drawPlacementZones() {
    const type = G.ui.placing;
    if (!type) return;
    const run = G.run, W = G.map.W, allowed = G.BUILDINGS[type].terrain, pd = G.BUILDINGS[type], K = P.place;
    if (pd.energyIn || pd.energyOut || pd.relay) {
      ctx.strokeStyle = K.elecRing; ctx.lineWidth = 3;
      for (const b of run.buildings) if (G.power.isNode(b)) { cut(ctx, b.x * TS + 2, b.y * TS + 2, TS - 4, TS - 4, 6); ctx.stroke(); }
    }
    for (let y = 0; y < G.map.H; y++) for (let x = 0; x < W; x++) {
      if (G.logic.footprint(type, x, y).some(c => c.x >= W || c.y >= G.map.H || G.grid[c.y * W + c.x] || !allowed.includes(G.economy.terrainAt(c.x, c.y)))) continue;
      const px = x * TS, py = y * TS;
      // Case au contact du réseau : mise en valeur pour un bâtiment électrique.
      const touches = (pd.energyIn || pd.energyOut || pd.relay) && G.economy.DIRS.some(([dx, dy]) => { const n = G.economy.at(x + dx, y + dy); return n && G.power.isNode(n); });
      if (run.owned[y * W + x] && touches) {
        ctx.fillStyle = K.zoneElec; cut(ctx, px + 3, py + 3, TS - 6, TS - 6, 5); ctx.fill();
        ctx.strokeStyle = K.zoneElecLine; ctx.lineWidth = 1.6; ctx.stroke();
      } else if (run.owned[y * W + x]) {
        ctx.fillStyle = K.zoneOk; cut(ctx, px + 3, py + 3, TS - 6, TS - 6, 5); ctx.fill();
        ctx.strokeStyle = K.zoneOkLine; ctx.lineWidth = 1.6; ctx.stroke();
      } else {
        ctx.strokeStyle = K.zoneFar; ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]); cut(ctx, px + 5, py + 5, TS - 10, TS - 10, 5); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }

  // Chemin d'annexion vers la case sélectionnée hors du territoire.
  function drawAnnexPath(time) {
    const a = G.ui.annex;
    if (!a || !a.path) return;
    ctx.strokeStyle = 'rgba(' + P.place.annex + ',' + (0.6 + Math.sin(time * 4) * 0.25) + ')';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([6, 4]);
    for (const t of a.path) { cut(ctx, t.x * TS + 4, t.y * TS + 4, TS - 8, TS - 8, 5); ctx.stroke(); }
    ctx.setLineDash([]);
  }

  function invalidate() { terrainKey = ''; visuals.length = 0; }

  return { init, resize, fit, zoomAt, pan, screenToTile, draw, puff, visual, invalidate, restyle, cam };
})();
