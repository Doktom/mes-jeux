// Monde 3D : scène, eau, terres, PNJ, décor par spot, jour/nuit, météo, effets
(() => {
  const { M, mesh, otter, setHat, bobber: makeBobber, roger: makeRoger, fish: makeFish } = G.models;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const atp = (m, x, y, z) => { m.position.set(x, y, z); return m; };
  const faceYaw = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z)); // pour un modèle qui regarde vers -z

  const canvas = document.querySelector('#scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 45, 190);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 700);
  const CAM_OFF = new THREE.Vector3(2.4, 3.2, 4.8);
  const LOOK_OFF = new THREE.Vector3(-0.3, 0.6, -9);

  // Lumières
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd8c8e8, 0.62);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xfff4e0, 0.62);
  sunLight.position.set(18, 30, 12);
  sunLight.target.position.set(0, 0, -8);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunLight.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 });
  scene.add(sunLight, sunLight.target);

  // Ciel
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.15,0.0,1.0); gl_FragColor = vec4(mix(bottom,top,h),1.0); }',
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(450, 20, 12), skyMat));
  const sunMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(13, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
  const moonMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(9, 1), new THREE.MeshBasicMaterial({ color: 0xf3f0ff, fog: false }));
  const sunHalo = new THREE.Mesh(new THREE.IcosahedronGeometry(24, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, fog: false, depthWrite: false }));
  sunMesh.add(sunHalo);
  scene.add(sunMesh, moonMesh);
  const starGeo = new THREE.BufferGeometry();
  {
    const pts = [];
    for (let i = 0; i < 900; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(0.03, 0.8), rand(-1, -0.1)).normalize().multiplyScalar(400);
      pts.push(v.x, v.y, v.z);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  }
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, fog: false, transparent: true, opacity: 0 });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // Eau
  const waterGeo = new THREE.PlaneGeometry(380, 380, 90, 90);
  waterGeo.rotateX(-Math.PI / 2);
  const waterBase = Float32Array.from(waterGeo.attributes.position.array);
  {
    const n = waterGeo.attributes.position.count, cols = new Float32Array(n * 3), pos = waterGeo.attributes.position;
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const k = 0.5 + 0.5 * Math.sin(x * 0.11 + Math.sin(z * 0.07) * 2.0) * Math.cos(z * 0.09 + x * 0.03);
      cols[i * 3] = 0.9 + 0.12 * k; cols[i * 3 + 1] = 0.94 + 0.08 * (1 - k); cols[i * 3 + 2] = 1.0;
    }
    waterGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  }
  const waterMat = new THREE.MeshPhongMaterial({ vertexColors: true, color: 0x88ccff, flatShading: true, shininess: 50, specular: 0x2a2a2a, transparent: true, opacity: 0.84 });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.z = -100;
  water.receiveShadow = true;
  water.renderOrder = 1; // les ombres de poissons (dessous) sont dessinées avant l'eau
  scene.add(water);
  let waveAmp = 1;
  let trip = 0, tripTarget = 0, tripMotion = 1; // voyage psychédélique : niveau lissé (0..3) et intensité des mouvements
  function waveH(x, z, t) {
    return waveAmp * (1 + trip * 0.7 * tripMotion) * (0.12 * Math.sin(x * 0.35 + t * 1.1) + 0.08 * Math.sin(z * 0.5 + t * 1.4) + 0.05 * Math.sin((x + z) * 0.8 + t * 2.1));
  }
  function updateWater(t) {
    const arr = waterGeo.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) arr[i + 1] = waveH(waterBase[i], waterBase[i + 2] + water.position.z, t);
    waterGeo.attributes.position.needsUpdate = true;
  }

  // Terres
  const landMat = new THREE.MeshPhongMaterial({ color: 0xb9e0a5, flatShading: true, shininess: 4 });
  const hillMat = new THREE.MeshPhongMaterial({ color: 0xa9d6b4, flatShading: true, shininess: 4 });
  function landMass(x, z, r, h, seg) {
    const geo = new THREE.CylinderGeometry(r, r * 1.12, h, seg || 14, 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > h / 2 - 0.01) p.setY(i, p.getY(i) + (Math.random() - 0.3) * 0.5);
    const m = new THREE.Mesh(geo, landMat);
    m.position.set(x, 0.5 - h / 2, z);
    m.receiveShadow = true; m.castShadow = true;
    scene.add(m);
  }
  landMass(0, 30, 27, 3, 20);
  landMass(-32, -12, 18, 3, 16);
  landMass(24, -28, 9, 3, 12);
  for (let i = 0; i < 9; i++) {
    const h = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(18, 34), 1), hillMat);
    h.scale.y = rand(0.35, 0.6);
    h.position.set(-140 + i * 36 + rand(-8, 8), -2, rand(-210, -170));
    scene.add(h);
  }

  // Ponton
  const dock = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const plank = mesh(new THREE.BoxGeometry(1.7, 0.12, 0.55), i % 2 ? '#d9b48f' : '#cfa982');
    plank.position.set(rand(-0.03, 0.03), 0.55, 3.6 - i * 0.6);
    plank.rotation.y = rand(-0.03, 0.03);
    dock.add(plank);
  }
  [[-0.75, 3.4], [0.75, 3.4], [-0.75, -1.4], [0.75, -1.4], [-0.75, 1], [0.75, 1]].forEach(([x, z]) => {
    const post = mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.8, 6), '#b08b6a');
    post.position.set(x, -0.2, z); dock.add(post);
  });
  scene.add(dock);

  // ---------------------------------------------------------------- Rig du joueur (ponton ou bateau)
  const rig = new THREE.Group();
  scene.add(rig);
  const hero = otter({ vest: '#ffa36c', hat: 'hat_bob' });
  hero.group.position.set(0, 0.6, -1.0);
  hero.group.rotation.y = -0.3;
  rig.add(hero.group);
  hero.armR.rotation.x = -1.15;
  hero.armL.rotation.x = -0.9; hero.armL.rotation.z = -0.4;

  const rodPivot = new THREE.Group();
  rodPivot.position.set(0.34, 0.6, -0.42);
  hero.root.add(rodPivot);
  const rodMat = new THREE.MeshPhongMaterial({ color: 0xc9a27e, flatShading: true, shininess: 30 });
  const rodStick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.045, 2.8, 5), rodMat);
  rodStick.position.y = 1.4; rodStick.castShadow = true;
  const rodHandle = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.45, 6), '#6d5a7a'); rodHandle.position.y = 0.05;
  const rodReel = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8), '#e0e0e0'); rodReel.rotation.z = Math.PI / 2; rodReel.position.set(0.08, 0.3, 0);
  const rodTip = new THREE.Object3D(); rodTip.position.y = 2.8;
  rodPivot.add(rodStick, rodHandle, rodReel, rodTip);

  let rogerObj = makeRoger(0);
  rogerObj.position.set(-0.85, 0.61, -0.55);
  rig.add(rogerObj);

  let boat = G.models.boatModel(1);
  boat.position.set(0, 0.25, -1.0); boat.rotation.y = 0.2;
  boat.visible = false;
  rig.add(boat);
  let boatMode = false, zoneDepthK = 0, curDeck = 0.07;

  // Bouchon & ligne
  const bobber = new THREE.Group();
  let bobberSkin = makeBobber('bob_classique');
  bobber.add(bobberSkin);
  scene.add(bobber);
  const LINE_N = 24;
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_N * 3), 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  line.frustumCulled = false;
  scene.add(line);
  const tmpV = new THREE.Vector3();
  function updateLine(tip, bob, sag, visible) {
    const arr = lineGeo.attributes.position.array;
    for (let i = 0; i < LINE_N; i++) {
      const t = i / (LINE_N - 1);
      tmpV.lerpVectors(tip, bob, t);
      tmpV.y -= sag * Math.sin(Math.PI * t);
      arr[i * 3] = tmpV.x; arr[i * 3 + 1] = tmpV.y; arr[i * 3 + 2] = tmpV.z;
    }
    lineGeo.attributes.position.needsUpdate = true;
    line.visible = visible;
  }

  // ---------------------------------------------------------------- PNJ
  const clickables = [];
  function clickable(obj, id) { obj.userData.clickId = id; clickables.push(obj); }
  function unclickable(obj) { const i = clickables.indexOf(obj); if (i >= 0) clickables.splice(i, 1); }

  const market = new THREE.Group();
  market.position.set(-4.8, 0, -0.6);
  market.rotation.y = 0.35;
  market.add(G.models.raft(3.4, 2.2));
  const npcs = {};
  [['josiane', -1.1, '#ff8fb1', { fur: '#a0704c', acc: ['apron'], hat: 'scarf', vest: false }],
   ['jm', 0, '#8fd3c9', { fur: '#8a5a3c', acc: ['moustache'], hat: 'cap', vest: '#6fa8dc' }],
   ['coco', 1.1, '#c5a3e0', { fur: '#b07d58', acc: ['sunglasses', 'bowtie'], hat: 'beret', vest: '#ffffff' }]].forEach(([id, x, col, opts]) => {
    const st = G.models.stall(col); st.position.set(x, 0.25, 0.2); market.add(st);
    const o = otter(opts); o.group.scale.setScalar(0.75); o.group.position.set(x, 0.28, 0.55);
    o.group.rotation.y = Math.PI; market.add(o.group);
    npcs[id] = o; clickable(o.group, id); clickable(st, id);
  });
  const board = new THREE.Group();
  board.add(atp(mesh(new THREE.BoxGeometry(1.1, 0.75, 0.06), '#c9a27e'), 0, 1.1, 0));
  const boardLabel = G.models.label('📜 COMMANDES', 1.0, 0.3, '#fffaf0', '#4a4060'); boardLabel.position.set(0, 1.3, 0.04); boardLabel.rotation.y = Math.PI;
  board.add(boardLabel);
  for (let i = 0; i < 3; i++) board.add(atp(mesh(new THREE.BoxGeometry(0.25, 0.28, 0.02), ['#fff59d', '#ffccbc', '#c5e1a5'][i]), -0.32 + i * 0.32, 0.95, -0.04));
  board.add(atp(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 4), '#8d6e63'), -0.5, 0.6, 0));
  board.add(atp(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 4), '#8d6e63'), 0.5, 0.6, 0));
  board.position.set(1.9, 0.2, -0.3); board.rotation.y = Math.PI - 0.5;
  market.add(board); clickable(board, 'board');
  scene.add(market);

  // Marché aux Saveurs : Marguerite (ingrédients, matériel) et Chef Gaston (recettes) sur un second radeau
  const market2 = new THREE.Group();
  market2.position.set(-3.6, 0, -5.4);
  market2.rotation.y = 0.55;
  market2.add(G.models.raft(3.2, 2.2));
  [['marguerite', -0.9, '#ffd166', { fur: '#9a6b4a', acc: ['apron'], hat: 'hat_paille', vest: false }],
   ['gaston', 0.9, '#ef5350', { fur: '#7b5233', acc: ['moustache', 'apron'], hat: 'hat_toque', vest: '#ffffff' }]].forEach(([id, x, col, opts]) => {
    const st = G.models.stall(col); st.position.set(x, 0.25, 0.2); market2.add(st);
    const o = otter(opts); o.group.scale.setScalar(0.75); o.group.position.set(x, 0.28, 0.55); o.group.rotation.y = Math.PI; market2.add(o.group);
    npcs[id] = o; clickable(o.group, id); clickable(st, id);
  });
  [[-1.25, 1.0, '#8bc34a'], [-0.7, 1.05, '#ff8a65'], [-0.2, 0.95, '#ffd54f'], [0.55, 1.05, '#ba68c8']].forEach(([x, z, c]) => { // cageots de légumes
    market2.add(atp(mesh(new THREE.BoxGeometry(0.4, 0.22, 0.34), '#c9a27e'), x, 0.36, z));
    for (let i = 0; i < 3; i++) market2.add(atp(mesh(new THREE.SphereGeometry(0.1, 6, 5), c), x - 0.1 + i * 0.1, 0.52, z + (i % 2) * 0.05));
  });
  scene.add(market2);

  // Cuisine flottante : le matériel acheté apparaît ici (réchaud, poêle, marmite, fumoir…)
  const kitchen = new THREE.Group();
  kitchen.position.set(6.2, 0, -2.4);
  kitchen.rotation.y = -0.75;
  kitchen.add(G.models.raft(2.8, 2.2));
  const kitSign = G.models.label('CUISINE', 1.3, 0.36, '#fffaf0', '#4a4060'); kitSign.position.set(0, 1.9, -0.6); kitSign.rotation.y = Math.PI; kitchen.add(kitSign);
  [-0.65, 0.65].forEach((x) => kitchen.add(atp(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.7, 5), '#8d6e63'), x, 1.05, -0.6)));
  const kitGear = new THREE.Group(); kitchen.add(kitGear);
  const steam = [];
  for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); s.visible = false; kitchen.add(s); steam.push({ m: s, t: i / 7 }); }
  let cookingN = 0;
  clickable(kitchen, 'kitchen');
  scene.add(kitchen);
  function refreshKitchen(ck, utensils) {
    while (kitGear.children.length) { const c = kitGear.children[0]; kitGear.remove(c); }
    const add = (m, x, y, z) => { kitGear.add(atp(m, x, y, z)); return m; };
    // table de préparation
    add(mesh(new THREE.BoxGeometry(2.3, 0.1, 0.9), '#d9b48f'), 0, 0.85, 0);
    [[-1.05, -0.35], [1.05, -0.35], [-1.05, 0.35], [1.05, 0.35]].forEach(([x, z]) => add(mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), '#b08b6a'), x, 0.52, z));
    if (ck.stove > 0) { // réchaud : plus il est gros, plus il a de feux et de cheminée
      const cols = ['#b0a090', '#e57373', '#fff3e0', '#455a64', '#ffd54f'];
      const col = cols[ck.stove - 1];
      add(mesh(new THREE.BoxGeometry(0.2 + ck.stove * 0.1 + 0.5, 0.34 + ck.stove * 0.04, 0.7), col), -0.6, 1.07, 0);
      for (let i = 0; i < Math.min(4, ck.stove + 1); i++) add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 8), '#212121'), -0.6 - 0.2 + (i % 2) * 0.32 + (i > 1 ? 0.0 : 0), 1.27 + ck.stove * 0.02, (i > 1 ? 0.18 : -0.12));
      if (ck.stove >= 3) add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 6), '#90a4ae'), -0.85, 1.65, -0.25);
      if (ck.stove >= 5) add(mesh(new THREE.OctahedronGeometry(0.16, 0), '#fff59d', { emissive: 0x665500 }), -0.6, 1.62, 0.1);
    }
    const apps = ck.apps || [];
    if (apps.includes('poele')) { add(mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.05, 10), '#37474f'), -0.62, 1.32, -0.12); add(mesh(new THREE.BoxGeometry(0.28, 0.03, 0.05), '#37474f'), -0.38, 1.33, -0.12); }
    if (apps.includes('marmite')) { add(mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.24, 9), '#9e9e9e'), -0.33, 1.4, 0.18); add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 9), '#757575'), -0.33, 1.54, 0.18); }
    if (apps.includes('gril')) { add(mesh(new THREE.BoxGeometry(0.5, 0.18, 0.34), '#37474f'), 0.35, 1.0, 0.1); for (let i = 0; i < 5; i++) add(mesh(new THREE.BoxGeometry(0.02, 0.02, 0.32), '#bdbdbd'), 0.15 + i * 0.1, 1.11, 0.1); }
    if (apps.includes('four')) { add(mesh(new THREE.BoxGeometry(0.62, 0.5, 0.5), '#8d6e63'), 0.85, 1.15, -0.1); add(mesh(new THREE.BoxGeometry(0.4, 0.28, 0.02), '#ffcc80', { emissive: 0x663300 }), 0.85, 1.12, 0.16); }
    if (apps.includes('fumoir')) { add(mesh(new THREE.BoxGeometry(0.4, 0.8, 0.4), '#5d4037'), 1.45, 0.75, -0.25); add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), '#424242'), 1.5, 1.35, -0.25); }
    if (apps.includes('mixeur')) { add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 8), '#546e7a'), 0.05, 0.96, 0.22); add(mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.3, 8), '#b3e5fc'), 0.05, 1.16, 0.22); }
    if (apps.includes('siphon')) { add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 8), '#e0e0e0', { emissive: 0x222244 }), 0.35, 1.08, 0.28); add(mesh(new THREE.SphereGeometry(0.07, 8, 6), '#7e57c2', { emissive: 0x2a1a55 }), 0.35, 1.3, 0.28); }
    const kn = ck.knife || 0, kcols = ['#9e9e9e', '#cfd8dc', '#eceff1', '#212121', '#ffd54f'], ut = utensils || [];
    if (ut.includes('planche')) add(mesh(new THREE.BoxGeometry(0.55, 0.04, 0.34), '#e8c99a'), -0.1, 0.92, -0.2);
    if (kn > 0) {
      add(mesh(new THREE.BoxGeometry(0.34, 0.015, 0.06), kcols[kn - 1], kn >= 5 ? { emissive: 0x665500 } : undefined), -0.05, 0.96, -0.2);
      add(mesh(new THREE.BoxGeometry(0.1, 0.03, 0.05), '#6d4c41'), -0.26, 0.96, -0.2);
    }
    if (ut.includes('ecailleur')) add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 6), '#b0bec5'), 0.18, 0.99, -0.28).rotation.z = Math.PI / 2;
    if (ut.includes('bol')) add(mesh(new THREE.SphereGeometry(0.13, 8, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#ffffff'), 0.5, 0.97, -0.25);
    if (ut.includes('mortier')) add(mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.1, 8), '#8d6e63'), 0.75, 0.95, -0.28);
    if (ut.includes('rouleau')) add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 6), '#d9b48f'), 1.0, 0.94, -0.12).rotation.z = Math.PI / 2;
  }
  function setCooking(n) { cookingN = n; }
  function updateKitchen(T, dt) {
    steam.forEach((s) => {
      s.m.visible = cookingN > 0;
      if (!cookingN) return;
      s.t = (s.t + dt * 0.35) % 1;
      s.m.position.set(-0.6 + Math.sin(s.t * 9 + T) * 0.1, 1.5 + s.t * 1.1, 0.0);
      s.m.scale.setScalar(0.5 + s.t * 1.6);
      s.m.material.opacity = 0.55 * (1 - s.t);
    });
  }

  // Tonton Gérard fait la planche
  const gerard = otter({ fur: '#b39a86', belly: '#f5efe6', dark: '#8d7b6b', acc: ['beard', 'shell'], vest: false });
  gerard.group.rotation.x = Math.PI / 2 - 0.15;
  const gerardWrap = new THREE.Group(); gerardWrap.add(gerard.group);
  gerardWrap.position.set(3.6, 0, -4.6);
  gerard.group.position.y = 0.35;
  scene.add(gerardWrap); npcs.gerard = gerard; clickable(gerardWrap, 'gerard');

  // Brandon sur son radeau
  const brandonRaft = new THREE.Group();
  brandonRaft.add(G.models.raft(1.8, 1.6));
  const brandon = otter({ fur: '#6d4a33', acc: ['headband', 'sunglasses'], vest: '#ef5350' });
  brandon.group.position.set(0, 0.28, 0); brandon.group.scale.setScalar(0.85);
  brandon.armR.rotation.x = -1.2;
  const bRod = mesh(new THREE.CylinderGeometry(0.015, 0.035, 2.2, 5), '#ffd54f'); bRod.position.set(0.3, 1.5, -0.8); bRod.rotation.x = -0.9;
  brandonRaft.add(brandon.group, bRod);
  const bFlag = G.models.label('#1', 0.5, 0.3, '#ef5350', '#ffffff'); bFlag.position.set(-0.7, 1.4, 0.5); brandonRaft.add(bFlag);
  brandonRaft.add(atp(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 4), '#ffffff'), -0.7, 0.9, 0.5));
  brandonRaft.position.set(8.5, 0, -8);
  brandonRaft.rotation.y = 0.4;
  scene.add(brandonRaft); npcs.brandon = brandon; clickable(brandonRaft, 'brandon');

  clickable(rogerObj, 'roger');

  // Aquarium
  const tank = G.models.tank();
  tank.position.set(-0.5, 0.61, 0.35); tank.scale.setScalar(0.65);
  tank.rotation.y = 0.2;
  scene.add(tank); clickable(tank, 'aquarium');
  let tankFish = [];
  function refreshAquarium(list) {
    const inner = tank.userData.inner;
    while (inner.children.length) inner.remove(inner.children[0]);
    tankFish = list.map((it, i) => {
      const f = G.fishById[it.id];
      const m = makeFish(f, it.w);
      m.scale.multiplyScalar(0.16 / Math.max(0.4, m.scale.x));
      inner.add(m);
      return { m, ph: i * 1.7 + Math.random(), sp: rand(0.6, 1.1), y: rand(-0.12, 0.12) };
    });
  }

  // Déco ponton
  const DECO_POS = {
    deco_panneau: [-0.8, 0.61, 3.0, 0.5], deco_chaise: [0.35, 0.61, 2.7, 0.3], deco_nain: [-0.58, 0.61, 1.7, 0.6],
    deco_guirlande: [0, 0, 0, 0], deco_flamant: [10.5, 0, -5.5, 0.7], deco_bbq: [0.5, 0.61, 3.4, 0], deco_statue: [-0.55, 0.61, 3.45, 0.5],
  };
  const decoObjs = {};
  let bulbs = [];
  function refreshDeco(list) {
    Object.keys(decoObjs).forEach((k) => { if (!list.includes(k)) { scene.remove(decoObjs[k]); delete decoObjs[k]; } });
    list.forEach((id) => {
      if (decoObjs[id]) return;
      const o = G.models.decoItem(id);
      const p = DECO_POS[id] || [0, 0.61, 2, 0];
      o.position.set(p[0], p[1], p[2]); o.rotation.y = p[3];
      scene.add(o); decoObjs[id] = o;
    });
    bulbs = decoObjs.deco_guirlande ? decoObjs.deco_guirlande.userData.bulbs : [];
  }

  // ---------------------------------------------------------------- Décor par spot
  let deco = new THREE.Group();
  scene.add(deco);
  let decoAnim = [];
  function landPoint() {
    if (Math.random() < 0.62) {
      const a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * 15;
      return [-32 + Math.abs(Math.cos(a)) * d, -12 + Math.sin(a) * d];
    }
    const a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * 7;
    return [24 + Math.cos(a) * d, -28 + Math.sin(a) * d];
  }
  function varyColor(hex) {
    const c = new THREE.Color(hex), hsl = {};
    c.getHSL(hsl); c.setHSL((hsl.h + rand(-0.045, 0.045) + 1) % 1, Math.min(1, hsl.s * rand(0.95, 1.25)), clamp01(hsl.l + rand(-0.05, 0.07)));
    return '#' + c.getHexString();
  }
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  function tree(x, z, s, kind, c1, c2) {
    c1 = varyColor(c1);
    const t = new THREE.Group();
    const trunk = mesh(new THREE.CylinderGeometry(0.12 * s, 0.2 * s, 1.2 * s, 5), c2);
    trunk.position.y = 0.6 * s; t.add(trunk);
    if (kind === 'pine') {
      for (let i = 0; i < 3; i++) { const c = mesh(new THREE.ConeGeometry((1.1 - i * 0.28) * s, 1.3 * s, 6), c1); c.position.y = (1.3 + i * 0.65) * s; t.add(c); }
    } else if (kind === 'weep') {
      const c = mesh(new THREE.ConeGeometry(1.2 * s, 2.6 * s, 7), c1); c.position.y = 2.0 * s; c.rotation.x = Math.PI; t.add(c);
    } else if (kind === 'palm') {
      trunk.scale.set(0.7, 2.4, 0.7); trunk.position.y = 1.4 * s;
      for (let i = 0; i < 6; i++) {
        const geo = new THREE.BoxGeometry(1.6 * s, 0.06 * s, 0.4 * s); geo.translate(0.8 * s, 0, 0);
        const leaf = mesh(geo, c1); leaf.position.y = 2.9 * s; leaf.rotation.y = (i / 6) * Math.PI * 2; leaf.rotation.z = -0.35; t.add(leaf);
      }
    } else if (kind === 'kelp') {
      trunk.visible = false;
      for (let i = 0; i < 4; i++) { const k = mesh(new THREE.CylinderGeometry(0.06 * s, 0.1 * s, 3 * s, 4), c1); k.position.set(rand(-0.4, 0.4) * s, 1.5 * s, rand(-0.4, 0.4) * s); k.rotation.z = rand(-0.2, 0.2); t.add(k); }
    } else {
      const c = mesh(new THREE.IcosahedronGeometry(1 * s, 0), c1); c.position.y = 1.8 * s; t.add(c);
    }
    t.position.set(x, 0.5, z); t.rotation.y = Math.random() * 6;
    deco.add(t); return t;
  }
  function rock(x, z, s, c) {
    const r = mesh(new THREE.DodecahedronGeometry(s, 0), c);
    r.position.set(x, 0.2 + s * 0.3, z); r.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    deco.add(r); return r;
  }
  function cloud(x, y, z, s, c = '#ffffff') {
    if (c === '#ffffff') c = pick(['#ffffff', '#fff0f6', '#eef6ff', '#fff8e6', '#f3eaff']);
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(1.5, 2.6) * s, 0), M(c, { emissive: 0x222222 }));
      p.position.set((i - 1.5) * 2.2 * s, rand(-0.5, 0.6) * s, rand(-0.8, 0.8) * s); g.add(p);
    }
    g.position.set(x, y, z); deco.add(g);
    const speed = rand(0.6, 1.4);
    decoAnim.push((t, dt) => { g.position.x += speed * dt; if (g.position.x > 160) g.position.x = -160; });
    return g;
  }
  function floater(obj, x, z, amp = 1, spin = 0) {
    obj.position.set(x, 0, z); deco.add(obj);
    const ph = Math.random() * 6;
    decoAnim.push((t) => { obj.position.y = waveH(x, z, t) * amp + 0.05; obj.rotation.z = Math.sin(t + ph) * 0.12; obj.rotation.y += spin * 0.01; });
  }
  function eyes(group, y, z, spread, s = 1) {
    const w1 = mesh(new THREE.SphereGeometry(0.22 * s, 7, 5), '#ffffff'); w1.position.set(-spread, y, z);
    const w2 = w1.clone(); w2.position.x = spread;
    const p1 = mesh(new THREE.SphereGeometry(0.11 * s, 6, 4), '#3b2f4a'); p1.position.set(-spread, y, z + 0.17 * s);
    const p2 = p1.clone(); p2.position.x = spread;
    group.add(w1, w2, p1, p2);
  }
  // un « radeau » de loutres de mer qui dorment en se tenant la main
  function otterRaft(x, z, n, fur) {
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const o = otter({ fur: fur || pick(['#9c6b47', '#a0704c', '#8a5a3c', '#b07d58']), vest: false, acc: Math.random() < 0.3 ? ['shell'] : [] });
      o.group.rotation.x = Math.PI / 2 - 0.1;
      o.group.position.set((i - (n - 1) / 2) * 0.8, 0.3, 0);
      o.group.scale.setScalar(0.7);
      o.armL.rotation.z = -1.3; o.armR.rotation.z = 1.3;
      o.eyes.forEach((e) => (e.scale.y = 0.15)); // elles dorment
      g.add(o.group);
    }
    floater(g, x, z, 1, 0.15);
    return g;
  }

  function buildDeco(sp) {
    scene.remove(deco);
    deco.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    deco = new THREE.Group(); scene.add(deco);
    decoAnim = [];
    waveAmp = 1;
    const p = curPal;
    if (sp.deco !== 'cosmique') {
      const FL = ['#ff7ab6', '#ffd166', '#ffffff', '#b794f6', '#ff9a6b', '#6ec1ff'];
      for (let i = 0; i < 52; i++) { // fleurs et buissons sur les berges
        const [fx, fz] = landPoint(), col = pick(FL);
        const fl = new THREE.Group();
        fl.add(atp(mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.35, 4), '#5fae5f'), 0, 0.17, 0));
        fl.add(atp(mesh(new THREE.IcosahedronGeometry(0.11, 0), col, { emissive: 0x111111 }), 0, 0.38, 0));
        fl.add(atp(mesh(new THREE.SphereGeometry(0.045, 5, 4), '#ffe066'), 0, 0.4, 0.07));
        fl.position.set(fx, 0.5, fz); fl.scale.setScalar(rand(0.9, 1.7)); deco.add(fl);
      }
      for (let i = 0; i < 14; i++) { const [bx, bz] = landPoint(); const b = mesh(new THREE.IcosahedronGeometry(rand(0.35, 0.7), 0), varyColor(p.tree)); b.scale.y = 0.7; b.position.set(bx, 0.7, bz); deco.add(b); }
      if (['etang', 'regrets', 'riviere'].includes(sp.deco)) for (let i = 0; i < 16; i++) { // nénuphars
        const pad = new THREE.Group();
        pad.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 10), '#58b368'));
        if (Math.random() < 0.6) { const fo = mesh(new THREE.ConeGeometry(0.16, 0.22, 6), pick(['#ff8fc0', '#ffffff', '#ffd1e8'])); fo.position.y = 0.14; pad.add(fo); }
        floater(pad, rand(-13, 13), rand(-22, -7), 0.6, 0.2);
      }
    }
    if (sp.deco !== 'cosmique') for (let i = 0; i < 7; i++) cloud(rand(-150, 150), rand(26, 45), rand(-200, -60), rand(0.8, 1.6));

    if (sp.deco === 'etang') {
      for (let i = 0; i < 26; i++) { const [x, z] = landPoint(); tree(x, z, rand(0.8, 1.6), Math.random() < 0.55 ? 'pine' : 'round', Math.random() < 0.8 ? p.tree : p.tree2, p.trunk); }
      for (let i = 0; i < 8; i++) { const [x, z] = landPoint(); rock(x, z, rand(0.4, 1), '#d7d0e0'); }
      for (let i = 0; i < 20; i++) { const r = mesh(new THREE.CylinderGeometry(0.03, 0.04, rand(1, 1.8), 4), '#9cc58c'); r.position.set(rand(-15, -12), 0.4, rand(-6, 4)); r.rotation.z = rand(-0.2, 0.2); deco.add(r); }
      const duck = new THREE.Group();
      const db = mesh(new THREE.IcosahedronGeometry(0.9, 0), '#ffe066'); db.scale.set(1.2, 0.8, 1);
      const dh = mesh(new THREE.IcosahedronGeometry(0.5, 0), '#ffe066'); dh.position.set(0.8, 0.8, 0);
      const dbk = mesh(new THREE.ConeGeometry(0.2, 0.4, 4), '#ffa94d'); dbk.rotation.z = -Math.PI / 2; dbk.position.set(1.35, 0.75, 0);
      duck.add(db, dh, dbk);
      floater(duck, 12, -24, 1.2);
      otterRaft(-6, -30, 3);
    } else if (sp.deco === 'regrets') {
      for (let i = 0; i < 22; i++) { const [x, z] = landPoint(); tree(x, z, rand(0.9, 1.5), Math.random() < 0.6 ? 'weep' : 'pine', Math.random() < 0.8 ? p.tree : p.tree2, p.trunk); }
      const chair = new THREE.Group();
      const seat = mesh(new THREE.BoxGeometry(1, 0.1, 1), '#d8cce6'); seat.position.y = 0.9;
      const back = mesh(new THREE.BoxGeometry(1, 1.1, 0.1), '#d8cce6'); back.position.set(0, 1.45, -0.45);
      chair.add(seat, back);
      [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].forEach(([x, z]) => { const l = mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), '#bfb1d1'); l.position.set(x, 0.45, z); chair.add(l); });
      // une loutre triste assise sur la chaise
      const sad = otter({ fur: '#8d7b8f', vest: '#9a8fc4', hat: 'hat_bonnet' });
      sad.group.scale.setScalar(0.8); sad.group.position.set(0, 0.95, 0); sad.group.rotation.y = Math.PI; sad.head.rotation.x = 0.4; chair.add(sad.group);
      chair.position.set(9, -0.3, -20); chair.rotation.y = -0.6; deco.add(chair);
      const rc = cloud(9, 6.5, -20, 0.45, '#a9a3bd'); decoAnim.pop();
      decoAnim.push((t) => { rc.position.y = 6.5 + Math.sin(t) * 0.2; });
    } else if (sp.deco === 'riviere') {
      for (let i = 0; i < 16; i++) { const [x, z] = landPoint(); tree(x, z, rand(0.8, 1.4), 'round', Math.random() < 0.6 ? p.tree : p.tree2, p.trunk); }
      for (let i = 0; i < 14; i++) { const [x, z] = landPoint(); rock(x, z, rand(0.6, 1.6), '#c8b8a8'); }
      [[-7, -17, 1.4], [10, -26, 1.8], [-2, -38, 2.4]].forEach(([x, z, s], i) => {
        const g = new THREE.Group();
        g.add(mesh(new THREE.DodecahedronGeometry(s, 0), '#d6c6b6'));
        eyes(g, s * 0.3, s * 0.82, s * 0.32, s * 0.9);
        const mouth = mesh(new THREE.BoxGeometry(s * 0.5, s * 0.1, 0.1), '#8a6f6a'); mouth.position.set(0, -s * 0.2, s * 0.9); g.add(mouth);
        g.position.set(x, s * 0.3, z); g.lookAt(CAM_OFF.x, s * 0.3, CAM_OFF.z);
        deco.add(g);
        decoAnim.push((t) => { mouth.scale.y = 1 + Math.abs(Math.sin(t * 6 + i * 2)) * 2.5; });
      });
      // une loutre casse un oursin sur son ventre
      const cracker = otterRaft(-10, -12, 1);
      decoAnim.push((t) => { const o = cracker.children[0]; if (o) o.rotation.z = Math.sin(t * 8) * 0.1; });
      waveAmp = 1.3;
    } else if (sp.deco === 'gelee') {
      for (let i = 0; i < 14; i++) { const [x, z] = landPoint(); tree(x, z, rand(0.9, 1.4), Math.random() < 0.7 ? 'palm' : 'kelp', Math.random() < 0.7 ? p.tree : p.tree2, p.trunk); }
      const jellies = ['#a5e8d4', '#ffd180', '#b39ddb', '#80d8ff'];
      for (let i = 0; i < 9; i++) {
        const j = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), M(pick(jellies), { transparent: true, opacity: 0.75, shininess: 80 }));
        j.castShadow = true;
        floater(j, rand(-25, 25), rand(-60, -16), 1.5, 1);
        const ph = Math.random() * 6;
        decoAnim.push((t) => { const k = Math.sin(t * 4 + ph) * 0.08; j.scale.set(1 + k, 1 - k, 1 + k); });
      }
      const cherry = new THREE.Group();
      cherry.add(mesh(new THREE.IcosahedronGeometry(9, 1), '#e53950', { fog: false }));
      const st = mesh(new THREE.CylinderGeometry(0.4, 0.5, 12, 5), '#7cb342', { fog: false }); st.position.set(2, 12, 0); st.rotation.z = -0.3; cherry.add(st);
      cherry.position.set(55, 2, -150); deco.add(cherry);
      otterRaft(-4, -22, 5); otterRaft(14, -40, 4);
      waveAmp = 0.8;
    } else if (sp.deco === 'cosmique') {
      [[-60, 50, -180, 14, '#ff8fb1'], [80, 70, -220, 22, '#80cbc4'], [20, 30, -120, 5, '#ffe08a']].forEach(([x, y, z, r, c], i) => {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), M(c, { emissive: 0x332244, fog: false })));
        if (i !== 2) { const ring = new THREE.Mesh(new THREE.RingGeometry(r * 1.4, r * 1.9, 24), M('#d1c4e9', { side: THREE.DoubleSide, emissive: 0x332244, fog: false })); ring.rotation.x = 1.2; g.add(ring); }
        g.position.set(x, y, z); deco.add(g);
        decoAnim.push((t) => { g.rotation.y = t * 0.1; g.position.y = y + Math.sin(t * 0.3 + i) * 2; });
      });
      for (let i = 0; i < 16; i++) {
        const [x, z] = landPoint();
        const c = mesh(new THREE.OctahedronGeometry(rand(0.6, 1.6), 0), pick(['#80cbc4', '#ff8fb1', '#b39ddb']), { emissive: 0x221133 });
        c.scale.y = 1.8; c.position.set(x, 1.2, z); deco.add(c);
      }
      for (let i = 0; i < 14; i++) {
        const [x, z] = landPoint();
        const h = new THREE.Mesh(new THREE.CircleGeometry(rand(0.5, 1.2), 7), M('#e0b850'));
        h.rotation.x = -Math.PI / 2; h.position.set(x, 0.62, z); deco.add(h);
      }
      // loutre astronaute qui flotte dans le vide
      const astro = otter({ vest: '#eceff1', hat: 'hat_cosmo' });
      astro.group.position.set(-14, 9, -40); deco.add(astro.group);
      decoAnim.push((t) => { astro.group.rotation.z = t * 0.3; astro.group.rotation.x = t * 0.2; astro.group.position.y = 9 + Math.sin(t * 0.5) * 1.5; });
    }
  }

  // ---------------------------------------------------------------- Météo (particules)
  const RAIN_N = 800;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_N * 6);
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xcfe3ff, transparent: true, opacity: 0.38 }));
  rain.frustumCulled = false; rain.visible = false; scene.add(rain);
  const PART_N = 700;
  const partGeo = new THREE.BufferGeometry();
  const partPos = new Float32Array(PART_N * 3), partCol = new Float32Array(PART_N * 3);
  partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
  partGeo.setAttribute('color', new THREE.BufferAttribute(partCol, 3));
  const partMat = new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, opacity: 0.95 });
  const parts = new THREE.Points(partGeo, partMat);
  parts.frustumCulled = false; parts.visible = false; scene.add(parts);
  const meteorGeo = new THREE.BufferGeometry();
  const meteorPos = new Float32Array(10 * 6);
  meteorGeo.setAttribute('position', new THREE.BufferAttribute(meteorPos, 3));
  const meteors = new THREE.LineSegments(meteorGeo, new THREE.LineBasicMaterial({ color: 0xffe0a0, fog: false }));
  meteors.frustumCulled = false; meteors.visible = false; scene.add(meteors);
  const meteorState = Array.from({ length: 10 }, () => ({ x: 0, y: 0, z: 0, life: 0 }));
  let weatherId = 'clair', flashT = 0;

  function areaPoint(i, arr, stride) {
    const cx = rig.position.x, cz = rig.position.z;
    arr[i * stride] = cx + rand(-26, 26);
    arr[i * stride + 1] = rand(0, 18);
    arr[i * stride + 2] = cz + rand(-38, 6);
  }
  function setWeather(id) {
    weatherId = id;
    rain.visible = id === 'pluie' || id === 'orage';
    parts.visible = id === 'confettis' || id === 'sucre';
    meteors.visible = id === 'meteores';
    if (rain.visible) {
      for (let i = 0; i < RAIN_N; i++) { areaPoint(i, rainPos, 6); rainPos[i * 6 + 3] = rainPos[i * 6] + 0.08; rainPos[i * 6 + 4] = rainPos[i * 6 + 1] + 0.6; rainPos[i * 6 + 5] = rainPos[i * 6 + 2]; }
      rainGeo.setDrawRange(0, (id === 'orage' ? RAIN_N * 0.75 : RAIN_N * 0.3) * 2);
    }
    if (parts.visible) {
      const conf = [0xff8fb1, 0xffe066, 0x8fd3c9, 0xb39ddb, 0x81d4fa], c = new THREE.Color();
      for (let i = 0; i < PART_N; i++) {
        areaPoint(i, partPos, 3);
        c.set(id === 'sucre' ? 0xffffff : pick(conf));
        partCol[i * 3] = c.r; partCol[i * 3 + 1] = c.g; partCol[i * 3 + 2] = c.b;
      }
      partGeo.attributes.color.needsUpdate = true;
      partMat.size = id === 'sucre' ? 0.16 : 0.26;
    }
  }
  function updateWeather(dt, t) {
    if (rain.visible) {
      for (let i = 0; i < RAIN_N; i++) {
        const k = i * 6;
        rainPos[k + 1] -= 24 * dt; rainPos[k + 4] -= 24 * dt; rainPos[k] -= 1.5 * dt; rainPos[k + 3] -= 1.5 * dt;
        if (rainPos[k + 1] < 0) { areaPoint(i, rainPos, 6); rainPos[k + 1] = 18; rainPos[k + 3] = rainPos[k] + 0.08; rainPos[k + 4] = 18.6; rainPos[k + 5] = rainPos[k + 2]; }
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    if (parts.visible) {
      const sp = weatherId === 'sucre' ? 1.2 : 2;
      for (let i = 0; i < PART_N; i++) {
        const k = i * 3;
        partPos[k + 1] -= sp * dt;
        partPos[k] += Math.sin(t * 2 + i) * 0.6 * dt;
        if (partPos[k + 1] < 0) { areaPoint(i, partPos, 3); partPos[k + 1] = 18; }
      }
      partGeo.attributes.position.needsUpdate = true;
    }
    if (meteors.visible) {
      meteorState.forEach((m, i) => {
        m.life -= dt;
        if (m.life <= 0) { m.x = rand(-120, 120); m.y = rand(60, 120); m.z = rand(-260, -120); m.life = rand(0.6, 1.6); }
        m.x += 90 * dt; m.y -= 50 * dt;
        meteorPos.set([m.x, m.y, m.z, m.x - 9, m.y + 5, m.z], i * 6);
      });
      meteorGeo.attributes.position.needsUpdate = true;
    }
  }
  function flash() { flashT = 0.35; }

  // ---------------------------------------------------------------- Ambiance (jour/nuit + météo)
  let curSpot = null, curPal = null;
  function boostPal(pal) { // couleurs un peu plus saturées
    const o = {}, hsl = {};
    Object.keys(pal).forEach((k) => { const c = new THREE.Color(pal[k]); c.getHSL(hsl); c.setHSL(hsl.h, Math.min(1, hsl.s * 1.18 + 0.03), hsl.l); o[k] = '#' + c.getHexString(); });
    return o;
  }
  const C = (h) => new THREE.Color(h);
  const DEEPW = C('#1d3f77'), NIGHT = C('#232250'), NIGHT_W = C('#2d3a6b'), STORM = C('#5d5b7a'), RAIN = C('#9a9ab0'), FOG = C('#e9e7f0');
  const tmpC = new THREE.Color();
  function mixed(base, nightK, nightCol, nightAmt) {
    tmpC.set(base).lerp(nightCol, nightK * nightAmt);
    if (weatherId === 'orage') tmpC.lerp(STORM, 0.3);
    else if (weatherId === 'pluie') tmpC.lerp(RAIN, 0.14);
    else if (weatherId === 'brouillard') tmpC.lerp(FOG, 0.3);
    return tmpC;
  }
  function setEnv(dayT, nightK) {
    if (!curSpot) return;
    const p = curPal, cosmic = curSpot.deco === 'cosmique';
    const nAmt = cosmic ? 0.35 : 0.85;
    skyMat.uniforms.top.value.copy(mixed(p.skyTop, nightK, NIGHT, nAmt));
    skyMat.uniforms.bottom.value.copy(mixed(p.skyBottom, nightK, NIGHT, nAmt * 0.8));
    scene.fog.color.copy(mixed(p.fog, nightK, NIGHT, nAmt * 0.8));
    waterMat.color.copy(mixed(p.water, nightK, NIGHT_W, nAmt * 0.6)).lerp(DEEPW, zoneDepthK * 0.4);
    landMat.color.copy(mixed(p.ground, nightK, NIGHT, nAmt * 0.45));
    hillMat.color.copy(mixed(p.hills, nightK, NIGHT, nAmt * 0.7));
    const fogNear = weatherId === 'brouillard' ? 6 : weatherId === 'orage' ? 25 : weatherId === 'pluie' ? 40 : 45;
    const fogFar = weatherId === 'brouillard' ? 70 : weatherId === 'orage' ? 120 : weatherId === 'pluie' ? 170 : 190;
    scene.fog.near += (fogNear - scene.fog.near) * 0.05;
    scene.fog.far += (fogFar - scene.fog.far) * 0.05;
    const dim = weatherId === 'orage' ? 0.8 : weatherId === 'pluie' ? 0.92 : 1;
    const base = cosmic ? 0.5 : 0.62;
    hemi.intensity = (base - nightK * (cosmic ? 0.1 : 0.32)) * dim + (flashT > 0 ? 1.5 * flashT : 0);
    hemi.groundColor.set(cosmic ? '#5a3f8a' : '#d8c8e8');
    sunLight.intensity = (cosmic ? 0.4 : 0.62) * (1 - nightK * 0.75) * dim;
    sunLight.color.set(nightK > 0.5 ? '#b8c4ff' : '#fff4e0');
    // course du soleil et de la lune
    const a = dayT * Math.PI * 2;
    sunMesh.position.set(Math.cos(a) * -260, 30 + Math.sin(a + 0.3) * 160, -330);
    moonMesh.position.set(Math.cos(a + Math.PI) * -260, 30 + Math.sin(a + Math.PI + 0.3) * 160, -330);
    sunMesh.material.color.set(p.sun); sunHalo.material.color.set(p.sun);
    sunMesh.visible = !cosmic && weatherId !== 'orage' && sunMesh.position.y > 0;
    moonMesh.visible = nightK > 0.05 && weatherId !== 'orage' && moonMesh.position.y > 0;
    starMat.opacity = cosmic ? 1 : nightK * (weatherId === 'clair' ? 1 : 0.3);
    bulbs.forEach((b) => (b.material.emissiveIntensity = nightK * 1.2));
  }
  function applySpot(sp) { curSpot = sp; curPal = boostPal(sp.pal); buildDeco(sp); setEnv(0.1, 0); }

  // ---------------------------------------------------------------- Effets
  const fx = [];
  const ringGeo = new THREE.RingGeometry(0.25, 0.36, 18); ringGeo.rotateX(-Math.PI / 2);
  function ripple(pos, scale = 1) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: trip > 0.2 ? pick(PSY) : 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
    m.position.set(pos.x, 0.12, pos.z); m.renderOrder = 2; scene.add(m);
    fx.push({ obj: m, t: 0, life: 1.2, own: true, update(dt, f) { const k = f.t / f.life; m.scale.setScalar(scale * (1 + k * 4)); m.material.opacity = 0.8 * (1 - k); } });
  }
  const dropGeo = new THREE.IcosahedronGeometry(0.07, 0);
  function splash(pos, n = 10, color = '#ffffff', power = 1) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(dropGeo, M(trip > 0.2 && color === '#ffffff' ? pick(PSY) : color));
      m.position.copy(pos);
      const v = new THREE.Vector3(rand(-1.5, 1.5), rand(2.5, 4.5) * power, rand(-1.5, 1.5));
      scene.add(m);
      fx.push({ obj: m, t: 0, life: 1.6, update(dt, f) { v.y -= 12 * dt; m.position.addScaledVector(v, dt); if (m.position.y < -0.2) f.t = f.life; } });
    }
  }
  function confetti(pos) {
    ['#ff8fb1', '#ffe066', '#8fd3c9', '#b39ddb', '#81d4fa'].forEach((c) => splash(pos, 6, c, 1.3));
  }
  function updateFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.t += dt; f.update(dt, f);
      if (f.t >= f.life) { scene.remove(f.obj); if (f.own) f.obj.material.dispose(); fx.splice(i, 1); }
    }
  }

  // ---------------------------------------------------------------- Potager flottant de Tata Capucine
  const farm = new THREE.Group();
  farm.position.set(-9.2, 0, -10.2);
  farm.rotation.y = 0.75;
  farm.add(G.models.raft(4.8, 3.4));
  const farmPlots = [];
  for (let i = 0; i < 8; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    const bed = new THREE.Group(); bed.position.set(-1.6 + col * 1.05, 0.34, -0.6 + row * 1.25);
    const soil = mesh(new THREE.BoxGeometry(0.8, 0.16, 0.8), '#7a5a45'); soil.position.y = 0.06;
    const frame = mesh(new THREE.BoxGeometry(0.92, 0.2, 0.92), '#a1785a');
    const plant = new THREE.Group(); plant.position.y = 0.14;
    const lockM = mesh(new THREE.BoxGeometry(0.88, 0.1, 0.88), '#cfd8dc'); lockM.position.y = 0.16;
    bed.add(frame, soil, plant, lockM); farm.add(bed);
    farmPlots.push({ bed, soil, plant, lockM, key: '', ready: false });
  }
  const capucine = otter({ fur: '#a5774e', acc: ['apron'], hat: 'hat_cowboy', vest: '#7cb342' });
  capucine.group.scale.setScalar(0.8); capucine.group.position.set(2.7, 0.3, 0.3); capucine.group.rotation.y = Math.PI - 0.75 + 0.3;
  farm.add(capucine.group); npcs.capucine = capucine; clickable(capucine.group, 'capucine'); clickable(farm, 'farm');
  const scarecrow = new THREE.Group();
  scarecrow.add(atp(mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 5), '#8d6e63'), 0, 0.9, 0));
  scarecrow.add(atp(mesh(new THREE.BoxGeometry(1.0, 0.07, 0.07), '#8d6e63'), 0, 1.3, 0));
  scarecrow.add(atp(mesh(new THREE.BoxGeometry(0.4, 0.5, 0.2), '#ff9a6b'), 0, 1.15, 0));
  scarecrow.add(atp(mesh(new THREE.IcosahedronGeometry(0.2, 0), '#f3d58a'), 0, 1.65, 0));
  scarecrow.add(atp(mesh(new THREE.ConeGeometry(0.25, 0.3, 8), '#6d4c41'), 0, 1.9, 0));
  scarecrow.position.set(-2.1, 0.3, 1.15); scarecrow.visible = false; farm.add(scarecrow);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.7, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhongMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.18, shininess: 90, depthWrite: false }));
  dome.scale.set(1.15, 0.6, 0.85); dome.position.set(-0.55, 0.3, 0.05); dome.visible = false; farm.add(dome);
  const farmSign = G.models.label('POTAGER', 1.2, 0.34, '#f1fbe9', '#3b7a3b'); farmSign.position.set(0.9, 1.3, 1.6); farmSign.rotation.y = Math.PI; farm.add(farmSign);
  farm.add(atp(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 5), '#8d6e63'), 0.4, 0.8, 1.6), atp(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 5), '#8d6e63'), 1.4, 0.8, 1.6));
  scene.add(farm);
  function buildPlant(p, crop) {
    while (p.plant.children.length) p.plant.remove(p.plant.children[0]);
    if (!crop) return;
    p.plant.add(atp(mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.5, 5), '#66bb6a'), 0, 0.25, 0));
    for (let i = 0; i < 3; i++) { const l = mesh(new THREE.SphereGeometry(0.16, 6, 4), '#7ccf6e'); l.scale.set(1.3, 0.35, 0.8); l.position.set(Math.cos(i * 2.1) * 0.12, 0.2 + i * 0.1, Math.sin(i * 2.1) * 0.12); l.rotation.y = i * 2.1; p.plant.add(l); }
    if (p.ready) for (let i = 0; i < 5; i++) p.plant.add(atp(mesh(new THREE.IcosahedronGeometry(0.1, 0), crop.color, { emissive: 0x221100 }), Math.cos(i * 1.3) * 0.2, 0.55 + (i % 2) * 0.1, Math.sin(i * 1.3) * 0.2));
    else p.plant.add(atp(mesh(new THREE.SphereGeometry(0.07, 6, 4), crop.color), 0, 0.52, 0));
  }
  // list : [{ owned, crop (id), frac (0..1), ready, wet }]
  function setFarm(list, tools) {
    list.forEach((it, i) => {
      const p = farmPlots[i]; if (!p) return;
      p.lockM.visible = !it.owned;
      const key = it.crop ? it.crop + (it.ready ? 'R' : 'G') : '';
      if (key !== p.key) { p.key = key; p.ready = !!it.ready; buildPlant(p, it.crop ? G.D.crops.find((c) => c.id === it.crop) : null); }
      if (it.crop) p.plant.scale.setScalar(0.3 + 0.7 * Math.min(1, it.frac));
      p.soil.material = M(it.wet ? '#3e2723' : '#7a5a45');
    });
    scarecrow.visible = !!(tools && tools.epouvantail); dome.visible = !!(tools && tools.serre);
  }
  function updateFarmAnim(T) {
    farm.position.y = waveH(farm.position.x, farm.position.z, T) * 0.5;
    farmPlots.forEach((p, i) => { if (p.ready) { p.plant.position.y = 0.14 + Math.abs(Math.sin(T * 3 + i)) * 0.05; p.plant.rotation.y = Math.sin(T * 2 + i) * 0.2; } });
    capucine.head.rotation.y = Math.sin(T * 0.5) * 0.4; capucine.tail.rotation.z = Math.sin(T * 1.3) * 0.3; capucine.armL.rotation.x = -0.3 + Math.sin(T * 1.7) * 0.35;
    const blink = ((T + 1.3) % 4.4) < 0.12 ? 0.1 : 1; capucine.eyes.forEach((e) => (e.scale.y = blink));
  }

  // ---------------------------------------------------------------- Ambiance : fanions, papillons, poissons sauteurs, éclats sur l'eau
  function bunting(a, b, n, sag) {
    const g = new THREE.Group(), cols = ['#ff7ab6', '#ffd166', '#6ee7b7', '#7aa8ff', '#c79bff', '#ff9a6b'], pts = [];
    for (let i = 0; i <= n; i++) { const v = new THREE.Vector3().lerpVectors(a, b, i / n); v.y -= Math.sin(Math.PI * i / n) * sag; pts.push(v); }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x6d5a7a })));
    for (let i = 1; i < n; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 3), M(cols[i % cols.length], { side: THREE.DoubleSide })); f.position.copy(pts[i]); f.position.y -= 0.17; f.rotation.x = Math.PI; f.rotation.y = rand(0, 1); g.add(f); }
    scene.add(g);
  }
  [market, market2, kitchen, farm].forEach((g) => g.updateMatrixWorld(true));
  (() => {
    const W3 = (g, x, y, z) => g.localToWorld(new THREE.Vector3(x, y, z));
    bunting(W3(market, -1.6, 1.9, 0.2), W3(market, 1.6, 1.9, 0.2), 10, 0.35);
    bunting(W3(market2, -1.4, 1.9, 0.2), W3(market2, 1.4, 1.9, 0.2), 9, 0.35);
    bunting(W3(kitchen, -0.65, 1.8, -0.6), W3(kitchen, 0.65, 1.8, -0.6), 6, 0.2);
    bunting(W3(farm, 0.4, 1.4, 1.6), W3(farm, 1.4, 1.4, 1.6), 5, 0.15);
  })();
  const butterflies = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group(), wm = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.85, 0.66), side: THREE.DoubleSide });
    const wing = new THREE.PlaneGeometry(0.3, 0.22); wing.translate(0.15, 0, 0);
    const wl = new THREE.Mesh(wing, wm), wr = new THREE.Mesh(wing, wm); wr.scale.x = -1; g.add(wl, wr);
    g.userData = { wl, wr, cx: rand(-7, 7), cz: rand(-6, 4), cy: rand(1.5, 3.6), ph: Math.random() * 6, sp: rand(0.4, 0.9), r: rand(1.5, 3.5) };
    scene.add(g); butterflies.push(g);
  }
  const jumpers = []; let jumpT = 5;
  function spawnJumper() {
    const fl = Object.values(G.fishById || {}).filter((f) => curSpot && f.spot === curSpot.id && !f.junk && !f.zone && !f.night);
    if (!fl.length) return;
    const f = pick(fl), m = G.models.fish(f, f.w[0]); m.scale.multiplyScalar(0.8);
    const x = rig.position.x + rand(-9, 9), z = rig.position.z + rand(-24, -8), dir = Math.random() < 0.5 ? 1 : -1;
    scene.add(m); jumpers.push({ m, x, z, dir, t: 0, dur: rand(0.9, 1.3), h: rand(1.2, 2.2) });
    splash(new THREE.Vector3(x, 0, z), 6);
  }
  const sparkMats = [0, 1, 2].map((i) => new THREE.PointsMaterial({ color: ['#ffffff', '#fff3a8', '#ffd1f0'][i], size: 0.46, transparent: true, opacity: 0, depthWrite: false }));
  const sparks = sparkMats.map((m) => {
    const n = 90, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = rand(-40, 40); arr[i * 3 + 1] = 0.22; arr[i * 3 + 2] = rand(-95, -3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pts = new THREE.Points(geo, m); pts.frustumCulled = false; scene.add(pts); return pts;
  });
  function updateAmbience(T, dt, nightK) {
    const day = nightK < 0.5 && curSpot && curSpot.deco !== 'cosmique' && weatherId !== 'orage' && rig.position.z > -15;
    butterflies.forEach((b) => {
      b.visible = day;
      if (!day) return;
      const u = b.userData, a = T * u.sp + u.ph;
      b.position.set(rig.position.x + u.cx + Math.cos(a) * u.r, u.cy + Math.sin(T * 2 + u.ph) * 0.3, rig.position.z + u.cz + Math.sin(a * 1.3) * u.r);
      b.rotation.y = -a + Math.PI / 2;
      u.wl.rotation.y = Math.sin(T * 20 + u.ph) * 0.9; u.wr.rotation.y = -u.wl.rotation.y;
    });
    sparkMats.forEach((m, i) => { m.opacity = Math.max(0, Math.sin(T * 1.7 + i * 2.1)) * (nightK > 0.5 ? 0.45 : 0.85); });
    sparks.forEach((s) => s.position.set(rig.position.x, 0, rig.position.z));
    if ((jumpT -= dt) <= 0) { jumpT = rand(5, 10); if (!boatMode || Math.random() < 0.6) spawnJumper(); }
    for (let i = jumpers.length - 1; i >= 0; i--) {
      const j = jumpers[i]; j.t += dt;
      const k = j.t / j.dur;
      j.m.position.set(j.x + j.dir * k * 2.6, Math.sin(Math.PI * Math.min(1, k)) * j.h, j.z);
      j.m.rotation.y = j.dir > 0 ? 0 : Math.PI;
      j.m.rotation.z = (-0.9 + 1.8 * k) * j.dir * (j.dir > 0 ? 1 : -1) * 0.9;
      if (k >= 1) { splash(new THREE.Vector3(j.x + j.dir * 2.6, 0, j.z), 6); ripple(new THREE.Vector3(j.x + j.dir * 2.6, 0, j.z), 1); scene.remove(j.m); jumpers.splice(i, 1); }
    }
  }

  // ---------------------------------------------------------------- Voyage psychédélique (poissons LSD)
  const PSY = ['#ff4fa3', '#ffb03a', '#fff04d', '#5dff8f', '#37e6ff', '#7a7bff', '#d65bff', '#ff6a4d'];
  const hallus = [];
  let halluT = 2, filterOn = false, lastFov = 0;
  // arc-en-ciel géant qui apparaît à l'horizon
  const rainbow = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(85 - i * 2.6, 1.3, 5, 48, Math.PI), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(i / 7, 0.9, 0.6), fog: false, transparent: true, opacity: 0, depthWrite: false }));
    rainbow.add(arc);
  }
  rainbow.position.set(0, -8, -230); rainbow.visible = false;
  scene.add(rainbow);

  function spawnHallu() {
    const all = Object.values(G.fishById || {}).filter((f) => !f.junk);
    if (!all.length) return;
    const f = pick(all);
    const m = G.models.fish(f, f.w[1]);
    const mats = [];
    m.traverse((o) => { if (o.isMesh) { o.material = new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true, emissive: 0x221133, transparent: true, opacity: 0.92 }); o.castShadow = false; mats.push(o.material); } });
    const k = rand(2.2, 4.5), dir = Math.random() < 0.5 ? 1 : -1;
    const h = { m, mats, k, dir, baseS: m.scale.x, life: rand(10, 16), t: 0, y: rand(4, 14), z: rand(-75, -22), x: -dir * 42, vx: rand(4, 7), hue: Math.random(), ph: Math.random() * 6 };
    m.rotation.y = dir > 0 ? 0 : Math.PI;
    m.position.set(h.x, h.y, h.z);
    scene.add(m); hallus.push(h);
  }
  function removeHallu(i) {
    const h = hallus[i];
    scene.remove(h.m);
    h.m.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.isMesh && o.material) o.material.dispose(); });
    hallus.splice(i, 1);
  }
  function updateTrip(T, dt) {
    trip += (tripTarget - trip) * Math.min(1, dt * 0.9);
    if (Math.abs(trip - tripTarget) < 0.003) trip = tripTarget;
    const on = trip > 0.01;
    // filtre de couleur sur le canevas : teinte qui tourne + saturation
    if (on) {
      canvas.style.filter = `hue-rotate(${((T * 28 * trip) % 360).toFixed(1)}deg) saturate(${(1 + 0.45 * trip).toFixed(2)}) contrast(${(1 + 0.06 * trip).toFixed(2)})`;
      filterOn = true;
    } else if (filterOn) { canvas.style.filter = ''; filterOn = false; }
    // le champ de vision respire
    const fov = baseFov + (on ? Math.sin(T * 0.9) * 3.2 * trip * tripMotion : 0);
    if (Math.abs(fov - lastFov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); lastFov = fov; }
    // tout le monde respire un peu trop
    const br = Math.sin(T * 2.1) * trip * 0.07 * tripMotion;
    hero.group.scale.setScalar(1 + br);
    rogerObj.scale.setScalar(1 + Math.sin(T * 2.4) * trip * 0.3 * tripMotion);
    ['josiane', 'jm', 'coco'].forEach((id, i) => npcs[id].group.scale.setScalar(0.75 * (1 + Math.sin(T * 1.7 + i * 2) * trip * 0.1 * tripMotion)));
    // arc-en-ciel
    rainbow.visible = trip > 0.05;
    if (rainbow.visible) rainbow.children.forEach((a, i) => { a.material.opacity = Math.min(0.75, trip * 0.4); a.material.color.setHSL(((i / 7) + T * 0.05) % 1, 0.9, 0.6); });
    // poissons volants hallucinés
    if (trip > 0.15 && (halluT -= dt) <= 0) { halluT = rand(2.5, 6) / trip; if (hallus.length < 2 + trip * 2) spawnHallu(); }
    for (let i = hallus.length - 1; i >= 0; i--) {
      const h = hallus[i];
      h.t += dt;
      h.x += h.dir * h.vx * dt;
      h.m.position.set(h.x, h.y + Math.sin(h.t * 1.6 + h.ph) * 1.8, h.z);
      h.m.rotation.z = Math.sin(h.t * 3 + h.ph) * 0.25;
      const s = Math.min(1, h.t * 1.2, (h.life - h.t) * 1.2);
      h.m.scale.setScalar(Math.max(0.0001, s) * h.k * h.baseS);
      h.mats.forEach((mt, j) => { mt.color.setHSL((h.hue + T * 0.2 + j * 0.13) % 1, 0.85, 0.62); mt.opacity = 0.92 * Math.max(0, s); });
      if (h.t > h.life || Math.abs(h.x) > 60) removeHallu(i);
    }
  }
  function setTrip(level) { tripTarget = level; }
  function setTripMotion(k) { tripMotion = k; }

  // ---------------------------------------------------------------- Cosmétiques
  function applyCosmetics(cos, D) {
    setHat(hero, cos.hat === 'hat_none' ? null : cos.hat);
    const v = D.cosmetics.find((c) => c.id === cos.vest);
    if (hero.vestMesh && v) hero.vestMesh.material.color.set(v.color);
    bobber.remove(bobberSkin);
    bobberSkin = makeBobber(cos.bobber);
    bobber.add(bobberSkin);
    refreshDeco(cos.deco);
  }
  function setRodColor(c) { rodMat.color.set(c); }
  function setRogerLevel(lvl) {
    unclickable(rogerObj); rig.remove(rogerObj);
    rogerObj = makeRoger(lvl);
    placeRoger();
    rig.add(rogerObj); clickable(rogerObj, 'roger');
  }
  function placeRoger() { rogerObj.position.set(boatMode ? -0.55 : -0.85, boatMode ? 0.28 + curDeck : 0.61, boatMode ? -0.5 : -0.55); }
  // z : définition de zone (tier, pos), tier : niveau du bateau le plus grand possédé
  function setZone(z, tier) {
    const on = z.tier > 0;
    boatMode = on;
    rig.remove(boat);
    boat = G.models.boatModel(Math.max(1, tier || 1));
    boat.position.set(0, 0.25, -1.0); boat.rotation.y = 0.2; boat.visible = on;
    rig.add(boat);
    rig.position.set(z.pos[0], 0, z.pos[1]);
    curDeck = boat.userData.deckY || 0.07;
    hero.group.position.y = on ? 0.25 + curDeck : 0.6;
    placeRoger();
    zoneDepthK = z.tier / 4;
  }

  // ---------------------------------------------------------------- Animation du héros
  const heroAnim = { mode: 'idle', t: 0 };
  function setHeroMode(m) { if (heroAnim.mode !== m) { heroAnim.mode = m; heroAnim.t = 0; } }
  function animateHero(T, dt, tension) {
    heroAnim.t += dt;
    const h = hero, k = heroAnim.t;
    let rootY = 0, rx = 0, ry = 0, headX = 0, headY = Math.sin(T * 0.4) * 0.25, tailZ = Math.sin(T * 1.5) * 0.3, sY = 1, armLx = -0.9, armLz = -0.4;
    switch (heroAnim.mode) {
      case 'charge': rx = 0.15; headY = 0; break;
      case 'cast': rx = -0.18 * Math.max(0, 1 - k * 2); headY = 0; break;
      case 'wait': headY = Math.sin(T * 0.6) * 0.15; tailZ = Math.sin(T * 2.5) * 0.4; break;
      case 'bite': rx = -0.1; headX = -0.15; tailZ = Math.sin(T * 20) * 0.5; break;
      case 'reel': rx = 0.08 + tension * 0.18; headY = Math.sin(T * 9) * 0.05; tailZ = Math.sin(T * 9) * 0.5; armLx = -1.3; break;
      case 'joy':
        rootY = Math.abs(Math.sin(k * 9)) * 0.35 * Math.max(0, 1 - k / 2.2);
        ry = k < 0.8 ? k / 0.8 * Math.PI * 2 : 0;
        armLx = -2.8; armLz = -0.6 + Math.sin(k * 14) * 0.3; tailZ = Math.sin(k * 16) * 0.7; headX = -0.15;
        break;
      case 'sad': sY = 0.92; headX = 0.45; headY = 0; tailZ = 0; armLx = -0.3; armLz = -0.15; rx = -0.08; break;
    }
    h.root.position.y = rootY;
    h.root.rotation.x += (rx - h.root.rotation.x) * Math.min(1, dt * 10);
    h.root.rotation.y = ry;
    h.root.scale.y += (sY - h.root.scale.y) * Math.min(1, dt * 8);
    h.head.rotation.x += (headX - h.head.rotation.x) * Math.min(1, dt * 8);
    h.head.rotation.y += (headY - h.head.rotation.y) * Math.min(1, dt * 4);
    h.tail.rotation.z = tailZ;
    h.armL.rotation.x += (armLx - h.armL.rotation.x) * Math.min(1, dt * 10);
    h.armL.rotation.z += (armLz - h.armL.rotation.z) * Math.min(1, dt * 10);
    h.body.scale.y = 1 + Math.sin(T * 2) * 0.015;
    const blink = (T % 3.7) < 0.12 ? 0.1 : 1;
    h.eyes.forEach((e) => (e.scale.y = blink));
  }

  // ---------------------------------------------------------------- Picking
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pickAt(cx, cy) {
    ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(clickables, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.clickId) o = o.parent;
      if (o && o.visible) return o.userData.clickId;
    }
    return null;
  }
  const projV = new THREE.Vector3();
  function project(v) { projV.copy(v).project(camera); return { x: (projV.x + 1) / 2 * innerWidth, y: (1 - projV.y) / 2 * innerHeight, behind: projV.z > 1 }; }

  // ---------------------------------------------------------------- Boucle
  let shake = 0;
  function update(T, dt, dayT, nightK) {
    updateWater(T);
    setEnv(dayT, nightK);
    if (flashT > 0) flashT -= dt;
    updateWeather(dt, T);
    decoAnim.forEach((f) => f(T, dt));
    updateFx(dt);

    if (boatMode) { rig.position.y = waveH(rig.position.x, rig.position.z - 1, T) * 0.7; rig.rotation.z = Math.sin(T * 1.2) * 0.04; }
    else { rig.position.y = 0; rig.rotation.z = 0; }

    // PNJ
    market.position.y = waveH(market.position.x, market.position.z, T) * 0.5;
    ['josiane', 'jm', 'coco'].forEach((id, i) => {
      const o = npcs[id];
      o.head.rotation.y = Math.sin(T * 0.7 + i * 2) * 0.35;
      o.tail.rotation.z = Math.sin(T * 1.3 + i) * 0.3;
      o.armL.rotation.x = -0.3 + Math.sin(T * 1.1 + i * 3) * 0.25;
      const blink = ((T + i) % 4.1) < 0.12 ? 0.1 : 1; o.eyes.forEach((e) => (e.scale.y = blink));
    });
    market2.position.y = waveH(market2.position.x, market2.position.z, T) * 0.5;
    kitchen.position.y = waveH(kitchen.position.x, kitchen.position.z, T) * 0.5;
    ['marguerite', 'gaston'].forEach((id, i) => {
      const o = npcs[id];
      o.head.rotation.y = Math.sin(T * 0.6 + i * 3) * 0.35;
      o.tail.rotation.z = Math.sin(T * 1.2 + i) * 0.3;
      o.armL.rotation.x = -0.3 + Math.sin(T * (id === 'gaston' ? 2.4 : 1.0) + i) * 0.3;
      const blink = ((T + i * 2) % 3.9) < 0.12 ? 0.1 : 1; o.eyes.forEach((e) => (e.scale.y = blink));
    });
    updateKitchen(T, dt);
    updateFarmAnim(T); updateAmbience(T, dt, nightK);
    gerardWrap.position.y = waveH(gerardWrap.position.x, gerardWrap.position.z, T) + 0.02;
    gerardWrap.rotation.y = Math.sin(T * 0.15) * 0.6;
    gerard.tail.rotation.z = Math.sin(T) * 0.2;
    gerard.eyes.forEach((e) => (e.scale.y = 0.15 + (Math.sin(T * 0.3) > 0.9 ? 0.85 : 0)));
    brandonRaft.position.y = waveH(brandonRaft.position.x, brandonRaft.position.z, T) * 0.6;
    brandon.root.position.y = Math.abs(Math.sin(T * 1.7)) * 0.04;
    brandon.head.rotation.y = Math.sin(T * 0.5) * 0.5;

    // Roger
    const pupils = rogerObj.userData.pupils;
    if (pupils) pupils.forEach((p, i) => { p.position.x = (i ? 0.08 : -0.08) + Math.sin(T * 3 + i) * 0.012; p.position.y = 0.27 + Math.cos(T * 2.3 + i) * 0.012; });

    // aquarium
    tankFish.forEach((f) => {
      const a = T * f.sp * 0.8 + f.ph;
      f.m.position.set(Math.cos(a) * 0.3, f.y + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.16);
      f.m.rotation.y = -a - Math.PI / 2;
    });

    updateTrip(T, dt);

    // caméra : pivot sur le héros, orbite / zoom / déplacement contrôlés au clic droit
    const kc = Math.min(1, dt * 10);
    cam.yaw += (cam.yawT - cam.yaw) * kc; cam.pitch += (cam.pitchT - cam.pitch) * kc; cam.zoom += (cam.zoomT - cam.zoom) * kc;
    cam.panX += (cam.panXT - cam.panX) * kc; cam.panY += (cam.panYT - cam.panY) * kc;
    camPivot.set(rig.position.x, 1.2, rig.position.z - 1);
    camOff.copy(CAM_PIVOT_OFF).multiplyScalar(cam.zoom).applyAxisAngle(AXIS_X, cam.pitch).applyAxisAngle(AXIS_Y, cam.yaw);
    camLook.copy(LOOK_PIVOT_OFF).applyAxisAngle(AXIS_Y, cam.yaw);
    camPan.set(Math.cos(cam.yaw) * cam.panX, cam.panY, -Math.sin(cam.yaw) * cam.panX);
    camera.position.copy(camPivot).add(camOff).add(camPan);
    camera.position.y = Math.max(camera.position.y, 0.9);
    camera.position.x += Math.sin(T * 0.3) * 0.08;
    camera.position.y += Math.sin(T * 0.5) * 0.05 - rig.position.y * 0.5;
    if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake *= 0.9; if (shake < 0.002) shake = 0; }
    camera.lookAt(tmpV.copy(camPivot).add(camLook).add(camPan));
    if (trip > 0.01) camera.rotateZ(Math.sin(T * 0.6) * 0.05 * trip * tripMotion);
  }

  // ---------------------------------------------------------------- Contrôles de caméra (clic droit)
  const cam = { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0, yawT: 0, pitchT: 0, zoomT: 1, panXT: 0, panYT: 0 };
  const AXIS_X = new THREE.Vector3(1, 0, 0), AXIS_Y = new THREE.Vector3(0, 1, 0);
  const camPivot = new THREE.Vector3(), camOff = new THREE.Vector3(), camLook = new THREE.Vector3(), camPan = new THREE.Vector3();
  const CAM_PIVOT_OFF = new THREE.Vector3(CAM_OFF.x, CAM_OFF.y - 1.2, CAM_OFF.z + 1);   // caméra par rapport au pivot
  const LOOK_PIVOT_OFF = new THREE.Vector3(LOOK_OFF.x, 0.6 - 1.2, LOOK_OFF.z + 1);      // point visé par rapport au pivot
  let camDrag = null;
  const clampCam = () => {
    cam.pitchT = Math.max(-1.15, Math.min(0.4, cam.pitchT));
    cam.zoomT = Math.max(0.45, Math.min(2.4, cam.zoomT));
    cam.panXT = Math.max(-10, Math.min(10, cam.panXT));
    cam.panYT = Math.max(-1.5, Math.min(6, cam.panYT));
  };
  function resetCamera() { cam.yawT = cam.pitchT = cam.panXT = cam.panYT = 0; cam.zoomT = 1; cam.yawT = Math.round(cam.yaw / (Math.PI * 2)) * Math.PI * 2; }
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 2 && e.button !== 1) return;
    e.preventDefault();
    camDrag = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 1, moved: 0 };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* tant pis */ }
    canvas.style.cursor = camDrag.pan ? 'move' : 'grabbing';
  });
  window.addEventListener('pointermove', (e) => {
    if (!camDrag) return;
    const dx = e.clientX - camDrag.x, dy = e.clientY - camDrag.y;
    camDrag.x = e.clientX; camDrag.y = e.clientY; camDrag.moved += Math.abs(dx) + Math.abs(dy);
    if (camDrag.pan || e.shiftKey) { cam.panXT -= dx * 0.02 * cam.zoomT; cam.panYT += dy * 0.02 * cam.zoomT; }
    else { cam.yawT -= dx * 0.006; cam.pitchT -= dy * 0.005; }
    clampCam();
  });
  const endDrag = (e) => {
    if (!camDrag || (e.button !== 2 && e.button !== 1)) return;
    if (camDrag.moved < 4 && e.button === 2) resetCamera(); // simple clic droit = recentrer
    camDrag = null; canvas.style.cursor = '';
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.zoomT *= Math.exp(e.deltaY * 0.0012); clampCam(); }, { passive: false });
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyR' && !e.repeat && !e.ctrlKey && !e.metaKey) resetCamera(); });

  let baseFov = 55;
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    baseFov = w / h < 0.8 ? 72 : 55;
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  G.world = {
    scene, camera, renderer, waveH, rig, hero, rodPivot, rodTip, bobber, npcs, gerardWrap, brandonRaft, market,
    get roger() { return rogerObj; },
    updateLine, applySpot, setWeather, flash, ripple, splash, confetti, applyCosmetics, setRodColor, setRogerLevel,
    setZone, setFarm, refreshAquarium, setHeroMode, animateHero, pickAt, project, clickable, unclickable, faceYaw,
    shake: (a) => { shake = Math.max(shake, a); },
    refreshKitchen, setCooking, setTrip, setTripMotion, resetCamera, get trip() { return trip; }, get cam() { return cam; },
    update, render: () => renderer.render(scene, camera),
  };
})();
