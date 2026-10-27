// Réseaux électriques.
//
// Les centrales et les relais électriques sont les nœuds du réseau : deux nœuds qui se touchent
// (case voisine haut, bas, gauche ou droite) appartiennent au même réseau. Un bâtiment qui consomme
// de l'électricité doit toucher un nœud ; il rejoint alors son réseau (et relie entre eux les réseaux
// qu'il touche). Chaque réseau partage sa production entre ses consommateurs ; les centrales ne
// brûlent que ce que le réseau demande (veille quand personne n'a besoin de courant).
G.power = (function () {
  let cache = null, cacheKey = '';

  function isNode(b) { const d = G.BUILDINGS[b.type]; return !b.ruined && !!(d.energyOut || d.relay); }
  function isConsumer(b) { return !b.ruined && !!G.BUILDINGS[b.type].energyIn; }

  // Réseaux (mis en cache tant que les bâtiments ne changent pas) : bid → numéro de réseau.
  function networks() {
    const bs = G.run.buildings;
    const key = (G.buildVer || 0) + '|' + bs.reduce((n, b) => n + (b.ruined ? 1 : 0), 0);
    if (cache && key === cacheKey) return cache;
    const parent = {};
    const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
    bs.forEach(b => { if (isNode(b) || isConsumer(b)) parent[b.bid] = b.bid; });
    const linked = new Set();
    for (const b of bs) {
      if (!isNode(b)) continue;
      for (const [dx, dy] of G.economy.DIRS) {
        const n = G.economy.at(b.x + dx, b.y + dy);
        if (!n || parent[n.bid] === undefined) continue;
        if (isNode(n) || isConsumer(n)) { union(b.bid, n.bid); if (isConsumer(n)) linked.add(n.bid); }
      }
    }
    const netOf = {}, ids = new Set();
    for (const b of bs) {
      if (parent[b.bid] === undefined) continue;
      if (isConsumer(b) && !linked.has(b.bid)) continue; // consommateur isolé : non raccordé
      const id = find(b.bid);
      netOf[b.bid] = id; ids.add(id);
    }
    cache = { netOf, count: ids.size };
    cacheKey = key;
    return cache;
  }

  // Facteur météo d'une centrale renouvelable (éolienne, panneaux solaires) selon la saison.
  function weather(d) {
    if (!d.weather) return 1;
    const s = G.economy.season();
    return (d.weather === 'wind' ? s.wind : s.sun) || 1;
  }

  return { networks, isNode, isConsumer, weather };
})();
