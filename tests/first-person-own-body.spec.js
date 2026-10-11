import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createServer as portProbe } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { env } from 'node:process';

// Plan 07-38: what first person shows of the player's own body, measured from canvas pixels.
// Two shares of a frame, both over all of its pixels:
//   ink share       pixels of the outline ink colour, exactly red 8, green 9, blue 11;
//   own-body share  pixels that differ between the frame and the same frame drawn once more with
//                   only the meshes of the body view hidden (arms view and view weapon unchanged,
//                   shadow map kept). The hiding uses the meshes' own visible flags, put back after.
// Case A drives the rig by hand in the sequence of the pitch-view case of first-person-rig.spec.js.
// Case B leaves the game loop running and sends key and pointer input as a player does.
// Both run in the Training Range (Amendment 1, C): the pitch-view case starts Incursion, where an
// enemy of the wave can stand on the player's cell and be drawn over a hand-lowered camera.
// The ink and own-body limits were fixed in the plan before any frame was measured. The leg-joint
// rule and the standing chest share were set by Amendment 1 after the first measurements, from them.
const LIMIT = Object.freeze({
  ink: 0.01, // at most 1.0 percent of a frame, standing and crouched, every pitch, still and moving
  bodyOverStanding: 0.005, // crouched own-body share over the standing share at the same pitch
  bodyAbove: -0.3, // radians: the own-body comparison applies to pitches above this
  lookDown: -1.38, // radians: at this pitch a still frame must show the legs (Amendment 1, B)
  legJoints: { stand: 4, crouch: 3 }, // of calf_l, calf_r, foot_l, foot_r of the body view, as measured before the rule
  standingChest: 0.045, // own-body share of the standing still frame at that pitch: the chest stays in view (measured 0.0525 to 0.0535)
  edge: 0.9, // both screen coordinates of a counted joint are inside this
});
const PITCHES = [1.38, 0.9, 0.45, 0.3, 0, -0.3, -0.6, -0.9, -1.38];
const SEQUENCE_PITCHES = [-1.38, -0.9, 0, 1.38]; // the eight frames of the existing spec
const SETTLE = 60, TURN = 60, SWING = 120, WALK = 60, REST = 30, PLANT = 6; // rendered frames, never wall time
const STEP = 0.05; // seconds: the cap src/loop.js puts on one frame
const percent = share => `${(share * 100).toFixed(2)} percent`;

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

/** One PNG into the test output and, when OWN_BODY_FRAMES names a directory, a copy there. */
async function keep(info, label, data) {
  const name = label.replace(/[^\w.+-]+/g, '_'); // a motion is named with spaces and a slash
  const bytes = Buffer.from(data.split(',')[1], 'base64');
  await writeFile(info.outputPath(name), bytes);
  if (env.OWN_BODY_FRAMES) { await mkdir(env.OWN_BODY_FRAMES, { recursive: true }); await writeFile(join(env.OWN_BODY_FRAMES, name), bytes); }
  return { file: name, sha256: createHash('sha256').update(bytes).digest('hex') };
}
async function record(info, name, value) {
  const text = JSON.stringify(value, null, 2);
  await writeFile(info.outputPath(name), text);
  if (env.OWN_BODY_FRAMES) { await mkdir(env.OWN_BODY_FRAMES, { recursive: true }); await writeFile(join(env.OWN_BODY_FRAMES, name), text); }
}

/** The pixel meter, installed in the page. It reads frames and never changes what the game draws next. */
async function installMeter(page) {
  await page.evaluate(async ({ legs, edge }) => {
    const src = new URL('src/', location.href).href, T = window.__THREE;
    const g = await import(src + 'builders/enemyGLTF.js'), w = await import(src + 'builders/weapon.js');
    const fp = await import(src + 'builders/firstPersonRig.js');
    const { camera, scene, renderer } = await import(src + 'scene.js');
    const { renderComicScene } = await import(src + 'comicOutline.js');
    const { player } = await import(src + 'entities/player.js');
    const input = await import(src + 'input.js');
    const { MOUSE_SENS } = await import(src + 'config.js');
    const rig = g.playerFirstPersonRig, gl = renderer.domElement;
    const sheets = [0, 1].map(() => { const canvas = document.createElement('canvas'); return { canvas, context: canvas.getContext('2d', { willReadFrequently: true }) }; });
    const read = sheet => {
      if (sheet.canvas.width !== gl.width || sheet.canvas.height !== gl.height) { sheet.canvas.width = gl.width; sheet.canvas.height = gl.height; }
      sheet.context.drawImage(gl, 0, 0);
      return sheet.context.getImageData(0, 0, gl.width, gl.height).data;
    };
    const differ = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++; return n; };
    // The first-person frame as src/loop.js draws it.
    const draw = () => fp.renderFirstPersonRig(rig, { weapon: w.wpn, worldWeapon: w.weapon3p, firstPerson: true, active: true },
      () => renderComicScene(renderer, scene, camera));
    /**
     * Call while the canvas still holds the frame to measure. `control`: also draw the frame once more
     * unchanged and count the pixels that differ from it (0 when the second drawing repeats the first).
     */
    function measure({ png = false, control = false } = {}) {
      const a = read(sheets[0]), pixels = a.length / 4;
      let ink = 0, dark = 0, pink = 0;
      for (let i = 0; i < a.length; i += 4) {
        const r = a[i], green = a[i + 1], b = a[i + 2];
        if (r === 8 && green === 9 && b === 11) ink++;
        if (r <= 24 && green <= 24 && b <= 24) dark++;
        if (Math.abs(r - 171) <= 2 && Math.abs(green - 145) <= 2 && Math.abs(b - 134) <= 2) pink++;
      }
      const meshes = []; rig.body.traverse(node => { if (node.isSkinnedMesh) meshes.push([node, node.visible]); });
      const shadows = renderer.shadowMap.autoUpdate; let repeated = null, body;
      renderer.shadowMap.autoUpdate = false;
      try {
        if (control) { draw(); repeated = differ(a, read(sheets[1])); }
        for (const [node] of meshes) node.visible = false;
        draw(); body = differ(a, read(sheets[1]));
      } finally {
        for (const [node, visible] of meshes) node.visible = visible;
        renderer.shadowMap.autoUpdate = shadows;
      }
      const joints = legs.map(name => ({ name,
        screen: rig.body.getObjectByName(name).getWorldPosition(new T.Vector3()).project(camera).toArray() }));
      // On screen: in front of the camera and both coordinates inside the edge.
      const onScreen = joints.filter(({ screen: [x, y, z] }) => Math.abs(x) < edge && Math.abs(y) < edge && z > -1 && z < 1).map(joint => joint.name);
      return { pixels, ink: ink / pixels, dark: dark / pixels, pinkPixels: pink, body: body / pixels, repeated,
        joints, onScreen, shown: rig.body.visible && rig.arms.visible, drawnMeshes: meshes.filter(([, visible]) => visible).length,
        png: png ? sheets[0].canvas.toDataURL('image/png') : undefined,
        pngHidden: png ? sheets[1].canvas.toDataURL('image/png') : undefined };
    }
    // A callback registered here runs after the loop's callback of the same frame, while the canvas
    // still holds what the loop drew. It counts frames and the loop's own capped time step.
    const state = { frames: 0, last: null, waiters: [], job: null, sequence: null };
    const tick = stamp => {
      const dt = state.last === null ? 0 : Math.min(0.05, (stamp - state.last) / 1000); state.last = stamp; state.frames++;
      if (state.job) { const job = state.job; state.job = null; job.resolve(measure(job.options)); }
      const run = state.sequence;
      if (run) {
        const m = measure({ control: run.count === 0 });
        if (run.count === 0) run.repeated = m.repeated;
        run.count++; run.seconds += dt;
        run.ink.push(m.ink); run.body.push(m.body); run.legs.push(m.onScreen.length); run.yaw.push(player.yaw); run.dt.push(dt);
        run.pitch.push(player.pitch); run.crouching.push(player.crouching); run.shown.push(m.shown); run.pink.push(m.pinkPixels); run.dark.push(m.dark);
        if (m.ink > run.inkMost) { run.inkMost = m.ink; run.worstInk = sheets[0].canvas.toDataURL('image/png'); }
        if (m.body > run.bodyMost) { run.bodyMost = m.body; run.worstBody = sheets[0].canvas.toDataURL('image/png'); }
      }
      for (const waiter of state.waiters.splice(0)) waiter();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const frame = () => new Promise(resolve => state.waiters.push(resolve));
    window.__ownBody = { player, input, rig, camera, renderer, measure, sense: MOUSE_SENS,
      wait: async count => { for (let i = 0; i < count; i++) await frame(); return state.frames; },
      still: () => new Promise(resolve => { state.job = { resolve, options: { png: true, control: true } }; }),
      begin: () => { state.sequence = { count: 0, seconds: 0, inkMost: 0, bodyMost: 0, repeated: null, worstInk: null, worstBody: null,
        ink: [], body: [], legs: [], yaw: [], dt: [], pitch: [], crouching: [], shown: [], pink: [], dark: [] }; },
      step: async () => { await frame(); return { count: state.sequence.count, seconds: state.sequence.seconds }; },
      end: () => { const run = state.sequence; state.sequence = null; run.last = sheets[0].canvas.toDataURL('image/png'); return run; },
      facts: () => ({ pitch: player.pitch, yaw: player.yaw, crouching: player.crouching, thirdPerson: player.thirdPerson,
        running: input.gameRunning, locked: input.locked, pointerLock: document.pointerLockElement === gl,
        eye: camera.position.toArray(), size: [gl.width, gl.height], pixelRatio: renderer.getPixelRatio() }) };
  }, { legs: ['calf_l', 'calf_r', 'foot_l', 'foot_r'], edge: LIMIT.edge });
}

/** The plan's three assertions on a list of rows; returns one line per miss. */
function judge(rows) {
  const misses = [];
  const standing = pitch => rows.find(row => row.stance === 'stand' && row.motion === 'still' && row.pitch === pitch);
  for (const row of rows) {
    const id = `${row.stance} ${row.pitch} ${row.motion}`;
    if (!(row.ink <= LIMIT.ink)) misses.push(`${id}: ink share ${percent(row.ink)} over ${percent(LIMIT.ink)}`);
    if (row.stance === 'crouch' && row.pitch > LIMIT.bodyAbove) {
      const reference = standing(row.pitch);
      if (!reference) misses.push(`${id}: no standing frame at this pitch`);
      else if (!(row.body <= reference.body + LIMIT.bodyOverStanding))
        misses.push(`${id}: own-body share ${percent(row.body)} over standing ${percent(reference.body)} plus ${percent(LIMIT.bodyOverStanding)}`);
    }
    if (row.motion === 'still' && row.pitch === LIMIT.lookDown) {
      if (!(row.legJoints >= LIMIT.legJoints[row.stance]))
        misses.push(`${id}: ${row.legJoints} leg joints on screen, fewer than ${LIMIT.legJoints[row.stance]}`);
      if (row.stance === 'stand' && !(row.body >= LIMIT.standingChest))
        misses.push(`${id}: own-body share ${percent(row.body)} under ${percent(LIMIT.standingChest)}, the standing look-down view lost its chest`);
    }
    if (row.repeated !== 0) misses.push(`${id}: the frame drawn again differs in ${row.repeated} pixels, so its own-body share is not a measurement`);
    if (row.shown !== true) misses.push(`${id}: the first-person views were not shown`);
  }
  return misses;
}
const tableOf = rows => rows.map(row => ({ stance: row.stance, pitch: row.pitch, motion: row.motion,
  inkPercent: +(row.ink * 100).toFixed(3), bodyPercent: +(row.body * 100).toFixed(3), darkPercent: +(row.dark * 100).toFixed(3),
  legJoints: row.legJoints, pinkPixels: row.pinkPixels, frames: row.frames, inkFrames: row.inkFrames }));

test('own body: the existing sequence of eight first-person frames keeps ink and the body out of the view', async ({ page }, info) => {
  test.setTimeout(120000);
  await installMeter(page);
  const result = await page.evaluate(async pitches => {
    const src = new URL('src/', location.href).href, T = window.__THREE, meter = window.__ownBody;
    const g = await import(src + 'builders/enemyGLTF.js'), w = await import(src + 'builders/weapon.js');
    const fp = await import(src + 'builders/firstPersonRig.js'), driver = await import(src + 'builders/enemyAnimations.js');
    const { camera, scene, renderer } = await import(src + 'scene.js');
    const { renderComicScene } = await import(src + 'comicOutline.js');
    const { player } = await import(src + 'entities/player.js');
    (await import(src + 'input.js')).setGameRunning(false);
    const rig = g.playerFirstPersonRig, actor = { mesh: g.playerMesh, mixer: g.playerMixer, actions: g.playerActions };
    g.playerMixer.stopAllAction(); // this driver object owns every layer; the loop's own object left its standing layer running
    const eye = camera.position.clone(), aim = camera.quaternion.clone();
    const frames = []; let tick = 0, settleTicks = 0;
    try {
      for (const crouching of [false, true]) for (const pitch of pitches) {
        camera.position.copy(eye); if (crouching) camera.position.y -= .8;
        camera.quaternion.setFromEuler(new T.Euler(pitch, player.yaw, 0, 'YXZ'));
        w.restorePlayerWeaponHandling();
        const observation = { identity: 'pitch-view', weapon: 'm4',
          position: { x: eye.x, y: camera.position.y, z: eye.z }, sampleTimeSeconds: ++tick * .05,
          bodyYaw: player.yaw, aimYaw: player.yaw, pitch, crouching, onGround: true, alive: true, action: { kind: 'ready' } };
        let pose = driver.tickPresentation(actor, observation, .05);
        if (crouching && pitch === -1.38) { // the first crouched sample is taken settled: ticks of 0.05 s, no wall time
          const pelvisY = () => { actor.mesh.updateMatrixWorld(true); return actor.mesh.getObjectByName('pelvis').getWorldPosition(new T.Vector3()).y; };
          let last = pelvisY(), done = false;
          for (let n = 1; n <= 40 && !done; n++) { pose = driver.tickPresentation(actor, observation, .05); const y = pelvisY(); done = n >= 10 && Math.abs(y - last) < 1e-4; last = y; settleTicks = n; }
          if (!done) throw new Error('crouch pose did not settle within 40 ticks');
        }
        w.updatePlayerWeaponHandling(pose, actor.mesh);
        fp.updateFirstPersonRig(rig, { pose, camera, weapon: w.wpn, dt: .05,
          rawCorrections: w.playerWeaponHandling.get('3p:m4').corrections,
          spineQuaternion: actor._presentationCorrection.get(actor.mesh.getObjectByName('spine_03')) });
        for (const firstPerson of [true, false]) {
          fp.renderFirstPersonRig(rig, { weapon: w.wpn, worldWeapon: w.weapon3p, firstPerson, active: true }, () => {
            if (firstPerson) renderComicScene(renderer, scene, camera);
          });
          // The canvas holds the first-person frame of this sample; the meter draws it twice more and puts every flag back.
          if (firstPerson) frames.push({ crouching, pitch, eye: camera.position.toArray(), ...meter.measure({ png: true, control: true }) });
        }
      }
      return { frames, settleTicks, facts: meter.facts() };
    } finally { camera.position.copy(eye); camera.quaternion.copy(aim); }
  }, SEQUENCE_PITCHES);
  const rows = [];
  for (const frame of result.frames) {
    const stance = frame.crouching ? 'crouch' : 'stand';
    rows.push({ stance, pitch: frame.pitch, motion: 'still', frames: 1, inkFrames: frame.ink > 0 ? 1 : 0,
      ink: frame.ink, body: frame.body, dark: frame.dark, pinkPixels: frame.pinkPixels, repeated: frame.repeated, shown: frame.shown,
      legJoints: frame.onScreen.length, onScreen: frame.onScreen, joints: frame.joints, eye: frame.eye, drawnMeshes: frame.drawnMeshes,
      frame: await keep(info, `A-${stance}-${frame.pitch}.png`, frame.png),
      frameBodyHidden: await keep(info, `A-${stance}-${frame.pitch}-body-hidden.png`, frame.pngHidden) });
  }
  const misses = judge(rows);
  await record(info, 'own-body-existing-sequence.json', { limits: LIMIT, settleTicks: result.settleTicks, facts: result.facts, rows, misses });
  console.log('OWN-BODY-SEQUENCE ' + JSON.stringify({ table: tableOf(rows), misses }));
  expect(rows).toHaveLength(8);
  expect(misses).toEqual([]);
});

test('own body: the real game loop with key and pointer input keeps ink and the body out of the view', async ({ page }, info) => {
  // Budget for the whole case only: every wait inside is a count of rendered frames (about 3400 in
  // all, 2200 of them measured with one more drawing each), and software rendering runs at roughly
  // 7 to 20 frames per second here.
  test.setTimeout(1500000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await installMeter(page);
  const meter = (call, argument) => page.evaluate(([name, value]) => window.__ownBody[name](value), [call, argument]);
  const start = await meter('facts');
  const sense = await page.evaluate(() => window.__ownBody.sense);
  // The pointer. With pointer lock (the Training Range button asks for it on the click) a mouse sends
  // unbounded movement and page.mouse.move delivers it as trusted mousemove events. Without it, the
  // game's own lock flag stands in and the pointer is carried back to the middle with the flag off.
  const lock = start.pointerLock ? 'pointer lock' : 'lock flag set by the spec';
  const cursor = { x: 0, y: 0 };
  if (start.pointerLock) await page.mouse.move(cursor.x, cursor.y); // from here on the pointer's place is known
  else await page.evaluate(() => window.__ownBody.input.setLocked(true));
  const pointer = async (dx, dy) => {
    if (start.pointerLock) { cursor.x += dx; cursor.y += dy; await page.mouse.move(cursor.x, cursor.y); return; }
    for (let left = [dx, dy]; left[0] || left[1];) {
      const part = left.map(value => Math.max(-250, Math.min(250, value)));
      await page.evaluate(() => window.__ownBody.input.setLocked(false)); await page.mouse.move(400, 300);
      await page.evaluate(() => window.__ownBody.input.setLocked(true)); await page.mouse.move(400 + part[0], 300 + part[1]);
      left = [left[0] - part[0], left[1] - part[1]];
    }
  };
  // Moving the mouse down lowers the pitch; moving it right lowers the yaw (src/main.js).
  const lookTo = async pitch => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const pixels = Math.round(((await meter('facts')).pitch - pitch) / sense);
      if (!pixels) break;
      await pointer(0, pixels);
    }
    const reached = (await meter('facts')).pitch;
    expect(Math.abs(reached - pitch), `pitch ${pitch} by pointer movement`).toBeLessThanOrEqual(sense);
    return reached;
  };
  const faceTo = async yaw => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const pixels = Math.round(((await meter('facts')).yaw - yaw) / sense);
      if (!pixels) break;
      await pointer(pixels, 0);
    }
    expect(Math.abs((await meter('facts')).yaw - yaw), 'yaw by pointer movement').toBeLessThanOrEqual(sense);
  };
  const rows = [];
  const still = async (stance, pitch) => {
    await faceTo(Math.PI); // the hall is 80 m deep: facing +Z leaves room to walk
    const reached = await lookTo(pitch);
    if (stance === 'crouch') {
      // Amendment 1, D: a few crouched steps forward and a full stop, so the feet stand under the
      // view and the still carries no twist left over from the turn before it.
      await page.keyboard.down('KeyW'); await meter('wait', PLANT); await page.keyboard.up('KeyW');
    }
    await meter('wait', SETTLE);
    const m = await meter('still'), facts = await meter('facts');
    rows.push({ stance, pitch, motion: 'still', frames: 1, inkFrames: m.ink > 0 ? 1 : 0, reachedPitch: reached, crouching: facts.crouching,
      ink: m.ink, body: m.body, dark: m.dark, pinkPixels: m.pinkPixels, repeated: m.repeated, shown: m.shown,
      legJoints: m.onScreen.length, onScreen: m.onScreen, joints: m.joints, eye: facts.eye, drawnMeshes: m.drawnMeshes,
      frame: await keep(info, `B-${stance}-${pitch}-still.png`, m.png),
      frameBodyHidden: await keep(info, `B-${stance}-${pitch}-still-body-hidden.png`, m.pngHidden) });
  };
  /** `frames` measured frames; `turned(seconds)` is how far the view has turned right by then, in radians. */
  const moving = async (stance, pitch, motion, frames, turned) => {
    await meter('begin');
    let sent = 0;
    const turn = async seconds => {
      if (!turned) return;
      const pixels = Math.round((turned(seconds + STEP) - sent) / sense); // where the view is to be on the next frame
      if (pixels) { await pointer(pixels, 0); sent += pixels * sense; }
    };
    await turn(0);
    for (;;) {
      const at = await meter('step');
      if (at.count >= frames) break;
      await turn(at.seconds);
    }
    const run = await meter('end');
    const most = values => Math.max(...values), turnedBy = run.yaw.slice(1).reduce((sum, yaw, i) => sum + Math.abs(yaw - run.yaw[i]), 0);
    const row = { stance, pitch, motion, frames: run.count, inkFrames: run.ink.filter(share => share > 0).length,
      inkOverLimitFrames: run.ink.filter(share => share > LIMIT.ink).length, bodyFrames: run.body.filter(share => share > 0).length,
      ink: most(run.ink), body: most(run.body), dark: most(run.dark), pinkPixels: most(run.pink), repeated: run.repeated,
      shown: run.shown.every(Boolean), crouching: run.crouching.every(Boolean), legJoints: Math.min(...run.legs),
      pitchSeen: [Math.min(...run.pitch), most(run.pitch)], simulatedSeconds: run.seconds,
      turnRate: turnedBy / run.dt.slice(1).reduce((sum, dt) => sum + dt, 0), perFrame: { ink: run.ink, body: run.body, legs: run.legs, yaw: run.yaw, dt: run.dt },
      lastFrame: await keep(info, `B-${stance}-${pitch}-${motion}-last.png`, run.last) };
    if (run.worstInk) row.worstInkFrame = await keep(info, `B-${stance}-${pitch}-${motion}-most-ink.png`, run.worstInk);
    if (run.worstBody) row.worstBodyFrame = await keep(info, `B-${stance}-${pitch}-${motion}-most-body.png`, run.worstBody);
    rows.push(row);
    await meter('wait', REST);
  };
  const swing = seconds => { const t = seconds % 1; return 4 * (t < 0.5 ? t : 1 - t); }; // 4 rad/s, reversing every 0.5 s

  for (const pitch of PITCHES) await still('stand', pitch);
  await page.keyboard.down('KeyC'); // crouch, held as a player holds it
  await meter('wait', SETTLE);
  for (const pitch of PITCHES) {
    await still('crouch', pitch);
    await moving('crouch', pitch, 'turn 1 rad/s', TURN, seconds => seconds);
    await moving('crouch', pitch, 'turn 3 rad/s', TURN, seconds => 3 * seconds);
    await moving('crouch', pitch, 'swing 4 rad/s', SWING, swing);
  }
  // W-09: crouch-walking forward and looking straight up.
  await lookTo(1.38); await faceTo(Math.PI); await meter('wait', REST);
  await page.keyboard.down('KeyW');
  await moving('crouch', 1.38, 'walk forward', WALK, null);
  await page.keyboard.up('KeyW');
  const end = await meter('facts');
  await page.keyboard.up('KeyC');

  const misses = judge(rows);
  for (const row of rows.filter(each => each.stance === 'crouch'))
    if (row.crouching !== true) misses.push(`${row.stance} ${row.pitch} ${row.motion}: the player was not crouching`);
  await record(info, 'own-body-real-loop.json', { limits: LIMIT, input: { pitchAndYaw: `trusted mousemove events through ${lock}`, crouch: 'KeyC held', walk: 'KeyW held' },
    start, end, mouseSense: sense, rows, misses, errors });
  console.log('OWN-BODY-LOOP ' + JSON.stringify({ input: lock, table: tableOf(rows), misses }));
  expect(start.running && !start.thirdPerson).toBe(true);
  expect(rows).toHaveLength(2 * PITCHES.length + 3 * PITCHES.length + 1);
  expect(errors).toEqual([]);
  expect(misses).toEqual([]);
});
