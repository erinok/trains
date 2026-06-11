/* CHOO CHOO WORLD — a three.js train set for a small engineer.
   Trains: Choo Choo, Rocket, Catch Me Who Can, Mallard, Diesel, Bullet.
   Plus ducks on the pond and monkeys in the trees. */
'use strict';

const PARAMS = new URLSearchParams(location.search);
const UP = new THREE.Vector3(0, 1, 0);
const RAIL_Y = 0.16;            // top of rail — vehicles sit here
const SPEEDS = { slow: 2.6, med: 5.2, fast: 10.5 };

// ============================================================ renderer / scene
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fdcf7);
scene.fog = new THREE.Fog(0x9fdcf7, 100, 230);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
camera.position.set(0, 30, 60);

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

// lights
scene.add(new THREE.HemisphereLight(0xcfe9ff, 0x69aa55, 0.85));
const sun = new THREE.DirectionalLight(0xfff2d4, 1.05);
sun.position.set(45, 70, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -75; sun.shadow.camera.right = 75;
sun.shadow.camera.top = 75; sun.shadow.camera.bottom = -75;
sun.shadow.camera.far = 220;
sun.shadow.bias = -0.0004;
scene.add(sun);

// ============================================================ small helpers
function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: o.rough !== undefined ? o.rough : 0.8,
    metalness: o.metal !== undefined ? o.metal : 0.05,
  });
}
function mesh(geo, color, o = {}) {
  const m = new THREE.Mesh(geo, mat(color, o));
  m.castShadow = o.shadow !== false;
  m.receiveShadow = true;
  return m;
}
function box(w, h, d, c, o) { return mesh(new THREE.BoxGeometry(w, h, d), c, o); }
function cyl(r1, r2, h, c, o = {}) {
  const g = new THREE.CylinderGeometry(r1, r2, h, o.seg || 20);
  if (o.axis === 'z') g.rotateX(Math.PI / 2);
  if (o.axis === 'x') g.rotateZ(Math.PI / 2);
  return mesh(g, c, o);
}
function sph(r, c, o = {}) { return mesh(new THREE.SphereGeometry(r, o.seg || 18, 14), c, o); }
function cone(r, h, c, o = {}) { return mesh(new THREE.ConeGeometry(r, h, o.seg || 18), c, o); }

function textTexture(text, opts = {}) {
  const cnv = document.createElement('canvas');
  cnv.width = opts.w || 512; cnv.height = opts.h || 128;
  const ctx = cnv.getContext('2d');
  ctx.fillStyle = opts.bg || '#fff6dd';
  ctx.fillRect(0, 0, cnv.width, cnv.height);
  ctx.strokeStyle = opts.border || '#8a5a2b'; ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, cnv.width - 10, cnv.height - 10);
  ctx.fillStyle = opts.fg || '#27466b';
  ctx.font = 'bold ' + (opts.size || 72) + 'px "Chalkboard SE","Comic Sans MS",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cnv.width / 2, cnv.height / 2 + 4);
  const tex = new THREE.CanvasTexture(cnv);
  return tex;
}
function namePlate(text, w, h) {
  // thin box whose +x/-x faces carry the painted name
  const plain = mat(0x6b4a2a);
  const texed = new THREE.MeshStandardMaterial({ map: textTexture(text, { size: 88 }) });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, w),
    [texed, texed, plain, plain, plain, plain]);
  m.castShadow = false;
  return m;
}

// ============================================================ ground & sky
const ground = mesh(new THREE.CircleGeometry(240, 48), 0x7cc25e, { shadow: false, rough: 1 });
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// far-away hills
for (let i = 0; i < 9; i++) {
  const a = (i / 9) * Math.PI * 2 + 0.3;
  const h = sph(26, i % 2 ? 0x6fb35f : 0x60a854, { shadow: false, rough: 1 });
  h.scale.set(1.7, 0.5, 1.1);
  h.position.set(Math.cos(a) * 150, -1.5, Math.sin(a) * 150);
  scene.add(h);
}

// sun disc in the sky
const sunBall = sph(6, 0xfff1a8, { shadow: false });
sunBall.material.emissive = new THREE.Color(0xffe680);
sunBall.material.emissiveIntensity = 0.9;
sunBall.position.set(120, 95, 60);
scene.add(sunBall);

// drifting clouds
const clouds = [];
for (let i = 0; i < 6; i++) {
  const c = new THREE.Group();
  const n = 3 + (i % 3);
  for (let j = 0; j < n; j++) {
    const s = sph(3 + (j % 3), 0xffffff, { shadow: false, rough: 1 });
    s.scale.y = 0.6;
    s.position.set(j * 3.4 - n * 1.5, (j % 2) * 0.8, (j % 2) * 1.6 - 0.8);
    c.add(s);
  }
  c.position.set(-150 + i * 55, 34 + (i % 3) * 7, -60 + (i * 37) % 120 - 30);
  c.userData.v = 1.1 + (i % 3) * 0.5;
  clouds.push(c);
  scene.add(c);
}

// ============================================================ the track
const trackPts = [
  [34, -16], [40, 6], [28, 26], [6, 34], [-18, 30],
  [-36, 16], [-42, -2], [-36, -20], [-16, -32], [8, -34],
].map(p => new THREE.Vector3(p[0], 0, p[1]));
const curve = new THREE.CatmullRomCurve3(trackPts, true, 'catmullrom', 0.55);
const TRACK_LEN = curve.getLength();

function frameAt(u) {
  u = ((u % 1) + 1) % 1;
  const p = curve.getPointAt(u);
  const tan = curve.getTangentAt(u);
  const sideOut = new THREE.Vector3().crossVectors(UP, tan).normalize(); // points outside the loop
  return { p, tan, sideOut };
}
function nearestU(x, z) { // u of the curve point closest to (x, z)
  let best = 0, bd = 1e9;
  for (let i = 0; i < 600; i++) {
    const p = curve.getPointAt(i / 600);
    const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
    if (d < bd) { bd = d; best = i / 600; }
  }
  return best;
}

(function buildTrack() {
  const N = 420;
  // ballast ribbon
  const pos = new Float32Array((N + 1) * 2 * 3);
  for (let i = 0; i <= N; i++) {
    const { p, sideOut } = frameAt(i / N);
    const a = p.clone().addScaledVector(sideOut, 1.55);
    const b = p.clone().addScaledVector(sideOut, -1.55);
    pos.set([a.x, 0.03, a.z, b.x, 0.03, b.z], i * 6);
  }
  const idx = [];
  for (let i = 0; i < N; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const ballast = new THREE.Mesh(g, mat(0x9b9486, { rough: 1 }));
  ballast.receiveShadow = true;
  scene.add(ballast);

  // sleepers
  const sleeperGeo = new THREE.BoxGeometry(1.7, 0.1, 0.5);
  const sleeperMat = mat(0x7a5230, { rough: 1 });
  const nS = Math.floor(TRACK_LEN / 1.25);
  for (let i = 0; i < nS; i++) {
    const { p, tan } = frameAt(i / nS);
    const s = new THREE.Mesh(sleeperGeo, sleeperMat);
    s.position.set(p.x, 0.08, p.z);
    s.lookAt(p.clone().add(tan));
    s.receiveShadow = true;
    scene.add(s);
  }

  // rails
  for (const side of [-0.45, 0.45]) {
    const railPts = [];
    for (let i = 0; i < N; i++) {
      const { p, sideOut } = frameAt(i / N);
      railPts.push(p.clone().addScaledVector(sideOut, side).setY(RAIL_Y - 0.03));
    }
    const railCurve = new THREE.CatmullRomCurve3(railPts, true);
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(railCurve, 420, 0.07, 8, true),
      mat(0x8e9aa6, { metal: 0.6, rough: 0.4 })
    );
    rail.castShadow = false; rail.receiveShadow = true;
    scene.add(rail);
  }
})();

// ============================================================ scenery
const tappables = [];   // groups with userData.tap

// ---- tunnel through a hill
const tunnelU = nearestU(-42, -2);
(function buildTunnel() {
  const { p, tan } = frameAt(tunnelU);
  const halfLen = 5.5 / TRACK_LEN;          // tube follows the curve, ±5.5 units of track
  // tube the train drives through, bent to match the track
  const tubePts = [];
  for (let i = 0; i <= 12; i++) {
    const q = curve.getPointAt(((tunnelU - halfLen + (i / 12) * halfLen * 2) % 1 + 1) % 1);
    tubePts.push(q.clone().setY(q.y + 1.5));
  }
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tubePts), 24, 2.3, 18, false),
    new THREE.MeshStandardMaterial({ color: 0x5c554e, roughness: 1, side: THREE.DoubleSide })
  );
  tube.receiveShadow = true;
  scene.add(tube);
  // stone portals at each mouth
  for (const uu of [tunnelU - halfLen, tunnelU + halfLen]) {
    const f = frameAt(uu);
    const ring = cyl(2.6, 2.6, 0.7, 0xb0a294, { axis: 'z', seg: 24 });
    ring.position.set(f.p.x, 1.5, f.p.z);
    ring.lookAt(ring.position.clone().add(f.tan));
    scene.add(ring);
  }
  // a soft light inside so the ride view isn't pitch black
  const lamp = new THREE.PointLight(0xffd9a0, 0.8, 14);
  lamp.position.set(p.x, 2.4, p.z);
  scene.add(lamp);

  // the hill over the tunnel — kept shorter than the tube so the portals show
  const hill = sph(5, 0x4f9d4a, { rough: 1 });
  hill.scale.set(1.5, 0.92, 0.8);
  const m = new THREE.Matrix4().lookAt(p, p.clone().add(tan), UP);
  hill.quaternion.setFromRotationMatrix(m);
  hill.position.copy(p);
  scene.add(hill);
})();

// ---- pond + bridge + ducks
const pondU = nearestU(6, 34);
const pondFrame = frameAt(pondU);
const ducks = [];
(function buildPond() {
  const { p, tan, sideOut } = pondFrame;
  // water
  const water = mesh(new THREE.CircleGeometry(9, 36), 0x3fa9e0, { shadow: false, rough: 0.25, metal: 0.1 });
  water.rotation.x = -Math.PI / 2;
  water.position.set(p.x, 0.012, p.z);
  water.scale.set(1.45, 1, 1);
  water.receiveShadow = true;
  scene.add(water);
  // sandy rim
  const rim = mesh(new THREE.RingGeometry(9, 10.2, 36), 0xe8d8a8, { shadow: false, rough: 1 });
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(p.x, 0.018, p.z);
  rim.scale.set(1.45, 1, 1);
  scene.add(rim);

  // bridge over the water
  const bridge = new THREE.Group();
  bridge.position.copy(p);
  bridge.lookAt(p.clone().add(tan));
  for (const xx of [-1.25, 1.25]) {
    const wall = box(0.25, 0.9, 11, 0xc0392b);
    wall.position.set(xx, 0.55, 0);
    bridge.add(wall);
    for (const zz of [-4.5, -1.5, 1.5, 4.5]) {
      const post = box(0.35, 1.3, 0.35, 0xa93226);
      post.position.set(xx, 0.1, zz);
      bridge.add(post);
    }
  }
  const deck = box(3.1, 0.12, 11, 0x8a5a2b);
  deck.position.y = 0.02;
  bridge.add(deck);
  scene.add(bridge);

  // ducks — mama + ducklings paddling in circles beside the bridge
  function makeDuck(scale, bodyC, beakC) {
    const d = new THREE.Group();
    const body = sph(0.5, bodyC);
    body.scale.set(0.85, 0.7, 1.2);
    body.position.y = 0.3;
    d.add(body);
    const head = sph(0.28, bodyC);
    head.position.set(0, 0.78, 0.42);
    d.add(head);
    const beak = cone(0.1, 0.3, beakC, { seg: 10 });
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.74, 0.72);
    d.add(beak);
    for (const xx of [-0.11, 0.11]) {
      const eye = sph(0.045, 0x222222, { shadow: false });
      eye.position.set(xx, 0.85, 0.62);
      d.add(eye);
    }
    const tail = cone(0.12, 0.3, bodyC, { seg: 10 });
    tail.rotation.x = -Math.PI / 2.6;
    tail.position.set(0, 0.42, -0.55);
    d.add(tail);
    const wings = [];
    for (const s of [-1, 1]) {
      const wing = sph(0.3, bodyC);
      wing.scale.set(0.25, 0.5, 0.9);
      wing.position.set(s * 0.34, 0.38, -0.05);
      wing.rotation.z = s * 0.3;
      d.add(wing);
      wings.push(wing);
    }
    d.scale.setScalar(scale);
    d.userData = { tap: 'duck', wings, flap: 0, baseY: 0 };
    return d;
  }
  const flock = [
    { c: [5, 0], r: 2.2, w: 0.55, s: 1.0, col: 0xffffff },   // mama
    { c: [5, 0], r: 3.1, w: 0.7, s: 0.55, col: 0xffd24a },
    { c: [5, 0], r: 3.1, w: 0.7, s: 0.55, col: 0xffd24a, ph: 2.1 },
    { c: [-5.5, 1], r: 1.6, w: -0.8, s: 0.55, col: 0xffd24a },
  ];
  for (const f of flock) {
    const duck = makeDuck(f.s, f.col, 0xff8c1a);
    const center = p.clone().addScaledVector(sideOut, f.c[0]).addScaledVector(tan, f.c[1]);
    duck.userData.center = center;
    duck.userData.r = f.r;
    duck.userData.w = f.w;
    duck.userData.a = f.ph || Math.PI * (f.r + f.c[0]);
    scene.add(duck);
    ducks.push(duck);
    tappables.push(duck);
  }
})();

// ---- station
(function buildStation() {
  const { p, tan, sideOut } = frameAt(nearestU(8, -34));
  const grp = new THREE.Group();
  grp.position.copy(p).addScaledVector(sideOut, 2.6);
  grp.lookAt(grp.position.clone().add(tan));
  const platform = box(2.6, 0.5, 9, 0xd9c49a);
  platform.position.y = 0.25;
  grp.add(platform);
  for (const zz of [-3.4, 3.4]) {
    const post = cyl(0.09, 0.09, 1.9, 0xffffff);
    post.position.set(0.6, 1.4, zz);
    grp.add(post);
  }
  const roof = box(2.4, 0.14, 8.4, 0xe05d4b);
  roof.position.set(0.45, 2.4, 0);
  roof.rotation.z = -0.12;
  grp.add(roof);
  // sign
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 3.2),
    new THREE.MeshStandardMaterial({ map: textTexture('QUACKVILLE', { size: 80 }) }));
  const sides = mat(0x8a5a2b);
  sign.material = [sign.material, sign.material, sides, sides, sides, sides];
  sign.position.set(0.9, 1.7, 0);
  grp.add(sign);
  const lamppost = cyl(0.06, 0.06, 2.2, 0x2f4858);
  lamppost.position.set(0.9, 1.1, -4.1);
  grp.add(lamppost);
  const lampBall = sph(0.18, 0xfff2ae, { shadow: false });
  lampBall.material.emissive = new THREE.Color(0xffe680);
  lampBall.material.emissiveIntensity = 0.7;
  lampBall.position.set(0.9, 2.3, -4.1);
  grp.add(lampBall);
  scene.add(grp);
})();

// ---- trees & flowers (kept clear of the track and pond)
function clearOfTrack(x, z, margin) {
  for (let i = 0; i < 200; i++) {
    const p = curve.getPointAt(i / 200);
    if ((p.x - x) ** 2 + (p.z - z) ** 2 < margin * margin) return false;
  }
  const dp = pondFrame.p;
  if ((dp.x - x) ** 2 + (dp.z - z) ** 2 < 15 * 15) return false;
  return true;
}
function makeTree(kind) {
  const t = new THREE.Group();
  const trunk = cyl(0.18, 0.26, 1.6, 0x7a5230);
  trunk.position.y = 0.8;
  t.add(trunk);
  if (kind === 'pine') {
    for (let i = 0; i < 3; i++) {
      const c = cone(1.3 - i * 0.32, 1.5, 0x2f8f46);
      c.position.y = 1.6 + i * 0.95;
      t.add(c);
    }
  } else {
    const blob = sph(1.35, 0x3da34f);
    blob.position.y = 2.4;
    blob.scale.y = 0.9;
    t.add(blob);
    const blob2 = sph(0.85, 0x4cb35c);
    blob2.position.set(0.8, 1.9, 0.3);
    t.add(blob2);
  }
  return t;
}
(function plant() {
  let made = 0, tries = 0;
  while (made < 16 && tries < 400) {
    tries++;
    const x = (Math.random() - 0.5) * 110;
    const z = (Math.random() - 0.5) * 100;
    if (!clearOfTrack(x, z, 5.5)) continue;
    const t = makeTree(Math.random() < 0.5 ? 'pine' : 'oak');
    const s = 0.8 + Math.random() * 0.7;
    t.scale.setScalar(s);
    t.position.set(x, 0, z);
    t.rotation.y = Math.random() * Math.PI * 2;
    scene.add(t);
    made++;
  }
  // flowers
  const colors = [0xff5d8f, 0xffd24a, 0xff8c1a, 0xb388ff, 0xff6b6b];
  let f = 0; tries = 0;
  while (f < 60 && tries < 600) {
    tries++;
    const x = (Math.random() - 0.5) * 120;
    const z = (Math.random() - 0.5) * 110;
    if (!clearOfTrack(x, z, 3.2)) continue;
    const head = sph(0.16, colors[f % colors.length], { shadow: false });
    head.position.set(x, 0.32, z);
    scene.add(head);
    const stem = cyl(0.03, 0.03, 0.3, 0x3f8f3f, { shadow: false });
    stem.position.set(x, 0.15, z);
    scene.add(stem);
    f++;
  }
})();

// ---- monkeys
const monkeys = [];
function makeMonkey() {
  // built hanging: the group's origin is the branch grip point
  const g = new THREE.Group();
  const fur = 0x8a5a3b, face = 0xe8c39e;
  for (const s of [-1, 1]) {
    const arm = cyl(0.07, 0.09, 0.85, fur);
    arm.position.set(s * 0.18, -0.42, 0);
    arm.rotation.z = s * 0.18;
    g.add(arm);
  }
  const body = sph(0.36, fur);
  body.scale.set(0.9, 1.2, 0.8);
  body.position.y = -1.15;
  g.add(body);
  const belly = sph(0.24, face);
  belly.scale.set(0.8, 1, 0.5);
  belly.position.set(0, -1.18, 0.18);
  g.add(belly);
  const head = sph(0.27, fur);
  head.position.y = -0.62;
  g.add(head);
  const muzzle = sph(0.17, face);
  muzzle.scale.set(1, 0.8, 0.7);
  muzzle.position.set(0, -0.68, 0.18);
  g.add(muzzle);
  for (const s of [-1, 1]) {
    const ear = sph(0.1, face);
    ear.position.set(s * 0.26, -0.56, 0);
    g.add(ear);
    const eye = sph(0.04, 0x222222, { shadow: false });
    eye.position.set(s * 0.08, -0.56, 0.24);
    g.add(eye);
    const leg = cyl(0.07, 0.06, 0.5, fur);
    leg.position.set(s * 0.14, -1.6, 0.08);
    leg.rotation.x = -0.5;
    g.add(leg);
  }
  const tail = mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 14, Math.PI * 1.2), fur);
  tail.position.set(0, -1.35, -0.32);
  tail.rotation.y = Math.PI / 2;
  g.add(tail);
  g.userData = { tap: 'monkey', spin: 0, phase: Math.random() * 6 };
  return g;
}
function makeJungleTree(x, z, rotY) {
  const t = new THREE.Group();
  t.position.set(x, 0, z);
  t.rotation.y = rotY;
  const trunk = cyl(0.22, 0.34, 4.4, 0x8a6238);
  trunk.position.y = 2.2;
  trunk.rotation.z = 0.08;
  t.add(trunk);
  const canopy = sph(1.7, 0x2f9e44);
  canopy.position.y = 4.9;
  canopy.scale.y = 0.75;
  t.add(canopy);
  const canopy2 = sph(1.1, 0x40b350);
  canopy2.position.set(1.2, 4.4, 0.4);
  t.add(canopy2);
  const branch = cyl(0.09, 0.12, 2.6, 0x8a6238, { axis: 'x' });
  branch.position.set(1.6, 3.6, 0);
  t.add(branch);
  scene.add(t);
  const monkey = makeMonkey();
  monkey.position.set(2.6, 3.6, 0);   // hangs from the branch tip
  t.add(monkey);
  monkeys.push(monkey);
  tappables.push(monkey);
  return t;
}
{
  const a = frameAt(nearestU(28, 26));
  makeJungleTree(a.p.x + a.sideOut.x * 6.5, a.p.z + a.sideOut.z * 6.5, 0.8);
  const b = frameAt(nearestU(-16, -32));
  makeJungleTree(b.p.x + b.sideOut.x * 7, b.p.z + b.sideOut.z * 7, 2.4);
  // one cheeky monkey sits on top of the tunnel hill
  const t = frameAt(tunnelU);
  const hillMonkey = makeMonkey();
  hillMonkey.position.set(t.p.x, 6.2, t.p.z);   // origin is the grip point, body hangs below
  scene.add(hillMonkey);
  monkeys.push(hillMonkey);
  tappables.push(hillMonkey);
}

// ============================================================ rolling stock kit
const GAUGE_X = 0.62;   // wheel offset from centerline

function makeWheel(r, color, width) {
  const w = width || 0.16;
  const g = new THREE.Group();
  const rim = cyl(r, r, w, 0x33373d, { axis: 'x', seg: 24 });
  g.add(rim);
  const disc = cyl(r * 0.82, r * 0.82, w + 0.04, color, { axis: 'x', seg: 24 });
  g.add(disc);
  if (r > 0.45) {
    for (let i = 0; i < 4; i++) {
      const spoke = box(w + 0.07, r * 1.5, r * 0.16, 0x33373d);
      spoke.rotation.x = i * Math.PI / 4;
      g.add(spoke);
    }
    const hub = cyl(r * 0.2, r * 0.2, w + 0.1, 0x33373d, { axis: 'x' });
    g.add(hub);
  }
  return g;
}

/* Adds wheels (and coupling rods for drivers) to a vehicle.
   zs: axle positions along the vehicle; every wheel touches y=0. */
function addWheels(v, zs, r, color, opts = {}) {
  const gx = opts.gauge || GAUGE_X;
  for (const sideSign of [-1, 1]) {
    const phase = sideSign < 0 ? 0 : Math.PI / 2;   // quartered cranks like a real engine
    const sideWheels = [];
    for (const z of zs) {
      const w = makeWheel(r, color, opts.width);
      w.position.set(sideSign * gx, r, z);
      w.rotation.x = phase;
      v.g.add(w);
      v.wheels.push({ g: w, r });
      sideWheels.push(w);
      if (opts.rods && zs.length > 1) {
        const pin = cyl(0.05, 0.05, 0.14, 0xd9d9d9, { axis: 'x', shadow: false });
        pin.position.set(sideSign * 0.12, 0, r * 0.45);
        w.add(pin);
      }
    }
    if (opts.rods && zs.length > 1) {
      const span = Math.abs(zs[zs.length - 1] - zs[0]);
      const rod = box(0.07, 0.11, span + 0.35, 0xc7ccd1, { metal: 0.5, rough: 0.4 });
      v.g.add(rod);
      v.rods.push({
        m: rod, w: sideWheels[0], c: r * 0.45,
        x: sideSign * (gx + 0.12), y0: r, z0: (zs[0] + zs[zs.length - 1]) / 2,
      });
    }
    // axles
  }
  for (const z of zs) {
    const axle = cyl(0.05, 0.05, gx * 2, 0x2a2d31, { axis: 'x', shadow: false });
    axle.position.set(0, r, z);
    v.g.add(axle);
  }
}

function makeDriver(coat, cap) {
  const d = new THREE.Group();
  const body = cyl(0.2, 0.24, 0.5, coat);
  body.position.y = 0.25;
  d.add(body);
  const head = sph(0.18, 0xf2c094);
  head.position.y = 0.62;
  d.add(head);
  const hat = cyl(0.19, 0.19, 0.1, cap);
  hat.position.y = 0.76;
  d.add(hat);
  const brim = cyl(0.21, 0.21, 0.04, cap);
  brim.position.set(0, 0.72, 0.06);
  d.add(brim);
  return d;
}

function newVehicle(len) {
  return { g: new THREE.Group(), wheels: [], rods: [], len };
}

function buffers(v, zFront, zBack, y) { // little bumpers at the ends
  for (const z of [zFront, zBack]) {
    for (const x of [-0.35, 0.35]) {
      const b = cyl(0.07, 0.09, 0.18, 0x2a2d31, { axis: 'z', shadow: false });
      b.position.set(x, y, z);
      v.g.add(b);
    }
  }
}

// ============================================================ the engines

// --- CHOO CHOO — the little black engine from the book
function buildChooChoo() {
  const e = newVehicle(4.6);
  const black = 0x23272b, gold = 0xd4a017, red = 0xb33939;
  const boiler = cyl(0.62, 0.62, 2.5, black, { axis: 'z', rough: 0.45 });
  boiler.position.set(0, 1.25, 0.5);
  e.g.add(boiler);
  for (const z of [1.45, 0.5, -0.4]) {
    const band = cyl(0.65, 0.65, 0.09, gold, { axis: 'z', metal: 0.7, rough: 0.3 });
    band.position.set(0, 1.25, z);
    e.g.add(band);
  }
  const stack = cyl(0.16, 0.22, 0.9, black);
  stack.position.set(0, 2.25, 1.45);
  e.g.add(stack);
  const stackRim = cyl(0.26, 0.26, 0.12, gold, { metal: 0.7, rough: 0.3 });
  stackRim.position.set(0, 2.68, 1.45);
  e.g.add(stackRim);
  const dome = sph(0.3, gold, { metal: 0.7, rough: 0.3 });
  dome.position.set(0, 1.9, 0.6);
  e.g.add(dome);
  const bell = sph(0.16, gold, { metal: 0.8, rough: 0.25 });
  bell.scale.y = 1.2;
  bell.position.set(0, 1.98, 1.0);
  e.g.add(bell);
  // headlamp
  const lampBox = box(0.34, 0.4, 0.3, black);
  lampBox.position.set(0, 1.95, 1.78);
  e.g.add(lampBox);
  const lampLens = cyl(0.13, 0.13, 0.1, 0xfff2ae, { axis: 'z', shadow: false });
  lampLens.material.emissive = new THREE.Color(0xffe680);
  lampLens.material.emissiveIntensity = 0.8;
  lampLens.position.set(0, 1.95, 1.95);
  e.g.add(lampLens);
  // cowcatcher
  for (const s of [-1, 1]) {
    const plate = box(0.7, 0.5, 0.08, red);
    plate.position.set(s * 0.33, 0.45, 2.05 - Math.abs(s) * 0);
    plate.rotation.y = s * 0.55;
    plate.rotation.x = -0.4;
    e.g.add(plate);
  }
  // cab
  const cab = box(1.5, 1.5, 1.2, black);
  cab.position.set(0, 1.55, -1.3);
  e.g.add(cab);
  const cabRoof = box(1.75, 0.12, 1.5, red);
  cabRoof.position.set(0, 2.36, -1.3);
  e.g.add(cabRoof);
  for (const s of [-1, 1]) {
    const win = box(0.06, 0.5, 0.55, 0xbfe6ff, { shadow: false });
    win.position.set(s * 0.76, 1.8, -1.3);
    e.g.add(win);
  }
  const frame = box(1.1, 0.25, 4.0, 0x2a2d31);
  frame.position.set(0, 0.62, 0.1);
  e.g.add(frame);
  const driver = makeDriver(0x3566c4, 0x2b3a67);
  driver.position.set(0.3, 1.0, -1.3);
  e.g.add(driver);
  addWheels(e, [1.1, 0.1, -1.0], 0.55, red, { rods: true });
  e.chimney = new THREE.Vector3(0, 2.8, 1.45);
  e.driveR = 0.55;

  // tender with her name on it
  const t = newVehicle(2.6);
  const tub = box(1.5, 1.0, 2.3, black);
  tub.position.y = 1.1;
  t.g.add(tub);
  const coal = sph(0.7, 0x17191c);
  coal.scale.set(0.95, 0.45, 1.45);
  coal.position.y = 1.62;
  t.g.add(coal);
  for (const s of [-1, 1]) {
    const plate = namePlate('CHOO CHOO', 1.9, 0.42);
    plate.position.set(s * 0.78, 1.25, 0);
    t.g.add(plate);
  }
  addWheels(t, [0.75, -0.75], 0.38, black);
  return { vehicles: [e, t], type: 'steam' };
}

// --- STEPHENSON'S ROCKET
function buildRocket() {
  const e = newVehicle(4.2);
  const ochre = 0xe9b820, white = 0xf5f1e6;
  const boiler = cyl(0.75, 0.75, 2.6, ochre, { axis: 'z', rough: 0.5 });
  boiler.position.set(0, 1.35, 0.3);
  e.g.add(boiler);
  const boilerCap = sph(0.75, 0x9b7a10);
  boilerCap.scale.z = 0.45;
  boilerCap.position.set(0, 1.35, 1.6);
  e.g.add(boilerCap);
  // the famous tall white chimney
  const chim = cyl(0.2, 0.26, 2.3, white);
  chim.position.set(0, 2.8, 1.35);
  e.g.add(chim);
  const chimCap = cyl(0.32, 0.26, 0.25, 0x2a2d31);
  chimCap.position.set(0, 3.95, 1.35);
  e.g.add(chimCap);
  for (const s of [-1, 1]) { // chimney stays
    const stay = cyl(0.03, 0.03, 1.6, 0x6b6b6b, { shadow: false });
    stay.position.set(s * 0.35, 2.7, 1.05);
    stay.rotation.z = s * 0.32;
    stay.rotation.x = 0.25;
    e.g.add(stay);
  }
  // firebox + open footplate
  const firebox = box(1.2, 1.1, 0.9, 0xb05d2a);
  firebox.position.set(0, 1.15, -1.25);
  e.g.add(firebox);
  const plate = box(1.3, 0.18, 4.0, 0x6b4a2a);
  plate.position.set(0, 0.55, -0.1);
  e.g.add(plate);
  // the slanted cylinders at the back
  for (const s of [-1, 1]) {
    const pc = cyl(0.17, 0.17, 1.1, 0x4a6f9e, { metal: 0.5, rough: 0.4 });
    pc.position.set(s * 0.75, 1.5, -1.6);
    pc.rotation.x = 0.7;
    e.g.add(pc);
  }
  const driver = makeDriver(0x7a4a2b, 0x2a2d31);
  driver.position.set(0, 0.64, -1.95);
  e.g.add(driver);
  // one huge driving wheel pair + small trailing wheels
  addWheels(e, [0.85], 0.95, ochre, { rods: false });
  addWheels(e, [-1.5], 0.42, ochre);
  e.chimney = new THREE.Vector3(0, 4.0, 1.35);
  e.driveR = 0.95;

  // barrel tender
  const t = newVehicle(2.4);
  const cart = box(1.3, 0.55, 2.1, 0x7a4a2b);
  cart.position.y = 0.85;
  t.g.add(cart);
  const barrel = cyl(0.55, 0.55, 1.3, 0xb3702d);
  barrel.position.y = 1.65;
  t.g.add(barrel);
  for (const yy of [1.25, 1.95]) {
    const hoop = cyl(0.58, 0.58, 0.08, 0x6b4a2a);
    hoop.position.y = yy;
    t.g.add(hoop);
  }
  addWheels(t, [0.7, -0.7], 0.4, 0x9b7a10);
  return { vehicles: [e, t], type: 'steam' };
}

// --- CATCH ME WHO CAN (Trevithick, 1808 — ran alone on a circle, just like ours!)
function buildCatchMe() {
  const e = newVehicle(4.4);
  const iron = 0x5d5048, brass = 0xc9a227;
  const boiler = cyl(0.78, 0.78, 2.7, iron, { axis: 'z', rough: 0.55 });
  boiler.position.set(0, 1.5, -0.2);
  e.g.add(boiler);
  const capF = sph(0.78, iron); capF.scale.z = 0.5; capF.position.set(0, 1.5, 1.15); e.g.add(capF);
  const capB = sph(0.78, iron); capB.scale.z = 0.5; capB.position.set(0, 1.5, -1.55); e.g.add(capB);
  for (const z of [0.8, -0.2, -1.2]) {
    const hoop = cyl(0.81, 0.81, 0.1, brass, { metal: 0.7, rough: 0.3 });
    hoop.position.set(0, 1.5, z);
    e.g.add(hoop);
  }
  // very tall skinny chimney
  const chim = cyl(0.15, 0.2, 2.6, 0x2a2d31);
  chim.position.set(0, 3.4, 0.85);
  e.g.add(chim);
  const chimCap = cyl(0.27, 0.2, 0.22, 0x17191c);
  chimCap.position.set(0, 4.7, 0.85);
  e.g.add(chimCap);
  // exposed vertical piston at the rear — its signature look
  const cylv = cyl(0.2, 0.2, 0.9, brass, { metal: 0.7, rough: 0.3 });
  cylv.position.set(0, 2.4, -1.5);
  e.g.add(cylv);
  const pistonRod = cyl(0.05, 0.05, 0.8, 0xd9d9d9, { shadow: false });
  pistonRod.position.set(0, 3.1, -1.5);
  e.g.add(pistonRod);
  const crossbar = box(0.9, 0.1, 0.12, iron);
  crossbar.position.set(0, 3.45, -1.5);
  e.g.add(crossbar);
  e.pumper = { rod: pistonRod, bar: crossbar, baseY: [3.1, 3.45] };
  const frame = box(1.25, 0.22, 4.2, 0x3a332e);
  frame.position.set(0, 0.6, -0.2);
  e.g.add(frame);
  // big spindly wheels, all the same size
  addWheels(e, [1.1, -1.3], 0.85, 0x8a6238, { rods: true });
  e.chimney = new THREE.Vector3(0, 4.8, 0.85);
  e.driveR = 0.85;
  return { vehicles: [e], type: 'steam' };   // she always ran alone!
}

// --- MALLARD — streamlined A4
function buildMallard() {
  const e = newVehicle(6.4);
  const blue = 0x2a5fa8, red = 0xb33939;
  const body = box(1.5, 1.2, 4.8, blue, { rough: 0.35 });
  body.position.set(0, 1.45, -0.5);
  e.g.add(body);
  const roof = cyl(0.75, 0.75, 4.8, blue, { axis: 'z', rough: 0.35 });
  roof.scale.y = 0.6;
  roof.position.set(0, 2.05, -0.5);
  e.g.add(roof);
  // the famous wedge nose
  const nose = sph(0.8, blue, { rough: 0.35, seg: 24 });
  nose.scale.set(0.94, 1.35, 2.3);
  nose.position.set(0, 1.45, 2.0);
  nose.rotation.x = 0.1;
  e.g.add(nose);
  // small chimney behind the wedge top
  const chim = box(0.35, 0.18, 0.55, 0x1d3f70);
  chim.position.set(0, 2.62, 1.35);
  e.g.add(chim);
  // side skirts
  for (const s of [-1, 1]) {
    const skirt = box(0.1, 0.7, 4.6, blue, { rough: 0.35 });
    skirt.position.set(s * 0.78, 0.75, -0.4);
    e.g.add(skirt);
    const stripe = box(0.04, 0.1, 4.4, 0xe8e8e8, { shadow: false });
    stripe.position.set(s * 0.84, 1.15, -0.4);
    e.g.add(stripe);
    const plate = namePlate('MALLARD', 1.5, 0.3);
    plate.position.set(s * 0.84, 1.75, 0.4);
    e.g.add(plate);
  }
  // cab
  const cab = box(1.5, 1.3, 1.0, blue, { rough: 0.35 });
  cab.position.set(0, 1.6, -3.2);
  e.g.add(cab);
  const cabRoof = box(1.6, 0.12, 1.1, 0x1d3f70);
  cabRoof.position.set(0, 2.3, -3.2);
  e.g.add(cabRoof);
  const driver = makeDriver(0x2f4858, 0x17191c);
  driver.position.set(-0.3, 1.05, -3.2);
  e.g.add(driver);
  addWheels(e, [0.5, -0.7, -1.9], 0.72, red, { rods: true });
  addWheels(e, [2.2], 0.35, red);
  e.chimney = new THREE.Vector3(0, 2.75, 1.35);
  e.driveR = 0.72;

  // two teak coaches
  const coaches = [];
  for (let i = 0; i < 2; i++) coaches.push(buildCoach(0x7a4a2b, 0x3f3a33));
  return { vehicles: [e, ...coaches], type: 'steam' };
}

// --- DIESEL-ELECTRIC (streamliner with a warbonnet nose)
function buildDiesel() {
  const e = newVehicle(6.8);
  const silver = 0xc9ccd0, redW = 0xc0392b, yellow = 0xf2c14e;
  const body = box(1.6, 1.55, 5.6, silver, { metal: 0.35, rough: 0.4 });
  body.position.set(0, 1.45, -0.5);
  e.g.add(body);
  const roof = cyl(0.8, 0.8, 5.6, silver, { axis: 'z', metal: 0.35, rough: 0.4 });
  roof.scale.y = 0.45;
  roof.position.set(0, 2.2, -0.5);
  e.g.add(roof);
  // bulldog nose
  const noseBody = box(1.6, 1.3, 1.2, redW, { rough: 0.45 });
  noseBody.position.set(0, 1.32, 2.6);
  e.g.add(noseBody);
  const noseCap = cyl(0.8, 0.8, 1.3, redW, { rough: 0.45, seg: 24 });
  noseCap.scale.z = 0.55;
  noseCap.position.set(0, 1.32, 3.1);
  e.g.add(noseCap);
  const noseTop = box(1.2, 0.6, 1.3, redW);
  noseTop.position.set(0, 1.95, 2.85);
  noseTop.rotation.x = 0.15;
  e.g.add(noseTop);
  const windshield = box(1.0, 0.42, 0.5, 0x9fd2ef, { shadow: false });
  windshield.position.set(0, 2.18, 2.5);
  windshield.rotation.x = 0.3;
  e.g.add(windshield);
  // warbonnet swoosh + yellow stripe
  for (const s of [-1, 1]) {
    const swoosh = box(0.06, 1.0, 1.6, redW);
    swoosh.position.set(s * 0.82, 1.55, 1.65);
    swoosh.rotation.x = 0;
    e.g.add(swoosh);
    const stripe = box(0.05, 0.14, 5.4, yellow, { shadow: false });
    stripe.position.set(s * 0.84, 1.1, -0.4);
    e.g.add(stripe);
  }
  // headlight
  const lamp = cyl(0.14, 0.14, 0.1, 0xfff2ae, { axis: 'z', shadow: false });
  lamp.material.emissive = new THREE.Color(0xffe680);
  lamp.material.emissiveIntensity = 0.9;
  lamp.position.set(0, 1.9, 3.45);
  e.g.add(lamp);
  // horns + roof fans + exhaust
  for (const s of [-1, 1]) {
    const horn = cone(0.07, 0.3, 0x4a4f55, { seg: 10 });
    horn.rotation.x = Math.PI / 2.4;
    horn.position.set(s * 0.2, 2.62, 1.9);
    e.g.add(horn);
  }
  for (const z of [-0.5, -1.6, -2.7]) {
    const fan = cyl(0.32, 0.32, 0.12, 0x6b7077, { shadow: false });
    fan.position.set(0, 2.6, z);
    e.g.add(fan);
  }
  // bogies
  for (const z of [1.6, -2.4]) {
    const truck = box(1.1, 0.45, 1.9, 0x33373d);
    truck.position.set(0, 0.5, z);
    e.g.add(truck);
  }
  addWheels(e, [2.1, 1.1], 0.4, 0x33373d);
  addWheels(e, [-1.9, -2.9], 0.4, 0x33373d);
  e.chimney = new THREE.Vector3(0, 2.7, -1.0);   // exhaust, not a chimney
  e.driveR = 0.4;

  // freight: boxcar, tanker, log car, caboose
  return { vehicles: [e, buildBoxcar(), buildTanker(), buildLogCar(), buildCaboose()], type: 'diesel' };
}

// --- BULLET TRAIN
function buildBullet() {
  const e = newVehicle(7.0);
  const white = 0xf2f5f7, blue = 0x2a6fd6;
  const body = cyl(0.85, 0.85, 4.6, white, { axis: 'z', rough: 0.3, seg: 24 });
  body.scale.y = 0.95;
  body.position.set(0, 1.45, -0.8);
  e.g.add(body);
  const under = box(1.55, 0.8, 4.6, white, { rough: 0.3 });
  under.position.set(0, 0.95, -0.8);
  e.g.add(under);
  // looong nose
  const nose = sph(0.85, white, { rough: 0.3, seg: 24 });
  nose.scale.set(0.95, 0.85, 3.4);
  nose.position.set(0, 1.3, 1.6);
  e.g.add(nose);
  const windshield = sph(0.5, 0x37474f, { shadow: false });
  windshield.scale.set(0.85, 0.5, 1.1);
  windshield.position.set(0, 1.95, 1.4);
  e.g.add(windshield);
  // blue stripe + windows
  for (const s of [-1, 1]) {
    const stripe = box(0.04, 0.3, 4.6, blue, { shadow: false });
    stripe.position.set(s * 0.83, 1.45, -0.8);
    e.g.add(stripe);
    for (let i = 0; i < 4; i++) {
      const win = box(0.04, 0.3, 0.5, 0x37474f, { shadow: false });
      win.position.set(s * 0.84, 1.95, 0.4 - i * 1.0);
      e.g.add(win);
    }
  }
  // pantograph
  const panto = new THREE.Group();
  const armA = cyl(0.04, 0.04, 1.0, 0x33373d, { shadow: false });
  armA.rotation.z = 0.7; armA.position.set(-0.2, 0.35, 0);
  panto.add(armA);
  const armB = cyl(0.04, 0.04, 1.0, 0x33373d, { shadow: false });
  armB.rotation.z = -0.7; armB.position.set(0.2, 0.35, 0);
  panto.add(armB);
  const shoe = box(0.9, 0.05, 0.2, 0x33373d, { shadow: false });
  shoe.position.y = 0.75;
  panto.add(shoe);
  panto.position.set(0, 2.3, -2.2);
  e.g.add(panto);
  addWheels(e, [1.9, 1.0], 0.38, 0x4a4f55);
  addWheels(e, [-1.7, -2.6], 0.38, 0x4a4f55);
  e.driveR = 0.38;
  // matching cars
  const cars = [];
  for (let i = 0; i < 2; i++) {
    const c = newVehicle(5.2);
    const cb = cyl(0.85, 0.85, 4.6, white, { axis: 'z', rough: 0.3, seg: 24 });
    cb.scale.y = 0.95;
    cb.position.set(0, 1.45, 0);
    c.g.add(cb);
    const cu = box(1.55, 0.8, 4.6, white, { rough: 0.3 });
    cu.position.set(0, 0.95, 0);
    c.g.add(cu);
    for (const s of [-1, 1]) {
      const stripe = box(0.04, 0.3, 4.6, blue, { shadow: false });
      stripe.position.set(s * 0.83, 1.45, 0);
      c.g.add(stripe);
      for (let j = 0; j < 5; j++) {
        const win = box(0.04, 0.3, 0.5, 0x37474f, { shadow: false });
        win.position.set(s * 0.84, 1.95, 1.6 - j * 0.85);
        c.g.add(win);
      }
    }
    addWheels(c, [1.6, -1.6], 0.38, 0x4a4f55);
    cars.push(c);
  }
  return { vehicles: [e, ...cars], type: 'electric' };
}

// ============================================================ the cars
function buildCoach(bodyC, roofC) {
  const c = newVehicle(4.6);
  const body = box(1.5, 1.35, 4.2, bodyC);
  body.position.y = 1.35;
  c.g.add(body);
  const roof = cyl(0.76, 0.76, 4.3, roofC, { axis: 'z' });
  roof.scale.y = 0.4;
  roof.position.y = 2.05;
  c.g.add(roof);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const win = box(0.06, 0.5, 0.55, 0xfff3cf, { shadow: false });
      win.position.set(s * 0.76, 1.55, 1.4 - i * 0.95);
      c.g.add(win);
    }
    const band = box(0.04, 0.18, 4.2, 0xe3c878, { shadow: false });
    band.position.set(s * 0.78, 0.85, 0);
    c.g.add(band);
  }
  addWheels(c, [1.4, -1.4], 0.36, 0x33373d);
  return c;
}
function buildBoxcar() {
  const c = newVehicle(4.4);
  const body = box(1.55, 1.5, 4.0, 0x9b4a2f);
  body.position.y = 1.4;
  c.g.add(body);
  for (const s of [-1, 1]) {
    const door = box(0.06, 1.1, 1.1, 0x7a3a24);
    door.position.set(s * 0.79, 1.3, 0);
    c.g.add(door);
  }
  const roofline = box(1.62, 0.1, 4.05, 0x6e3520);
  roofline.position.y = 2.2;
  c.g.add(roofline);
  addWheels(c, [1.35, -1.35], 0.36, 0x33373d);
  return c;
}
function buildTanker() {
  const c = newVehicle(4.4);
  const frame = box(1.2, 0.16, 4.0, 0x33373d);
  frame.position.y = 0.85;
  c.g.add(frame);
  const tank = cyl(0.72, 0.72, 3.7, 0xb8bdc4, { axis: 'z', metal: 0.5, rough: 0.35 });
  tank.position.y = 1.6;
  c.g.add(tank);
  const capA = sph(0.72, 0xb8bdc4, { metal: 0.5, rough: 0.35 }); capA.scale.z = 0.4; capA.position.set(0, 1.6, 1.85); c.g.add(capA);
  const capB = sph(0.72, 0xb8bdc4, { metal: 0.5, rough: 0.35 }); capB.scale.z = 0.4; capB.position.set(0, 1.6, -1.85); c.g.add(capB);
  const hatch = cyl(0.22, 0.22, 0.25, 0x6b7077);
  hatch.position.y = 2.4;
  c.g.add(hatch);
  addWheels(c, [1.35, -1.35], 0.36, 0x33373d);
  return c;
}
function buildLogCar() {
  const c = newVehicle(4.4);
  const bed = box(1.5, 0.22, 4.0, 0x8a5a2b);
  bed.position.y = 0.95;
  c.g.add(bed);
  const logY = [1.35, 1.35, 1.95];
  const logX = [-0.4, 0.4, 0];
  for (let i = 0; i < 3; i++) {
    const log = cyl(0.32, 0.32, 3.6, 0x9c6b3c, { axis: 'z' });
    log.position.set(logX[i], logY[i], 0);
    c.g.add(log);
    const endA = cyl(0.33, 0.33, 0.05, 0xd9b380, { axis: 'z', shadow: false });
    endA.position.set(logX[i], logY[i], 1.83);
    c.g.add(endA);
  }
  for (const z of [-1.6, 1.6]) {
    for (const s of [-1, 1]) {
      const stake = box(0.12, 1.2, 0.12, 0x4a4f55);
      stake.position.set(s * 0.78, 1.4, z);
      c.g.add(stake);
    }
  }
  addWheels(c, [1.35, -1.35], 0.36, 0x33373d);
  return c;
}
function buildCaboose() {
  const c = newVehicle(3.6);
  const body = box(1.5, 1.3, 3.0, 0xc0392b);
  body.position.y = 1.3;
  c.g.add(body);
  const cupola = box(1.0, 0.7, 1.0, 0xc0392b);
  cupola.position.y = 2.25;
  c.g.add(cupola);
  const cupolaRoof = box(1.2, 0.1, 1.2, 0x7a241a);
  cupolaRoof.position.y = 2.65;
  c.g.add(cupolaRoof);
  const roofline = box(1.6, 0.1, 3.1, 0x7a241a);
  roofline.position.y = 1.98;
  c.g.add(roofline);
  for (const s of [-1, 1]) {
    for (const z of [-0.9, 0.9]) {
      const win = box(0.06, 0.4, 0.4, 0xfff3cf, { shadow: false });
      win.position.set(s * 0.76, 1.45, z);
      c.g.add(win);
    }
  }
  addWheels(c, [1.05, -1.05], 0.36, 0x33373d);
  return c;
}

// ============================================================ train registry
const TRAINS = [
  { id: 'choochoo', name: 'CHOO CHOO', short: 'CHOO CHOO', color: '#444',
    fact: 'The little engine who ran away — just like in the book!', build: buildChooChoo, horn: 'steam2' },
  { id: 'rocket', name: 'ROCKET', short: 'ROCKET', color: '#e9b820',
    fact: 'Rocket won the great Rainhill race in 1829!', build: buildRocket, horn: 'steam1' },
  { id: 'catchme', name: 'CATCH ME WHO CAN', short: 'CATCH ME', color: '#8a6238',
    fact: 'The very first train people could ride for fun — in 1808, on a circle just like this one!', build: buildCatchMe, horn: 'steam1' },
  { id: 'mallard', name: 'MALLARD', short: 'MALLARD', color: '#2a5fa8',
    fact: 'The fastest steam engine EVER — 126 miles per hour!', build: buildMallard, horn: 'steam3' },
  { id: 'diesel', name: 'DIESEL', short: 'DIESEL', color: '#c0392b',
    fact: 'A diesel engine makes electricity to spin its wheels!', build: buildDiesel, horn: 'horn' },
  { id: 'bullet', name: 'BULLET TRAIN', short: 'BULLET', color: '#2a6fd6',
    fact: 'Electric bullet trains can zoom at 200 miles per hour!', build: buildBullet, horn: 'beep' },
];

// ============================================================ smoke
const puffTex = (() => {
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = 64;
  const ctx = cnv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cnv);
})();
const puffs = [];
function spawnPuff(worldPos, opts = {}) {
  let p = puffs.find(q => q.life <= 0);
  if (!p) {
    if (puffs.length > 70) return;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: puffTex, transparent: true, depthWrite: false,
    }));
    scene.add(sprite);
    p = { sprite, life: 0 };
    puffs.push(p);
  }
  p.maxLife = opts.life || 1.6;
  p.life = p.maxLife;
  p.grow = opts.grow || 1.4;
  p.size = opts.size || 0.7;
  p.sprite.material.color.setHex(opts.color !== undefined ? opts.color : 0xf5f5f5);
  p.sprite.position.copy(worldPos);
  p.vel = new THREE.Vector3((Math.random() - 0.5) * 0.5, 1.6 + Math.random(), (Math.random() - 0.5) * 0.5);
  p.sprite.visible = true;
}
function updatePuffs(dt) {
  for (const p of puffs) {
    if (p.life <= 0) { p.sprite.visible = false; continue; }
    p.life -= dt;
    p.sprite.position.addScaledVector(p.vel, dt);
    p.vel.x += dt * 0.3;   // a little wind
    const t = 1 - p.life / p.maxLife;
    const s = p.size + t * p.grow;
    p.sprite.scale.set(s, s, 1);
    p.sprite.material.opacity = Math.max(0, (p.life / p.maxLife)) * 0.85;
  }
}

// ============================================================ audio (all synthesized)
const audio = {
  ctx: null, master: null, loop: null,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    // reusable noise buffer
    const len = this.ctx.sampleRate * 0.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  tone(freq, t0, dur, { type = 'sine', vol = 0.2, slide = 0, attack = 0.03, vibrato = 0 } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
    if (vibrato) {
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 6; lg.gain.value = vibrato;
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t0); lfo.stop(t0 + dur + 0.1);
    }
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.setValueAtTime(vol, t0 + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  noise(t0, dur, { freq = 800, q = 0.8, vol = 0.2 } = {}) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur);
  },
  horn(kind) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime + 0.02;
    if (kind === 'steam1') {          // early engines: bright single-note shriek
      this.tone(880, t, 1.0, { vol: 0.16, vibrato: 8, attack: 0.05 });
      this.tone(1108, t, 1.0, { vol: 0.1, vibrato: 8 });
      this.noise(t, 1.0, { freq: 1800, vol: 0.05 });
    } else if (kind === 'steam2') {   // Choo Choo: friendly two-note whistle + bell
      this.tone(622, t, 1.1, { vol: 0.16, vibrato: 6, attack: 0.05 });
      this.tone(784, t, 1.1, { vol: 0.13, vibrato: 6 });
      this.noise(t, 1.1, { freq: 1400, vol: 0.05 });
      for (let i = 0; i < 3; i++) this.tone(1568, t + 1.0 + i * 0.4, 0.5, { vol: 0.08, attack: 0.005 });
    } else if (kind === 'steam3') {   // Mallard: three-chime whistle
      for (const f of [587, 740, 880]) this.tone(f, t, 1.4, { vol: 0.11, vibrato: 5, attack: 0.06 });
      this.noise(t, 1.4, { freq: 1500, vol: 0.05 });
    } else if (kind === 'horn') {     // diesel: two-tone air horn
      for (const f of [311, 392]) {
        this.tone(f, t, 1.2, { type: 'sawtooth', vol: 0.08, attack: 0.06 });
        this.tone(f * 2, t, 1.2, { type: 'sine', vol: 0.05 });
      }
    } else if (kind === 'beep') {     // bullet: melodic doo-dah
      this.tone(659, t, 0.35, { type: 'triangle', vol: 0.16, attack: 0.02 });
      this.tone(523, t + 0.4, 0.6, { type: 'triangle', vol: 0.16, attack: 0.02 });
    }
  },
  chuff(vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.18, { freq: 600 + Math.random() * 300, vol: Math.min(0.22, vol) });
  },
  quack(pitch) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime + 0.02;
    for (let i = 0; i < 2; i++) {
      this.tone(330 * pitch, t + i * 0.18, 0.14, { type: 'sawtooth', vol: 0.12, slide: -120 * pitch, attack: 0.01 });
    }
  },
  monkey() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime + 0.02;
    for (let i = 0; i < 3; i++) {
      this.tone(420, t + i * 0.18, 0.15, { vol: 0.14, slide: 480, attack: 0.01 });
    }
    this.tone(900, t + 0.56, 0.3, { vol: 0.12, slide: -400, attack: 0.01 });
  },
  tada() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    [523, 659, 784, 1047].forEach((f, i) =>
      this.tone(f, t + i * 0.09, 0.35, { type: 'triangle', vol: 0.12, attack: 0.01 }));
  },
  ding() {
    if (!this.ctx) return;
    this.tone(1175, this.ctx.currentTime + 0.01, 0.12, { vol: 0.06, attack: 0.005 });
  },
  setLoop(type) {                 // continuous engine sound (diesel rumble / electric hum)
    if (!this.ctx) return;
    if (this.loop) { this.loop.stop(); this.loop = null; }
    if (type === 'steam') return;
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = 0;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = type === 'diesel' ? 220 : 500;
    f.connect(g); g.connect(this.master);
    const oscs = [];
    if (type === 'diesel') {
      const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 48;
      const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 48.7;
      o1.connect(f); o2.connect(f); o1.start(); o2.start();
      oscs.push(o1, o2);
    } else {
      const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = 110;
      const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 164;
      o1.connect(f); o2.connect(f); o1.start(); o2.start();
      oscs.push(o1, o2);
    }
    this.loop = {
      type, gain: g, oscs,
      update(speed) {
        const target = speed > 0.2 ? (type === 'diesel' ? 0.10 : 0.05) + speed * 0.004 : 0.02;
        g.gain.setTargetAtTime(target, c.currentTime, 0.3);
        if (type === 'diesel') oscs.forEach((o, i) => o.frequency.setTargetAtTime(48 + i * 0.7 + speed * 5, c.currentTime, 0.4));
        else oscs.forEach((o, i) => o.frequency.setTargetAtTime((i ? 164 : 110) + speed * 8, c.currentTime, 0.4));
      },
      stop() { oscs.forEach(o => o.stop()); g.disconnect(); },
    };
  },
};

// ============================================================ game state
const state = {
  dist: 0,                        // distance traveled along the curve
  u: 0,
  speed: 0,
  targetSpeed: SPEEDS.med,
  chosenSpeed: SPEEDS.med,
  running: true,
  camMode: 0,                     // 0 follow, 1 ride, 2 sky
  stars: 0,
  chuffAcc: 0,
  exhaustAcc: 0,
  quackTimer: 6,
  started: false,
};
let consist = null;               // { def, vehicles, offsets, engine }

function setTrain(idx) {
  if (consist) for (const v of consist.vehicles) scene.remove(v.g);
  const def = TRAINS[idx];
  const built = def.build();
  const vehicles = built.vehicles;
  const offsets = [0];
  const GAP = 0.55;
  for (let i = 1; i < vehicles.length; i++) {
    offsets.push(offsets[i - 1] + vehicles[i - 1].len / 2 + GAP + vehicles[i].len / 2);
  }
  for (const v of vehicles) scene.add(v.g);
  consist = { def, type: built.type, vehicles, offsets, engine: vehicles[0], idx };
  placeTrain();
  audio.setLoop(built.type === 'steam' ? 'steam' : built.type);
  document.querySelectorAll('.trainBtn').forEach((b, i) => b.classList.toggle('on', i === idx));
}

const _look = new THREE.Vector3();
function placeTrain() {
  for (let i = 0; i < consist.vehicles.length; i++) {
    const v = consist.vehicles[i];
    const u = (state.dist - consist.offsets[i]) / TRACK_LEN;
    const { p, tan } = frameAt(u);
    v.g.position.set(p.x, RAIL_Y, p.z);
    _look.copy(v.g.position).add(tan);
    v.g.lookAt(_look);
    v.g.rotateZ(Math.sin(state.dist * 1.7 + i * 2) * 0.008);   // gentle wobble
  }
}

// ============================================================ UI
const $ = id => document.getElementById(id);
const banner = $('banner'), bannerName = $('bannerName'), bannerFact = $('bannerFact');
let bannerTimer = null;
function showBanner(name, fact) {
  bannerName.textContent = name;
  bannerFact.textContent = fact || '';
  bannerFact.style.display = fact ? 'inline-block' : 'none';
  banner.classList.remove('show');
  void banner.offsetWidth;        // restart the pop animation
  banner.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => banner.classList.remove('show'), 4000);
}

// train buttons
const trainRow = $('trainRow');
TRAINS.forEach((t, i) => {
  const b = document.createElement('button');
  b.className = 'trainBtn';
  b.textContent = t.short;
  b.style.borderBottomColor = t.color;
  b.addEventListener('click', () => {
    audio.ding();
    setTrain(i);
    showBanner(t.name + '!', t.fact);
    audio.horn(t.horn);
  });
  trainRow.appendChild(b);
});

const goBtn = $('goBtn');
function refreshGoBtn() {
  goBtn.textContent = state.running ? '🛑 STOP' : '🟢 GO!';
  goBtn.classList.toggle('running', state.running);
  goBtn.classList.toggle('stopped', !state.running);
}
goBtn.addEventListener('click', () => {
  state.running = !state.running;
  state.targetSpeed = state.running ? state.chosenSpeed : 0;
  audio.ding();
  if (state.running) audio.horn(consist.def.horn);
  refreshGoBtn();
});

$('whistleBtn').addEventListener('click', () => {
  audio.horn(consist.def.horn);
  whistleSteamBurst();
});
function whistleSteamBurst() {
  if (consist.type !== 'steam' || !consist.engine.chimney) return;
  consist.engine.g.updateMatrixWorld();
  const tip = consist.engine.g.localToWorld(consist.engine.chimney.clone());
  for (let i = 0; i < 4; i++) spawnPuff(tip, { size: 0.9, grow: 2.0, life: 1.8 });
}

document.querySelectorAll('#speedGrp button').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#speedGrp button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    state.chosenSpeed = SPEEDS[b.dataset.sp];
    if (state.running) state.targetSpeed = state.chosenSpeed;
    audio.ding();
  });
});

const CAM_NAMES = ['Chase view! 🚂', "Driver's view! 👀", 'Bird view! 🦅'];
$('camBtn').addEventListener('click', () => {
  state.camMode = (state.camMode + 1) % 3;
  audio.ding();
  showBanner(CAM_NAMES[state.camMode]);
});

$('mute').addEventListener('click', () => {
  if (!audio.ctx) return;
  const muted = audio.master.gain.value < 0.01;
  audio.master.gain.value = muted ? 0.5 : 0;
  $('mute').textContent = muted ? '🔊' : '🔇';
});

const hud = $('hud');
function addStar() {
  state.stars++;
  hud.textContent = '⭐ ' + state.stars;
  hud.classList.remove('pop');
  void hud.offsetWidth;
  hud.classList.add('pop');
  audio.tada();
}

// keyboard helpers for grown-ups
window.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); $('whistleBtn').click(); }
  if (e.key >= '1' && e.key <= '6') document.querySelectorAll('.trainBtn')[+e.key - 1].click();
  if (e.key === 'g') goBtn.click();
  if (e.key === 'c') $('camBtn').click();
});

// ============================================================ tapping things
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
canvas.addEventListener('pointerdown', e => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const roots = [...tappables];
  if (consist) roots.push(consist.engine.g);
  const hits = raycaster.intersectObjects(roots, true);
  if (!hits.length) return;
  let obj = hits[0].object;
  while (obj && !obj.userData.tap && obj !== consist.engine.g) obj = obj.parent;
  if (!obj) return;
  if (obj === consist.engine.g) {       // tap the engine → it whistles
    audio.horn(consist.def.horn);
    whistleSteamBurst();
    return;
  }
  if (obj.userData.tap === 'duck') {
    audio.quack(obj.scale.x > 0.7 ? 1 : 1.6);
    obj.userData.flap = 1;
  } else if (obj.userData.tap === 'monkey') {
    audio.monkey();
    obj.userData.spin = 1;
  }
});
// the engine group needs to be findable in the parent walk
// (consist.engine.g has no userData.tap; handled above by identity check)

// ============================================================ camera
const camPos = new THREE.Vector3(0, 26, 55);
const camTarget = new THREE.Vector3();
const DEBUG_VIEW = PARAMS.get('view');   // "x,z[,dist[,height]]" — fixed inspection camera
function updateCamera(dt, t) {
  if (DEBUG_VIEW) {
    const [vx, vz, vd = 14, vh = 7] = DEBUG_VIEW.split(',').map(Number);
    camera.position.set(vx + vd, vh, vz + vd * 0.6);
    camera.lookAt(vx, 1.2, vz);
    return;
  }
  const eng = consist.engine.g;
  const { tan } = frameAt(state.dist / TRACK_LEN);
  let want, look;
  if (state.camMode === 0) {           // chase
    want = eng.position.clone().addScaledVector(tan, -16).add(new THREE.Vector3(3, 8.5, 0));
    look = eng.position.clone().add(new THREE.Vector3(0, 2, 0));
  } else if (state.camMode === 1) {    // ride — just behind the cab, looking ahead
    want = eng.position.clone().addScaledVector(tan, -consist.engine.len / 2 - 0.5).add(new THREE.Vector3(0, 3.4, 0));
    look = eng.position.clone().addScaledVector(tan, 10).add(new THREE.Vector3(0, 1.6, 0));
  } else {                             // sky
    const a = t * 0.06;
    want = new THREE.Vector3(Math.cos(a) * 58, 46, Math.sin(a) * 58);
    look = new THREE.Vector3(0, 0, 0);
  }
  const k = state.camMode === 1 ? 6 : 3;
  const snap = PARAMS.has('snap') ? 1 : 0;   // screenshots: no easing
  camPos.lerp(want, snap || Math.min(1, dt * k));
  camTarget.lerp(look, snap || Math.min(1, dt * (k + 2)));
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
}

// ============================================================ main loop
const clock = new THREE.Clock();
let elapsed = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  step(dt);
  if (PARAMS.has('debug')) {
    hud.textContent = 'spd ' + state.speed.toFixed(1) + ' puffs ' + puffs.filter(p => p.life > 0).length +
      ' u ' + ((state.dist / TRACK_LEN) % 1).toFixed(3) + ' L ' + TRACK_LEN.toFixed(0) + ' tun ' + tunnelU.toFixed(3);
  }
  renderer.render(scene, camera);
}

function step(dt) {
  elapsed += dt;

  // speed easing + motion
  state.speed += (state.targetSpeed - state.speed) * Math.min(1, dt * 1.6);
  if (state.speed < 0.01 && state.targetSpeed === 0) state.speed = 0;
  const prevU = (state.dist / TRACK_LEN) % 1;
  state.dist += state.speed * dt;
  const newU = (state.dist / TRACK_LEN) % 1;
  if (newU < prevU && state.started) addStar();   // completed a lap

  placeTrain();

  // wheels & rods
  const ds = state.speed * dt;
  for (const v of consist.vehicles) {
    for (const w of v.wheels) w.g.rotation.x += ds / w.r;
    for (const r of v.rods) {
      const th = r.w.rotation.x;
      r.m.position.set(r.x, r.y0 - r.c * Math.sin(th), r.z0 + r.c * Math.cos(th));
    }
  }
  // Trevithick's bobbing piston
  const eng = consist.engine;
  if (eng.pumper) {
    const bob = Math.sin(eng.wheelsPhase = (eng.wheelsPhase || 0) + ds / eng.driveR) * 0.22;
    eng.pumper.rod.position.y = eng.pumper.baseY[0] + bob;
    eng.pumper.bar.position.y = eng.pumper.baseY[1] + bob;
  }

  // chuffs & smoke
  if (consist.type === 'steam' && eng.chimney) {
    state.chuffAcc += ds / eng.driveR;
    if (state.chuffAcc > Math.PI / 2) {
      state.chuffAcc %= Math.PI / 2;
      if (state.speed > 0.3) {
        audio.chuff(0.08 + state.speed * 0.015);
        eng.g.updateMatrixWorld();
        const tip = eng.g.localToWorld(eng.chimney.clone());
        spawnPuff(tip, { size: 0.55 + Math.random() * 0.3, grow: 1.5, life: 1.7 });
      }
    }
  } else if (consist.type === 'diesel' && state.speed > 0.3) {
    state.exhaustAcc += dt;
    if (state.exhaustAcc > 0.22) {
      state.exhaustAcc = 0;
      eng.g.updateMatrixWorld();
      const tip = eng.g.localToWorld(eng.chimney.clone());
      spawnPuff(tip, { size: 0.3, grow: 0.8, life: 1.1, color: 0x777777 });
    }
  }
  if (audio.loop) audio.loop.update(state.speed);

  updatePuffs(dt);

  // ducks
  for (const d of ducks) {
    const ud = d.userData;
    ud.a += dt * ud.w;
    d.position.set(
      ud.center.x + Math.cos(ud.a) * ud.r,
      Math.sin(elapsed * 3 + ud.r * 5) * 0.05 + (ud.flap > 0 ? ud.flap * 0.4 : 0),
      ud.center.z + Math.sin(ud.a) * ud.r
    );
    d.rotation.y = -ud.a;
    if (ud.flap > 0) {
      ud.flap = Math.max(0, ud.flap - dt * 1.6);
      const f = Math.sin(elapsed * 28) * 0.9 * ud.flap;
      ud.wings[0].rotation.z = -0.3 - f;
      ud.wings[1].rotation.z = 0.3 + f;
    }
  }
  state.quackTimer -= dt;
  if (state.quackTimer < 0) {
    state.quackTimer = 7 + Math.random() * 9;
    if (state.started) audio.quack(Math.random() < 0.5 ? 1 : 1.6);
  }

  // monkeys
  for (const m of monkeys) {
    const um = m.userData;
    let rot = Math.sin(elapsed * 1.7 + um.phase) * 0.4;
    if (um.spin > 0) {
      um.spin = Math.max(0, um.spin - dt * 1.3);
      rot += (1 - um.spin) * Math.PI * 2;
    }
    m.rotation.z = rot;
  }

  // clouds drift
  for (const c of clouds) {
    c.position.x += c.userData.v * dt;
    if (c.position.x > 170) c.position.x = -170;
  }

  updateCamera(dt, elapsed);
}

// ============================================================ boot
const startIdx = Math.max(0, TRAINS.findIndex(t => t.id === (PARAMS.get('train') || 'choochoo')));
setTrain(startIdx === -1 ? 0 : startIdx);
if (PARAMS.has('cam')) state.camMode = +PARAMS.get('cam') % 3;
refreshGoBtn();
if (PARAMS.has('warp')) {           // fast-forward for automated screenshots
  state.started = true;
  for (let i = 0; i < +PARAMS.get('warp') * 30; i++) step(1 / 30);
}
tick();

const splash = $('splash');
function start() {
  if (state.started) return;
  state.started = true;
  audio.init();
  audio.resume();
  splash.style.display = 'none';
  const def = consist.def;
  showBanner(def.name + '!', def.fact);
  audio.horn(def.horn);
  audio.setLoop(consist.type === 'steam' ? 'steam' : consist.type);
}
splash.addEventListener('pointerdown', start);
if (PARAMS.has('nosplash')) {        // for automated screenshots
  splash.style.display = 'none';
  state.started = true;
}
