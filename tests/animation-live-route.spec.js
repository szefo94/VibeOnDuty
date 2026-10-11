import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createServer as portProbe } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

// Plan 07-29: the live third-person player in the Training Range, read from the running page.
// Three states (standing, walking forward, crouched and still), each sampled after 120 rendered
// frames. Waits are counted in rendered frames, never in wall-clock time. Character forward is
// +Z of the body's own frame; weapon forward is +Y of hand_r in that frame.
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

const LIMIT = { weaponYaw: 3.5, weaponPitch: 2.5, spineYaw: 3.5, footBelowRoot: 0.03,
  idleFootTravel: 0.001, walkPelvisVariation: 0.02, crouchKnee: 0.15, crouchPelvisMax: 0.55,
  crouchLower: 0.30, standAgain: 0.03 };

// One browser-side recorder per state. `frames` waits rendered frames; `sample` records the pose.
async function runState(page, { settle, samples }) {
  return page.evaluate(async ({ settle, samples }) => {
    const src = new URL('src/', location.href).href;
    const { player } = await import(src + 'entities/player.js');
    const T = window.__THREE;
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const root = window.__bodyRef();
    const SIDES = ['l', 'r'];
    const measure = () => {
      root.updateMatrixWorld(true);
      const inverse = root.getWorldQuaternion(new T.Quaternion()).invert();
      const origin = root.getWorldPosition(new T.Vector3());
      const position = name => root.getObjectByName(name).getWorldPosition(new T.Vector3())
        .sub(origin).applyQuaternion(inverse);
      const rotation = name => inverse.clone()
        .multiply(root.getObjectByName(name).getWorldQuaternion(new T.Quaternion()));
      const forward = new T.Vector3(0, 1, 0).applyQuaternion(rotation('hand_r'));
      const out = { knee: {}, ankle: {}, ball: {},
        weaponYaw: Math.atan2(forward.x, forward.z) * 180 / Math.PI,
        weaponPitch: Math.asin(forward.y) * 180 / Math.PI,
        spineYaw: new T.Euler().setFromQuaternion(rotation('spine_03'), 'YXZ').y * 180 / Math.PI,
        pelvis: position('pelvis').y };
      for (const side of SIDES) {
        const hip = position(`thigh_${side}`), knee = position(`calf_${side}`), ankle = position(`foot_${side}`);
        const line = ankle.clone().sub(hip), along = knee.clone().sub(hip).dot(line) / line.lengthSq();
        out.knee[side] = knee.clone().sub(hip.clone().addScaledVector(line, along)).z;
        out.ankle[side] = ankle.toArray(); out.ball[side] = position(`ball_${side}`).toArray();
      }
      out.lowestFoot = Math.min(...SIDES.flatMap(side => [out.ankle[side][1], out.ball[side][1]]));
      // Plan 07-36: forward pitch of the chest in the body's frame (positive leans forward).
      out.chestPitch = new T.Euler().setFromQuaternion(rotation('spine_03'), 'YXZ').x * 180 / Math.PI;
      return out;
    };
    for (let i = 0; i < settle; i++) await frame();
    const recorded = [];
    for (let i = 0; i < samples; i++) {
      await frame();
      const pose = window.__presentationDebug();
      recorded.push({ ...measure(),
        layers: pose.layers.map(l => ({ clip: l.clip, weight: l.weight, scheduled: l.scheduled })),
        presentation: { pitch: pose.pitch, crouching: pose.crouching, moving: pose.moving,
          phase: pose.phase, speed: pose.speed, onGround: pose.onGround, alive: pose.alive },
        playerPitch: player.pitch, thirdPerson: player.thirdPerson,
        rootY: root.position.y, scale: root.scale.toArray() });
    }
    return recorded;
  }, { settle, samples });
}

const lowerLayers = (sample, minWeight = 0) => sample.layers
  .filter(l => l.scheduled && l.weight > minWeight && l.clip.endsWith('_lower'));
const span = values => Math.max(...values) - Math.min(...values);
const mean = values => values.reduce((a, b) => a + b, 0) / values.length;

test('live: standing, walking and crouching show the composed pose with weapon and chest along the facing', async ({ page }, info) => {
  // Budget for the whole case only: every wait inside is a count of rendered frames
  // (about 650 in all), and software rendering runs at roughly 13 to 30 frames per second.
  test.setTimeout(240000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const { player } = await import(src + 'entities/player.js');
    const input = await import(src + 'input.js');
    input.setLocked(false);
    player.yaw = Math.PI; // the hall is 80 m deep: facing +Z leaves room to walk
    player.pitch = 0;
    input.setGameRunning(true);
  });
  await page.keyboard.press('KeyV'); // third person

  // ── standing ──────────────────────────────────────────────────────────
  const standing = await runState(page, { settle: 120, samples: 30 });

  // ── walking forward ───────────────────────────────────────────────────
  await page.keyboard.down('KeyW');
  const walking = await runState(page, { settle: 120, samples: 40 });
  await page.keyboard.up('KeyW');

  // ── crouched and still ────────────────────────────────────────────────
  await runState(page, { settle: 120, samples: 1 });
  await page.keyboard.down('KeyC');
  const crouched = await runState(page, { settle: 120, samples: 12 });
  await page.keyboard.up('KeyC');
  const risen = await runState(page, { settle: 120, samples: 12 });

  const standingPelvis = mean(standing.map(s => s.pelvis));
  const standingPitch = mean(standing.map(s => s.weaponPitch));
  // Plan 07-36: the crouch lean, read from the page together with the chest pitches.
  const leanDegrees = await page.evaluate(async () => {
    const module = await import(new URL('src/builders/weaponHandling.js', location.href).href);
    return module.CROUCH_TORSO_LEAN_RAD * 180 / Math.PI;
  });
  const standingChest = mean(standing.map(s => s.chestPitch));
  const crouchedChest = mean(crouched.map(s => s.chestPitch));
  const risenChest = mean(risen.map(s => s.chestPitch));
  const figures = {
    scale: standing[0].scale, rootY: [standing[0].rootY, crouched[0].rootY],
    standing: { pelvis: standingPelvis, weaponYaw: [Math.min(...standing.map(s => s.weaponYaw)), Math.max(...standing.map(s => s.weaponYaw))],
      weaponPitch: standingPitch, spineYaw: [Math.min(...standing.map(s => s.spineYaw)), Math.max(...standing.map(s => s.spineYaw))],
      ankleBallTravel: null, lowestFoot: Math.min(...standing.map(s => s.lowestFoot)),
      knee: [Math.min(...standing.flatMap(s => [s.knee.l, s.knee.r])), Math.max(...standing.flatMap(s => [s.knee.l, s.knee.r]))],
      lower: [...new Set(standing.flatMap(s => lowerLayers(s, .01).map(l => l.clip)))] },
    walking: { pelvis: [Math.min(...walking.map(s => s.pelvis)), Math.max(...walking.map(s => s.pelvis))],
      weaponYaw: [Math.min(...walking.map(s => s.weaponYaw)), Math.max(...walking.map(s => s.weaponYaw))],
      weaponPitch: [Math.min(...walking.map(s => s.weaponPitch)), Math.max(...walking.map(s => s.weaponPitch))],
      spineYaw: [Math.min(...walking.map(s => s.spineYaw)), Math.max(...walking.map(s => s.spineYaw))],
      lowestFoot: Math.min(...walking.map(s => s.lowestFoot)),
      knee: [Math.min(...walking.flatMap(s => [s.knee.l, s.knee.r])), Math.max(...walking.flatMap(s => [s.knee.l, s.knee.r]))],
      speed: [Math.min(...walking.map(s => s.presentation.speed)), Math.max(...walking.map(s => s.presentation.speed))],
      lower: [...new Set(walking.flatMap(s => lowerLayers(s, .01).map(l => l.clip)))] },
    crouched: { pelvis: [Math.min(...crouched.map(s => s.pelvis)), Math.max(...crouched.map(s => s.pelvis))],
      weaponYaw: [Math.min(...crouched.map(s => s.weaponYaw)), Math.max(...crouched.map(s => s.weaponYaw))],
      weaponPitch: [Math.min(...crouched.map(s => s.weaponPitch)), Math.max(...crouched.map(s => s.weaponPitch))],
      spineYaw: [Math.min(...crouched.map(s => s.spineYaw)), Math.max(...crouched.map(s => s.spineYaw))],
      lowestFoot: Math.min(...crouched.map(s => s.lowestFoot)),
      knee: { l: [Math.min(...crouched.map(s => s.knee.l)), Math.max(...crouched.map(s => s.knee.l))],
        r: [Math.min(...crouched.map(s => s.knee.r)), Math.max(...crouched.map(s => s.knee.r))] },
      lower: crouched.map(s => lowerLayers(s, .01).map(l => `${l.clip}@${l.weight.toFixed(3)}`)) },
    risen: { pelvis: [Math.min(...risen.map(s => s.pelvis)), Math.max(...risen.map(s => s.pelvis))] },
  };
  // Ankle and foot ball travel over the 30 standing frames, in metres (the idle legs are a held frame).
  const travel = Math.max(...standing.flatMap(s => ['l', 'r'].flatMap(side => [s.ankle[side], s.ball[side]]
    .map((p, i) => Math.hypot(p[0] - standing[0][i ? 'ball' : 'ankle'][side][0],
      p[1] - standing[0][i ? 'ball' : 'ankle'][side][1], p[2] - standing[0][i ? 'ball' : 'ankle'][side][2])))));
  figures.standing.ankleBallTravel = travel;
  await info.attach('live-route-figures', { body: Buffer.from(JSON.stringify(figures, null, 2)),
    contentType: 'application/json' });
  console.log('LIVE-ROUTE-FIGURES ' + JSON.stringify(figures));

  const every = [...standing, ...walking, ...crouched, ...risen];
  // The view is level, so the driver's aim correction is zero; assert that it is.
  expect(every.every(s => s.thirdPerson === true)).toBe(true);
  expect(every.every(s => s.playerPitch === 0 && s.presentation.pitch === 0)).toBe(true);
  expect(every.every(s => s.presentation.alive)).toBe(true);
  // No selected lower layer is an authored vod7_ clip.
  expect(every.flatMap(s => s.layers.filter(l => l.scheduled && l.clip.endsWith('_lower')))
    .filter(l => l.clip.startsWith('vod7_'))).toEqual([]);

  // standing: the lower layer is the lower mask of live_m4_ready, and the legs are a held frame
  expect(standing.every(s => !s.presentation.moving && !s.presentation.crouching)).toBe(true);
  for (const s of standing) expect(lowerLayers(s, .01).map(l => l.clip)).toEqual(['live_m4_ready_lower']);
  expect(travel).toBeLessThan(LIMIT.idleFootTravel);

  // walking forward: live_ gait clips; the pelvis rises and falls
  expect(walking.every(s => s.presentation.moving && s.presentation.speed > .5)).toBe(true);
  for (const s of walking) {
    const lower = lowerLayers(s, .01);
    expect(lower.length).toBeGreaterThan(0);
    expect(lower.every(l => /^live_(walk|run)_(forward|back|left|right)_lower$/.test(l.clip))).toBe(true);
  }
  expect(walking.some(s => lowerLayers(s, .5).some(l => l.clip === 'live_walk_forward_lower'))).toBe(true);
  expect(span(walking.map(s => s.pelvis))).toBeGreaterThanOrEqual(LIMIT.walkPelvisVariation);
  // the samples cover at least one stride
  let travelled = 0;
  for (let i = 1; i < walking.length; i++)
    travelled += (walking[i].presentation.phase - walking[i - 1].presentation.phase + 1) % 1;
  expect(travelled).toBeGreaterThanOrEqual(1);

  // crouched and still: live_crouch_idle at full weight, knees forward, pelvis low
  expect(crouched.every(s => s.presentation.crouching && !s.presentation.moving)).toBe(true);
  for (const s of crouched) {
    const lower = lowerLayers(s, .01);
    expect(lower.map(l => l.clip)).toEqual(['live_crouch_idle_lower']);
    expect(lower[0].weight).toBeGreaterThan(.99);
    expect(s.knee.l).toBeGreaterThanOrEqual(LIMIT.crouchKnee);
    expect(s.knee.r).toBeGreaterThanOrEqual(LIMIT.crouchKnee);
    expect(s.pelvis).toBeLessThanOrEqual(LIMIT.crouchPelvisMax);
    expect(standingPelvis - s.pelvis).toBeGreaterThanOrEqual(LIMIT.crouchLower);
  }

  // all states: weapon and chest along the facing, feet on the floor
  for (const s of every) {
    expect(Math.abs(s.weaponYaw)).toBeLessThanOrEqual(LIMIT.weaponYaw);
    expect(Math.abs(s.weaponPitch - standingPitch)).toBeLessThanOrEqual(LIMIT.weaponPitch);
    expect(Math.abs(s.spineYaw)).toBeLessThanOrEqual(LIMIT.spineYaw);
    expect(s.lowestFoot).toBeGreaterThanOrEqual(-LIMIT.footBelowRoot);
  }

  // releasing crouch brings the pelvis back to the standing value
  for (const s of risen) expect(Math.abs(s.pelvis - standingPelvis)).toBeLessThanOrEqual(LIMIT.standAgain);
  // Plan 07-36: the crouched chest leans forward by the constant (within 2 degrees) and is back
  // within 0.5 degrees of the standing value after release; the weapon and yaw limits above hold.
  console.log('LIVE-ROUTE-LEAN ' + JSON.stringify({ leanDegrees, standingChest, crouchedChest, risenChest,
    leanMeasured: crouchedChest - standingChest, afterRelease: risenChest - standingChest,
    crouchedWeaponYaw: [Math.min(...crouched.map(s => s.weaponYaw)), Math.max(...crouched.map(s => s.weaponYaw))],
    crouchedWeaponPitch: [Math.min(...crouched.map(s => s.weaponPitch)), Math.max(...crouched.map(s => s.weaponPitch))],
    crouchedSpineYaw: [Math.min(...crouched.map(s => s.spineYaw)), Math.max(...crouched.map(s => s.spineYaw))] }));
  expect(Math.abs(crouchedChest - standingChest - leanDegrees)).toBeLessThanOrEqual(2);
  expect(Math.abs(risenChest - standingChest)).toBeLessThanOrEqual(0.5);
  expect(errors).toEqual([]);
});
