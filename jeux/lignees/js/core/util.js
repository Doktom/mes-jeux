// Utilitaires partagés : namespace global, aléatoire déterministe, formatage.
window.G = window.G || {};

G.util = (function () {
  // Générateur pseudo-aléatoire déterministe (mulberry32) : même graine = même carte.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const SUFFIXES = ['', 'k', 'M', 'G', 'T', 'P', 'E'];
  function fmt(n, dec) {
    if (n === Infinity) return '∞';
    if (!isFinite(n)) return '0';
    const neg = n < 0;
    n = Math.abs(n);
    let out;
    if (n < 10 && dec !== 0) out = n.toFixed(dec === undefined ? 1 : dec).replace(/\.0+$/, '');
    else if (n < 1000) out = Math.floor(n).toString();
    else {
      const i = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(n) / 3));
      const v = n / Math.pow(1000, i);
      out = (v < 100 ? v.toFixed(1) : Math.floor(v).toString()).replace(/\.0$/, '') + SUFFIXES[i];
    }
    return (neg ? '-' : '') + out;
  }

  // Débits : l'unité (par minute ou par seconde) est un réglage du joueur, par minute par défaut.
  function perMinute() {
    const s = G.meta && G.meta.settings;
    return !s || s.rateUnit !== 'sec';
  }

  function fmtFlow(perSec) {
    const min = perMinute();
    const v = Math.abs(perSec) * (min ? 60 : 1);
    return (v === 0 ? '0' : fmt(v, min ? 1 : 2)) + (min ? '/min' : '/s');
  }

  function fmtRate(n) {
    return (n >= 0 ? '+' : '-') + fmtFlow(n);
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h > 0) return h + 'h ' + String(m).padStart(2, '0') + 'm';
    if (m > 0) return m + 'm ' + String(s).padStart(2, '0') + 's';
    return s + 's';
  }

  function pick(arr, r) { return arr[Math.floor(r() * arr.length)]; }

  function shuffle(arr, r) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  return { rng, fmt, fmtFlow, fmtRate, fmtTime, pick, shuffle, clamp, lerp };
})();
