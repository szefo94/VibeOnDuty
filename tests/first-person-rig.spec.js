import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createServer as portProbe } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';

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
test('tracer: normal loaded game owns actual first-person arms and down-look body', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const rig = await import(new URL('src/builders/enemyGLTF.js', location.href).href);
    return { loaded: !!rig.playerMesh, view: !!rig.playerFirstPersonRig,
      arms: !!rig.playerFirstPersonRig?.arms, body: !!rig.playerFirstPersonRig?.body };
  });
  expect(result.loaded).toBe(true);
  expect(result.view && result.arms && result.body).toBe(true);
});
test('tracer: real M4 reload and down-look render keep gun contacts and restore failure state', async ({ page }, info) => {
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const g = await import(src + 'builders/enemyGLTF.js');
    const w = await import(src + 'builders/weapon.js');
    const driver = await import(src + 'builders/enemyAnimations.js');
    const fp = await import(src + 'builders/firstPersonRig.js');
    const { camera, scene, renderer } = await import(src + 'scene.js');
    const { renderComicScene } = await import(src + 'comicOutline.js');
    const { player } = await import(src + 'entities/player.js');
    (await import(src + 'input.js')).setGameRunning(false);
    const rig = g.playerFirstPersonRig, actor = { mesh: g.playerMesh, mixer: g.playerMixer, actions: g.playerActions };
    const eye = camera.position.clone(), aim = camera.quaternion.clone();
    const frames = [], samples = [], inventory = player.ammo;
    // Stable actual scene lights, no mock materials or skipped image decoding.
    scene.traverse(node => { if (node.isAmbientLight || node.isHemisphereLight) node.intensity = 1.2; });
    g.playerMesh.visible = false;
    camera.quaternion.setFromEuler(new window.__THREE.Euler(0, player.yaw, 0, 'YXZ'));
    try {
      for (const [i, phase] of [0, .2, .4, .6, .8, 1].entries()) {
        w.restorePlayerWeaponHandling();
        const pose = driver.tickPresentation(actor, { identity: 'first-person-m4', weapon: 'm4',
          position: { x: eye.x, y: eye.y, z: eye.z }, sampleTimeSeconds: i * .1,
          bodyYaw: player.yaw, aimYaw: player.yaw, onGround: true, alive: true,
          action: phase < 1 ? { kind: 'reload', total: 1.8, elapsed: phase * 1.8 } : { kind: 'ready' } }, .05);
        w.updatePlayerWeaponHandling(pose, g.playerMesh);
        fp.updateFirstPersonRig(rig, { pose, camera, weapon: w.wpn,
          rawCorrections: w.playerWeaponHandling.get('3p:m4').corrections,
          spineQuaternion: actor._presentationCorrection?.get(actor.mesh.getObjectByName('spine_03')) });
        const owner = [...rig.handlers].find(h => h.weapon === 'm4');
        scene.updateMatrixWorld(true);
        fp.renderFirstPersonRig(rig, { weapon: w.wpn, worldWeapon: w.weapon3p, firstPerson: true, active: true }, () => renderComicScene(renderer, scene, camera));
        frames.push(renderer.domElement.toDataURL('image/png'));
        samples.push({ phase, contacts: owner.contacts, wrist: rig.arms.getObjectByName('hand_l').getWorldPosition(new window.__THREE.Vector3()).toArray(),
          gun: rig.weapon.getWorldPosition(new window.__THREE.Vector3()).toArray(),
          meshes: [...(function* () { const a = []; rig.arms.traverse(n => { if (n.isSkinnedMesh && n.visible) a.push({ name: n.name, triangles: n.geometry.userData.selectedTriangles }); }); yield* a; })()] });
      }
      const ads = Object.freeze({ ...actor.presentation, aiming: true, upper: 'ads' });
      fp.updateFirstPersonRig(rig, { pose: ads, camera, weapon: w.wpn,
        rawCorrections: w.playerWeaponHandling.get('3p:m4').corrections,
        spineQuaternion: actor._presentationCorrection?.get(actor.mesh.getObjectByName('spine_03')) });
      fp.renderFirstPersonRig(rig, { weapon: w.wpn, worldWeapon: w.weapon3p, firstPerson: true, active: true }, () => renderComicScene(renderer, scene, camera));
      frames.push(renderer.domElement.toDataURL('image/png'));
      camera.quaternion.setFromEuler(new window.__THREE.Euler(-1.38, player.yaw, 0, 'YXZ'));
      fp.updateFirstPersonRig(rig, { pose: actor.presentation, camera, weapon: w.wpn, handlers: [w.playerWeaponHandling.get('1p:m4')] });
      fp.renderFirstPersonRig(rig, { weapon: w.wpn, worldWeapon: w.weapon3p, firstPerson: true, active: true }, () => renderComicScene(renderer, scene, camera)); frames.push(renderer.domElement.toDataURL('image/png'));
      return { frames, samples, inventorySame: inventory === player.ammo,
        root: actor.mesh.position.toArray(), eye: eye.toArray(), bones: rig.armPairs.length,
        bodyMeshes: (() => { const a = []; rig.body.traverse(n => { if (n.isSkinnedMesh) a.push({name:n.name,visible:n.visible,triangles:n.geometry.userData.selectedTriangles, caps:n.geometry.userData.boundaryCaps,
          joints: [...new Set(n.geometry.attributes.skinIndex.array)].map(i=>n.skeleton.bones[i]?.name) }); }); return a; })() };
    } finally { camera.position.copy(eye); camera.quaternion.copy(aim); }
  });
  for (const [i, frame] of result.frames.entries())
    await writeFile(info.outputPath(`m4-${i}.png`), Buffer.from(frame.split(',')[1], 'base64'));
  delete result.frames; await writeFile(info.outputPath('tracer.json'), JSON.stringify(result, null, 2));
  expect(result.bones).toBe(65); expect(result.inventorySame).toBe(true);
  expect(result.samples.every(s => s.contacts && s.contacts.leftError < .025 && s.contacts.rightError < .025)).toBe(true);
});
test('tracer: render exception restores simulation eye and all temporary view ownership', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const { camera, renderer } = await import(src + 'scene.js');
    const g = await import(src + 'builders/enemyGLTF.js');
    const w = await import(src + 'builders/weapon.js');
    const fp = await import(src + 'builders/firstPersonRig.js');
    const controls = await import(src + 'loop.js');
    const { setGameRunning } = await import(src + 'input.js');
    setGameRunning(false);
    const eye = camera.position.toArray(), aim = camera.quaternion.toArray(), root = g.playerMesh.position.toArray();
    const nodes = [g.playerMesh, g.playerFirstPersonRig.arms, g.playerFirstPersonRig.body, g.playerFirstPersonRig.weapon, w.wpn, w.weapon3p];
    const before = nodes.map(n => n.visible); let during;
    try { fp.renderFirstPersonRig(g.playerFirstPersonRig, { weapon:w.wpn, worldWeapon:w.weapon3p,firstPerson:true,active:true }, () => {
      during = nodes.map(n => n.visible); throw new Error('view-injected');
    }); } catch (error) { if (error.message !== 'view-injected') throw error; }
    const after = nodes.map(n => n.visible);
    const render = renderer.render; renderer.render = () => { throw new Error('gpu-injected'); };
    let threw = false;
    try { controls.setThirdPerson(true); controls.loop(performance.now()); }
    catch (error) { threw = error.message === 'gpu-injected'; }
    finally { renderer.render = render; controls.setThirdPerson(false); }
    return { before,after,during,threw,eye,afterEye:camera.position.toArray(),aim,afterAim:camera.quaternion.toArray(),root,afterRoot:g.playerMesh.position.toArray() };
  });
  expect(result.threw).toBe(true); expect(result.after).toEqual(result.before);
  expect(result.during).toEqual([false,true,true,true,false,false]);
  expect(result.afterEye).toEqual(result.eye); expect(result.afterAim).toEqual(result.aim);
  expect(result.afterRoot).toEqual(result.root);
});
