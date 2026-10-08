import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createServer as portProbe } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';

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

test('local: held movement blocked by terrain plants the real loaded feet', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.keyboard.down('KeyW');
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const { player } = await import(src + 'entities/player.js');
    const input = await import(src + 'input.js');
    const { camera } = await import(src + 'scene.js');
    const { playerMesh } = await import(src + 'builders/enemyGLTF.js');
    const { MAP, groundElevation } = await import(src + 'map.js');
    input.setLocked(false);
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const movementContribution = layers => layers.filter(layer => layer.scheduled &&
      /(?:walk|run|crouch)_(?:forward|back|left|right)_lower$/.test(layer.clip))
      .reduce((sum, layer) => sum + layer.weight, 0);
    const observe = () => {
      const pose = window.__presentationDebug();
      return { speed: pose.speed, cadence: pose.cadence, phase: pose.phase,
        moving: pose.moving, transition: pose.transition, layers: pose.layers,
        travellingWeight: movementContribution(pose.layers),
        feet: ['foot_l', 'foot_r'].map(name => playerMesh.getObjectByName(name).quaternion.toArray()) };
    };
    const sample = async count => {
      const observations = [];
      for (let i = 0; i < count; i++) { await frame(); observations.push(observe()); }
      return observations;
    };
    // Positive control uses the same actual contributing-mask measurement on a
    // walkable corridor. A permanently zero source-alias query cannot pass it.
    let open;
    for (let r = 1; r < MAP.length - 1 && !open; r++)
      for (let c = 1; c < MAP[r].length - 1; c++)
        if (MAP[r][c] === 0 && MAP[r - 1][c] === 0 && MAP[r + 1][c] === 0) { open = [c, r]; break; }
    if (!open) throw Error('No actual walkable positive-control corridor');
    camera.position.set(open[0] * 4 + 2, 0, open[1] * 4 + 2);
    camera.position.y = groundElevation(camera.position.x, camera.position.z) + 1.65;
    player.yaw = 0; player.onGround = true; player.velY = 0;
    input.setGameRunning(true);
    const movingStart = camera.position.clone();
    await sample(4);
    const moving = await sample(8), movingDisplacement = camera.position.distanceTo(movingStart);
    // Place within a solid cell: actual canMoveTo rejects the held W intention.
    const r = MAP.findIndex(row => row.some(v => v === 1));
    const c = MAP[r].findIndex(v => v === 1);
    camera.position.set(c * 4 + 2, 1.65, r * 4 + 2);
    player.yaw = 0; player.onGround = true;
    const start = camera.position.clone();
    // Let the brief stop action and bone inertia settle before measuring feet.
    await sample(20);
    const blocked = await sample(8);
    const maxFootChange = observations => Math.max(...observations.flatMap(observation =>
      observation.feet.flatMap((q, foot) => q.map((value, axis) =>
        Math.abs(value - observations[0].feet[foot][axis])))));
    const held = input.keys.KeyW === true;
    input.setGameRunning(false);
    return { skinned: !!playerMesh, held, displacement: camera.position.distanceTo(start),
      movingDisplacement, moving, blocked,
      movingFootChange: maxFootChange(moving), blockedFootChange: maxFootChange(blocked) };
  });
  await page.keyboard.up('KeyW');
  expect(result.skinned).toBe(true);
  expect(result.held).toBe(true);
  expect(result.movingDisplacement).toBeGreaterThan(0.1);
  expect(result.moving.every(pose => pose.moving && pose.speed > .05 && pose.cadence > 0
    && pose.travellingWeight > .5)).toBe(true);
  expect(result.movingFootChange).toBeGreaterThan(.001);
  expect(result.displacement).toBeLessThan(0.01);
  for (const pose of result.blocked) {
    expect(pose.travellingWeight).toBeLessThan(.01);
    expect(pose.speed).toBeLessThan(.001); expect(pose.cadence).toBe(0);
    expect(pose.moving).toBe(false); expect(pose.transition).toBe('');
    expect(pose.phase).toBe(result.blocked[0].phase);
  }
  expect(result.blockedFootChange).toBeLessThan(.001);
  expect(errors).toEqual([]);
  await info.attach('actual-moving-and-blocked-presentation', {
    body: Buffer.from(JSON.stringify(result)), contentType: 'application/json' });
});

test('local: loaded directional masks and current action phase preserve gameplay roots', async ({ page }, info) => {
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const rig = await import(src + 'builders/enemyGLTF.js');
    const input = await import(src + 'input.js');
    const { player } = await import(src + 'entities/player.js');
    const { camera, renderer } = await import(src + 'scene.js');
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
    const frames=[],costs=[];
    for(let i=0;i<12;i++) {
      const start=performance.now();
      tickPresentation(actor,{...r,sampleTimeSeconds:.45+i*.05,bodyYaw:1,aimYaw:1},.05);
      costs.push(performance.now()-start);
      frames.push(actor.mesh.getObjectByName('foot_r').quaternion.toArray());
    }
    costs.sort((a,b)=>a-b);
    return { gait:p.gait, phase:p.action.phase, hand, jump:jumped.jump, land:land.jump,
      measurement:{samples:costs.length,driverMedianMs:costs[6],driverP95Ms:costs[11],
        browser:navigator.userAgent,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,
        renderer:renderer.getContext().getParameter(renderer.getContext().RENDERER),
        actors:1,scope:'short direct-driver correctness sample; not matched warmed baseline or FPS'},
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
  await info.attach('presentation-driver-observation', {body:Buffer.from(JSON.stringify(result.measurement)),contentType:'application/json'});
  await writeFile(new URL('../.planning/research/.cache/07-05-driver-observation.json',import.meta.url),
    JSON.stringify({capturedAt:new Date().toISOString(),...result.measurement},null,2)+'\n');
});

test('bot: actual displacement, muzzle observations and replaced rigs share the planted policy', async ({ page }) => {
  const result=await page.evaluate(async()=>{
    const src=new URL('src/',location.href).href;
    const g=await import(src+'builders/enemyGLTF.js');
    const { tickEnemyAnimation }=await import(src+'builders/enemyAnimations.js');
    const { player }=await import(src+'entities/player.js');
    const { camera }=await import(src+'scene.js');
    (await import(src+'input.js')).setGameRunning(false);
    const eye=camera.position.toArray(),aim=[player.yaw,player.pitch];
    const e={...g.buildEnemyMesh(10,10),x:10,z:10,facingY:0,onGround:true,
      hp:100,dead:false,state:'patrol',muzzleFlashT:0,stunTimer:0,weaponRole:'assault'};
    tickEnemyAnimation(e,.05);tickEnemyAnimation(e,.05);
    const stationary=e.presentation.speed;
    e.x+=.15;e.z+=.15;tickEnemyAnimation(e,.05);
    const gait=e.presentation.gait;
    e.x+=.15;e.z+=.15;e.muzzleFlashT=55;tickEnemyAnimation(e,.05);
    const firing={gait:e.presentation.gait,upper:e.presentation.upper,speed:e.presentation.speed};
    e.hp=80;e.stunTimer=.3;tickEnemyAnimation(e,.05);
    const damage=e.presentation.damage;tickEnemyAnimation(e,.05);const repeat=e.presentation.damage;
    const old=e.mesh;g.disposeEnemyMesh(e.mesh,e.mixer);
    Object.assign(e,g.buildEnemyMesh(10,10));
    tickEnemyAnimation(e,.05);
    const replaced={speed:e.presentation.speed,death:e.presentation.deathVariant,
      bones:e._bones.every(b=>b.parent&&b!==old.getObjectByName(b.name))};
    g.disposeEnemyMesh(e.mesh,e.mixer);
    return {stationary,gait,firing,damage,repeat,replaced,
      eyeSame:JSON.stringify(eye)===JSON.stringify(camera.position.toArray()),
      aimSame:aim[0]===player.yaw&&aim[1]===player.pitch};
  });
  expect(result.stationary).toBe(0);
  expect(result.gait.map(g=>g.key)).toEqual(['walk_back','walk_right']);
  expect(result.firing.upper).toBe('fire');expect(result.firing.speed).toBeGreaterThan(4);
  expect(result.damage).toBe(true);expect(result.repeat).toBe(false);
  expect(result.replaced).toEqual({speed:0,death:null,bones:true});
  expect(result.eyeSame&&result.aimSame).toBe(true);
});

test('bot: controlled deaths stop all action layers, hold at 0.65s and leave eligibility immediate', async ({ page }) => {
  const result=await page.evaluate(async()=>{
    const src=new URL('src/',location.href).href;
    const g=await import(src+'builders/enemyGLTF.js');
    const { tickPresentation, tickEnemyAnimation }=await import(src+'builders/enemyAnimations.js');
    const { killEnemy }=await import(src+'entities/enemies.js');
    (await import(src+'input.js')).setGameRunning(false);
    const variants=[];
    for(const [x,z,name] of [[0,-1,'front'],[0,1,'back'],[-1,0,'left'],[1,0,'right']]){
      const e=g.buildEnemyMesh(10,10);
      const raw={identity:name,position:{x:10,y:0,z:10},sampleTimeSeconds:0,bodyYaw:0,onGround:true};
      tickPresentation(e,raw,.05);let p=tickPresentation(e,{...raw,alive:false,trustedImpact:{x,z}},.05);
      for(let i=0;i<14;i++)p=tickPresentation(e,{...raw,sampleTimeSeconds:.1+i*.05,alive:false},.05);
      const before=e.mesh.getObjectByName('pelvis').quaternion.toArray();
      for(let i=0;i<8;i++)tickPresentation(e,{...raw,sampleTimeSeconds:.85+i*.05,alive:false},.05);
      variants.push({name,variant:p.deathVariant,settled:p.settled,
        stable:JSON.stringify(before)===JSON.stringify(e.mesh.getObjectByName('pelvis').quaternion.toArray())});
      g.disposeEnemyMesh(e.mesh,e.mixer);
    }
    const e={...g.buildEnemyMesh(10,10),x:10,z:10,facingY:.8,dead:false,onGround:true,
      state:'patrol',hp:100,muzzleFlashT:0,stunTimer:0,sndTeam:'friend'};
    tickEnemyAnimation(e,.05);e.x+=.15;tickEnemyAnimation(e,.05);killEnemy(e);
    const dead=e.dead;e.mixer.update(.66);
    const held=e.mesh.getObjectByName('pelvis').quaternion.toArray();e.mixer.update(.8);
    const stable=JSON.stringify(held)===JSON.stringify(e.mesh.getObjectByName('pelvis').quaternion.toArray());
    return {variants,dead,stable,breathing:e.actions._breathing.isScheduled()};
  });
  for(const p of result.variants)expect(p).toEqual({name:p.name,variant:p.name,settled:true,stable:true});
  expect(result.dead&&result.stable).toBe(true);expect(result.breathing).toBe(false);
});
