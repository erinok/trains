/* Little places to play. Loaded before app.js; builders run after its scenery.
   No asset downloads, build step, timers, scores, or reading needed to explore. */
'use strict';

const adventure = {
  current: null, lastTrain: null, unlocked: false, ducks: [], things: {},
  lava: [], falls: [], worldButtons: {}, snowBurst: 0,
  passage: null,
  worlds: {
    home: { name: 'Duck pond', icon: '🦆', station: 0, center: [0, 0], distance: 115,
      hint: 'A little train. A big adventure.', actions: ['homeDucks', 'homeMonkeys', 'homeBridge'] },
    snow: { name: 'Snowy peaks', icon: '⛄', station: 4, center: [0, -430], distance: 85,
      hint: 'Scarves on. All aboard!', actions: ['snowman', 'sled', 'snowDucks'] },
    sand: { name: 'Sunny sands', icon: '🏜️', station: 5, center: [432, -420], distance: 83,
      hint: 'Next stop: a splash in the oasis.', actions: ['castle', 'camel', 'sandDucks'] },
    jungle: { name: 'Monkey jungle', icon: '🌋', station: 6, center: [425, 42], distance: 92,
      hint: 'N: back to town · U: into the volcano. Otherwise, keep circling!', actions: ['cablecar', 'waterfall', 'door'] },
    volcano: { name: 'Volcano depths', icon: '🔥', station: 7, center: [1495, 42], distance: 140,
      hint: 'Three stations! Q + W: lava bridge · E: tunnel home.', actions: ['dragon', 'gold', 'forge'] },
  },
};

function installAdventureTrack(nodes, defs) {
  // Two passive trailing joins let incoming trains join a loop without changing
  // its exit switch. Only the facing, lettered points choose a destination.
  nodes.NJA = { pos: V(400, 0, -25), dir: V(1, 0, 0), key: 'N', sel: 0,
    trunk: { seg: 'JN2', end: 'to' }, branches: [{ seg: 'JTOP', end: 'from' }, { seg: 'JOUT', end: 'from' }] };
  nodes.NJIN = { pos: V(450, 0, -25), dir: V(0, 0, 1), sel: 0, autoMerge: true,
    trunk: { seg: 'JN1', end: 'from' }, branches: [{ seg: 'JTOP', end: 'to' }, { seg: 'JFEED', end: 'to' }] };
  nodes.NJLINK = { pos: V(425, 0, -85), dir: V(0, 0, 1), sel: 0, autoMerge: true,
    trunk: { seg: 'L3', end: 'to' }, branches: [{ seg: 'JFEED', end: 'from' }, { seg: 'JOUT', end: 'to' }] };
  nodes.NJB = { pos: V(430, 0, 100), dir: V(-1, 0, 0), key: 'U', sel: 0,
    trunk: { seg: 'JN1', end: 'to' }, branches: [{ seg: 'JN2', end: 'from' }, { seg: 'VT', end: 'from' }] };
  defs.L3.to = 'NJLINK'; defs.L3.mids = [[428, 0, -300], [430, 0, -240], [430, 0, -160], [426, 0, -110]];
  defs.JFEED = { from: 'NJLINK', to: 'NJIN', mids: [[432, 0, -61], [448, 0, -49]] };
  defs.JOUT = { from: 'NJA', to: 'NJLINK', endDir: [0, 0, -1], mids: [[423, 0, -35], [425, 0, -58]] };
  defs.JTOP = { from: 'NJA', to: 'NJIN', mids: [[431, 0, -24], [448, 0, -42]] };
  defs.JN1 = { from: 'NJIN', to: 'NJB', mids: [[466, 0, 9], [480, 0, 42], [475, 0, 73], [456, 0, 94]] };
  defs.JN2 = { from: 'NJB', to: 'NJA', mids: [[398, 0, 97], [378, 0, 72], [370, 0, 41], [374, 0, 6], [380, 0, -18]] };
  nodes.VEND = { pos: V(425, 0, 0), dir: V(0, 0, -1), sel: 0, terminal: true,
    trunk: { seg: 'VT', end: 'to' }, branches: [] };
  defs.VT = { from: 'NJB', to: 'VEND', mids: [[410, 0, 92], [415, 0, 77], [425, 0, 67], [425, 0, 43], [425, 0, 20]] };

  nodes.MEND = { pos: V(1270, 0, 40), dir: V(1, 0, 0), sel: 0, terminal: true,
    trunk: { seg: 'MP', end: 'from' }, branches: [] };
  nodes.MPT = { pos: V(1360, 0, 40), dir: V(1, 0, 0), sel: 0, autoMerge: true,
    trunk: { seg: 'MP', end: 'to' }, branches: [{ seg: 'MT', end: 'from' }, { seg: 'MX', end: 'to' }] };
  nodes.MGA = { pos: V(1420, 0, 40), dir: V(0, 0, -1), sel: 0, autoMerge: true,
    trunk: { seg: 'MG0', end: 'from' }, branches: [{ seg: 'MG3', end: 'to' }, { seg: 'MT', end: 'to' }] };
  nodes.MGW = { pos: V(1420, 0, 0), dir: V(0, 0, -1), key: 'Q', sel: 0,
    trunk: { seg: 'MG0', end: 'to' }, branches: [{ seg: 'MG1', end: 'from' }, { seg: 'MGBRIDGE', end: 'from' }] };
  nodes.MGB = { pos: V(1580, 0, 40), dir: V(0, 0, 1), key: 'W', sel: 0,
    trunk: { seg: 'MG2', end: 'from' }, branches: [{ seg: 'MG1', end: 'to' }, { seg: 'MGBRIDGE', end: 'to' }] };
  nodes.MGC = { pos: V(1480, 0, 125), dir: V(-1, 0, 0), key: 'E', sel: 0,
    trunk: { seg: 'MG2', end: 'to' }, branches: [{ seg: 'MG3', end: 'from' }, { seg: 'MX', end: 'from' }] };
  defs.MP = { from: 'MEND', to: 'MPT', mids: [[1310, 0, 40], [1340, 0, 40]] };
  defs.MT = { from: 'MPT', to: 'MGA', mids: [[1385, 0, 48], [1404, 0, 66], [1418, 0, 59]] };
  defs.MX = { from: 'MGC', to: 'MPT', endDir: [-1, 0, 0], mids: [[1430, 0, 138], [1387, 0, 110], [1380, 0, 64], [1376, 0, 44]] };
  defs.MG0 = { from: 'MGA', to: 'MGW', mids: [[1420, 0, 20]] };
  defs.MG1 = { from: 'MGW', to: 'MGB', mids: [[1438, 0, -40], [1480, 0, -58], [1524, 0, -52], [1560, 0, -29], [1576, 0, 8]] };
  defs.MGBRIDGE = { from: 'MGW', to: 'MGB', mids: [[1435, 0, -20], [1460, 2, -12], [1485, 5, 12], [1520, 5, 16], [1552, 2, 6], [1575, 0, 16]] };
  defs.MG2 = { from: 'MGB', to: 'MGC', mids: [[1575, 0, 80], [1555, 0, 115], [1520, 0, 130]] };
  defs.MG3 = { from: 'MGC', to: 'MGA', mids: [[1442, 0, 119], [1422, 0, 88], [1420, 0, 64]] };
}

function advPut(obj, x, y, z, parent = scene) {
  obj.position.set(x, y, z); parent.add(obj); return obj;
}

function advGround(x, z, radius, color, y = 0.075) {
  const m = liftDecal(mesh(new THREE.CircleGeometry(radius, 48), color, { shadow: false }), 15);
  // Actual heights separate these layers; a gentle bias prevents the water
  // from winning depth tests against nearby rails at shallow camera angles.
  m.material.polygonOffsetFactor = -0.1;
  m.material.polygonOffsetUnits = -1;
  m.rotation.x = -Math.PI / 2;
  return advPut(m, x, y, z);
}

function advPool(x, z, r, color, icy = false) {
  advGround(x, z, r + 1.3, icy ? 0xfaffff : 0xf4dba8, 0.08);
  const water = advGround(x, z, r, color, 0.095);
  water.material.roughness = 0.2;
  for (let i = 0; i < 3; i++) {
    const ripple = mesh(new THREE.TorusGeometry(r * (0.28 + i * 0.22), 0.035, 4, 40),
      icy ? 0xe2fbff : 0x9ceade, { shadow: false });
    ripple.rotation.x = Math.PI / 2;
    advPut(ripple, x, 0.12 + i * 0.004, z);
  }
  return water;
}

function advTube(points, radius, color, parent = scene) {
  const curve = new THREE.CatmullRomCurve3(points);
  const tube = mesh(new THREE.TubeGeometry(curve, 36, radius, 6, false), color, { shadow: false });
  parent.add(tube); return tube;
}

function advSign(emoji, pos, size = 3) {
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(emoji), depthTest: true }));
  sign.position.copy(pos); sign.scale.set(size, size, 1); scene.add(sign); return sign;
}

function advGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const ctx = c.getContext('2d'), glow = ctx.createRadialGradient(16, 16, 1, 16, 16, 16);
  glow.addColorStop(0, '#fff'); glow.addColorStop(0.2, '#ffffe9'); glow.addColorStop(1, '#ffffff00');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
}

function addAdventure(id, icon, label, obj, action, distance = 19) {
  const pos = obj.getWorldPosition(V(0, 0, 0));
  adventure.things[id] = { icon, label, obj, action, distance, pos, t: 0, cooldown: 0 };
  tagTap(obj, 'adventure', id);
}

function advDuck(x, z, scale, outfit, phase = 0) {
  const d = makeDuck(scale, phase ? 0xffd568 : 0xfff5d6);
  const a = d.userData.anim;
  Object.assign(a, { center: V(x, 0, z), r: 2.3 + phase * 0.25, w: 0.35,
    a: phase * 1.7, height: 0.12 });
  if (outfit === 'scarf') {
    advPut(cyl(0.27, 0.28, 0.14, 0xe86e85, { seg: 10 }), 0, 0.64, 0.39, d);
    advPut(box(0.15, 0.42, 0.07, 0xe86e85), 0.23, 0.45, 0.53, d);
    advPut(sph(0.29, 0x52b6c9, { seg: 10 }), 0, 0.91, 0.42, d).scale.y = 0.45;
    advPut(sph(0.095, 0xfff5de, { seg: 8 }), 0, 1.08, 0.42, d);
  } else if (outfit === 'sunhat') {
    advPut(cyl(0.44, 0.44, 0.065, 0xf5c975, { seg: 12 }), 0, 1.00, 0.42, d);
    advPut(cyl(0.2, 0.27, 0.19, 0xf5c975, { seg: 12 }), 0, 1.09, 0.42, d);
  } else if (outfit === 'miner') {
    advPut(sph(0.32, 0xf1b83e, { seg: 10 }), 0, 0.96, 0.42, d).scale.y = 0.6;
    advPut(cyl(0.4, 0.4, 0.07, 0xf1b83e, { seg: 12 }), 0, 0.96, 0.42, d);
    const lamp = advPut(sph(0.1, 0xffedac, { seg: 6 }), 0, 1.05, 0.73, d);
    lamp.material.emissive.setHex(0xffbb44); lamp.material.emissiveIntensity = 1;
  }
  d.position.set(x + Math.cos(a.a) * a.r, a.height, z + Math.sin(a.a) * a.r);
  scene.add(d); ducks.push(d); adventure.ducks.push(d); tagTap(d, 'duck', d);
  return d;
}

function advFlock(x, z, outfit) {
  return [advDuck(x, z, 1.65, outfit), advDuck(x, z, 1.05, outfit, 1),
    advDuck(x, z, 0.9, outfit, 2)];
}

function advQuacks(flock) {
  flock.forEach(d => { d.userData.anim.flap = 1; });
  audio.quack(1.3);
}

function advPines(cx, cz, count, snow) {
  // Repeated planting is instanced: four draw calls for an entire forest.
  const spots = [];
  for (let i = 0; i < count * 3 && spots.length < count; i++) {
    const a = i * 2.39996, r = 38 + (i % 7) * 6;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const nearHut = snow && [[-65, -432], [19, -484], [-23, -493]]
      .some(([hx, hz]) => (x - hx) ** 2 + (z - hz) ** 2 < 9 ** 2);
    if (clearOfTrack(x, z, 6) && !nearHut) spots.push([x, z, 1.1 + (i % 4) * 0.4]);
  }
  const parts = [
    [new THREE.CylinderGeometry(0.18, 0.28, 2, 6), 0x806349, 1],
    [new THREE.ConeGeometry(1.7, 3.6, 7), 0x467c71, 3],
    [new THREE.ConeGeometry(1.35, 3, 7), snow ? 0xddeef2 : 0x68b58b, 4.4],
    [new THREE.ConeGeometry(0.9, 2.4, 7), snow ? 0xffffff : 0x94c77e, 5.7],
  ];
  for (const [geo, color, y] of parts) {
    const inst = new THREE.InstancedMesh(geo, mat(color), spots.length);
    spots.forEach(([x, z, s], i) => {
      _dummy.position.set(x, y * s, z); _dummy.rotation.set(0, i, 0);
      _dummy.scale.setScalar(s); _dummy.updateMatrix(); inst.setMatrixAt(i, _dummy.matrix);
    });
    inst.castShadow = true; inst.receiveShadow = true; scene.add(inst);
  }
  _dummy.scale.setScalar(1);
}

function advPalm(x, z, s = 1) {
  const g = advPut(new THREE.Group(), x, 0, z); g.scale.setScalar(s);
  advPut(cyl(0.24, 0.45, 6, 0xb18a58, { seg: 7 }), 0, 3, 0, g).rotation.z = 0.08;
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const leaf = sph(1, i % 2 ? 0x5bac66 : 0x328c56, { seg: 8 });
    leaf.scale.set(0.55, 0.12, 2.7); leaf.rotation.y = -a;
    advPut(leaf, -Math.sin(a) * 1.6, 6.1, Math.cos(a) * 1.6, g);
  }
  advPut(sph(0.4, 0xb58a4c, { seg: 7 }), 0.3, 5.5, 0.3, g);
  return g;
}

function advHut(x, z, color, emoji) {
  const g = advPut(new THREE.Group(), x, 0, z);
  advPut(box(5, 4, 5, color), 0, 2, 0, g);
  const roof = advPut(cone(4.7, 2.2, 0xffecd4, { seg: 4 }), 0, 5, 0, g);
  roof.rotation.y = Math.PI / 4;
  advPut(box(1.1, 2.3, 0.1, 0x765745), 0, 1.15, 2.56, g);
  for (const x of [-1.6, 1.6]) {
    advPut(box(0.9, 1, 0.1, 0xffd479), x, 2.6, 2.56, g);
  }
  advSign(emoji, V(x, 7.2, z), 2.4);
  return g;
}

function buildAdventureWorlds() {
  buildSnowAdventure(); buildSandAdventure(); buildJungleAdventure(); buildVolcanoWorld();
  addAdventure('homeDucks', '🦆', 'Quack!', ducks[0], () => advQuacks(ducks.slice(0, 4)), 15);
  addAdventure('homeMonkeys', '🐒', 'Wheee!', monkeys[0], () => {
    monkeys[0].userData.anim.spin = 1; audio.monkey();
  }, 14);
  addAdventure('homeBridge', '🌉', 'Bridge', bridge.leaves[0], () => setBridge(!bridge.up), 25);
}

function buildSnowAdventure() {
  advPines(0, -430, 30, true);
  advPool(-25, -416, 10, 0x80d3e7, true);
  const flock = advFlock(-30, -417, 'scarf');
  addAdventure('snowDucks', '🦆', 'Quack!', flock[0], () => advQuacks(flock));
  addAdventure('snowman', '⛄', 'Wobble!', adventure.snowman, () => {
    adventure.snowBurst = 4; audio.wee();
  });
  advHut(-65, -432, 0xd97974, '☕');
  advHut(19, -484, 0x729bc2, '🧣');
  advHut(-23, -493, 0xd39a69, '🔔');
  for (let i = 0; i < 4; i++) advPut(sph(1.7 + i * 0.1, 0xf5fbff, { seg: 9 }), -61 + i * 3, 0.4, -440);

  // A red sled, a bundled-up penguin, and an oval slide beside the railway.
  const sled = advPut(new THREE.Group(), -18, 0.2, -409);
  for (const x of [-0.8, 0.8]) advPut(box(0.13, 0.18, 3, 0x6d6576), x, 0.15, 0, sled);
  advPut(box(2, 0.3, 2.5, 0xe36b69), 0, 0.42, 0, sled);
  const penguin = advPut(sph(0.8, 0x344558, { seg: 12 }), 0, 1.25, 0, sled);
  penguin.scale.set(0.85, 1.25, 0.8);
  const belly = advPut(sph(0.57, 0xfff5dd, { seg: 10 }), 0, 1.2, 0.4, sled);
  belly.scale.set(0.85, 1.2, 0.55);
  advPut(sph(0.55, 0x344558), 0, 2.13, 0.1, sled);
  advPut(cone(0.16, 0.45, 0xf5b44f), 0, 2.02, 0.68, sled).rotation.x = Math.PI / 2;
  for (const x of [-0.19, 0.19]) advPut(sph(0.075, 0xffffff), x, 2.25, 0.58, sled);
  advPut(cyl(0.45, 0.46, 0.2, 0xe76b87), 0, 1.8, 0.1, sled);
  adventure.sled = sled;
  addAdventure('sled', '🛷', 'Wheee!', sled, () => audio.wee());
  const slide = advGround(-17, -404, 7, 0xd4edf3, 0.085); slide.scale.set(1.4, 0.6, 1);

  // A real open arch over the rails, with ample clearance for the tallest engine.
  const at = nearestOnSeg(SEGS.SN1, -7, -479);
  const arch = advPut(new THREE.Group(), at.p.x, at.p.y, at.p.z);
  arch.lookAt(at.p.clone().add(segTangent(SEGS.SN1, at.s)));
  for (const x of [-4.1, 4.1]) advPut(box(2, 6.5, 6, 0xc4e4ed), x, 3.25, 0, arch);
  advPut(box(10.2, 2, 6, 0xf6fdff), 0, 7.5, 0, arch);
  for (const x of [-3, -1.5, 1.5, 3]) {
    const icicle = advPut(cone(0.2, 1.1, 0x99d5e9, { seg: 5 }), x, 6.1, 3.1, arch);
    icicle.rotation.z = Math.PI;
  }
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(150 * 3);
  for (let i = 0; i < 150; i++) {
    positions[i * 3] = Math.sin(i * 17.4) * 85;
    positions[i * 3 + 1] = 2 + (i * 13.7) % 45;
    positions[i * 3 + 2] = -430 + Math.cos(i * 8.1) * 80;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  adventure.snow = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0xffffff, map: advGlowTexture(), size: 0.55, transparent: true, opacity: 0.8, depthWrite: false }));
  scene.add(adventure.snow);
}

function buildSandAdventure() {
  // A date-palm oasis, duck family, and a little market outside the northern arc.
  advPool(454, -447, 8, 0x44c4c2);
  const flock = advFlock(454, -450, 'sunhat');
  addAdventure('sandDucks', '🦆', 'Splash!', flock[0], () => advQuacks(flock));
  [[442, -448, 1.3], [464, -449, 1], [461, -436, 1.2], [444, -475, 1]].forEach(p => advPalm(...p));
  advHut(438, -480, 0xe1a272, '🍉');
  for (let i = 0; i < 5; i++) {
    const dune = advPut(sph(9 + i, i % 2 ? 0xecc996 : 0xe5c18c, { seg: 12 }),
      385 + i * 23, -1, -486 - (i % 2) * 8);
    dune.scale.set(1.4, 0.32, 0.8);
  }
  const castle = advPut(new THREE.Group(), 462, 0, -413);
  advGround(462, -413, 10, 0xf3d6a6);
  advPut(box(7, 3.6, 6, 0xe6b774), 0, 1.8, 0, castle);
  for (const x of [-3.5, 3.5]) for (const z of [-3, 3]) {
    advPut(cyl(1.3, 1.5, 5.5, 0xf2cb8c, { seg: 10 }), x, 2.75, z, castle);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      advPut(box(0.7, 0.7, 0.7, 0xf5d299), x + Math.cos(a), 5.7, z + Math.sin(a), castle);
    }
  }
  advPut(box(1.8, 2.6, 0.08, 0xad8052), 0, 1.3, 3.06, castle);
  advPut(cyl(0.07, 0.07, 3, 0x8c6b4c), 0, 5, 0, castle);
  advPut(box(1.8, 0.9, 0.05, 0xe37982), 0.9, 6.2, 0, castle);
  adventure.castle = castle;
  addAdventure('castle', '🏰', 'Build!', castle, () => {
    audio.clunk(); sparkleAt(castle.position, [0xf1c98c, 0xffe2a3], 16);
  }, 24);

  // A friendly camel with an enormous smile and a picnic blanket.
  const camel = advPut(new THREE.Group(), 405, 0, -442);
  const body = advPut(sph(2, 0xcf9b63, { seg: 12 }), 0, 3.3, 0, camel);
  body.scale.set(0.9, 0.8, 1.5);
  advPut(sph(1.4, 0xcf9b63, { seg: 12 }), 0, 4.5, -0.5, camel);
  advPut(box(3.6, 0.12, 2.1, 0xda7b7d), 0, 3.9, 0.7, camel);
  for (const x of [-1, 1]) for (const z of [-1.65, 1.65]) {
    advPut(cyl(0.24, 0.3, 2.7, 0xc7935c, { seg: 8 }), x, 1.4, z, camel);
    advPut(sph(0.4, 0x997351, { seg: 8 }), x, 0.28, z + 0.15, camel);
  }
  const neck = advPut(cyl(0.52, 0.8, 3.7, 0xcf9b63, { seg: 10 }), 0, 4.8, 2.3, camel);
  neck.rotation.x = 0.3;
  const head = advPut(new THREE.Group(), 0, 6.4, 2.9, camel);
  advPut(sph(0.85, 0xd5a16b), 0, 0, 0, head).scale.z = 1.3;
  advPut(sph(0.6, 0xefc593), 0, -0.28, 0.82, head).scale.set(1, 0.6, 1);
  for (const x of [-0.55, 0.55]) {
    advPut(sph(0.12, 0x342b32), x, 0.2, 0.58, head);
    advPut(sph(0.3, 0xd5a16b), x * 1.4, 0.65, -0.28, head).scale.y = 1.6;
  }
  adventure.camelHead = head;
  addAdventure('camel', '🐪', 'Hello!', camel, () => {
    if (audio.ctx) audio.tone(180, audio.ctx.currentTime, 0.6, { slide: 180, vol: 0.1 });
  }, 21);
}

function buildJungleAdventure() {
  [[391, 8, 1.5], [388, 74, 1.2], [461, 0, 1.4], [456, 77, 1.6],
    [410, -10, 1.3], [489, 57, 1.2], [366, 80, 1.4]].forEach(p => advPalm(...p));
  makeJungleTree(380, 33, 2.7);
  makeJungleTree(472, 56, 0.4);
  advHut(385, 91, 0xc39458, '🍌');
  // Water tumbles from a broad rock shelf into a lagoon by the western line.
  advPool(355, 43, 10, 0x3cc3cd);
  const waterfall = advPut(new THREE.Group(), 353, 0, 27);
  advPut(box(15, 13, 6, 0x768f77), 0, 6.5, 0, waterfall);
  advPut(box(17, 1.8, 8, 0x65ab6d), 0, 13.2, 0, waterfall);
  advPut(box(8, 12, 0.3, 0x7bdeea), 0, 6.4, 3.3, waterfall);
  advPut(box(8, 0.04, 7, 0x68d8de, { shadow: false }), 353, 0.13, 33.2);
  for (const x of [349, 357]) {
    advPut(sph(2.3, 0x768f77, { seg: 7 }), x, 1, 30).scale.set(1, 0.7, 1.5);
  }
  for (let i = 0; i < 8; i++) {
    const drop = advPut(box(0.25, 2.2, 0.2, 0xe5ffff), -3.5 + i, (i * 3.7) % 12, 3.55, waterfall);
    adventure.falls.push(drop);
  }
  addAdventure('waterfall', '💦', 'Splish!', waterfall, () => {
    sparkleAt(V(353, 2, 35), [0xbcefff, 0x62dadd], 18);
    if (audio.ctx) audio.noise(audio.ctx.currentTime, 0.65, { freq: 1600, vol: 0.07 });
  }, 26);

  // A tiny cable car for the monkeys: open sides make its passengers visible.
  const start = V(384, 12, 8), end = V(400, 22, 69);
  advTube([start, start.clone().lerp(end, 0.5).add(V(0, -1.3, 0)), end], 0.09, 0x69736a);
  for (const p of [start, end]) {
    // Cantilevered supports keep the cabins clear of both pylons at the ends.
    advPut(cyl(0.35, 0.65, p.y, 0x9a7552, { seg: 8 }), p.x + 4.5, p.y / 2, p.z);
    advPut(box(7, 0.45, 0.65, 0x876443), p.x + 1.5, p.y, p.z);
  }
  const car = advPut(new THREE.Group(), start.x, start.y - 3.4, start.z);
  advPut(box(3.8, 0.3, 4.8, 0xe0aa51), 0, 0, 0, car);
  for (const x of [-1.8, 1.8]) {
    advPut(box(0.15, 0.9, 4.5, 0xdf8570), x, 0.7, 0, car);
    for (const z of [-2, 2]) advPut(cyl(0.09, 0.09, 2.7, 0xf1e4bb), x, 1.4, z, car);
  }
  advPut(box(4.6, 0.25, 5.4, 0xf1bb59), 0, 2.9, 0, car);
  advPut(cyl(0.08, 0.08, 0.6, 0x69736a), 0, 3.3, 0, car);
  for (const z of [-1, 1]) {
    const monkey = makeMonkey(); advPut(monkey, 0, 2.2, z, car);
    monkeys.push(monkey); tagTap(monkey, 'monkey', monkey);
  }
  adventure.cable = { car, start, end, phase: 0, boost: 0 };
  addAdventure('cablecar', '🚠', 'Ding ding!', car, () => {
    adventure.cable.boost = 6; audio.ding(); audio.monkey();
  }, 21);

  const mouth = nearestOnSeg(SEGS.VT, 425, 67).s;
  adventure.outerMouth = mouth;
  buildAdventureTunnel(SEGS.VT, mouth, mouth + 32, 0x625048, 'end');
  const lever = switches.find(sw => sw.node === NODES.NJB).g;
  const sign = advSign('🌋', lever.position.clone().add(V(0, 6.5, 0)), 3);
  adventure.door = { sign };
  addAdventure('door', '🔀', 'Tunnel switch', lever, () => useVolcanoDoor(), 30);
  advSign('🏘️', NODES.NJA.pos.clone().add(V(0, 7, 0)), 3);
}

function buildAdventureTunnel(seg, start, end, color, capped = null) {
  const points = [];
  for (let i = 0; i <= 40; i++) points.push(segPoint(seg, start + (end - start) * i / 40).add(V(0, 2.7, 0)));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 80, 5, 16, false),
    new THREE.MeshStandardMaterial({ color: 0x28211d, roughness: 1, side: THREE.DoubleSide }));
  scene.add(tube);
  const floor = new THREE.Mesh(ribbonGeometry(points.map(p => p.clone().add(V(0, -2.7, 0))), 5, 0.105), mat(0x302721));
  floor.material.polygonOffset = true; floor.material.polygonOffsetFactor = -0.1; floor.material.polygonOffsetUnits = -1;
  scene.add(floor);
  if (capped) {
    const s = capped === 'end' ? end : start;
    const cap = new THREE.Mesh(new THREE.CircleGeometry(5.3, 32), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }));
    cap.position.copy(segPoint(seg, s)).add(V(0, 2.7, 0));
    cap.lookAt(cap.position.clone().add(segTangent(seg, s))); scene.add(cap);
  }
  // Receding ribs, warm wall lamps, and a rock lip make the darkness a place.
  for (let s = start; s <= end; s += 7) {
    const p = segPoint(seg, s).add(V(0, 2.7, 0)), tangent = segTangent(seg, s);
    const ring = mesh(new THREE.TorusGeometry(4.85, 0.18, 6, 20), 0x514338, { rough: 1 });
    ring.position.copy(p); ring.lookAt(p.clone().add(tangent)); scene.add(ring);
    const side = V(0, 0, 0).crossVectors(UP, tangent).normalize();
    const lamp = sph(0.22, 0xffb658, { seg: 6 });
    lamp.material.emissive.setHex(0xff8f26); lamp.material.emissiveIntensity = 0.75;
    lamp.position.copy(p).addScaledVector(side, 4.5); scene.add(lamp);
  }
  for (const s of (capped === 'end' ? [start] : capped === 'start' ? [end] : [start, end])) {
    const p = segPoint(seg, s).add(V(0, 2.7, 0));
    const rock = mesh(new THREE.TorusGeometry(6.1, 1.3, 7, 20), color, { rough: 1 });
    rock.position.copy(p); rock.lookAt(p.clone().add(segTangent(seg, s))); rock.scale.z = 2; scene.add(rock);
  }
}

function buildVolcanoWorld() {
  advGround(1495, 40, 500, 0x211c1b, 0.005);
  advGround(1495, 40, 205, 0x3d302a, 0.035);
  advGround(1495, 40, 165, 0x4e3d31, 0.055);
  adventure.cavernRoof = new THREE.Group(); scene.add(adventure.cavernRoof);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(330, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x261e1b, roughness: 1, side: THREE.BackSide, flatShading: true }));
  advPut(dome, 1495, -12, 40, adventure.cavernRoof);
  buildAdventureTunnel(SEGS.MP, 0, 78, 0x564239, 'start');
  // Basalt walls enclose the railway; low foreground rocks keep the map readable.
  for (let i = 0; i < 48; i++) {
    const a = i * Math.PI * 2 / 48, x = 1495 + Math.cos(a) * 182, z = 40 + Math.sin(a) * 174;
    if (x < 1360 && Math.abs(z - 40) < 24) continue;
    const h = 24 + (i * 13) % 28;
    advPut(cyl(8 + i % 3, 12, h, i % 2 ? 0x493b35 : 0x3c302c, { seg: 5 }), x, h / 2, z);
    const tooth = advPut(cone(7, 24, 0x382c29, { seg: 5 }), x, 85 + i % 4 * 8, z, adventure.cavernRoof);
    tooth.rotation.z = Math.PI;
  }
  const lavaPool = (x, z, r) => {
    advGround(x, z, r + 2.5, 0x251c19, 0.075);
    const shape = new THREE.Shape();
    for (let i = 0; i <= 48; i++) {
      const a = i % 48 * Math.PI * 2 / 48, radius = r * (0.94 + Math.sin(a * 5) * 0.055 + Math.cos(a * 9) * 0.035);
      const px = Math.cos(a) * radius, py = Math.sin(a) * radius;
      if (i === 0) shape.moveTo(px, py); else shape.lineTo(px, py);
    }
    const lava = mesh(new THREE.ShapeGeometry(shape), 0xf66521, { shadow: false });
    lava.material.polygonOffset = true; lava.material.polygonOffsetFactor = -0.1; lava.material.polygonOffsetUnits = -1;
    lava.rotation.x = -Math.PI / 2; advPut(lava, x, 0.09, z);
    lava.material.emissive.setHex(0xf74c13); lava.material.emissiveIntensity = 0.8;
    adventure.lava.push(lava);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.39996;
      const crust = mesh(new THREE.CircleGeometry(r * 0.15, 5), 0x513025, { shadow: false });
      crust.material.polygonOffset = true; crust.material.polygonOffsetFactor = -0.1; crust.material.polygonOffsetUnits = -1;
      crust.rotation.set(-Math.PI / 2, 0, a); crust.scale.set(1.5, 0.65, 1);
      advPut(crust, x + Math.cos(a) * r * 0.55, 0.115, z + Math.sin(a) * r * 0.55);
    }
    return lava;
  };
  lavaPool(1500, 30, 34); lavaPool(1514, 77, 14); lavaPool(1452, 55, 12);
  // Lava cascades down an outcrop behind the gold mine.
  advPut(cyl(9, 14, 28, 0x46332d, { seg: 6 }), 1502, 12, -114);
  const fall = advTube([V(1502, 27, -108), V(1500, 7, -88), V(1500, 0.18, -69)], 1.7, 0xed5e22);
  fall.material.emissive.setHex(0xff5815); fall.material.emissiveIntensity = 0.7; adventure.lava.push(fall);
  for (const [x, z] of [[1480, 25], [1530, 75]]) scene.add(advPut(new THREE.PointLight(0xff7a2e, 1.7, 95, 2), x, 9, z));
  // Stone parapets alongside the high lava crossing.
  for (let u = 40; u < SEGS.MGBRIDGE.len - 35; u += 4) {
    const p = segPoint(SEGS.MGBRIDGE, u), tangent = segTangent(SEGS.MGBRIDGE, u);
    const side = V(0, 0, 0).crossVectors(UP, tangent).normalize();
    for (const dir of [-1, 1]) {
      const post = box(0.5, 1.15, 0.6, 0x675347);
      post.position.copy(p).addScaledVector(side, dir * 2); post.position.y += 0.5; scene.add(post);
    }
  }
  const gold = advPut(new THREE.Group(), 1490, 0, -76);
  advPut(box(10, 1.4, 7, 0x5f4330), 0, 0.7, 0, gold);
  for (let i = 0; i < 30; i++) {
    const nugget = advPut(mesh(new THREE.DodecahedronGeometry(0.8 + i % 3 * 0.25), 0xe7b53c, { metal: 0.65 }),
      Math.sin(i * 7) * 4, 1.5 + (i % 4) * 0.55, Math.cos(i * 4) * 2.5, gold);
    nugget.rotation.set(i, i * 2, 0);
  }
  const lid = advPut(box(5, 0.6, 3, 0x9d6332), 0, 3, -2, gold);
  adventure.goldLid = lid;
  advHut(1464, -72, 0x846244, '⛏️');
  const flock = advFlock(1478, -66, 'miner');
  addAdventure('gold', '🪙', 'Treasure!', gold, () => {
    sparkleAt(gold.position.clone().add(V(0, 3, 0)), [0xffd55f, 0xeaa62e], 22); advQuacks(flock); audio.ding();
  }, 24);
  const forge = advPut(new THREE.Group(), 1440, 0, 87);
  advPut(box(7, 5, 6, 0x6c5142), 0, 2.5, 0, forge);
  const fire = advPut(box(3.5, 2.8, 0.15, 0xff9436), 0, 1.8, 3.1, forge);
  fire.material.emissive.setHex(0xff7c1c); fire.material.emissiveIntensity = 0.9; adventure.lava.push(fire);
  advPut(cyl(1.2, 1.6, 9, 0x4c3a32, { seg: 8 }), 0, 8, -1, forge);
  const hammer = advPut(new THREE.Group(), 5.5, 3.5, 0, forge);
  advPut(box(0.4, 4, 0.4, 0x9b6b43), 0, 0, 0, hammer);
  advPut(box(2.4, 1.2, 1.4, 0x697075), 0, 2, 0, hammer);
  advPut(box(3, 1.4, 2, 0x41464a), 5.5, 0.7, 0, forge);
  adventure.hammer = hammer;
  addAdventure('forge', '⚒️', 'Clang!', forge, () => {
    sparkleAt(V(1445.5, 2, 87), [0xffad38, 0xffda62], 18); audio.clunk();
  }, 25);
  const dragon = advPut(new THREE.Group(), 1536, 0, 95);
  const body = advPut(sph(4, 0xb94b34, { seg: 14 }), 0, 3, 0, dragon); body.scale.set(1, 0.8, 1.4);
  const belly = advPut(sph(2.8, 0xe9d9ae), 0, 2.7, 2.4, dragon); belly.scale.z = 0.6;
  const head = advPut(new THREE.Group(), 0, 5.4, 4.3, dragon);
  advPut(sph(2.2, 0xd4683d), 0, 0, 0, head);
  advPut(sph(1.7, 0xe58a50), 0, -0.8, 1.5, head).scale.set(1, 0.65, 1);
  for (const x of [-0.9, 0.9]) {
    advPut(sph(0.17, 0x394d58), x, 0.35, 1.85, head);
    advPut(sph(0.25, 0xe9a7b0), x * 1.8, -0.5, 1.3, head);
    advPut(cone(0.35, 1.7, 0xf9d38e, { seg: 7 }), x * 1.7, 1.95, -0.6, head);
    const wing = advPut(sph(2.3, 0xefaa4c, { seg: 9 }), x * 4.5, 4, -0.8, dragon);
    wing.scale.set(0.3, 1.15, 1); wing.rotation.z = -x * 0.5;
    advPut(sph(1.1, 0xb94b34), x * 2.5, 0.9, 3, dragon).scale.z = 1.4;
  }
  advTube([V(0, 2, -4), V(-1, 1.5, -7), V(-5, 0.6, -8), V(-7, 1, -6)], 0.7, 0xb94b34, dragon);
  for (let i = 0; i < 4; i++) advPut(cone(0.65, 1.4, 0xf4bd55, { seg: 5 }), 0, 6.1 - i * 0.3, -i * 1.3, dragon);
  adventure.dragon = { group: dragon, head, body };
  addAdventure('dragon', '🐉', 'Fire sneeze!', dragon, () => {
    sparkleAt(V(1536, 5.5, 104), [0xffcc46, 0xff7436, 0xc93d25], 26); playAdventureChime();
  }, 31);

  // Obsidian outcrops, ore carts, and a dragon nest give each station its own place.
  for (let i = 0; i < 55; i++) {
    const a = i * 2.39996, r = 85 + i % 5 * 13;
    const x = 1495 + Math.cos(a) * r, z = 40 + Math.sin(a) * r;
    if (!clearOfTrack(x, z, 8) || Math.abs(x - 1490) < 34 && z < -58 || Math.abs(x - 1440) < 13 && Math.abs(z - 87) < 14) continue;
    const rock = mesh(new THREE.DodecahedronGeometry(2 + i % 4), i % 3 ? 0x594032 : 0x292729, { rough: 0.85 });
    rock.scale.set(1, 0.8 + i % 3 * 0.5, 0.8); rock.rotation.y = i; advPut(rock, x, 1.2, z);
    if (i % 4 === 0) {
      const ore = cone(0.9, 3, 0xc88732, { seg: 5 }); ore.rotation.z = 0.35;
      advPut(ore, x + 1, 3.5, z);
    }
  }
  for (let i = 0; i < 3; i++) {
    const cart = advPut(new THREE.Group(), 1512 + i * 4, 0, -66);
    advPut(box(2.5, 1.4, 3, 0x665345), 0, 1.2, 0, cart);
    for (const x of [-1.3, 1.3]) for (const z of [-1, 1]) advPut(cyl(0.4, 0.4, 0.22, 0x302b28, { axis: 'x', seg: 8 }), x, 0.4, z, cart);
    for (let j = 0; j < 4; j++) advPut(mesh(new THREE.DodecahedronGeometry(0.55), 0xdcb54e, { metal: 0.5 }), Math.sin(j * 5) * 0.6, 2, Math.cos(j * 4), cart);
  }
  const nest = advPut(mesh(new THREE.TorusGeometry(4, 0.7, 6, 16), 0x684130), 1546, 0.6, 89);
  nest.rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const egg = advPut(sph(1.15, [0xe9b25c, 0xd78648, 0xe2c68c][i]), 1545 + Math.cos(i * 2.1) * 1.4, 1.5, 89 + Math.sin(i * 2.1) * 1.4);
    egg.scale.y = 1.35; tagTap(egg, 'adventure', 'dragon');
  }
  // Rising embers stay low over the lava, unlike a star-filled sky.
  const positions = new Float32Array(80 * 3);
  for (let i = 0; i < 80; i++) {
    positions[i * 3] = 1500 + Math.sin(i * 9.3) * 30;
    positions[i * 3 + 1] = 1 + (i * 3.7) % 18;
    positions[i * 3 + 2] = 30 + Math.cos(i * 7.7) * 28;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  adventure.embers = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffa234,
    map: advGlowTexture(), size: 0.5, transparent: true, opacity: 0.8, depthWrite: false }));
  scene.add(adventure.embers);
  advSign('🚪', NODES.MGC.pos.clone().add(V(0, 7, 0)), 3);
}

function sparkleAt(pos, colors, count = 12) {
  for (let i = 0; i < count; i++) {
    const a = i * 2.39996;
    spawnPuff(pos.clone().add(V(Math.cos(a) * 1.5, 1 + i % 3, Math.sin(a) * 1.5)), {
      color: colors[i % colors.length], size: 0.4 + i % 3 * 0.15, grow: 0.8, life: 2.2,
      vel: V(Math.cos(a) * 2, 2 + i % 4, Math.sin(a) * 2),
    });
  }
}

function playAdventureChime() {
  if (!audio.ctx) return;
  [523, 659, 784, 1047].forEach((f, i) => audio.tone(f, audio.ctx.currentTime + i * 0.12,
    0.5, { type: 'sine', vol: 0.08, attack: 0.01 }));
}

function triggerAdventure(id) {
  if (adventure.passage) return;
  const thing = adventure.things[id];
  if (!thing || thing.cooldown > 0) return;
  thing.t = 1; thing.cooldown = 0.6;
  thing.obj.getWorldPosition(thing.pos);
  const worldId = adventureWorldAt(thing.pos);
  if (worldId) { adventure.current = worldId; spawnStation = adventure.worlds[worldId].station; }
  cam.mode = 'poi';
  const d = thing.distance * Math.max(1, 0.85 / camera.aspect);
  cam.poi = { pos: thing.pos.clone().add(V(d * 0.65, d * 0.5 + 3, d)),
    look: thing.pos.clone().add(V(0, id === 'cablecar' ? 1 : 2.5, 0)) };
  adventure.focusView = cam.poi; adventure.focusThing = id;
  thing.action();
  refreshUI(); syncAdventurePanel();
}

function adventureWorldAt(pos) {
  if (pos.x > 1200) return 'volcano';
  if (pos.z < -330) return pos.x > 300 ? 'sand' : pos.x < 110 ? 'snow' : null;
  if (pos.x > 330 && pos.z > -75) return 'jungle';
  if (Math.abs(pos.x) < 160 && pos.z > -150) return 'home';
  return null;
}

function adventureTrain() {
  const train = cam.target || adventure.lastTrain;
  return trains.includes(train) ? train : null;
}

function moveAdventureTrain(train, station, clearanceAhead = 0) {
  const dir = station.dir || 1;
  // Rebase the entire consist, including reversed trains, before positioning.
  // A station jump must never clamp trailing cars onto a segment endpoint.
  if (train.state !== 'run' || train.tenderFall) return false;
  const offsets = [0];
  for (let i = 1; i < train.vehicles.length; i++) offsets.push(offsets[i - 1]
    + train.vehicles[i - 1].len / 2 + 0.55 + train.vehicles[i].len / 2);
  const min = offsets[offsets.length - 1] + train.vehicles[train.vehicles.length - 1].len / 2 + 2;
  const max = station.seg.len - train.vehicles[0].len / 2 - 2 - clearanceAhead;
  const base = station.fixed ? station.s : THREE.MathUtils.clamp(station.s, min, max);
  let spot = null;
  for (let i = 0; i < (station.fixed ? 1 : station.seg.len / 4); i++) {
    for (const sign of [-1, 1]) {
      const u = base + i * 4 * sign;
      if (u < min || u > max) continue;
      const clear = offsets.every(off => {
        // The tunnel ride needs room for its short roll out as well as arrival.
        for (let ahead = 0; ahead <= clearanceAhead; ahead += 2) {
          const p = frameOf(station.seg, dir, u - off + ahead).p;
          if (!trains.every(other => other === train || other.vehicles.every(v => v.gone || v.g.position.distanceTo(p) >= 7))) return false;
        }
        return true;
      });
      if (clear) { spot = u; break; }
    }
    if (spot !== null) break;
  }
  if (spot === null) return false;
  train.hist = [{ seg: station.seg, dir }]; train.u = spot;
  train.passageBlocked = false;
  train.offsets = offsets; train.flip = false; train.v = 0;
  train.revPending = false; train.revHold = 0; train.waitToot = false; train.endToot = false;
  placeVehicles(train);
  for (const r of riders) {
    if (r.train !== train || r.mode === 'home' || !train.vehicles.includes(r.car)) continue;
    r.car.g.add(r.h.obj); r.h.obj.position.set(0, SEAT_Y[r.h.kind] || 2.4, 0);
    r.h.obj.rotation.set(0, 0, 0); r.mode = 'ride'; r.t = 1;
  }
  return true;
}

function adventureWorldView(id) {
  const world = adventure.worlds[id], [x, z] = world.center;
  // Fit the whole little world across the screen, including portrait tablets.
  const d = world.distance * Math.max(1, 1.6 / camera.aspect);
  return { worldId: id, pos: V(x + d * 0.55, d * 0.85, z + d), look: V(x, 1, z) };
}

function visitAdventureWorld(id, chosenTrain) {
  if (adventure.passage) return false;
  if (!adventure.worlds[id] || id === 'volcano' && !adventure.unlocked) return false;
  const world = adventure.worlds[id], train = chosenTrain || adventureTrain();
  if (train && !moveAdventureTrain(train, STATIONS[world.station])) {
    showBanner(train.state === 'run' && !train.tenderFall ? '🚂 Make room at the station!' : '🚂 Ready as soon as we land!', '#fff4c4'); return false;
  }
  adventure.current = id; spawnStation = world.station;
  STATIONS.forEach((s, i) => s.btn.classList.toggle('on', i === spawnStation));
  cam.mode = 'poi'; cam.target = train;
  cam.poi = adventureWorldView(id);
  // Snap between distant places under a soft transition, without a long flight
  // across empty countryside. Local camera changes still ease normally.
  camPos.copy(cam.poi.pos); camLook.copy(cam.poi.look);
  const wash = $('portalWash'); wash.classList.remove('travel'); void wash.offsetWidth; wash.classList.add('travel');
  if (id === 'volcano') showBanner('🔥 Volcano depths!', '#fff0bf');
  else banner.classList.remove('show');
  audio.ding(); refreshUI(); syncAdventurePanel();
  return true;
}

function unlockVolcano(celebrate = true) {
  const first = !adventure.unlocked;
  adventure.unlocked = true;
  try { localStorage.setItem('choochoo-volcano', 'found'); } catch (_) {}
  adventure.worldButtons.volcano.hidden = false;
  if (celebrate && first) playAdventureChime();
  syncAdventurePanel();
}

function useVolcanoDoor(chosenTrain) {
  if (adventure.passage) return;
  const train = chosenTrain || adventureTrain();
  if (!train) { beginVolcanoPassage(null); return; }
  // This is a real turnout. Opening it never teleports a distant train.
  if (train.passageBlocked) { beginVolcanoPassage(train, volcanoPassageDirection(train)); return; }
  toggleSwitch(switches.find(sw => sw.node === NODES.NJB));
  syncAdventurePanel();
}

function volcanoPassageDirection(train) {
  const cur = train.hist[train.hist.length - 1];
  if (cur.seg === SEGS.VT && cur.dir === 1 && train.u >= adventure.outerMouth - 10) return 'in';
  if (cur.seg === SEGS.MP && cur.dir === -1 && train.u >= SEGS.MP.len - 86) return 'out';
  return null;
}

function volcanoTrainAtEntrance(train) {
  return train.state === 'run' && !!volcanoPassageDirection(train);
}

function setAdventureSwitch(node, selection) {
  node.sel = selection;
  const sw = switches.find(s => s.node === node);
  if (sw) { sw.t = selection; sw.anim = null; sw.aim(); sw.rebuildPoints(selection); }
}

function beginVolcanoPassage(train, direction = train ? volcanoPassageDirection(train) : 'in') {
  if (adventure.passage || !direction) return false;
  if (train && (train.state !== 'run' || train.tenderFall || train.revPending)) return false;
  const leaving = direction === 'out';
  const source = leaving ? SEGS.MP : SEGS.VT, dir = leaving ? -1 : 1;
  const sourceU = train ? train.u : leaving ? 4 : adventure.outerMouth - 10;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  adventure.passage = { train, direction, t: 0, arrived: false, reduced, source, dir, sourceU,
    savedHist: train && train.hist.slice(), startPos: camPos.clone(), startLook: camLook.clone() };
  if (train) { train.v = 0; train.passageBlocked = false; }
  cam.mode = 'poi'; cam.target = train;
  const wash = $('portalWash'); wash.classList.remove('travel'); wash.classList.add('tunnel');
  wash.style.opacity = '0'; document.body.classList.add('inTunnel');
  banner.classList.remove('show'); audio.clunk(); refreshUI(); syncAdventurePanel();
  return true;
}

function finishVolcanoPassage() {
  const passage = adventure.passage;
  adventure.passage = null; document.body.classList.remove('inTunnel');
  $('portalWash').classList.remove('tunnel'); $('portalWash').style.opacity = '';
  if (passage && passage.train && trains.includes(passage.train)) {
    passage.train.v = 0; selectTrain(passage.train);
  } else { cam.mode = 'poi'; cam.poi = adventureWorldView(adventure.current || 'jungle'); }
  refreshUI(); syncAdventurePanel();
}

function updateVolcanoPassage(dt) {
  const p = adventure.passage;
  if (!p) return;
  if (p.train && (!trains.includes(p.train) || p.train.state !== 'run')) { finishVolcanoPassage(); return; }
  const previous = p.t;
  p.t += dt * (p.reduced ? 6 : 1);
  const wash = $('portalWash');
  const cabView = frame => ({ pos: frame.p.clone().addScaledVector(frame.tan, 2).add(V(0, 3.4, 0)),
    look: frame.p.clone().addScaledVector(frame.tan, 15).add(V(0, 3.1, 0)) });
  const advance = distance => {
    if (p.train) {
      if (!p.arrived) distance = Math.max(0, Math.min(distance, p.source.len - p.train.u - 5));
      p.train.u += distance; advanceChain(p.train); placeVehicles(p.train);
      spinWheels(p.train, p.train.flip ? -distance : distance);
      return vehicleFrame(p.train, p.train.u);
    }
    p.sourceU += distance;
    return frameOf(p.source, p.dir, p.sourceU);
  };
  if (!p.arrived) {
    const f = advance(Math.max(0, Math.min(p.t, 3) - Math.min(previous, 3)) * 10);
    const view = cabView(f);
    const blend = p.reduced ? 0 : THREE.MathUtils.smoothstep(p.t, 0, 1.1);
    camPos.copy(p.startPos).lerp(view.pos, blend); camLook.copy(p.startLook).lerp(view.look, blend);
    // First the stone walls surround the cab; only deep in the bore does it go black.
    wash.style.opacity = String(THREE.MathUtils.smoothstep(p.t, 1.7, 2.9));
    if (p.t >= 3.3) {
      const leaving = p.direction === 'out';
      const dest = leaving ? { seg: SEGS.VT, dir: -1, s: SEGS.VT.len - adventure.outerMouth - 20, fixed: true }
        : { seg: SEGS.MP, dir: 1, s: 50, fixed: true };
      // The destination is fixed INSIDE the bore. If occupied, never search for
      // an arbitrary visible arrival somewhere else on the track.
      if (p.train && !moveAdventureTrain(p.train, dest, leaving ? 30 : 34)) {
        p.train.hist = p.savedHist; p.train.u = p.sourceU; p.train.passageBlocked = true;
        placeVehicles(p.train); camPos.copy(p.startPos); camLook.copy(p.startLook);
        finishVolcanoPassage(); showBanner('🚂 Tunnel busy — tap 🔀 to try again.', '#fff4c4'); return;
      }
      p.arrived = true; p.source = dest.seg; p.dir = dest.dir; p.sourceU = dest.s;
      if (leaving) {
        // Back out through the same mouth, then take the eastern approach north
        // to the desert. No reverse key or additional point changes needed.
        setAdventureSwitch(NODES.NJB, 1); setAdventureSwitch(NODES.NJA, 1);
        NODES.NJIN.sel = 1;
        setAdventureSwitch(NODES.NDB, 0); setAdventureSwitch(NODES.NDA, 0);
      } else unlockVolcano();
      adventure.current = leaving ? 'jungle' : 'volcano';
      spawnStation = leaving ? 6 : 7; cam.poi = adventureWorldView(adventure.current);
      scene.background.setHex(leaving ? 0x9fdcf7 : 0x211713); scene.fog.color.copy(scene.background);
      sun.intensity = leaving ? 1.05 : 0.6; skyLight.intensity = leaving ? 0.85 : 0.6;
      const view = cabView(p.train ? vehicleFrame(p.train, p.train.u) : frameOf(dest.seg, dest.dir, dest.s));
      camPos.copy(view.pos); camLook.copy(view.look); syncAdventurePanel();
    }
  } else {
    const f = advance(Math.max(0, Math.min(p.t, 6.6) - Math.max(previous, 3.3)) * 10);
    const view = cabView(f);
    if (!p.reduced) { camPos.copy(view.pos); camLook.copy(view.look); }
    wash.style.opacity = String(1 - THREE.MathUtils.smoothstep(p.t, 3.6, 4.7));
    if (p.t >= 6.6) {
      finishVolcanoPassage();
      showBanner(p.direction === 'out' ? '🏜️ Next stop: sunny sands!' : '🔥 Welcome to the volcano!', '#ffd38c');
    }
  }
}

function adventureWhistle() {
  if (adventure.current === 'volcano') {
    adventure.things.dragon.t = 1;
    sparkleAt(V(1536, 5.5, 104), [0xffcc46, 0xff7436], 8);
  }
}

function initAdventureUI() {
  for (const [id, world] of Object.entries(adventure.worlds)) {
    const b = document.createElement('button'); b.className = 'worldBtn';
    b.setAttribute('aria-label', 'Visit ' + world.name); b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<span class="picture" aria-hidden="true">' + world.icon + '</span><span>' + world.name + '</span>';
    b.hidden = id === 'volcano'; b.addEventListener('click', () => visitAdventureWorld(id));
    $('worldDock').appendChild(b); adventure.worldButtons[id] = b;
  }
  $('rideBtn').addEventListener('click', () => {
    const train = adventureTrain(); if (train) selectTrain(train); syncAdventurePanel();
  });
  $('reverseBtn').addEventListener('click', () => { const t = adventureTrain(); if (t) { reverseTrain(t); selectTrain(t); } });
  $('pointsBtn').addEventListener('click', () => { const t = adventureTrain(); if (t) toggleUpcoming(t); });
  try { if (localStorage.getItem('choochoo-volcano') === 'found' || localStorage.getItem('choochoo-star-garden') === 'found') unlockVolcano(false); } catch (_) {}
}

function syncAdventurePanel() {
  const id = adventure.current, world = adventure.worlds[id];
  $('discovery').hidden = !world;
  STATIONS.forEach((st, i) => {
    st.btn.hidden = st.world ? st.world !== id : !!id && id !== 'home';
    st.btn.classList.toggle('on', i === spawnStation);
  });
  for (const [key, button] of Object.entries(adventure.worldButtons)) button.setAttribute('aria-pressed', String(key === id));
  if (!world) return;
  $('placeName').textContent = world.name;
  $('placeHint').textContent = world.hint;
  $('rideBtn').hidden = !adventureTrain() || cam.mode === 'follow';
  const signature = id + ':' + adventure.unlocked;
  if ($('playRow').dataset.signature === signature) return;
  $('playRow').dataset.signature = signature; $('playRow').replaceChildren();
  for (const action of world.actions) {
    const a = adventure.things[action], b = document.createElement('button');
    b.className = 'playBtn'; b.setAttribute('aria-label', a.label);
    b.innerHTML = '<span aria-hidden="true">' + a.icon + '</span>' + a.label;
    b.addEventListener('click', () => triggerAdventure(action)); $('playRow').appendChild(b);
  }
}

function updateAdventures(dt, time) {
  updateVolcanoPassage(dt);
  for (const a of Object.values(adventure.things)) {
    a.t = Math.max(0, a.t - dt * 0.25); a.cooldown = Math.max(0, a.cooldown - dt);
  }
  const snowT = adventure.things.snowman.t;
  adventure.snowman.rotation.z = Math.sin(snowT * 24) * snowT * 0.18;
  adventure.snowman.position.y = Math.abs(Math.sin(snowT * 12)) * snowT * 0.7;
  const sledT = adventure.things.sled.t;
  if (sledT > 0) {
    const a = (1 - sledT) * Math.PI * 2;
    adventure.sled.position.set(-18 + Math.sin(a) * 8, 0.2 + Math.sin(a * 2) ** 2 * 0.3, -404 - Math.cos(a) * 5);
    adventure.sled.rotation.y = Math.PI / 2 - a;
  }
  adventure.snowBurst = Math.max(0, adventure.snowBurst - dt);
  const snowPositions = adventure.snow.geometry.attributes.position;
  for (let i = 0; i < snowPositions.count; i++) {
    const j = i * 3 + 1; snowPositions.array[j] -= dt * (adventure.snowBurst > 0 ? 9 : 2.5);
    if (snowPositions.array[j] < 0.5) snowPositions.array[j] += 44;
  }
  snowPositions.needsUpdate = true;
  const castleT = adventure.things.castle.t;
  const build = castleT > 0 ? Math.min(1, (1 - castleT) * 3) : 1;
  adventure.castle.scale.y = 0.12 + 0.88 * build + Math.sin(build * Math.PI * 3) * 0.15 * (1 - build);
  adventure.camelHead.rotation.x = Math.sin(adventure.things.camel.t * 20) * adventure.things.camel.t * 0.3;
  for (const [i, drop] of adventure.falls.entries()) drop.position.y = 12 - (time * 8 + i * 2.1) % 12;
  const cable = adventure.cable;
  cable.boost = Math.max(0, cable.boost - dt); cable.phase += dt * (cable.boost > 0 ? 0.45 : 0.13);
  const u = (1 - Math.cos(cable.phase)) / 2;
  cable.car.position.copy(cable.start).lerp(cable.end, u);
  cable.car.position.y -= 3.4 + Math.sin(u * Math.PI) * 1.3;
  cable.car.rotation.z = Math.sin(time * 2) * 0.025;
  if (cam.mode === 'poi' && cam.poi === adventure.focusView
      && (adventure.focusThing === 'cablecar' || adventure.focusThing === 'sled')) {
    const thing = adventure.things[adventure.focusThing];
    const d = thing.distance * Math.max(1, 0.85 / camera.aspect);
    thing.obj.getWorldPosition(thing.pos);
    cam.poi.look.copy(thing.pos).add(V(0, 1, 0));
    cam.poi.pos.copy(thing.pos).add(V(d * 0.65, d * 0.5 + 3, d));
  }
  adventure.lava.forEach((m, i) => { m.material.emissiveIntensity = 0.7 + Math.sin(time * 1.6 + i) * 0.16; });
  adventure.goldLid.rotation.x = -adventure.things.gold.t * 0.9;
  adventure.hammer.rotation.z = Math.sin(adventure.things.forge.t * 23) * adventure.things.forge.t * 0.65;
  const dragon = adventure.dragon, dragonT = adventure.things.dragon.t;
  dragon.body.scale.y = 0.8 + Math.sin(time * 1.5) * 0.025;
  dragon.head.rotation.x = dragonT > 0 ? Math.sin(dragonT * 14) * dragonT * 0.2 : -0.08;
  const embers = adventure.embers.geometry.attributes.position;
  for (let i = 0; i < embers.count; i++) {
    const y = i * 3 + 1; embers.array[y] += dt * (1.3 + i % 3);
    if (embers.array[y] > 20) embers.array[y] = 0.4;
  }
  embers.needsUpdate = true;

  const current = cam.mode === 'follow' && cam.target ? adventureWorldAt(cam.target.vehicles[0].g.position)
    : cam.mode === 'overview' ? null : cam.mode === 'tour' ? adventureWorldAt(camLook) : adventure.current;
  if (current !== adventure.current) {
    adventure.current = current;
    if (current && current !== 'home') spawnStation = adventure.worlds[current].station;
    syncAdventurePanel();
  }
  const train = adventureTrain();
  const rideVisible = !!train && cam.mode !== 'follow';
  if ($('rideBtn').hidden === rideVisible) $('rideBtn').hidden = !rideVisible;
  const insideVolcano = camLook.x > 1200;
  // Lift the roof for the world overview, including narrow portrait screens.
  // At track level the full cavern ceiling still encloses the train.
  adventure.cavernRoof.visible = insideVolcano && (adventure.passage
    || !(cam.mode === 'overview' || cam.mode === 'poi' && cam.poi && cam.poi.worldId === 'volcano'));
  sun.intensity += ((insideVolcano ? 0.6 : 1.05) - sun.intensity) * Math.min(1, dt * 3);
  skyLight.intensity += ((insideVolcano ? 0.6 : 0.85) - skyLight.intensity) * Math.min(1, dt * 3);
  skyLight.groundColor.setHex(insideVolcano ? 0x9a4525 : 0x69aa55);
  adventure.skyColor = adventure.skyColor || new THREE.Color();
  adventure.skyColor.setHex(insideVolcano ? 0x211713 : 0x9fdcf7);
  scene.background.lerp(adventure.skyColor, Math.min(1, dt * 3)); scene.fog.color.copy(scene.background);
  if (!adventure.passage) {
    for (const candidate of trains) {
      if (candidate.state === 'run' && !candidate.passageBlocked && !candidate.revPending && !candidate.tenderFall
          && volcanoPassageDirection(candidate)) {
        beginVolcanoPassage(candidate); break;
      }
    }
  }
}
