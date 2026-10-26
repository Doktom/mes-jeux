// Bulle du chroniqueur (Maître Hulotte) en bas à gauche de la carte.
// Les répliques ordinaires sont espacées pour ne pas bavarder ; les importantes passent en priorité.
G.lore = (function () {
  const GAP = 25;          // secondes minimum entre deux répliques ordinaires
  const EVENT_GAP = 120;   // et entre deux répliques du même événement ordinaire
  const queue = [], lastLine = {}, lastEvent = {};
  let el = null, current = false, lastAt = -1e9, hideTimer = null, checkAt = 0, ambientAt = performance.now() / 1000 + 150;

  function enabled() { return !(G.meta && G.meta.settings && G.meta.settings.lore === false); }
  function now() { return performance.now() / 1000; }

  function say(ev, vars) {
    if (!enabled() || G.offlineSim) return;
    const e = G.LORE.events[ev];
    if (!e) return;
    const t = now();
    if (!e.prio && (current || t - lastAt < GAP || t - (lastEvent[ev] || -1e9) < EVENT_GAP)) return;
    const lines = e.lines;
    let i = Math.floor(Math.random() * lines.length);
    if (lines.length > 1 && i === lastLine[ev]) i = (i + 1) % lines.length;
    lastLine[ev] = i; lastEvent[ev] = t;
    const text = lines[i].replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] !== undefined ? vars[k] : ''));
    if (current) { queue.push(text); if (queue.length > 2) queue.shift(); return; }
    show(text);
  }

  function show(text) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'lore';
      el.title = 'Cliquer pour fermer';
      el.addEventListener('click', hide);
      document.getElementById('center').appendChild(el);
    }
    el.innerHTML = '<span class="lore-face">' + G.LORE.icon + '</span><div><b>' + G.LORE.name + '</b><p></p></div>';
    el.querySelector('p').textContent = text;
    el.classList.remove('out');
    el.classList.add('show');
    current = true; lastAt = now();
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, Math.max(6000, 3500 + text.length * 45));
  }

  function hide() {
    if (!el || !current) return;
    clearTimeout(hideTimer);
    el.classList.add('out');
    el.classList.remove('show');
    current = false;
    if (queue.length) setTimeout(() => { if (!current && queue.length) show(queue.shift()); }, 600);
  }

  // Observations périodiques (stocks pleins, bâtiments en attente de livraison).
  function check() {
    const t = now();
    if (!G.run || G.run.over || t < checkAt) return;
    checkAt = t + 15;
    if (t >= ambientAt) { ambientAt = t + 200 + Math.random() * 140; say(G.run.launched ? 'ambient5' : 'ambient' + G.run.era, {}); }
    const full = G.RESOURCE_ORDER.find(r => !G.RESOURCES[r].uncapped && G.capR && G.capR[r] > 0 && G.run.res[r] >= G.capR[r] - 1);
    if (full) return say('stockFull', {});
    const w = G.run.buildings.find(b => b._waiting && !b.ruined && !b.paused);
    if (w) say('waiting', { building: G.BUILDINGS[w.type].name.toLowerCase(), res: G.RESOURCES[w._waiting].name.toLowerCase() });
  }

  return { say, hide, check };
})();
