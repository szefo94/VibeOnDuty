import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createServer as portProbe } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

let server, url;
test.beforeAll(async () => {
  const probe = portProbe();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    base: '/', server: { host: '127.0.0.1', port, strictPort: true,
      watch: { ignored: ['**/.planning/**', '**/tools/art/sources/**'] } } });
  await server.listen();
  url = `http://127.0.0.1:${server.httpServer.address().port}/`;
});
test.afterAll(async () => { await server?.close(); });
test.beforeEach(async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 30000 });
  await page.locator('#range-startbtn').click();
});

test('local: held movement blocked by terrain plants the real loaded feet', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const { player } = await import(src + 'entities/player.js');
    const input = await import(src + 'input.js');
    const { camera } = await import(src + 'scene.js');
    const { playerActions, playerMesh } = await import(src + 'builders/enemyGLTF.js');
    const { MAP } = await import(src + 'map.js');
    input.setLocked(false);
    // Place within a solid cell: actual canMoveTo rejects the held W intention.
    const r = MAP.findIndex(row => row.some(v => v === 1));
    const c = MAP[r].findIndex(v => v === 1);
    camera.position.set(c * 4 + 2, 1.65, r * 4 + 2);
    player.yaw = 0; player.onGround = true;
    input.keys.KeyW = true;
    input.setGameRunning(true);
    const start = camera.position.clone();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    input.keys.KeyW = false; input.setGameRunning(false);
    const travelling = new Set(['walk', 'run', 'strafe_l', 'strafe_r', 'walk_back', 'run_back']);
    return { skinned: !!playerMesh, displacement: camera.position.distanceTo(start),
      travellingWeight: [...travelling].reduce((sum, key) => sum + (playerActions[key]?.isScheduled() ? playerActions[key].getEffectiveWeight() : 0), 0) };
  });
  expect(result.skinned).toBe(true);
  expect(result.displacement).toBeLessThan(0.01);
  expect(result.travellingWeight).toBeLessThan(0.01);
  expect(errors).toEqual([]);
});

test('local: loaded directional masks and current action phase preserve gameplay roots', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const rig = await import(src + 'builders/enemyGLTF.js');
    const input = await import(src + 'input.js');
    const { player } = await import(src + 'entities/player.js');
    const { camera } = await import(src + 'scene.js');
    const { tickPresentation } = await import(src + 'builders/enemyAnimations.js');
    input.setGameRunning(false); rig.playerMixer.timeScale = 0;
    const actor = { mesh: rig.playerMesh, mixer: rig.playerMixer, actions: rig.playerActions };
    const root = actor.mesh.position.toArray(), eye = camera.position.toArray();
    const yaw = player.yaw, pitch = player.pitch;
    const r = { identity: 'local-fixture', position: {x:0,y:0,z:0}, sampleTimeSeconds:0,
      bodyYaw:0, aimYaw:0, pitch:0, onGround:true, weapon:'m4', alive:true };
    tickPresentation(actor,r,.05);
    const p = tickPresentation(actor,{...r, sampleTimeSeconds:.1, position:{x:.3,y:0,z:.3},
      action:{kind:'reload',total:1.8,remaining:.45}},.05);
    const hand = actor.mesh.getObjectByName('hand_l').quaternion.toArray();
    const jumped = tickPresentation(actor,{...r,sampleTimeSeconds:.2,onGround:false,pitch:1.38},.05);
    const land = tickPresentation(actor,{...r,sampleTimeSeconds:.3},.05);
    const turned = tickPresentation(actor,{...r,sampleTimeSeconds:.4,bodyYaw:1,aimYaw:1},.05);
    const frames=[];
    for(let i=0;i<12;i++) {
      tickPresentation(actor,{...r,sampleTimeSeconds:.45+i*.05,bodyYaw:1,aimYaw:1},.05);
      frames.push(actor.mesh.getObjectByName('foot_r').quaternion.toArray());
    }
    return { gait:p.gait, phase:p.action.phase, hand, jump:jumped.jump, land:land.jump,
      turn:turned.turn, feetChange:frames.some(q=>q.some((v,j)=>Math.abs(v-frames[0][j])>.001)),
      rootSame:JSON.stringify(root)===JSON.stringify(actor.mesh.position.toArray()),
      eyeSame:JSON.stringify(eye)===JSON.stringify(camera.position.toArray()),
      aimSame:yaw===player.yaw&&pitch===player.pitch, finite:hand.every(Number.isFinite) };
  });
  expect(result.gait.map(g=>g.key)).toEqual(['walk_back','walk_right']);
  expect(result.phase).toBe(.75);
  expect(result.jump).toBe('start'); expect(result.land).toBe('land');
  expect(result.turn).toBe('turn_right'); expect(result.feetChange).toBe(true);
  expect(result.rootSame && result.eyeSame && result.aimSame && result.finite).toBe(true);
});
