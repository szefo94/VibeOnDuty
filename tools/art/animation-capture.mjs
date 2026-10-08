import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { createServer as createPortProbe } from 'node:net';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { ROOT, CACHE, hash, approvedArtMotion, iterationPath } from './pipeline.mjs';
import { verifyRuntimeDependencies } from './runtime-dependencies.mjs';

const EVIDENCE = path.join(ROOT, '.planning/phases/07-movement-matched-and-action-safe-animation/evidence');
export const REQUIRED_ASSERTIONS = [
  'tests/action-lifecycle.spec.js#throw1ms',
  'tests/animation-regressions.spec.js#repeated-removal-keeper',
];
export const REQUIRED_STABLE_GATES = ['lint', 'typecheck', 'typecheck:mp', 'build', 'unit', 'offline', 'multiplayer'];
export function requireStableGates(identities, evidence) {
  verifyRuntimeDependencies(identities);
  assert.deepEqual(evidence?.identities, identities, 'Stale or missing stable gate identities');
  for (const id of REQUIRED_STABLE_GATES) {
    const check = evidence.checks?.find(check => check.id === id);
    assert.equal(check?.executed, true, 'Unrun stable gate: ' + id);
    assert.equal(check?.exitCode, 0, 'Nonpassing stable gate: ' + id);
    assert.equal(check?.scope, 'full', 'Partial stable gate: ' + id);
    assert.match(check?.logSha256 || '', /^[a-f0-9]{64}$/, 'Missing stable gate log: ' + id);
  }
  return true;
}
export function requirePlan09(identities, summary, qualification) {
  // Accept the canonical root scalar only, never historical body text or a
  // nested YAML status. Ambiguous/noncanonical status syntax fails closed.
  const frontmatter = summary.replaceAll('\r\n', '\n').match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  const lines = frontmatter?.[1].split('\n') ?? [];
  const statuses = lines.filter(line => /^(?:status\b|['"]status['"])/.test(line));
  // Restrict root keys to the summary's plain mapping form. Quoted/escaped or
  // explicit YAML keys could otherwise hide a second root status. A scalar
  // status cannot itself own an indented mapping/sequence.
  const rootLines = lines.filter(line => line && !/^[ #]/.test(line));
  const statusIndex = lines.indexOf(statuses[0]);
  const statusChildren = lines.slice(statusIndex + 1).find(line => line.trim() && !/^ *#/.test(line));
  assert.ok(frontmatter && statuses.length === 1 && /^status: complete *$/.test(statuses[0])
    && rootLines.every(line => /^[A-Za-z][A-Za-z0-9_-]*:/.test(line))
    && !/^ /.test(statusChildren ?? '')
    && !lines.some(line => /^\t/.test(line)), 'Plan09 is missing, halted or unqualified');
  verifyRuntimeDependencies(identities);
  assert.equal(qualification?.complete, true, 'Missing complete plan09 qualification');
  assert.deepEqual(qualification.identities, identities, 'Stale plan09 qualification');
  assert.equal(qualification.applicableBudgetPass, true, 'Plan09 fixed-V2 acceptance is unqualified');
  for (const name of REQUIRED_ASSERTIONS) {
    const result = qualification.assertions?.find(a => a.id === name);
    assert.equal(result?.executed, true, 'Unrun required browser assertion: ' + name);
    assert.equal(result?.status, 'pass', 'Unqualified required browser assertion: ' + name);
    assert.equal(result?.exitCode, 0, 'Nonpassing required browser assertion: ' + name);
    assert.match(result?.logSha256 || '', /^[a-f0-9]{64}$/, 'Missing assertion log identity');
  }
  return true;
}

export async function executeV2(directory) {
  const qualification = await fs.readFile(path.join(EVIDENCE, '07-09-qualification.json'), 'utf8')
    .then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  const candidatePath = qualification?.candidate
    ? path.resolve(ROOT, qualification.candidate) : path.join(EVIDENCE, '07-10-current-source-smoke.json');
  await iterationPath([EVIDENCE], candidatePath);
  const args = ['tools/art/animation-budget-v2.mjs', 'verify', '--budget',
    path.join(EVIDENCE, '07-budget-view-v2.json'), '--candidate', candidatePath];
  const start = Date.now();
  const result = await promisify(execFile)(process.execPath, args,
    { cwd: ROOT, windowsHide: true, timeout: 120000, maxBuffer: 4000000 }).then(
    r => ({ exitCode: 0, stdout: r.stdout, stderr: r.stderr }),
    e => ({ exitCode: Number.isInteger(e.code) ? e.code : null, stdout: e.stdout || '',
      stderr: e.stderr || String(e), timedOut: !!e.killed }));
  const log = path.join(directory, 'v2-current-source.log');
  await fs.writeFile(log, result.stdout + '\n' + result.stderr);
  let value;
  try { value = JSON.parse(result.stdout.trim()); } catch { value = null; }
  return { command: [process.execPath, ...args].join(' '), ...result, durationMs: Date.now() - start,
    result: value, log: relative(log), logSha256: hash(await fs.readFile(log)),
    passed: result.exitCode === 0 && value?.applicableBudgetPass === true };
}
const relative = filename => path.relative(ROOT, filename).replaceAll('\\', '/');
const reloadSeconds = { m4: 1.8, p90: 2, awp: 2.5, pistol: 1.2 };

async function ownedFreePort() {
  const probe=createPortProbe();
  await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});
  const port=probe.address().port;
  await new Promise((resolve,reject)=>probe.close(error=>error?reject(error):resolve()));
  return port;
}

async function observe(page, label) {
  return page.evaluate(async label => {
    if (window.__movingRead) return { ...window.__movingRead(), label };
    const { player } = await import('/src/entities/player.js');
    const { playerMixer, playerFirstPersonRig } = await import('/src/builders/enemyGLTF.js');
    const { camera, renderer } = await import('/src/scene.js');
    const { getThirdPerson } = await import('/src/loop.js');
    const { getGraphicsQuality } = await import('/src/graphicsQuality.js');
    return { label, wallMs: performance.now(), mixerTime: playerMixer?.time,
      weapon: player.weapon, ammo: player.ammo, reserve: player.reserve, hp: player.hp, energy: player.energy,
      dead: player.dead, reloadMs: player.reloadTimer, reloading: player.reloading,
      punching: player.punching, throwingNade: player.throwingNade,
      aiming: player.aiming, aimT:player.aimT, crouching: player.crouching, onGround: player.onGround,
      eye: camera.position.toArray(), pitch: player.pitch, yaw: player.yaw,
      thirdPerson: getThirdPerson?.(), draws: renderer.info.render.calls,
      quality: getGraphicsQuality(), shadows: renderer.shadowMap.enabled,
      contacts: [...(playerFirstPersonRig?.handlers ?? [])].map(owner => ({ weapon: owner.weapon,
        contacts: owner.contacts ? structuredClone(owner.contacts) : null })),
      pose: window.__presentationDebug?.() ?? null };
  }, label);
}
async function installObserver(page) {
  await page.evaluate(async () => {
    const p = await import('/src/entities/player.js'), g = await import('/src/builders/enemyGLTF.js');
    const world = await import('/src/scene.js'), view = await import('/src/loop.js');
    const quality = await import('/src/graphicsQuality.js'), mode = await import('/src/modes/modeManager.js');
    const history = [], recentFrames = []; let frames = 0, dropped = 0, raf, key = '';
    const read = () => {
      const player = p.player;
      return { wallMs: performance.now(), mixerTime: g.playerMixer?.time, mode: mode.getMode()?.name,
        weapon: player.weapon, ammo: player.ammo, reserve: player.reserve, hp: player.hp, energy: player.energy,
        dead: player.dead, reloadMs: player.reloadTimer, reloading: player.reloading,
        punching: player.punching, throwingNade: player.throwingNade, aiming: player.aiming, aimT:player.aimT,
        crouching: player.crouching, onGround: player.onGround, eye: world.camera.position.toArray(),
        pitch: player.pitch, yaw: player.yaw, thirdPerson: view.getThirdPerson(),
        quality: quality.getGraphicsQuality(), shadows: world.renderer.shadowMap.enabled,
        draws: world.renderer.info.render.calls, pose: window.__presentationDebug?.() ?? null,
        contacts: [...(g.playerFirstPersonRig?.handlers ?? [])].filter(h => h.weapon === player.weapon)
          .map(h => ({weapon: h.weapon, contacts: h.contacts ? structuredClone(h.contacts) : null})) };
    };
    const tick = () => {
      frames++; const sample = read();
      recentFrames.push(sample);
      if (recentFrames.length > 16) recentFrames.shift();
      const next = [sample.weapon,sample.ammo,sample.hp,sample.energy,sample.aiming,sample.reloading,sample.punching,sample.throwingNade,
        sample.dead,sample.crouching,sample.onGround,sample.pose?.upper,sample.pose?.moving,
        Math.floor(sample.aimT*100),
        Math.floor((sample.pose?.action?.phase ?? sample.pose?.phase ?? 0)*10)].join('/');
      if (next !== key) { history.push(sample); key = next; if (history.length > 4096) {history.shift();dropped++;} }
      raf = requestAnimationFrame(tick);
    };
    window.__movingRead = read;
    window.__movingSince = time => history.filter(s => s.wallMs >= time);
    window.__movingFrames = () => recentFrames;
    window.__movingObserverInfo = () => ({ frames, dropped, samples: history.length,
      clock: 'Native game RAF, unchanged capped delta; observation only' });
    window.__movingObserverDispose = () => cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  });
}
async function ordinaryLook(page, yaw, pitch) {
  await page.evaluate(async ({yaw,pitch}) => {
    const { player } = await import('/src/entities/player.js');
    const { MOUSE_SENS } = await import('/src/config.js');
    let delta = player.yaw-yaw; while(delta>Math.PI)delta-=2*Math.PI;while(delta< -Math.PI)delta+=2*Math.PI;
    document.dispatchEvent(new MouseEvent('mousemove', { movementX:delta/MOUSE_SENS,
      movementY:(player.pitch-pitch)/MOUSE_SENS }));
  }, {yaw,pitch});
}
async function weaponSegment(page, specification) {
  await badge(page, `Actual ${specification.tier}/${specification.weapon}/${specification.view} · ADS/fire/physical reload · normal game clock`);
  const start = await observe(page, 'segment-start');
  await page.mouse.down({button:'right'});
  await page.waitForFunction(({time,third})=>window.__movingFrames().some(s=>s.wallMs>=time
    &&s.aiming&&s.aimT>=.99&&s.pose?.upper==='ads'&&s.pose.aiming&&s.thirdPerson===third),
    {time:start.wallMs,third:specification.view==='third'});
  await page.mouse.down({button:'left'});
  await page.waitForFunction(ammo => window.__movingRead().ammo < ammo, start.ammo);
  await page.mouse.up({button:'left'}); await page.mouse.up({button:'right'});
  const beforeReload = await observe(page, 'reload-input');
  await page.keyboard.press('KeyR');
  await page.waitForFunction(time => {
    const history = window.__movingSince(time), current = window.__movingRead();
    return history.some(s => s.reloading) && !current.reloading && current.ammo > history.find(s => s.reloading).ammo;
  }, beforeReload.wallMs, { timeout: 30000 });
  const observations = await page.evaluate(time => window.__movingSince(time), start.wallMs);
  const end = await observe(page, 'ready-after-reload'); observations.push(end);
  const coverage = { quality: observations.every(o => o.quality === specification.tier),
    view: specification.view==='third'?end.thirdPerson:!end.thirdPerson
      &&(specification.view==='down'?end.pitch< -1:Math.abs(end.pitch)<.01),
    ads: observations.some(o => o.aiming&&o.aimT>=.99&&o.pose?.upper==='ads'&&o.pose.aiming), fire: observations.some(o => o.ammo < start.ammo),
    physicalReload: observations.some(o => o.reloading) && end.ammo > beforeReload.ammo && !end.reloading,
    actualFrames: end.mixerTime > start.mixerTime };
  return { ...specification, kind:'actual-offline-weapon-segment', clock:'Normal game RAF and capped delta',
    observations, coverage, completed:Object.values(coverage).every(Boolean),
    eligibleActions:['ADS','fire','reload'], unsupportedHere:'Range starts at zero grenade energy; grenade proof belongs to legally earned combat union',
    observer: await page.evaluate(() => window.__movingObserverInfo()), baseReloadSeconds:reloadSeconds[specification.weapon] };
}
async function sharedMovementUnion(page, tier) {
  const observations = [];
  await ordinaryLook(page, Math.PI, 0);
  for (const code of ['KeyW','KeyS','KeyA','KeyD']) {
    const start = (await observe(page,'movement-input')).wallMs;
    await page.keyboard.down(code);
    try { await page.waitForFunction(time => window.__movingSince(time).some(s => s.pose?.moving), start); }
    finally { await page.keyboard.up(code); }
    observations.push(await observe(page, code));
  }
  const sprintAt = (await observe(page,'sprint-input')).wallMs;
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
  try { await page.waitForFunction(time => window.__movingSince(time).some(s => s.pose?.upper === 'sprint'), sprintAt); }
  finally { await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); }
  const crouchAt = (await observe(page,'crouch-input')).wallMs;
  await page.keyboard.down('ControlLeft');
  try { await page.waitForFunction(time => window.__movingSince(time).some(s => s.crouching), crouchAt); }
  finally { await page.keyboard.up('ControlLeft'); }
  const jumpAt = (await observe(page,'jump-input')).wallMs;
  await page.keyboard.press('Space');
  await page.waitForFunction(time => window.__movingSince(time).some(s => !s.onGround) && window.__movingRead().onGround, jumpAt, {timeout:30000});
  for (const pitch of [-1.3,1.3,0]) { await ordinaryLook(page,Math.PI,pitch); observations.push(await observe(page,'pitch')); }
  const meleeAt = (await observe(page,'melee-reload-input')).wallMs;
  await page.mouse.click(640,480); await page.keyboard.press('KeyR'); await page.keyboard.press('KeyF');
  await page.waitForFunction(time => window.__movingSince(time).some(s => s.punching && !s.reloading), meleeAt);
  const history = await page.evaluate(time => window.__movingSince(time), sprintAt);
  return {tier,kind:'actual-shared-gait-action-union',complete:true, observations,
    history, eligibleActions:['directional','sprint','crouch','jump','pitch','melee-reload-interruption'],
    deadlineLimits:'Exact equality at reload deadline remains dependent on executed lifecycle assertions, not driver timing'};
}
async function earnedCombatUnion(page, tier, recordStep) {
  await badge(page, `Actual ${tier} TDM · earn grenade energy through enemy damage · normal input/clock`);
  const start = (await observe(page,'combat-start')).wallMs;
  await page.evaluate(async () => {
      const {enemies} = await import('/src/entities/enemies.js');
      const {player} = await import('/src/entities/player.js');
      const {camera} = await import('/src/scene.js');
      const {groundElevation} = await import('/src/map.js');
      const {hasLOS} = await import('/src/utils/los.js');
      const {BULLET_GRAV,BULLET_SPEED,MOUSE_SENS} = await import('/src/config.js');
      let route=0,raf,left=false,walking=false,aiming=false,lastJournal=0,approaching=false;
      const points=[[62,46],[62,22],[34,22],[34,46]], progress=[];
      const mouse=(button,down)=>document.dispatchEvent(new MouseEvent(down?'mousedown':'mouseup',{button,bubbles:true}));
      const forward=down=>{if(walking===down)return;walking=down;
        document.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code:'KeyW',bubbles:true}));};
      const fire=down=>{if(left===down)return;left=down;mouse(0,down);};
      const look=(yaw,pitch)=>{let delta=player.yaw-yaw;while(delta>Math.PI)delta-=2*Math.PI;while(delta< -Math.PI)delta+=2*Math.PI;
        const requested={movementX:delta/MOUSE_SENS,movementY:(player.pitch-pitch)/MOUSE_SENS};
        const event=new MouseEvent('mousemove',{...requested,bubbles:true});
        const constructorValues={movementX:event.movementX,movementY:event.movementY};
        const before={yaw:player.yaw,pitch:player.pitch};
        document.dispatchEvent(event);
        return {requested,constructorValues,before,after:{yaw:player.yaw,pitch:player.pitch},desired:{yaw,pitch}};};
      const tick=()=>{
        const target=enemies.filter(e => !e.dead && e.sndTeam !== 'friend').map(e => {
        const y=groundElevation(e.x,e.z)+.99;
        const distance=Math.hypot(e.x-camera.position.x,y-camera.position.y,e.z-camera.position.z);
        return {x:e.x,z:e.z,y:y+.5*BULLET_GRAV*(distance/BULLET_SPEED)**2,distance,
          visible:hasLOS(camera.position.x,camera.position.y,camera.position.z,e.x,y,e.z)};
        }).sort((a,b)=>Number(b.visible)-Number(a.visible)||a.distance-b.distance)[0];
        let aimProof=null;
        if(player.dead||!approaching&&player.energy>=100){fire(false);forward(false);}
        else if(target?.visible){
          forward(approaching);if(!approaching&&!aiming){aiming=true;mouse(2,true);}
          aimProof=look(Math.atan2(-(target.x-camera.position.x),-(target.z-camera.position.z)),
            Math.atan2(target.y-camera.position.y,Math.hypot(target.x-camera.position.x,target.z-camera.position.z)));
          const direction=camera.getWorldDirection(new window.__THREE.Vector3());
          const desired=new window.__THREE.Vector3(target.x-camera.position.x,target.y-camera.position.y,target.z-camera.position.z).normalize();
          aimProof.cameraDirection=direction.toArray();aimProof.desiredDirection=desired.toArray();aimProof.dot=direction.dot(desired);
          aimProof.collision={center:[target.x,target.y-.5*BULLET_GRAV*(target.distance/BULLET_SPEED)**2,target.z],radius:.75,distance:target.distance};
          fire(!approaching);
        }else{
          fire(false);const point=points[route%points.length];
          if(Math.hypot(point[0]-camera.position.x,point[1]-camera.position.z)<1)route++;
          look(Math.atan2(-(point[0]-camera.position.x),-(point[1]-camera.position.z)),0);forward(true);
        }
        progress.push({...window.__movingRead(),target,route,aimProof,input:{left,walking,aiming}});
        if(progress.length>256)progress.shift();
        if(performance.now()-lastJournal>5000){lastJournal=performance.now();
          console.info('[moving-combat] '+JSON.stringify({wallMs:lastJournal,mixerTime:window.__movingRead().mixerTime,
            hp:player.hp,energy:player.energy,ammo:player.ammo,dead:player.dead,eye:camera.position.toArray(),
            visible:target?.visible,route,aimProof,input:{left,walking,aiming}}));}
        raf=requestAnimationFrame(tick);
      };
      window.__combatDriverProgress=()=>progress;
      window.__combatDriverDispose=()=>{cancelAnimationFrame(raf);fire(false);forward(false);mouse(2,false);};
      window.__combatDriverApproach=()=>{approaching=true;raf=requestAnimationFrame(tick);};
      raf=requestAnimationFrame(tick);
  });
  try {
    await page.waitForFunction(()=>window.__combatDriverProgress().some(s=>s.aimProof),null,{timeout:30000});
    const proof=await page.evaluate(()=>window.__combatDriverProgress().find(s=>s.aimProof));
    assert.ok(proof.aimProof.dot>.999,'Normal mouse aim did not align with the observed viable target');
    console.log('Moving combat accepted-aim proof: '+JSON.stringify(proof.aimProof));
    await recordStep('accepted-aim',{proof});
    await page.waitForFunction(()=>window.__movingRead().energy>=100,null,{timeout:120000});
  } catch(error){
    error.combatProgress=await page.evaluate(()=>window.__combatDriverProgress());throw error;
  } finally {await page.evaluate(()=>window.__combatDriverDispose());}
  const earned=await observe(page,'earned-grenade-resource');
  assert.ok(earned.energy>=100,'Normal combat did not earn grenade eligibility within its bound');
  await recordStep('earned-resource',{earned});
  await page.keyboard.press('KeyR');
  const throwAt=(await observe(page,'throw-input')).wallMs;
  await page.mouse.click(640,480,{button:'middle'});
  await page.waitForFunction(time=>window.__movingSince(time).some(s=>s.throwingNade&&!s.reloading&&s.energy===0),throwAt,{timeout:30000});
  await recordStep('throw-canceled-reload',{observations:await page.evaluate(time=>window.__movingSince(time),throwAt)});
  const teams = await page.evaluate(async()=>(await import('/src/entities/enemies.js')).enemies.map(e=>e.sndTeam));
  await page.evaluate(()=>window.__combatDriverApproach());
  try {
    await page.waitForFunction(time=>window.__movingSince(time).some(s=>s.dead),start,{timeout:60000});
    await recordStep('natural-death',{observations:await page.evaluate(time=>window.__movingSince(time),start)});
    await page.waitForFunction(()=>!window.__movingRead().dead,null,{timeout:45000});
    await recordStep('natural-respawn',{sample:await observe(page,'respawn')});
  }finally{await page.evaluate(()=>window.__combatDriverDispose());}
  return {tier,kind:'actual-earned-resource-combat-union',complete:true, earned,teams,
    aimProof:await page.evaluate(()=>window.__combatDriverProgress()),
    observations:await page.evaluate(time=>window.__movingSince(time),start),
    eligibleActions:['grenade','reload-interruption','damage','death','respawn'],
    resourceAuthority:'Unmodified enemy damage awards only; no stats, targets, poses or clocks set by collector'};
}
async function badge(page, text) {
  await page.evaluate(text => {
    let node = document.getElementById('moving-review-evidence-label');
    if (!node) {
      node = document.createElement('div'); node.id = 'moving-review-evidence-label';
      Object.assign(node.style, { position: 'fixed', top: '4px', left: '4px', zIndex: '99999',
        color: 'white', background: 'rgba(0,0,0,.8)', font: '14px monospace', padding: '4px' });
      document.body.append(node);
    }
    node.textContent = text;
  }, text);
}
async function waitAnimation(page) {
  const before = await observe(page, 'clock-before');
  await page.waitForFunction(async time => {
    const { playerMixer } = await import('/src/builders/enemyGLTF.js');
    return playerMixer?.time > time + .1;
  }, before.mixerTime, { timeout: 15000 });
}
async function blockedWalkUnion(page, tier) {
  const before = await observe(page, 'blocked-walk-start');
  await badge(page, `Actual held-forward wall contact · ${tier} · planted stationary feet`);
  await page.evaluate(async () => {
    const { player } = await import('/src/entities/player.js');
    const { MOUSE_SENS } = await import('/src/config.js');
    document.dispatchEvent(new MouseEvent('mousemove', { movementX: player.yaw / MOUSE_SENS }));
  });
  await page.keyboard.down('KeyW');
  let blocked;
  try {
    await page.waitForFunction(() => {
      const frames = window.__movingFrames().slice(-3);
      return frames.length === 3 && frames.every(sample => sample.eye[2] < 4.8
        && sample.pose?.speed < .05 && sample.pose.moving === false && sample.pose.cadence === 0)
        && Math.hypot(frames[2].eye[0]-frames[0].eye[0],frames[2].eye[2]-frames[0].eye[2]) < .001;
    }, null, { timeout: 30000 });
    const stationary = await page.evaluate(() => window.__movingFrames().slice(-3));
    blocked = {...stationary[0], label:'blocked-held-forward'};
    const stable = {...stationary[2], label:'blocked-still-held-forward'};
    assert.equal(stable.pose.moving, false);
    assert.equal(stable.pose.cadence, 0);
    assert.ok(Math.hypot(stable.eye[0] - blocked.eye[0], stable.eye[2] - blocked.eye[2]) < .001);
    assert.ok(before.eye[2] - blocked.eye[2] > 1);
    return { tier, kind: 'actual-blocked-gait-union', complete: true, observations: [before, blocked, stable] };
  } finally {
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyS');
    try { await page.waitForFunction(async z => (await import('/src/scene.js')).camera.position.z >= z, before.eye[2], { timeout: 30000 }); }
    finally { await page.keyboard.up('KeyS'); }
  }
}
async function actualChain(page, specification) {
  const observations = [];
  const take = async label => { await waitAnimation(page); observations.push(await observe(page, label)); };
  const key = async (code, label) => {
    await page.keyboard.down(code); await take(label); await page.keyboard.up(code);
  };
  await badge(page, `Actual offline inputs · ${specification.tier}/${specification.weapon}/${specification.view} · ${specification.asset}`);
  await take('ready');
  for (const [code, name] of [['KeyW', 'forward'], ['KeyS', 'reverse'], ['KeyA', 'left'], ['KeyD', 'right']])
    await key(code, name);
  await take('stop');
  await page.evaluate(() => document.dispatchEvent(new MouseEvent('mousemove', { movementX: 220, movementY: 0 })));
  await take('turn');
  await page.keyboard.down('ShiftLeft'); await key('KeyW', 'normal-sprint'); await page.keyboard.up('ShiftLeft');
  await key('KeyC', 'crouch'); await key('Space', 'jump');
  await page.waitForFunction(async () => (await import('/src/entities/player.js')).player.onGround,
    null, { timeout: 30000 });
  await take('landing');
  for (const delta of [600, -1200, 600]) {
    await page.evaluate(delta => document.dispatchEvent(new MouseEvent('mousemove', { movementY: delta })), delta);
    await take('pitch');
  }
  await page.mouse.down({ button: 'right' }); await take('ads');
  await page.mouse.click(640, 480); await take('fire-mechanism');
  await page.mouse.up({ button: 'right' });
  await page.keyboard.press('KeyR'); await take('reload-entry');
  await page.waitForFunction(async () => {
    const { player } = await import('/src/entities/player.js'); return !player.reloading;
  }, null, { timeout: 30000 });
  await take('reload-completed');
  for (const action of ['melee', 'throw']) {
    await page.waitForFunction(async () => {
      const { player } = await import('/src/entities/player.js');
      return !player.punching && !player.throwingNade && !player.reloading;
    }, null, { timeout: 15000 });
    await page.mouse.click(640, 480); await page.keyboard.press('KeyR'); await take('reload-before-' + action);
    if (action === 'melee') await page.keyboard.press('KeyF');
    else await page.mouse.click(640, 480, { button: 'middle' });
    await take('reload-interrupted-' + action);
  }
  const named = label => observations.find(o => o.label === label);
  const coverage = { quality: observations.every(o => o.quality === specification.tier),
    directional: ['forward','reverse','left','right'].every(label => named(label)?.eye),
    stop: !!named('stop'), reversal: !!named('reverse'), turn: !!named('turn'), pitch: observations.filter(o => o.label === 'pitch').length === 3,
    sprint: named('normal-sprint')?.pose?.upper === 'sprint', crouch: !!named('crouch')?.crouching,
    jump: named('jump')?.onGround === false && named('landing')?.onGround === true,
    adsFire: !!named('ads')?.aiming && named('fire-mechanism')?.ammo < named('ads')?.ammo,
    physicalReload: !!named('reload-entry')?.reloading && named('reload-completed')?.reloading === false
      && named('reload-completed')?.ammo > named('reload-entry')?.ammo,
    interruptionBefore: named('reload-before-melee')?.reloading === true
      && named('reload-interrupted-melee')?.reloading === false,
    interruptionAfter: named('reload-completed')?.reloadMs === 0 };
  return { ...specification, kind: 'actual-offline-inputs', clock: 'normal game RAF and capped simulation delta',
    observations, baseReloadSeconds: reloadSeconds[specification.weapon],
    completed: observations.length >= 20 && observations.at(-1).mixerTime > observations[0].mixerTime
      && Object.values(coverage).every(Boolean), coverage,
    deadlineQualification: 'Exact before/at/after lifecycle boundaries require executed current-source assertion evidence; external video input timing alone cannot certify exact deadline equality.' };
}

async function offlineCombatUnion(page, tier) {
  await page.evaluate(() => document.exitPointerLock());
  await page.locator('#pause-mainmenu-btn').click();
  await page.locator('#overlay').waitFor({state:'visible'});
  await page.locator('.map-card[data-map="bunker"]').click();
  await page.locator('#tdm-startbtn').click();
  await badge(page, `Actual offline TDM · ${tier} · Greek Columns daylight/occluder shadow · natural damage/death/respawn`);
  const seen = await page.evaluate(async () => {
    const { player } = await import('/src/entities/player.js');
    const { enemies } = await import('/src/entities/enemies.js');
    const { camera } = await import('/src/scene.js');
    const initialHp = player.hp;
    const record = { damage: null, death: null, respawn: null, teams: [] };
    window.__offlineMovingCombat = () => structuredClone(record);
    window.__offlineMovingObserver = setInterval(() => {
      const sample = { hp: player.hp, dead: player.dead, eye: camera.position.toArray(),
        pose: window.__presentationDebug?.() ?? null, at: performance.now() };
      if (player.hp < initialHp && !record.damage) record.damage = sample;
      if (player.dead) record.death = sample;
      if (record.death && !player.dead) record.respawn = sample;
    }, 20);
    record.teams = enemies.filter(e => e.mesh).map(e => ({ team: e.sndTeam,
      root: e.mesh.position.toArray(), visible: e.mesh.visible }));
    const hostile = enemies.filter(e => e.sndTeam === 'enemy' && e.mesh)
      .sort((a,b) => a.mesh.position.distanceTo(camera.position)-b.mesh.position.distanceTo(camera.position))[0];
    return { hostile: hostile?.mesh.position.toArray(), eye: camera.position.toArray(), yaw: player.yaw };
  });
  try {
    if (seen.hostile) {
      const yaw = Math.atan2(-(seen.hostile[0]-seen.eye[0]), -(seen.hostile[2]-seen.eye[2]));
      let delta = yaw-seen.yaw; while(delta>Math.PI)delta-=2*Math.PI;while(delta< -Math.PI)delta+=2*Math.PI;
      await page.evaluate(async delta => {
        const { MOUSE_SENS } = await import('/src/config.js');
        document.dispatchEvent(new MouseEvent('mousemove',{movementX:-delta/MOUSE_SENS}));
      }, delta);
      await page.keyboard.down('KeyW');
    }
    await page.waitForFunction(() => !!window.__offlineMovingCombat().death, null, { timeout: 60000 });
    await page.keyboard.up('KeyW');
    await page.waitForFunction(() => !!window.__offlineMovingCombat().respawn, null, { timeout: 45000 });
    return { tier, kind: 'actual-offline-TDM-union', complete: true,
      lighting: 'Unchanged authored Greek Columns daylight and occluder shadow policy',
      observations: await page.evaluate(() => window.__offlineMovingCombat()) };
  } finally {
    await page.keyboard.up('KeyW');
    await page.evaluate(() => clearInterval(window.__offlineMovingObserver));
  }
}
async function previewChain(page, tier, view) {
  if (!await page.getByRole('button', { name: 'Open animation review', exact: true }).isVisible())
    await page.keyboard.press('F3');
  await page.getByRole('button', { name: 'Open animation review', exact: true }).click();
  await page.getByLabel('View', { exact: true }).selectOption(view);
  const observations = [];
  for (const scenario of ['supersprint', 'slide', 'dive', 'prone', 'sprint-reload']) {
    const started=Date.now();
    await page.getByLabel('Transition', { exact: true }).selectOption(scenario);
    await page.getByRole('button', { name: 'Play transition', exact: true }).waitFor();
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent === 'Play transition')?.disabled);
    const label = await page.locator('#animation-review-status').textContent();
    assert.ok(label.includes('Preview —') && /Phase 5/.test(label), 'Future preview label is required');
    await badge(page, label);
    await page.getByRole('button', { name: 'Play transition', exact: true }).click();
    await page.locator('#animation-review').evaluate(node => { node.style.visibility = 'hidden'; });
    await page.waitForFunction(() => window.__animationReviewDebug()?.phase >= .95, null, { timeout: 30000 });
    const actor = await page.evaluate(() => window.__animationReviewDebug());
    if (scenario === 'sprint-reload') {
      assert.equal(actor.actor.sample.reloadDurationSeconds, actor.actor.sample.baseReloadSeconds * 1.15);
      assert.equal(actor.actor.sample.upper, 'supersprint');
      assert.equal(actor.actor.sample.oneHandedCarry, true);
    }
    observations.push({ scenario, label, actor });
    console.log(`Moving labeled preview ${tier}/${view}/${scenario}: ${Date.now()-started}ms; phase ${actor.phase}`);
    await page.locator('#animation-review').evaluate(node => { node.style.visibility = ''; });
  }
  await page.getByRole('button', { name: 'Close review', exact: true }).click();
  // Closing deliberately returns the original offline context to Resume.
  // Use its real gesture before opening the next independent preview view.
  if (await page.locator('#pause-resume-btn').isVisible()) await page.locator('#pause-resume-btn').click();
  return { tier, view, weapon: 'm4', kind: 'isolated-labeled-future-preview', observations,
    completed: true, authority: 'Phase5 deferred; isolated review clock only' };
}
async function collectOffline(serverUrl, browser, directory, report) {
  const variants = report.fallbackRecovery?['p90-fallback']:report.tracer||report.viewTracer ? ['m4'] : ['m4', 'p90', 'awp', 'pistol', 'p90-fallback'];
  for (const tier of report.tracer||report.viewTracer||report.fallbackRecovery ? ['low'] : ['low', 'medium', 'high']) for (const variant of variants) {
    const weapon = variant === 'p90-fallback' ? 'p90' : variant;
    const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1,
      recordVideo: { dir: directory, size: { width: 1280, height: 960 } } });
    let page, video;
    const entries = [];
    try {
      await context.addInitScript(tier => {
        localStorage.setItem('vod_graphics_quality_v1', tier);
        // Headless pointer capture adapter exercises the normal existing input handlers.
        // It changes capture eligibility only; no health/ammo/action/authority outcomes.
        let captured = false;
        Object.defineProperty(document, 'pointerLockElement', { get: () => captured ? document.getElementById('c') : null });
        HTMLCanvasElement.prototype.requestPointerLock = () => {
          captured = true; document.dispatchEvent(new Event('pointerlockchange'));
        };
        document.exitPointerLock = () => { captured = false; document.dispatchEvent(new Event('pointerlockchange')); };
      }, tier);
      page = await context.newPage(); video = page.video(); page.setDefaultTimeout(45000);
      if(report.fallbackRecovery){
        page.on('framenavigated',frame=>{if(frame===page.mainFrame())report.lifecycle.push({kind:'navigation',url:frame.url(),wallMs:Date.now()});});
        page.on('pageerror',error=>report.lifecycle.push({kind:'pageerror',message:error.message.slice(0,1000),wallMs:Date.now()}));
        page.on('response',response=>{if(response.url().includes('/models/FBX/P90.fbx'))report.lifecycle.push({kind:'fallback-response',url:response.url(),status:response.status(),wallMs:Date.now()});});
        page.on('console',message=>{if(/vite|reload|outdated|optimized/i.test(message.text()))report.lifecycle.push({kind:'console',text:message.text().slice(0,1000),wallMs:Date.now()});});
      }
      if (variant === 'p90-fallback') await page.route('**/models/FBX/P90.fbx', route => route.fulfill({ status: 404, body: '' }));
      await page.goto(serverUrl);
      await page.waitForFunction(() => !document.getElementById('range-startbtn')?.disabled);
      const asset = await page.evaluate(async () => {
        const { inspectedWeaponFBX } = await import('/src/builders/weaponFBX.js');
        return inspectedWeaponFBX ? 'loaded P90 FBX inspected; articulated procedural fallback used' : 'FBX unavailable; procedural fallback used';
      });
      // Complete the read-only asset import before owning game-frame references.
      // A development document restart before entry cannot strand this observer.
      await page.waitForFunction(() => !document.getElementById('range-startbtn')?.disabled);
      await page.locator('#range-startbtn').click();
      await installObserver(page);
      await page.keyboard.press('Digit' + ({ m4: 1, p90: 2, awp: 3, pistol: 4 }[weapon]));
      if(report.fallbackRecovery)report.lifecycle.push({kind:'observer-owned',wallMs:Date.now(),
        state:await page.evaluate(()=>({timeOrigin:performance.timeOrigin,url:location.href,
          reader:typeof window.__movingRead,history:typeof window.__movingSince,mode:window.__movingRead()?.mode,weapon:window.__movingRead()?.weapon}))});
      if (weapon === 'm4'&&!report.viewTracer) {
        const movement = await blockedWalkUnion(page, tier);
        entries.push(movement); report.offlineMovement.push(movement);
      }
      for (const view of report.tracer ? ['first'] : ['first', 'down', 'third']) {
        await ordinaryLook(page, Math.PI, view === 'down' ? -1.05 : 0);
        if (view === 'third') {
          await page.keyboard.press('KeyV');
        }
        const begin = Date.now();
        const entry = await weaponSegment(page, { tier, weapon, variant, view, asset });
        entry.durationMs = Date.now() - begin;
        const pixels = await page.screenshot({ path: path.join(directory, `${tier}-${variant}-${view}.png`) });
        entry.pixel = { path: relative(path.join(directory, `${tier}-${variant}-${view}.png`)), sha256: hash(pixels) };
        entries.push(entry); report.matrix.push(entry);
        console.log(`Moving weapon segment ${tier}/${variant}/${view}: ${entry.completed ? 'qualified' : 'partial'}; ${entry.observations.length} normal-frame observations; ${entry.durationMs}ms`);
        await fs.writeFile(path.join(directory, 'collection-partial.json'), JSON.stringify(report, null, 2));
      }
      if (weapon === 'm4'&&!report.viewTracer) {
        const shared = await sharedMovementUnion(page,tier);
        entries.push(shared); report.sharedMovement.push(shared);
        console.log(`Moving shared movement ${tier}: ${shared.complete ? 'qualified' : 'partial'}`);
      }
      if (weapon === 'm4'&&!report.viewTracer) for (const view of report.tracer ? ['first'] : ['first', 'down', 'third']) {
        entries.push(await previewChain(page, tier, view)); report.previews.push(entries.at(-1));
      }
    } catch (error) {
      report.collectionErrors.push({ tier, variant, error: error.message });
      console.error(`Moving collection retained partial ${tier}/${variant}: ${error.message}`);
    } finally {
      await context.close();
      if (video) {
        const filename = await video.path(); const bytes = await fs.readFile(filename);
        const media = { path: relative(filename), sha256: hash(bytes), bytes: bytes.length,
          format: 'WebM', viewport: [1280, 960], continuousFullPixels: true };
        report.media.push(media); for (const entry of entries) entry.media = media;
      }
      await fs.writeFile(path.join(directory, 'collection-partial.json'), JSON.stringify(report, null, 2));
    }
  }
}
async function collectCombat(serverUrl,browser,directory,report) {
  for (const tier of report.tracer||report.combatProbe ? ['low'] : ['low','medium','high']) {
    const context=await browser.newContext({viewport:{width:1280,height:960},deviceScaleFactor:1,
      recordVideo:{dir:directory,size:{width:1280,height:960}}});
    let page,video,entry;
    try {
      await context.addInitScript(tier=>{
        localStorage.setItem('vod_graphics_quality_v1',tier);let captured=false;
        Object.defineProperty(document,'pointerLockElement',{get:()=>captured?document.getElementById('c'):null});
        HTMLCanvasElement.prototype.requestPointerLock=()=>{captured=true;document.dispatchEvent(new Event('pointerlockchange'));};
        document.exitPointerLock=()=>{captured=false;document.dispatchEvent(new Event('pointerlockchange'));};
      },tier);
      page=await context.newPage();video=page.video();page.setDefaultTimeout(45000);
      page.on('console',message=>{if(message.text().startsWith('[moving-combat]'))console.log(message.text());});
      await page.goto(serverUrl);
      await page.waitForFunction(()=>!document.getElementById('tdm-startbtn')?.disabled);
      await page.locator('.diff-card[data-diff="recruit"]').click();
      await page.locator('.map-card[data-map="bunker"]').click();
      await page.locator('#tdm-startbtn').click();
      await installObserver(page);await page.keyboard.press('KeyV');
      const combatStarted=Date.now();
      entry={tier,kind:'actual-earned-resource-combat-union',complete:false,stages:[]};report.offlineCombat.push(entry);
      const completed=await earnedCombatUnion(page,tier,async(name,evidence)=>{
        entry.stages.push({name,...evidence});
        console.log(`Moving combat stage ${tier}/${name}: ${Date.now()-combatStarted}ms collection wall`);
        await fs.writeFile(path.join(directory,'collection-partial.json'),JSON.stringify(report,null,2));
      });
      Object.assign(entry,completed);
      console.log(`Moving eligible combat ${tier}: qualified earned grenade/damage/death/respawn`);
      await page.evaluate(()=>document.exitPointerLock());
      await page.locator('#pause-mainmenu-btn').click();
      await page.locator('#overlay').waitFor({state:'visible'});entry.menuReturn=true;
    } catch(error){
      if(entry&&page&&!page.isClosed()){
        entry.lastObservation=await observe(page,'combat-incomplete').catch(()=>null);
        entry.observations=await page.evaluate(()=>window.__movingSince(0)).catch(()=>[]);
      }
      report.collectionErrors.push({stage:'eligible-combat',tier,error:error.message,
        progress:error.combatProgress??[]});
      console.error(`Moving eligible combat ${tier} retained partial: ${error.message}`);
    } finally {
      await context.close();if(video){const filename=await video.path(),bytes=await fs.readFile(filename);
        const media={path:relative(filename),sha256:hash(bytes),bytes:bytes.length,format:'WebM',continuousFullPixels:true};
        report.media.push(media);if(entry)entry.media=media;
      }
      await fs.writeFile(path.join(directory,'collection-partial.json'),JSON.stringify(report,null,2));
    }
  }
}
export async function captureAnimationReview(getIdentities, { tracer = false, combatProbe = false, independentMatrix = false, viewTracer = false, fallbackRecovery = false } = {}) {
  const start = Date.now(), identities = await getIdentities();
  await fs.mkdir(path.join(CACHE, 'moving-review'), { recursive: true });
  const directory = await fs.mkdtemp(path.join(CACHE, 'moving-review', 'capture-'));
  const report = { schemaVersion: 1, complete: false, status: 'partial', capturedAt: new Date().toISOString(),
    identities, device: { hostname: os.hostname(), os: os.type(), release: os.release(), arch: process.arch,
      cpu: os.cpus()[0]?.model, node: process.version },
    approvedMotion: null, matrix: [], previews: [], offlineCombat: [], offlineMovement: [], sharedMovement:[], media: [], collectionErrors: [],
    creatorTracer: { complete: false }, online: { complete: false, observations: [], media: [] },
    humanMotionAcceptance: 'pending', certification: false, tracer, combatProbe, independentMatrix, viewTracer, fallbackRecovery,lifecycle:[],
    limits: 'Continuous actual game input WebM collection; isolated labeled future review uses its own clock. No outcome hooks, no online freeze, no human/device/FPS acceptance. Independent collection cannot qualify plan09.' };
  let server, browser, canceled = false;
  const cancel = () => { canceled = true; void browser?.close(); };
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  // Bound only the owned collection lifetime. Normal capped game clocks and
  // full-pixel video remain unchanged on slow, concurrently occupied hosts.
  const deadline = setTimeout(cancel, 90 * 60 * 1000);
  const cancellationFile=path.join(directory,'cancel.request');
  const cancellationPoll=setInterval(()=>{void fs.access(cancellationFile).then(cancel,()=>{});},1000);
  report.cancellationFile=relative(cancellationFile);
  try {
    report.approvedMotion = await approvedArtMotion();
    const recoveryFile = path.join(ROOT, '.planning/research/.cache/07-motion/recovery.json');
    const recovery = JSON.parse(await fs.readFile(recoveryFile));
    const { compareMotionExports } = await import('./inspect-character.mjs');
    const { parseManifest } = await import('./motion-pipeline.mjs');
    const manifest = parseManifest(await fs.readFile(recovery.restoredManifest, 'utf8'));
    assert.equal(recovery.sourceHash, report.approvedMotion.sourceHash, 'Stale creator donor recovery');
    assert.equal(recovery.manifestHash, report.approvedMotion.manifestHash, 'Stale creator manifest recovery');
    report.creatorTracer = { complete: false, savedReopened: true, recoveryReport: relative(recoveryFile),
      recoveryReportSha256: hash(await fs.readFile(recoveryFile)),
      comparison: await compareMotionExports(recovery.regenerated, report.approvedMotion.publication, manifest),
      meaning: 'Independently reopened editable donor and manifest regenerate accepted current motion; first actual input movie is the game leg.' };
    const port=await ownedFreePort();
    server = await createServer({ root: ROOT, base: '/', cacheDir: path.join(directory, 'vite-cache'),
      server: { host: '127.0.0.1', port, strictPort: true, hmr: false, open: false,
        watch: { ignored: ['**/.planning/**', '**/tools/art/sources/**'] } } });
    await server.listen();
    const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
    report.ownedListener={url,requestedPort:port,actualPort:server.httpServer.address().port};
    report.runningGamePath = 'npm run dev (choose a free owned port), Training Range, enabled Start, F3 → Open animation review; Close review → Resume.';
    browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader'] });
    report.browser = browser.version();
    console.log('Moving collection owned listener/browser ready; normal game input only');
    if(!combatProbe)await collectOffline(url, browser, directory, report);
    if(independentMatrix||viewTracer||fallbackRecovery)report.omittedCoverage={kind:'shared-combat-unions',
      reason:'Bounded current-source tracer retained earned throw and damage but natural death did not occur; independent segments proceed without retrying or qualifying this missing union',
      evidence:relative(path.join(EVIDENCE,'07-motion-review-tracer.json'))};
    else await collectCombat(url,browser,directory,report);
    report.creatorTracer.complete = report.matrix.some(entry => entry.completed && entry.media?.bytes > 0);
    const { collectMovingOnline } = await import('./moving-online.mjs');
    if(!tracer&&!combatProbe&&!viewTracer&&!fallbackRecovery)report.online = await collectMovingOnline(browser, directory);
    report.media.push(...report.online.media);
  } catch (error) { report.collectionErrors.push({ stage: 'creator-or-collection', error: error.message }); }
  finally {
    clearTimeout(deadline);clearInterval(cancellationPoll); process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
    await browser?.close(); await server?.close();
  }
  report.canceled = canceled;
  report.toolingIdentities = Object.fromEntries(await Promise.all(['review.mjs', 'animation-capture.mjs',
    'moving-online.mjs', 'pipeline.mjs', 'verify-export.mjs'].map(async name =>
    [name, hash(await fs.readFile(path.join(ROOT, 'tools/art', name)))])));
  report.protectedBytesUnchanged = JSON.stringify(await getIdentities()) === JSON.stringify(identities);
  try {
    const gatePath = path.join(EVIDENCE, '07-10-stable-gates.json');
    report.stableGates = JSON.parse(await fs.readFile(gatePath, 'utf8'));
    report.stableGateEvidence = { path: relative(gatePath), sha256: hash(await fs.readFile(gatePath)) };
    requireStableGates(identities, report.stableGates);
    for (const check of report.stableGates.checks) {
      const filename = path.resolve(ROOT, check.log);
      await iterationPath([path.join(ROOT, '.planning/research/.cache')], filename);
      assert.equal(hash(await fs.readFile(filename)), check.logSha256);
    }
    report.stableGatesPass = true;
  } catch (error) { report.stableGatesPass = false; report.stableGateBlocker = error.message; }
  // Always execute applicable current-source V2 after independent collection. Never
  // substitute the old budget, recovery success, or a known failed full matrix.
  try { report.actualV2 = await executeV2(directory); }
  catch (error) { report.actualV2 = { passed: false, error: error.message, exitCode: null }; }
  try {
    const summary = await fs.readFile(path.join(EVIDENCE, '../07-09-SUMMARY.md'), 'utf8');
    const qualification = JSON.parse(await fs.readFile(path.join(EVIDENCE, '07-09-qualification.json'), 'utf8'));
    requirePlan09(identities, summary, qualification);
    for (const result of qualification.assertions) {
      const filename = path.resolve(ROOT, result.log);
      await iterationPath([CACHE, path.join(ROOT, '.planning/research/.cache')], filename);
      assert.equal(hash(await fs.readFile(filename)), result.logSha256);
    }
    report.plan09Qualified = true;
  } catch (error) { report.plan09Qualified = false; report.plan09Blocker = error.message; }
  report.matrixComplete = report.matrix.length === 45 && report.matrix.every(e => e.completed)
    && new Set(report.matrix.map(e=>[e.tier,e.variant,e.view].join('/'))).size===45
    && report.matrix.every(e=>e.media?.bytes>0&&e.media.continuousFullPixels&&e.pixel?.sha256)
    && report.previews.length === 9 && report.previews.every(e=>e.completed&&e.media?.bytes>0)
    && report.offlineCombat.length === 3
    && report.offlineMovement.length === 3 && report.offlineMovement.every(e => e.complete)
    && report.sharedMovement.length === 3 && report.sharedMovement.every(e=>e.complete)
    && report.offlineCombat.every(e => e.complete) && report.online.complete;
  report.complete = report.matrixComplete && report.plan09Qualified && report.actualV2.passed
    && report.stableGatesPass && report.protectedBytesUnchanged && report.creatorTracer.complete && !report.collectionErrors.length;
  report.status = report.complete ? 'automated-qualified-human-pending' : 'partial';
  report.independentTracerComplete=tracer&&report.matrix.length===1&&report.matrix[0].completed
    &&report.matrix[0].media?.bytes>0&&report.offlineMovement.length===1&&report.offlineMovement[0].complete
    &&report.sharedMovement.length===1&&report.sharedMovement[0].complete
    &&report.previews.length===1&&report.previews[0].completed&&report.previews[0].media?.bytes>0
    &&report.offlineCombat.length===1&&report.offlineCombat[0].complete
    &&report.offlineCombat[0].media?.bytes>0&&report.protectedBytesUnchanged&&!report.canceled&&!report.collectionErrors.length;
  report.independentCombatProbeComplete=combatProbe&&report.offlineCombat.length===1&&report.offlineCombat[0].complete
    &&report.offlineCombat[0].media?.bytes>0&&report.protectedBytesUnchanged&&!report.canceled&&!report.collectionErrors.length;
  report.independentViewTracerComplete=viewTracer&&report.matrix.length===3&&report.matrix.every(e=>e.completed&&e.media?.bytes>0)
    &&new Set(report.matrix.map(e=>e.view)).size===3&&report.protectedBytesUnchanged&&!report.canceled&&!report.collectionErrors.length;
  report.independentFallbackRecoveryComplete=fallbackRecovery&&report.matrix.length===3
    &&report.matrix.every(e=>e.completed&&e.media?.bytes>0&&e.asset==='FBX unavailable; procedural fallback used')
    &&report.protectedBytesUnchanged&&!report.canceled&&!report.collectionErrors.length;
  report.durationMs = Date.now() - start; report.directory = relative(directory);
  const links = report.media.map(m => {
    const contexts = [...report.matrix, ...report.previews, ...report.offlineCombat, ...report.offlineMovement]
      .filter(entry => entry.media?.path === m.path).map(entry => `${entry.kind}: ${entry.tier}/${entry.weapon ?? 'world'}/${entry.view ?? 'combat'}`);
    const title = contexts.join(' · ') || (report.online.media.some(item=>item.path===m.path)
      ? 'Partial production online M4 observation' : 'Unqualified collector context; see report errors');
    return `<details><summary>${title}</summary><p>SHA256 ${m.sha256}</p><video controls preload="metadata" width="960" style="max-width:100%" src="${path.basename(m.path)}"></video><p><a href="${path.basename(m.path)}">Open full movie</a></p></details>`;
  }).join('\n');
  await fs.writeFile(path.join(directory, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Current moving review — ${report.status}</title><h1>Current moving review: ${report.status}</h1><p>Human verdict pending. Continuous full-pixel WebM; context and Preview — / Phase 5 labels are in each movie. Plan09 and missing coverage remain blocking.</p>${links}<a href="report.json">Exact identities and actual gate outcomes</a>`);
  report.index = relative(path.join(directory, 'index.html'));
  await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await fs.writeFile(path.join(EVIDENCE, fallbackRecovery?'07-motion-review-fallback-recovery.json':viewTracer?'07-motion-review-view-tracer.json':combatProbe?'07-motion-review-combat-probe.json':tracer?'07-motion-review-tracer.json':'07-motion-review.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ report: relative(path.join(EVIDENCE, '07-motion-review.json')), complete: report.complete, index: report.index }));
  if (!report.complete) { const error = Error('Current moving capture remains unqualified; see retained partial report'); error.report = report; throw error; }
  return report;
}
