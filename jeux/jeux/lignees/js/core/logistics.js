// Logistique : les ressources sont stockées physiquement dans les bâtiments et voyagent en
// « cellules » portées par les porteurs du bâtiment expéditeur.
//
// - Producteurs : leur production attend dans leur stock de sortie (b.out).
// - Entrepôts : stockent (b.store), reçoivent les surplus des producteurs et ravitaillent.
// - Forum : sa réserve (b.store) garde les ressources de départ, le butin et les remboursements.
//   Il ravitaille mais ne reçoit pas de livraisons.
// - Consommateurs (ateliers, logements, tours…) : la source disponible la plus proche leur envoie
//   une cellule dès qu'il y a de la place dans leur stock d'entrée (b.inp).
// Chaque expéditeur a un nombre limité de porteurs, occupés pendant tout l'aller-retour :
// plus la distance est grande, plus le débit baisse. Les chaînes courtes sont donc plus efficaces.
//
// Les dépenses (construction, niveaux, réparations, ère, territoire) sont prélevées dans les stocks
// les plus proches du chantier ; leur animation est purement visuelle.
G.logistics = (function () {
  const K = () => G.LOGI;

  // ---------- Caractéristiques ----------
  function isStore(b) { return !b.ruined && (b.type === 'forum' || !!G.BUILDINGS[b.type].storage); }
  function isWarehouse(b) { return !b.ruined && !!G.BUILDINGS[b.type].storage; }

  function storeCap(b) {
    const base = b.type === 'forum' ? K().forumCap : G.BUILDINGS[b.type].storage;
    return base * G.economy.lv(b).store * G.economy.mastery(b.type) * G.ERAS[G.run.era].storageMult * (1 + G.M.storage);
  }

  function carriers(b) {
    return (G.BUILDINGS[b.type].carriers || K().carriers) + K().perLevelCarriers * ((b.level || 1) - 1) + ((G.meta.levels || {}).h_porteurs || 0);
  }

  function carry(b) {
    return (G.BUILDINGS[b.type].carry || K().carry) * (1 + K().perLevelCarry * ((b.level || 1) - 1));
  }

  // Stock dans lequel un bâtiment puise pour expédier (null s'il n'expédie rien).
  function srcStock(b) {
    if (b.ruined) return null;
    if (isStore(b)) return b.store || (b.store = {});
    return G.economy.def(b).out ? (b.out || (b.out = {})) : null;
  }

  function freeCarriers(b, now) {
    const t = b.trips || (b.trips = []);
    for (let i = t.length - 1; i >= 0; i--) if (t[i] <= now) t.splice(i, 1);
    return carriers(b) - t.length;
  }

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function travelTime(d) { return K().load + d / (K().speed * Math.max(0.2, 1 + (G.M.logi || 0))); }

  // ---------- Chemins ----------
  // Champ de coût de déplacement vers un bâtiment (Dijkstra, 8 directions). Un pas coûte 1 (√2 en
  // diagonale) ; sur route, roadFactor (moyenne des deux cases du pas). Les porteurs traversent tout,
  // mais les routes les rendent bien plus rapides. Cache par bâtiment, vidé quand la grille change.
  let fields = {}, fieldVer = -1;
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

  function isRoad(i) { const b = G.grid[i]; return !!(b && !b.ruined && G.BUILDINGS[b.type].road); }

  function field(b) {
    if (fieldVer !== G.gridVer) { fields = {}; fieldVer = G.gridVer; }
    if (fields[b.bid]) return fields[b.bid];
    const W = G.map.W, H = G.map.H, N = W * H, rf = K().roadFactor;
    const f = new Float32Array(N).fill(Infinity), w = new Float32Array(N);
    for (let i = 0; i < N; i++) w[i] = isRoad(i) ? rf : 1;
    // File de priorité : tas binaire sur tableaux typés (coût, case).
    const hd = new Float32Array(N * 8), hi = new Int32Array(N * 8);
    let n = 0;
    const push = (d, i) => {
      let k = n++;
      while (k > 0) { const p = (k - 1) >> 1; if (hd[p] <= d) break; hd[k] = hd[p]; hi[k] = hi[p]; k = p; }
      hd[k] = d; hi[k] = i;
    };
    const start = b.y * W + b.x;
    f[start] = 0; push(0, start);
    while (n > 0) {
      const d = hd[0], i = hi[0];
      const ld = hd[--n], li = hi[n];
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        if (l >= n) break;
        const m = l + 1 < n && hd[l + 1] < hd[l] ? l + 1 : l;
        if (hd[m] >= ld) break;
        hd[k] = hd[m]; hi[k] = hi[m]; k = m;
      }
      hd[k] = ld; hi[k] = li;
      if (d > f[i]) continue;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy, len] of NB) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx, nd = d + len * (w[i] + w[j]) / 2;
        if (nd < f[j]) { f[j] = nd; push(nd, j); }
      }
    }
    fields[b.bid] = f;
    return f;
  }

  // Coût du trajet de a vers b (en « cases équivalentes »).
  function pathCost(a, b) { return field(b)[a.y * G.map.W + a.x]; }

  // Cases traversées de a vers b (descente du champ), avec la part du trajet atteinte à chaque case.
  function pathOf(a, b) {
    const W = G.map.W, f = field(b), target = b.y * W + b.x;
    const path = [a.y * W + a.x], cum = [0];
    let i = path[0], guard = 0;
    while (i !== target && guard++ < 200) {
      const x = i % W, y = (i / W) | 0;
      let best = -1, bv = Infinity;
      for (const [dx, dy] of NB) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= G.map.H) continue;
        const j = ny * W + nx;
        if (f[j] < bv) { bv = f[j]; best = j; }
      }
      if (best < 0 || bv >= f[i]) break;
      path.push(best); cum.push(f[path[0]] - bv);
      i = best;
    }
    const total = f[path[0]] || 1;
    return { path, cum: cum.map(c => Math.round((c / total) * 1000) / 1000) };
  }

  // Position (en cases, centre compris) d'une cellule en transit à l'instant `now`.
  function pos(p, now) {
    const k = Math.min(1, Math.max(0, (now - p.t0) / Math.max(0.01, p.t1 - p.t0)));
    if (!p.path || p.path.length < 2) return { x: p.ax + 0.5 + (p.bx - p.ax) * k, y: p.ay + 0.5 + (p.by - p.ay) * k, k };
    const W = G.map.W, c = p.cum;
    let s = 0;
    while (s < c.length - 2 && c[s + 1] < k) s++;
    const u = c[s + 1] > c[s] ? (k - c[s]) / (c[s + 1] - c[s]) : 1;
    const i0 = p.path[s], i1 = p.path[Math.min(s + 1, p.path.length - 1)];
    const x0 = i0 % W, y0 = (i0 / W) | 0, x1 = i1 % W, y1 = (i1 / W) | 0;
    return { x: x0 + 0.5 + (x1 - x0) * Math.min(1, u), y: y0 + 0.5 + (y1 - y0) * Math.min(1, u), k };
  }

  // Débit maximal d'un expéditeur vers une destination à d cases (unités par seconde).
  function throughput(b, d) { return carriers(b) * carry(b) / (2 * travelTime(d)); }

  function transit() { return G.run.transit || (G.run.transit = []); }

  // ---------- Transport ----------
  function send(src, dst, r, q, kind, now) {
    srcStock(src)[r] -= q;
    const t = travelTime(pathCost(src, dst));
    (src.trips || (src.trips = [])).push(now + 2 * t); // le porteur fait l'aller-retour
    const p = { r, q, kind, src: src.bid, dst: dst.bid, ax: src.x, ay: src.y, bx: dst.x, by: dst.y, t0: now, t1: now + t };
    if (!G.offlineSim) {
      Object.assign(p, pathOf(src, dst)); // tracé pour l'affichage (inutile hors ligne)
      // Trafic récent par liaison, pour la vue logistique.
      const fa = G.flowAgg || (G.flowAgg = {}), key = src.bid + '>' + dst.bid;
      const e = fa[key] || (fa[key] = { a: src.bid, b: dst.bid, r, q: 0 });
      e.q += q; e.r = r;
    }
    transit().push(p);
  }

  function arrive(now) {
    const list = transit();
    if (!list.length) return;
    let map = null;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      if (p.t1 > now) continue;
      list.splice(i, 1);
      if (!map) { map = {}; G.run.buildings.forEach(b => (map[b.bid] = b)); }
      const dst = map[p.dst];
      if (dst && !dst.ruined) {
        const st = G.economy.stock(dst, p.kind === 'store' ? 'store' : 'inp');
        st[p.r] = (st[p.r] || 0) + p.q;
        dst._bumpReq = true;
      } else add(p.r, p.q, { x: p.bx, y: p.by }); // destinataire disparu : déposé au stock le plus proche
    }
  }

  function dispatch(now) {
    const run = G.run, bs = run.buildings;
    // Le trafic récent s'estompe (demi-vie d'environ 30 s).
    if (G.flowAgg) for (const k in G.flowAgg) { const e = G.flowAgg[k]; e.q *= 0.995; if (e.q < 0.05) delete G.flowAgg[k]; }

    // Livraisons déjà en route, par bâtiment et ressource.
    const incoming = {};
    for (const p of transit()) {
      const o = incoming[p.dst] || (incoming[p.dst] = {});
      o[p.r] = (o[p.r] || 0) + p.q;
    }
    const inc = (b, r) => (incoming[b.bid] && incoming[b.bid][r]) || 0;
    const addInc = (b, r, q) => { const o = incoming[b.bid] || (incoming[b.bid] = {}); o[r] = (o[r] || 0) + q; };

    // Sources disponibles par ressource.
    const sources = {};
    for (const b of bs) {
      const st = srcStock(b);
      b._free = st ? freeCarriers(b, now) : 0;
      b._waiting = null; b._slow = null;
      if (!st) continue;
      b._carry = carry(b);
      for (const r in st) if (st[r] > 0.01) (sources[r] || (sources[r] = [])).push(b);
    }

    // 1. Besoins : chaque consommateur est servi par la source libre la plus proche.
    // Une rotation de l'ordre de passage évite qu'un bâtiment soit toujours servi le dernier.
    const pool = bs.filter(b => !b.ruined && !b.paused);
    const n = pool.length;
    const start = n ? (run._rot = ((run._rot || 0) + 1) % n) : 0;
    const consumers = [];
    for (let i = 0; i < n; i++) consumers.push(pool[(start + i) % n]);
    consumers.sort((a, b) => (b.prio === undefined ? 1 : b.prio) - (a.prio === undefined ? 1 : a.prio)); // tri stable
    for (const b of consumers) {
      const nd = G.economy.needs(b);
      for (const r in nd) {
        if (!nd[r]) continue;
        const cap = Math.max(3, nd[r] * K().inBuffer);
        const need = cap - ((b.inp && b.inp[r]) || 0) - inc(b, r);
        if (need < Math.min(1, cap * 0.25)) continue; // on attend la place pour une vraie livraison
        let best = null, bd = Infinity, stocked = false;
        for (const s of sources[r] || []) {
          if (s === b) continue;
          if ((srcStock(s)[r] || 0) < Math.min(s._carry, need) - 1e-6) continue; // cellules pleines uniquement
          stocked = true;
          if (s._free <= 0) continue;
          const d = pathCost(s, b);
          if (d < bd) { bd = d; best = s; }
        }
        if (!best) {
          // En attente : soit personne n'a de stock (_waiting), soit tous les porteurs sont en route (_slow).
          if (((b.inp && b.inp[r]) || 0) < 0.5 && !inc(b, r)) { if (stocked) b._slow = r; else b._waiting = r; }
          continue;
        }
        const q = Math.min(best._carry, need, srcStock(best)[r]);
        send(best, b, r, q, 'in', now);
        best._free--;
        addInc(b, r, q);
      }
    }

    // 2. Surplus : un producteur dont le stock de sortie se remplit l'envoie à l'entrepôt le plus proche.
    const wh = bs.filter(isWarehouse);
    if (wh.length) for (const b of bs) {
      if (b.ruined || isStore(b) || b._free <= 0 || !b.out) continue;
      const d = G.economy.def(b);
      if (!d.out) continue;
      for (const r in d.out) {
        if (G.RESOURCES[r].uncapped) continue;
        const have = b.out[r] || 0;
        if (have < b._carry || have < G.economy.outCap(b, d, r) * K().surplusShare) continue;
        let best = null, bd = Infinity;
        for (const w of wh) {
          if (w.accept && !w.accept.includes(r)) continue;
          const room = storeCap(w) - ((w.store && w.store[r]) || 0) - inc(w, r);
          if (room < b._carry) continue;
          const dd = pathCost(b, w);
          if (dd < bd) { bd = dd; best = w; }
        }
        if (!best) continue;
        send(b, best, r, b._carry, 'store', now);
        b._free--;
        addInc(best, r, b._carry);
        if (b._free <= 0) break;
      }
    }
  }

  // ---------- Totaux ----------
  // run.res = ce qui est disponible dans les réserves et les stocks de sortie (hors transit).
  function recount() {
    const run = G.run, tot = {}, cap = {};
    G.RESOURCE_ORDER.forEach(r => { if (!G.RESOURCES[r].uncapped) { tot[r] = 0; cap[r] = 0; } });
    for (const b of run.buildings) {
      if (b.ruined) continue;
      if (isStore(b)) {
        const c = storeCap(b);
        for (const r in cap) cap[r] += c;
        for (const r in b.store || {}) if (r in tot) tot[r] += b.store[r];
      }
      const d = G.economy.def(b);
      if (d.out) for (const r in d.out) if (r in tot) { tot[r] += (b.out && b.out[r]) || 0; cap[r] += G.economy.outCap(b, d, r); }
    }
    for (const r in tot) run.res[r] = Math.max(0, tot[r]);
    G.capR = cap;
  }

  function capOf(r) { return G.RESOURCES[r].uncapped ? Infinity : ((G.capR && G.capR[r]) || 0); }

  function storeCapTotal() {
    return G.run.buildings.filter(isStore).reduce((s, b) => s + storeCap(b), 0);
  }

  // Ajoute une quantité dans les réserves les plus proches de `near` (forum par défaut).
  function add(r, amount, near) {
    if (!(amount > 0)) return 0;
    if (G.RESOURCES[r].uncapped) { G.run.res[r] += amount; return amount; }
    const p = near || G.run.buildings[0];
    const stores = G.run.buildings.filter(s => isStore(s) && (!s.accept || s.accept.includes(r))).sort((a, b) => dist(a, p) - dist(b, p));
    let left = amount;
    for (const s of stores) {
      const st = G.economy.stock(s, 'store');
      const q = Math.min(Math.max(0, storeCap(s) - (st[r] || 0)), left);
      st[r] = (st[r] || 0) + q;
      left -= q;
      if (left <= 1e-9) break;
    }
    recount();
    return amount - left;
  }

  // Prélève un coût dans les stocks les plus proches du chantier (site : {x, y}).
  function take(cost, site) {
    for (const r in cost) {
      let left = cost[r];
      if (G.RESOURCES[r].uncapped) { G.run.res[r] -= left; continue; }
      const srcs = G.run.buildings.filter(b => { const st = srcStock(b); return st && (st[r] || 0) > 0; })
        .sort((a, b) => dist(a, site) - dist(b, site));
      for (const s of srcs) {
        const st = srcStock(s), q = Math.min(st[r], left);
        st[r] -= q; left -= q;
        if (G.render && !G.offlineSim && q > 0) G.render.visual(s, site, r, q);
        if (left <= 1e-9) break;
      }
    }
    recount();
  }

  // Pillage : toutes les réserves et stocks de sortie perdent une part.
  function scaleAll(f) {
    for (const b of G.run.buildings) for (const st of [b.store, b.out]) if (st) for (const r in st) if (!G.RESOURCES[r].uncapped) st[r] *= f;
    recount();
  }

  // Ancienne sauvegarde (stock commun) : le stock commun devient la réserve du forum.
  function migrate(run) {
    const forum = run.buildings[0];
    if (!forum.store) {
      forum.store = {};
      for (const r in run.res) if (!G.RESOURCES[r].uncapped && run.res[r] > 0) forum.store[r] = run.res[r];
    }
    run.transit = run.transit || [];
    run.lt = run.lt || 0;
  }

  return {
    isStore, isWarehouse, storeCap, carriers, carry, srcStock, freeCarriers, throughput, travelTime, dist, pathCost, pathOf, pos, field,
    arrive, dispatch, recount, capOf, storeCapTotal, add, take, scaleAll, migrate, transit,
  };
})();
