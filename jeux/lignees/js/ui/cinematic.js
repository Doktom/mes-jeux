// Cinématiques de changement d'ère et de décollage : scènes dessinées en canvas, sans image ni dépendance.
// G.cinematic.play(ère | 'launch', surFin) affiche une scène plein écran (barres de cinéma, titre, citation de Hulotte).
// Un clic, Espace ou Entrée la passe (après un instant) ; surFin est appelé à la fermeture.
G.cinematic = (function () {
  let root = null, canvas = null, c = null, raf = 0, onEnd = null, scene = null, S = null, t0 = 0, W = 0, H = 0, wasPaused = false, textShown = 0, ready = false;
  const TAU = Math.PI * 2;

  // ---------- Outils ----------
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function mix(a, b, k) { const A = rgb(a), B = rgb(b), m = i => Math.round(A[i] + (B[i] - A[i]) * clamp(k, 0, 1)); return 'rgb(' + m(0) + ',' + m(1) + ',' + m(2) + ')'; }
  function sky(top, bottom) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bottom); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  function glow(x, y, r, col, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0)); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  function disc(x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  function stars(t, vis, seed) {
    if (vis <= 0) return;
    const R = rng(seed);
    for (let i = 0; i < 160; i++) {
      const x = R() * W, y = R() * H * 0.7, r = 0.4 + R() * 1.5, tw = 0.5 + 0.5 * Math.sin(t * (1 + R() * 3) + i);
      c.fillStyle = 'rgba(255,255,255,' + (vis * (0.35 + 0.65 * tw)) + ')';
      c.fillRect(x, y, r, r);
    }
  }
  // Collines : bande ondulée de couleur unie.
  function hills(base, amp, freq, phase, col) {
    c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) c.lineTo(x, base + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.3 + phase * 1.7) * amp * 0.4);
    c.lineTo(W, H); c.closePath(); c.fill();
  }
  // Particules (fumée, étincelles) : { x, y, vx, vy, r, gr, life, age, col }.
  function emit(list, p) { p.age = 0; list.push(p); if (list.length > 600) list.shift(); }
  function stepParts(list, dt, draw) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]; p.age += dt;
      if (p.age >= p.life) { list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += (p.gr || 0) * dt;
      draw(p, 1 - p.age / p.life);
    }
  }
  function smokeDraw(p, k) { c.fillStyle = p.col.replace('A', (k * (p.a || 0.5)).toFixed(3)); c.beginPath(); c.arc(p.x, p.y, Math.max(0.5, p.r), 0, TAU); c.fill(); }

  // ---------- Scènes ----------
  // Chaque scène : init(S) prépare l'état, draw(t, dt) dessine ; unités en fractions de W et H.
  const SCENES = {};

  // Antiquité : l'aube sur le fleuve, les pyramides et le temple.
  SCENES[1] = {
    draw(t) {
      const k = ease(t / 5);
      sky(mix('#1b2550', '#5b9bd5', k), mix('#d4694a', '#ffe6a8', k));
      stars(t, 1 - k * 1.4, 11);
      const sx = W * 0.7, sy = H * (0.66 - 0.28 * k);
      glow(sx, sy, H * 0.55, 'rgba(255,214,120,A)', 0.55 * k + 0.25);
      disc(sx, sy, H * 0.075, mix('#ffb15c', '#fff2c4', k));
      hills(H * 0.62, H * 0.02, 0.006, 1, mix('#3b4a6b', '#c9b27a', k));
      // Pyramides
      [[0.18, 0.1, 0.16], [0.3, 0.07, 0.11]].forEach(([x, w, h]) => {
        const bx = W * x, by = H * 0.66, bw = W * w, bh = H * h;
        c.fillStyle = mix('#5b4f6b', '#e0c17e', k); c.beginPath(); c.moveTo(bx - bw, by); c.lineTo(bx, by - bh); c.lineTo(bx + bw, by); c.closePath(); c.fill();
        c.fillStyle = mix('#3c344a', '#b89552', k); c.beginPath(); c.moveTo(bx, by - bh); c.lineTo(bx + bw, by); c.lineTo(bx + bw * 0.15, by); c.closePath(); c.fill();
      });
      // Fleuve
      const wy = H * 0.66;
      c.fillStyle = mix('#243a6b', '#5aa6c8', k); c.fillRect(0, wy, W, H * 0.12);
      c.strokeStyle = 'rgba(255,238,190,' + (0.18 + 0.35 * k) + ')'; c.lineWidth = 2;
      for (let i = 0; i < 14; i++) { const y = wy + 6 + (i * 13) % (H * 0.11), x = ((i * 191 + t * 30 * (1 + (i % 3) * 0.3)) % (W * 0.5)) + sx - W * 0.25; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 40 + (i % 4) * 14, y); c.stroke(); }
      // Terre et temple
      c.fillStyle = mix('#2a3a2a', '#8aa86a', k); c.fillRect(0, H * 0.78, W, H * 0.22);
      hills(H * 0.84, H * 0.015, 0.01, 3, mix('#223022', '#6f8f55', k));
      const tx = W * 0.5, ty = H * 0.8, cw = W * 0.011, ch = H * 0.14, span = W * 0.2;
      c.fillStyle = mix('#4a4260', '#f2e6c4', k);
      c.fillRect(tx - span * 0.62, ty - H * 0.012, span * 1.24, H * 0.012);
      c.fillRect(tx - span * 0.56, ty - H * 0.024, span * 1.12, H * 0.012);
      for (let i = 0; i < 6; i++) { const x = tx - span * 0.5 + i * (span / 5); c.fillRect(x - cw / 2, ty - H * 0.024 - ch, cw, ch); c.fillRect(x - cw * 0.9, ty - H * 0.024 - ch - 3, cw * 1.8, 5); }
      c.fillStyle = mix('#3b3450', '#d9c79c', k); c.beginPath(); c.moveTo(tx - span * 0.6, ty - H * 0.024 - ch - 4); c.lineTo(tx, ty - H * 0.024 - ch - H * 0.075); c.lineTo(tx + span * 0.6, ty - H * 0.024 - ch - 4); c.closePath(); c.fill();
      // Palmiers
      [[0.08, 0.86, 1], [0.93, 0.88, 1.15], [0.2, 0.9, 0.7]].forEach(([px, py, s], j) => {
        const x = W * px, y = H * py, h = H * 0.26 * s, sway = Math.sin(t * 1.3 + j) * 6;
        c.strokeStyle = mix('#1d1a1a', '#5a4630', k); c.lineWidth = 6 * s; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + sway, y - h * 0.5, x + sway * 1.6, y - h); c.stroke();
        c.strokeStyle = mix('#14281a', '#3d7a3a', k); c.lineWidth = 3.4 * s;
        for (let f = 0; f < 7; f++) { const a = -Math.PI / 2 + (f - 3) * 0.42 + Math.sin(t * 1.6 + f + j) * 0.05; c.beginPath(); c.moveTo(x + sway * 1.6, y - h); c.quadraticCurveTo(x + sway * 1.6 + Math.cos(a) * 50 * s, y - h + Math.sin(a) * 30 * s - 10, x + sway * 1.6 + Math.cos(a) * 90 * s, y - h + Math.sin(a) * 50 * s + 36 * s); c.stroke(); }
      });
      // Oiseaux
      c.strokeStyle = 'rgba(40,30,30,' + (0.2 + 0.6 * k) + ')'; c.lineWidth = 2;
      for (let i = 0; i < 7; i++) { const x = ((t * 55 + i * 170) % (W + 160)) - 80, y = H * (0.2 + 0.05 * (i % 3)) + Math.sin(t * 2 + i) * 6, f = Math.sin(t * 9 + i) * 5; c.beginPath(); c.moveTo(x - 9, y - f); c.quadraticCurveTo(x - 3, y - 2, x, y); c.quadraticCurveTo(x + 3, y - 2, x + 9, y - f); c.stroke(); }
    },
  };

  // Moyen Âge : le château au crépuscule.
  SCENES[2] = {
    init() { S.fire = []; S.crows = []; },
    draw(t, dt) {
      const k = ease(t / 6);
      sky(mix('#4b3a78', '#0c1030', k), mix('#f08a4b', '#3a2a5e', k));
      stars(t, k * 0.9, 21);
      const mx = W * 0.2, my = H * (0.5 - 0.1 * ease(t / 8));
      glow(mx, my, H * 0.3, 'rgba(210,225,255,A)', 0.35); disc(mx, my, H * 0.04, '#eef2ff');
      hills(H * 0.58, H * 0.05, 0.004, 2, mix('#5a3d6a', '#1a1a3a', k));
      hills(H * 0.66, H * 0.04, 0.006, 5, mix('#3a2a4a', '#10122a', k));
      // Colline et château
      const cx = W * 0.5, gy = H * 0.7, hw = W * 0.36;
      c.fillStyle = mix('#241a2e', '#07081a', k); c.fillRect(0, gy + H * 0.02, W, H);
      c.beginPath(); c.moveTo(cx - hw, H); c.quadraticCurveTo(cx - hw * 0.5, gy - H * 0.02, cx, gy - H * 0.06); c.quadraticCurveTo(cx + hw * 0.5, gy - H * 0.02, cx + hw, H); c.closePath(); c.fill();
      const col = mix('#1c1426', '#05060f', k), by = gy - H * 0.04;
      c.fillStyle = col;
      c.fillRect(cx - W * 0.14, by - H * 0.17, W * 0.28, H * 0.17); // courtine
      for (let i = 0; i < 9; i++) c.fillRect(cx - W * 0.14 + i * (W * 0.28 / 8.5), by - H * 0.17 - H * 0.016, W * 0.016, H * 0.016);
      c.fillRect(cx - W * 0.045, by - H * 0.36, W * 0.09, H * 0.36); // donjon
      for (let i = 0; i < 5; i++) c.fillRect(cx - W * 0.045 + i * (W * 0.09 / 4.4), by - H * 0.36 - H * 0.018, W * 0.014, H * 0.018);
      [[-0.17, 0.3], [0.17, 0.3], [-0.095, 0.22], [0.095, 0.22]].forEach(([dx, h]) => { // tours + toits coniques
        const x = cx + W * dx, w = W * 0.036;
        c.fillStyle = col; c.fillRect(x - w, by - H * h, w * 2, H * h);
        c.beginPath(); c.moveTo(x - w * 1.3, by - H * h); c.lineTo(x, by - H * h - H * 0.09); c.lineTo(x + w * 1.3, by - H * h); c.closePath(); c.fill();
        c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(x, by - H * h - H * 0.09); c.lineTo(x, by - H * h - H * 0.125); c.stroke();
        const fl = Math.sin(t * 5 + dx * 9) * 5;
        c.fillStyle = '#b3342e'; c.beginPath(); c.moveTo(x, by - H * h - H * 0.125); c.lineTo(x + 22 + fl, by - H * h - H * 0.115 + fl * 0.4); c.lineTo(x, by - H * h - H * 0.1); c.closePath(); c.fill();
      });
      // Fenêtres allumées
      const R = rng(5);
      for (let i = 0; i < 26; i++) {
        const wx = cx - W * 0.2 + R() * W * 0.4, wy = by - H * (0.04 + R() * 0.3), on = k * (0.55 + 0.45 * Math.sin(t * (2 + R() * 4) + i));
        c.fillStyle = 'rgba(255,200,90,' + clamp(on, 0, 1) + ')'; c.fillRect(wx, wy, 4, 7);
      }
      // Torches : étincelles
      if (Math.random() < 0.6) emit(S.fire, { x: cx - W * 0.14, y: by - H * 0.17, vx: (Math.random() - 0.5) * 18, vy: -30 - Math.random() * 30, r: 2.5, gr: -1.5, life: 1.1, col: 'rgba(255,170,60,A)', a: 0.9 });
      if (Math.random() < 0.6) emit(S.fire, { x: cx + W * 0.14, y: by - H * 0.17, vx: (Math.random() - 0.5) * 18, vy: -30 - Math.random() * 30, r: 2.5, gr: -1.5, life: 1.1, col: 'rgba(255,170,60,A)', a: 0.9 });
      stepParts(S.fire, dt, smokeDraw);
      // Brume et corbeaux
      for (let i = 0; i < 3; i++) {
        const fy = gy - H * 0.03 + H * 0.035 * i + Math.sin(t * 0.5 + i) * 6, fg = c.createLinearGradient(0, fy, 0, fy + H * 0.07);
        fg.addColorStop(0, 'rgba(180,170,210,0)'); fg.addColorStop(0.5, 'rgba(180,170,210,' + (0.1 + 0.04 * i) + ')'); fg.addColorStop(1, 'rgba(180,170,210,0)');
        c.fillStyle = fg; c.fillRect(0, fy, W, H * 0.07);
      }
      c.fillStyle = '#05050c';
      for (let i = 0; i < 6; i++) { const x = W - ((t * 70 + i * 190) % (W + 200)) + 40, y = H * (0.18 + 0.06 * (i % 3)) + Math.sin(t * 2 + i) * 8, f = Math.sin(t * 11 + i) * 6; c.beginPath(); c.moveTo(x - 12, y - f); c.quadraticCurveTo(x - 4, y - 5, x, y); c.quadraticCurveTo(x + 4, y - 5, x + 12, y - f); c.quadraticCurveTo(x + 4, y + 1, x, y + 3); c.quadraticCurveTo(x - 4, y + 1, x - 12, y - f); c.fill(); }
    },
  };

  // Ère industrielle : cheminées, fumées et locomotive.
  SCENES[3] = {
    init() { S.smoke = []; S.stacks = []; const R = rng(33); for (let i = 0; i < 7; i++) S.stacks.push({ x: 0.06 + i * 0.14 + R() * 0.04, h: 0.2 + R() * 0.16, w: 0.09 + R() * 0.03 }); },
    draw(t, dt) {
      const k = ease(t / 5);
      sky(mix('#5a4636', '#6b5a47', k), mix('#c98a4f', '#e3a864', k));
      glow(W * 0.78, H * 0.3, H * 0.4, 'rgba(255,140,60,A)', 0.4); disc(W * 0.78, H * 0.3, H * 0.055, 'rgba(220,90,50,0.85)');
      for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(70,52,40,' + (0.18 + 0.05 * i) + ')'; c.beginPath(); c.ellipse(((t * 8 * (1 + i * 0.2) + i * 330) % (W + 400)) - 200, H * (0.1 + 0.07 * i), 230, 28, 0, 0, TAU); c.fill(); }
      hills(H * 0.64, H * 0.02, 0.005, 3, '#3a2c24');
      S.stacks.forEach((s, i) => {
        const x = W * s.x, w = W * s.w, base = H * 0.76, h = H * s.h;
        c.fillStyle = '#2a1f1a'; c.fillRect(x, base - h, w, h);
        for (let z = 0; z < 4; z++) { c.beginPath(); c.moveTo(x + w * z / 4, base - h); c.lineTo(x + w * (z + 0.5) / 4, base - h - H * 0.03); c.lineTo(x + w * (z + 1) / 4, base - h); c.closePath(); c.fill(); }
        const cxx = x + w * 0.78, cw = w * 0.14;
        c.fillStyle = '#1f1612'; c.fillRect(cxx, base - h - H * 0.12, cw, H * 0.12 + h * 0.4);
        c.fillStyle = '#4a2f23'; c.fillRect(cxx - 3, base - h - H * 0.12, cw + 6, 6);
        for (let wz = 0; wz < 5; wz++) { const on = 0.6 + 0.4 * Math.sin(t * 2 + i + wz); c.fillStyle = 'rgba(255,190,80,' + on * 0.9 + ')'; c.fillRect(x + w * 0.08 + wz * w * 0.14, base - h * 0.6, w * 0.07, h * 0.12); }
        if (Math.random() < 0.28) emit(S.smoke, { x: cxx + cw / 2, y: base - h - H * 0.12, vx: 14 + Math.random() * 14, vy: -26 - Math.random() * 14, r: 7, gr: 11, life: 5, col: 'rgba(40,32,28,A)', a: 0.5 });
      });
      stepParts(S.smoke, dt, smokeDraw);
      // Sol, rails, locomotive
      c.fillStyle = '#241a15'; c.fillRect(0, H * 0.76, W, H * 0.24);
      c.fillStyle = '#3a2b22'; c.fillRect(0, H * 0.86, W, H * 0.02);
      c.strokeStyle = '#6b5846'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, H * 0.87); c.lineTo(W, H * 0.87); c.stroke();
      c.lineWidth = 2; for (let x = -((t * 120) % 28); x < W; x += 28) { c.beginPath(); c.moveTo(x, H * 0.865); c.lineTo(x + 10, H * 0.9); c.stroke(); }
      const tx = ((t * 140) % (W + 700)) - 600, ty = H * 0.865;
      c.fillStyle = '#12100e'; c.fillRect(tx, ty - 60, 170, 46); c.fillRect(tx + 120, ty - 92, 50, 78); c.fillRect(tx + 18, ty - 98, 22, 40);
      c.fillStyle = '#7a2d22'; c.fillRect(tx, ty - 22, 170, 8);
      for (let w = 0; w < 4; w++) { const wx = tx + 30 + w * 36; disc(wx, ty - 10, 14, '#0c0a09'); c.strokeStyle = '#8a7a66'; c.lineWidth = 2; c.beginPath(); c.moveTo(wx, ty - 10); c.lineTo(wx + Math.cos(t * 12 + w) * 13, ty - 10 + Math.sin(t * 12 + w) * 13); c.stroke(); }
      for (let wg = 1; wg < 4; wg++) { const wx = tx - wg * 150; c.fillStyle = '#18130f'; c.fillRect(wx, ty - 58, 135, 44); disc(wx + 25, ty - 10, 11, '#0c0a09'); disc(wx + 110, ty - 10, 11, '#0c0a09'); }
      if (Math.random() < 0.7) emit(S.smoke, { x: tx + 29, y: ty - 100, vx: -30 + Math.random() * 10, vy: -34, r: 5, gr: 16, life: 2.4, col: 'rgba(230,220,205,A)', a: 0.65 });
      // Grand engrenage décoratif
      c.save(); c.translate(W * 0.9, H * 1.02); c.rotate(t * 0.25); c.fillStyle = '#1a1411';
      const gr = H * 0.22; c.beginPath(); for (let i = 0; i < 16; i++) { const a = i * TAU / 16; c.lineTo(Math.cos(a - 0.09) * gr, Math.sin(a - 0.09) * gr); c.lineTo(Math.cos(a - 0.06) * (gr + 22), Math.sin(a - 0.06) * (gr + 22)); c.lineTo(Math.cos(a + 0.06) * (gr + 22), Math.sin(a + 0.06) * (gr + 22)); c.lineTo(Math.cos(a + 0.09) * gr, Math.sin(a + 0.09) * gr); } c.closePath(); c.fill(); c.restore();
    },
  };

  // Ère spatiale : le pas de tir sous les étoiles, une planète qui s'allume.
  SCENES[4] = {
    init() { S.exh = []; S.shoots = []; },
    draw(t, dt) {
      sky('#03060f', '#10224f');
      stars(t, 1, 41);
      // Étoiles filantes
      if (Math.random() < 0.015) S.shoots.push({ x: Math.random() * W, y: Math.random() * H * 0.3, a: 0, vx: 520 + Math.random() * 200, vy: 200 + Math.random() * 100 });
      S.shoots = S.shoots.filter(s => { s.a += dt; s.x += s.vx * dt; s.y += s.vy * dt; c.strokeStyle = 'rgba(255,255,255,' + clamp(1 - s.a * 1.4, 0, 1) + ')'; c.lineWidth = 2; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - s.vx * 0.09, s.y - s.vy * 0.09); c.stroke(); return s.a < 0.8; });
      // Planète
      const pr = W * 0.95, pcx = W * 0.5, pcy = H + pr * 0.82;
      glow(pcx, pcy - pr, W * 0.6, 'rgba(90,170,255,A)', 0.35);
      const pg = c.createRadialGradient(pcx, pcy - pr * 0.2, pr * 0.6, pcx, pcy, pr); pg.addColorStop(0, '#0b1a3a'); pg.addColorStop(0.97, '#14306b'); pg.addColorStop(1, '#6fb7ff');
      c.fillStyle = pg; c.beginPath(); c.arc(pcx, pcy, pr, 0, TAU); c.fill();
      const R = rng(9); c.fillStyle = 'rgba(255,214,120,0.9)';
      for (let i = 0; i < 90; i++) { const a = -Math.PI / 2 + (R() - 0.5) * 1.1, rr = pr * (0.82 + R() * 0.17), x = pcx + Math.cos(a) * rr, y = pcy + Math.sin(a) * rr; if (y < H) { c.globalAlpha = (0.4 + 0.6 * Math.sin(t * 1.5 + i)) * ease(t / 3); c.fillRect(x, y, 2, 2); } }
      c.globalAlpha = 1;
      // Satellite
      const sx = ((t * 60) % (W + 200)) - 100, sy = H * 0.16 + Math.sin(t * 0.4) * 10;
      c.fillStyle = '#c9d3e8'; c.fillRect(sx - 6, sy - 4, 12, 8); c.fillStyle = '#4b7ad6'; c.fillRect(sx - 30, sy - 3, 20, 6); c.fillRect(sx + 10, sy - 3, 20, 6);
      // Pas de tir, portique et fusée
      const gx = W * 0.5, gy = H * 0.84, bw = W * 0.02, bh = H * 0.34, lift = t > 5 ? Math.pow((t - 5) * 0.5, 2) * 20 : 0, sh = t > 4 ? Math.sin(t * 60) * Math.min(1.5, (t - 4)) : 0;
      c.fillStyle = '#0a0f1c'; c.fillRect(gx - W * 0.14, gy, W * 0.28, H * 0.2);
      c.fillStyle = '#16213a'; c.fillRect(gx - W * 0.1, gy - 6, W * 0.2, 8);
      c.strokeStyle = '#1b2742'; c.lineWidth = 3; // portique
      c.strokeRect(gx - W * 0.075, gy - bh * 0.95, W * 0.024, bh * 0.95);
      for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(gx - W * 0.075, gy - bh * 0.95 + i * bh * 0.12); c.lineTo(gx - W * 0.051, gy - bh * 0.95 + (i + 1) * bh * 0.12); c.stroke(); }
      const arm = clamp(1 - (t - 3) * 0.5, 0, 1); c.fillStyle = '#243252'; c.fillRect(gx - W * 0.051, gy - bh * 0.7, W * 0.047 * arm + 2, 6);
      const ry = gy - 4 - lift;
      c.save(); c.translate(gx + sh, ry);
      c.fillStyle = '#e6ebf5'; c.fillRect(-bw, -bh * 0.9, bw * 2, bh * 0.9);
      c.fillStyle = '#c93a3a'; c.fillRect(-bw, -bh * 0.9, bw * 2, bh * 0.07); c.fillRect(-bw, -bh * 0.35, bw * 2, bh * 0.05);
      c.fillStyle = '#c93a3a'; c.beginPath(); c.moveTo(-bw, -bh * 0.9); c.quadraticCurveTo(0, -bh * 1.18, bw, -bh * 0.9); c.closePath(); c.fill();
      c.fillStyle = '#a7b0c4'; c.beginPath(); c.moveTo(-bw, -bh * 0.18); c.lineTo(-bw * 2.4, 0); c.lineTo(-bw, 0); c.closePath(); c.fill(); c.beginPath(); c.moveTo(bw, -bh * 0.18); c.lineTo(bw * 2.4, 0); c.lineTo(bw, 0); c.closePath(); c.fill();
      disc(0, -bh * 0.62, bw * 0.5, '#6fb7ff');
      c.restore();
      // Projecteurs et fumée de pré-allumage
      [-1, 1].forEach(s => { const g = c.createLinearGradient(gx + s * W * 0.2, gy, gx + s * W * 0.02, gy - bh); g.addColorStop(0, 'rgba(255,255,230,0.0)'); g.addColorStop(1, 'rgba(255,255,230,0.12)'); c.fillStyle = g; c.beginPath(); c.moveTo(gx + s * W * 0.2, gy); c.lineTo(gx + s * W * 0.02, gy - bh * 1.1); c.lineTo(gx + s * W * 0.07, gy - bh * 1.1); c.closePath(); c.fill(); });
      if (t > 4) { const f = clamp((t - 4) / 2, 0, 1); glow(gx, ry, H * 0.28 * f, 'rgba(255,170,60,A)', 0.7); if (Math.random() < 0.9) emit(S.exh, { x: gx + (Math.random() - 0.5) * 20, y: ry, vx: (Math.random() - 0.5) * 140, vy: 30 + Math.random() * 40, r: 8, gr: 22, life: 3, col: 'rgba(220,225,240,A)', a: 0.55 * f }); }
      stepParts(S.exh, dt, smokeDraw);
    },
  };

  // Décollage : la fusée s'arrache, le ciel noircit, la planète s'incurve.
  SCENES.launch = {
    init() { S.exh = []; S.clouds = []; const R = rng(77); for (let i = 0; i < 9; i++) S.clouds.push({ x: R() * 1, y: R(), s: 0.6 + R() }); },
    draw(t, dt) {
      const alt = Math.pow(Math.max(0, t - 1.2), 2.1) * 55, up = clamp(alt / 3200, 0, 1);
      sky(mix('#4aa3df', '#000208', ease(up * 1.15)), mix('#bfe6ff', '#05102a', ease(up * 1.1)));
      stars(t, ease((up - 0.25) / 0.6), 61);
      // Courbure de la planète à haute altitude
      if (up > 0.45) { const k = ease((up - 0.45) / 0.55), pr = W * 1.6; const pg = c.createRadialGradient(W / 2, H + pr - H * 0.2 * k, pr * 0.9, W / 2, H + pr - H * 0.2 * k, pr * 1.01); pg.addColorStop(0, '#1b4f9a'); pg.addColorStop(0.97, '#3d8fe0'); pg.addColorStop(1, 'rgba(160,220,255,0.9)'); c.fillStyle = pg; c.beginPath(); c.arc(W / 2, H + pr - H * 0.2 * k, pr, 0, TAU); c.fill(); }
      // Nuages qui défilent vers le bas
      const cloudA = 1 - ease(up * 1.6);
      if (cloudA > 0.02) S.clouds.forEach(cl => { const y = ((cl.y * H * 1.4 + alt * (0.6 + cl.s * 0.5)) % (H * 1.4)) - H * 0.2; c.fillStyle = 'rgba(255,255,255,' + 0.55 * cloudA + ')'; c.beginPath(); c.ellipse(cl.x * W, y, 150 * cl.s, 26 * cl.s, 0, 0, TAU); c.ellipse(cl.x * W + 70 * cl.s, y - 14 * cl.s, 90 * cl.s, 24 * cl.s, 0, 0, TAU); c.fill(); });
      // Sol et pas de tir qui s'éloignent
      const gy = H * 0.8 + alt * 0.9;
      if (gy < H + 400) { c.fillStyle = '#1e3a2a'; c.fillRect(0, gy, W, H * 2); c.fillStyle = '#0a0f1c'; c.fillRect(W * 0.36, gy - 4, W * 0.28, 10); c.strokeStyle = '#1b2742'; c.lineWidth = 3; c.strokeRect(W * 0.425, gy - H * 0.3, W * 0.024, H * 0.3); }
      // Fusée
      const rx = W * 0.5 + (t < 3 ? Math.sin(t * 70) * (1.8 - t * 0.4) : 0), ry = H * (0.8 - 0.22 * ease((t - 0.8) / 3)), bw = W * 0.022, bh = H * 0.36;
      // Panache
      const fl = clamp((t - 0.3) / 1, 0, 1), len = H * (0.3 + 0.5 * fl) * (0.85 + Math.random() * 0.3);
      glow(rx, ry + len * 0.3, H * 0.42, 'rgba(255,170,70,A)', 0.55 * fl);
      const fg = c.createLinearGradient(0, ry, 0, ry + len); fg.addColorStop(0, 'rgba(255,255,230,0.98)'); fg.addColorStop(0.35, 'rgba(255,190,70,0.9)'); fg.addColorStop(1, 'rgba(255,80,30,0)');
      c.fillStyle = fg; c.beginPath(); c.moveTo(rx - bw * 0.85, ry); c.quadraticCurveTo(rx, ry + len * 1.05, rx + bw * 0.85, ry); c.closePath(); c.fill();
      for (let i = 0; i < 3; i++) if (fl > 0.2) emit(S.exh, { x: rx + (Math.random() - 0.5) * 14, y: ry + 12, vx: (Math.random() - 0.5) * 90, vy: 140 + Math.random() * 120 + alt * 0.05, r: 9, gr: 26, life: 3.2, col: up > 0.5 ? 'rgba(255,200,140,A)' : 'rgba(235,238,248,A)', a: 0.5 * (1 - up * 0.7) });
      stepParts(S.exh, dt, smokeDraw);
      c.save(); c.translate(rx, ry);
      c.fillStyle = '#eef1f8'; c.fillRect(-bw, -bh, bw * 2, bh); c.fillStyle = '#c93a3a'; c.fillRect(-bw, -bh, bw * 2, bh * 0.07); c.fillRect(-bw, -bh * 0.4, bw * 2, bh * 0.05);
      c.beginPath(); c.moveTo(-bw, -bh); c.quadraticCurveTo(0, -bh * 1.3, bw, -bh); c.closePath(); c.fill();
      c.fillStyle = '#a7b0c4'; c.beginPath(); c.moveTo(-bw, -bh * 0.2); c.lineTo(-bw * 2.5, 6); c.lineTo(-bw, 6); c.closePath(); c.fill(); c.beginPath(); c.moveTo(bw, -bh * 0.2); c.lineTo(bw * 2.5, 6); c.lineTo(bw, 6); c.closePath(); c.fill();
      disc(0, -bh * 0.66, bw * 0.55, '#6fb7ff');
      c.restore();
    },
  };

  // ---------- Pilotage ----------
  function resize() {
    if (!canvas) return;
    const k = Math.min(1, 1500 / window.innerWidth);
    W = canvas.width = Math.round(window.innerWidth * k); H = canvas.height = Math.round(window.innerHeight * k);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - (S.last || now)) / 1000); S.last = now;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    // La scène occupe les 80 % du haut : le bas (dernière ligne étirée) sert de fond aux textes.
    const full = canvas.height; H = Math.round(full * 0.8);
    scene.draw(t, dt);
    c.globalAlpha = 1;
    c.drawImage(canvas, 0, H - 2, 4, 2, 0, H, W, full - H); // couleur du bord gauche, étirée
    H = full;
    // Fondu d'entrée (noir → image).
    if (t < 1.1) { c.fillStyle = 'rgba(0,0,0,' + (1 - t / 1.1) + ')'; c.fillRect(0, 0, W, H); }
    // Apparition progressive des textes.
    const steps = root.querySelectorAll('.l');
    steps.forEach((el, i) => { if (t >= 1.3 + i * 1.5 && !el.classList.contains('on')) el.classList.add('on'); });
    if (t > 1.6 && !ready) { ready = true; root.querySelector('.cine-skip').classList.add('on'); }
    if (t > 6 && root.querySelector('.cine-skip').dataset.done !== '1') { const b = root.querySelector('.cine-skip'); b.textContent = 'Continuer ▸'; b.classList.add('go'); b.dataset.done = '1'; }
  }

  function close() {
    if (!root) return;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    document.removeEventListener('keydown', onKey, true);
    root.classList.add('out');
    const r = root, cb = onEnd;
    root = null; onEnd = null;
    setTimeout(() => r.remove(), 450);
    G.paused = wasPaused;
    if (cb) cb();
  }

  function onKey(e) {
    if (!root || !ready) return;
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  }

  function play(key, done) {
    if (root || !SCENES[key]) { if (done) done(); return; }
    scene = SCENES[key]; S = {}; ready = false; onEnd = done;
    const era = typeof key === 'number' ? G.ERAS[key] : null, info = G.CINE[key] || {};
    root = document.createElement('div');
    root.className = 'cine';
    root.innerHTML = '<canvas></canvas><div class="cine-bar top"></div><div class="cine-bar bottom"></div>' +
      '<div class="cine-text">' + (info.kicker ? '<div class="l kick">' + info.kicker + '</div>' : '') +
      '<h1 class="l">' + (era ? era.name : 'Adieu, planète') + '</h1>' +
      (era ? '<p class="l intro">' + era.intro + '</p>' : '<p class="l intro">Le vaisseau interstellaire quitte la planète. La lignée, elle, continue d\'écrire.</p>') +
      (info.quote ? '<p class="l quote">' + info.quote + '</p>' : '') + '</div>' +
      '<button class="cine-skip">Passer ▸</button>';
    document.body.appendChild(root);
    canvas = root.querySelector('canvas'); c = canvas.getContext('2d');
    resize();
    if (scene.init) scene.init();
    wasPaused = !!G.paused;
    G.paused = true;
    root.querySelector('.cine-skip').addEventListener('click', close);
    root.addEventListener('click', e => { if (ready && e.target.tagName !== 'BUTTON') close(); });
    window.addEventListener('resize', resize);
    document.addEventListener('keydown', onKey, true);
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  }

  return { play, close };
})();
