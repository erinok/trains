/* Browser regression checks. Open /?test=1; no test runner or build needed.
   Runs against real THREE curves, train builders, and the actual game runtime. */
'use strict';

(() => {
  const results = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const test = (name, fn) => {
    try { fn(); results.push({ name, pass: true }); }
    catch (error) { results.push({ name, pass: false, error: error.message }); }
  };
  const clean = () => {
    if (adventure.passage) finishVolcanoPassage();
    for (const r of [...riders]) {
      r.h.homeParent.add(r.h.obj); r.h.obj.position.copy(r.h.homePos);
      r.h.obj.rotation.copy(r.h.homeRot); r.h.obj.userData.riding = false; r.car.rider = null;
    }
    riders.length = 0;
    for (const t of [...trains]) despawnTrain(t, false);
    cam.target = null; adventure.lastTrain = null;
  };
  const spaced = t => {
    const cur = t.hist[t.hist.length - 1];
    assert(t.u <= cur.seg.len + 0.001, 'lead is on its segment');
    assert(t.offsets.every(o => o >= 0), 'offsets are nonnegative');
    for (let i = 0; i < t.vehicles.length; i++) {
      const p = t.vehicles[i].g.position;
      assert([p.x, p.y, p.z].every(Number.isFinite), 'finite vehicle position');
      if (i) {
        const expected = (t.vehicles[i - 1].len + t.vehicles[i].len) / 2 + 0.55;
        assert(p.distanceTo(t.vehicles[i - 1].g.position) > expected * 0.65,
          t.def.id + ' car ' + i + ' collapsed into its neighbor');
      }
    }
  };
  const run = (t, seconds) => { for (let i = 0; i < seconds * 30; i++) updateTrain(t, 1 / 30); };
  const rideTunnel = () => {
    for (let i = 0; i < 240 && adventure.passage; i++) updateAdventures(1 / 30, i / 30);
    assert(!adventure.passage && !$('portalWash').classList.contains('tunnel'), 'tunnel controls stayed blocked');
  };
  let previousUnlock;
  try { previousUnlock = localStorage.getItem('choochoo-star-garden'); } catch (_) {}
  // Optional QA teardown: leave the newly added secret undiscovered for play.
  if (PARAMS.has('fresh')) previousUnlock = null;

  clean();
  test('Original twelve switches and both reversing volcano approaches remain', () => {
    assert(switches.length === 12, 'switch count changed');
    assert(NODES.NJB.terminal, 'volcano buffers removed');
    for (const id of ['JN1', 'JN2']) assert(!SEGS[id].gaps.some(g => g[1] === SEGS[id].len), 'gap at buffers');
  });
  test('Secret loop has continuous rails through both unswitched junctions', () => {
    for (const id of ['MG1', 'MG2']) assert(SEGS[id].gaps.length === 0, id + ' has missing rail');
    assert(NODES.MGA.trunk.seg === 'MG2' && NODES.MGB.trunk.seg === 'MG1', 'loop is disconnected');
  });
  test('Secret destination is inaccessible until discovered', () => {
    adventure.unlocked = false;
    assert(!visitAdventureWorld('magic'), 'secret accessible while locked');
    assert(!visitAdventureWorld('missing'), 'invalid world accepted');
  });
  test('Every attraction is connected to a real object and action', () => {
    for (const world of Object.values(adventure.worlds)) for (const id of world.actions) {
      const a = adventure.things[id];
      assert(a && a.obj instanceof THREE.Object3D && typeof a.action === 'function', 'missing ' + id);
    }
  });
  for (let def = 0; def < TRAIN_DEFS.length; def++) {
    test(TRAIN_DEFS[def].name + ': spawns both ways at all four new stations', () => {
      for (const st of [4, 5, 6, 7]) for (const dir of [1, -1]) {
        clean(); const t = spawnTrain(def, st, 35, dir); assert(t, 'failed to spawn'); spaced(t);
        for (let n = 0; n < 4; n++) { doReverse(t); placeVehicles(t); spaced(t); }
      }
    });
    test(TRAIN_DEFS[def].name + ': repeated world trips preserve car spacing after reversals', () => {
      clean(); const t = spawnTrain(def, 0, 73); selectTrain(t);
      for (const st of [4, 5, 6, 7, 0, 7, 4]) {
        doReverse(t); doReverse(t); doReverse(t);
        t.revPending = true; t.revHold = 1;
        assert(moveAdventureTrain(t, STATIONS[st]), 'trip rejected'); spaced(t);
        assert(t.u >= Math.max(...t.offsets), 'trailing cars clamped to endpoint');
        assert(t.targetMph === 73, 'chosen speed changed');
        assert(!t.revPending && t.revHold === 0, 'queued reverse survived trip');
      }
    });
  }
  test('A paused train stays paused after a world trip', () => {
    clean(); const t = spawnTrain(2, 0, 0); moveAdventureTrain(t, STATIONS[5]); run(t, 1);
    assert(t.v === 0 && t.targetMph === 0, 'paused train started moving'); spaced(t);
  });
  test('World trips find space when another train occupies the station', () => {
    clean(); const first = spawnTrain(2, 5, 0), second = spawnTrain(5, 0, 0);
    assert(moveAdventureTrain(second, STATIONS[5]), 'no alternate space found');
    spaced(first); spaced(second); checkCollisions();
    assert(first.state === 'run' && second.state === 'run', 'world trip caused collision');
  });
  test('World trip carries a jumping duck and a seated monkey with their cars', () => {
    clean(); const t = spawnTrain(3, 0, 35);
    const duck = hoppers.find(h => h.kind === 'duck'), monkey = hoppers.find(h => h.kind === 'monkey');
    mountRider(duck, t, freeSeat(t));
    updateRiders(0.75);
    mountRider(monkey, t, freeSeat(t));
    assert(moveAdventureTrain(t, STATIONS[7]), 'trip rejected');
    assert(riders.length === 2 && riders.every(r => r.mode === 'ride'), 'rider not seated');
    for (const r of riders) assert(r.h.obj.parent === r.car.g && r.car.rider === r.h, 'rider/car link lost');
    spaced(t);
  });
  test('New duck families are available as passengers', () => {
    assert(adventure.ducks.length === 9, 'missing a duck family');
    for (const d of adventure.ducks) assert(hoppers.some(h => h.obj === d), 'duck cannot board');
  });
  test('Secret loop runs in both directions, across joins, without collapsing cars', () => {
    clean(); const t = spawnTrain(5, 7, 180);
    for (let i = 0; i < 4; i++) {
      run(t, 22); spaced(t); doReverse(t); placeVehicles(t); spaced(t);
      assert(t.hist.every(h => ['MG1', 'MG2'].includes(h.seg.id)), 'train left the loop');
    }
  });
  test('Locked volcano buffers stop both routes and still allow reversal', () => {
    for (const seg of [SEGS.JN1, SEGS.JN2]) {
      clean(); adventure.unlocked = false;
      const t = spawnTrain(2, 6, 100);
      t.hist = [{ seg, dir: 1 }]; t.u = Math.max(...t.offsets) + 5; placeVehicles(t);
      run(t, 60); spaced(t);
      assert(t.v === 0 && t.u <= terminalStopU(t, t.hist[0]), 'train passed buffers');
      doReverse(t); run(t, 1); assert(t.v > 0, 'train cannot leave buffers'); spaced(t);
    }
  });
  test('A jungle whistle reveals the secret and the picture button', () => {
    clean(); adventure.unlocked = false;
    const t = spawnTrain(2, 6, 0); selectTrain(t); adventure.current = 'jungle';
    adventureWhistle();
    assert(adventure.unlocked && !adventure.worldButtons.magic.hidden, 'whistle failed to reveal garden');
    assert(adventure.things.door.label === 'Go inside!', 'door does not offer entry');
  });
  test('The switch opens a stopped train’s tunnel ride, moving worlds only under black', () => {
    clean(); const t = spawnTrain(2, 6, 30); selectTrain(t);
    t.u = terminalStopU(t, t.hist[0]); t.v = 0; placeVehicles(t);
    adventure.unlocked = false;
    assert(toggleUpcoming(t), 'switch ahead does not open the tunnel');
    assert(adventure.unlocked && adventure.passage, 'switch did not start the ride');
    assert(!beginVolcanoPassage(t) && !visitAdventureWorld('home'), 'a second trip interrupted the ride');
    let sawBlack = false, crossed = false;
    for (let i = 0; i < 240 && adventure.passage; i++) {
      const before = adventure.passage.arrived;
      updateAdventures(1 / 30, i / 30);
      if ($('portalWash').style.opacity === '1') sawBlack = true;
      if (adventure.passage && adventure.passage.arrived && !before) {
        assert(sawBlack && $('portalWash').style.opacity === '1', 'world changed before full black'); crossed = true;
      }
      spaced(t);
    }
    assert(crossed && !adventure.passage, 'ride never completed');
    assert(t.hist[0].seg === SEGS.MG1 && adventure.current === 'magic', 'passage failed');
    assert(t.targetMph === 30 && cam.mode === 'follow', 'ride did not restore the train controls');
    assert(visitAdventureWorld('home'), 'cannot return home');
    assert(t.hist[0].seg === SEGS.A, 'train did not return home');
  });
  test('All six trains enter from both routes, including paused and reversed consists', () => {
    for (let def = 0; def < TRAIN_DEFS.length; def++) for (const seg of [SEGS.JN1, SEGS.JN2]) {
      clean(); const t = spawnTrain(def, 6, 0); selectTrain(t);
      doReverse(t);
      t.hist = [{ seg, dir: 1 }]; t.u = terminalStopU(t, t.hist[0]); placeVehicles(t);
      adventure.unlocked = false; toggleUpcoming(t); rideTunnel(); spaced(t);
      assert(adventure.current === 'magic' && t.targetMph === 0 && t.v === 0, 'paused train failed its trip');
    }
  });
  test('An already-open entrance picks up a train stopped just short of the buffers', () => {
    clean(); const t = spawnTrain(2, 6, 35); selectTrain(t);
    t.u = terminalStopU(t, t.hist[0]) - 0.6; t.v = 0; placeVehicles(t);
    adventure.unlocked = true; updateAdventures(1 / 30, 0);
    assert(adventure.passage, 'train was stranded short of the entrance'); rideTunnel(); spaced(t);
  });
  test('A parked harbor tender does not block the engine’s volcano trip', () => {
    clean(); const t = spawnTrain(2, 0, 45); selectTrain(t);
    const tender = t.vehicles.splice(1, 1)[0]; t.offsets.splice(1, 1);
    barge.add(tender.g); t.tender = tender; t.tenderParked = true;
    const pos = tender.g.position.clone();
    assert(moveAdventureTrain(t, STATIONS[6]), 'parked tender blocked world travel');
    t.u = terminalStopU(t, t.hist[0]); placeVehicles(t);
    useVolcanoDoor(); rideTunnel(); spaced(t);
    assert(adventure.current === 'magic', 'engine did not enter');
    assert(t.tender === tender && tender.g.parent === barge && tender.g.position.equals(pos), 'parked tender moved');
  });
  test('Passengers stay with their cars through the tunnel', () => {
    clean(); const t = spawnTrain(3, 6, 0); selectTrain(t);
    const duck = hoppers.find(h => h.kind === 'duck'); mountRider(duck, t, freeSeat(t));
    adventure.unlocked = true; beginVolcanoPassage(t); rideTunnel();
    assert(riders.length === 1 && riders[0].mode === 'ride' && duck.obj.parent === riders[0].car.g, 'passenger lost');
  });
  test('The tunnel arrival leaves room to roll out past a parked train', () => {
    clean(); const parked = spawnTrain(0, 7, 0);
    parked.u = 60; placeVehicles(parked);
    const t = spawnTrain(2, 6, 0); selectTrain(t);
    adventure.unlocked = true; beginVolcanoPassage(t);
    for (let i = 0; i < 240 && adventure.passage; i++) {
      updateAdventures(1 / 30, i / 30); checkCollisions();
      assert(parked.state === 'run' && t.state === 'run', 'tunnel ride collided with the parked train');
    }
    assert(adventure.current === 'magic' && !adventure.passage, 'occupied exit blocked the ride'); spaced(t);
  });
  test('The tunnel also works while exploring without a train', () => {
    clean(); adventure.unlocked = false; useVolcanoDoor(); rideTunnel();
    assert(adventure.current === 'magic' && trains.length === 0, 'scenery-only entrance failed');
  });
  test('Crashes and falling tenders cannot be interrupted by teleporting a consist', () => {
    clean(); const t = spawnTrain(2, 0, 0), pos = t.vehicles[0].g.position.clone();
    t.state = 'jump'; assert(!moveAdventureTrain(t, STATIONS[5]), 'jump interrupted');
    t.state = 'crashed'; assert(!beginVolcanoPassage(t), 'crash interrupted');
    t.state = 'run'; t.tenderFall = {};
    assert(!moveAdventureTrain(t, STATIONS[5]) && !beginVolcanoPassage(t), 'tender fall interrupted');
    t.tenderFall = null;
    assert(t.vehicles[0].g.position.equals(pos), 'rejected trip moved train');
  });
  test('Attraction actions and animation updates run without errors', () => {
    clean();
    for (const id of Object.keys(adventure.things)) {
      triggerAdventure(id); updateAdventures(1 / 30, 1);
    }
  });
  clean();
  if (previousUnlock !== undefined) try {
    if (previousUnlock === null) localStorage.removeItem('choochoo-star-garden');
    else localStorage.setItem('choochoo-star-garden', previousUnlock);
  } catch (_) {}
  const failed = results.filter(r => !r.pass);
  const pre = document.createElement('pre'); pre.id = 'testResults'; pre.dataset.failed = String(failed.length);
  pre.style.cssText = 'position:fixed;inset:20px;z-index:100;background:#fffdf3;color:#234;padding:24px;overflow:auto;white-space:pre-wrap;user-select:text;font:14px/1.6 monospace;border-radius:18px';
  pre.textContent = `${results.length - failed.length}/${results.length} checks passed\n\n`
    + results.map(r => `${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.error ? '\n      ' + r.error : ''}`).join('\n');
  document.body.appendChild(pre);
  console.log(pre.textContent);
})();
