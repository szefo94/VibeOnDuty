import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createServer as portProbe } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const uncachedHandling = execFileSync('git', ['-c', 'safe.directory=C:/Programowanie/VibeOnDuty',
  'show', '1e537a4:src/builders/weaponHandling.js'], { encoding: 'utf8' })
  .replace("import * as THREE from 'three';", 'const THREE = window.__THREE;')
  .replace('motion-manifest.json\';', 'motion-manifest.json?import\';');

test('owner cache: loaded handling preserves original rotations, contacts and rest with bounded lookups', async ({ page }, info) => {
  test.setTimeout(90000);
  await page.route('**/src/builders/__uncachedHandling.js', route =>
    route.fulfill({ contentType: 'text/javascript', body: uncachedHandling }));
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const g = await import(src + 'builders/enemyGLTF.js');
    const h = await import(src + 'builders/weaponHandling.js');
    const original = await import(src + 'builders/__uncachedHandling.js');
    (await import(src + 'input.js')).setGameRunning(false);
    const rows = [];
    const snapshot = (actor, owner) => {
      const bones = []; actor.mesh.traverse(n => { if (n.isBone) bones.push([n.name,
        n.position.toArray(), n.quaternion.toArray(), n.scale.toArray()]); });
      return { bones, parts: Object.entries(owner.parts).map(([key, part]) =>
        [key, part?.position.toArray(), part?.quaternion.toArray()]),
        sample: owner.sample, contacts: owner.contacts,
        root: actor.mesh.position.toArray(), mount: owner.root.parent.quaternion.toArray() };
    };
    for (const [weapon, role] of [['m4', 'assault'], ['p90', 'smg'], ['awp', 'sniper'], ['pistol', 'pistol']]) {
      const actor = g.buildEnemyMesh(0, 0, role), baseline = g.buildEnemyMesh(0, 0, role);
      const root = actor.mesh.getObjectByName('enemyWeaponMount').children[0];
      const baselineRoot = baseline.mesh.getObjectByName('enemyWeaponMount').children[0];
      const owner = h.getWeaponHandling(root), uncached = original.createWeaponHandling({
        weapon, root: baselineRoot, skeleton: baseline.mesh });
      // Add a duplicate after the existing match and omit one leaf on both real rigs.
      const duplicate = new window.__THREE.Bone(); duplicate.name = 'hand_r'; actor.mesh.add(duplicate);
      const duplicateBase = new window.__THREE.Bone(); duplicateBase.name = 'hand_r'; baseline.mesh.add(duplicateBase);
      actor.mesh.getObjectByName('thumb_04_leaf_l')?.removeFromParent();
      baseline.mesh.getObjectByName('thumb_04_leaf_l')?.removeFromParent();
      const equal = [];
      for (const [upper, phase, alive] of [['ready', 1, true], ['reload', .35, true],
        ['reload', .8, true], ['fire', .3, true], ['melee', .4, true], ['ready', 1, false], ['ready', 1, true]]) {
        const pose = { weapon, upper, alive, action: { kind: upper, total: 1.8, phase } };
        h.updateWeaponHandling(owner, pose); original.updateWeaponHandling(uncached, pose);
        equal.push(JSON.stringify(snapshot(actor, owner)) === JSON.stringify(snapshot(baseline, uncached)));
      }
      const expectedHand = actor.mesh.getObjectByName('hand_r');
      let rigLookups = 0, socketLookups = 0;
      const rigLookup = actor.mesh.getObjectByName, socketLookup = root.getObjectByName;
      actor.mesh.getObjectByName = function (...args) { rigLookups++; return rigLookup.apply(this, args); };
      root.getObjectByName = function (...args) { socketLookups++; return socketLookup.apply(this, args); };
      const pose = { weapon, alive: true, upper: 'ready', action: { kind: 'ready', phase: 1 } };
      for (let i = 0; i < 20; i++) h.updateWeaponHandling(owner, pose);
      const identity = owner.boneLookup?.get('hand_r') === expectedHand;
      const missing = !owner.boneLookup?.has('thumb_04_leaf_l');
      const oldLookup = owner.boneLookup;
      const replacement = g.buildEnemyMesh(0, 0, role);
      owner.skeleton = replacement.mesh; h.updateWeaponHandling(owner, pose);
      const replaced = owner.boneLookup?.get('hand_r') === replacement.mesh.getObjectByName('hand_r')
        && ![...owner.boneLookup?.values() ?? []].includes(expectedHand);
      h.disposeWeaponHandling(owner); h.disposeWeaponHandling(owner);
      original.disposeWeaponHandling(uncached);
      const retired = owner.boneLookup?.size === 0 && owner.socketLookup?.size === 0 && oldLookup?.size === 0;
      const keeper = g.buildEnemyMesh(0, 0, role);
      const keeperOwner = h.getWeaponHandling(keeper.mesh.getObjectByName('enemyWeaponMount').children[0]);
      h.updateWeaponHandling(keeperOwner, pose);
      const keeperUsable = keeperOwner.contacts?.supportWorld.every(Number.isFinite) === true;
      for (const a of [actor, baseline, replacement, keeper]) g.disposeEnemyMesh(a.mesh, a.mixer);
      rows.push({ weapon, equal, rigLookups, socketLookups, identity, missing, replaced, retired, keeperUsable });
    }
    return rows;
  });
  await writeFile(info.outputPath('owner-cache-handling.json'), JSON.stringify(result, null, 2));
  await writeFile('.planning/research/.cache/07-09-owner-cache-handling-latest.json', JSON.stringify(result, null, 2));
  for (const row of result) {
    expect(row.equal, row.weapon).toEqual(Array(7).fill(true));
    expect(row.rigLookups, row.weapon).toBe(0); expect(row.socketLookups, row.weapon).toBe(0);
    for (const key of ['identity', 'missing', 'replaced', 'retired', 'keeperUsable']) expect(row[key], `${row.weapon}/${key}`).toBe(true);
  }
});

let server, url;
test.beforeAll(async () => {
  const probe = portProbe(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    base: '/', server: { host: '127.0.0.1', port, strictPort: true,
      watch: { ignored: ['**/.planning/**', '**/tools/art/sources/**'] } } });
  await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}/`;
});
test.afterAll(async () => { await server?.close(); });
test.beforeEach(async ({ page }) => {
  await page.goto(url); await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 30000 });
  await page.locator('#range-startbtn').click();
});
test('m4: actual game exposes independent magazine in both views', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const w = await import(new URL('src/builders/weapon.js', location.href).href);
    return [w.wpn, w.weapon3p].map(root => !!root.getObjectByName('m4_magazine'));
  });
  expect(result).toEqual([true, true]);
});
for (const weapon of ['m4', 'p90', 'awp', 'pistol']) test(`${weapon}: moving loaded rig recontacts magazine and fore-end with closed fingers`, async ({ page }, info) => {
  const result = await page.evaluate(async weapon => {
    const src = new URL('src/', location.href).href;
    const w = await import(src + 'builders/weapon.js');
    const rig = await import(src + 'builders/enemyGLTF.js');
    const driver = await import(src + 'builders/enemyAnimations.js');
    const { camera, scene, renderer } = await import(src + 'scene.js');
    const { renderComicScene } = await import(src + 'comicOutline.js');
    const { player } = await import(src + 'entities/player.js');
    const { WEAPONS } = await import(src + 'config.js');
    (await import(src + 'input.js')).setGameRunning(false);
    const actor = { mesh: rig.playerMesh, mixer: rig.playerMixer, actions: rig.playerActions };
    const eye = camera.position.clone(), aim = camera.quaternion.clone();
    const ammo = player.ammo, root = actor.mesh.position.toArray();
    const bone = actor.mesh.getObjectByName('middle_02_l');
    w.restorePlayerWeaponHandling();
    const open = bone.quaternion.clone();
    w.show1pWeapon(weapon); w.show3pWeapon(weapon);
    const owner = w.playerWeaponHandling.get(`3p:${weapon}`);
    const mountBasis = w.weapon3p.quaternion.toArray();
    const frames = [], samples = [], costs = [];
    try {
      actor.mesh.visible = true; w.wpn.visible = false;
      camera.position.copy(actor.mesh.position).add({ x: 1.1, y: 1.45, z: -1.4 });
      camera.lookAt(actor.mesh.position.clone().add({ x: 0, y: 1.1, z: 0 }));
      for (const [i, phase] of [0, .15, .35, .55, .77, .92, 1].entries()) {
        w.restorePlayerWeaponHandling();
        const pose = driver.tickPresentation(actor, { identity: 'handling-fixture',
          position: { x: i * .12, y: 0, z: 0 }, sampleTimeSeconds: i * .05,
          bodyYaw: 0, aimYaw: 0, onGround: true, alive: true, weapon,
          action: phase < 1 ? { kind: 'reload', total: WEAPONS[weapon].reload / 1000,
            elapsed: phase * WEAPONS[weapon].reload / 1000 } : { kind: 'ready' } }, .05);
        const start = performance.now(); w.updatePlayerWeaponHandling(pose, actor.mesh);
        costs.push(performance.now() - start);
        samples.push({ phase, leftError: owner.contacts.leftError, sample: owner.sample,
          forward: new window.__THREE.Vector3(0, 0, -1).applyQuaternion(owner.root.getWorldQuaternion(new window.__THREE.Quaternion()))
            .dot(new window.__THREE.Vector3(0, 0, 1).transformDirection(actor.mesh.matrixWorld)),
          fingerAngle: open.angleTo(bone.quaternion), magazine1p: w.wpn.getObjectByName(`${weapon}_magazine`).position.toArray(),
          magazine3p: w.weapon3p.getObjectByName(`${weapon}_magazine`).position.toArray(),
          layers: driver.inspectPresentationLayers(actor).map(a => ({ weight: a.weight, tracks: a.tracks })) });
        renderComicScene(renderer, scene, camera);
        frames.push(renderer.domElement.toDataURL('image/png'));
      }
    } finally { camera.position.copy(eye); camera.quaternion.copy(aim); }
    return { samples, frames, costs, mountBasis, finalMountBasis: w.weapon3p.quaternion.toArray(),
      rootSame: JSON.stringify(root) === JSON.stringify(actor.mesh.position.toArray()),
      ammoSame: ammo === player.ammo, renderer: renderer.getContext().getParameter(renderer.getContext().RENDERER) };
  }, weapon);
  await writeFile(info.outputPath('contacts.json'), JSON.stringify({ ...result, frames: undefined }, null, 2));
  for (const [i, frame] of result.frames.entries())
    await writeFile(info.outputPath(`${weapon}-${i}.png`), Buffer.from(frame.split(',')[1], 'base64'));
  expect(result.rootSame && result.ammoSame).toBe(true);
  expect(result.mountBasis).toEqual(result.finalMountBasis);
  expect(Math.abs(result.mountBasis[0])).toBeCloseTo(Math.SQRT1_2);
  expect(result.samples.at(-1).forward).toBeGreaterThan(.8);
  expect(result.samples.every(s => s.leftError < .025 && s.fingerAngle > .4)).toBe(true);
  const direction = weapon === 'p90' ? 1 : -1;
  expect(direction * (result.samples[2].magazine1p[1] - result.samples.at(-1).magazine1p[1])).toBeGreaterThan(.07);
  expect(direction * (result.samples[2].magazine3p[1] - result.samples.at(-1).magazine3p[1])).toBeGreaterThan(.07);
  for (const [i, frame] of result.frames.entries())
    await writeFile(info.outputPath(`${weapon}-${i}.png`), Buffer.from(frame.split(',')[1], 'base64'));
  delete result.frames;
  await writeFile(info.outputPath('contacts.json'), JSON.stringify(result, null, 2));
});
for (const missing of [false, true]) test(`p90: ${missing ? 'missing' : 'loaded'} FBX retains one articulated fallback with honest status`, async ({ page }) => {
  if (missing) {
    await page.route('**/models/FBX/P90.fbx', route => route.fulfill({ status: 404, body: '' }));
    await page.goto(url); await expect(page.locator('#range-startbtn')).toBeEnabled();
  }
  const result = await page.evaluate(async () => {
    const w = await import(new URL('src/builders/weapon.js', location.href).href);
    const f = await import(new URL('src/builders/weaponFBX.js', location.href).href);
    const root = w.wpn.getObjectByName('p90_1p');
    return { status: root.userData.handlingStatus, parts: root.userData.fbxInspection,
      inspection: !!f.inspectedWeaponFBX, receivers: root.children.filter(c => c.name === 'p90_receiver').length,
      magazine: !!root.getObjectByName('p90_magazine'), cloneable: root.clone().children.length === root.children.length };
  });
  expect(result.status).toBe('Procedural fallback — detailed weapon handling unavailable');
  expect(result.receivers).toBe(1); expect(result.magazine && result.cloneable).toBe(true);
  if (!missing) expect(result.parts).toEqual([{ name: 'P90', skinned: true, groups: 3, vertices: 2862 }]);
  expect(result.inspection).toBe(!missing);
});
test('awp: actual bolt-hand cycle and M9 slide reset on interruption without outcomes', async ({ page }, info) => {
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const w = await import(src + 'builders/weapon.js');
    const rig = await import(src + 'builders/enemyGLTF.js');
    const driver = await import(src + 'builders/enemyAnimations.js');
    const { player } = await import(src + 'entities/player.js');
    (await import(src + 'input.js')).setGameRunning(false);
    const actor = { mesh: rig.playerMesh, mixer: rig.playerMixer, actions: rig.playerActions };
    const samples = [], ammo = player.ammo;
    for (const weapon of ['awp', 'pistol']) {
      w.show3pWeapon(weapon);
      for (const [i, phase] of [0, .2, .42, .8, 1].entries()) {
        w.restorePlayerWeaponHandling();
        const pose = driver.tickPresentation(actor, { identity: 'bolt-fixture', weapon,
          position: { x: i * .1, y: 0, z: 0 }, sampleTimeSeconds: i * .05,
          bodyYaw: 0, aimYaw: 0, onGround: true, alive: true,
          action: { kind: 'fire', total: weapon === 'awp' ? 1.1 : .2, elapsed: phase * (weapon === 'awp' ? 1.1 : .2) } }, .05);
        w.updatePlayerWeaponHandling(pose, actor.mesh);
        const owner = w.playerWeaponHandling.get(`3p:${weapon}`);
        samples.push({ weapon, phase, part: owner.parts.charging.position.toArray(),
          rightError: owner.contacts.rightError, hand: actor.mesh.getObjectByName('hand_r').getWorldPosition({
            setFromMatrixPosition(matrix) { return [matrix.elements[12], matrix.elements[13], matrix.elements[14]]; } }),
          boltHand: owner.sample.boltHand });
      }
      w.updatePlayerWeaponHandling({ weapon, upper: 'melee', alive: true }, actor.mesh);
      const owner = w.playerWeaponHandling.get(`3p:${weapon}`);
      samples.push({ weapon, canceled: true, props: owner.props.length,
        part: owner.parts.charging.position.toArray(), ready: owner.rest.get(owner.parts.charging).position.toArray() });
    }
    return { samples, ammoSame: ammo === player.ammo };
  });
  await writeFile(info.outputPath('bolt.json'), JSON.stringify(result, null, 2));
  expect(result.ammoSame).toBe(true);
  for (const weapon of ['awp', 'pistol']) {
    const rows = result.samples.filter(s => s.weapon === weapon);
    expect(rows[2].part[2]).toBeGreaterThan(rows[0].part[2] + .035);
    expect(rows.at(-1).part).toEqual(rows.at(-1).ready); expect(rows.at(-1).props).toBe(0);
    if (weapon === 'awp') { expect(rows[2].boltHand).toBe(true); expect(rows[2].rightError).toBeLessThan(.025); }
  }
});
test('actors: remote snapshot reload shares one owner under locomotion and preserves a retired sibling template', async ({ page }, info) => {
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const rig = await import(src + 'builders/enemyGLTF.js');
    const remote = await import(src + 'network/remoteActors.js');
    const handling = await import(src + 'builders/weaponHandling.js');
    const driver = await import(src + 'builders/enemyAnimations.js');
    const { scene, camera, renderer } = await import(src + 'scene.js');
    (await import(src + 'input.js')).setGameRunning(false);
    const created = [];
    const owners = remote.createRemoteActors(scene, { create(x, z) {
      const actor = rig.buildEnemyMesh(x, z); created.push(actor); return actor;
    }, dispose: rig.disposeEnemyMesh, animate(actor, p, dt) {
      remote.animateRemoteActor(actor, p, dt);
      Object.assign(created.find(entry => entry.mesh === actor.mesh), actor);
    }, tint: rig.tintEnemyMesh });
    const p = { sessionId: 'a', lifeGeneration: 1, x: camera.position.x, y: 1.65, z: camera.position.z,
      yaw: 0, pitch: 0, alive: true, onGround: true, crouching: false, sprinting: false, aiming: false,
      health: 100, team: 'red', reloadRemaining: .9, weapon: 'awp', firing: true, throwing: true };
    const q = { ...p, sessionId: 'b', x: p.x + 2, reloadRemaining: 0 };
    const samples = [];
    for (let i = 0; i < 6; i++) {
      p.x += .12;
      owners.syncRemoteActors({ sessionId: 'me', matchGeneration: 1, currentTick: 30 + i * 3,
        players: [p, q] }, .05);
      const actor = created[0], weapon = actor.mesh.getObjectByName('enemyWeaponMount').children[0];
      const owner = handling.getWeaponHandling(weapon);
      samples.push({ phase: owner.sample.phase, updates: owner.updates, leftError: owner.contacts.leftError,
        speed: actor.presentation.speed,
        magazine: owner.parts.magazine.position.toArray() });
    }
    const a = created[0], b = created[1];
    const oa = handling.getWeaponHandling(a.mesh.getObjectByName('enemyWeaponMount').children[0]);
    const ob = handling.getWeaponHandling(b.mesh.getObjectByName('enemyWeaponMount').children[0]);
    let sharedDisposals = 0;
    b.mesh.traverse(node => { if (node.isSkinnedMesh) node.geometry.addEventListener('dispose', () => sharedDisposals++); });
    const layers = driver.inspectPresentationLayers(a);
    owners.syncRemoteActors({ sessionId: 'me', matchGeneration: 1, currentTick: 51, players: [q] }, .05);
    const survivor = { disposed: ob.disposed, phase: ob.sample.phase, firing: ob.sample.firing,
      finite: b.mesh.getObjectByName('hand_l').quaternion.toArray().every(Number.isFinite),
      mount: b.mesh.getObjectByName('enemyWeaponMount').quaternion.toArray() };
    renderer.render(scene, camera);
    const retired = oa.disposed; owners.disposeRemoteActors();
    return { samples, layers, survivor, retired, sharedDisposals };
  });
  await writeFile(info.outputPath('actors.json'), JSON.stringify(result, null, 2));
  expect(result.samples.map(s => s.updates)).toEqual([1, 2, 3, 4, 5, 6]);
  expect(result.samples.every(s => s.phase === .5 && s.leftError < .025)).toBe(true);
  expect(result.layers.some(l => l.weight > 0 && l.tracks.some(t => /thigh|calf|foot/.test(t)))).toBe(true);
  expect(result.retired && result.survivor.finite).toBe(true);
  expect(result.survivor.disposed || result.survivor.firing).toBe(false);
  expect(Math.abs(result.survivor.mount[0])).toBeCloseTo(Math.SQRT1_2);
  expect(result.sharedDisposals).toBe(0);
});
test('actors: offline muzzle observations keep grips moving and unsupported reload quiet', async ({ page }, info) => {
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const rig = await import(src + 'builders/enemyGLTF.js');
    const { getWeaponHandling } = await import(src + 'builders/weaponHandling.js');
    const { tickEnemyAnimation } = await import(src + 'builders/enemyAnimations.js');
    (await import(src + 'input.js')).setGameRunning(false);
    const actor = { ...rig.buildEnemyMesh(10, 10), x: 10, z: 10, facingY: 0, hp: 100,
      dead: false, onGround: true, state: 'patrol', stunTimer: 0, muzzleFlashT: 0, weaponRole: 'assault', reloadRemaining: .9 };
    actor.mesh.rotation.y = actor.facingOffset;
    const owner = getWeaponHandling(actor.mesh.getObjectByName('enemyWeaponMount').children[0]);
    const frames = [];
    for (let i = 0; i < 8; i++) {
      actor.x += .15; actor.mesh.position.x = actor.x;
      if (i === 2) actor.muzzleFlashT = 55;
      tickEnemyAnimation(actor, .05);
      frames.push({ upper: actor.presentation.upper, reload: owner.sample.reload, phase: owner.sample.phase,
        updates: owner.updates, leftError: owner.contacts.leftError, speed: actor.presentation.speed,
        hand: actor.mesh.getObjectByName('hand_l').quaternion.toArray() });
    }
    rig.disposeEnemyMesh(actor.mesh, actor.mixer);
    return { frames, disposed: owner.disposed, props: owner.props.length };
  });
  await writeFile(info.outputPath('bot.json'), JSON.stringify(result, null, 2));
  expect(result.frames.every(f => !f.reload && f.leftError < .025)).toBe(true);
  expect(result.frames[2].upper).toBe('fire');
  expect(result.frames.slice(1).every(f => f.speed > 0)).toBe(true);
  expect(result.frames.map(f => f.updates)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect(result.disposed).toBe(true); expect(result.props).toBe(0);
});
