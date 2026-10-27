// Audio : effets synthétisés + musique générative par spot + ambiance pluie
(() => {
  let AC = null, master = null, sfxBus = null, musicBus = null, rainGain = null;
  let sfxOn = true, musicOn = true;
  let mood = { scale: [0, 2, 4, 7, 9], root: 60, bpm: 90 }, night = false;
  let nextBeat = 0, beat = 0, chord = 0, timer = null, trip = 0;

  function ensure() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; return; }
    master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination);
    sfxBus = AC.createGain(); sfxBus.gain.value = sfxOn ? 1 : 0; sfxBus.connect(master);
    musicBus = AC.createGain(); musicBus.gain.value = musicOn ? 0.11 : 0; musicBus.connect(master);
    // pluie : bruit blanc filtré en boucle
    const buf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.6;
    rainGain = AC.createGain(); rainGain.gain.value = 0;
    src.connect(f).connect(rainGain).connect(sfxBus); src.start();
    nextBeat = AC.currentTime + 0.2;
    timer = setInterval(schedule, 60);
  }

  function tone(freq, dur, type, vol, slide, when, bus, attack) {
    if (!AC) return;
    const t = when || AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (trip > 0 && bus === musicBus) o.detune.setValueAtTime((Math.random() - 0.5) * 70 * trip, t); // voyage : les notes se déforment
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    const a = attack || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freqFrom, freqTo) {
    if (!AC) return;
    const t = AC.currentTime;
    const buf = AC.createBuffer(1, AC.sampleRate * dur, AC.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = AC.createBufferSource(); src.buffer = buf;
    const f = AC.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(freqFrom, t); f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    const g = AC.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(sfxBus); src.start(t);
  }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const sfx = {
    plop: () => tone(520, 0.18, 'sine', 0.22, -380),
    bite: () => { tone(880, 0.08, 'square', 0.07); setTimeout(() => tone(1175, 0.1, 'square', 0.07), 90); },
    snap: () => { tone(240, 0.35, 'sawtooth', 0.12, -180); noise(0.2, 0.2, 3000, 300); },
    escape: () => tone(400, 0.3, 'triangle', 0.12, -250),
    catch: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.15), i * 85)),
    legend: () => [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.14), i * 110)),
    coin: () => { tone(1250, 0.07, 'square', 0.05); setTimeout(() => tone(1660, 0.12, 'square', 0.05), 70); },
    click: () => tone(660, 0.05, 'sine', 0.08),
    tick: () => tone(1800 + Math.random() * 300, 0.02, 'square', 0.02),
    whoosh: () => noise(0.35, 0.12, 600, 3000),
    rattle: () => { for (let i = 0; i < 5; i++) setTimeout(() => tone(200 + Math.random() * 80, 0.04, 'square', 0.05), i * 45); },
    gull: () => { tone(900, 0.18, 'sawtooth', 0.07, 500); setTimeout(() => tone(1100, 0.25, 'sawtooth', 0.07, -400), 200); },
    thunder: () => noise(2.2, 0.5, 800, 40),
    achievement: () => [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sine', 0.12), i * 70)),
    quest: () => [392, 523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.35, 'triangle', 0.12, 0, 0, 0, 0.02), i * 140)),
    horn: () => { tone(220, 0.5, 'sawtooth', 0.06); setTimeout(() => tone(330, 0.6, 'sawtooth', 0.06), 250); },
    pop: () => tone(300, 0.08, 'sine', 0.15, 400),
    boing: () => tone(180, 0.35, 'sine', 0.15, 300),
    sizzle: () => { noise(0.9, 0.09, 6000, 1500); tone(180, 0.15, 'triangle', 0.05); },
    cookDone: () => { tone(1568, 0.5, 'sine', 0.12); setTimeout(() => tone(2093, 0.7, 'sine', 0.1), 130); },
    levelup: () => [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.14), i * 90)),
    trip: () => [392, 494, 587, 784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => tone(f, 0.45, 'sine', 0.1, f * 0.06, 0, 0, 0.02), i * 90)),
  };

  // Musique : nappe d'accords + mélodie pentatonique au hasard + basse
  function schedule() {
    if (!AC || !musicOn) { if (AC) nextBeat = AC.currentTime + 0.1; return; }
    const bpm = mood.bpm * (night ? 0.8 : 1) * (1 - 0.07 * trip);
    const spb = 60 / bpm;
    while (nextBeat < AC.currentTime + 0.3) {
      const sc = mood.scale, root = mood.root - (night ? 12 : 0);
      if (beat % 8 === 0) {
        chord = [0, 3, 4, 2][(beat / 8) % 4 | 0];
        [0, 2, 4].forEach((k) => {
          const deg = sc[(chord + k) % sc.length] + 12 * Math.floor((chord + k) / sc.length);
          tone(mtof(root - 12 + deg), spb * 8, 'sine', 0.05, 0, nextBeat, musicBus, 0.6);
        });
        tone(mtof(root - 24 + sc[chord % sc.length]), spb * 3, 'triangle', 0.09, 0, nextBeat, musicBus, 0.02);
      }
      const p = (night ? 0.3 : 0.55) + trip * 0.15;
      if (Math.random() < p) {
        const deg = sc[Math.floor(Math.random() * sc.length)] + (Math.random() < 0.3 + trip * 0.1 ? 12 : 0);
        const when = nextBeat + (Math.random() < 0.2 ? spb / 2 : 0);
        tone(mtof(root + deg), spb * (Math.random() < 0.3 ? 1.6 : 0.8), night ? 'sine' : 'triangle', 0.07, 0, when, musicBus, 0.01);
        if (trip > 0.3) { // écho psychédélique, une octave plus haut
          tone(mtof(root + deg + 12), spb * 1.2, 'sine', 0.035, 0, when + spb * 0.75, musicBus, 0.02);
          if (trip > 1.5) tone(mtof(root + deg + 7), spb * 1.2, 'sine', 0.025, 0, when + spb * 1.5, musicBus, 0.02);
        }
      }
      nextBeat += spb;
      beat++;
    }
  }

  G.audio = {
    ensure, sfx: new Proxy(sfx, { get: (o, k) => () => { if (AC && sfxOn && o[k]) o[k](); } }),
    setMood(m, isNight) { mood = m; night = isNight; },
    setTrip(l) { trip = l; },
    setRain(level) { if (rainGain) rainGain.gain.setTargetAtTime(level * 0.09, AC.currentTime, 0.8); },
    setSfx(on) { sfxOn = on; if (sfxBus) sfxBus.gain.value = on ? 1 : 0; },
    setMusic(on) { musicOn = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.11 : 0, AC.currentTime, 0.3); },
  };
})();
