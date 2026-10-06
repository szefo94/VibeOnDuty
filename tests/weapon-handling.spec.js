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
test('m4: actual game exposes independent magazine in both views', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const w = await import(new URL('src/builders/weapon.js', location.href).href);
    return [w.wpn, w.weapon3p].map(root => !!root.getObjectByName('m4_magazine'));
  });
  expect(result).toEqual([true, true]);
});
test('m4: moving loaded rig recontacts magazine and fore-end with closed fingers', async ({ page }, info) => {
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const w = await import(src + 'builders/weapon.js');
    const rig = await import(src + 'builders/enemyGLTF.js');
    const driver = await import(src + 'builders/enemyAnimations.js');
    const { camera, scene, renderer } = await import(src + 'scene.js');
    const { renderComicScene } = await import(src + 'comicOutline.js');
    const { player } = await import(src + 'entities/player.js');
    (await import(src + 'input.js')).setGameRunning(false);
    const actor = { mesh: rig.playerMesh, mixer: rig.playerMixer, actions: rig.playerActions };
    const eye = camera.position.clone(), aim = camera.quaternion.clone();
    const ammo = player.ammo, root = actor.mesh.position.toArray();
    const bone = actor.mesh.getObjectByName('middle_02_l');
    w.restorePlayerWeaponHandling();
    const open = bone.quaternion.clone();
    const owner = w.playerWeaponHandling.get('3p:m4');
    const frames = [], samples = [], costs = [];
    try {
      actor.mesh.visible = true; w.wpn.visible = false;
      camera.position.copy(actor.mesh.position).add({ x: 1.1, y: 1.45, z: -1.4 });
      camera.lookAt(actor.mesh.position.clone().add({ x: 0, y: 1.1, z: 0 }));
      for (const [i, phase] of [0, .15, .35, .55, .77, .92, 1].entries()) {
        w.restorePlayerWeaponHandling();
        const pose = driver.tickPresentation(actor, { identity: 'handling-fixture',
          position: { x: i * .12, y: 0, z: 0 }, sampleTimeSeconds: i * .05,
          bodyYaw: 0, aimYaw: 0, onGround: true, alive: true, weapon: 'm4',
          action: phase < 1 ? { kind: 'reload', total: 1.8, elapsed: phase * 1.8 } : { kind: 'ready' } }, .05);
        const start = performance.now(); w.updatePlayerWeaponHandling(pose, actor.mesh);
        costs.push(performance.now() - start);
        samples.push({ phase, leftError: owner.contacts.leftError, sample: owner.sample,
          fingerAngle: open.angleTo(bone.quaternion), magazine1p: w.wpn.getObjectByName('m4_magazine').position.toArray(),
          magazine3p: w.weapon3p.getObjectByName('m4_magazine').position.toArray(),
          layers: driver.inspectPresentationLayers(actor).map(a => ({ weight: a.weight, tracks: a.tracks })) });
        renderComicScene(renderer, scene, camera);
        frames.push(renderer.domElement.toDataURL('image/png'));
      }
    } finally { camera.position.copy(eye); camera.quaternion.copy(aim); }
    return { samples, frames, costs, rootSame: JSON.stringify(root) === JSON.stringify(actor.mesh.position.toArray()),
      ammoSame: ammo === player.ammo, renderer: renderer.getContext().getParameter(renderer.getContext().RENDERER) };
  });
  await writeFile(info.outputPath('contacts.json'), JSON.stringify({ ...result, frames: undefined }, null, 2));
  for (const [i, frame] of result.frames.entries())
    await writeFile(info.outputPath(`m4-${i}.png`), Buffer.from(frame.split(',')[1], 'base64'));
  expect(result.rootSame && result.ammoSame).toBe(true);
  expect(result.samples.every(s => s.leftError < .025 && s.fingerAngle > .4)).toBe(true);
  expect(result.samples[2].magazine1p[1]).toBeLessThan(-.15);
  expect(result.samples[2].magazine3p[1]).toBeLessThan(-.15);
  expect(result.samples.at(-1).magazine3p[1]).toBeCloseTo(-.06);
  for (const [i, frame] of result.frames.entries())
    await writeFile(info.outputPath(`m4-${i}.png`), Buffer.from(frame.split(',')[1], 'base64'));
  delete result.frames;
  await writeFile(info.outputPath('contacts.json'), JSON.stringify(result, null, 2));
});
