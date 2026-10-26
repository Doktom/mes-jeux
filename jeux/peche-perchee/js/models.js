// Modèles low-poly : loutres, chapeaux, bouchons, Roger, poissons, bateaux, déco…
(() => {
  const matCache = {};
  function M(color, extra) {
    const key = color + (extra ? JSON.stringify(extra) : '');
    if (!matCache[key]) matCache[key] = new THREE.MeshPhongMaterial(Object.assign({ color, flatShading: true, shininess: 6 }, extra || {}));
    return matCache[key];
  }
  function mesh(geo, color, extra) {
    const m = new THREE.Mesh(geo, typeof color === 'string' ? M(color, extra) : color);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };

  function label(text, w, h, bg, fg, font) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = Math.round(512 * h / w);
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = font || `bold ${Math.round(c.height * 0.32)}px Fredoka, sans-serif`;
    const lines = text.split('\n');
    lines.forEach((l, i) => ctx.fillText(l, c.width / 2, c.height * (i + 1) / (lines.length + 1)));
    const tex = new THREE.CanvasTexture(c);
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  }

  // ---------------------------------------------------------------- Loutre
  function otter(o = {}) {
    const fur = o.fur || '#9c6b47', belly = o.belly || '#f1d9b5', dark = o.dark || '#6d4a33';
    const g = new THREE.Group();
    const root = new THREE.Group(); g.add(root);
    const legL = at(mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.3, 6), dark), -0.15, 0.15, 0);
    const legR = at(mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.3, 6), dark), 0.15, 0.15, 0);
    const footL = at(mesh(new THREE.SphereGeometry(0.12, 6, 4), dark), -0.16, 0.03, -0.06); footL.scale.set(1, 0.45, 1.5);
    const footR = footL.clone(); footR.position.x = 0.16;
    const body = at(mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.75, 8), fur), 0, 0.66, 0);
    const bellyM = at(mesh(new THREE.IcosahedronGeometry(0.3, 1), belly), 0, 0.62, -0.2); bellyM.scale.set(0.9, 1.1, 0.5);
    root.add(legL, legR, footL, footR, body, bellyM);

    let vestMesh = null;
    if (o.vest !== false) {
      vestMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.43, 0.5, 10, 1, true, Math.PI + 0.75, Math.PI * 2 - 1.5),
        new THREE.MeshPhongMaterial({ color: o.vest || '#ffa36c', flatShading: true, shininess: 10, side: THREE.DoubleSide }));
      vestMesh.position.y = 0.72; vestMesh.castShadow = true;
      root.add(vestMesh);
    }

    const head = new THREE.Group(); head.position.y = 1.25; root.add(head);
    const skull = mesh(new THREE.IcosahedronGeometry(0.32, 1), fur); skull.scale.set(1, 0.92, 0.95);
    const muzzle = at(mesh(new THREE.SphereGeometry(0.17, 8, 6), belly), 0, -0.08, -0.24); muzzle.scale.set(1.25, 0.8, 0.85);
    const nose = at(mesh(new THREE.SphereGeometry(0.06, 6, 4), '#3b2f2f'), 0, -0.02, -0.39); nose.scale.set(1.4, 0.8, 0.8);
    const eyeGeo = new THREE.SphereGeometry(0.048, 6, 5);
    const eyeL = at(mesh(eyeGeo, '#2b2230'), -0.13, 0.07, -0.26);
    const eyeR = at(mesh(eyeGeo, '#2b2230'), 0.13, 0.07, -0.26);
    const shineL = at(mesh(new THREE.SphereGeometry(0.015, 4, 3), '#ffffff'), -0.12, 0.09, -0.3);
    const shineR = at(shineL.clone(), 0.14, 0.09, -0.3);
    const earL = at(mesh(new THREE.SphereGeometry(0.08, 6, 4), dark), -0.25, 0.19, 0.02); earL.scale.z = 0.6;
    const earR = at(earL.clone(), 0.25, 0.19, 0.02);
    head.add(skull, muzzle, nose, eyeL, eyeR, shineL, shineR, earL, earR);
    for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 3; i++) {
      const w = at(mesh(new THREE.BoxGeometry(0.22, 0.008, 0.008), '#ffffff'), s * 0.2, -0.08 + (i - 1) * 0.03, -0.3);
      w.rotation.z = s * (i - 1) * 0.15; w.rotation.y = s * 0.25; head.add(w);
    }
    const hatSlot = new THREE.Group(); hatSlot.position.y = 0.24; head.add(hatSlot);

    function arm(side) {
      const a = new THREE.Group(); a.position.set(side * 0.36, 0.95, -0.02);
      const up = at(mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.42, 6), fur), 0, -0.2, 0);
      const paw = at(mesh(new THREE.SphereGeometry(0.08, 6, 4), dark), 0, -0.42, 0);
      a.add(up, paw); root.add(a); return a;
    }
    const armL = arm(-1), armR = arm(1);
    const tail = new THREE.Group(); tail.position.set(0, 0.35, 0.3);
    const tailM = at(mesh(new THREE.CylinderGeometry(0.13, 0.05, 0.85, 6), fur), 0, -0.42, 0); tailM.scale.z = 0.55;
    tail.add(tailM); tail.rotation.x = -2.3; root.add(tail);

    // accessoires
    (o.acc || []).forEach((a) => {
      if (a === 'apron') { const ap = at(mesh(new THREE.BoxGeometry(0.5, 0.55, 0.04), '#ffffff'), 0, 0.6, -0.36); ap.rotation.x = 0.12; root.add(ap); const str = at(mesh(new THREE.BoxGeometry(0.52, 0.04, 0.04), '#ff8fb1'), 0, 0.86, -0.34); root.add(str); }
      if (a === 'moustache') { [-1, 1].forEach((s) => { const m = at(mesh(new THREE.BoxGeometry(0.16, 0.05, 0.05), '#4e342e'), s * 0.09, -0.11, -0.37); m.rotation.z = s * 0.3; head.add(m); }); }
      if (a === 'sunglasses') { [-1, 1].forEach((s) => head.add(at(mesh(new THREE.BoxGeometry(0.13, 0.08, 0.03), '#212121'), s * 0.12, 0.08, -0.3))); head.add(at(mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), '#212121'), 0, 0.09, -0.31)); }
      if (a === 'beard') { const b = at(mesh(new THREE.ConeGeometry(0.15, 0.35, 6), '#f5f5f5'), 0, -0.3, -0.25); b.rotation.x = Math.PI; head.add(b); }
      if (a === 'headband') { const hb = at(mesh(new THREE.TorusGeometry(0.31, 0.04, 4, 14), '#ef5350'), 0, 0.12, 0); hb.rotation.x = Math.PI / 2; head.add(hb); }
      if (a === 'trench') { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.48, 0.9, 10, 1, true), new THREE.MeshPhongMaterial({ color: '#c8a96e', flatShading: true, side: THREE.DoubleSide })); t.position.y = 0.6; root.add(t); root.add(at(mesh(new THREE.CylinderGeometry(0.25, 0.36, 0.14, 10), '#b8995e'), 0, 1.04, 0)); }
      if (a === 'shell') { const sh = at(mesh(new THREE.ConeGeometry(0.16, 0.08, 9), '#ffccbc'), 0, 0.6, -0.42); sh.rotation.x = -Math.PI / 2; root.add(sh); }
      if (a === 'bowtie') { [-1, 1].forEach((s) => { const b = at(mesh(new THREE.ConeGeometry(0.06, 0.12, 4), '#e53950'), s * 0.06, 1.0, -0.3); b.rotation.z = s * Math.PI / 2; root.add(b); }); }
    });

    const parts = { group: g, root, body, head, armL, armR, tail, hatSlot, vestMesh, eyes: [eyeL, eyeR], ears: [earL, earR] };
    if (o.hat) setHat(parts, o.hat);
    return parts;
  }
  function setHat(parts, id) {
    while (parts.hatSlot.children.length) parts.hatSlot.remove(parts.hatSlot.children[0]);
    const h = hat(id);
    if (h) parts.hatSlot.add(h);
  }

  // ---------------------------------------------------------------- Chapeaux
  function hat(id) {
    const g = new THREE.Group();
    switch (id) {
      case 'hat_bob':
        g.add(at(mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.05, 10), '#8fd3c9'), 0, -0.02, 0));
        g.add(at(mesh(new THREE.CylinderGeometry(0.26, 0.33, 0.24, 9), '#8fd3c9'), 0, 0.1, 0));
        g.add(at(mesh(new THREE.IcosahedronGeometry(0.07, 0), '#ff9fb5'), 0, 0.26, 0));
        break;
      case 'hat_paille':
        g.add(at(mesh(new THREE.CylinderGeometry(0.62, 0.64, 0.04, 12), '#f3d58a'), 0, -0.02, 0));
        g.add(at(mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.22, 10), '#f3d58a'), 0, 0.1, 0));
        g.add(at(mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.06, 10), '#e57373'), 0, 0.02, 0));
        break;
      case 'hat_bonnet':
        g.add(at(mesh(new THREE.SphereGeometry(0.33, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#ff8fb1'), 0, -0.08, 0));
        g.add(at(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 10), '#ffffff'), 0, -0.06, 0));
        g.add(at(mesh(new THREE.IcosahedronGeometry(0.11, 0), '#ffffff'), 0, 0.3, 0));
        break;
      case 'hat_cowboy': {
        const brim = at(mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.04, 12), '#a1785a'), 0, 0, 0); brim.scale.z = 0.8;
        g.add(brim, at(mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.3, 8), '#a1785a'), 0, 0.15, 0));
        g.add(at(mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.05, 8), '#5d4037'), 0, 0.04, 0));
        break;
      }
      case 'hat_haut':
        g.add(at(mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 12), '#2b2b3a'), 0, 0, 0));
        g.add(at(mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.55, 12), '#2b2b3a'), 0, 0.29, 0));
        g.add(at(mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.08, 12), '#e53950'), 0, 0.07, 0));
        break;
      case 'hat_cosmo': {
        const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 10), new THREE.MeshPhongMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.35, shininess: 100, depthWrite: false }));
        bubble.position.y = -0.22; g.add(bubble);
        g.add(at(mesh(new THREE.TorusGeometry(0.4, 0.07, 6, 16), '#eceff1'), 0, -0.6, 0)); g.children[1].rotation.x = Math.PI / 2;
        g.add(at(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4), '#9e9e9e'), 0.2, 0.3, 0), at(mesh(new THREE.SphereGeometry(0.04, 5, 4), '#ff5252', { emissive: 0x661111 }), 0.2, 0.46, 0));
        break;
      }
      case 'hat_cone':
        g.add(at(mesh(new THREE.ConeGeometry(0.3, 0.65, 10), '#ff7043'), 0, 0.28, 0));
        g.add(at(mesh(new THREE.CylinderGeometry(0.2, 0.235, 0.1, 10), '#ffffff'), 0, 0.25, 0));
        g.add(at(mesh(new THREE.BoxGeometry(0.62, 0.05, 0.62), '#ff7043'), 0, -0.02, 0));
        break;
      case 'hat_algue':
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const s = at(mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.5, 4), i % 2 ? '#66bb6a' : '#43a047'), Math.sin(a) * 0.28, -0.2, Math.cos(a) * 0.28);
          s.rotation.z = Math.sin(a) * 0.3; s.rotation.x = Math.cos(a) * 0.3; g.add(s);
        }
        g.add(at(mesh(new THREE.SphereGeometry(0.32, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), '#43a047'), 0, -0.06, 0));
        break;
      case 'hat_pirate':
        g.add(at(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 3), '#263238'), 0, 0.02, 0));
        g.add(at(mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.22, 8), '#263238'), 0, 0.12, 0));
        g.add(at(mesh(new THREE.BoxGeometry(0.1, 0.08, 0.02), '#ffffff'), 0, 0.15, -0.28));
        break;
      case 'hat_couronne': {
        const gold = '#ffd54f';
        g.add(at(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 10, 1, true), gold, { side: THREE.DoubleSide, emissive: 0x443300, shininess: 80 }), 0, 0.05, 0));
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(at(mesh(new THREE.ConeGeometry(0.06, 0.16, 4), gold, { emissive: 0x443300 }), Math.sin(a) * 0.27, 0.19, Math.cos(a) * 0.27)); }
        g.add(at(mesh(new THREE.OctahedronGeometry(0.05, 0), '#e53950', { emissive: 0x440000 }), 0, 0.06, -0.29));
        break;
      }
      case 'hat_toque': {
        g.add(at(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 10), '#ffffff'), 0, 0, 0));
        g.add(at(mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.34, 10), '#ffffff'), 0, 0.2, 0));
        const puff = at(mesh(new THREE.SphereGeometry(0.38, 10, 6), '#ffffff'), 0, 0.5, 0); puff.scale.set(1, 0.72, 1); g.add(puff);
        break;
      }
      case 'hat_champi': {
        const cap = at(mesh(new THREE.SphereGeometry(0.42, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#e53950'), 0, -0.04, 0); cap.scale.y = 0.85; g.add(cap);
        g.add(at(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 10), '#fff3e0'), 0, -0.04, 0));
        [[0, 0.28, -0.1], [-0.22, 0.2, 0.1], [0.22, 0.2, 0.08], [0.05, 0.12, 0.3], [-0.12, 0.08, -0.34], [0.3, 0.08, -0.22]].forEach(([x, y, z]) => {
          const dot = at(mesh(new THREE.SphereGeometry(0.07, 5, 4), '#ffffff'), x, y, z); g.add(dot);
        });
        break;
      }
      case 'fedora':
        g.add(at(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 12), '#5d5d6b'), 0, 0, 0));
        g.add(at(mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.25, 9), '#5d5d6b'), 0, 0.13, 0));
        g.add(at(mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.05, 9), '#212121'), 0, 0.04, 0));
        break;
      case 'cap': {
        g.add(at(mesh(new THREE.SphereGeometry(0.31, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#42a5f5'), 0, -0.07, 0));
        const v = at(mesh(new THREE.BoxGeometry(0.4, 0.03, 0.3), '#1e88e5'), 0, -0.06, -0.38); g.add(v);
        break;
      }
      case 'scarf': {
        const s = at(mesh(new THREE.SphereGeometry(0.34, 10, 6, 0, Math.PI * 2, 0, Math.PI / 1.8), '#ef9a9a'), 0, -0.12, 0.02); g.add(s);
        g.add(at(mesh(new THREE.IcosahedronGeometry(0.07, 0), '#ef9a9a'), 0, -0.25, 0.33));
        break;
      }
      case 'beret': {
        const b = at(mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.1, 12), '#ff8fb1'), 0.04, 0, 0); b.rotation.z = -0.2; g.add(b);
        g.add(at(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 4), '#ff8fb1'), 0.04, 0.08, 0));
        break;
      }
      default: return null;
    }
    return g;
  }

  // ---------------------------------------------------------------- Bouchons
  function starGeo(r1, r2, depth) {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? r2 : r1;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    geo.translate(0, 0, -depth / 2);
    return geo;
  }
  function googly(g, x, y, z, r) {
    const w = at(mesh(new THREE.SphereGeometry(r, 8, 6), '#ffffff'), x, y, z);
    const p = at(mesh(new THREE.SphereGeometry(r * 0.5, 6, 4), '#212121'), x, y, z + r * 0.7);
    g.add(w, p);
    return p;
  }
  function bobber(id) {
    const g = new THREE.Group();
    switch (id) {
      case 'bob_canard':
        g.add(at(mesh(new THREE.IcosahedronGeometry(0.14, 0), '#ffe066'), 0, 0, 0));
        g.add(at(mesh(new THREE.IcosahedronGeometry(0.08, 0), '#ffe066'), 0, 0.13, -0.08));
        g.add(at(mesh(new THREE.ConeGeometry(0.035, 0.08, 4), '#ffa94d'), 0, 0.12, -0.17)); g.children[2].rotation.x = -Math.PI / 2;
        break;
      case 'bob_donut':
        g.add(mesh(new THREE.TorusGeometry(0.1, 0.055, 6, 12), '#e0b07a'));
        g.add(at(mesh(new THREE.TorusGeometry(0.1, 0.045, 6, 12), '#ff8fb1'), 0, 0.02, 0));
        g.children.forEach((c) => (c.rotation.x = Math.PI / 2));
        break;
      case 'bob_cerise':
        g.add(mesh(new THREE.IcosahedronGeometry(0.13, 1), '#e53950'));
        g.add(at(mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.18, 4), '#7cb342'), 0.03, 0.18, 0)); g.children[1].rotation.z = -0.3;
        break;
      case 'bob_etoile':
        g.add(mesh(starGeo(0.17, 0.08, 0.06), '#ffe066', { emissive: 0x554400 }));
        break;
      case 'bob_oeil': {
        g.add(mesh(new THREE.SphereGeometry(0.14, 10, 8), '#ffffff'));
        g.add(at(mesh(new THREE.SphereGeometry(0.07, 8, 6), '#4fc3f7'), 0, 0.04, -0.09));
        g.add(at(mesh(new THREE.SphereGeometry(0.035, 6, 4), '#111111'), 0, 0.05, -0.135));
        break;
      }
      case 'bob_roger': {
        const r = mesh(new THREE.DodecahedronGeometry(0.13, 0), '#a8a2b5'); r.scale.y = 0.8; g.add(r);
        googly(g, -0.05, 0.05, -0.1, 0.035); googly(g, 0.05, 0.05, -0.1, 0.035);
        break;
      }
      default:
        g.add(mesh(new THREE.SphereGeometry(0.13, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), '#ff6b7a'));
        g.add(mesh(new THREE.SphereGeometry(0.13, 8, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#ffffff'));
        g.add(at(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 4), '#ff6b7a'), 0, 0.18, 0));
    }
    return g;
  }

  // ---------------------------------------------------------------- Roger
  function roger(lvl) {
    const g = new THREE.Group();
    const rock = mesh(new THREE.DodecahedronGeometry(0.22, 0), '#a8a2b5'); rock.scale.set(1.1, 0.8, 1); rock.position.y = 0.17;
    g.add(rock);
    const pupils = [googly(g, -0.08, 0.27, -0.17, 0.055), googly(g, 0.08, 0.27, -0.17, 0.055)];
    if (lvl >= 2) for (let i = 0; i < 4; i++) g.add(at(mesh(new THREE.IcosahedronGeometry(0.05, 0), '#8bc34a'), (Math.random() - 0.5) * 0.25, 0.32, (Math.random() - 0.3) * 0.2));
    if (lvl >= 4) { const mono = at(mesh(new THREE.TorusGeometry(0.07, 0.01, 4, 12), '#ffd54f', { emissive: 0x443300 }), 0.08, 0.27, -0.21); g.add(mono); g.add(at(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.18, 3), '#ffd54f'), 0.15, 0.19, -0.2)); }
    if (lvl >= 5) { const c = hat('hat_couronne'); c.scale.setScalar(0.55); c.position.y = 0.33; g.add(c); }
    g.userData.pupils = pupils;
    return g;
  }

  // ---------------------------------------------------------------- Poissons
  function fish(f, w) {
    const g = new THREE.Group();
    const s = Math.min(1.5, Math.max(0.25, 0.28 + Math.log10(1 + w) * 0.32));
    if (f.id === 'astronaute') {
      const o = otter({ vest: '#eceff1', hat: 'hat_cosmo' });
      o.group.scale.setScalar(0.6); o.group.position.y = -0.7; g.add(o.group);
      g.scale.setScalar(1.2); return g;
    }
    if (f.junk) {
      switch (f.id) {
        case 'botte':
          g.add(at(mesh(new THREE.BoxGeometry(0.4, 0.8, 0.4), f.color), 0, 0.2, 0), at(mesh(new THREE.BoxGeometry(0.4, 0.3, 0.75), f.color), 0, -0.25, -0.18));
          break;
        case 'chaussette':
          g.add(at(mesh(new THREE.BoxGeometry(0.3, 0.7, 0.3), f.color), 0, 0.2, 0), at(mesh(new THREE.BoxGeometry(0.3, 0.3, 0.55), f.color), 0, -0.2, -0.12), at(mesh(new THREE.BoxGeometry(0.32, 0.12, 0.32), '#ffffff'), 0, 0.5, 0));
          break;
        case 'lettre': {
          g.add(mesh(new THREE.BoxGeometry(0.9, 0.6, 0.03), '#fffaf0'));
          const h = at(mesh(new THREE.OctahedronGeometry(0.12, 0), '#e53950'), 0, 0, -0.03); g.add(h);
          break;
        }
        case 'dentier':
          [1, -1].forEach((sgn) => { const t = at(mesh(new THREE.TorusGeometry(0.3, 0.1, 5, 10, Math.PI), '#ff8fa3'), 0, sgn * 0.08, 0); t.rotation.x = Math.PI / 2 * sgn; g.add(t); });
          for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI; g.add(at(mesh(new THREE.BoxGeometry(0.09, 0.1, 0.06), '#ffffff'), Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3)); }
          break;
        case 'galet': {
          const r = mesh(new THREE.DodecahedronGeometry(0.4, 0), f.color); r.scale.y = 0.6; g.add(r);
          googly(g, -0.12, 0.12, -0.33, 0.07); googly(g, 0.12, 0.12, -0.33, 0.07);
          break;
        }
        case 'poussiere':
          g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.55, 10), '#cfd8dc'), at(mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.3, 10), f.color, { emissive: 0x444400 }), 0, 0, 0));
          break;
        default: g.add(mesh(new THREE.BoxGeometry(0.9, 0.7, 0.5), f.color));
      }
      g.scale.setScalar(s); return g;
    }
    const bodyM = mesh(new THREE.IcosahedronGeometry(0.6, 0), f.color, f.id === 'luciole' || f.id === 'veilleuse' ? { emissive: 0x555500 } : undefined);
    bodyM.scale.set(1.5, 0.9, 0.55);
    const tail = at(mesh(new THREE.ConeGeometry(0.45, 0.6, 4), f.color), -1.05, 0, 0); tail.rotation.z = Math.PI / 2;
    const fin = at(mesh(new THREE.ConeGeometry(0.2, 0.45, 3), f.color), 0, 0.55, 0);
    bodyM.userData.psy = tail.userData.psy = fin.userData.psy = true;
    g.add(bodyM, tail, fin);
    [0.25, -0.25].forEach((z) => { g.add(at(mesh(new THREE.SphereGeometry(0.11, 6, 4), '#ffffff'), 0.6, 0.15, z)); g.add(at(mesh(new THREE.SphereGeometry(0.055, 5, 3), '#3b2f4a'), 0.68, 0.15, z * 1.24)); });
    if (f.id === 'licorne') { const horn = at(mesh(new THREE.ConeGeometry(0.08, 0.5, 5), '#fff59d'), 0.75, 0.5, 0); horn.rotation.z = -0.6; g.add(horn); }
    if (f.id === 'kevin' || f.id === 'final') { const halo = at(mesh(new THREE.TorusGeometry(0.35, 0.05, 4, 12), '#fff59d', { emissive: 0x887722 }), 0.2, 0.95, 0); halo.rotation.x = Math.PI / 2; g.add(halo); }
    if (f.id === 'castor') { const tie = at(mesh(new THREE.ConeGeometry(0.08, 0.35, 4), '#e53950'), 0.45, -0.3, 0.3); tie.rotation.z = Math.PI; g.add(tie); }
    if (f.id === 'dj') { const hp = at(mesh(new THREE.TorusGeometry(0.4, 0.05, 4, 12, Math.PI), '#212121'), 0.2, 0.3, 0); hp.rotation.y = Math.PI / 2; g.add(hp); }
    if (f.id === 'silure' || f.id === 'brochet') { [-1, 1].forEach((sg) => { const m = at(mesh(new THREE.CylinderGeometry(0.02, 0.01, 0.6, 3), '#3e2723'), 0.9, -0.05, sg * 0.2); m.rotation.z = 1.2; m.rotation.x = sg * 0.4; g.add(m); }); }
    if (f.id === 'espadon') { const sw = at(mesh(new THREE.ConeGeometry(0.06, 0.9, 4), '#b0bec5'), 1.3, 0.05, 0); sw.rotation.z = -Math.PI / 2; g.add(sw); }
    if (f.lsd) psychedelic(g, f.id);
    g.scale.setScalar(s);
    return g;
  }

  // Peint le corps d'un poisson LSD en dégradé arc-en-ciel (couleurs par sommet) et lui ajoute des yeux en spirale
  const PSY_MATS = {};
  function psychedelic(g, id) {
    const seed = (id.length * 0.137) % 1;
    const mat = PSY_MATS[id] || (PSY_MATS[id] = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 60, emissive: 0x2a1040 }));
    const col = new THREE.Color();
    g.children.forEach((m) => {
      if (!m.isMesh || !m.userData.psy) return;
      const geo = m.geometry.toNonIndexed ? m.geometry.toNonIndexed() : m.geometry.clone();
      const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) * m.scale.x + m.position.x, y = pos.getY(i) * m.scale.y + m.position.y;
        col.setHSL((((x + 1.6) / 3.2) + y * 0.25 + seed) % 1, 0.95, 0.6);
        colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      m.geometry = geo; m.material = mat;
    });
    [0.25, -0.25].forEach((z) => { // pupilles énormes + petite spirale
      g.add(at(mesh(new THREE.SphereGeometry(0.08, 6, 4), '#111111'), 0.7, 0.15, z * 1.25));
      const sp = at(mesh(new THREE.TorusGeometry(0.1, 0.018, 4, 10), '#ff4fa3', { emissive: 0x551133 }), 0.62, 0.15, z * 1.05); sp.rotation.y = Math.PI / 2; g.add(sp);
    });
  }

  function shadow() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x1a1830, transparent: true, opacity: 0.35, depthWrite: false });
    const b = new THREE.Mesh(new THREE.CircleGeometry(1, 14), mat); b.scale.set(1, 0.42, 1);
    const t = new THREE.Mesh(new THREE.CircleGeometry(0.45, 3), mat); t.position.x = -1.05; t.rotation.z = Math.PI;
    g.add(b, t);
    g.rotation.x = -Math.PI / 2;
    const wrap = new THREE.Group(); wrap.add(g);
    wrap.userData.mat = mat;
    return wrap;
  }

  // ---------------------------------------------------------------- Véhicules & objets
  function unicornBoat() {
    const g = new THREE.Group();
    const ring = mesh(new THREE.TorusGeometry(0.95, 0.38, 8, 18), '#ffffff'); ring.rotation.x = Math.PI / 2; ring.position.y = 0.2;
    const floor = at(mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 16), '#f8bbd0'), 0, 0.02, 0);
    const neck = at(mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.9, 7), '#ffffff'), 0, 0.65, -1.05); neck.rotation.x = -0.3;
    const headM = at(mesh(new THREE.BoxGeometry(0.35, 0.35, 0.6), '#ffffff'), 0, 1.15, -1.3);
    const horn = at(mesh(new THREE.ConeGeometry(0.06, 0.45, 6), '#ffd54f', { emissive: 0x332200 }), 0, 1.5, -1.3);
    const eyes = [-1, 1].map((s) => at(mesh(new THREE.SphereGeometry(0.04, 5, 4), '#212121'), s * 0.18, 1.2, -1.4));
    g.add(ring, floor, neck, headM, horn, ...eyes);
    ['#ff8fb1', '#b39ddb', '#8fd3c9'].forEach((c, i) => g.add(at(mesh(new THREE.BoxGeometry(0.08, 0.3, 0.16), c), 0, 1.1 - i * 0.18, -1.0 + i * 0.12)));
    return g;
  }
  // Bateaux : tier 1 = licorne gonflable, 2 = barque, 3 = chaloupe, 4 = chalutier (cabine sur le côté pour ne pas masquer la vue)
  function boatModel(tier) {
    if (tier <= 1) { const g = unicornBoat(); g.userData.deckY = 0.07; return g; }
    const C = { 2: { w: 1.5, l: 3.0, h: 0.55, col: '#a1785a', trim: '#e8d3b0', deck: 0.4 }, 3: { w: 1.8, l: 3.6, h: 0.7, col: '#ffffff', trim: '#42a5f5', deck: 0.55 }, 4: { w: 2.3, l: 4.6, h: 0.9, col: '#ff8fb1', trim: '#fff59d', deck: 0.75 } }[tier];
    const g = new THREE.Group();
    const hull = mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), C.col);
    hull.scale.set(C.w / 2, C.h, C.l / 2); hull.position.y = C.deck;
    const deck = mesh(new THREE.CircleGeometry(1, 20), '#d9b48f'); deck.rotation.x = -Math.PI / 2; deck.scale.set(C.w / 2, C.l / 2, 1); deck.position.y = C.deck + 0.01;
    const rim = mesh(new THREE.TorusGeometry(1, 0.05, 6, 28), C.trim); rim.rotation.x = Math.PI / 2; rim.scale.set(C.w / 2, C.l / 2, 1); rim.position.y = C.deck + 0.03;
    const bow = at(mesh(new THREE.ConeGeometry(C.w * 0.32, C.l * 0.28, 8), C.col), 0, C.deck - C.h * 0.15, -C.l * 0.5 - C.l * 0.08); bow.rotation.x = -Math.PI / 2;
    const stripe = mesh(new THREE.SphereGeometry(1.002, 14, 3, 0, Math.PI * 2, Math.PI / 2, 0.22), C.trim); stripe.scale.set(C.w / 2, C.h, C.l / 2); stripe.position.y = C.deck;
    g.add(hull, deck, rim, bow, stripe);
    if (tier === 2) {
      g.add(at(mesh(new THREE.BoxGeometry(C.w * 0.8, 0.06, 0.3), '#8d6e63'), 0, C.deck + 0.28, 1.0));
      g.add(at(mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 5), '#8d6e63'), 0.6, C.deck + 1.0, -0.2));
      const sail = at(mesh(new THREE.BoxGeometry(0.02, 1.2, 0.95), '#fffaf0'), 0.6, C.deck + 1.1, 0.25); g.add(sail);
      [-1, 1].forEach((sg) => { const oar = at(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 4), '#c9a27e'), sg * (C.w / 2 + 0.2), C.deck + 0.3, 0.2); oar.rotation.z = sg * 0.9; oar.rotation.x = 0.4; g.add(oar); });
    } else if (tier === 3) {
      g.add(at(mesh(new THREE.BoxGeometry(0.8, 0.9, 1.1), '#fafafa'), -0.5, C.deck + 0.5, 0.7));
      g.add(at(mesh(new THREE.BoxGeometry(0.85, 0.08, 1.2), C.trim), -0.5, C.deck + 1.0, 0.7));
      g.add(at(mesh(new THREE.BoxGeometry(0.02, 0.3, 0.5), '#81d4fa', { emissive: 0x113355 }), -0.09, C.deck + 0.62, 0.7));
      g.add(at(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.6, 8), '#ef5350'), -0.5, C.deck + 1.35, 1.0));
      g.add(at(mesh(new THREE.TorusGeometry(0.22, 0.07, 6, 12), '#ff7043'), 0.7, C.deck + 0.55, 0.9));
      g.add(at(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), '#ffffff'), -0.5, C.deck + 1.6, 0.4));
    } else {
      g.add(at(mesh(new THREE.BoxGeometry(1.0, 1.3, 1.5), '#fafafa'), -0.7, C.deck + 0.7, 1.1));
      g.add(at(mesh(new THREE.BoxGeometry(1.1, 0.1, 1.6), C.trim), -0.7, C.deck + 1.4, 1.1));
      [0.7, 1.4].forEach((z) => g.add(at(mesh(new THREE.BoxGeometry(0.02, 0.35, 0.4), '#81d4fa', { emissive: 0x113355 }), -0.19, C.deck + 0.95, z)));
      g.add(at(mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.8, 8), '#e53950'), -0.7, C.deck + 1.9, 1.4));
      const crane = at(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 5), '#78909c'), 0.8, C.deck + 1.2, 0.8); crane.rotation.z = -0.35; g.add(crane);
      const net = at(mesh(new THREE.TorusGeometry(0.4, 0.09, 6, 14), '#26a69a'), 0.85, C.deck + 0.4, 1.5); net.rotation.x = Math.PI / 2; g.add(net);
      g.add(at(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 4), '#ffffff'), -0.7, C.deck + 2.8, 1.4));
      const flag = at(mesh(new THREE.BoxGeometry(0.5, 0.3, 0.02), '#ffd54f'), -0.45, C.deck + 3.55, 1.4); g.add(flag);
    }
    g.userData.deckY = C.deck + 0.01;
    return g;
  }
  function raft(w, d) {
    const g = new THREE.Group();
    const n = Math.round(w / 0.35);
    for (let i = 0; i < n; i++) g.add(at(mesh(new THREE.CylinderGeometry(0.16, 0.16, d, 6), i % 2 ? '#c9a27e' : '#b8916e'), -w / 2 + i * 0.35 + 0.17, 0.12, 0));
    g.children.forEach((c) => (c.rotation.x = Math.PI / 2));
    return g;
  }
  function stall(color) {
    const g = new THREE.Group();
    [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.3], [0.45, 0.3]].forEach(([x, z]) => g.add(at(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4), '#ffffff'), x, 0.8, z)));
    for (let i = 0; i < 5; i++) { const s = at(mesh(new THREE.BoxGeometry(0.2, 0.05, 0.85), i % 2 ? '#ffffff' : color), -0.4 + i * 0.2, 1.65, 0); s.rotation.x = 0.15; g.add(s); }
    g.add(at(mesh(new THREE.BoxGeometry(1, 0.45, 0.4), '#e8d2b0'), 0, 0.22, -0.3));
    return g;
  }
  function kayak() {
    const g = new THREE.Group();
    const hull = mesh(new THREE.SphereGeometry(1, 10, 6), '#e53950'); hull.scale.set(0.38, 0.22, 1.8); hull.position.y = 0.05;
    g.add(hull);
    const o = otter({ fur: '#7a5236', vest: false, hat: 'fedora', acc: ['trench', 'sunglasses'] });
    o.group.scale.setScalar(0.75); o.group.position.y = -0.05; g.add(o.group);
    const paddle = at(mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 4), '#8d6e63'), 0, 0.7, -0.2); paddle.rotation.z = Math.PI / 2; g.add(paddle);
    g.userData.paddle = paddle; g.userData.otter = o;
    return g;
  }
  function gull() {
    const g = new THREE.Group();
    const b = mesh(new THREE.IcosahedronGeometry(0.3, 0), '#ffffff'); b.scale.set(0.8, 0.8, 1.5); g.add(b);
    const h = at(mesh(new THREE.IcosahedronGeometry(0.18, 0), '#ffffff'), 0, 0.15, -0.42); g.add(h);
    const beak = at(mesh(new THREE.ConeGeometry(0.05, 0.22, 4), '#ffb300'), 0, 0.12, -0.65); beak.rotation.x = -Math.PI / 2; g.add(beak);
    [-1, 1].forEach((s) => g.add(at(mesh(new THREE.SphereGeometry(0.03, 4, 3), '#212121'), s * 0.09, 0.22, -0.55)));
    const wings = [-1, 1].map((s) => { const w = new THREE.Group(); w.position.set(s * 0.2, 0.1, 0); const m = at(mesh(new THREE.BoxGeometry(0.9, 0.04, 0.4), '#b0bec5'), s * 0.45, 0, 0); w.add(m); g.add(w); return w; });
    g.userData.wings = wings;
    return g;
  }
  function bottle() {
    const g = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 8), new THREE.MeshPhongMaterial({ color: '#80cbc4', transparent: true, opacity: 0.6, shininess: 90, flatShading: true }));
    const neck = at(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.15, 0.2, 8), glass.material), 0, 0.35, 0);
    const cork = at(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 6), '#a1785a'), 0, 0.5, 0);
    const paper = at(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.36, 6), '#fff3e0'), 0, 0, 0);
    g.add(glass, neck, cork, paper);
    g.rotation.z = Math.PI / 2 - 0.3;
    const w = new THREE.Group(); w.add(g); return w;
  }
  function tank() {
    const g = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.55), new THREE.MeshPhongMaterial({ color: '#c8f0ff', transparent: true, opacity: 0.28, shininess: 100, depthWrite: false }));
    glass.position.y = 0.36;
    const water = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.48, 0.51), new THREE.MeshPhongMaterial({ color: '#7fd6ff', transparent: true, opacity: 0.3, depthWrite: false }));
    water.position.y = 0.32;
    const sand = at(mesh(new THREE.BoxGeometry(0.86, 0.06, 0.51), '#f3e0b0'), 0, 0.1, 0);
    const base = at(mesh(new THREE.BoxGeometry(0.96, 0.06, 0.6), '#b39ddb'), 0, 0.04, 0);
    const lid = at(mesh(new THREE.BoxGeometry(0.96, 0.04, 0.6), '#b39ddb'), 0, 0.68, 0);
    const weed = at(mesh(new THREE.ConeGeometry(0.05, 0.3, 4), '#66bb6a'), 0.3, 0.27, 0.1);
    g.add(base, sand, weed, water, glass, lid);
    const inner = new THREE.Group(); inner.position.y = 0.35; g.add(inner);
    g.userData.inner = inner;
    return g;
  }

  // ---------------------------------------------------------------- Déco du ponton
  function decoItem(id) {
    const g = new THREE.Group();
    switch (id) {
      case 'deco_panneau': {
        g.add(at(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 5), '#8d6e63'), 0, 0.55, 0));
        const sign = label('NE PAS\nNOURRIR ROGER', 0.9, 0.5, '#fffaf0', '#e53950'); sign.position.set(0, 1.05, 0); g.add(sign);
        break;
      }
      case 'deco_chaise': {
        g.add(at(mesh(new THREE.BoxGeometry(0.6, 0.04, 1.0), '#ffffff'), 0, 0.3, 0));
        const back = at(mesh(new THREE.BoxGeometry(0.58, 0.7, 0.04), '#8fd3c9'), 0, 0.55, 0.5); back.rotation.x = -0.5; g.add(back);
        const seat = at(mesh(new THREE.BoxGeometry(0.56, 0.04, 0.8), '#8fd3c9'), 0, 0.33, -0.05); g.add(seat);
        [[-0.28, -0.45], [0.28, -0.45], [-0.28, 0.4], [0.28, 0.4]].forEach(([x, z]) => g.add(at(mesh(new THREE.BoxGeometry(0.04, 0.3, 0.04), '#ffffff'), x, 0.15, z)));
        break;
      }
      case 'deco_nain':
        g.add(at(mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.3, 7), '#42a5f5'), 0, 0.15, 0));
        g.add(at(mesh(new THREE.IcosahedronGeometry(0.13, 0), '#ffd9b8'), 0, 0.4, 0));
        g.add(at(mesh(new THREE.ConeGeometry(0.14, 0.32, 7), '#e53950'), 0, 0.62, 0));
        { const b = at(mesh(new THREE.ConeGeometry(0.11, 0.2, 6), '#ffffff'), 0, 0.3, -0.08); b.rotation.x = Math.PI; g.add(b); }
        break;
      case 'deco_guirlande': {
        const bulbs = [];
        const cols = [0xff8fb1, 0xffe066, 0x8fd3c9, 0xb39ddb];
        for (let i = 0; i < 14; i++) {
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 5, 4), new THREE.MeshPhongMaterial({ color: cols[i % 4], emissive: cols[i % 4], emissiveIntensity: 0 }));
          m.position.set(-0.8 + (i % 2) * 1.6, 1.05 - Math.sin((i >> 1) / 6 * Math.PI) * 0.1, 3.4 - (i >> 1) * 0.68);
          g.add(m); bulbs.push(m);
        }
        [-0.8, 0.8].forEach((x) => g.add(at(mesh(new THREE.BoxGeometry(0.01, 0.01, 4.4), '#555555'), x, 1.05, 1.3)));
        [-0.8, 0.8].forEach((x) => [3.4, -0.8].forEach((z) => g.add(at(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 4), '#8d6e63'), x, 0.5, z))));
        g.userData.bulbs = bulbs;
        break;
      }
      case 'deco_flamant': {
        const r = mesh(new THREE.TorusGeometry(0.45, 0.18, 6, 14), '#ff8fb1'); r.rotation.x = Math.PI / 2; g.add(r);
        const n = at(mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.8, 6), '#ff8fb1'), 0, 0.45, -0.45); n.rotation.x = 0.2; g.add(n);
        g.add(at(mesh(new THREE.IcosahedronGeometry(0.14, 0), '#ff8fb1'), 0, 0.85, -0.5));
        const bk = at(mesh(new THREE.ConeGeometry(0.05, 0.2, 4), '#212121'), 0, 0.8, -0.68); bk.rotation.x = -2.2; g.add(bk);
        break;
      }
      case 'deco_bbq':
        g.add(at(mesh(new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#37474f'), 0, 0.65, 0));
        g.add(at(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 10), '#9e9e9e'), 0, 0.66, 0));
        [0, 2.1, 4.2].forEach((a) => { const l = at(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4), '#37474f'), Math.sin(a) * 0.2, 0.3, Math.cos(a) * 0.2); g.add(l); });
        for (let i = 0; i < 3; i++) g.add(at(mesh(new THREE.BoxGeometry(0.06, 0.03, 0.35), '#43a047'), -0.1 + i * 0.1, 0.69, 0));
        break;
      case 'deco_statue': {
        g.add(at(mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), '#eceff1'), 0, 0.15, 0));
        const o = otter({ fur: '#ffd54f', belly: '#ffe082', dark: '#ffca28', vest: false, hat: 'hat_couronne' });
        o.group.scale.setScalar(0.45); o.group.position.y = 0.3; o.group.rotation.y = Math.PI; o.armL.rotation.z = -2.6; g.add(o.group);
        break;
      }
    }
    return g;
  }

  G.models = { M, mesh, label, otter, setHat, hat, bobber, roger, fish, shadow, unicornBoat, boatModel, raft, stall, kayak, gull, bottle, tank, decoItem };
})();
