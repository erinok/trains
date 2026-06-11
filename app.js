/* CHOO CHOO WORLD — a three.js train set for a small engineer.
   Bidirectional track network with six animated switches, trains at real top
   speeds (spawnable in either direction — head-on crashes!), a double-leaf
   drawbridge Choo Choo jumps, and four regions to explore. */
'use strict';

const PARAMS = new URLSearchParams(location.search);
// debug bisection: ?hide=tints,patches,water,shadows turns scene layers off
const DEBUG_HIDE = new Set((PARAMS.get('hide') || '').split(','));
const UP = new THREE.Vector3(0, 1, 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const RAIL_Y = 0.3;             // rail top above track centerline
const SCALE = 0.15;             // world units per second, per mph — engines are
                                // ~2.5 m/unit, so true scale is 1 mph ≈ 0.18 u/s;
                                // 0.15 keeps top speeds quick but watchable
const DECEL = 24;               // braking, u/s^2 (accel is gentler, see updateTrain)
const PTS_LEN = 16;             // length of the movable switch-points track

// ============================================================ renderer / scene
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fdcf7);
scene.fog = new THREE.Fog(0x9fdcf7, 180, 520);

// near plane at 0.5 keeps the depth buffer precise enough that ground
// decals (grass tints, water, ballast) never z-fight in Safari
const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 1100);
camera.position.set(0, 120, 150);

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

scene.add(new THREE.HemisphereLight(0xcfe9ff, 0x69aa55, 0.85));
const sun = new THREE.DirectionalLight(0xfff2d4, 1.05);
sun.position.set(120, 170, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = -175; sun.shadow.camera.right = 175;
sun.shadow.camera.top = 175; sun.shadow.camera.bottom = -175;
sun.shadow.camera.far = 520;
sun.shadow.bias = -0.0005;
if (DEBUG_HIDE.has('shadows')) sun.castShadow = false;
scene.add(sun);

// ============================================================ small helpers
const _dummy = new THREE.Object3D();
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

function emojiTexture(emoji, size) {
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = 128;
  const ctx = cnv.getContext('2d');
  ctx.fillStyle = '#fff6dd';
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 7; ctx.strokeStyle = '#8a5a2b'; ctx.stroke();
  ctx.font = (size || 64) + 'px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 70);
  return new THREE.CanvasTexture(cnv);
}
function keyTexture(letter) {
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = 96;
  const ctx = cnv.getContext('2d');
  ctx.fillStyle = '#2a5fa3';
  ctx.beginPath();
  const r = 18;
  ctx.moveTo(r, 4); ctx.lineTo(92 - r, 4); ctx.quadraticCurveTo(92, 4, 92, 4 + r);
  ctx.lineTo(92, 92 - r); ctx.quadraticCurveTo(92, 92, 92 - r, 92);
  ctx.lineTo(r, 92); ctx.quadraticCurveTo(4, 92, 4, 92 - r);
  ctx.lineTo(4, 4 + r); ctx.quadraticCurveTo(4, 4, r, 4);
  ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 56px "Chalkboard SE","Comic Sans MS",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(letter, 48, 52);
  return new THREE.CanvasTexture(cnv);
}
function textTexture(text) {
  const cnv = document.createElement('canvas');
  cnv.width = 512; cnv.height = 128;
  const ctx = cnv.getContext('2d');
  ctx.fillStyle = '#fff6dd';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 118);
  ctx.fillStyle = '#27466b';
  ctx.font = 'bold 88px "Chalkboard SE","Comic Sans MS",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  return new THREE.CanvasTexture(cnv);
}
function namePlate(text, w, h) {
  const plain = mat(0x6b4a2a);
  const texed = new THREE.MeshStandardMaterial({ map: textTexture(text) });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, w),
    [texed, texed, plain, plain, plain, plain]);
  m.castShadow = false;
  return m;
}

// ============================================================ the track network
// Six switches. Every node has a single "trunk" leg on one side and one or
// two "branch" legs on the other; the switch chooses the branch. Trains can
// run either direction, so former merge points are real switches too.
//
//      N1 ━━ A (pond) ━━━━━━━ N2
//      ┃  ┗━ AMT (mountains) ━┛┃
//      D2                      B1
//      ┃                       ┃
//      N5 ━━━━━ MID ━━━━━━━━━ N6
//      ┃                       ┃
//      D1                      B2
//      ┃  ┏━ C (meadow) ━━━━┓  ┃
//      N4 ━━ CHB (harbor) ━━━ N3
const NODES = {
  N1: { pos: V(-75, 0, -48), dir: V(0.707, 0, -0.707), key: 'Q', sel: 0,
        trunk: { seg: 'D2', end: 'to' }, branches: [{ seg: 'A', end: 'from' }, { seg: 'AMT', end: 'from' }] },
  N2: { pos: V(75, 0, -48), dir: V(0.707, 0, 0.707), key: 'W', sel: 0,
        trunk: { seg: 'B1', end: 'from' }, branches: [{ seg: 'A', end: 'to' }, { seg: 'AMT', end: 'to' }] },
  N3: { pos: V(75, 0, 48), dir: V(-0.707, 0, 0.707), key: 'E', sel: 0,
        trunk: { seg: 'B2', end: 'to' }, branches: [{ seg: 'C', end: 'from' }, { seg: 'CHB', end: 'from' }] },
  N4: { pos: V(-75, 0, 48), dir: V(-0.707, 0, -0.707), key: 'R', sel: 0,
        trunk: { seg: 'D1', end: 'from' }, branches: [{ seg: 'C', end: 'to' }, { seg: 'CHB', end: 'to' }] },
  N5: { pos: V(-95, 0, 0), dir: V(0, 0, -1), key: 'T', sel: 0,
        trunk: { seg: 'D1', end: 'to' }, branches: [{ seg: 'D2', end: 'from' }, { seg: 'MID', end: 'from' }] },
  N6: { pos: V(95, 0, 0), dir: V(0, 0, 1), key: 'Y', sel: 0,
        trunk: { seg: 'B2', end: 'from' }, branches: [{ seg: 'B1', end: 'to' }, { seg: 'MID', end: 'to' }] },
};
const SEG_DEFS = {
  A:   { from: 'N1', to: 'N2', mids: [[-48, 0, -62.5], [-20, 0, -66], [10, 0, -66], [38, 0, -62]] },
  AMT: { from: 'N1', to: 'N2', mids: [[-54, 0, -70], [-34, 0, -86], [-12, 0, -95], [12, 0, -95], [34, 0, -86], [54, 0, -70]] },
  B1:  { from: 'N2', to: 'N6', mids: [[90, 0, -30], [95, 0, -16]] },
  B2:  { from: 'N6', to: 'N3', mids: [[95, 0, 16], [90, 0, 30]] },
  C:   { from: 'N3', to: 'N4', mids: [[48, 0, 62.5], [20, 0, 66], [-20, 0, 66], [-48, 0, 62.5]] },
  CHB: { from: 'N3', to: 'N4', mids: [[52, 0, 70], [36, 0, 81], [24, 0.9, 87.5], [10, 2.6, 93], [-10, 2.6, 95], [-24, 0.9, 89], [-38, 0, 81], [-52, 0, 70]] },
  D1:  { from: 'N4', to: 'N5', mids: [[-90, 0, 30], [-95, 0, 16]] },
  D2:  { from: 'N5', to: 'N1', mids: [[-95, 0, -16], [-90, 0, -30]] },
  MID: { from: 'N5', to: 'N6', mids: [[-90, 0, -20], [-80, 0, -27], [-62, 0, -31], [-40, 0, -33], [-20, 0, -33], [0, 0, -32], [20, 0, -33], [40, 0, -33], [62, 0, -31], [80, 0, -27], [90, 0, -20]] },
};
const SEGS = {};
for (const id in SEG_DEFS) {
  const d = SEG_DEFS[id];
  const a = NODES[d.from], b = NODES[d.to];
  // double lead points at each end pin the tangent so turnouts leave straight
  const pts = [
    a.pos.clone(),
    a.pos.clone().addScaledVector(a.dir, 5),
    a.pos.clone().addScaledVector(a.dir, 11),
    ...d.mids.map(m => V(m[0], m[1], m[2])),
    b.pos.clone().addScaledVector(b.dir, -11),
    b.pos.clone().addScaledVector(b.dir, -5),
    b.pos.clone(),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const len = curve.getLength();
  const samples = [];
  for (let i = 0; i <= 300; i++) samples.push(curve.getPointAt(i / 300));
  SEGS[id] = { id, curve, len, samples, from: d.from, to: d.to, gaps: [] };
}
function segPoint(seg, s) {
  const u = THREE.MathUtils.clamp(s / seg.len, 0, 1);
  return seg.curve.getPointAt(u);
}
function segTangent(seg, s) {
  const u = THREE.MathUtils.clamp(s / seg.len, 0, 1);
  return seg.curve.getTangentAt(u);
}
function nearestOnSeg(seg, x, z) {
  let best = 0, bd = 1e9;
  for (let i = 0; i < seg.samples.length; i++) {
    const p = seg.samples[i];
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return { s: (best / (seg.samples.length - 1)) * seg.len, p: seg.samples[best].clone() };
}
const ALL_TRACK_PTS = [];
for (const id in SEGS) for (let i = 0; i < SEGS[id].samples.length; i += 4) ALL_TRACK_PTS.push(SEGS[id].samples[i]);

// ---- the drawbridge gap on CHB
const HARBOR = SEGS.CHB;
let gapS0 = 0, gapS1 = 0;
{
  let s0 = -1, s1 = -1;
  for (let i = 0; i < 700; i++) {
    const s = (i / 700) * HARBOR.len;
    const x = segPoint(HARBOR, s).x;
    if (s0 < 0 && x < 4.5) s0 = s;
    if (s0 >= 0 && s1 < 0 && x < -4.5) { s1 = s; break; }
  }
  gapS0 = s0; gapS1 = s1;
  HARBOR.gaps.push([gapS0, gapS1]);
}
// ---- gaps where the movable switch points live (every branch leg)
for (const nid in NODES) {
  for (const leg of NODES[nid].branches) {
    const seg = SEGS[leg.seg];
    seg.gaps.push(leg.end === 'from' ? [0, PTS_LEN] : [seg.len - PTS_LEN, seg.len]);
  }
}
for (const id in SEGS) SEGS[id].gaps.sort((a, b) => a[0] - b[0]);

// ============================================================ track rendering
const sleeperGeo = new THREE.BoxGeometry(1.7, 0.1, 0.5);
const sleeperMat = mat(0x7a5230, { rough: 1 });
const railMat = mat(0x8e9aa6, { metal: 0.6, rough: 0.4 });
const ballastMat = mat(0x9b9486, { rough: 1 });

function ribbonGeometry(pts, halfW, yOff) {
  const n = pts.length;
  const pos = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const t = pts[Math.min(n - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
    const side = V(0, 0, 0).crossVectors(UP, t).normalize();
    const a = pts[i].clone().addScaledVector(side, halfW);
    const b = pts[i].clone().addScaledVector(side, -halfW);
    pos.set([a.x, a.y + yOff, a.z, b.x, b.y + yOff, b.z], i * 6);
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function railsFromPts(pts, group) {
  for (const sideOff of [-0.45, 0.45]) {
    const railPts = [];
    for (let i = 0; i < pts.length; i++) {
      const t = pts[Math.min(pts.length - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
      const side = V(0, 0, 0).crossVectors(UP, t).normalize();
      railPts.push(pts[i].clone().addScaledVector(side, sideOff).setY(pts[i].y + RAIL_Y - 0.07));
    }
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts, false), railPts.length * 2, 0.07, 6, false),
      railMat
    );
    rail.castShadow = false; rail.receiveShadow = true;
    group.add(rail);
  }
}

(function buildAllTrack() {
  const sleeperXforms = [];
  let segIdx = 0;
  for (const id in SEGS) {
    const seg = SEGS[id];
    const yLift = 0.12 + segIdx * 0.006;
    segIdx++;
    const runs = [];
    let start = 0;
    for (const [g0, g1] of seg.gaps) { runs.push([start, g0]); start = g1; }
    runs.push([start, seg.len]);

    for (const [r0, r1] of runs) {
      const runLen = r1 - r0;
      if (runLen < 1) continue;
      const N = Math.max(8, Math.ceil(runLen * 1.4));
      const pts = [];
      for (let i = 0; i <= N; i++) pts.push(segPoint(seg, r0 + (i / N) * runLen));
      const ballast = new THREE.Mesh(ribbonGeometry(pts, 1.55, yLift), ballastMat);
      ballast.receiveShadow = true;
      scene.add(ballast);
      const nS = Math.floor(runLen / 1.3);
      for (let i = 0; i <= nS; i++) {
        const s = r0 + (i / nS) * runLen;
        const p = segPoint(seg, s), t = segTangent(seg, s);
        _dummy.position.set(p.x, p.y + yLift + 0.05, p.z);
        _dummy.lookAt(p.clone().add(t));
        _dummy.updateMatrix();
        sleeperXforms.push(_dummy.matrix.clone());
      }
      railsFromPts(pts, scene);
    }
    // trestle posts under raised track
    for (let s = 2; s < seg.len; s += 2.6) {
      if (seg.gaps.some(([g0, g1]) => s > g0 - 1 && s < g1 + 1)) continue;
      const p = segPoint(seg, s);
      if (p.y < 0.6) continue;
      const t = segTangent(seg, s);
      const side = V(0, 0, 0).crossVectors(UP, t).normalize();
      for (const so of [-0.9, 0.9]) {
        const post = box(0.28, p.y, 0.28, 0x9b6a3c, { rough: 1 });
        post.position.copy(p).addScaledVector(side, so).setY(p.y / 2);
        scene.add(post);
      }
      const beam = box(2.5, 0.22, 0.32, 0x8a5a2b);
      beam.position.set(p.x, p.y - 0.1, p.z);
      beam.lookAt(p.clone().add(t));
      scene.add(beam);
    }
  }
  const inst = new THREE.InstancedMesh(sleeperGeo, sleeperMat, sleeperXforms.length);
  sleeperXforms.forEach((m, i) => inst.setMatrixAt(i, m));
  inst.receiveShadow = true;
  scene.add(inst);
})();

// ============================================================ tappable registry
const tappables = [];
function tagTap(obj, kind, data) {
  obj.userData.tap = { kind, data };
  tappables.push(obj);
}

// ============================================================ switches (with moving points)
const switches = [];
function sampleLeg(leg, d) {
  const seg = SEGS[leg.seg];
  return leg.end === 'from' ? segPoint(seg, d) : segPoint(seg, seg.len - d);
}
function buildSwitch(nodeId) {
  const node = NODES[nodeId];
  const t = node.dir;
  const side = V(0, 0, 0).crossVectors(UP, t).normalize();
  const g = new THREE.Group();
  g.position.copy(node.pos).addScaledVector(side, 4.5);
  const post = cyl(0.14, 0.18, 2.0, 0x4a4f55);
  post.position.y = 1.0;
  g.add(post);
  const base = cyl(0.7, 0.8, 0.3, 0xf2c14e);
  base.position.y = 0.15;
  g.add(base);
  const arrow = new THREE.Group();
  const shaft = box(0.5, 0.22, 1.7, 0xf2c14e);
  shaft.position.z = 0.5;
  arrow.add(shaft);
  const head = cone(0.7, 1.0, 0xf2c14e, { seg: 4 });
  head.rotation.x = Math.PI / 2;
  head.rotation.y = Math.PI / 4;
  head.position.z = 1.85;
  arrow.add(head);
  arrow.position.y = 2.3;
  g.add(arrow);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: keyTexture(node.key), transparent: true }));
  label.scale.set(1.9, 1.9, 1);
  label.position.y = 4.2;
  g.add(label);
  scene.add(g);

  const ptsGroup = new THREE.Group();
  scene.add(ptsGroup);
  const sw = { node, arrow, g, yaw: 0, ptsGroup, t: node.sel, anim: null };
  sw.rebuildPoints = (tt) => {
    while (ptsGroup.children.length) {
      const ch = ptsGroup.children.pop();
      if (ch.geometry) ch.geometry.dispose();
    }
    const K = 14;
    const pts = [];
    for (let i = 0; i <= K; i++) {
      const d = (i / K) * PTS_LEN;
      pts.push(sampleLeg(node.branches[0], d).lerp(sampleLeg(node.branches[1], d), tt));
    }
    const ballast = new THREE.Mesh(ribbonGeometry(pts, 1.55, 0.11), ballastMat);
    ballast.receiveShadow = true;
    ptsGroup.add(ballast);
    for (let i = 0; i <= 9; i++) {
      const idx = Math.round((i / 9) * K);
      const p = pts[idx];
      const next = pts[Math.min(K, idx + 1)];
      const sl = new THREE.Mesh(sleeperGeo, sleeperMat);
      sl.position.set(p.x, p.y + 0.17, p.z);
      sl.lookAt(next.x, p.y + 0.17, next.z);
      sl.receiveShadow = true;
      ptsGroup.add(sl);
    }
    railsFromPts(pts, ptsGroup);
  };
  sw.rebuildPoints(node.sel);
  sw.aim = () => {
    const target = sampleLeg(node.branches[node.sel], PTS_LEN + 8);
    sw.yaw = Math.atan2(target.x - g.position.x, target.z - g.position.z);
  };
  sw.aim();
  arrow.rotation.y = sw.yaw;
  tagTap(g, 'switch', sw);
  switches.push(sw);
  return sw;
}
for (const nid of ['N1', 'N2', 'N3', 'N4', 'N5', 'N6']) buildSwitch(nid);
function toggleSwitch(sw) {
  sw.node.sel ^= 1;
  sw.aim();
  sw.anim = { from: sw.t, to: sw.node.sel, t01: 0 };
  audio.clunk();
  crashStragglers(sw.node);
}
// flipping the points under a moving train derails every car that hasn't
// traversed them yet — those cars cut loose, tumble, and pop
function crashStragglers(node) {
  for (const train of trains) {
    if (train.state !== 'run') continue;
    const tailOff = train.offsets[train.offsets.length - 1];
    let dist = train.u;                          // motion lead → boundary distance
    for (let k = train.hist.length - 1; k > 0 && dist < tailOff + PTS_LEN; k--) {
      const h = train.hist[k - 1];
      const bNode = h.dir > 0 ? NODES[h.seg.to] : NODES[h.seg.from];
      if (bNode === node) {
        if (tailOff > dist - PTS_LEN) cutLoose(train, dist - PTS_LEN);
        break;
      }
      dist += h.seg.len;
    }
  }
}
function cutLoose(train, minOff) {
  const cut = [];
  for (let k = train.vehicles.length - 1; k >= 0; k--) {
    if (train.offsets[k] > Math.max(minOff, 0.1)) {   // never the motion lead
      cut.push(train.vehicles[k]);
      train.vehicles.splice(k, 1);
      train.offsets.splice(k, 1);
    }
  }
  if (!cut.length) return;
  for (const v of cut) {
    const fwd = V(0, 0, 1).applyQuaternion(v.g.quaternion);
    if (train.flip) fwd.negate();
    setLoose(v, fwd.multiplyScalar(Math.max(train.v, 2) * 0.7)
      .add(V((Math.random() - 0.5) * 6, 4 + Math.random() * 3, (Math.random() - 0.5) * 6)));
  }
  boomAt(cut[0].g.position.clone().add(V(0, 1.2, 0)));
  audio.crash(Math.max(0.4, attAt(cut[0].g.position)));
  showBanner('💥', '#fff');
  tourEvent(cut[0].g.position);
}
function updateSwitches(dt) {
  for (const sw of switches) {
    let d = sw.yaw - sw.arrow.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    sw.arrow.rotation.y += d * Math.min(1, dt * 8);
    if (sw.anim) {
      sw.anim.t01 += dt / 0.45;
      if (sw.anim.t01 >= 1) {
        sw.t = sw.anim.to;
        sw.anim = null;
        sw.rebuildPoints(sw.t);
      } else {
        const e = sw.anim.t01 * sw.anim.t01 * (3 - 2 * sw.anim.t01);
        sw.rebuildPoints(THREE.MathUtils.lerp(sw.anim.from, sw.anim.to, e));
      }
    }
  }
}

// ============================================================ the drawbridge (two leaves)
const bridge = { up: false, angle: 0, maxAngle: 0.95, leaves: [], lamps: [], sides: [], creakT: 0 };
(function buildDrawbridge() {
  const p0 = segPoint(HARBOR, gapS0);
  const p1 = segPoint(HARBOR, gapS1);
  const pm = segPoint(HARBOR, (gapS0 + gapS1) / 2);
  bridge.mid = pm.clone();
  for (const hingeP of [p0, p1]) {
    const chord = pm.clone().sub(hingeP).setY(0).normalize();
    const len = hingeP.distanceTo(pm) + 0.3;
    bridge.sides.push({ hinge: hingeP.clone(), chord, len });
    const leaf = new THREE.Group();
    leaf.position.copy(hingeP).setY(hingeP.y + 0.05);
    leaf.lookAt(pm.clone().setY(hingeP.y + 0.05));
    const deck = box(2.7, 0.26, len, 0x8a5a2b);
    deck.position.z = len / 2;
    leaf.add(deck);
    for (const xx of [-1.2, 1.2]) {
      const girder = box(0.18, 0.7, len, 0xc0392b);
      girder.position.set(xx, 0.4, len / 2);
      leaf.add(girder);
    }
    for (const xx of [-0.45, 0.45]) {
      const r = box(0.12, 0.1, len, 0x8e9aa6, { metal: 0.6, rough: 0.4, shadow: false });
      r.position.set(xx, 0.25, len / 2);
      leaf.add(r);
    }
    leaf.userData.baseQ = leaf.quaternion.clone();   // hinge axis = leaf-local X
    scene.add(leaf);
    bridge.leaves.push(leaf);
    tagTap(leaf, 'bridge', null);
  }
  // a tower at each hinge with go/stop lamps
  [[p0, gapS0, 1], [p1, gapS1, -1]].forEach(([hingeP, s, sideSign]) => {
    const t = segTangent(HARBOR, s);
    const side = V(0, 0, 0).crossVectors(UP, t).normalize();
    const tower = new THREE.Group();
    tower.position.copy(hingeP).addScaledVector(side, 2.6 * sideSign).setY(0);
    const legs = box(1.2, 7.6, 1.2, 0x6b7077);
    legs.position.y = 3.8;
    tower.add(legs);
    const cab = box(1.7, 1.2, 1.7, 0xc0392b);
    cab.position.y = 8.0;
    tower.add(cab);
    const roof = cone(1.4, 0.9, 0x7a241a, { seg: 4 });
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 9.0;
    tower.add(roof);
    const lampUp = sph(0.3, 0xe74c3c, { shadow: false });
    lampUp.material.emissive = new THREE.Color(0xe74c3c);
    lampUp.material.emissiveIntensity = 0;
    lampUp.position.set(-0.95, 7.0, 0);
    tower.add(lampUp);
    const lampDown = sph(0.3, 0x2ecc71, { shadow: false });
    lampDown.material.emissive = new THREE.Color(0x2ecc71);
    lampDown.material.emissiveIntensity = 0.9;
    lampDown.position.set(0.95, 7.0, 0);
    tower.add(lampDown);
    scene.add(tower);
    tagTap(tower, 'bridge', null);
    bridge.lamps.push({ up: lampUp, down: lampDown });
  });
})();
function setBridge(up) {
  if (bridge.up === up) return;
  bridge.up = up;
  document.getElementById('bridgeBtn').classList.toggle('up', up);
  audio.clunk();
}
function bridgeIsDown() { return bridge.angle < 0.04; }
function updateBridge(dt) {
  const target = bridge.up ? bridge.maxAngle : 0;
  const before = bridge.angle;
  bridge.angle = THREE.MathUtils.damp(bridge.angle, target, 2.2, dt);
  if (Math.abs(bridge.angle - target) < 0.01) bridge.angle = target;
  for (const leaf of bridge.leaves) {
    // rotate about the leaf's LOCAL x (the hinge), so each half pitches up
    // along the axis of travel and the two tips part at the center
    leaf.quaternion.copy(leaf.userData.baseQ);
    leaf.rotateX(-bridge.angle);
  }
  if (Math.abs(before - bridge.angle) > 0.0004) {
    bridge.creakT -= dt;
    if (bridge.creakT <= 0) { bridge.creakT = 0.33; audio.creak(); }
  }
  for (const l of bridge.lamps) {
    l.up.material.emissiveIntensity = bridgeIsDown() ? 0 : 0.9;
    l.down.material.emissiveIntensity = bridgeIsDown() ? 0.9 : 0;
  }
}
function leafDirOf(side) {   // direction up a leaf at the current angle
  const ch = bridge.sides[side].chord;
  const a = bridge.angle;
  return V(ch.x * Math.cos(a), Math.sin(a), ch.z * Math.cos(a)).normalize();
}
function leafPoint(side, d) {
  return bridge.sides[side].hinge.clone().addScaledVector(leafDirOf(side), d).add(V(0, RAIL_Y + 0.07, 0));
}

// ============================================================ ground & sky
const ground = mesh(new THREE.CircleGeometry(360, 48), 0x7cc25e, { shadow: false, rough: 1 });
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
// region tints (height-separated for Safari, plus polygonOffset so distant
// grazing-angle views don't z-fight the ground when depth precision runs out)
// gentle offsets: enough to win against the ground and the decal one level
// down, small enough never to overtake real geometry (ducks float at ~0.1u)
function liftDecal(m, level) {
  m.material.polygonOffset = true;
  m.material.polygonOffsetFactor = -(1 + level * 0.2);
  m.material.polygonOffsetUnits = -2 * level;
  return m;
}
// every decal gets its OWN polygonOffset level and height: same-level decals
// that overlap (pond tint vs mountain tint, patch vs patch) z-fight at distance
if (!DEBUG_HIDE.has('tints')) {
  [
    [0, 60, 42, 0x8cca6a],
    [0, -90, 48, 0x5e9e50],
    [2, 110, 34, 0xd9c693],
    [-22, -66, 22, 0x86c767],
  ].forEach(([x, z, r, c], i) => {
    const patch = liftDecal(mesh(new THREE.CircleGeometry(r, 36), c, { shadow: false, rough: 1 }), 1 + i);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(x, 0.04 + i * 0.005, z);
    scene.add(patch);
  });
}
if (!DEBUG_HIDE.has('patches')) {
  for (let i = 0; i < 12; i++) {
    // the 12 spots never overlap one another, so they can share one level
    const patch = liftDecal(mesh(new THREE.CircleGeometry(4 + (i % 4) * 3, 20), i % 2 ? 0x74b857 : 0x83c968, { shadow: false, rough: 1 }), 5);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(Math.sin(i * 2.4) * 100, 0.065 + (i % 8) * 0.005, Math.cos(i * 1.7) * 75);
    scene.add(patch);
  }
}
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2 + 0.3;
  const h = sph(34, i % 2 ? 0x6fb35f : 0x60a854, { shadow: false, rough: 1 });
  h.scale.set(1.7, 0.5, 1.1);
  h.position.set(Math.cos(a) * 265, -2, Math.sin(a) * 265);
  scene.add(h);
}
const sunBall = sph(8, 0xfff1a8, { shadow: false });
sunBall.material.emissive = new THREE.Color(0xffe680);
sunBall.material.emissiveIntensity = 0.9;
sunBall.position.set(210, 150, 100);
scene.add(sunBall);
const clouds = [];
for (let i = 0; i < 11; i++) {
  const c = new THREE.Group();
  const n = 3 + (i % 3);
  for (let j = 0; j < n; j++) {
    const s = sph(3.5 + (j % 3), 0xffffff, { shadow: false, rough: 1 });
    s.scale.y = 0.6;
    s.position.set(j * 3.8 - n * 1.6, (j % 2) * 0.8, (j % 2) * 1.8 - 0.9);
    c.add(s);
  }
  c.position.set(-250 + i * 50, 52 + (i % 3) * 10, -120 + (i * 67) % 240);
  c.userData.v = 1.1 + (i % 3) * 0.5;
  clouds.push(c);
  scene.add(c);
}
for (const [x, z, r, h] of [[-52, -124, 19, 30], [0, -134, 26, 42], [46, -122, 17, 28], [-90, -110, 14, 22]]) {
  const m = cone(r, h, 0x5d8f57, { rough: 1 });
  m.position.set(x, h / 2 - 0.5, z);
  scene.add(m);
  const snow = cone(r * 0.34, h * 0.32, 0xf5f7fa, { rough: 1 });
  snow.position.set(x, h - h * 0.16 - 0.5, z);
  scene.add(snow);
}
for (const [x, z, s] of [[-64, -94, 1.6], [-30, -106, 2.2], [12, -110, 1.4], [48, -98, 1.9], [66, -78, 1.2]]) {
  const rock = sph(s, 0x8d9298, { rough: 1, seg: 7 });
  rock.scale.set(1.3, 0.7, 1);
  rock.position.set(x, s * 0.4, z);
  rock.rotation.y = x;
  scene.add(rock);
}

// ============================================================ scenery helpers
function clearOfTrack(x, z, margin) {
  for (const p of ALL_TRACK_PTS) {
    if ((p.x - x) ** 2 + (p.z - z) ** 2 < margin * margin) return false;
  }
  if ((x - pondCenter.x) ** 2 + (z - pondCenter.z) ** 2 < 13 * 13) return false;
  if (Math.abs(x) < 8 && z > 68) return false;
  if (x > 0 && x < 16 && z > 100 && z < 132) return false;
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

// ============================================================ pond & ducks
const pondCenter = nearestOnSeg(SEGS.A, -20, -66).p;
const ducks = [];
(function buildPond() {
  const at = nearestOnSeg(SEGS.A, pondCenter.x, pondCenter.z);
  const t = segTangent(SEGS.A, at.s);
  const side = V(0, 0, 0).crossVectors(UP, t).normalize();
  const water = liftDecal(mesh(new THREE.CircleGeometry(8, 36), 0x3fa9e0, { shadow: false, rough: 0.25, metal: 0.1 }), 6);
  water.rotation.x = -Math.PI / 2;
  water.position.set(pondCenter.x, 0.08, pondCenter.z);
  water.scale.set(1.4, 1, 1);
  scene.add(water);
  const rim = liftDecal(mesh(new THREE.RingGeometry(8, 9.1, 36), 0xe8d8a8, { shadow: false, rough: 1 }), 7);
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(pondCenter.x, 0.1, pondCenter.z);
  rim.scale.set(1.4, 1, 1);
  scene.add(rim);
  for (let i = 0; i < 9; i++) {
    const a = i * 0.8 + 0.5;
    const rx = pondCenter.x + Math.cos(a) * (10.5 + (i % 3));
    const rz = pondCenter.z + Math.sin(a) * (8 + (i % 2));
    if (!clearOfTrack(rx, rz, 2.5)) continue;
    const stem = cyl(0.05, 0.05, 1.6, 0x4f8f3f, { shadow: false });
    stem.position.set(rx, 0.8, rz);
    stem.rotation.z = Math.sin(a) * 0.1;
    scene.add(stem);
    const tip = cyl(0.09, 0.09, 0.5, 0x7a5230, { shadow: false });
    tip.position.set(rx, 1.7, rz);
    scene.add(tip);
  }
  const bg = new THREE.Group();
  bg.position.copy(at.p);
  bg.lookAt(at.p.clone().add(t));
  for (const xx of [-1.25, 1.25]) {
    const wall = box(0.25, 0.8, 10, 0xc0392b);
    wall.position.set(xx, 0.5, 0);
    bg.add(wall);
    for (const zz of [-4, -1.3, 1.3, 4]) {
      const post = box(0.32, 1.2, 0.32, 0xa93226);
      post.position.set(xx, 0.1, zz);
      bg.add(post);
    }
  }
  scene.add(bg);

  function makeDuck(scale, bodyC) {
    const d = new THREE.Group();
    const body = sph(0.5, bodyC);
    body.scale.set(0.85, 0.7, 1.2);
    body.position.y = 0.3;
    d.add(body);
    const head = sph(0.28, bodyC);
    head.position.set(0, 0.78, 0.42);
    d.add(head);
    const beak = cone(0.1, 0.3, 0xff8c1a, { seg: 10 });
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
    d.userData.anim = { wings, flap: 0 };
    return d;
  }
  const flock = [
    { c: 4.5, r: 2.0, w: 0.55, s: 1.0, col: 0xffffff },
    { c: 4.5, r: 2.9, w: 0.7, s: 0.55, col: 0xffd24a },
    { c: 4.5, r: 2.9, w: 0.7, s: 0.55, col: 0xffd24a, ph: 2.1 },
    { c: -5, r: 1.5, w: -0.8, s: 0.55, col: 0xffd24a },
  ];
  for (const f of flock) {
    const duck = makeDuck(f.s, f.col);
    const a = duck.userData.anim;
    a.center = pondCenter.clone().addScaledVector(side, f.c);
    a.r = f.r;
    a.w = f.w;
    a.a = f.ph || Math.PI * (f.r + f.c);
    scene.add(duck);
    ducks.push(duck);
    tagTap(duck, 'duck', duck);
  }
})();

// ============================================================ tunnels
function buildTunnelAt(seg, tx, tz) {
  const at = nearestOnSeg(seg, tx, tz);
  const half = 5.5;
  const tubePts = [];
  for (let i = 0; i <= 12; i++) {
    const s = at.s - half + (i / 12) * half * 2;
    const q = segPoint(seg, s);
    tubePts.push(q.clone().setY(q.y + 1.5));
  }
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tubePts, false), 24, 2.3, 18, false),
    new THREE.MeshStandardMaterial({ color: 0x5c554e, roughness: 1, side: THREE.DoubleSide })
  );
  tube.receiveShadow = true;
  scene.add(tube);
  for (const s of [at.s - half, at.s + half]) {
    const f = segPoint(seg, s), t = segTangent(seg, s);
    const ring = cyl(2.6, 2.6, 0.7, 0xb0a294, { axis: 'z', seg: 24 });
    ring.position.set(f.x, f.y + 1.5, f.z);
    ring.lookAt(ring.position.clone().add(t));
    scene.add(ring);
  }
  const lamp = new THREE.PointLight(0xffd9a0, 0.8, 14);
  lamp.position.set(at.p.x, 2.4, at.p.z);
  scene.add(lamp);
  const t = segTangent(seg, at.s);
  const hill = sph(5, 0x4f9d4a, { rough: 1 });
  hill.scale.set(1.5, 0.92, 0.8);
  const m = new THREE.Matrix4().lookAt(at.p, at.p.clone().add(t), UP);
  hill.quaternion.setFromRotationMatrix(m);
  hill.position.copy(at.p);
  scene.add(hill);
  return at.p;
}
const tunnelWest = buildTunnelAt(SEGS.AMT, -30, -88);
const tunnelEast = buildTunnelAt(SEGS.AMT, 30, -88);

// ============================================================ canal & harbor
const barge = new THREE.Group();
const lighthouse = new THREE.Group();
(function buildHarbor() {
  const water = liftDecal(mesh(new THREE.PlaneGeometry(7, 70), 0x3fa9e0, { shadow: false, rough: 0.25, metal: 0.1 }), 6);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.08, 107);
  scene.add(water);
  for (const xx of [-3.9, 3.9]) {
    const bank = box(0.9, 0.35, 70, 0xb0a294, { rough: 1 });
    bank.position.set(xx, 0.17, 107);
    scene.add(bank);
  }
  barge.position.set(bridge.mid.x, 0, bridge.mid.z + 0.5);
  const hull = box(3.1, 1.0, 6.2, 0x6b4a2a);
  hull.position.y = 0.5;
  barge.add(hull);
  const rim = box(3.3, 0.22, 6.4, 0x8a5a2b);
  rim.position.y = 1.05;
  barge.add(rim);
  const coal = sph(1.1, 0x17191c);
  coal.scale.set(1.2, 0.55, 1.6);
  coal.position.set(0, 1.25, -1.6);
  barge.add(coal);
  scene.add(barge);
  const tug = new THREE.Group();
  const thull = box(1.6, 0.8, 3.2, 0xc0392b);
  thull.position.y = 0.45;
  tug.add(thull);
  const tcab = box(1.1, 0.9, 1.2, 0xf5f1e6);
  tcab.position.set(0, 1.25, -0.4);
  tug.add(tcab);
  const tstack = cyl(0.16, 0.2, 0.9, 0x2a2d31);
  tstack.position.set(0, 1.9, -1.0);
  tug.add(tstack);
  tug.position.set(0, 0, 122);
  scene.add(tug);
  barge.userData.tug = tug;
  const dock = box(6, 0.6, 12, 0xd9c49a);
  dock.position.set(8.5, 0.3, 116);
  scene.add(dock);
  for (const [cx, cz, cs] of [[7, 112, 1.1], [9.5, 113, 0.9], [8, 119, 1.3], [10.5, 120, 0.8]]) {
    const crate = box(cs, cs, cs, 0xb3702d);
    crate.position.set(cx, 0.6 + cs / 2, cz);
    crate.rotation.y = cx + cz;
    scene.add(crate);
  }
  const cranePost = cyl(0.22, 0.3, 5.5, 0xf2c14e);
  cranePost.position.set(11.5, 2.75, 118);
  scene.add(cranePost);
  const jib = box(0.35, 0.35, 6.5, 0xf2c14e);
  jib.position.set(9.2, 5.4, 118);
  jib.rotation.y = Math.PI / 2;
  jib.rotation.z = 0.2;
  scene.add(jib);
  const rope = cyl(0.04, 0.04, 2.4, 0x2a2d31, { shadow: false });
  rope.position.set(6.5, 3.9, 118);
  scene.add(rope);
  const hook = box(0.5, 0.4, 0.5, 0x6b7077);
  hook.position.set(6.5, 2.5, 118);
  scene.add(hook);
  lighthouse.position.set(-9, 0, 134);
  for (let i = 0; i < 5; i++) {
    const ring = cyl(1.5 - i * 0.16, 1.66 - i * 0.16, 1.9, i % 2 ? 0xf5f1e6 : 0xe05d4b);
    ring.position.y = 0.95 + i * 1.9;
    lighthouse.add(ring);
  }
  const cap = cyl(0.95, 0.95, 1.4, 0x37474f);
  cap.position.y = 10.2;
  lighthouse.add(cap);
  const glass = cyl(0.7, 0.7, 1.0, 0xfff2ae, { shadow: false });
  glass.material.emissive = new THREE.Color(0xffe680);
  glass.material.emissiveIntensity = 0.6;
  glass.position.y = 10.0;
  lighthouse.add(glass);
  const beacon = box(0.3, 0.5, 2.6, 0xfff2ae, { shadow: false });
  beacon.material.emissive = new THREE.Color(0xffe680);
  beacon.material.emissiveIntensity = 0.9;
  beacon.position.y = 10.0;
  lighthouse.add(beacon);
  lighthouse.userData.beacon = beacon;
  const lroof = cone(1.1, 1.1, 0xc0392b);
  lroof.position.y = 11.4;
  lighthouse.add(lroof);
  scene.add(lighthouse);
})();

// ============================================================ windmill, farm, orchard
const windmill = new THREE.Group();
(function buildMeadow() {
  windmill.position.set(-12, 0, 48);
  const tower = cyl(1.1, 1.9, 7.5, 0xf5ecd7);
  tower.position.y = 3.75;
  windmill.add(tower);
  const wroof = cone(1.35, 1.6, 0xc0392b);
  wroof.position.y = 8.3;
  windmill.add(wroof);
  const door = box(0.8, 1.4, 0.2, 0x7a4a2b);
  door.position.set(0, 0.7, 1.78);
  windmill.add(door);
  const sails = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const sail = box(0.55, 4.4, 0.08, 0xfaf6ea);
    sail.position.y = 2.4;
    const holder = new THREE.Group();
    holder.rotation.z = (i / 4) * Math.PI * 2;
    holder.add(sail);
    const frame = box(0.1, 4.6, 0.12, 0x8a5a2b);
    frame.position.set(-0.36, 2.4, 0);
    holder.add(frame);
    sails.add(holder);
  }
  const hub = cyl(0.3, 0.3, 0.5, 0x8a5a2b, { axis: 'z' });
  sails.add(hub);
  sails.position.set(0, 7.4, 1.5);
  windmill.add(sails);
  windmill.userData.sails = sails;
  scene.add(windmill);
})();

const cows = [];
(function buildFarm() {
  const barn = new THREE.Group();
  barn.position.set(-114, 0, 4);
  barn.rotation.y = 0.5;
  const body = box(6.5, 4.2, 8, 0xb33939);
  body.position.y = 2.1;
  barn.add(body);
  for (const s of [-1, 1]) {
    const slope = box(4.2, 0.25, 8.4, 0x7a241a);
    slope.position.set(s * 1.7, 5.0, 0);
    slope.rotation.z = -s * 0.5;
    barn.add(slope);
  }
  const barnDoor = box(2.2, 2.6, 0.2, 0xf5ecd7);
  barnDoor.position.set(0, 1.3, 4.05);
  barn.add(barnDoor);
  for (const s of [-1, 1]) {
    const trim = box(0.3, 2.6, 0.25, 0x7a241a);
    trim.position.set(s * 1.1, 1.3, 4.1);
    barn.add(trim);
  }
  scene.add(barn);
  const fencePts = [[-120, 14], [-102, 14], [-102, 26], [-120, 26]];
  for (let i = 0; i < fencePts.length; i++) {
    const a = V(fencePts[i][0], 0, fencePts[i][1]);
    const b = V(fencePts[(i + 1) % fencePts.length][0], 0, fencePts[(i + 1) % fencePts.length][1]);
    const segs = Math.round(a.distanceTo(b) / 3);
    for (let j = 0; j <= segs; j++) {
      const p = a.clone().lerp(b, j / segs);
      const post = box(0.18, 1.2, 0.18, 0xd9c49a);
      post.position.set(p.x, 0.6, p.z);
      scene.add(post);
    }
    const railLen = a.distanceTo(b);
    for (const y of [0.55, 0.95]) {
      const rail = box(0.1, 0.12, railLen, 0xd9c49a);
      rail.position.copy(a.clone().lerp(b, 0.5)).setY(y);
      rail.lookAt(b.clone().setY(y));
      scene.add(rail);
    }
  }
  function makeCow(x, z, rot) {
    const c = new THREE.Group();
    c.position.set(x, 0, z);
    c.rotation.y = rot;
    const body = sph(0.9, 0xf5f1e6);
    body.scale.set(0.85, 0.8, 1.4);
    body.position.y = 1.05;
    c.add(body);
    for (const [px, py, pz] of [[0.3, 1.3, 0.5], [-0.35, 1.0, -0.45], [0.1, 1.35, -0.7]]) {
      const patch = sph(0.32, 0x2a2d31);
      patch.scale.set(1, 0.7, 1);
      patch.position.set(px, py, pz);
      c.add(patch);
    }
    const head = box(0.55, 0.6, 0.6, 0xf5f1e6);
    head.position.set(0, 1.5, 1.35);
    c.add(head);
    const muzzle = box(0.45, 0.3, 0.25, 0xf0c4c4);
    muzzle.position.set(0, 1.3, 1.65);
    c.add(muzzle);
    for (const s of [-1, 1]) {
      const ear = box(0.3, 0.12, 0.18, 0xf5f1e6);
      ear.position.set(s * 0.42, 1.7, 1.3);
      c.add(ear);
      const eye = sph(0.05, 0x222222, { shadow: false });
      eye.position.set(s * 0.16, 1.6, 1.62);
      c.add(eye);
    }
    for (const [lx, lz] of [[-0.4, 0.7], [0.4, 0.7], [-0.4, -0.7], [0.4, -0.7]]) {
      const leg = cyl(0.12, 0.1, 0.9, 0xf5f1e6);
      leg.position.set(lx, 0.45, lz);
      c.add(leg);
    }
    const tail = cyl(0.05, 0.05, 0.9, 0xf5f1e6, { shadow: false });
    tail.position.set(0, 1.2, -1.25);
    tail.rotation.x = 0.5;
    c.add(tail);
    scene.add(c);
    cows.push(c);
    tagTap(c, 'cow', c);
  }
  makeCow(-114, 18, 0.7);
  makeCow(-107, 22, -1.8);
  makeCow(-110, 16, 2.6);
})();

(function buildOrchard() {
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 4; i++) {
      const x = 105 + r * 5.5;
      const z = -16 + i * 9 + (r % 2) * 3;
      const t = new THREE.Group();
      t.position.set(x, 0, z);
      const trunk = cyl(0.16, 0.22, 1.3, 0x7a5230);
      trunk.position.y = 0.65;
      t.add(trunk);
      const blob = sph(1.15, 0x3da34f);
      blob.position.y = 2.0;
      t.add(blob);
      for (let a = 0; a < 4; a++) {
        const apple = sph(0.12, 0xe04444, { shadow: false });
        apple.position.set(Math.cos(a * 1.9 + x) * 0.95, 2.0 + Math.sin(a * 2.6) * 0.6, Math.sin(a * 1.9 + x) * 0.95);
        t.add(apple);
      }
      scene.add(t);
    }
  }
})();

// ============================================================ stations
const STATIONS = [
  { emoji: '🦆', seg: SEGS.A, target: [10, -66], color: 0xe05d4b },
  { emoji: '⛰️', seg: SEGS.AMT, target: [0, -95], color: 0x6b7fd6 },
  { emoji: '🌼', seg: SEGS.C, target: [0, 66], color: 0xf2a14e },
  { emoji: '⚓', seg: SEGS.CHB, target: [44, 76], color: 0x3aa6a0 },
];
for (const st of STATIONS) {
  const at = nearestOnSeg(st.seg, st.target[0], st.target[1]);
  st.s = at.s;
  st.p = at.p;
  const t = segTangent(st.seg, at.s);
  const side = V(0, 0, 0).crossVectors(UP, t).normalize();
  st.side = side.clone();
  st.tan = t.clone();
  const g = new THREE.Group();
  g.position.copy(at.p).addScaledVector(side, 2.6).setY(at.p.y);
  g.lookAt(g.position.clone().add(t));
  const platform = box(2.4, 0.5, 7.5, 0xd9c49a);
  platform.position.y = 0.25;
  g.add(platform);
  for (const zz of [-2.8, 2.8]) {
    const post = cyl(0.09, 0.09, 1.9, 0xffffff);
    post.position.set(0.55, 1.4, zz);
    g.add(post);
  }
  const roof = box(2.3, 0.14, 7, st.color);
  roof.position.set(0.42, 2.4, 0);
  roof.rotation.z = -0.12;
  g.add(roof);
  const sign = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24),
    new THREE.MeshBasicMaterial({ map: emojiTexture(st.emoji), transparent: true, side: THREE.DoubleSide }));
  sign.position.set(0.55, 3.6, 0);
  sign.rotation.y = Math.PI / 2;
  g.add(sign);
  const signPost = cyl(0.07, 0.07, 1.0, 0x8a5a2b);
  signPost.position.set(0.55, 2.7, 0);
  g.add(signPost);
  scene.add(g);
  st.group = g;
  st.sign = sign;
  tagTap(g, 'station', st);
}

// ============================================================ monkeys & planting
const monkeys = [];
function makeMonkey() {
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
  g.userData.anim = { spin: 0, phase: Math.random() * 6 };
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
  monkey.position.set(2.6, 3.6, 0);
  t.add(monkey);
  monkeys.push(monkey);
  tagTap(monkey, 'monkey', monkey);
  return t;
}
makeJungleTree(14, 52, 0.6);
makeJungleTree(-46, -76, 2.2);
makeJungleTree(18, 100, -0.8);
{
  const hillMonkey = makeMonkey();
  hillMonkey.position.set(tunnelWest.x, 6.2, tunnelWest.z);
  scene.add(hillMonkey);
  monkeys.push(hillMonkey);
  tagTap(hillMonkey, 'monkey', hillMonkey);
}
(function plant() {
  let made = 0, tries = 0;
  while (made < 52 && tries < 1400) {
    tries++;
    const x = (Math.random() - 0.5) * 250;
    const z = (Math.random() - 0.5) * 230;
    if (!clearOfTrack(x, z, 5.5)) continue;
    const kind = z < -75 ? 'pine' : (Math.random() < 0.4 ? 'pine' : 'oak');
    const t = makeTree(kind);
    t.scale.setScalar(0.8 + Math.random() * 0.8);
    t.position.set(x, 0, z);
    t.rotation.y = Math.random() * Math.PI * 2;
    scene.add(t);
    made++;
  }
  const colors = [0xff5d8f, 0xffd24a, 0xff8c1a, 0xb388ff, 0xff6b6b];
  const spots = [];
  let tries2 = 0;
  while (spots.length < 130 && tries2 < 2000) {
    tries2++;
    const meadowBias = spots.length < 60;
    const x = meadowBias ? (Math.random() - 0.5) * 80 : (Math.random() - 0.5) * 220;
    const z = meadowBias ? 42 + Math.random() * 33 : (Math.random() - 0.5) * 200;
    if (!clearOfTrack(x, z, 3.2)) continue;
    spots.push([x, z]);
  }
  const headGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, spots.length);
  const stemGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 5);
  const stems = new THREE.InstancedMesh(stemGeo, mat(0x3f8f3f), spots.length);
  spots.forEach(([x, z], i) => {
    _dummy.position.set(x, 0.32, z);
    _dummy.rotation.set(0, 0, 0);
    _dummy.updateMatrix();
    heads.setMatrixAt(i, _dummy.matrix);
    heads.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    _dummy.position.y = 0.15;
    _dummy.updateMatrix();
    stems.setMatrixAt(i, _dummy.matrix);
  });
  heads.instanceColor.needsUpdate = true;
  scene.add(heads);
  scene.add(stems);
})();

// ============================================================ rolling stock kit
const GAUGE_X = 0.62;
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
function addWheels(v, zs, r, color, opts = {}) {
  const gx = opts.gauge || GAUGE_X;
  for (const sideSign of [-1, 1]) {
    const phase = sideSign < 0 ? 0 : Math.PI / 2;
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

// ============================================================ the engines
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
  const lampBox = box(0.34, 0.4, 0.3, black);
  lampBox.position.set(0, 1.95, 1.78);
  e.g.add(lampBox);
  const lampLens = cyl(0.13, 0.13, 0.1, 0xfff2ae, { axis: 'z', shadow: false });
  lampLens.material.emissive = new THREE.Color(0xffe680);
  lampLens.material.emissiveIntensity = 0.8;
  lampLens.position.set(0, 1.95, 1.95);
  e.g.add(lampLens);
  for (const s of [-1, 1]) {
    const plate = box(0.7, 0.5, 0.08, red);
    plate.position.set(s * 0.33, 0.45, 2.05);
    plate.rotation.y = s * 0.55;
    plate.rotation.x = -0.4;
    e.g.add(plate);
  }
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
  e.chimney = V(0, 2.8, 1.45);
  e.driveR = 0.55;

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
  const chim = cyl(0.2, 0.26, 2.3, white);
  chim.position.set(0, 2.8, 1.35);
  e.g.add(chim);
  const chimCap = cyl(0.32, 0.26, 0.25, 0x2a2d31);
  chimCap.position.set(0, 3.95, 1.35);
  e.g.add(chimCap);
  for (const s of [-1, 1]) {
    const stay = cyl(0.03, 0.03, 1.6, 0x6b6b6b, { shadow: false });
    stay.position.set(s * 0.35, 2.7, 1.05);
    stay.rotation.z = s * 0.32;
    stay.rotation.x = 0.25;
    e.g.add(stay);
  }
  const firebox = box(1.2, 1.1, 0.9, 0xb05d2a);
  firebox.position.set(0, 1.15, -1.25);
  e.g.add(firebox);
  const plate = box(1.3, 0.18, 4.0, 0x6b4a2a);
  plate.position.set(0, 0.55, -0.1);
  e.g.add(plate);
  for (const s of [-1, 1]) {
    const pc = cyl(0.17, 0.17, 1.1, 0x4a6f9e, { metal: 0.5, rough: 0.4 });
    pc.position.set(s * 0.75, 1.5, -1.6);
    pc.rotation.x = 0.7;
    e.g.add(pc);
  }
  const driver = makeDriver(0x7a4a2b, 0x2a2d31);
  driver.position.set(0, 0.64, -1.95);
  e.g.add(driver);
  addWheels(e, [0.85], 0.95, ochre);
  addWheels(e, [-1.5], 0.42, ochre);
  e.chimney = V(0, 4.0, 1.35);
  e.driveR = 0.95;

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
  const chim = cyl(0.15, 0.2, 2.6, 0x2a2d31);
  chim.position.set(0, 3.4, 0.85);
  e.g.add(chim);
  const chimCap = cyl(0.27, 0.2, 0.22, 0x17191c);
  chimCap.position.set(0, 4.7, 0.85);
  e.g.add(chimCap);
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
  addWheels(e, [1.1, -1.3], 0.85, 0x8a6238, { rods: true });
  e.chimney = V(0, 4.8, 0.85);
  e.driveR = 0.85;
  return { vehicles: [e], type: 'steam' };
}

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
  const nose = sph(0.8, blue, { rough: 0.35, seg: 24 });
  nose.scale.set(0.94, 1.35, 2.3);
  nose.position.set(0, 1.45, 2.0);
  nose.rotation.x = 0.1;
  e.g.add(nose);
  const chim = box(0.35, 0.18, 0.55, 0x1d3f70);
  chim.position.set(0, 2.62, 1.35);
  e.g.add(chim);
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
  e.chimney = V(0, 2.75, 1.35);
  e.driveR = 0.72;
  const coaches = [buildCoach(0x7a4a2b, 0x3f3a33), buildCoach(0x7a4a2b, 0x3f3a33)];
  return { vehicles: [e, ...coaches], type: 'steam' };
}

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
  for (const s of [-1, 1]) {
    const swoosh = box(0.06, 1.0, 1.6, redW);
    swoosh.position.set(s * 0.82, 1.55, 1.65);
    e.g.add(swoosh);
    const stripe = box(0.05, 0.14, 5.4, yellow, { shadow: false });
    stripe.position.set(s * 0.84, 1.1, -0.4);
    e.g.add(stripe);
  }
  const lamp = cyl(0.14, 0.14, 0.1, 0xfff2ae, { axis: 'z', shadow: false });
  lamp.material.emissive = new THREE.Color(0xffe680);
  lamp.material.emissiveIntensity = 0.9;
  lamp.position.set(0, 1.9, 3.45);
  e.g.add(lamp);
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
  for (const z of [1.6, -2.4]) {
    const truck = box(1.1, 0.45, 1.9, 0x33373d);
    truck.position.set(0, 0.5, z);
    e.g.add(truck);
  }
  addWheels(e, [2.1, 1.1], 0.4, 0x33373d);
  addWheels(e, [-1.9, -2.9], 0.4, 0x33373d);
  e.chimney = V(0, 2.7, -1.0);
  e.driveR = 0.4;
  return { vehicles: [e, buildBoxcar(), buildTanker(), buildLogCar(), buildCaboose()], type: 'diesel' };
}

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
  const nose = sph(0.85, white, { rough: 0.3, seg: 24 });
  nose.scale.set(0.95, 0.85, 3.4);
  nose.position.set(0, 1.3, 1.6);
  e.g.add(nose);
  const windshield = sph(0.5, 0x37474f, { shadow: false });
  windshield.scale.set(0.85, 0.5, 1.1);
  windshield.position.set(0, 1.95, 1.4);
  e.g.add(windshield);
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
// ordered by the year the real engine (or book) appeared
const TRAIN_DEFS = [
  { id: 'catchme', year: 1808, name: 'CATCH ME', color: '#8a6238', top: 12, build: buildCatchMe, horn: 'steam1' },
  { id: 'rocket', year: 1829, name: 'ROCKET', color: '#e9b820', top: 30, build: buildRocket, horn: 'steam1' },
  { id: 'choochoo', year: 1937, name: 'CHOO CHOO', color: '#444', top: 55, build: buildChooChoo, horn: 'steam2', jumper: true },
  { id: 'mallard', year: 1938, name: 'MALLARD', color: '#2a5fa8', top: 126, build: buildMallard, horn: 'steam3' },
  { id: 'diesel', year: 1939, name: 'DIESEL', color: '#c0392b', top: 100, build: buildDiesel, horn: 'horn' },
  { id: 'bullet', year: 1964, name: 'BULLET', color: '#2a6fd6', top: 200, build: buildBullet, horn: 'beep' },
];
const trainIdx = id => TRAIN_DEFS.findIndex(d => d.id === id);

// ============================================================ smoke & sprites
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
const boomTex = (() => {
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = 128;
  const ctx = cnv.getContext('2d');
  ctx.translate(64, 64);
  ctx.fillStyle = '#ffb030';
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const r = i % 2 ? 26 : 60;
    const a = (i / 24) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffe680';
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(cnv);
})();
const puffs = [];
function spawnPuff(worldPos, opts = {}) {
  let p = puffs.find(q => q.life <= 0);
  if (!p) {
    if (puffs.length > 180) return;
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
  p.sprite.material.map = opts.boom ? boomTex : puffTex;
  p.sprite.material.color.setHex(opts.color !== undefined ? opts.color : 0xf5f5f5);
  p.sprite.position.copy(worldPos);
  p.vel = opts.vel || V((Math.random() - 0.5) * 0.5, 1.6 + Math.random(), (Math.random() - 0.5) * 0.5);
  p.sprite.visible = true;
}
function updatePuffs(dt) {
  for (const p of puffs) {
    if (p.life <= 0) { p.sprite.visible = false; continue; }
    p.life -= dt;
    p.sprite.position.addScaledVector(p.vel, dt);
    p.vel.x += dt * 0.3;
    const t = 1 - p.life / p.maxLife;
    const s = p.size + t * p.grow;
    p.sprite.scale.set(s, s, 1);
    p.sprite.material.opacity = Math.max(0, p.life / p.maxLife) * 0.85;
  }
}
function boomAt(pos) {
  spawnPuff(pos, { boom: true, size: 3, grow: 8, life: 0.55, vel: V(0, 0.5, 0), color: 0xffffff });
  for (let i = 0; i < 12; i++) {
    spawnPuff(pos.clone().add(V((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3)),
      { size: 1.0, grow: 2.5, life: 1.4 + Math.random(), color: i % 2 ? 0x888888 : 0xdddddd });
  }
}
function dustPoof(pos) {
  spawnPuff(pos, { boom: true, size: 2, grow: 4.5, life: 0.4, vel: V(0, 0.5, 0), color: 0xffffff });
  for (let i = 0; i < 7; i++) {
    spawnPuff(pos.clone().add(V((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2)),
      { size: 0.9, grow: 2.2, life: 0.9 + Math.random() * 0.5, color: 0xbfa77a });
  }
}

// ---- loose cars: vehicles cut from a train tumble until they hit the ground
// (or water) and pop — used for bridge-jump stragglers and mid-switch cuts
const loose = [];
function setLoose(v, vel) {
  loose.push({
    v, vel,
    ang: V((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 7),
    t: 0, fuse: 2.6,
  });
}
function updateLoose(dt) {
  for (let i = loose.length - 1; i >= 0; i--) {
    const L = loose[i];
    L.t += dt;
    L.v.g.position.addScaledVector(L.vel, dt);
    L.vel.y -= 18 * dt;
    L.v.g.rotation.x += L.ang.x * dt;
    L.v.g.rotation.y += L.ang.y * dt;
    L.v.g.rotation.z += L.ang.z * dt;
    const p = L.v.g.position;
    if ((p.y < 0.8 && L.vel.y < 0) || L.t > L.fuse) {
      if (Math.abs(p.x) < 4 && p.z > 72 && p.z < 142) audio.splash();
      else audio.poof();
      dustPoof(p.clone().setY(Math.max(p.y, 1)));
      scene.remove(L.v.g);
      loose.splice(i, 1);
    }
  }
}

// ============================================================ audio
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
// little original tunes, one per engine, flavored to its era; mel/bass are
// 8th-note steps in MIDI numbers (0 = rest)
const MUSIC_THEMES = {
  // 1808 — Catch Me Who Can ran in a circus ring: fairground organ waltz
  catchme: {
    bpm: 116, wave: 'square', bassWave: 'triangle', vol: 0.035,
    mel: [79, 0, 76, 0, 72, 0, 77, 0, 74, 0, 71, 0, 79, 76, 72, 76, 79, 84, 79, 0, 0, 76, 0, 0],
    bass: [48, 55, 55, 48, 55, 55],
  },
  // 1829 — brisk Rainhill-trials folk jig
  rocket: {
    bpm: 150, wave: 'triangle', vol: 0.05,
    mel: [69, 0, 71, 72, 0, 74, 76, 0, 74, 72, 0, 71, 69, 0, 71, 72, 74, 76, 71, 0, 0, 69, 0, 0],
    bass: [45, 0, 0, 52, 0, 0],
  },
  // 1937 — storybook americana oom-pah
  choochoo: {
    bpm: 112, wave: 'triangle', vol: 0.05,
    mel: [72, 0, 74, 76, 79, 0, 76, 74, 72, 0, 74, 76, 74, 0, 72, 0,
          72, 0, 74, 76, 79, 0, 81, 79, 76, 74, 72, 74, 72, 0, 0, 0],
    bass: [48, 0, 55, 0],
  },
  // 1938 — swing shuffle for the record-breaker
  mallard: {
    bpm: 132, swing: true, wave: 'square', vol: 0.032,
    mel: [76, 0, 79, 0, 81, 0, 79, 76, 74, 76, 74, 71, 69, 0, 76, 0,
          76, 0, 79, 0, 81, 0, 83, 81, 79, 76, 74, 76, 81, 0, 0, 0],
    bass: [57, 0, 59, 0, 60, 0, 62, 0, 64, 0, 62, 0, 60, 0, 59, 0],
  },
  // 1950s — diesel boogie-woogie
  diesel: {
    bpm: 138, wave: 'square', vol: 0.03, bassWave: 'sawtooth', bassVol: 0.035,
    mel: [0, 0, 74, 0, 77, 0, 74, 0, 0, 79, 77, 74, 0, 0, 72, 0,
          0, 0, 74, 0, 77, 0, 79, 0, 82, 0, 79, 77, 74, 0, 0, 0],
    bass: [55, 55, 59, 59, 62, 62, 64, 64, 65, 65, 64, 64, 62, 62, 59, 59],
  },
  // 1964 — bright shinkansen synth-pop arpeggios
  bullet: {
    bpm: 128, wave: 'sawtooth', vol: 0.022, bassWave: 'triangle',
    mel: [76, 80, 83, 88, 83, 80, 76, 80, 74, 78, 81, 86, 81, 78, 74, 78,
          76, 80, 83, 88, 83, 80, 76, 80, 81, 83, 86, 88, 86, 83, 81, 78],
    bass: [52, 0, 52, 0, 50, 0, 50, 0],
  },
  // gentle music-box waltz while touring the world
  world: {
    bpm: 92, wave: 'sine', vol: 0.05,
    mel: [84, 0, 88, 0, 91, 0, 88, 0, 84, 0, 0, 0, 83, 0, 86, 0, 91, 0, 86, 0, 83, 0, 0, 0],
    bass: [48, 55, 60, 47, 55, 59],
  },
};
const audio = {
  ctx: null, master: null,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
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
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
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
  noise(t0, dur, { freq = 800, q = 0.8, vol = 0.2, type = 'bandpass' } = {}) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur);
  },
  horn(kind, vol = 1) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime + 0.02;
    if (kind === 'steam1') {
      this.tone(880, t, 1.0, { vol: 0.16 * vol, vibrato: 8, attack: 0.05 });
      this.tone(1108, t, 1.0, { vol: 0.1 * vol, vibrato: 8 });
      this.noise(t, 1.0, { freq: 1800, vol: 0.05 * vol });
    } else if (kind === 'steam2') {
      this.tone(622, t, 1.1, { vol: 0.16 * vol, vibrato: 6, attack: 0.05 });
      this.tone(784, t, 1.1, { vol: 0.13 * vol, vibrato: 6 });
      this.noise(t, 1.1, { freq: 1400, vol: 0.05 * vol });
      for (let i = 0; i < 3; i++) this.tone(1568, t + 1.0 + i * 0.4, 0.5, { vol: 0.08 * vol, attack: 0.005 });
    } else if (kind === 'steam3') {
      for (const f of [587, 740, 880]) this.tone(f, t, 1.4, { vol: 0.11 * vol, vibrato: 5, attack: 0.06 });
      this.noise(t, 1.4, { freq: 1500, vol: 0.05 * vol });
    } else if (kind === 'horn') {
      for (const f of [311, 392]) {
        this.tone(f, t, 1.2, { type: 'sawtooth', vol: 0.08 * vol, attack: 0.06 });
        this.tone(f * 2, t, 1.2, { type: 'sine', vol: 0.05 * vol });
      }
    } else if (kind === 'beep') {
      this.tone(659, t, 0.35, { type: 'triangle', vol: 0.16 * vol, attack: 0.02 });
      this.tone(523, t + 0.4, 0.6, { type: 'triangle', vol: 0.16 * vol, attack: 0.02 });
    }
  },
  chuff(vol) {
    if (!this.ctx || vol < 0.01) return;
    this.noise(this.ctx.currentTime, 0.18, { freq: 600 + Math.random() * 300, vol: Math.min(0.22, vol) });
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
  moo() {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime + 0.02;
    this.tone(170, t, 0.75, { type: 'sawtooth', vol: 0.09, slide: -55, attack: 0.08 });
    this.tone(85, t, 0.75, { vol: 0.12, slide: -25, attack: 0.08 });
  },
  ding() {
    if (!this.ctx) return;
    this.tone(1175, this.ctx.currentTime + 0.01, 0.12, { vol: 0.06, attack: 0.005 });
  },
  uhuh() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    this.tone(220, t, 0.13, { type: 'square', vol: 0.05, attack: 0.01 });
    this.tone(180, t + 0.16, 0.18, { type: 'square', vol: 0.05, attack: 0.01 });
  },
  clunk() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    this.tone(95, t, 0.1, { type: 'square', vol: 0.12, attack: 0.005 });
    this.noise(t, 0.08, { freq: 350, vol: 0.1 });
  },
  creak() {
    if (!this.ctx) return;
    this.tone(120 + Math.random() * 40, this.ctx.currentTime, 0.16, { type: 'sawtooth', vol: 0.025, slide: 30 });
  },
  crash(vol = 1) {
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime + 0.01;
    this.noise(t, 0.7, { freq: 300, q: 0.4, vol: 0.3 * vol, type: 'lowpass' });
    for (let i = 0; i < 4; i++) {
      this.tone(180 + Math.random() * 400, t + i * 0.07, 0.16, { type: 'square', vol: 0.08 * vol, attack: 0.004, slide: -60 });
    }
    this.noise(t + 0.25, 1.2, { freq: 1600, vol: 0.06 * vol });
  },
  splash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    this.noise(t, 0.45, { freq: 900, vol: 0.16 });
    this.tone(190, t, 0.3, { vol: 0.1, slide: -90, attack: 0.01 });
  },
  thud() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    this.tone(70, t, 0.14, { vol: 0.18, attack: 0.005 });
    this.noise(t, 0.12, { freq: 220, vol: 0.12 });
  },
  wee() {
    if (!this.ctx) return;
    this.tone(500, this.ctx.currentTime + 0.02, 0.8, { vol: 0.1, slide: 500, attack: 0.03 });
  },
  poof() {
    if (!this.ctx) return;
    this.noise(this.ctx.currentTime + 0.01, 0.3, { freq: 700, vol: 0.1 });
  },
  makeLoop(type) {
    if (!this.ctx || type === 'steam') return null;
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = 0;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = type === 'diesel' ? 220 : 500;
    f.connect(g); g.connect(this.master);
    const oscs = [];
    const base = type === 'diesel' ? [48, 48.7] : [110, 164];
    for (const bf of base) {
      const o = c.createOscillator();
      o.type = type === 'diesel' ? 'sawtooth' : 'sine';
      o.frequency.value = bf;
      o.connect(f); o.start();
      oscs.push(o);
    }
    return {
      update(mph, att) {
        const target = (mph > 1 ? (type === 'diesel' ? 0.1 : 0.05) + mph * 0.0004 : 0.015) * att;
        g.gain.setTargetAtTime(target, c.currentTime, 0.3);
        oscs.forEach((o, i) => o.frequency.setTargetAtTime(base[i] + mph * 0.4, c.currentTime, 0.4));
      },
      stop() { oscs.forEach(o => o.stop()); g.disconnect(); },
    };
  },
  music: { theme: null, next: 0, step: 0 },
  setTheme(id) {
    const th = MUSIC_THEMES[id] || null;
    if (this.music.theme === th) return;
    this.music.theme = th;
    this.music.step = 0;
    if (this.ctx) this.music.next = this.ctx.currentTime + 0.25;
  },
  updateMusic() {
    const m = this.music;
    if (!this.ctx || !m.theme) return;
    if (m.next < this.ctx.currentTime - 0.5) m.next = this.ctx.currentTime + 0.05;
    while (m.next < this.ctx.currentTime + 0.15) {
      const th = m.theme;
      const spb = 60 / th.bpm / 2;                           // one 8th note
      const i = m.step % th.mel.length;
      const t0 = m.next + (th.swing && (i % 2) ? spb * 0.33 : 0);
      if (th.mel[i]) this.tone(NOTE(th.mel[i]), t0, spb * 0.9, { type: th.wave, vol: th.vol, attack: 0.012 });
      const bn = th.bass[m.step % th.bass.length];
      if (bn) this.tone(NOTE(bn - 12), t0, spb * 0.85, { type: th.bassWave || 'triangle', vol: th.bassVol || 0.045, attack: 0.012 });
      m.next += spb;
      m.step++;
    }
  },
};
function attAt(pos) {
  const d2 = camera.position.distanceToSquared(pos);
  return THREE.MathUtils.clamp(2500 / (2500 + d2), 0.04, 1);
}

// ============================================================ trains runtime
// Trains travel in "u" (distance traveled along the current segment) with a
// direction sign: dir=+1 follows the segment forward, dir=-1 runs it backward.
const trains = [];

function resolveBack(train, uVal) {
  let i = train.hist.length - 1, u = uVal;
  while (u < 0 && i > 0) { i--; u += train.hist[i].seg.len; }
  const h = train.hist[i];
  return { seg: h.seg, dir: h.dir, u: THREE.MathUtils.clamp(u, 0, h.seg.len) };
}
function frameOf(seg, dir, u) {
  const s = dir > 0 ? u : seg.len - u;
  const p = segPoint(seg, s);
  const tan = segTangent(seg, s);
  if (dir < 0) tan.negate();
  return { p, tan };
}
function vehicleFrame(train, uVal) {
  const r = resolveBack(train, uVal);
  return frameOf(r.seg, r.dir, r.u);
}
const _look = V(0, 0, 0);
function placeVehicles(train) {
  for (let i = 0; i < train.vehicles.length; i++) {
    const v = train.vehicles[i];
    const { p, tan } = vehicleFrame(train, train.u - train.offsets[i]);
    v.g.position.set(p.x, p.y + RAIL_Y, p.z);
    _look.copy(v.g.position).add(tan);
    v.g.lookAt(_look);
    if (train.flip) v.g.rotateY(Math.PI);
    v.g.rotateZ(Math.sin(train.u * 1.7 + i * 2) * 0.008);
  }
}
// flip the train's chain representation so it runs the other way; the chain
// always points along travel, so node/bridge/switch logic is direction-blind.
// train.flip keeps the bodies facing the way they were built.
function reverseTrain(train) {
  if (train.state !== 'run') return;
  const last = train.offsets.length - 1;
  // resolve the rear-most vehicle — it becomes the new motion lead
  let i = train.hist.length - 1, u = train.u - train.offsets[last];
  while (u < 0 && i > 0) { i--; u += train.hist[i].seg.len; }
  const newHist = [];
  for (let k = train.hist.length - 1; k >= i; k--) {
    newHist.push({ seg: train.hist[k].seg, dir: -train.hist[k].dir });
  }
  train.hist = newHist;
  const leadSeg = newHist[newHist.length - 1].seg;
  train.u = leadSeg.len - THREE.MathUtils.clamp(u, 0, leadSeg.len);
  const O = train.offsets[last];
  train.offsets = train.offsets.map(o => O - o);
  train.flip = !train.flip;
  train.waitToot = false;
  audio.clunk();
}
function spinWheels(train, ds) {
  for (const v of train.vehicles) {
    for (const w of v.wheels) w.g.rotation.x += ds / w.r;
    for (const r of v.rods) {
      const th = r.w.rotation.x;
      r.m.position.set(r.x, r.y0 - r.c * Math.sin(th), r.z0 + r.c * Math.cos(th));
    }
  }
  const eng = train.vehicles[0];
  if (eng && eng.pumper) {
    train.pumpPhase = (train.pumpPhase || 0) + ds / eng.driveR;
    const bob = Math.sin(train.pumpPhase) * 0.22;
    eng.pumper.rod.position.y = eng.pumper.baseY[0] + bob;
    eng.pumper.bar.position.y = eng.pumper.baseY[1] + bob;
  }
}
function chimneyWorld(train) {
  const eng = train.vehicles[0];
  eng.g.updateMatrixWorld();
  return eng.g.localToWorld(eng.chimney.clone());
}

function spawnSpotClear(seg, dir, u0, offsets) {
  for (let i = 0; i < offsets.length; i++) {
    const { p } = frameOf(seg, dir, Math.max(0.5, u0 - offsets[i]));
    for (const other of trains) {
      for (const ov of other.vehicles) {
        if (!ov.gone && ov.g.position.distanceTo(p) < 6) return false;
      }
    }
  }
  return true;
}
function spawnTrain(defIdx, stIdx, mphOverride, dirSign) {
  const def = TRAIN_DEFS[defIdx];
  if (trains.some(t => t.def === def)) return null;
  const st = STATIONS[stIdx];
  const dir = dirSign || 1;
  let u0 = dir > 0 ? st.s : st.seg.len - st.s;
  const built = def.build();
  const vehicles = built.vehicles;
  const offsets = [0];
  for (let i = 1; i < vehicles.length; i++) {
    offsets.push(offsets[i - 1] + vehicles[i - 1].len / 2 + 0.55 + vehicles[i].len / 2);
  }
  // never refuse a spawn: if the station spot is occupied, slide the new train
  // back behind it (or ahead if the segment start is too close) until it fits
  if (!spawnSpotClear(st.seg, dir, u0, offsets)) {
    const tailU = offsets[offsets.length - 1] + vehicles[vehicles.length - 1].len / 2 + 1;
    const noseU = st.seg.len - vehicles[0].len / 2 - 1;
    search:
    for (let k = 1; k * 4 < st.seg.len; k++) {
      for (const s of [-1, 1]) {
        const cand = u0 + s * k * 4;
        if (cand < tailU || cand > noseU) continue;
        if (spawnSpotClear(st.seg, dir, cand, offsets)) { u0 = cand; break search; }
      }
    }
  }
  const train = {
    def, type: built.type, vehicles, offsets,
    u: u0, hist: [{ seg: st.seg, dir }],
    targetMph: mphOverride !== undefined ? mphOverride : def.top,
    lastMph: def.top, v: 0, state: 'run', flip: false,
    chuffAcc: 0, exhaustAcc: 0,
    loop: null,
  };
  for (const v of vehicles) scene.add(v.g);
  placeVehicles(train);
  tagTap(vehicles[0].g, 'train', train);
  trains.push(train);
  audio.horn(def.horn);
  return train;
}
function despawnTrain(train, poof) {
  for (const v of train.vehicles) {
    if (v.gone) continue;
    if (poof) spawnPuff(v.g.position.clone().add(V(0, 1, 0)), { size: 1.4, grow: 2, life: 1 });
    scene.remove(v.g);
  }
  if (poof) audio.poof();
  if (train.tender) {
    barge.remove(train.tender.g);
    scene.remove(train.tender.g);
  }
  if (train.loop) { train.loop.stop(); train.loop = null; }
  const ti = tappables.indexOf(train.vehicles[0].g);
  if (ti >= 0) tappables.splice(ti, 1);
  trains.splice(trains.indexOf(train), 1);
  if (cam.target === train) { cam.target = null; cam.mode = 'tour'; }
  refreshUI();
}

// ---- arcade crash: cars tumble through the air until each pops in dust
function crashTrain(train) {
  if (train.state === 'crashed') return;
  train.state = 'crashed';
  train.crashT = 0;
  const speed = Math.max(train.v, 3);
  train.vehicles.forEach((v, i) => {
    const fwd = V(0, 0, 1).applyQuaternion(v.g.quaternion);
    const side = V(1, 0, 0).applyQuaternion(v.g.quaternion);
    v.crash = {
      vel: fwd.multiplyScalar(speed * 0.7)
        .addScaledVector(side, (Math.random() - 0.5) * 9)
        .add(V(0, 4.5 + Math.random() * 3.5, 0)),
      ang: V((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 7),
      fuse: 1.0 + i * 0.22 + Math.random() * 0.6,
    };
  });
  const at = train.vehicles[0].g.position;
  boomAt(at.clone().add(V(0, 1.5, 0)));
  audio.crash(Math.max(0.4, attAt(at)));
  showBanner('💥', '#fff');
  tourEvent(at);
}
function updateCrash(train, dt) {
  train.crashT += dt;
  let allGone = true;
  for (const v of train.vehicles) {
    if (v.gone) continue;
    const c = v.crash;
    if (train.crashT > c.fuse) {
      dustPoof(v.g.position.clone());
      scene.remove(v.g);
      v.gone = true;
      audio.poof();
      continue;
    }
    allGone = false;
    v.g.position.addScaledVector(c.vel, dt);
    c.vel.y -= 18 * dt;
    v.g.rotation.x += c.ang.x * dt;
    v.g.rotation.y += c.ang.y * dt;
    v.g.rotation.z += c.ang.z * dt;
    if (v.g.position.y < 0.9 && c.vel.y < 0) {
      v.g.position.y = 0.9;
      c.vel.y = Math.max(3.0, -c.vel.y * 0.55);
      c.vel.x *= 0.85; c.vel.z *= 0.85;
      spawnPuff(v.g.position.clone().setY(0.5), { size: 0.8, grow: 1.5, life: 0.7, color: 0xbfa77a });
    }
  }
  if (allGone) despawnTrain(train, false);
}

// ---- Choo Choo's drawbridge jump (works from either approach)
function gapStartU(dir) { return dir > 0 ? gapS0 : HARBOR.len - gapS1; }
function gapEndU(dir) { return dir > 0 ? gapS1 : HARBOR.len - gapS0; }
function startJump(train) {
  const cur = train.hist[train.hist.length - 1];
  train.state = 'jump';
  const v = Math.max(train.v, 48 * SCALE);
  train.jump = { phase: 'leaf', d: 0, v, side: cur.dir > 0 ? 0 : 1, dir: cur.dir };
  audio.horn(train.def.horn);
  audio.wee();
  tourEvent(bridge.mid);
}
function quadBez(a, b, c, t) {
  const q = a.clone().multiplyScalar((1 - t) * (1 - t));
  q.addScaledVector(b, 2 * (1 - t) * t);
  q.addScaledVector(c, t * t);
  return q;
}
function placeOnJump(v, pos, nextPos, flip) {
  v.g.position.copy(pos);
  _look.copy(nextPos);
  v.g.lookAt(_look);
  if (flip) v.g.rotateY(Math.PI);
}
function updateJump(train, dt) {
  const j = train.jump;
  // the motion-lead vehicle (offset 0) gets the storybook flight; the rest
  // chase it up the leaf and — except Choo Choo's tender — don't make it
  const lead = train.vehicles[train.flip ? train.vehicles.length - 1 : 0];
  const leafLen = bridge.sides[j.side].len;
  spinWheels(train, train.flip ? -j.v * dt : j.v * dt);
  if (train.type === 'steam' && train.vehicles[0].chimney) {
    train.chuffAcc += dt;
    if (train.chuffAcc > 0.09) {
      train.chuffAcc = 0;
      spawnPuff(chimneyWorld(train), { size: 0.7, grow: 1.8, life: 1.6 });
    }
  }
  j.d += j.v * dt;

  const bargeToss = train.def.jumper && !train.flip;
  for (let i = train.vehicles.length - 1; i >= 0; i--) {
    const v = train.vehicles[i];
    if (v === lead) continue;
    if (bargeToss && i === 1 && j.tenderB) continue;     // frozen, awaits the toss
    const di = j.d - train.offsets[i];
    if (di < 0) {
      const { p, tan } = vehicleFrame(train, gapStartU(j.dir) + di);
      v.g.position.set(p.x, p.y + RAIL_Y, p.z);
      _look.copy(v.g.position).add(tan);
      v.g.lookAt(_look);
      if (train.flip) v.g.rotateY(Math.PI);
    } else if (di < leafLen) {
      placeOnJump(v, leafPoint(j.side, di), leafPoint(j.side, di + 1), train.flip);
    } else if (!(bargeToss && i === 1)) {
      // off the leaf tip and into the canal
      train.vehicles.splice(i, 1);
      train.offsets.splice(i, 1);
      setLoose(v, leafDirOf(j.side).multiplyScalar(j.v)
        .add(V((Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2)));
      if (!j.boomed) { j.boomed = true; audio.crash(0.7); showBanner('💥', '#fff'); }
    }
  }

  if (j.phase === 'leaf') {
    const d = Math.min(j.d, leafLen);
    placeOnJump(lead, leafPoint(j.side, d), leafPoint(j.side, d + 1), train.flip);
    if (j.d >= leafLen) {
      j.phase = 'air';
      j.t = 0;
      const tip = leafPoint(j.side, leafLen);
      j.landU = gapEndU(j.dir) + 8;
      const landF = frameOf(HARBOR, j.dir, j.landU);
      const land = landF.p.clone().add(V(0, RAIL_Y, 0));
      const apexY = bridge.sides[j.side].hinge.y + Math.sin(bridge.maxAngle) * leafLen + 3.4;
      const apex = tip.clone().add(land).multiplyScalar(0.5).setY(apexY);
      j.b = [tip, apex, land];
      j.T = (tip.distanceTo(land) * 1.25) / j.v;
    }
  } else if (j.phase === 'air') {
    j.t += dt;
    const t01 = Math.min(1, j.t / j.T);
    const pos = quadBez(j.b[0], j.b[1], j.b[2], t01);
    const ahead = quadBez(j.b[0], j.b[1], j.b[2], Math.min(1, t01 + 0.04));
    placeOnJump(lead, pos, ahead, train.flip);
    const tender = bargeToss ? train.vehicles[1] : null;
    if (tender && !j.tenderB) {
      j.tenderB = {
        t: 0, T: 0.85,
        b: [
          tender.g.position.clone(),
          tender.g.position.clone().add(barge.position).multiplyScalar(0.5).setY(tender.g.position.y + 1.4),
          barge.position.clone().add(V(0, 1.35, 1.6)),
        ],
      };
    }
    if (t01 >= 1) {
      train.state = 'run';
      train.u = j.landU;
      train.v = j.v;
      spawnPuff(lead.g.position.clone().setY(lead.g.position.y + 0.5), { size: 1.2, grow: 2, life: 1 });
      audio.thud();
      if (tender && !train.tenderParked) {
        train.tenderFall = j.tenderB;
        train.tender = tender;
      } else {
        for (const v of train.vehicles) {
          if (v === lead) continue;
          const fwd = V(0, 0, 1).applyQuaternion(v.g.quaternion);
          if (train.flip) fwd.negate();
          setLoose(v, fwd.multiplyScalar(j.v * 0.8).add(V(0, 2.5, 0)));
          if (!j.boomed) { j.boomed = true; audio.crash(0.7); showBanner('💥', '#fff'); }
        }
      }
      train.vehicles = [lead];
      train.offsets = [0];
      train.flip = false;
      train.jump = null;
    }
  }
}
function updateTenderFall(train, dt) {
  const f = train.tenderFall;
  if (!f) return;
  f.t += dt;
  const t01 = Math.min(1, f.t / f.T);
  const pos = quadBez(f.b[0], f.b[1], f.b[2], t01);
  const ahead = quadBez(f.b[0], f.b[1], f.b[2], Math.min(1, t01 + 0.05));
  placeOnJump(train.tender, pos, ahead);
  if (t01 >= 1) {
    train.tenderFall = null;
    train.tenderParked = true;
    const local = train.tender.g.position.clone().sub(barge.position);
    scene.remove(train.tender.g);
    barge.add(train.tender.g);
    train.tender.g.position.copy(local);
    train.tender.g.rotation.set(0, train.tender.g.rotation.y, 0.16);
    audio.splash();
    audio.thud();
    for (let i = 0; i < 6; i++) {
      spawnPuff(barge.position.clone().add(V((Math.random() - 0.5) * 2, 1.5, 1.6)),
        { size: 0.7, grow: 1.6, life: 1.1, color: i % 2 ? 0x333333 : 0x9fd2ef });
    }
  }
}

// if `cur` is heading into a node on a branch the switch hasn't selected, the
// points are set against it — return the u where it must wait, else -1
function wrongWaySwitchU(cur) {
  const node = cur.dir > 0 ? NODES[cur.seg.to] : NODES[cur.seg.from];
  const end = cur.dir > 0 ? 'to' : 'from';
  if (node.trunk.seg === cur.seg.id && node.trunk.end === end) return -1;
  const sel = node.branches[node.sel];
  if (sel.seg === cur.seg.id && sel.end === end) return -1;
  return cur.seg.len - PTS_LEN - 4;
}

// node hand-off (trunk side consults the switch; branch side trails through)
function advanceChain(train) {
  let last = train.hist[train.hist.length - 1];
  while (train.u > last.seg.len) {
    const node = last.dir > 0 ? NODES[last.seg.to] : NODES[last.seg.from];
    const arrivedEnd = last.dir > 0 ? 'to' : 'from';
    let nextLeg;
    if (node.trunk.seg === last.seg.id && node.trunk.end === arrivedEnd) {
      nextLeg = node.branches[node.sel];
    } else {
      nextLeg = node.trunk;
    }
    const nseg = SEGS[nextLeg.seg];
    const ndir = nextLeg.end === 'from' ? 1 : -1;
    train.u -= last.seg.len;
    last = { seg: nseg, dir: ndir };
    train.hist.push(last);
    if (train.hist.length > 5) train.hist.shift();
  }
}

function updateTrain(train, dt) {
  if (train.state === 'crashed') { updateCrash(train, dt); return; }
  updateTenderFall(train, dt);
  if (train.state === 'jump') { updateJump(train, dt); return; }

  let want = train.targetMph * SCALE;
  const brakeD = train.v * train.v / (2 * DECEL) + 3;   // stopping distance at current v
  const cur = train.hist[train.hist.length - 1];
  const gU = cur.seg === HARBOR ? gapStartU(cur.dir) : -1;
  const onApproach = gU >= 0 && train.u < gU;
  // every train takes the jump — only Choo Choo's whole consist survives it
  if (onApproach && !bridgeIsDown() && train.u >= gU - 0.4) { startJump(train); return; }
  const swU = wrongWaySwitchU(cur);
  const waitAtSwitch = swU >= 0 && train.u <= swU;
  if (waitAtSwitch) {
    if (train.u > swU - brakeD) want = 0;
    if (!train.waitToot && train.u > swU - 6) {
      train.waitToot = true;
      audio.horn(train.def.horn, 0.5);
    }
  } else {
    train.waitToot = false;
  }
  const acc = want < train.v ? DECEL : 7;
  train.v += THREE.MathUtils.clamp(want - train.v, -acc * dt, acc * dt);
  if (train.v < 0.005 && want === 0) train.v = 0;
  const ds = train.v * dt;
  train.u += ds;
  if (waitAtSwitch) train.u = Math.min(train.u, swU);
  advanceChain(train);

  placeVehicles(train);
  spinWheels(train, train.flip ? -ds : ds);

  const eng = train.vehicles[0];
  const att = attAt(eng.g.position);
  if (train.type === 'steam' && eng.chimney) {
    train.chuffAcc += ds / eng.driveR;
    if (train.chuffAcc > Math.PI / 2) {
      train.chuffAcc %= Math.PI / 2;
      if (train.v > 0.25) {
        audio.chuff((0.08 + train.v * 0.012) * att);
        spawnPuff(chimneyWorld(train), { size: 0.55 + Math.random() * 0.3, grow: 1.5, life: 1.7 });
      }
    }
  } else if (train.type === 'diesel' && train.v > 0.25) {
    train.exhaustAcc += dt;
    if (train.exhaustAcc > 0.22) {
      train.exhaustAcc = 0;
      spawnPuff(chimneyWorld(train), { size: 0.3, grow: 0.8, life: 1.1, color: 0x777777 });
    }
  }
  if (!train.loop && audio.ctx && train.type !== 'steam') train.loop = audio.makeLoop(train.type);
  if (train.loop) train.loop.update(train.v / SCALE, att);
}

function checkCollisions() {
  for (let i = 0; i < trains.length; i++) {
    for (let j = i + 1; j < trains.length; j++) {
      const a = trains[i], b = trains[j];
      if (a.state !== 'run' || b.state !== 'run') continue;
      let hit = false;
      for (const va of a.vehicles) {
        for (const vb of b.vehicles) {
          const rr = (va.len + vb.len) * 0.46;
          if (va.g.position.distanceToSquared(vb.g.position) < rr * rr) { hit = true; break; }
        }
        if (hit) break;
      }
      if (hit) { crashTrain(a); crashTrain(b); }
    }
  }
}

// ============================================================ derrick & free cars
// a rescued tender becomes a "free car" sitting on the track: back into it to
// couple it onto your train; run into it nose-first and you crash
const freeCars = [];
function checkFreeCars() {
  for (let fi = freeCars.length - 1; fi >= 0; fi--) {
    const fc = freeCars[fi];
    let used = false;
    for (const train of trains) {
      if (train.state !== 'run' || train.v < 0.1) continue;
      const lead = train.vehicles[train.flip ? train.vehicles.length - 1 : 0];
      if (lead.g.position.distanceTo(fc.v.g.position) > (lead.len + fc.v.len) * 0.5 + 0.6) continue;
      if (train.flip) {
        // backing in: couple it on as the new motion lead
        const gap = lead.len / 2 + 0.55 + fc.v.len / 2;
        train.u += gap;
        advanceChain(train);
        for (let i = 0; i < train.offsets.length; i++) train.offsets[i] += gap;
        train.vehicles.push(fc.v);
        train.offsets.push(0);
        audio.clunk();
        audio.ding();
        showBanner('🔗', '#fff');
      } else {
        setLoose(fc.v, V((Math.random() - 0.5) * 4, 6, (Math.random() - 0.5) * 4));
        crashTrain(train);
      }
      used = true;
      break;
    }
    if (used) freeCars.splice(fi, 1);
  }
}

// when the bridge comes down with a tender stranded on the barge, a derrick
// car hurries in, hoists it back onto the rails, and trundles off over the bridge
const derrick = { active: false, v: null };
function buildDerrickCar() {
  const v = newVehicle(4.8);
  const bed = box(1.6, 0.35, 4.4, 0x8a5a2b);
  bed.position.y = 0.85;
  v.g.add(bed);
  const cab = box(1.3, 1.1, 1.4, 0xf2c14e);
  cab.position.set(0, 1.6, -1.3);
  v.g.add(cab);
  const cabRoof = box(1.5, 0.12, 1.6, 0xc0392b);
  cabRoof.position.set(0, 2.2, -1.3);
  v.g.add(cabRoof);
  const boom = new THREE.Group();
  const arm = box(0.3, 0.3, 4.4, 0xf2c14e);
  arm.position.set(0, 0.75, 1.7);
  arm.rotation.x = -0.35;
  boom.add(arm);
  const rope = cyl(0.04, 0.04, 1.4, 0x2a2d31, { shadow: false });
  rope.position.set(0, 0.8, 3.4);
  boom.add(rope);
  const hook = box(0.35, 0.4, 0.35, 0x6b7077);
  hook.position.set(0, 0.1, 3.4);
  boom.add(hook);
  boom.position.set(0, 1.2, -0.2);
  v.g.add(boom);
  v.boom = boom;
  addWheels(v, [1.5, -1.5], 0.36, 0x33373d);
  return v;
}
function placeDerrick(u) {
  const { p, tan } = frameOf(HARBOR, 1, u);
  derrick.v.g.position.set(p.x, p.y + RAIL_Y, p.z);
  _look.copy(derrick.v.g.position).add(tan);
  derrick.v.g.lookAt(_look);
}
function startDerrick(owner) {
  derrick.active = true;
  derrick.owner = owner;
  derrick.tender = owner.tender;
  if (!derrick.v) derrick.v = buildDerrickCar();
  scene.add(derrick.v.g);
  derrick.phase = 'come';
  derrick.u = Math.max(6, gapS0 - 46);
  placeDerrick(derrick.u);
  audio.horn('horn', 0.5);
  tourEvent(bridge.mid);
}
const RESCUE_S = () => gapS0 - 13.5;     // where the tender gets set down
function updateDerrick(dt) {
  if (!derrick.active) return;
  const d = derrick;
  if (d.phase !== 'leave' && (!trains.includes(d.owner) || !d.owner.tender)) {
    d.tender = null;                      // owner vanished mid-rescue: go home
    d.phase = 'leave';
  }
  const roll = ds => { for (const w of d.v.wheels) w.g.rotation.x += ds / w.r; };
  if (d.phase === 'come') {
    d.u += 16 * dt;
    roll(16 * dt);
    placeDerrick(d.u);
    if (d.u >= gapS0 - 7.5) {
      d.phase = 'lift';
      d.t = 0;
      const from = V(0, 0, 0);
      d.tender.g.getWorldPosition(from);
      barge.remove(d.tender.g);
      scene.add(d.tender.g);
      d.tender.g.position.copy(from);
      d.tender.g.rotation.z = 0;
      d.from = from.clone();
      d.to = segPoint(HARBOR, RESCUE_S()).add(V(0, RAIL_Y, 0));
      d.apex = from.clone().lerp(d.to, 0.5).setY(Math.max(from.y, d.to.y) + 4.5);
      audio.clunk();
    }
  } else if (d.phase === 'lift') {
    d.t += dt / 2.6;
    const t01 = Math.min(1, d.t);
    d.v.boom.rotation.y = Math.sin(t01 * Math.PI) * 1.1;
    if (Math.random() < dt * 3) audio.creak();
    d.tender.g.position.copy(quadBez(d.from, d.apex, d.to, t01));
    d.tender.g.rotation.y += dt * 0.6;
    if (t01 >= 1) {
      d.tender.g.rotation.set(0, 0, 0);
      _look.copy(d.tender.g.position).add(segTangent(HARBOR, RESCUE_S()));
      d.tender.g.lookAt(_look);
      freeCars.push({ v: d.tender, seg: HARBOR, s: RESCUE_S() });
      d.owner.tenderParked = false;
      d.owner.tender = null;
      d.tender = null;
      audio.thud();
      audio.ding();
      d.phase = 'leave';
    }
  } else if (d.phase === 'leave') {
    // drives on across the lowered bridge and away (waits if it goes back up)
    const atGapEdge = !bridgeIsDown() && d.u > gapS0 - 8 && d.u < gapS1;
    if (!atGapEdge) {
      d.u += 16 * dt;
      roll(16 * dt);
      placeDerrick(d.u);
    }
    if (d.u > Math.min(gapS1 + 42, HARBOR.len - 2)) {
      scene.remove(d.v.g);
      d.active = false;
    }
  }
}

// ============================================================ animal riders
// a train passing close to an animal tempts one aboard: it leaps onto the
// last car, rides along, and flies home when the ride ends (or goes wrong)
const hoppers = [];
for (const d of [ducks[0], ducks[1]]) hoppers.push({ obj: d, kind: 'duck' });
for (const m of monkeys) hoppers.push({ obj: m, kind: 'monkey' });
for (const c of cows) hoppers.push({ obj: c, kind: 'cow' });
for (const h of hoppers) {
  h.homeParent = h.obj.parent;
  h.homePos = h.obj.position.clone();
  h.homeRot = h.obj.rotation.clone();
}
const riders = [];
let riderCooldown = 3;
const _wv = V(0, 0, 0);
function tryRiders(dt) {
  riderCooldown -= dt;
  if (riderCooldown > 0) return;
  for (const train of trains) {
    if (train.state !== 'run' || train.v < 1 || train.rider) continue;
    const p = train.vehicles[0].g.position;
    for (const h of hoppers) {
      if (h.obj.userData.riding) continue;
      h.obj.getWorldPosition(_wv);
      if (_wv.distanceToSquared(p) > 13 * 13) continue;
      h.obj.userData.riding = true;
      scene.attach(h.obj);
      const car = train.vehicles[train.vehicles.length - 1];
      riders.push({ h, train, car, t: 0, mode: 'jump', from: _wv.clone() });
      train.rider = h;
      if (h.kind === 'duck') audio.quack(1.4);
      else if (h.kind === 'monkey') audio.monkey();
      else audio.moo();
      audio.wee();
      riderCooldown = 7;
      return;
    }
  }
}
function dismountRider(r) {
  if (r.train.rider === r.h) r.train.rider = null;
  scene.attach(r.h.obj);
  r.mode = 'home';
  r.t = 0;
  r.from = r.h.obj.position.clone();
}
function updateRiders(dt) {
  for (let i = riders.length - 1; i >= 0; i--) {
    const r = riders[i];
    const seatY = r.h.kind === 'cow' ? 2.1 : 2.4;
    if (r.mode === 'jump') {
      if (!r.train.vehicles.includes(r.car) || r.train.state === 'crashed') { dismountRider(r); continue; }
      r.t += dt / 0.7;
      const t01 = Math.min(1, r.t);
      const target = r.car.g.localToWorld(V(0, seatY, 0));
      r.h.obj.position.copy(r.from).lerp(target, t01);
      r.h.obj.position.y += Math.sin(t01 * Math.PI) * 4;
      if (t01 >= 1) {
        r.car.g.attach(r.h.obj);
        r.h.obj.position.set(0, seatY, 0);
        r.h.obj.rotation.set(0, 0, 0);
        r.mode = 'ride';
      }
    } else if (r.mode === 'ride') {
      if (!trains.includes(r.train) || r.train.state !== 'run'
          || !r.train.vehicles.includes(r.car)) {
        dismountRider(r);
      }
    } else {                                   // flying home
      r.t += dt / 1.1;
      const t01 = Math.min(1, r.t);
      const target = r.h.homeParent.localToWorld(r.h.homePos.clone());
      r.h.obj.position.copy(r.from).lerp(target, t01);
      r.h.obj.position.y += Math.sin(t01 * Math.PI) * 6;
      if (t01 >= 1) {
        r.h.homeParent.add(r.h.obj);
        r.h.obj.position.copy(r.h.homePos);
        r.h.obj.rotation.copy(r.h.homeRot);
        r.h.obj.userData.riding = false;
        riders.splice(i, 1);
        if (r.h.kind === 'duck') audio.quack(1);
      }
    }
  }
}

// ============================================================ cameras
const cam = { mode: 'tour', angle: 0, target: null, poi: null };
const CAM_ANGLES = ['chase', 'side', 'front', 'cab', 'top'];
const camPos = V(0, 110, 150);
const camLook = V(0, 0, 0);

const POIS = [];
let poiIdx = 0;
function buildPOIs() {
  POIS.push(
    { pos: pondCenter.clone().add(V(15, 9, 13)), look: pondCenter.clone() },
    { pos: bridge.mid.clone().add(V(18, 10, 15)), look: bridge.mid.clone() },
    { pos: tunnelWest.clone().add(V(13, 9, 13)), look: tunnelWest.clone() },
    { pos: windmill.position.clone().add(V(13, 9, 13)), look: windmill.position.clone().add(V(0, 4, 0)) },
    { pos: lighthouse.position.clone().add(V(15, 10, -13)), look: lighthouse.position.clone().add(V(2, 4, -4)) },
    { pos: V(-100, 9, 28), look: V(-112, 2, 14) },
    { pos: NODES.N1.pos.clone().add(V(16, 11, 11)), look: NODES.N1.pos.clone() },
    { pos: NODES.N5.pos.clone().add(V(14, 10, -12)), look: NODES.N5.pos.clone() },
    { pos: NODES.N6.pos.clone().add(V(-14, 10, -12)), look: NODES.N6.pos.clone() },
    { pos: V(0, 170, 150), look: V(0, 0, 8) },
  );
}
buildPOIs();
const tour = { idx: POIS.length - 1, t: 0, hold: 5, override: null };
function tourEvent(pos) {
  tour.override = { pos: pos.clone().add(V(13, 9, 11)), look: pos.clone(), t: 4.5 };
}
function stationView(st) {
  return {
    pos: st.p.clone().addScaledVector(st.side, 13).addScaledVector(st.tan, 5).add(V(0, 8, 0)),
    look: st.p.clone().add(V(0, 1.5, 0)),
  };
}
function updateCamera(dt, t) {
  let want, look, k = 2.2;
  if (cam.mode === 'follow' && cam.target) {
    const train = cam.target;
    if (train.state === 'crashed') {
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      return;
    }
    if (train.state === 'jump' || train.tenderFall) {
      // pull back to frame the flying engine and the falling tender together
      const a = train.vehicles[0].g.position;
      const b = train.tenderFall ? train.tender.g.position
        : train.vehicles[1] ? train.vehicles[1].g.position : barge.position;
      look = a.clone().lerp(b, 0.45).add(V(0, 1.5, 0));
      want = look.clone().add(V(30, 13, 9));
      const snapJ = PARAMS.has('snap') ? 1 : 0;
      camPos.lerp(want, snapJ || Math.min(1, dt * 3.5));
      camLook.lerp(look, snapJ || Math.min(1, dt * 5));
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      return;
    }
    const eng = train.vehicles[0];
    const p = eng.g.position;
    const fwd = V(0, 0, 1).applyQuaternion(eng.g.quaternion);
    const side = V(1, 0, 0).applyQuaternion(eng.g.quaternion);
    const mode = CAM_ANGLES[cam.angle];
    k = 4;
    if (mode === 'chase') {
      want = p.clone().addScaledVector(fwd, -16).add(V(0, 8.5, 0)).addScaledVector(side, 3);
      look = p.clone().add(V(0, 2, 0));
    } else if (mode === 'side') {
      want = p.clone().addScaledVector(side, 17).add(V(0, 5, 0));
      look = p.clone().add(V(0, 1.5, 0));
    } else if (mode === 'front') {
      want = p.clone().addScaledVector(fwd, 15).add(V(0, 4, 0));
      look = p.clone().add(V(0, 1.5, 0));
    } else if (mode === 'cab') {
      k = 7;
      want = p.clone().addScaledVector(fwd, -(eng.len / 2 + 0.6)).add(V(0, 3.5, 0));
      look = p.clone().addScaledVector(fwd, 12).add(V(0, 1.4, 0));
    } else {
      want = p.clone().add(V(4, 30, 0.01));
      look = p.clone();
    }
  } else if (cam.mode === 'poi' && cam.poi) {
    want = cam.poi.pos; look = cam.poi.look;
    k = 2.4;
  } else {
    if (tour.override) {
      tour.override.t -= dt;
      want = tour.override.pos; look = tour.override.look;
      k = 3;
      if (tour.override.t <= 0) tour.override = null;
    } else {
      tour.t += dt;
      if (tour.t > tour.hold) {
        tour.t = 0;
        tour.idx = (tour.idx + 1) % POIS.length;
      }
      want = POIS[tour.idx].pos; look = POIS[tour.idx].look;
      k = 1.4;
    }
  }
  const snap = PARAMS.has('snap') ? 1 : 0;
  camPos.lerp(want, snap || Math.min(1, dt * k));
  camLook.lerp(look, snap || Math.min(1, dt * (k + 1.5)));
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}
const DEBUG_VIEW = PARAMS.get('view');

// ============================================================ UI
const $ = id => document.getElementById(id);
const banner = $('banner'), bannerName = $('bannerName');
let bannerTimer = null;
function showBanner(text, color) {
  bannerName.textContent = text;
  bannerName.style.color = color || '#fff';
  banner.classList.remove('show');
  void banner.offsetWidth;
  banner.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => banner.classList.remove('show'), 2200);
}

let spawnStation = 0;
let spawnDir = 1;
const stationRow = $('stationRow');
STATIONS.forEach((st, i) => {
  const b = document.createElement('button');
  b.className = 'stBtn' + (i === 0 ? ' on' : '');
  b.textContent = st.emoji;
  b.addEventListener('click', () => selectStation(i));
  stationRow.appendChild(b);
  st.btn = b;
});
const dirBtn = document.createElement('button');
dirBtn.className = 'stBtn';
dirBtn.textContent = '➡️';
dirBtn.title = 'spawn direction';
dirBtn.addEventListener('click', toggleSpawnDir);
stationRow.appendChild(dirBtn);
function toggleSpawnDir() {
  spawnDir *= -1;
  dirBtn.textContent = spawnDir > 0 ? '➡️' : '⬅️';
  audio.ding();
}
function selectStation(i) {
  spawnStation = i;
  STATIONS.forEach((st, j) => st.btn.classList.toggle('on', j === i));
  const st = STATIONS[i];
  st.signBounce = 1;
  cam.mode = 'poi';
  cam.poi = stationView(st);
  cam.target = null;
  audio.ding();
  refreshUI();
}

const trainRow = $('trainRow');
TRAIN_DEFS.forEach((def, i) => {
  const b = document.createElement('button');
  b.className = 'trainBtn';
  b.textContent = def.name;
  b.style.borderBottomColor = def.color;
  const x = document.createElement('span');
  x.className = 'x';
  x.textContent = '✕';
  b.appendChild(x);
  x.addEventListener('click', e => {
    e.stopPropagation();
    const tr = trains.find(t => t.def === def);
    if (tr) despawnTrain(tr, true);
  });
  b.addEventListener('click', () => {
    const existing = trains.find(t => t.def === def);
    if (existing) {
      selectTrain(existing);
      audio.horn(def.horn);
    } else {
      const tr = spawnTrain(i, spawnStation, undefined, spawnDir);
      if (tr) {
        selectTrain(tr);
        showBanner(def.name + '!', def.color === '#444' ? '#fff' : def.color);
      } else {
        b.classList.add('shake');
        setTimeout(() => b.classList.remove('shake'), 450);
      }
    }
    refreshUI();
  });
  trainRow.appendChild(b);
  def.btn = b;
});

function selectTrain(train) {
  cam.target = train;
  cam.mode = 'follow';
  refreshUI();
}

const goBtn = $('goBtn'), speedSlider = $('speedSlider'), speedVal = $('speedVal'), speedBox = $('speedBox');
function refreshUI() {
  TRAIN_DEFS.forEach(def => {
    const tr = trains.find(t => t.def === def);
    def.btn.classList.toggle('live', !!tr);
    def.btn.style.background = tr ? def.color : '#fff';
    def.btn.classList.toggle('sel', !!tr && cam.target === tr && cam.mode === 'follow');
  });
  const sel = cam.mode === 'follow' ? cam.target : null;
  speedBox.classList.toggle('off', !sel);
  if (sel) {
    speedSlider.value = Math.round(sel.targetMph);
    speedVal.innerHTML = Math.round(sel.targetMph) + '<small> mph</small>';
    goBtn.textContent = sel.targetMph > 0 ? '⏸' : '▶';
    goBtn.classList.toggle('running', sel.targetMph > 0);
    goBtn.classList.toggle('stopped', sel.targetMph === 0);
  }
  $('tourBtn').classList.toggle('on', cam.mode === 'tour');
  audio.setTheme(sel ? sel.def.id : 'world');
}
function setSelSpeed(mph) {
  const sel = cam.mode === 'follow' ? cam.target : null;
  if (!sel) return;
  sel.targetMph = THREE.MathUtils.clamp(mph, 0, 400);
  if (sel.targetMph > 0) sel.lastMph = sel.targetMph;
  refreshUI();
}
speedSlider.addEventListener('input', () => setSelSpeed(+speedSlider.value));
goBtn.addEventListener('click', () => {
  const sel = cam.mode === 'follow' ? cam.target : null;
  if (!sel) return;
  if (sel.targetMph > 0) { sel.lastMph = sel.targetMph; sel.targetMph = 0; }
  else sel.targetMph = sel.lastMph || sel.def.top;
  audio.ding();
  refreshUI();
});
$('whistleBtn').addEventListener('click', () => {
  const sel = cam.mode === 'follow' ? cam.target : null;
  if (sel) {
    audio.horn(sel.def.horn);
    if (sel.type === 'steam' && sel.state !== 'crashed') {
      const tip = chimneyWorld(sel);
      for (let i = 0; i < 4; i++) spawnPuff(tip, { size: 0.9, grow: 2.0, life: 1.8 });
    }
  } else {
    trains.forEach(t => audio.horn(t.def.horn, 0.6));
  }
});
$('camBtn').addEventListener('click', () => {
  if (cam.mode === 'follow' && cam.target) {
    cam.angle = (cam.angle + 1) % CAM_ANGLES.length;
  } else if (trains.length) {
    selectTrain(trains[0]);
  }
  audio.ding();
  refreshUI();
});
$('tourBtn').addEventListener('click', () => {
  cam.mode = 'tour';
  cam.target = null;
  audio.ding();
  refreshUI();
});
$('bridgeBtn').addEventListener('click', () => setBridge(!bridge.up));
$('mute').addEventListener('click', toggleMute);
function toggleMute() {
  if (!audio.ctx) return;
  const muted = audio.master.gain.value < 0.01;
  audio.master.gain.value = muted ? 0.5 : 0;
  $('mute').textContent = muted ? '🔊' : '🔇';
}
$('helpBtn').addEventListener('click', toggleHelp);
$('help').addEventListener('pointerdown', toggleHelp);
function toggleHelp() {
  $('help').classList.toggle('show');
}

function cycleTrain(dir) {
  if (!trains.length) return;
  let idx = trains.indexOf(cam.target);
  idx = idx < 0 ? 0 : (idx + dir + trains.length) % trains.length;
  selectTrain(trains[idx]);
  audio.ding();
}
const SWITCH_KEY_ORDER = ['q', 'w', 'e', 'r', 't', 'y'];
function pressKey(key, code) {
  const k = (key || '').toLowerCase();
  const swIdx = SWITCH_KEY_ORDER.indexOf(k);
  if (code === 'Space' || key === ' ') { $('whistleBtn').click(); return true; }
  else if (key >= '1' && key <= '6') TRAIN_DEFS[+key - 1].btn.click();
  else if (key >= '7' && key <= '9') selectStation(+key - 7);
  else if (key === '0') selectStation(3);
  else if (swIdx >= 0 && switches[swIdx]) toggleSwitch(switches[swIdx]);
  else if (k === 'b') $('bridgeBtn').click();
  else if (k === 'd') toggleSpawnDir();
  else if (k === 'g') goBtn.click();
  else if (k === 'c') $('camBtn').click();
  else if (k === 'o') $('tourBtn').click();
  else if (k === 'm') toggleMute();
  else if (k === 'h' || key === '?') toggleHelp();
  else if (key === 'Escape') $('help').classList.remove('show');
  else if (k === 'v') {
    const sel = cam.mode === 'follow' ? cam.target : null;
    if (sel) reverseTrain(sel);
  }
  else if (k === 'p') {
    poiIdx = (poiIdx + 1) % POIS.length;
    cam.mode = 'poi';
    cam.poi = POIS[poiIdx];
    cam.target = null;
    audio.ding();
    refreshUI();
  }
  else if (key === 'ArrowUp') { const sel = cam.mode === 'follow' ? cam.target : null; if (sel) setSelSpeed(sel.targetMph + 5); return true; }
  else if (key === 'ArrowDown') { const sel = cam.mode === 'follow' ? cam.target : null; if (sel) setSelSpeed(sel.targetMph - 5); return true; }
  else if (key === 'ArrowLeft') { cycleTrain(-1); return true; }
  else if (key === 'ArrowRight') { cycleTrain(1); return true; }
  return false;
}
window.addEventListener('keydown', e => { if (pressKey(e.key, e.code)) e.preventDefault(); });
// test harness: ?keys=5:v,8:b fires key presses at sim times
const KEYSCRIPT = (PARAMS.get('keys') || '').split(',').filter(Boolean)
  .map(s => { const c = s.split(':'); return { t: +c[0], key: c[1] }; })
  .sort((a, b) => a.t - b.t);

// ============================================================ tapping things
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
canvas.addEventListener('pointerdown', e => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(tappables, true);
  if (!hits.length) return;
  let obj = hits[0].object;
  while (obj && !obj.userData.tap) obj = obj.parent;
  if (!obj) return;
  const { kind, data } = obj.userData.tap;
  if (kind === 'duck') {
    audio.quack(data.scale.x > 0.7 ? 1 : 1.6);
    data.userData.anim.flap = 1;
  } else if (kind === 'monkey') {
    audio.monkey();
    data.userData.anim.spin = 1;
  } else if (kind === 'cow') {
    audio.moo();
    data.userData.mooT = 1;
  } else if (kind === 'train') {
    audio.horn(data.def.horn);
    selectTrain(data);
  } else if (kind === 'switch') {
    toggleSwitch(data);
  } else if (kind === 'bridge') {
    setBridge(!bridge.up);
  } else if (kind === 'station') {
    selectStation(STATIONS.indexOf(data));
  }
});

// ============================================================ main loop
const clock = new THREE.Clock();
let elapsed = 0;
let started = false;
let quackTimer = 8;

function step(dt) {
  elapsed += dt;
  while (KEYSCRIPT.length && elapsed >= KEYSCRIPT[0].t) pressKey(KEYSCRIPT.shift().key);
  if (PARAMS.has('dbg') && Math.floor(elapsed) > Math.floor(elapsed - dt)) {
    console.log('DBG t=' + Math.floor(elapsed) + ' ' + trains.map(t =>
      t.def.id + ':' + t.hist[t.hist.length - 1].seg.id + '@' + t.u.toFixed(1)
      + (t.flip ? 'R' : '') + ' v=' + t.v.toFixed(1) + ' n=' + t.vehicles.length).join(' | ')
      + ' dk=' + (derrick.active ? derrick.phase + '@' + derrick.u.toFixed(0) : '-')
      + ' fc=' + freeCars.length);
  }
  if (started) audio.updateMusic();
  updateBridge(dt);
  updateSwitches(dt);
  for (const t of [...trains]) updateTrain(t, dt);
  checkCollisions();
  if (!derrick.active && bridgeIsDown()) {
    const owner = trains.find(t => t.tenderParked && t.tender);
    if (owner) startDerrick(owner);
  }
  updateDerrick(dt);
  checkFreeCars();
  updateLoose(dt);
  updatePuffs(dt);

  for (const st of STATIONS) {
    if (st.signBounce > 0) {
      st.signBounce = Math.max(0, st.signBounce - dt * 1.6);
      st.sign.position.y = 3.6 + Math.sin(st.signBounce * 12) * 0.4 * st.signBounce;
    }
  }
  tryRiders(dt);
  updateRiders(dt);
  for (const d of ducks) {
    if (d.userData.riding) continue;
    const a = d.userData.anim;
    a.a += dt * a.w;
    d.position.set(
      a.center.x + Math.cos(a.a) * a.r,
      Math.sin(elapsed * 3 + a.r * 5) * 0.05 + (a.flap > 0 ? a.flap * 0.4 : 0),
      a.center.z + Math.sin(a.a) * a.r
    );
    d.rotation.y = -a.a;
    if (a.flap > 0) {
      a.flap = Math.max(0, a.flap - dt * 1.6);
      const f = Math.sin(elapsed * 28) * 0.9 * a.flap;
      a.wings[0].rotation.z = -0.3 - f;
      a.wings[1].rotation.z = 0.3 + f;
    }
  }
  quackTimer -= dt;
  if (quackTimer < 0) {
    quackTimer = 8 + Math.random() * 9;
    if (started) audio.quack(Math.random() < 0.5 ? 1 : 1.6);
  }
  for (const m of monkeys) {
    if (m.userData.riding) continue;
    const a = m.userData.anim;
    let rot = Math.sin(elapsed * 1.7 + a.phase) * 0.4;
    if (a.spin > 0) {
      a.spin = Math.max(0, a.spin - dt * 1.3);
      rot += (1 - a.spin) * Math.PI * 2;
    }
    m.rotation.z = rot;
  }
  for (const c of cows) {
    if (c.userData.riding) continue;
    if (c.userData.mooT > 0) {
      c.userData.mooT = Math.max(0, c.userData.mooT - dt);
      c.rotation.z = Math.sin(c.userData.mooT * 14) * 0.06;
    }
  }
  for (const c of clouds) {
    c.position.x += c.userData.v * dt;
    if (c.position.x > 290) c.position.x = -290;
  }
  barge.rotation.z = Math.sin(elapsed * 0.7) * 0.015;
  barge.position.y = Math.sin(elapsed * 0.9) * 0.05;
  const tug = barge.userData.tug;
  tug.userData.dir = tug.userData.dir || 1;
  tug.position.z += tug.userData.dir * dt * 0.7;
  if (tug.position.z > 132) tug.userData.dir = -1;
  if (tug.position.z < 112) tug.userData.dir = 1;
  tug.rotation.y = tug.userData.dir > 0 ? 0 : Math.PI;
  tug.position.y = Math.sin(elapsed * 1.1) * 0.05;
  windmill.userData.sails.rotation.z += dt * 0.7;
  lighthouse.userData.beacon.rotation.y += dt * 1.6;

  if (DEBUG_VIEW) {
    const [vx, vz, vd = 14, vh = 7] = DEBUG_VIEW.split(',').map(Number);
    camera.position.set(vx + vd, vh, vz + vd * 0.6);
    camera.lookAt(vx, 1.2, vz);
  } else {
    updateCamera(dt, elapsed);
  }
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  step(dt);
  renderer.render(scene, camera);
}

// ============================================================ boot
function applyTestParams() {
  if (PARAMS.has('bridge')) setBridge(PARAMS.get('bridge') === 'up');
  if (PARAMS.has('sw')) {
    PARAMS.get('sw').split(',').forEach((v, i) => {
      if (switches[i]) {
        switches[i].node.sel = +v ? 1 : 0;
        switches[i].t = switches[i].node.sel;
        switches[i].aim();
        switches[i].arrow.rotation.y = switches[i].yaw;
        switches[i].rebuildPoints(switches[i].t);
      }
    });
  }
  if (PARAMS.has('spawn')) {
    for (const entry of PARAMS.get('spawn').split(',')) {
      const m = entry.match(/^(\w+?)@(\d)(r?)(?::(\d+))?$/);
      if (!m) continue;
      const idx = TRAIN_DEFS.findIndex(d => d.id === m[1]);
      if (idx >= 0) spawnTrain(idx, +m[2], m[4] !== undefined ? +m[4] : undefined, m[3] ? -1 : 1);
    }
  }
  if (PARAMS.has('follow')) {
    const tr = trains.find(t => t.def.id === PARAMS.get('follow'));
    if (tr) { selectTrain(tr); cam.angle = +(PARAMS.get('angle') || 0); }
  }
}

if (PARAMS.has('dbg')) {
  const info = { segs: {}, stations: STATIONS.map(s => +s.s.toFixed(1)) };
  for (const id in SEGS) info.segs[id] = +SEGS[id].len.toFixed(1);
  console.log('DBG ' + JSON.stringify(info));
}

const splash = $('splash');
function start() {
  if (started) return;
  started = true;
  audio.init();
  audio.resume();
  splash.style.display = 'none';
  if (!trains.length) {
    const tr = spawnTrain(trainIdx('choochoo'), 0);
    if (tr) {
      selectTrain(tr);
      showBanner('CHOO CHOO!', '#fff');
    }
  }
  refreshUI();
}
splash.addEventListener('pointerdown', start);

if (PARAMS.has('nosplash')) {
  splash.style.display = 'none';
  started = true;
  applyTestParams();
  if (!trains.length && !PARAMS.has('empty')) spawnTrain(trainIdx('choochoo'), 0) && selectTrain(trains[0]);
  if (PARAMS.has('tour')) { cam.mode = 'tour'; cam.target = null; }
  if (PARAMS.has('help')) toggleHelp();
  if (PARAMS.has('warp')) for (let i = 0; i < +PARAMS.get('warp') * 30; i++) step(1 / 30);
} else {
  applyTestParams();
}
refreshUI();
tick();
