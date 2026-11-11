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
    for (const node of Object.values(NODES)) if (!node.terminal) setAdventureSwitch(node, 0);
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
    for (let i = 0; i < 300 && adventure.passage; i++) updateAdventures(1 / 30, i / 30);
    assert(!adventure.passage && !$('portalWash').classList.contains('tunnel'), 'tunnel controls stayed blocked');
  };
  const unlockKeys = ['choochoo-volcano', 'choochoo-star-garden'];
  const previousUnlock = {};
  for (const key of unlockKeys) try { previousUnlock[key] = PARAMS.has('fresh') ? null : localStorage.getItem(key); } catch (_) {}

  clean();
  const placeOn = (t, seg, dir = 1, u = 45) => {
    t.hist = [{ seg, dir }]; t.u = u; t.passageBlocked = false; placeVehicles(t);
  };
  const drive = (t, seconds) => {
    for (let i = 0; i < seconds * 30; i++) {
      updateTrain(t, 1 / 30);
      if (adventure.passage || volcanoPassageDirection(t)) updateAdventures(1 / 30, i / 30);
    }
  };
  test('Outer volcano is a circuit with separate town and tunnel turnouts', () => {
    assert(!NODES.NJB.terminal, 'old volcano buffers remain');
    assert(NODES.NJA.branches[1].seg === 'JOUT' && NODES.NJB.branches[1].seg === 'VT', 'missing separate exits');
    assert(switches.length === 16, 'expected 16 real switches');
  });
  test('Volcano has three distinct named stations and a raised alternative route', () => {
    const stations = STATIONS.filter(s => s.world === 'volcano');
    assert(stations.length === 3 && new Set(stations.map(s => s.seg)).size === 3, 'missing stations');
    assert(stations.every(s => s.name), 'unnamed station');
    assert(SEGS.MGBRIDGE.samples.some(p => p.y > 4), 'missing lava crossing');
  });
  test('Secret destination is inaccessible until discovered', () => {
    adventure.unlocked = false;
    assert(!visitAdventureWorld('volcano'), 'secret accessible while locked');
    assert(!visitAdventureWorld('missing'), 'invalid world accepted');
  });
  test('Every attraction is connected to a real object and action', () => {
    for (const world of Object.values(adventure.worlds)) for (const id of world.actions) {
      const a = adventure.things[id];
      assert(a && a.obj instanceof THREE.Object3D && typeof a.action === 'function', 'missing ' + id);
    }
  });
  for (let def = 0; def < TRAIN_DEFS.length; def++) {
    test(TRAIN_DEFS[def].name + ': spawns both ways at all six adventure stations', () => {
      for (const st of [4, 5, 6, 7, 8, 9]) for (const dir of [1, -1]) {
        clean(); const t = spawnTrain(def, st, 35, dir); assert(t, 'failed to spawn'); spaced(t);
        for (let n = 0; n < 4; n++) { doReverse(t); placeVehicles(t); spaced(t); }
      }
    });
    test(TRAIN_DEFS[def].name + ': repeated world trips preserve car spacing after reversals', () => {
      clean(); const t = spawnTrain(def, 0, 73); selectTrain(t);
      for (const st of [4, 5, 6, 7, 8, 9, 0, 7, 4]) {
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
  test('Default outer loop runs indefinitely in both directions', () => {
    for (const dir of [1, -1]) {
      clean(); const t = spawnTrain(5, 6, 180, dir);
      for (let i = 0; i < 5; i++) {
        run(t, 30); spaced(t);
        assert(t.v > 0 && ['JN1', 'JN2', 'JTOP'].includes(t.hist.at(-1).seg.id), 'left or stopped on circuit');
      }
    }
  });
  test('A normal arrival from the desert joins the default circuit', () => {
    clean(); const t = spawnTrain(2, 6, 100); placeOn(t, SEGS.L3, 1, SEGS.L3.len - 50);
    run(t, 100); spaced(t);
    assert(['JN1', 'JN2', 'JTOP'].includes(t.hist.at(-1).seg.id) && t.v > 0, 'arrival did not keep circling');
  });
  test('N alone sends the circling train back toward town and the desert', () => {
    clean(); const t = spawnTrain(2, 6, 100); setAdventureSwitch(NODES.NJA, 1);
    let reached = false;
    for (let i = 0; i < 1800; i++) { updateTrain(t, 1 / 30); if (t.hist.at(-1).seg === SEGS.L3) { reached = true; break; } }
    assert(reached && t.hist.at(-1).dir === -1, 'town switch did not send train north'); spaced(t);
  });
  test('Duplicate letters operate only the switch nearest the train, including reverse', () => {
    clean(); const t = spawnTrain(2, 7, 0); selectTrain(t);
    pressKey('q'); assert(NODES.MGW.sel === 1 && NODES.N1.sel === 0, 'Q changed distant switch');
    moveAdventureTrain(t, STATIONS[6]); doReverse(t); pressKey('u');
    assert(NODES.NJB.sel === 1 && NODES.NCN.sel === 0, 'U changed distant switch');
    clean(); camLook.copy(NODES.MGB.pos); pressKey('w');
    assert(NODES.MGB.sel === 1 && NODES.N2.sel === 0, 'camera fallback picked wrong switch');
  });
  test('Discovery and whistles never open the default entrance', () => {
    clean(); adventure.unlocked = false; unlockVolcano(false); adventure.current = 'jungle'; adventureWhistle();
    assert(NODES.NJB.sel === 0 && !adventure.passage, 'discovery bypassed turnout');
  });
  test('Volcano default loop runs in both directions and across reversals', () => {
    clean(); const t = spawnTrain(5, 7, 180);
    for (let i = 0; i < 5; i++) {
      run(t, 30); spaced(t); doReverse(t); placeVehicles(t); spaced(t);
      assert(t.v > 0 && t.hist.every(h => ['MG0', 'MG1', 'MG2', 'MG3'].includes(h.seg.id)), 'left or stopped on inner loop');
    }
  });
  test('Q and W choose the lava bridge in either direction', () => {
    for (const dir of [1, -1]) {
      clean(); const t = spawnTrain(2, 7, 120); setAdventureSwitch(NODES.MGW, 1); setAdventureSwitch(NODES.MGB, 1);
      placeOn(t, dir === 1 ? SEGS.MG0 : SEGS.MG2, dir, 25);
      let seen = false;
      for (let i = 0; i < 1800; i++) { updateTrain(t, 1 / 30); if (t.hist.at(-1).seg === SEGS.MGBRIDGE) seen = true; }
      assert(seen && t.v > 0, 'bridge route stalled'); spaced(t);
    }
  });
  test('Switch ahead looks through passive joins to the next real turnout', () => {
    clean(); const t = spawnTrain(2, 9, 0); selectTrain(t);
    assert(toggleUpcoming(t) && NODES.MGW.sel === 1, 'could not find next real switch');
  });
  test('Opening U routes a moving train into the tunnel without a visible teleport', () => {
    clean(); const t = spawnTrain(2, 6, 100); selectTrain(t);
    const before = t.vehicles[0].g.position.clone(); useVolcanoDoor();
    assert(t.vehicles[0].g.position.equals(before) && !adventure.passage, 'opening a switch teleported the train');
    drive(t, 60); spaced(t);
    assert(adventure.current === 'volcano' && t.hist.at(-1).seg.id.startsWith('MG'), 'train did not enter');
  });
  test('All six trains enter and exit, preserving paused speed and reversed consists', () => {
    for (let def = 0; def < TRAIN_DEFS.length; def++) for (const reversed of [false, true]) {
      clean(); const t = spawnTrain(def, 6, 0); selectTrain(t); if (reversed) doReverse(t);
      placeOn(t, SEGS.VT, 1, adventure.outerMouth - 10);
      assert(beginVolcanoPassage(t), 'entry rejected'); rideTunnel(); spaced(t);
      assert(adventure.current === 'volcano' && t.targetMph === 0 && t.v === 0, 'paused entry failed');
      placeOn(t, SEGS.MX, 1, SEGS.MX.len - 40); t.u += 50; advanceChain(t); placeVehicles(t);
      assert(beginVolcanoPassage(t), 'exit rejected'); rideTunnel(); spaced(t);
      assert(adventure.current === 'jungle' && t.hist.at(-1).dir === -1 && t.targetMph === 0, 'paused exit failed');
    }
  });
  test('Both scene changes happen only after a frame of full black', () => {
    for (const direction of ['in', 'out']) {
      clean(); const t = spawnTrain(2, 6, 30); selectTrain(t);
      placeOn(t, direction === 'in' ? SEGS.VT : SEGS.MP, direction === 'in' ? 1 : -1,
        direction === 'in' ? adventure.outerMouth - 10 : 20);
      assert(beginVolcanoPassage(t), 'passage rejected');
      assert(!beginVolcanoPassage(t) && !visitAdventureWorld('home'), 'second trip interrupted passage');
      let sawBlack = false, crossed = false;
      for (let i = 0; i < 300 && adventure.passage; i++) {
        const before = adventure.passage.arrived;
        updateAdventures(1 / 30, i / 30);
        if (adventure.passage && adventure.passage.arrived && !before) {
          assert(sawBlack && $('portalWash').style.opacity === '1', 'visible scene relocation'); crossed = true;
        }
        if ($('portalWash').style.opacity === '1') sawBlack = true;
      }
      assert(crossed && !adventure.passage && t.targetMph === 30, 'passage did not finish');
    }
  });
  test('E exits the inner circuit and continues all the way into the desert', () => {
    clean(); const t = spawnTrain(2, 8, 100); selectTrain(t); setAdventureSwitch(NODES.MGC, 1);
    let left = false, desert = false;
    for (let i = 0; i < 6000; i++) {
      drive(t, 1 / 30);
      if (t.hist.at(-1).seg === SEGS.VT) left = true;
      if (t.hist.at(-1).seg === SEGS.DS1) { desert = true; break; }
    }
    assert(left && desert && t.hist.at(-1).dir === -1, 'exit required another switch or reverse'); spaced(t);
  });
  test('Passengers and a parked harbor tender survive the tunnel', () => {
    clean(); const t = spawnTrain(2, 0, 45); selectTrain(t);
    const tender = t.vehicles.splice(1, 1)[0]; t.offsets.splice(1, 1);
    barge.add(tender.g); t.tender = tender; t.tenderParked = true; const pos = tender.g.position.clone();
    moveAdventureTrain(t, STATIONS[6]);
    const duck = hoppers.find(h => h.kind === 'duck'); mountRider(duck, t, freeSeat(t));
    placeOn(t, SEGS.VT, 1, adventure.outerMouth - 10); beginVolcanoPassage(t); rideTunnel(); spaced(t);
    assert(adventure.current === 'volcano' && duck.obj.parent === riders[0].car.g, 'passenger lost');
    assert(tender.g.parent === barge && tender.g.position.equals(pos), 'parked tender moved');
  });
  test('An occupied bore waits safely instead of placing the train outside the tunnel', () => {
    clean(); const parked = spawnTrain(0, 7, 0); placeOn(parked, SEGS.MP, 1, 70);
    const t = spawnTrain(2, 6, 35); selectTrain(t); placeOn(t, SEGS.VT, 1, adventure.outerMouth - 10);
    beginVolcanoPassage(t); rideTunnel();
    assert(t.passageBlocked && t.hist.at(-1).seg === SEGS.VT, 'train relocated around obstruction');
    checkCollisions(); assert(parked.state === 'run' && t.state === 'run', 'arrival collision');
    despawnTrain(parked, false); assert(toggleUpcoming(t), 'retry rejected'); rideTunnel();
    assert(adventure.current === 'volcano' && !t.passageBlocked, 'retry failed'); spaced(t);
  });
  test('An unfollowed train still enters through the tunnel', () => {
    clean(); const t = spawnTrain(2, 6, 35); placeOn(t, SEGS.VT, 1, adventure.outerMouth - 10);
    cam.target = null; adventure.lastTrain = null; updateAdventures(1 / 30, 0);
    assert(adventure.passage && adventure.passage.train === t, 'only selected trains can enter'); rideTunnel();
  });
  test('A second train waits while the tunnel is occupied by a passage', () => {
    clean(); const first = spawnTrain(0, 6, 55), second = spawnTrain(2, 8, 55);
    placeOn(first, SEGS.VT, 1, adventure.outerMouth - 10); beginVolcanoPassage(first);
    while (adventure.passage.t < 3.1) updateAdventures(1 / 30, 0);
    placeOn(second, SEGS.VT, 1, adventure.outerMouth - 10); const before = second.u;
    run(second, 10); assert(second.u === before && second.v === 0, 'second train reached a hidden endpoint');
    for (let i = 0; i < 150 && adventure.passage.train === first; i++) updateAdventures(1 / 30, 0);
    assert(adventure.passage && adventure.passage.train === second, 'waiting train did not get its turn');
    run(first, 20); // The first train rolls away from the arrival berth.
    rideTunnel(); assert(second.hist.at(-1).seg === SEGS.MP && !second.passageBlocked, 'second passage failed');
  });
  test('A blocked train can reverse away from the tunnel', () => {
    clean(); const t = spawnTrain(2, 6, 35); placeOn(t, SEGS.VT, 1, adventure.outerMouth - 10);
    t.passageBlocked = true; doReverse(t); run(t, 0.5);
    assert(!t.passageBlocked && t.v > 0 && t.hist.at(-1).dir === -1, 'reverse remained blocked');
  });
  test('The tunnel works while exploring without a train', () => {
    clean(); useVolcanoDoor(); rideTunnel();
    assert(adventure.current === 'volcano' && trains.length === 0, 'scenery-only passage failed');
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
  for (const key of unlockKeys) if (key in previousUnlock) try {
    if (previousUnlock[key] === null) localStorage.removeItem(key);
    else localStorage.setItem(key, previousUnlock[key]);
  } catch (_) {}
  const failed = results.filter(r => !r.pass);
  const pre = document.createElement('pre'); pre.id = 'testResults'; pre.dataset.failed = String(failed.length);
  pre.style.cssText = 'position:fixed;inset:20px;z-index:100;background:#fffdf3;color:#234;padding:24px;overflow:auto;white-space:pre-wrap;user-select:text;font:14px/1.6 monospace;border-radius:18px';
  pre.textContent = `${results.length - failed.length}/${results.length} checks passed\n\n`
    + results.map(r => `${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.error ? '\n      ' + r.error : ''}`).join('\n');
  document.body.appendChild(pre);
  console.log(pre.textContent);
})();
