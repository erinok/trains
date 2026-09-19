/* Little places to play. Loaded before app.js; builders run after its scenery.
   No asset downloads, build step, timers, scores, or reading needed to explore. */
'use strict';

const adventure = {
  current: null, lastTrain: null, unlocked: false, ducks: [], things: {},
  crystals: [], mushrooms: [], falls: [], worldButtons: {}, snowBurst: 0,
  passage: null,
  worlds: {
    home: { name: 'Duck pond', icon: '🦆', station: 0, center: [0, 0], distance: 115,
      hint: 'A little train. A big adventure.', actions: ['homeDucks', 'homeMonkeys', 'homeBridge'] },
    snow: { name: 'Snowy peaks', icon: '⛄', station: 4, center: [0, -430], distance: 85,
      hint: 'Scarves on. All aboard!', actions: ['snowman', 'sled', 'snowDucks'] },
    sand: { name: 'Sunny sands', icon: '🏜️', station: 5, center: [432, -420], distance: 83,
      hint: 'Next stop: a splash in the oasis.', actions: ['castle', 'camel', 'sandDucks'] },
    jungle: { name: 'Monkey jungle', icon: '🌋', station: 6, center: [425, 42], distance: 92,
      hint: 'Open the switch at the end of the line to go inside!', actions: ['cablecar', 'waterfall', 'door'] },
    magic: { name: 'Star Garden', icon: '✨', station: 7, center: [1500, 40], distance: 88,
      hint: 'A secret world inside the mountain.', actions: ['dragon', 'mushrooms', 'magicDucks'] },
  },
};

function installAdventureTrack(nodes, defs) {
  // A continuous, bidirectional loop. Both nodes have a single through route;
  // the twelve original switches and the reversing volcano buffers stay intact.
  nodes.MGA = { pos: V(1445, 0, 40), dir: V(0, 0, -1), sel: 0,
    trunk: { seg: 'MG2', end: 'to' }, branches: [{ seg: 'MG1', end: 'from' }] };
  nodes.MGB = { pos: V(1555, 0, 40), dir: V(0, 0, 1), sel: 0,
    trunk: { seg: 'MG1', end: 'to' }, branches: [{ seg: 'MG2', end: 'from' }] };
  defs.MG1 = { from: 'MGA', to: 'MGB', mids: [[1452, 0, 7], [1475, 1, -13],
    [1500, 2.2, -17], [1525, 1, -13], [1548, 0, 7]] };
  defs.MG2 = { from: 'MGB', to: 'MGA', mids: [[1548, 0, 73], [1525, 0, 93],
    [1500, 0, 97], [1475, 0, 93], [1452, 0, 73]] };
  // Used only during the tunnel ride; the closed entrance remains a terminus.
  nodes.VEND = { pos: V(425, 0, 35), dir: V(0, 0, -1), sel: 0,
    trunk: { seg: 'VT', end: 'to' }, branches: [{ seg: 'VT', end: 'to' }] };
  defs.VT = { from: 'NJB', to: 'VEND', mids: [[425, 0, 52]] };
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
  } else if (outfit === 'wizard') {
    advPut(cone(0.34, 0.8, 0x906cce, { seg: 12 }), 0, 1.29, 0.42, d);
    advPut(cyl(0.4, 0.4, 0.07, 0x906cce, { seg: 12 }), 0, 0.96, 0.42, d);
    advPut(sph(0.09, 0xffdc82, { seg: 6 }), 0, 1.67, 0.42, d);
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
  buildSnowAdventure(); buildSandAdventure(); buildJungleAdventure(); buildStarGarden();
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

  const door = advPut(new THREE.Group(), 425, 0, 69);
  const shape = new THREE.Shape();
  shape.moveTo(-3.3, 0); shape.lineTo(-3.3, 3.6);
  shape.absarc(0, 3.6, 3.3, Math.PI, 0, true); shape.lineTo(3.3, 0); shape.closePath();
  const inside = mesh(new THREE.ShapeGeometry(shape), 0x6a554a, { shadow: false });
  inside.material.side = THREE.DoubleSide; door.add(inside);
  const arch = mesh(new THREE.TorusGeometry(3.75, 0.55, 8, 24, Math.PI), 0x967d76);
  advPut(arch, 0, 3.6, 0, door);
  for (const x of [-3.75, 3.75]) advPut(cyl(0.55, 0.55, 3.6, 0x967d76), x, 1.8, 0, door);
  const star = advSign('🔀', V(432, 7, 76), 4);
  const lever = advPut(new THREE.Group(), 431, 0, 75);
  advPut(box(3, 0.4, 3, 0x6a554a), 0, 0.2, 0, lever);
  advPut(cyl(0.45, 0.65, 1.8, 0xf8dc9b), 0, 1.1, 0, lever);
  const handle = advPut(new THREE.Group(), 0, 1.6, 0, lever);
  advPut(cyl(0.16, 0.16, 2.5, 0xeeeece), 0, 1.2, 0, handle);
  const knob = advPut(sph(0.72, 0xf4bd4e), 0, 2.6, 0, handle);
  handle.rotation.z = -0.55;
  adventure.door = { group: door, inside, arch, star, lever, handle, knob, open: 0 };
  tagTap(lever, 'portal', null);
  tagTap(door, 'portal', null); tagTap(star, 'portal', null);
  addAdventure('door', '🔀', 'Open tunnel', lever, () => useVolcanoDoor(), 24);
  buildAdventureTunnel(SEGS.VT, 0, 28, 0x6a554a);
}

function buildAdventureTunnel(seg, start, end, color) {
  const points = [];
  for (let i = 0; i <= 24; i++) points.push(segPoint(seg, start + (end - start) * i / 24).add(V(0, 2.3, 0)));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, 4.1, 24, false),
    new THREE.MeshStandardMaterial({ color: 0x211d29, roughness: 1, side: THREE.DoubleSide }));
  scene.add(tube);
  for (const s of [start, end]) {
    const p = segPoint(seg, s).add(V(0, 2.3, 0)), tangent = segTangent(seg, s);
    const ring = mesh(new THREE.TorusGeometry(4.6, 0.7, 10, 32), color, { rough: 1 });
    ring.position.copy(p); ring.lookAt(p.clone().add(tangent)); scene.add(ring);
    const rock = mesh(new THREE.TorusGeometry(6.8, 2.2, 12, 24), color, { rough: 1 });
    rock.position.copy(p); rock.lookAt(p.clone().add(tangent)); rock.scale.z = 2; scene.add(rock);
  }
}

function buildStarGarden() {
  advGround(1500, 40, 500, 0x383459, 0.005);
  advGround(1500, 40, 110, 0x383459, 0.035);
  advGround(1500, 40, 87, 0x56537a, 0.045);
  advGround(1500, 40, 68, 0x7a739e, 0.055);
  buildAdventureTunnel(SEGS.MG1, 2, 45, 0x60506c);
  advPool(1482, 77, 11, 0x6faad7);
  const flock = advFlock(1481, 81, 'wizard');
  addAdventure('magicDucks', '🦆', 'Magic quack!', flock[0], () => {
    advQuacks(flock); sparkleAt(V(1481, 2, 81), [0xfbdc87, 0xb7a0ff, 0x9ae3dd], 14);
  });
  advHut(1499, -29, 0xa390ca, '⭐');

  // The train goes underneath a rainbow, over a raised stretch of track.
  const rainbow = advPut(new THREE.Group(), 1500, 2.4, -17);
  rainbow.rotation.y = Math.PI / 2;
  [0xef8d9c, 0xf1bd78, 0xf6dd8b, 0x96d9b1, 0x87c5e4, 0xb99be4].forEach((c, i) => {
    const m = mesh(new THREE.TorusGeometry(11 - i * 0.7, 0.42, 6, 36, Math.PI), c, { shadow: false });
    m.material.emissive = new THREE.Color(c); m.material.emissiveIntensity = 0.3;
    rainbow.add(m);
  });
  for (let i = 0; i < 13; i++) {
    const a = i * 2.39996, r = 24 + (i % 4) * 10;
    const x = 1500 + Math.cos(a) * r, z = 40 + Math.sin(a) * r;
    if (!clearOfTrack(x, z, 6) || (x - 1518) ** 2 + (z - 43) ** 2 < 16 ** 2
        || (x - 1500) ** 2 + (z + 17) ** 2 < 20 ** 2
        || (x - 1482) ** 2 + (z - 77) ** 2 < 14 ** 2) continue;
    const g = advPut(new THREE.Group(), x, 0, z);
    const s = 1.4 + (i % 3) * 0.6;
    advPut(cyl(0.48 * s, 0.7 * s, 3.8 * s, 0xf6d8c4, { seg: 8 }), 0, 1.9 * s, 0, g);
    const cap = advPut(sph(2.2 * s, [0xcc8dbd, 0x9da7e6, 0xe6ae92][i % 3], { seg: 12 }), 0, 4 * s, 0, g);
    cap.material.emissive.copy(cap.material.color); cap.material.emissiveIntensity = 0.2;
    cap.scale.y = 0.45;
    for (let k = 0; k < 4; k++) {
      const a = k * 1.6;
      const spot = advPut(sph(0.3 * s, 0xffeec9, { seg: 6 }), Math.cos(a) * s, 4.7 * s, Math.sin(a) * s, g);
      spot.scale.y = 0.4;
    }
    adventure.mushrooms.push(g); tagTap(g, 'adventure', 'mushrooms');
    if (adventure.mushrooms.length <= 2) {
      const m = advPut(makeMonkey(), 1, 3.5 * s, 0, g);
      monkeys.push(m); tagTap(m, 'monkey', m);
    }
  }
  addAdventure('mushrooms', '🍄', 'Boing!', adventure.mushrooms[0], () => {
    adventure.mushrooms.forEach(m => sparkleAt(m.position.clone().add(V(0, 5, 0)), [0xffde95, 0xe3c7ff], 2));
    playAdventureChime();
  }, 26);
  const colors = [0xc7a0f3, 0x8ae7df, 0xf1b4d4, 0xf0d399];
  for (let i = 0; i < 18; i++) {
    const a = i * 2.39996;
    const x = 1500 + Math.cos(a) * (70 + i % 3 * 7), z = 40 + Math.sin(a) * (70 + i % 3 * 7);
    const crystal = advPut(cone(1.8, 6 + i % 4 * 1.8, colors[i % 4], { seg: 5 }), x, 3, z);
    crystal.rotation.z = Math.sin(i) * 0.25;
    crystal.material.emissive = new THREE.Color(colors[i % 4]); crystal.material.emissiveIntensity = 0.3;
    adventure.crystals.push(crystal); tagTap(crystal, 'adventure', 'mushrooms');
  }
  // One sleepy, kind dragon. A tap wakes him for a rainbow bubble sneeze.
  const dragon = advPut(new THREE.Group(), 1518, 0, 43);
  const body = advPut(sph(4, 0x82b8b0, { seg: 14 }), 0, 3, 0, dragon); body.scale.set(1, 0.8, 1.4);
  const belly = advPut(sph(2.8, 0xe9d9ae), 0, 2.7, 2.4, dragon); belly.scale.z = 0.6;
  const head = advPut(new THREE.Group(), 0, 5.4, 4.3, dragon);
  advPut(sph(2.2, 0x99cdc0), 0, 0, 0, head);
  advPut(sph(1.7, 0xa8d9c6), 0, -0.8, 1.5, head).scale.set(1, 0.65, 1);
  for (const x of [-0.9, 0.9]) {
    advPut(sph(0.17, 0x394d58), x, 0.35, 1.85, head);
    advPut(sph(0.25, 0xe9a7b0), x * 1.8, -0.5, 1.3, head);
    advPut(cone(0.35, 1.7, 0xf9d38e, { seg: 7 }), x * 1.7, 1.95, -0.6, head);
    const wing = advPut(sph(2.3, 0xb59dcf, { seg: 9 }), x * 4.5, 4, -0.8, dragon);
    wing.scale.set(0.3, 1.15, 1); wing.rotation.z = -x * 0.5;
    advPut(sph(1.1, 0x82b8b0), x * 2.5, 0.9, 3, dragon).scale.z = 1.4;
  }
  advTube([V(0, 2, -4), V(-1, 1.5, -7), V(-5, 0.6, -8), V(-7, 1, -6)], 0.7, 0x82b8b0, dragon);
  for (let i = 0; i < 4; i++) advPut(cone(0.65, 1.4, 0xe8bbd4, { seg: 5 }), 0, 6.1 - i * 0.3, -i * 1.3, dragon);
  adventure.dragon = { group: dragon, head, body };
  addAdventure('dragon', '🐉', 'Achoo!', dragon, () => {
    sparkleAt(V(1518, 5.5, 52), colors, 26); playAdventureChime();
  }, 31);

  const positions = new Float32Array(120 * 3);
  for (let i = 0; i < 120; i++) {
    positions[i * 3] = 1500 + Math.sin(i * 9.3) * 103;
    positions[i * 3 + 1] = 12 + (i * 5.73) % 65;
    positions[i * 3 + 2] = 40 + Math.cos(i * 7.7) * 103;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  adventure.stars = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffe8ae, map: advGlowTexture(), size: 1.1, transparent: true, opacity: 0.9, depthWrite: false }));
  scene.add(adventure.stars);

  // Luminous flowers and little pools of color make this a garden to explore.
  const flowers = [];
  adventure.mushrooms.forEach((m, i) => {
    advGround(m.position.x, m.position.z, 5, i % 2 ? 0x857eab : 0x8d85a9, 0.08);
    for (let j = 0; j < 12; j++) {
      const a = j * 2.39996, r = 3 + j % 3;
      flowers.push(V(m.position.x + Math.cos(a) * r, 0.7, m.position.z + Math.sin(a) * r));
    }
  });
  const petals = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 6, 5), mat(0xffffff), flowers.length);
  petals.material.emissive = new THREE.Color(0xb8a0cf); petals.material.emissiveIntensity = 0.45;
  flowers.forEach((p, i) => {
    _dummy.position.copy(p); _dummy.rotation.set(0, 0, 0); _dummy.scale.set(1, 0.6, 1);
    _dummy.updateMatrix(); petals.setMatrixAt(i, _dummy.matrix); petals.setColorAt(i, new THREE.Color(colors[i % colors.length]));
  });
  _dummy.scale.setScalar(1); scene.add(petals);
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
  if (pos.x > 1200) return 'magic';
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
  // Rebase the entire consist, including reversed trains, before positioning.
  // A station jump must never clamp trailing cars onto a segment endpoint.
  if (train.state !== 'run' || train.tenderFall) return false;
  const offsets = [0];
  for (let i = 1; i < train.vehicles.length; i++) offsets.push(offsets[i - 1]
    + train.vehicles[i - 1].len / 2 + 0.55 + train.vehicles[i].len / 2);
  const min = offsets[offsets.length - 1] + train.vehicles[train.vehicles.length - 1].len / 2 + 2;
  const max = station.seg.len - train.vehicles[0].len / 2 - 2 - clearanceAhead;
  const base = THREE.MathUtils.clamp(station.s, min, max);
  let spot = null;
  for (let i = 0; i < station.seg.len / 4; i++) {
    for (const sign of [-1, 1]) {
      const u = base + i * 4 * sign;
      if (u < min || u > max) continue;
      const clear = offsets.every(off => {
        // The tunnel ride needs room for its short roll out as well as arrival.
        for (let ahead = 0; ahead <= clearanceAhead; ahead += 2) {
          const p = frameOf(station.seg, 1, u - off + ahead).p;
          if (!trains.every(other => other === train || other.vehicles.every(v => v.gone || v.g.position.distanceTo(p) >= 7))) return false;
        }
        return true;
      });
      if (clear) { spot = u; break; }
    }
    if (spot !== null) break;
  }
  if (spot === null) return false;
  train.hist = [{ seg: station.seg, dir: 1 }]; train.u = spot;
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
  if (!adventure.worlds[id] || id === 'magic' && !adventure.unlocked) return false;
  const world = adventure.worlds[id], train = chosenTrain || adventureTrain();
  if (id === 'magic' && adventure.current === 'jungle') return beginVolcanoPassage(train);
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
  if (id === 'magic') showBanner('✨ Star Garden!', '#fff0bf');
  else banner.classList.remove('show');
  audio.ding(); refreshUI(); syncAdventurePanel();
  return true;
}

function unlockStarGarden(celebrate = true) {
  const first = !adventure.unlocked;
  adventure.unlocked = true;
  try { localStorage.setItem('choochoo-star-garden', 'found'); } catch (_) { /* Private browsing can still play. */ }
  adventure.door.arch.material.color.setHex(0xf8dc9b);
  adventure.door.knob.material.color.setHex(0x7ee787);
  adventure.door.star.material.map.dispose();
  adventure.door.star.material.map = emojiTexture('✨');
  adventure.worldButtons.magic.hidden = false;
  adventure.things.door.icon = '✨'; adventure.things.door.label = 'Go inside!';
  if (celebrate && first) {
    playAdventureChime(); sparkleAt(V(425, 4, 66), [0xf8dc9b, 0xc2a0ff, 0x9de4d1], 25);
    showBanner('🔀 Tunnel open! All aboard!', '#fff0b9');
  }
  syncAdventurePanel();
}

function useVolcanoDoor(chosenTrain) {
  if (adventure.passage) return;
  const wasOpen = adventure.unlocked;
  unlockStarGarden();
  const train = chosenTrain || adventureTrain();
  if (!train || wasOpen || volcanoTrainAtEntrance(train)) {
    beginVolcanoPassage(train); return;
  }
  cam.mode = 'poi'; cam.poi = { pos: V(441, 12, 99), look: V(425, 3, 69) };
  refreshUI();
}

function volcanoTrainAtEntrance(train) {
  const cur = train.hist[train.hist.length - 1];
  return train.state === 'run' && cur.dir === 1 && ['JN1', 'JN2'].includes(cur.seg.id)
    && train.u >= terminalStopU(train, cur) - 1.5;
}

function beginVolcanoPassage(train) {
  if (adventure.passage) return false;
  if (train) {
    if (train.state !== 'run' || train.tenderFall) {
      showBanner('🚂 Ready as soon as we land!', '#fff4c4'); return false;
    }
    if (!volcanoTrainAtEntrance(train)) {
      const cur = train.hist[train.hist.length - 1];
      const seg = ['JN1', 'JN2'].includes(cur.seg.id) ? cur.seg : SEGS.JN2;
      if (!moveAdventureTrain(train, { seg, s: seg.len - 5 })) return false;
    }
    train.v = 0; train.revPending = false; train.revHold = 0; train.passageBlocked = false;
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  adventure.passage = { train, t: 0, arrived: false, reduced,
    startPos: V(438, 8, 91), startLook: V(425, 3, 67) };
  cam.mode = 'poi'; cam.target = train;
  adventure.current = 'jungle';
  camPos.copy(adventure.passage.startPos); camLook.copy(adventure.passage.startLook);
  const wash = $('portalWash'); wash.classList.remove('travel'); wash.classList.add('tunnel');
  wash.style.opacity = '0';
  banner.classList.remove('show'); audio.clunk(); refreshUI(); syncAdventurePanel();
  return true;
}

function finishVolcanoPassage() {
  const passage = adventure.passage;
  adventure.passage = null;
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
  const advance = distance => {
    if (!p.train || distance <= 0) return;
    const train = p.train;
    train.u += distance;
    const cur = train.hist[train.hist.length - 1];
    if (!p.arrived && cur.seg !== SEGS.VT && train.u > cur.seg.len) {
      train.u -= cur.seg.len; train.hist.push({ seg: SEGS.VT, dir: 1 });
    }
    placeVehicles(train); spinWheels(train, train.flip ? -distance : distance);
  };
  if (!p.arrived) {
    advance(Math.max(0, Math.min(p.t, 3) - Math.max(previous, 0.6)) * 8);
    if (!p.reduced) {
      const u = THREE.MathUtils.smoothstep(p.t, 0.6, 3);
      camPos.copy(p.startPos).lerp(V(425, 3.1, 64), u);
      camLook.copy(p.startLook).lerp(V(425, 2.8, 48), u);
    }
    wash.style.opacity = String(THREE.MathUtils.smoothstep(p.t, 1.8, 2.8));
    // Move worlds only after a fully black interval has actually been shown.
    if (p.t >= 3.25) {
      if (p.train && !moveAdventureTrain(p.train, { seg: SEGS.MG1, s: 40 }, 22)) {
        // Keep the train safe at the entrance if every arrival space is occupied.
        const approach = p.train.hist.find(h => ['JN1', 'JN2'].includes(h.seg.id));
        p.train.hist = [approach]; p.train.u = terminalStopU(p.train, approach); p.train.passageBlocked = true;
        placeVehicles(p.train);
        finishVolcanoPassage(); showBanner('🚂 Make room inside, then open the switch!', '#fff4c4'); return;
      }
      p.arrived = true;
      adventure.current = 'magic'; spawnStation = 7;
      cam.poi = adventureWorldView('magic');
      // Set the cave lighting while covered so the bright outdoor sky never flashes.
      scene.background.setHex(0x292540); scene.fog.color.copy(scene.background);
      sun.intensity = 0.55; skyLight.intensity = 0.55;
      const f = p.train ? vehicleFrame(p.train, p.train.u) : frameOf(SEGS.MG1, 1, 40);
      p.exitLook = f.p.clone().add(V(0, 2, 0));
      const side = V(0, 0, 0).crossVectors(UP, f.tan).normalize();
      p.exitPos = p.exitLook.clone().addScaledVector(f.tan, 18).addScaledVector(side, 22).add(V(0, 11, 0));
      camPos.copy(p.exitPos); camLook.copy(p.exitLook);
      if (p.reduced) { camPos.copy(cam.poi.pos); camLook.copy(cam.poi.look); }
      syncAdventurePanel();
    }
  } else {
    advance(Math.max(0, Math.min(p.t, 5.8) - Math.max(previous, 3.25)) * 8);
    if (!p.reduced && p.train) camLook.copy(p.train.vehicles[0].g.position).add(V(0, 2, 0));
    wash.style.opacity = String(1 - THREE.MathUtils.smoothstep(p.t, 3.5, 4.6));
    if (p.t >= 5.8) {
      finishVolcanoPassage(); playAdventureChime(); showBanner('✨ Inside the volcano — Star Garden!', '#fff0bf');
    }
  }
}

function adventureWhistle() {
  const train = adventureTrain();
  const nearJungle = train && adventureWorldAt(train.vehicles[0].g.position) === 'jungle';
  if (nearJungle || adventure.current === 'jungle' && cam.mode === 'poi') {
    if (!adventure.unlocked) unlockStarGarden();
    else sparkleAt(V(425, 4, 66), [0xf8dc9b, 0xc2a0ff], 8);
  }
}

function initAdventureUI() {
  for (const [id, world] of Object.entries(adventure.worlds)) {
    const b = document.createElement('button'); b.className = 'worldBtn';
    b.setAttribute('aria-label', 'Visit ' + world.name); b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<span class="picture" aria-hidden="true">' + world.icon + '</span><span>' + world.name + '</span>';
    b.hidden = id === 'magic'; b.addEventListener('click', () => visitAdventureWorld(id));
    $('worldDock').appendChild(b); adventure.worldButtons[id] = b;
  }
  $('rideBtn').addEventListener('click', () => {
    const train = adventureTrain(); if (train) selectTrain(train); syncAdventurePanel();
  });
  $('reverseBtn').addEventListener('click', () => { const t = adventureTrain(); if (t) { reverseTrain(t); selectTrain(t); } });
  $('pointsBtn').addEventListener('click', () => { const t = adventureTrain(); if (t) toggleUpcoming(t); });
  try { if (localStorage.getItem('choochoo-star-garden') === 'found') unlockStarGarden(false); } catch (_) {}
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
  $('placeHint').textContent = id === 'jungle' && adventure.unlocked ? 'Tunnel open! Follow the rails inside.' : world.hint;
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
  adventure.door.star.position.y = 7 + Math.sin(time * 2) * 0.35;
  const door = adventure.door;
  door.open += ((adventure.unlocked ? 1 : 0) - door.open) * Math.min(1, dt * 5);
  door.inside.position.y = door.open * 9;
  door.inside.visible = door.open < 0.98;
  door.handle.rotation.z = -0.55 + door.open * 1.1;
  NODES.NJB.buffer.position.y = door.open * 9;
  NODES.NJB.buffer.visible = door.open < 0.98;
  const mushroomT = adventure.things.mushrooms.t;
  adventure.mushrooms.forEach((m, i) => {
    m.scale.y = 1 + Math.sin((1 - mushroomT) * 20 + i) * mushroomT * 0.18;
  });
  adventure.crystals.forEach((c, i) => { c.material.emissiveIntensity = 0.25 + (1 + Math.sin(time * 1.8 + i)) * 0.18; });
  const dragon = adventure.dragon, dragonT = adventure.things.dragon.t;
  dragon.body.scale.y = 0.8 + Math.sin(time * 1.5) * 0.025;
  dragon.head.rotation.x = dragonT > 0 ? Math.sin(dragonT * 14) * dragonT * 0.2 : -0.08;
  adventure.stars.material.opacity = 0.65 + Math.sin(time) * 0.2;

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
  const magical = camLook.x > 1200;
  sun.intensity += ((magical ? 0.55 : 1.05) - sun.intensity) * Math.min(1, dt * 3);
  skyLight.intensity += ((magical ? 0.55 : 0.85) - skyLight.intensity) * Math.min(1, dt * 3);
  skyLight.groundColor.setHex(magical ? 0x655779 : 0x69aa55);
  adventure.skyColor = adventure.skyColor || new THREE.Color();
  adventure.skyColor.setHex(magical ? 0x292540 : 0x9fdcf7);
  scene.background.lerp(adventure.skyColor, Math.min(1, dt * 3)); scene.fog.color.copy(scene.background);
  if (!adventure.passage && adventure.unlocked && train && !train.passageBlocked && !train.revPending && train.v < 0.3
      && volcanoTrainAtEntrance(train)) {
    beginVolcanoPassage(train);
  }
}
