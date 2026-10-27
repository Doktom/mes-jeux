// Interface : HUD, narrateur, toasts, carte de prise, panneaux des PNJ et carnet
(() => {
  const $ = (s) => document.querySelector(s);
  const D = G.D;
  const g = () => G.game;
  const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
  const fmtKg = (w) => (w < 1 ? w.toFixed(2) : w < 100 ? w.toFixed(1) : Math.round(w)) + ' kg';
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const el = {
    money: $('#money'), bucket: $('#bucket-count'), spotName: $('#spot-name'), clock: $('#clock'),
    quest: $('#quest-tracker'), toasts: $('#toasts'), contest: $('#contest'), merchantBtn: $('#btn-merchant'), musicBtn: $('#btn-music'),
    gearRod: $('#gear-rod'), gearDepth: $('#gear-depth'), gearBait: $('#gear-bait'), gearBoat: $('#gear-boat'),
    narrator: $('#narrator'), narratorWho: $('#narrator-who'), narratorText: $('#narrator-text'),
    catchCard: $('#catch'), catchOk: $('#catch-ok'), catchEat: $('#catch-eat'), trip: $('#trip'), lvl: $('#lvl'), buffs: $('#buffs'),
    wrap: $('#panel-wrap'), title: $('#panel-title'), quote: $('#panel-quote'), tabs: $('#panel-tabs'), body: $('#panel-body'),
  };

  // ---------------------------------------------------------------- Confirmation intégrée (les confirm() du navigateur peuvent être bloqués)
  function confirmBox(text, yesLabel, cb) {
    let w = document.querySelector('#confirm-wrap');
    if (!w) {
      w = document.createElement('div'); w.id = 'confirm-wrap';
      w.innerHTML = '<div id="confirm"><p id="confirm-text"></p><div class="row"><button class="btn big" id="confirm-yes"></button><button class="btn ghost" id="confirm-no">Annuler</button></div></div>';
      document.body.appendChild(w);
    }
    w.querySelector('#confirm-text').textContent = text;
    const yes = w.querySelector('#confirm-yes'), no = w.querySelector('#confirm-no');
    yes.textContent = yesLabel || 'Oui';
    const close = () => w.classList.add('hidden');
    yes.onclick = () => { close(); cb(); };
    no.onclick = close;
    w.onpointerdown = (e) => { if (e.target === w) close(); };
    w.classList.remove('hidden');
  }

  // ---------------------------------------------------------------- Narrateur & toasts
  let sayTimer = null;
  function say(text, who = 'Narrateur', dur = 3800) {
    el.narratorWho.textContent = who;
    el.narratorText.textContent = text;
    el.narrator.classList.remove('hidden');
    el.narrator.style.animation = 'none'; void el.narrator.offsetWidth; el.narrator.style.animation = '';
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => el.narrator.classList.add('hidden'), dur);
  }
  function toast(html, icon = '✨', dur = 4500) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span class="ti">${icon}</span><span>${html}</span>`;
    el.toasts.appendChild(t);
    while (el.toasts.children.length > 4) el.toasts.removeChild(el.toasts.firstChild);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, dur);
  }

  // ---------------------------------------------------------------- HUD
  function updateHUD() {
    const G_ = g(); if (!G_) return;
    const S = G_.S;
    el.money.textContent = '🪙 ' + fmt(S.money);
    el.bucket.textContent = `🪣 ${S.bucket.length}/${G_.bucketCap()}`;
    el.bucket.classList.toggle('full', S.bucket.length >= G_.bucketCap());
    el.spotName.textContent = '📍 ' + G_.spot().name;
    el.gearRod.textContent = `🎣 ${G_.rod().name} · ${G_.rod().max} kg`;
    const dp = D.depths[S.depth];
    el.gearDepth.textContent = `${dp.icon} ${dp.label}`;
    const b = G_.bait();
    el.gearBait.textContent = `🪱 ${b.name}${b.cost === 0 ? ' ∞' : ' ×' + (S.baits[b.id] || 0)}`;
    el.gearBoat.classList.toggle('hidden', !S.boats.length);
    const zd = G_.zoneDef(); el.gearBoat.textContent = `${zd.icon} ${zd.name}`;
    el.merchantBtn.classList.toggle('hidden', !G_.merchant());
    el.musicBtn.textContent = S.opts.music ? '🎵' : '🔇';
    const lf = G_.lvlInfo('fish'), lc = G_.lvlInfo('cook');
    el.lvl.innerHTML = `⭐ ${lf.lvl}${lf.pts ? ` <b class="pts">+${lf.pts}</b>` : ''} · 👨‍🍳 ${lc.lvl}${lc.pts ? ` <b class="pts">+${lc.pts}</b>` : ''}`;
    el.lvl.style.setProperty('--p', lf.pct + '%');
    el.lvl.title = `${lf.title} — ${fmt(lf.cur)}/${fmt(lf.need)} XP · Cuisine : ${lc.title}`;
    updateTicker();
  }
  function updateTicker() {
    const G_ = g(); if (!G_) return;
    const S = G_.S, w = D.weathers[S.weather];
    const icon = S.weather === 'clair' && G_.isNight() ? w.nightIcon : w.icon;
    el.clock.textContent = `${G_.isNight() ? '🌙' : '☀️'} ${G_.clockStr()} · ${icon} ${w.name}`;
    const p = G_.questProgress();
    if (!p) { el.quest.innerHTML = '📜 Prophétie accomplie. Tu es la Loutre Suprême.'; el.quest.classList.remove('ready'); }
    else if (p.done) { el.quest.innerHTML = `📜 <b>${p.step.title}</b> : accompli ! <u>Va voir Tonton Gérard</u>`; el.quest.classList.add('ready'); }
    else { el.quest.innerHTML = `📜 <b>${p.step.title}</b> · ${p.step.goal} <span class="qp">${p.cur}/${p.max}</span>`; el.quest.classList.remove('ready'); }
    const fc = G_.forecast();
    if (fc) el.clock.textContent += ` · 🔮 ${D.weathers[fc.w].icon} dans ${G_.fmtTime(fc.t)}`;
    el.buffs.innerHTML = S.buffs.map((b) => `<span class="buff" title="${b.name}"><i style="width:${Math.min(100, b.t / b.max * 100)}%"></i>${b.icon} ${G_.fmtTime(b.t)}</span>`).join('');
    if (panel === 'cuisine') document.querySelectorAll('.cookbar > div').forEach((d) => {
      const st = +d.dataset.start, en = +d.dataset.end, now = Date.now();
      d.style.width = Math.max(0, Math.min(100, (now - st) / (en - st) * 100)) + '%';
      if (d.parentElement.nextElementSibling) d.parentElement.nextElementSibling.textContent = Math.max(0, Math.ceil((en - now) / 1000)) + ' s';
    });
    if (panel === 'gerard' && tab === 'commandes') {
      document.querySelectorAll('.ordtime').forEach((sp) => { const o = S.orders.find((x) => x.id === sp.dataset.oid); if (o) sp.textContent = '⏳ ' + G_.fmtTime(o.t); });
      const rb = document.querySelector('[data-act=refreshOrders]');
      if (rb) { rb.disabled = S.ordersCD > 0; rb.textContent = S.ordersCD > 0 ? `🔄 Actualiser (${Math.ceil(S.ordersCD)} s)` : '🔄 Actualiser'; }
    }
    if (panel === 'ferme') {
      const raining = S.weather === 'pluie' || S.weather === 'orage';
      document.querySelectorAll('.farmbar > div[data-plot]').forEach((d) => {
        const pl = S.farm.plots[+d.dataset.plot]; if (!pl) return;
        const c = D.crops.find((x) => x.id === pl.crop);
        d.style.width = Math.max(0, Math.min(100, pl.growth / c.time * 100)) + '%';
        const t = d.parentElement.nextElementSibling;
        if (t) t.textContent = pl.ready ? 'Prêt à récolter !' : pl.water > 0 ? `💧 ${Math.ceil(pl.water)} s d'eau` : raining ? '🌧️ la pluie arrose' : '🏜️ assoiffé';
      });
    }
    if (G_.contest()) updateContest(G_.contest());
    const tr = G_.trip();
    el.trip.classList.toggle('hidden', !(tr.t > 0));
    if (tr.t > 0) el.trip.textContent = `🌈 Voyage ${tr.lvl}/3 · ${G_.fmtTime(tr.t)}`;
  }
  function updateContest(c) {
    if (!c) { el.contest.classList.add('hidden'); return; }
    el.contest.classList.remove('hidden');
    const s = Math.max(0, Math.ceil(c.t));
    const lead = c.me >= c.br;
    el.contest.innerHTML = `<div class="ct">🏆 Concours vs Brandon · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</div>
      <div class="cs"><span class="${lead ? 'win' : ''}">Toi ${fmtKg(c.me)}</span><span class="${lead ? '' : 'win'}">😎 ${fmtKg(c.br)}</span></div>`;
  }

  el.quest.addEventListener('click', () => { G.audio.ensure(); openPanel('gerard', 'prophetie'); });
  el.lvl.addEventListener('click', () => { G.audio.ensure(); G.audio.sfx.click(); openPanel('carnet', 'rpg'); });
  document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { G.audio.ensure(); G.audio.sfx.click(); openPanel(b.dataset.open); }));
  el.musicBtn.addEventListener('click', () => { G.audio.ensure(); g().act.toggleMusic(); });
  el.gearDepth.addEventListener('click', () => { G.audio.ensure(); G.audio.sfx.click(); g().act.cycleDepth(); });
  el.gearBait.addEventListener('click', () => { G.audio.ensure(); G.audio.sfx.click(); g().act.cycleBait(); });
  el.gearBoat.addEventListener('click', () => { G.audio.ensure(); G.audio.sfx.click(); openPanel('zones'); });

  // ---------------------------------------------------------------- Carte de prise
  let catchMode = 'normal', curLsd = false;
  function showCatch(c) {
    const rar = D.rarities[c.fish.rarity];
    $('#catch-rarity').textContent = rar.label;
    $('#catch-rarity').style.background = rar.color;
    $('#catch-name').textContent = c.fish.name;
    $('#catch-weight').textContent = '⚖️ ' + fmtKg(c.w);
    $('#catch-price').textContent = '🪙 ' + fmt(c.price);
    $('#catch-desc').textContent = c.trip && Math.random() < 0.6 ? pick(D.quips.tripDesc) : c.fish.desc;
    curLsd = !!c.fish.lsd;
    const badges = [];
    if (c.isNew) badges.push('<span class="badge new">✨ Nouvelle espèce !</span>');
    if (c.daily) badges.push('<span class="badge daily">⭐ Poisson du jour ×3</span>');
    if (c.fish.lsd) badges.push('<span class="badge lsd">🌈 Psychédélique</span>');
    if (c.fish.night) badges.push('<span class="badge night">🌙 Nocturne</span>');
    if (c.fish.weather) badges.push(`<span class="badge weather">${D.weathers[c.fish.weather].icon} Météo</span>`);
    if (c.double) badges.push('<span class="badge">🪨 ×2 grâce à Roger</span>');
    $('#catch-badges').innerHTML = badges.join('');
    setCatchButton(null);
    el.catchCard.classList.remove('hidden', 'stolen');
    el.catchCard.style.animation = 'none'; void el.catchCard.offsetWidth; el.catchCard.style.animation = '';
  }
  function hideCatch() { el.catchCard.classList.add('hidden'); }
  function setCatchButton(text, alert, final) {
    const G_ = g();
    catchMode = alert ? 'gull' : 'normal';
    el.catchOk.classList.toggle('alert', !!alert);
    el.catchEat.classList.toggle('hidden', !curLsd || !!alert || !!final);
    if (final) el.catchCard.classList.add('stolen');
    el.catchOk.textContent = text || (G_ && G_.S.bucket.length >= G_.bucketCap() ? 'Dans le seau ! (il est plein)' : 'Dans le seau !');
  }
  el.catchEat.addEventListener('click', () => { G.audio.ensure(); G.audio.sfx.click(); g().act.eatCatch(); });
  el.catchOk.addEventListener('click', () => {
    G.audio.sfx.click();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
  });

  // ---------------------------------------------------------------- Panneaux
  let panel = null, tab = null, pdata = null;
  const TABS = {
    josiane: [['poissons', '🐟 Poissons'], ['plats', '🍽️ Plats']],
    jm: [['rods', '🎣 Cannes'], ['reels', '⚙️ Moulinets'], ['lines', '🧵 Fils'], ['hooks', '🪝 Hameçons'], ['nets', '🥅 Épuisettes'], ['baits', '🪱 Appâts'], ['buckets', '🪣 Seaux'], ['boats', '⛵ Bateaux'], ['acc', '🎒 Accessoires'], ['gadgets', '🔧 Gadgets']],
    marche: [['ing', '🧺 Ingrédients'], ['mat', '🔪 Matériel & ustensiles'], ['tech', '🎓 Techniques'], ['rec', '📖 Recettes']],
    ferme: [['parcelles', '🌱 Parcelles'], ['boutique', '🛒 Boutique du potager']],
    menu: [['partie', '💾 Partie'], ['options', '⚙️ Options']],
    cuisine: [['cuisiner', '🍳 Cuisiner'], ['pantry', '🧺 Garde-manger'], ['plats', '🍽️ Plats']],
    coco: [['hat', '🎩 Chapeaux'], ['vest', '🦺 Gilets'], ['bobber', '🔴 Bouchons'], ['deco', '🪑 Déco ponton']],
    gerard: [['prophetie', '📜 Prophétie'], ['commandes', '📋 Commandes'], ['defi', '⭐ Défi du jour'], ['concours', '🏆 Concours']],
    carnet: [['rpg', '⭐ Loutrec'], ['dex', '📖 Poissonnaire'], ['succes', '🏆 Succès'], ['aquarium', '🐠 Aquarium'], ['roger', '🪨 Roger'], ['options', '⚙️ Options']],
  };
  const NPC_OF = { josiane: 'josiane', jm: 'jm', coco: 'coco', gerard: 'gerard', merchant: 'marchand' };

  function openPanel(name, t, data) {
    const st = g().state();
    if (st === 'charging' || st === 'reeling' || st === 'bite') return;
    panel = name; pdata = data || null;
    tab = t || (TABS[name] ? TABS[name][0][0] : null);
    cookPick = null; fertPick = null;
    setQuote();
    el.wrap.classList.remove('hidden');
    render();
  }
  let cookPick = null, fertPick = null, selCrop = null;
  function setQuote() {
    let line = '';
    if (panel === 'gerard' && tab === 'concours') line = '😎 Brandon : « ' + pick(D.npcs.brandon.lines) + ' »';
    else {
      const id = panel === 'marche' ? (tab === 'rec' || tab === 'tech' ? 'gaston' : 'marguerite') : panel === 'cuisine' ? 'gaston' : panel === 'ferme' ? 'capucine' : NPC_OF[panel];
      const npc = D.npcs[id];
      if (npc) line = `${npc.icon} ${npc.name} : « ${pick(g().trip().t > 0 && Math.random() < 0.5 ? D.quips.tripNpc : npc.lines)} »`;
    }
    el.quote.textContent = line;
    el.quote.classList.toggle('hidden', !line);
  }
  function closePanel() { el.wrap.classList.add('hidden'); panel = null; cookPick = null; fertPick = null; }
  const isOpen = () => !el.wrap.classList.contains('hidden');
  function refresh() { if (isOpen()) render(); }
  $('#panel-close').addEventListener('click', () => { G.audio.sfx.click(); closePanel(); });
  el.wrap.addEventListener('pointerdown', (e) => { if (e.target === el.wrap) closePanel(); });
  el.tabs.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]'); if (!t) return;
    G.audio.sfx.click(); tab = t.dataset.tab;
    cookPick = null; fertPick = null; setQuote();
    render();
  });
  el.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    G.audio.sfx.click();
    if (b.dataset.act === 'close') return closePanel();
    if (b.dataset.act === 'goto') { const [p, t] = b.dataset.id.split(':'); return openPanel(p, t); }
    if (b.dataset.act === 'pickCook') { cookPick = b.dataset.id || null; return render(); }
    if (b.dataset.act === 'pickFert') { fertPick = b.dataset.id === '' ? null : +b.dataset.id; return render(); }
    if (b.dataset.act === 'importPick') { $('#import-file').click(); return; }
    g().act[b.dataset.act](b.dataset.id);
    if (b.dataset.act === 'startCook') { cookPick = null; render(); }
    if (b.dataset.act === 'fertilize') { fertPick = null; render(); }
  });
  el.body.addEventListener('change', (e) => { if (e.target.id === 'cropSel') { selCrop = e.target.value; render(); } });
  $('#import-file').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => { confirmBox('Importer cette partie ? La partie en cours sera remplacée.', 'Importer', () => g().importText(String(r.result))); }; r.readAsText(f); e.target.value = '';
  });

  const price = (n) => `<span class="price">🪙 ${fmt(n)}</span>`;
  const can = (n) => g().S.money >= n;
  const tag = (rarity) => { const r = D.rarities[rarity]; return `<span class="tag" style="background:${r.color}">${r.label}</span>`; };
  const btn = (act, id, label, cls = '', dis = false) => `<button class="btn ${cls}" data-act="${act}" data-id="${id}" ${dis ? 'disabled' : ''}>${label}</button>`;
  const card = (sw, title, desc, stats, actions, cls = '') => `<div class="card ${cls}"><div class="swatch" style="${sw.style || ''}">${sw.icon}</div>
    <div class="info"><div class="title">${title}</div>${desc ? `<div class="desc">${desc}</div>` : ''}${stats ? `<div class="stats">${stats}</div>` : ''}</div>
    <div class="actions">${actions}</div></div>`;
  const bar = (cur, max) => `<div class="pbar"><div style="width:${Math.min(100, (cur / max) * 100)}%"></div></div>`;
  const fishIcon = (f) => (f.junk ? '🧦' : '🐟');
  const lock = (it, tree = 'fish') => (tree === 'cook' ? g().S.rpg.clvl : g().S.rpg.lvl) < (it.lvl || 1);
  const lvlTag = (it, tree = 'fish') => ((it.lvl || 1) > 1 ? `<span class="lvlreq ${lock(it, tree) ? 'no' : 'ok'}">${tree === 'cook' ? '👨‍🍳' : '⭐'} Niv. ${it.lvl}</span>` : '');
  const PERK_LABEL = {
    bite: ['Vitesse de touche', '%'], zone: ['Zone verte', 'pt'], window: ['Fenêtre de ferrage', 's'], shadow: ['Visibilité des ombres', '%'], radius: ["Portée d'attraction", 'm'],
    rare: ['Poissons rares', '%'], loss: ['Recul du poisson réduit', '%'], sell: ['Prix de vente', '%'], cast: ['Portée de lancer', '%'], dish: ['Valeur des plats', '%'],
    speed: ['Vitesse de cuisson', '%'], save: ['Ingrédients économisés', '%'], quality: ['Qualité des plats', 'q'], burn: ['Moins de plats brûlés', '%'], double: ['Portion en plus', '%'],
    xp: ['Expérience', '%'], net: ["Aide de l'épuisette", '%'], nightRare: ['Rareté la nuit', '%'], nightShadow: ['Ombres visibles la nuit', '%'], wetCalm: ['Calme sous la pluie', '%'],
    wetBite: ['Touches sous la pluie', '%'], deep: ['Rareté au fond', '%'], bucket: ['Places de seau', ''], forecast: ['Prévision météo', ''],
  };
  function perkVal(k, v) {
    const u = PERK_LABEL[k][1];
    if (u === '%') return '+' + Math.round(v * 100) + ' %';
    if (u === 'pt') return '+' + (v * 100).toFixed(1) + ' pt';
    if (u === 's') return '+' + v.toFixed(2) + ' s';
    if (u === 'm') return '+' + v.toFixed(1) + ' m';
    if (u === 'q') return '+' + v.toFixed(2);
    return v > 1 ? '+' + v : '';
  }
  const perkText = (perk) => Object.entries(perk || {}).map(([k, v]) => (PERK_LABEL[k] ? `<span>✨ ${PERK_LABEL[k][0]} ${perkVal(k, v)}</span>` : '')).join('');
  function buffText(b, q) {
    const sc = [0, 0.6, 0.8, 1, 1.25, 1.6][q], dur = Math.round(b.dur * (q >= 4 ? 1.3 : 1) / 60 * 10) / 10;
    if (b.k === 'all') return `Tout +${Math.round(b.v * sc * 100)} % pendant ${dur} min`;
    return `${PERK_LABEL[b.k][0]} ${perkVal(b.k, b.v * sc)} pendant ${dur} min`;
  }
  function fishReqText(spec) {
    switch (spec.kind) {
      case 'any': return 'un poisson (pas un déchet)';
      case 'rank': return spec.min > 0 ? `un poisson ${D.rarities[Object.keys(D.rarities)[spec.min]].label}+${spec.max < 4 ? ' (max ' + D.rarities[Object.keys(D.rarities)[spec.max]].label + ')' : ''}` : `un poisson jusqu'à ${D.rarities[Object.keys(D.rarities)[spec.max]].label}`;
      case 'id': return G.fishById[spec.id].name;
      case 'lsd': return 'un poisson psychédélique 🌈';
    }
    return 'un déchet';
  }

  function render() {
    const G_ = g(), S = G_.S;
    let title = '', body = '';
    switch (panel) {
      case 'josiane': title = '🐟 La Josiane · Poissonnerie Flottante'; body = tab === 'plats' ? renderDishes(G_, S) : renderSell(G_, S); break;
      case 'jm': title = '🛒 Jean-Michmich · Matériel'; body = renderShop(G_, S); break;
      case 'coco': title = '🎀 Coco · Haute Couture Aquatique'; body = renderCoco(G_, S); break;
      case 'gerard': title = tab === 'concours' ? '😎 Brandon · Loutre de Compétition' : '👴 Tonton Gérard · Prophète à Temps Partiel'; body = renderGerard(G_, S); break;
      case 'ferme': title = '🌱 Tata Capucine · Potager Flottant'; body = renderFerme(G_, S); break;
      case 'zones': title = '⚓ Zones de pêche'; body = renderZones(G_, S); break;
      case 'menu': title = '☰ Menu'; body = renderMenu(G_, S); break;
      case 'marche': title = tab === 'rec' || tab === 'tech' ? '👨‍🍳 Chef Gaston Fourchette · Recettes' : '🧺 Marguerite · Marché aux Saveurs'; body = renderMarche(G_, S); break;
      case 'cuisine': title = '🍳 La Cuisine Flottante'; body = tab === 'pantry' ? renderPantry(G_, S) : tab === 'plats' ? renderDishes(G_, S) : renderCuisine(G_, S); break;
      case 'map': title = '🗺️ Carte des Coins Douteux'; body = renderMap(G_, S); break;
      case 'carnet': title = '📖 Carnet de Loutrec'; body = renderCarnet(G_, S); break;
      case 'merchant': title = '🕶️ Le Marchand Louche'; body = renderMerchant(G_, S); break;
      case 'bottle': title = '🍾 Bouteille à la mer'; body = `<div class="letter">${pdata.msg}</div><p class="reward">${pdata.reward}</p><div class="center">${btn('close', '', 'Ranger le message', 'big')}</div>`; break;
    }
    el.title.textContent = title;
    el.tabs.innerHTML = TABS[panel] ? TABS[panel].map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('') : '';
    el.body.innerHTML = body;
  }

  function renderSell(G_, S) {
    if (!S.bucket.length) return '<div class="empty">Ton seau est vide. Il contient seulement tes espoirs, et un peu d\'eau.</div>';
    const m = G_.sellMult();
    const total = S.bucket.reduce((a, b) => a + b.price, 0) * m;
    return `<div class="bucket-head"><span>${S.bucket.length}/${G_.bucketCap()} places · Valeur ${price(total)}${m > 1 ? ` <small>(+${Math.round((m - 1) * 100)} % bonus)</small>` : ''}</span>
      ${btn('sellAll', '', '💰 Tout vendre', 'sell')}</div>
      <p class="intro">Tu peux aussi offrir un poisson à Roger (🪨), le garder dans l'aquarium (🐠, ${S.aquarium.length}/${G_.aquaCap()}), manger les poissons psychédéliques (🍄)… ou les <b>cuisiner</b> sur la cuisine flottante pour les vendre bien plus cher !</p><div class="cards">` +
      S.bucket.map((it, i) => {
        const f = G_.fishById[it.id];
        return card({ icon: fishIcon(f), style: `background:${f.color}` }, `${f.name} ${tag(f.rarity)} ${it.daily ? '⭐' : ''}${f.lsd ? ' 🌈' : ''}`, '', `<span>⚖️ ${fmtKg(it.w)}</span>`,
          `${price(it.price * m)}<div class="row">${btn('sell', i, 'Vendre', 'sell')}${btn('feedRoger', i, '🪨', 'ghost')}${btn('keepFish', i, '🐠', 'ghost', S.aquarium.length >= G_.aquaCap())}${f.lsd ? btn('eatFish', i, '🍄', 'ghost') : ''}</div>`);
      }).join('') + '</div>';
  }

  function renderDishes(G_, S) {
    const menu = G_.dailyMenu();
    let h = `<div class="speech">📋 <b>Menu du jour :</b> ${menu.icon} ${menu.name} — vendu <b>×2</b> chez La Josiane aujourd'hui.</div>`;
    if (!S.dishes.length) return h + '<div class="empty">Aucun plat. Cuisine des poissons sur la cuisine flottante (🍳) : ils se vendent bien plus cher, et donnent des bonus temporaires.</div>';
    const total = S.dishes.reduce((a, d) => a + G_.dishPrice(d), 0);
    return h + `<div class="bucket-head"><span>${S.dishes.length} plat(s) · Valeur ${price(total)}</span>${btn('sellAllDishes', '', '💰 Tout vendre', 'sell')}</div><div class="cards">` +
      S.dishes.map((d, i) => {
        const r = G_.recipeById(d.rid);
        const buff = d.q === 0 ? '' : r.buff.k === 'trip' ? '<span>🌈 Voyage garanti</span>' : `<span>🍽️ ${buffText(r.buff, d.q)}</span>`;
        return card({ icon: d.q ? r.icon : '💀', style: 'background:#fff1e0' },
          `${d.q ? r.name : 'Charbon de poisson (décoratif)'} <span class="stars">${G_.stars(d.q)}</span> ${menu.id === d.rid ? '<span class="tag" style="background:#e53950">Menu du jour ×2</span>' : ''}`,
          d.q ? r.desc : "Ça ne se mange pas. Ça se vend 1 pièce, par politesse.", buff,
          `${price(G_.dishPrice(d))}<div class="row">${btn('sellDish', i, 'Vendre', 'sell')}${d.q ? btn('eatDish', i, '😋 Manger', 'ghost') : ''}</div>`);
      }).join('') + '</div>';
  }

  function renderShop(G_, S) {
    const buyBtn = (act, it, label = 'Acheter') => (lock(it) ? `<button class="btn" disabled>🔒 Niv. ${it.lvl}</button>` : btn(act, it.id, label, 'buy', !can(it.cost)));
    const gear = (list, owned, cur, buyAct, eqAct, stats) => '<div class="cards">' + list.map((r) => {
      const has = owned.includes(r.id), on = cur === r.id;
      const a = on ? '<button class="btn" disabled>Équipé</button>' : has ? btn(eqAct, r.id, 'Équiper', 'ghost') : price(r.cost) + buyBtn(buyAct, r);
      return card({ icon: r.icon || '🎣', style: `background:${r.color || '#f5eefc'}` }, r.name, r.desc, (has ? '' : lvlTag(r)) + stats(r) + perkText(r.perk), a, on ? 'current' : (!has && lock(r) ? 'locked' : ''));
    }).join('') + '</div>';
    switch (tab) {
      case 'rods': return '<p class="intro">Le poids max de la canne : au-delà, le poisson devient quasi impossible à sortir. Certaines cannes ont une spécialité.</p>' +
        gear(D.rods, S.rods, S.rod, 'buyRod', 'equipRod', (r) => `<span>⚖️ ${r.max} kg max</span><span>🎯 Contrôle ${Math.round(r.ctrl * 100)}</span><span>📏 Portée ${Math.round(r.range * 100)}</span>`);
      case 'reels': return '<p class="intro">Le moulinet détermine la vitesse à laquelle tu remontes le poisson.</p>' +
        gear(D.reels.map((r) => Object.assign({ icon: '⚙️' }, r)), S.reels, S.reel, 'buyReel', 'equipReel', (r) => `<span>💪 Puissance ×${r.power}</span>`);
      case 'lines': return '<p class="intro">Le fil fixe la profondeur max (surface → mi-eau → fond) et encaisse les à-coups des poissons.</p>' +
        gear(D.lines.map((r) => Object.assign({ icon: '🧵' }, r)), S.lines, S.line, 'buyLine', 'equipLine', (r) => `<span>${D.depths[r.depth].icon} Jusqu'à : ${D.depths[r.depth].label}</span><span>🛡️ Résistance ${Math.round((1 - r.res) * 100)} %</span>`);
      case 'hooks': return '<p class="intro">L\'hameçon change le temps dont tu disposes pour ferrer et la ténacité du poisson accroché.</p>' +
        gear(D.hooks.map((r) => Object.assign({ icon: '🪝' }, r)), S.hooks, S.hook, 'buyHook', 'equipHook', () => '');
      case 'nets': return '<p class="intro">L\'épuisette aide en fin de combat : le poisson lâche moins de terrain et monte plus vite sur la fin.</p>' +
        gear(D.nets.map((r) => Object.assign({ icon: '🥅' }, r)), S.nets, S.net, 'buyNet', 'equipNet', () => '');
      case 'baits': return `<p class="intro">Les appâts attirent les poissons rares, de plus loin, et plus vite. Vendus par ${D.baitPack}, consommés à chaque lancer. Certains sont spécialisés (profondeur, nuit).</p><div class="cards">` +
        D.baits.filter((b) => b.cost !== null || S.baits[b.id]).map((b) => {
          const on = S.bait === b.id, n = S.baits[b.id] || 0;
          const a = (b.cost ? price(b.cost) + buyBtn('buyBait', b, 'Acheter ×' + D.baitPack) : '') +
            (on ? '<button class="btn" disabled>Utilisé</button>' : (b.cost === 0 || n) ? btn('equipBait', b.id, 'Utiliser', 'ghost') : '');
          const spec = (b.depth ? `<span>${D.depths[b.depth].icon} Idéal : ${D.depths[b.depth].label}</span>` : '') + (b.night ? '<span>🌙 Meilleur la nuit</span>' : '');
          return card({ icon: b.cursed ? '💀' : '🪱', style: 'background:#f5eefc' }, `${b.name} ${b.cost !== 0 ? `<span class="tag" style="background:#a98be0">×${n}</span>` : ''}`, b.desc, lvlTag(b) + `<span>✨ Rareté ×${b.rare}</span><span>⏱️ Touche ×${b.speed}</span>` + spec, a, on ? 'current' : '');
        }).join('') + '</div>';
      case 'buckets': return '<div class="cards">' + D.buckets.map((b, i) => {
        const cur = S.bucketLvl === i, owned = S.bucketLvl >= i, next = i === S.bucketLvl + 1;
        const a = cur ? '<button class="btn" disabled>Actuel</button>' : owned ? '<button class="btn" disabled>Dépassé</button>' : next ? price(b.cost) + buyBtn('buyBucket', Object.assign({ id: i }, b)) : price(b.cost) + '<button class="btn" disabled>Un à la fois</button>';
        return card({ icon: '🪣', style: 'background:#e3f3f1' }, b.name, '', (owned ? '' : lvlTag(b)) + `<span>📦 ${b.cap} places</span>`, a, cur ? 'current' : !owned && !next ? 'locked' : '');
      }).join('') + '</div>';
      case 'boats': return '<p class="intro">Un bateau plus grand ouvre de nouvelles <b>zones de pêche</b> : poissons plus gros, plus rares, et des espèces exclusives. Change de zone avec le bouton « ⚓ » en bas à gauche. Pas de carburant : le moteur tourne à la bonne humeur.</p><div class="cards">' + D.boats.map((b) => {
        const own = S.boats.includes(b.id), z = D.zones.find((x) => x.tier === b.tier);
        return card({ icon: '⛵', style: 'background:#dff3ff' }, b.name, b.desc, (own ? '' : lvlTag(b)) + `<span>📐 ${b.size}</span><span>${z.icon} ${z.name}</span><span>⚖️ ×${z.wt} · ✨ ×${z.rare}</span>`,
          own ? '<button class="btn" disabled>✓ Possédé</button>' : price(b.cost) + buyBtn('buyBoat', b), own ? 'current' : lock(b) ? 'locked' : '');
      }).join('') + '</div>';
      case 'acc': return '<p class="intro">Des objets permanents : une fois achetés, leurs bonus sont toujours actifs. Pas de limite, juste un porte-monnaie.</p><div class="cards">' + D.accessories.map((u) => {
        const has = S.acc.includes(u.id);
        return card({ icon: u.icon, style: 'background:#fff3e0' }, u.name, u.desc, (has ? '' : lvlTag(u)) + perkText(u.perk), has ? '<button class="btn" disabled>✓ Actif</button>' : price(u.cost) + buyBtn('buyAcc', u), has ? 'current' : lock(u) ? 'locked' : '');
      }).join('') + '</div>';
      case 'gadgets': return '<p class="intro">Des améliorations permanentes. Jean-Michmich jure qu\'elles sont légales.</p><div class="cards">' + D.upgrades.map((u) => {
        const has = G_.has(u.id);
        return card({ icon: u.icon, style: 'background:#fff3e0' }, u.name, u.desc, has ? '' : lvlTag(u), has ? '<button class="btn" disabled>Possédé</button>' : price(u.cost) + buyBtn('buyUpgrade', u), has ? 'current' : lock(u) ? 'locked' : '');
      }).join('') + '</div>';
    }
    return '';
  }

  function renderCoco(G_, S) {
    const list = D.cosmetics.filter((c) => c.slot === tab);
    const intro = { hat: 'Un chapeau dit tout de toi. Surtout si c\'est un cône de chantier.', vest: 'Le gilet : 90 % du style d\'une loutre.', bobber: 'Ton bouchon est ta carte de visite sous-marine.', deco: 'Décore ton ponton. Plusieurs objets à la fois, c\'est permis.' }[tab];
    return `<p class="intro">${intro}</p><div class="cards">` + list.map((c) => {
      const owned = S.cos.owned.includes(c.id);
      const on = c.slot === 'deco' ? S.cos.deco.includes(c.id) : S.cos[c.slot] === c.id;
      let a;
      if (owned) a = c.slot === 'deco' ? btn('equipCos', c.id, on ? 'Retirer' : 'Installer', on ? 'ghost' : 'buy') : on ? '<button class="btn" disabled>Porté</button>' : btn('equipCos', c.id, 'Porter', 'ghost');
      else if (c.cost !== null) a = price(c.cost) + btn('buyCos', c.id, 'Acheter', 'buy', !can(c.cost));
      else a = `<span class="src">🔒 ${c.src}</span>`;
      const icon = { hat: '🎩', vest: '🦺', bobber: '🔴', deco: '🪑' }[c.slot];
      return card({ icon, style: `background:${c.color || '#fdeef4'}` }, c.name, c.desc, '', a, on ? 'current' : owned ? '' : 'locked');
    }).join('') + '</div>';
  }

  function renderGerard(G_, S) {
    if (tab === 'prophetie') {
      const p = G_.questProgress();
      const done = D.quest.slice(0, S.quest.step).map((q) => `<li>✅ ${q.title}</li>`).join('');
      if (!p) return `<div class="speech">${D.questEnd}</div><ul class="qlist">${done}</ul>`;
      return `<div class="qhead">Chapitre ${S.quest.step + 1}/${D.quest.length} · <b>${p.step.title}</b></div>
        <div class="speech">${p.step.text}</div>
        <div class="goal">🎯 ${p.step.goal} <b>${p.cur}/${p.max}</b>${bar(p.cur, p.max)}</div>
        <div class="center">Récompense : ${price(p.step.reward)}${p.step.cos ? ' + 🎁 ' + G_.cosById(p.step.cos).name : ''}<br>
        ${btn('claimQuest', '', p.done ? '🎉 Réclamer la récompense' : 'Pas encore…', 'big', !p.done)}</div>
        ${done ? `<details><summary>Chapitres accomplis (${S.quest.step})</summary><ul class="qlist">${done}</ul></details>` : ''}`;
    }
    if (tab === 'commandes') {
      return `<div class="bucket-head"><span>📋 ${S.orders.length} commandes · elles se renouvellent toutes seules</span>${btn('refreshOrders', '', S.ordersCD > 0 ? `🔄 Actualiser (${Math.ceil(S.ordersCD)} s)` : '🔄 Actualiser', 'ghost', S.ordersCD > 0)}</div><p class="intro">Les loutres du coin passent commande. Livre les poissons (ou les plats) contre une belle récompense avant qu'elles ne se lassent.</p><div class="cards">` + S.orders.map((o, i) => {
        if (o.type === 'dish') return dishOrderCard(G_, S, o, i);
        const f = G_.fishById[o.fish], have = G_.orderMatches(o).length, known = !!S.dex[f.id];
        const hint = known ? '' : ` <small>(pas encore pêché : ${D.depths[f.depth].icon} ${D.depths[f.depth].label}${f.night ? ', 🌙 la nuit' : ''}${f.weather ? ', ' + D.weathers[f.weather].icon + ' ' + D.weathers[f.weather].name : ''}, ${G_.D.spots.find((s) => s.id === f.spot).name})</small>`;
        return card({ icon: '📋', style: `background:${f.color}` }, `${o.qty} × ${f.name} ${tag(f.rarity)}`, `${o.who}, ${o.why}.${hint}`,
          `${o.minW ? `<span>⚖️ min ${fmtKg(o.minW)}</span>` : ''}<span>🪣 Tu en as ${have}/${o.qty}</span><span class="ordtime" data-oid="${o.id}">⏳ ${G_.fmtTime(o.t || 0)}</span>`,
          `${price(o.reward)}<div class="row">${btn('deliver', i, 'Livrer', 'buy', have < o.qty)}${btn('refuseOrder', i, '✕', 'ghost')}</div>`);
      }).join('') + '</div>';
    }
    if (tab === 'defi') {
      return '<p class="intro">Chaque jour, un poisson vedette par coin vaut <b>3 fois</b> son prix. Ça change à minuit (le vrai minuit, pas celui du jeu).</p><div class="cards">' + S.spots.map((id) => {
        const sp = D.spots.find((s) => s.id === id), f = G_.dailyFish(id);
        return card({ icon: '⭐', style: `background:${f.color}` }, `${S.dex[f.id] ? f.name : '??? (' + D.rarities[f.rarity].label + ')'}`, sp.name,
          `<span>${D.depths[f.depth].icon} ${D.depths[f.depth].label}</span>${f.night ? '<span>🌙 La nuit</span>' : ''}<span>💰 ×3</span>`, '');
      }).join('') + '</div>';
    }
    if (tab === 'concours') {
      const c = G_.contest(), cd = Math.ceil(S.contestCD);
      const rw = [150, 800, 3000, 12000, 50000][G_.spotIdx()];
      return `<div class="speech">Le concours dure 2 minutes : celui qui pêche le plus de kilos gagne. Brandon pêche tout seul sur son radeau. Il triche peut-être. Probablement.</div>
        <div class="center">Récompense ici : ${price(rw)} · Victoires : <b>${S.stats.contests}</b><br>
        ${c ? '<button class="btn big" disabled>Concours en cours !</button>' : cd > 0 ? `<button class="btn big" disabled>Brandon récupère (${cd} s)</button>` : btn('startContest', '', '🏆 Défier Brandon', 'big')}</div>`;
    }
    return '';
  }

  function dishOrderCard(G_, S, o, i) {
    const r = G_.recipeById(o.rid), have = G_.orderMatches(o).length;
    return card({ icon: r.icon, style: 'background:#fff1e0' }, `${o.qty} × ${r.name} <span class="stars">${'★'.repeat(o.minQ)}+</span>`, `${o.who}, ${o.why}.`,
      `<span>🍽️ Tu en as ${have}/${o.qty}</span><span>🍳 Plat à cuisiner</span><span class="ordtime" data-oid="${o.id}">⏳ ${G_.fmtTime(o.t || 0)}</span>`,
      `${price(o.reward)}<div class="row">${btn('deliver', i, 'Livrer', 'buy', have < o.qty)}${btn('refuseOrder', i, '✕', 'ghost')}</div>`);
  }

  function renderMap(G_, S) {
    return '<p class="intro">Chaque coin a ses poissons, sa météo, ses ingrédients et ses habitants bizarres. Les coins plus lointains demandent un certain niveau de pêche.</p><div class="cards">' + D.spots.map((sp) => {
      const owned = S.spots.includes(sp.id), cur = S.spot === sp.id;
      const known = sp.fish.filter((f) => S.dex[f[0]]).length;
      const buy = lock(sp) ? `<button class="btn" disabled>🔒 Niv. ${sp.lvl}</button>` : btn('buySpot', sp.id, 'Débloquer', 'buy', !can(sp.cost));
      const a = cur ? '<button class="btn" disabled>Tu y es</button>' : owned ? btn('travel', sp.id, 'Y aller', 'buy') : price(sp.cost) + buy;
      const wx = [...new Set(sp.weathers)].map((w) => D.weathers[w].icon).join(' ');
      const ings = D.ingredients.filter((x) => x.at && x.at.includes(sp.id)).map((x) => x.icon).join('');
      return card({ icon: owned ? '📍' : '🔒', style: `background:linear-gradient(${sp.pal.skyTop}, ${sp.pal.water})` }, sp.name, sp.desc,
        (owned ? '' : lvlTag(sp)) + `<span>🎣 Canne conseillée : ${sp.rodHint} kg+</span><span>📖 ${known}/${sp.fish.length}</span><span>Météos : ${wx}</span>${ings ? `<span>🧺 ${ings}</span>` : ''}`, a, (cur ? 'current' : '') + (owned ? '' : ' locked'));
    }).join('') + '</div>';
  }

  // ---------------------------------------------------------------- Marché aux Saveurs & recettes
  function ingChips(G_, S, r) {
    return Object.entries(r.ing).map(([id, n]) => {
      const have = S.pantry[id] || 0, ing = G_.ingById(id);
      return `<span class="${have >= n ? 'okc' : 'noc'}">${ing.icon} ${ing.name} ${have}/${n}</span>`;
    }).join('');
  }
  function renderMarche(G_, S) {
    const ck = S.cook;
    if (tab === 'ing') {
      const disc = G_.ingById(G_.dailyDiscount());
      const here = D.ingredients.filter((x) => G_.ingAvailable(x)), away = D.ingredients.filter((x) => !G_.ingAvailable(x));
      const farmable = new Set(D.crops.map((c) => c.ing));
      return `<p class="intro">Les prix changent chaque jour. Aujourd'hui : <b>${disc.icon} ${disc.name}</b> à −35 %. Certains ingrédients ne se trouvent que dans certains coins. Beaucoup peuvent aussi se <b>cultiver</b> au potager (🌱).</p><div class="cards">` +
        here.map((x) => {
          const pr = G_.ingPrice(x), n = S.pantry[x.id] || 0, sale = G_.dailyDiscount() === x.id;
          return card({ icon: x.icon, style: 'background:#f1fbe9' }, `${x.name} ${sale ? '<span class="tag" style="background:#e53950">−35 %</span>' : ''}`, `En stock chez toi : <b>${n}</b>${farmable.has(x.id) ? ' · 🌱 cultivable' : ''}`, '',
            `${price(pr)}<div class="row">${btn('buyIng', x.id + ':1', '×1', 'buy', !can(pr))}${btn('buyIng', x.id + ':5', '×5', 'buy', !can(pr * 5))}</div>`);
        }).join('') + '</div>' +
        (away.length ? `<h3>Ailleurs</h3><div class="cards">` + away.map((x) => card({ icon: x.icon, style: 'background:#eee' }, x.name, `Vendu à : ${x.at.map((id) => D.spots.find((sp) => sp.id === id).name).join(', ')}`, '', '<span class="src">🔒 pas ici</span>', 'locked')).join('') + '</div>' : '');
    }
    if (tab === 'mat') {
      const section = (title, html) => `<h3>${title}</h3><div class="cards">${html}</div>`;
      const stoves = D.stoves.map((t, i) => {
        const own = i < ck.stove, next = i === ck.stove;
        const a = own ? `<button class="btn" disabled>${i === ck.stove - 1 ? 'Installé' : 'Dépassé'}</button>` : next ? price(t.cost) + (lock(t, 'cook') ? `<button class="btn" disabled>🔒 Niv. ${t.lvl}</button>` : btn('buyStove', '', 'Acheter', 'buy', !can(t.cost))) : price(t.cost) + '<button class="btn" disabled>Plus tard</button>';
        return card({ icon: '🔥', style: 'background:#ffe0d6' }, t.name, t.desc, `${own ? '' : lvlTag(t, 'cook')}<span>🍳 ${t.slots} feu${t.slots > 1 ? 'x' : ''}</span><span>⚡ Vitesse ×${t.speed}</span>`, a, i === ck.stove - 1 ? 'current' : own ? '' : next ? '' : 'locked');
      }).join('');
      const knives = D.knives.map((t, i) => {
        const own = i < ck.knife, next = i === ck.knife;
        const a = own ? `<button class="btn" disabled>${i === ck.knife - 1 ? 'Équipé' : 'Dépassé'}</button>` : next ? price(t.cost) + (lock(t, 'cook') ? `<button class="btn" disabled>🔒 Niv. ${t.lvl}</button>` : btn('buyKnife', '', 'Acheter', 'buy', !can(t.cost))) : price(t.cost) + '<button class="btn" disabled>Plus tard</button>';
        return card({ icon: '🔪', style: 'background:#e6edf3' }, t.name, t.desc, `${own ? '' : lvlTag(t, 'cook')}<span>⭐ Qualité ${t.q >= 0 ? '+' : ''}${t.q}</span>`, a, i === ck.knife - 1 ? 'current' : own ? '' : next ? '' : 'locked');
      }).join('');
      const apps = D.appliances.map((t) => {
        const own = ck.apps.includes(t.id);
        const a = own ? '<button class="btn" disabled>✓ Installé</button>' : price(t.cost) + (lock(t, 'cook') ? `<button class="btn" disabled>🔒 Niv. ${t.lvl}</button>` : btn('buyApp', t.id, 'Acheter', 'buy', !can(t.cost)));
        return card({ icon: t.icon, style: 'background:#fff3e0' }, t.name, t.desc, `${own ? '' : lvlTag(t, 'cook')}<span>🍽️ Recettes « ${D.methodNames[t.id]} »</span>`, a, own ? 'current' : lock(t, 'cook') ? 'locked' : '');
      }).join('');
      const uten = D.utensils.map((t) => {
        const own = S.utensils.includes(t.id);
        const a = own ? '<button class="btn" disabled>✓ Possédé</button>' : price(t.cost) + (lock(t, 'cook') ? `<button class="btn" disabled>🔒 Niv. ${t.lvl}</button>` : btn('buyUtensil', t.id, 'Acheter', 'buy', !can(t.cost)));
        const uses = D.techs.filter((x) => x.needs && x.needs.utensil && x.needs.utensil.includes(t.id)).map((x) => x.name).join(', ');
        return card({ icon: t.icon, style: 'background:#eef5e6' }, t.name, t.desc, `${own ? '' : lvlTag(t, 'cook')}<span>🎓 Pour : ${uses}</span>`, a, own ? 'current' : lock(t, 'cook') ? 'locked' : '');
      }).join('');
      return `<p class="intro">Tout est à acheter : le réchaud, les appareils, le couteau et les ustensiles se posent sur ta <b>cuisine flottante</b>. Une recette demande un réchaud, un appareil et des <b>techniques</b> (🎓), qui demandent elles-mêmes des ustensiles. Niveau demandé : ton niveau de <b>cuisine</b> (👨‍🍳 ${S.rpg.clvl}).</p>` +
        section('🔥 Réchauds (plats en parallèle, vitesse)', stoves) + section('🍳 Appareils (types de recettes)', apps) + section('🔪 Couteaux (qualité, et nécessaires pour vider et fileter)', knives) + section('🥣 Ustensiles', uten);
    }
    if (tab === 'tech') {
      return `<p class="intro">Les techniques s'apprennent auprès de Chef Gaston. Chacune demande des ustensiles ou du matériel (Marguerite) et un niveau de cuisine. Une recette exige <b>toutes</b> ses techniques.</p><div class="cards">` + D.techs.map((t) => {
        const known = G_.hasTech(t.id), n = t.needs || {}, needs = [];
        (n.utensil || []).forEach((u) => needs.push({ ok: S.utensils.includes(u), txt: D.utensils.find((x) => x.id === u).name }));
        if (n.knife) needs.push({ ok: ck.knife >= n.knife, txt: D.knives[n.knife - 1].name });
        if (n.stove) needs.push({ ok: ck.stove >= n.stove, txt: D.stoves[n.stove - 1].name });
        const allOk = needs.every((x) => x.ok);
        const a = known ? '<button class="btn" disabled>✓ Maîtrisée</button>' : price(t.cost) + (lock(t, 'cook') ? `<button class="btn" disabled>🔒 Niv. ${t.lvl}</button>` : btn('learnTech', t.id, 'Apprendre', 'buy', !can(t.cost) || !allOk));
        const uses = D.recipes.filter((r) => (r.tech || []).includes(t.id)).length;
        return card({ icon: t.icon, style: 'background:#ede7f6' }, t.name, t.desc, `${known ? '' : lvlTag(t, 'cook')}${needs.map((x) => `<span class="${x.ok ? 'okc' : 'noc'}">${x.ok ? '✓' : '✗'} ${x.txt}</span>`).join('')}<span>📖 Utilisée par ${uses} recettes</span>`, a, known ? 'current' : lock(t, 'cook') ? 'locked' : '');
      }).join('') + '</div>';
    }
    // recettes
    const list = D.recipes.slice().sort((a, b) => a.lvl - b.lvl || a.cost - b.cost);
    return `<p class="intro">Chef Gaston t'apprend ses recettes… contre quelques pièces. Chaque recette demande : un poisson, des ingrédients, un appareil et des techniques.</p><div class="cards">` +
      list.map((r) => {
        const known = G_.knows(r.id), appOk = ck.apps.includes(r.method), miss = G_.techMissing(r);
        const a = known ? `<button class="btn" disabled>✓ Connue · ×${ck.mastery[r.id] || 0}</button>` : price(r.cost) + (lock(r, 'cook') ? `<button class="btn" disabled>🔒 Niv. ${r.lvl}</button>` : btn('learnRecipe', r.id, 'Apprendre', 'buy', !can(r.cost)));
        const need = Object.entries(r.ing).map(([id, n]) => `${G_.ingById(id).icon}${n}`).join(' ');
        return card({ icon: r.icon, style: 'background:#fff1e0' }, r.name, r.desc,
          `${known ? '' : lvlTag(r, 'cook')}<span class="${appOk ? 'okc' : 'noc'}">🍳 ${D.methodNames[r.method]}${appOk ? '' : ' (manquant)'}</span><span class="${miss.length ? 'noc' : 'okc'}">🎓 ${r.tech.map((t) => D.techs.find((x) => x.id === t).name).join(', ')}</span><span>🐟 ${fishReqText(r.fish)}</span><span>🧺 ${need}</span><span>⏱️ ${r.time} s</span><span>🍽️ ${r.buff.k === 'trip' ? 'Voyage garanti 🌈' : buffText(r.buff, 3)}</span>`, a, known ? 'current' : lock(r, 'cook') ? 'locked' : '');
      }).join('') + '</div>';
  }

  function renderPantry(G_, S) {
    const items = D.ingredients.filter((x) => (S.pantry[x.id] || 0) > 0);
    if (!items.length) return `<div class="empty">Le garde-manger est vide. Marguerite (🧺 Marché) vend tout ce qu'il faut, y compris des légumes tristes.</div><div class="center">${btn('goto', 'marche:ing', '🧺 Aller au marché', 'big')}</div>`;
    return '<p class="intro">Ton garde-manger. Les ingrédients ne périment jamais (c\'est une licence artistique).</p><div class="cards">' +
      items.map((x) => card({ icon: x.icon, style: 'background:#f1fbe9' }, x.name, '', '', `<b>×${S.pantry[x.id]}</b>`)).join('') + '</div>';
  }

  function cookGuide(G_, S) {
    const ck = S.cook, st = G_.stoveTier();
    const steps = [
      [!!st, '🔥 Un réchaud', 'Marché → Matériel (80 🪙)'],
      [ck.apps.length > 0, '🍳 Un appareil (la poêle suffit)', 'Marché → Matériel'],
      [ck.knife > 0 && S.utensils.includes('ecailleur'), '🔪 Un couteau et un écailleur', 'Marché → Matériel & ustensiles'],
      [['ecailler', 'vider', 'cuire'].every((t) => G_.hasTech(t)), '🎓 Techniques : Écailler, Vider, Cuire', 'Marché → Techniques'],
      [ck.recipes.length > 0, '📖 Une recette (Poisson Poêlé au Beurre : 40 🪙)', 'Marché → Recettes'],
      [(S.pantry.beurre || 0) > 0 && (S.pantry.sel || 0) > 0, '🧈 Du beurre et du sel', 'Marché → Ingrédients (le sel se cultive aussi)'],
    ];
    if (steps.every((x) => x[0])) return '';
    return `<div class="speech"><b>Guide du chef</b> — pour cuisiner ton premier plat :<ul class="qlist">${steps.map(([ok, t, w]) => `<li>${ok ? '✅' : '⬜'} ${t} <small>— ${w}</small></li>`).join('')}</ul>${btn('goto', 'marche:mat', '🧺 Aller au marché', 'buy')}</div>`;
  }

  function renderCuisine(G_, S) {
    const ck = S.cook, st = G_.stoveTier(), kn = G_.knifeTier();
    let h = cookGuide(G_, S);
    if (!st) return h + '<div class="empty">Ta cuisine flottante est un radeau avec une table. Pour l\'instant, rien d\'autre.</div>';
    h += `<div class="kitinfo"><span>🔥 ${st.name} (${ck.slots.length}/${st.slots} feux)</span><span>🔪 ${kn.name}</span><span>🍳 ${ck.apps.map((a) => D.methodNames[a]).join(', ') || 'aucun appareil'}</span><span>🎓 ${S.techs.length}/${D.techs.length} techniques</span></div>`;
    if (ck.slots.length) {
      h += '<h3>En cuisson</h3><div class="cards">' + ck.slots.map((sl) => {
        const r = G_.recipeById(sl.rid), f = G_.fishById[sl.fish.id], now = Date.now();
        const pct = Math.max(0, Math.min(100, (now - sl.start) / (sl.end - sl.start) * 100));
        return `<div class="card current"><div class="swatch" style="background:#ffe0b2">${r.icon}</div><div class="info"><div class="title">${r.name}</div><div class="desc">avec : ${f.name}</div>
          <div class="cookbar"><div data-start="${sl.start}" data-end="${sl.end}" style="width:${pct}%"></div></div><span class="cooktime">${Math.max(0, Math.ceil((sl.end - now) / 1000))} s</span></div></div>`;
      }).join('') + '</div>';
    }
    if (cookPick) {
      const r = G_.recipeById(cookPick);
      const elig = S.bucket.map((it, i) => ({ it, i, f: G_.fishById[it.id] })).filter((x) => G_.fishMatches(r.fish, x.f));
      h += `<h3>${r.icon} ${r.name} — choisis le poisson</h3><p class="intro">Il faut : ${fishReqText(r.fish)}. Un poisson plus rare ou plus lourd donne un meilleur plat.</p><div class="cards">`;
      h += elig.length ? elig.map((x) => card({ icon: fishIcon(x.f), style: `background:${x.f.color}` }, `${x.f.name} ${tag(x.f.rarity)}`, '', `<span>⚖️ ${fmtKg(x.it.w)}</span><span>🍽️ ≈ ${fmt((x.it.price * r.mult + r.base + r.ingCost * 0.6) * 1)} 🪙 (3★)</span>`, btn('startCook', r.id + ':' + x.i, 'Utiliser', 'buy'))).join('') : '<div class="empty">Aucun poisson de ton seau ne convient. Va pêcher !</div>';
      return h + `</div><div class="center">${btn('pickCook', '', '← Retour', 'ghost')}</div>`;
    }
    h += `<h3>Recettes connues</h3><p class="intro">Menu du jour chez La Josiane : ${G_.dailyMenu().icon} <b>${G_.dailyMenu().name}</b> (×2). Plus de recettes chez Chef Gaston (🧺 Marché → Recettes).</p><div class="cards">`;
    if (!ck.recipes.length) h += '<div class="empty">Tu ne connais aucune recette. Chef Gaston t\'attend au marché (🧺).</div>';
    h += ck.recipes.map((id) => G_.recipeById(id)).sort((a, b) => a.lvl - b.lvl).map((r) => {
      const appOk = ck.apps.includes(r.method), ingOk = Object.entries(r.ing).every(([id, n]) => (S.pantry[id] || 0) >= n), miss = G_.techMissing(r);
      const full = ck.slots.length >= st.slots, fishOk = S.bucket.some((it) => G_.fishMatches(r.fish, G_.fishById[it.id]));
      let why = '';
      if (miss.length) why = 'Technique : ' + D.techs.find((x) => x.id === miss[0]).name; else if (!appOk) why = `Il faut : ${D.methodNames[r.method]}`; else if (!ingOk) why = 'Ingrédients manquants'; else if (!fishOk) why = 'Aucun poisson adapté'; else if (full) why = 'Feux occupés';
      const a = (G_.dailyMenu().id === r.id ? '<span class="tag" style="background:#e53950">Menu ×2</span>' : '') + (why ? `<span class="src">${why}</span>` : '') + btn('pickCook', r.id, '🍳 Cuisiner', 'buy', !!why);
      return card({ icon: r.icon, style: 'background:#fff1e0' }, r.name, r.desc,
        `<span class="${appOk ? 'okc' : 'noc'}">${D.methodNames[r.method]}</span><span class="${miss.length ? 'noc' : 'okc'}">🎓 ${r.tech.map((t) => D.techs.find((x) => x.id === t).name).join(', ')}</span><span>🐟 ${fishReqText(r.fish)}</span>${ingChips(G_, S, r)}<span>⏱️ ${Math.round(r.time * Math.max(0.35, 1 - G_.perks().speed) / st.speed)} s</span><span>🍽️ ${r.buff.k === 'trip' ? 'Voyage 🌈' : buffText(r.buff, 3)}</span><span>Maîtrise ×${ck.mastery[r.id] || 0}</span>`, a);
    }).join('') + '</div>';
    return h;
  }

  // ---------------------------------------------------------------- Potager
  function renderFerme(G_, S) {
    const f = S.farm, fi = G_.farmInfo(), P = D.farm;
    const head = `<div class="lvlbox"><div class="lvlhead"><b>🌱 Potager · niveau ${fi.lvl}${fi.max ? ' (max)' : ''}</b><span>${f.owned}/8 parcelles · arrosoir : ${f.can ? P.cans[f.can - 1].name : 'aucun'}${f.tools.serre ? ' · 🏡 serre' : ''}${f.tools.epouvantail ? ' · 🧑‍🌾 épouvantail' : ''}</span></div><div class="pbar big"><div style="width:${fi.pct}%"></div></div></div>`;
    const lockF = (it) => f.lvl < (it.lvl || 1);
    const lvlF = (it) => ((it.lvl || 1) > 1 ? `<span class="lvlreq ${lockF(it) ? 'no' : 'ok'}">🌱 Niv. ${it.lvl}</span>` : '');
    if (tab === 'boutique') {
      const nextPlot = P.plots[f.owned], nextCan = P.cans[f.can];
      let h = head + '<h3>🟫 Parcelles</h3><div class="cards">';
      h += nextPlot ? card({ icon: '🟫', style: 'background:#efe3d3' }, `Parcelle n°${f.owned + 1}`, "Un carré de terre sur le radeau. Il ne demande qu'à pousser.", lvlF(nextPlot), price(nextPlot.cost) + (lockF(nextPlot) ? `<button class="btn" disabled>🔒 Niv. ${nextPlot.lvl}</button>` : btn('buyPlot', '', 'Acheter', 'buy', !can(nextPlot.cost)))) : '<div class="empty">Toutes les parcelles sont à toi. Un empire végétal.</div>';
      h += '</div><h3>💧 Arrosoirs</h3><div class="cards">' + P.cans.map((c, i) => {
        const own = i < f.can, next = i === f.can;
        const a = own ? `<button class="btn" disabled>${i === f.can - 1 ? 'Équipé' : 'Dépassé'}</button>` : next ? price(c.cost) + (lockF(c) ? `<button class="btn" disabled>🔒 Niv. ${c.lvl}</button>` : btn('buyCan', '', 'Acheter', 'buy', !can(c.cost))) : price(c.cost) + '<button class="btn" disabled>Plus tard</button>';
        return card({ icon: '🚿', style: 'background:#e1f3ff' }, c.name, c.desc, own ? '' : lvlF(c), a, i === f.can - 1 ? 'current' : own ? '' : next ? '' : 'locked');
      }).join('') + '</div><h3>🛠️ Outils</h3><div class="cards">' + P.tools.map((t) => {
        const own = !!f.tools[t.id];
        return card({ icon: t.icon, style: 'background:#f1fbe9' }, t.name, t.desc, own ? '' : lvlF(t), own ? '<button class="btn" disabled>✓ Installé</button>' : price(t.cost) + (lockF(t) ? `<button class="btn" disabled>🔒 Niv. ${t.lvl}</button>` : btn('buyFarmTool', t.id, 'Acheter', 'buy', !can(t.cost))), own ? 'current' : lockF(t) ? 'locked' : '');
      }).join('') + '</div><h3>🌰 Cultures (graines payées à la plantation)</h3><div class="cards">' + D.crops.map((c) => {
        const ing = G_.ingById(c.ing);
        return card({ icon: c.icon, style: `background:${c.color}33` }, c.name, c.desc, `${lvlF(c)}<span>→ ${ing.icon} ${ing.name} ×${c.yield[0]}-${c.yield[1]}</span><span>⏱️ ${c.time} s</span><span>🌰 ${c.seed} 🪙</span>${c.wet ? '<span>🌧️ aime la pluie</span>' : ''}${c.night ? '<span>🌙 pousse la nuit</span>' : ''}`, '', lockF(c) ? 'locked' : '');
      }).join('') + '</div>';
      return h;
    }
    // parcelles
    const crops = D.crops.filter((c) => c.lvl <= f.lvl);
    if (!selCrop || !crops.some((c) => c.id === selCrop)) selCrop = crops[0].id;
    const sc = D.crops.find((c) => c.id === selCrop);
    let h = head + `<div class="bucket-head"><span>Cultiver : <select id="cropSel">${crops.map((c) => `<option value="${c.id}" ${c.id === selCrop ? 'selected' : ''}>${c.icon} ${c.name} — graine ${c.seed} 🪙 · ${c.time} s</option>`).join('')}</select></span>
      <span class="row">${btn('plantAll', selCrop, '🌱 Planter partout', 'buy', f.owned === 0)}${btn('waterAll', '', '💧 Tout arroser', 'ghost')}${btn('harvestAll', '', '🧺 Tout récolter', 'sell')}</span></div>`;
    if (!f.owned) h += '<div class="speech">Tu n\'as aucune parcelle. Va dans « Boutique du potager » pour acheter ta première (40 🪙). Pas besoin d\'arrosoir quand il pleut !</div>';
    if (fertPick !== null) {
      const p = f.plots[fertPick], c = p && D.crops.find((x) => x.id === p.crop);
      h += `<h3>🐟 Engrais pour ${c ? c.name : 'la parcelle'}</h3><p class="intro">Un poisson donne un engrais : pousse 1,5× plus vite et +1 récolte. Les déchets font très bien l'affaire.</p><div class="cards">`;
      h += S.bucket.length ? S.bucket.map((it, i) => { const fi2 = G_.fishById[it.id]; return card({ icon: fishIcon(fi2), style: `background:${fi2.color}` }, fi2.name, '', `<span>⚖️ ${fmtKg(it.w)}</span>`, btn('fertilize', fertPick + ':' + i, 'Utiliser', 'buy')); }).join('') : '<div class="empty">Ton seau est vide.</div>';
      return h + `</div><div class="center">${btn('pickFert', '', '← Retour', 'ghost')}</div>`;
    }
    h += '<div class="cards">';
    for (let i = 0; i < 8; i++) {
      const p = f.plots[i];
      if (i >= f.owned) {
        const pl = P.plots[i];
        h += card({ icon: '🔒', style: 'background:#e8e8e8' }, `Parcelle n°${i + 1}`, i === f.owned ? 'Disponible dans la boutique.' : 'Pas encore à toi.', i === f.owned ? lvlF(pl) + `<span>🪙 ${fmt(pl.cost)}</span>` : '', i === f.owned ? btn('goto', 'ferme:boutique', '🛒', 'ghost') : '', 'locked');
      } else if (!p) {
        h += card({ icon: '🟫', style: 'background:#efe3d3' }, `Parcelle n°${i + 1} · vide`, '', '', btn('plant', i + ':' + selCrop, `${sc.icon} Planter (${sc.seed} 🪙)`, 'buy', !can(sc.seed)));
      } else {
        const c = D.crops.find((x) => x.id === p.crop), raining = S.weather === 'pluie' || S.weather === 'orage';
        const stat = p.ready ? 'Prêt à récolter !' : p.water > 0 ? `💧 ${Math.ceil(p.water)} s d'eau` : raining ? '🌧️ la pluie arrose' : '🏜️ assoiffé';
        const acts = p.ready ? btn('harvest', i, '🧺 Récolter', 'sell') : btn('water', i, '💧', 'ghost') + (p.fert ? '<span class="src">🐟 engraissé</span>' : btn('pickFert', i, '🐟', 'ghost'));
        h += `<div class="card ${p.ready ? 'current' : ''}"><div class="swatch" style="background:${c.color}55">${c.icon}</div><div class="info"><div class="title">${c.name} <small>→ ${G_.ingById(c.ing).icon} ${G_.ingById(c.ing).name}</small></div>
          <div class="cookbar farmbar"><div data-plot="${i}" style="width:${Math.min(100, p.growth / c.time * 100)}%"></div></div><span class="cooktime farmtxt">${stat}</span></div><div class="actions"><div class="row">${acts}</div></div></div>`;
      }
    }
    return h + '</div>';
  }

  // ---------------------------------------------------------------- Zones de pêche
  function renderZones(G_, S) {
    const tier = G_.tierOwned(), sp = G_.spot();
    return '<p class="intro">Chaque zone a ses espèces exclusives, des poissons plus lourds et plus rares. Il faut un bateau assez grand (🛒 Jean-Michmich → Bateaux). Changer de zone se fait à l\'arrêt.</p><div class="cards">' + D.zones.map((z) => {
      const ok = z.tier <= tier, cur = S.zone === z.id, boat = D.boats.find((b) => b.tier === z.tier);
      const ex = sp.fish.filter((f) => f[10] && f[10].zone === z.id).map((f) => (S.dex[f[0]] ? f[1] : '???'));
      const a = cur ? '<button class="btn" disabled>Tu y es</button>' : ok ? btn('setZone', z.id, 'Y aller', 'buy') : `<button class="btn" disabled>🔒 ${boat ? boat.name : ''}</button>`;
      return card({ icon: z.icon, style: 'background:linear-gradient(#bfe6ff, #5fa8d3)' }, z.name, z.desc, `<span>⚖️ Poids ×${z.wt}</span><span>✨ Rareté ×${z.rare}</span><span>🐟 Poissons communs ×${z.normal}</span>${ex.length ? `<span>⭐ ${ex.join(', ')}</span>` : ''}`, a, cur ? 'current' : ok ? '' : 'locked');
    }).join('') + '</div>';
  }

  // ---------------------------------------------------------------- Menu : sauvegardes
  function renderMenu(G_, S) {
    if (tab === 'options') { const t0 = tab; tab = 'options'; const h = renderCarnet(G_, S); tab = t0; return h; }
    const fd = (t) => new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const slots = G_.slotsInfo().map(({ n, meta }) => card({ icon: '💾', style: 'background:#e8f0ff' }, `Emplacement ${n}`,
      meta ? `⭐ ${meta.lvl} · 👨‍🍳 ${meta.clvl} · 🪙 ${fmt(meta.money)} · 📍 ${meta.spot} · ${fmt(meta.caught)} prises<br><small>${fd(meta.t)}</small>` : 'Vide.', '',
      `<div class="row">${btn('saveSlot', n, '💾 Sauvegarder', 'buy')}${meta ? btn('loadSlot', n, '📂 Charger', 'sell') + btn('deleteSlot', n, '🗑️', 'ghost') : ''}</div>`)).join('');
    return `<div class="cards">
      ${card({ icon: '▶️', style: 'background:#e6f7ea' }, 'Reprendre la partie', 'Retour à la pêche. Roger ne bouge pas, il attend.', '', btn('close', '', 'Reprendre', 'big'))}
      ${card({ icon: '⚡', style: 'background:#fff3e0' }, 'Sauvegarde rapide', 'La partie est déjà sauvegardée automatiquement toutes les 10 secondes (dans ce navigateur). Les emplacements ci-dessous servent à garder plusieurs parties ou des points de retour.', '', btn('quickSave', '', 'Sauvegarder', 'buy'))}
    </div>
    <h3>📂 Emplacements de sauvegarde</h3><div class="cards">${slots}</div>
    <h3>📤 Fichier de sauvegarde</h3><div class="cards">
      ${card({ icon: '📤', style: 'background:#eef5e6' }, 'Exporter', 'Télécharge ta partie dans un fichier (pour la garder ou la transférer).', '', btn('exportSave', '', 'Exporter', 'ghost'))}
      ${card({ icon: '📥', style: 'background:#eef5e6' }, 'Importer', 'Charge une partie depuis un fichier exporté. Elle remplace la partie en cours.', '', btn('importPick', '', 'Importer', 'ghost'))}
    </div>
    <h3>🗑️ Nouvelle partie</h3><div class="cards">${card({ icon: '🗑️', style: 'background:#ffe3e3' }, 'Recommencer à zéro', 'Efface la partie en cours (les emplacements sont conservés) et repart avec une simple canne. Tu peux sauvegarder avant.', '', btn('newGame', '', 'Nouvelle partie', 'ghost'))}</div>`;
  }

  function renderRpg(G_, S) {
    const bars = ['fish', 'cook'].map((t) => {
      const i = G_.lvlInfo(t);
      return `<div class="lvlbox"><div class="lvlhead"><b>${t === 'cook' ? '👨‍🍳 Cuisine' : '⭐ Pêche'} · niveau ${i.lvl}${i.max ? ' (max)' : ''}</b><span>${i.title}</span></div>
        <div class="pbar big"><div style="width:${i.pct}%"></div></div><div class="lvlfoot"><span>${i.max ? fmt(i.xp) + ' XP' : fmt(i.cur) + ' / ' + fmt(i.need) + ' XP'}</span><span class="${i.pts ? 'ptsok' : ''}">${i.pts} point${i.pts > 1 ? 's' : ''} de compétence</span></div></div>`;
    }).join('');
    const tree = (t) => D.skills.filter((k) => k.tree === t).map((k) => {
      const n = S.rpg.skills[k.id] || 0, lv = G_.treeLvl(t), lockd = lv < k.lvl, full = n >= k.max, nopts = G_.skillPts(t) <= 0;
      const pips = Array.from({ length: k.max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
      return card({ icon: k.icon, style: 'background:#f3ecfb' }, k.name, k.desc, `<span class="pips">${pips}</span>${lockd ? `<span class="lvlreq no">${t === 'cook' ? '👨‍🍳' : '⭐'} Niv. ${k.lvl}</span>` : ''}`,
        full ? '<button class="btn" disabled>Max</button>' : btn('buySkill', k.id, lockd ? '🔒' : '+1', 'buy', lockd || nopts), lockd ? 'locked' : '');
    }).join('');
    const pk = G_.perks();
    const act = Object.keys(PERK_LABEL).filter((k) => pk[k] > 0.0001).map((k) => `<span class="perk">${PERK_LABEL[k][0]} <b>${perkVal(k, pk[k]) || '✓'}</b></span>`).join('');
    return `${bars}<h3>🎣 Compétences de pêche</h3><div class="cards">${tree('fish')}</div><div class="center">${btn('respec', 'fish', 'Oublier mes compétences de pêche (' + fmt(150 * G_.treeLvl('fish')) + ' 🪙)', 'ghost')}</div>
      <h3>👨‍🍳 Compétences de cuisine</h3><div class="cards">${tree('cook')}</div><div class="center">${btn('respec', 'cook', 'Oublier mes compétences de cuisine (' + fmt(150 * G_.treeLvl('cook')) + ' 🪙)', 'ghost')}</div>
      <h3>✨ Bonus actifs (matériel + compétences + plats)</h3><div class="perkbox">${act || '<span class="src">Aucun bonus pour le moment. Achète du matériel, apprends des compétences ou mange un bon plat.</span>'}</div>`;
  }

  function renderCarnet(G_, S) {
    if (tab === 'rpg') return renderRpg(G_, S);
    if (tab === 'dex') {
      const all = Object.keys(G_.fishById).length, known = Object.keys(S.dex).length;
      return `<p class="intro">${known}/${all} espèces découvertes. Les indices (profondeur, nuit, météo) aident à trouver les autres.</p>` +
        D.spots.map((sp) => `<div class="dex-spot"><h3>${S.spots.includes(sp.id) ? '' : '🔒 '}${sp.name}</h3><div class="dex-grid">` +
          sp.fish.map((a) => {
            const f = G_.fishById[a[0]], d = S.dex[f.id];
            const hints = `${D.depths[f.depth].icon}${f.night ? ' 🌙' : ''}${f.weather ? ' ' + D.weathers[f.weather].icon : ''}${f.lsd ? ' 🌈' : ''}${f.zone ? ' ' + D.zones.find((z) => z.id === f.zone).icon : ''}`;
            return d
              ? `<div class="dex-item"><div class="n">${f.name}</div>${tag(f.rarity)} <span class="hint">${hints}</span><div>×${d.n} · record ${fmtKg(d.best)}</div><div class="beh">${D.behaviors[f.beh].label}</div></div>`
              : `<div class="dex-item unknown"><div class="n">???</div>${tag(f.rarity)} <span class="hint">${hints}</span><div>Pas encore pêché</div></div>`;
          }).join('') + '</div></div>').join('');
    }
    if (tab === 'succes') {
      const n = Object.keys(S.achievements).length;
      return `<p class="intro">${n}/${D.achievements.length} succès débloqués.</p><div class="ach-grid">` + D.achievements.map((a) => {
        const ok = !!S.achievements[a.id];
        return `<div class="ach ${ok ? 'ok' : ''}"><div class="n">${ok ? '🏆' : '🔒'} ${a.name}</div><div>${a.desc}</div><div class="r">+${fmt(a.reward)} 🪙${a.cos ? ' · 🎁 ' + G_.cosById(a.cos).name : ''}</div></div>`;
      }).join('') + '</div>';
    }
    if (tab === 'aquarium') {
      if (!S.aquarium.length) return `<div class="empty">L'aquarium est vide (0/${G_.aquaCap()}). Garde un poisson depuis l'étal de La Josiane (bouton 🐠). Il nagera sur le ponton pour toujours. Ou jusqu'à ce que tu le vendes.</div>`;
      return `<p class="intro">${S.aquarium.length}/${G_.aquaCap()} pensionnaires. Ils nagent sur le ponton, à côté de toi.</p><div class="cards">` + S.aquarium.map((it, j) => {
        const f = G_.fishById[it.id];
        return card({ icon: fishIcon(f), style: `background:${f.color}` }, `${f.name} ${tag(f.rarity)}`, f.desc, `<span>⚖️ ${fmtKg(it.w)}</span>`,
          `${price(it.price * G_.sellMult())}<div class="row">${btn('aquaSell', j, 'Vendre', 'sell')}${btn('aquaRelease', j, 'Relâcher', 'ghost')}</div>`);
      }).join('') + '</div>';
    }
    if (tab === 'roger') {
      const L = D.roger.levels, lvl = S.roger.lvl, next = L[lvl + 1];
      return `<div class="speech">Roger est ton caillou préféré. Toutes les loutres de mer en ont un, qu'elles gardent sous le bras. Roger, lui, a des yeux. Offre-lui des poissons depuis l'étal de La Josiane (bouton 🪨) : il gagne de l'expérience égale à leur valeur.</div>
        <div class="goal">🪨 Niveau <b>${lvl + 1}/${L.length}</b> · ${fmt(S.roger.xp)} XP${next ? ` / ${fmt(next)}` : ' (max)'}${next ? bar(S.roger.xp - L[lvl], next - L[lvl]) : ''}</div>
        <ul class="qlist">${D.roger.perks.map((p, i) => `<li>${i <= lvl ? '✅' : '🔒'} Niv. ${i + 1} : ${p}</li>`).join('')}</ul>`;
    }
    if (tab === 'options') {
      const st = S.stats;
      return `<div class="cards">
        ${card({ icon: '🎵', style: 'background:#f5eefc' }, 'Musique', 'Mélodies générées pour chaque coin, plus calmes la nuit.', '', btn('toggleMusic', '', S.opts.music ? 'Couper' : 'Activer', 'ghost'))}
        ${card({ icon: '🔊', style: 'background:#f5eefc' }, 'Effets sonores', 'Plouf, ding, crac, cri de mouette.', '', btn('toggleSfx', '', S.opts.sfx ? 'Couper' : 'Activer', 'ghost'))}
        ${card({ icon: '🌈', style: 'background:#f5eefc' }, 'Voyages en douceur', 'Réduit les mouvements (zoom, roulis, vagues) pendant les hallucinations. Les couleurs restent.', '', btn('toggleSoftTrip', '', S.opts.softTrip ? 'Désactiver' : 'Activer', 'ghost'))}
        ${card({ icon: '🖱️', style: 'background:#f5eefc' }, 'Caméra', 'Clic droit + glisser : tourner · Maj + clic droit (ou clic molette) : déplacer · Molette : zoom · Clic droit simple ou touche R : recentrer.', '', '')}
        </div>
        <h3>📊 Statistiques</h3>
        <div class="statgrid">
          <span>Prises</span><b>${fmt(st.caught)}</b><span>Déchets</span><b>${fmt(st.junk)}</b><span>Lancers</span><b>${fmt(st.casts)}</b>
          <span>Lignes cassées</span><b>${fmt(st.snaps)}</b><span>Évasions</span><b>${fmt(st.escapes)}</b><span>Touches ratées</span><b>${fmt(st.misses)}</b>
          <span>Pièces gagnées</span><b>${fmt(st.earned)}</b><span>Pièces dépensées</span><b>${fmt(st.spent)}</b><span>Record de poids</span><b>${fmtKg(st.maxW)}</b>
          <span>Mouettes chassées</span><b>${fmt(st.gullsChased)}</b><span>Poissons volés</span><b>${fmt(st.gullsStolen)}</b><span>Bouteilles</span><b>${fmt(st.bottles)}</b>
          <span>Poissons LSD mangés</span><b>${fmt(st.eaten || 0)}</b><span>Voyage max</span><b>${st.tripMax || 0}/3</b><span>Concours gagnés</span><b>${fmt(st.contests)}</b>
        </div>
        <div class="reset">${btn('reset', '', '🗑️ Tout recommencer (même la honte)', 'ghost')}</div>`;
    }
    return '';
  }

  function renderMerchant(G_, S) {
    const m = G_.merchant();
    if (!m) return '<div class="empty">Le Marchand Louche est parti. Il n\'a laissé qu\'une odeur de trench-coat mouillé.</div>';
    if (!m.stock.length) return '<div class="empty">« Plus rien. T\'as tout pris. Je t\'aime bien, toi. » — Le Marchand Louche</div>';
    return `<p class="intro">Il repart dans ${Math.ceil(m.t)} s. Articles uniques, introuvables ailleurs, et sans garantie.</p><div class="cards">` + m.stock.map((it, i) => {
      const c = it.type === 'cos' ? G_.cosById(it.id) : null;
      const name = c ? c.name : it.name;
      const desc = c ? c.desc : it.type === 'bait' ? byBait('b5').desc : it.type === 'box' ? 'Contient « un truc ». Peut-être génial. Peut-être une chaussette.' : 'Ta prochaine touche « au hasard » sera forcément rare ou mieux.';
      return card({ icon: { cos: '🎁', bait: '💀', box: '📦', treasure: '🗺️' }[it.type], style: 'background:#ede7f6' }, name, desc, '', price(it.cost) + btn('buyMerchant', i, 'Acheter', 'buy', !can(it.cost)));
    }).join('') + '</div>';
  }
  const byBait = (id) => D.baits.find((b) => b.id === id);

  G.ui = { confirm: confirmBox, say, toast, updateHUD, updateTicker, updateContest, openPanel, closePanel, isOpen, refresh, panel: () => panel, showCatch, hideCatch, setCatchButton };
})();
