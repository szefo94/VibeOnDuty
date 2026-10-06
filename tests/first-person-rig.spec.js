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
test.beforeEach(async ({ page }, info) => {
  await page.goto(url); await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 30000 });
  await page.locator(info.title.startsWith('lit:') ? '#startbtn' : '#range-startbtn').click();
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
for (const weapon of ['m4', 'p90', 'awp', 'pistol']) test(`lit: ${weapon} actual visible view contacts, fire and manipulation on every tier`, async ({ page }, info) => {
  test.setTimeout(60000);
  const result = await page.evaluate(async weapon => {
    const src = new URL('src/', location.href).href;
    const g = await import(src + 'builders/enemyGLTF.js');
    const w = await import(src + 'builders/weapon.js');
    const driver = await import(src + 'builders/enemyAnimations.js');
    const fp = await import(src + 'builders/firstPersonRig.js');
    const quality = await import(src + 'graphicsQuality.js');
    const { WEAPONS } = await import(src + 'config.js');
    const { camera, scene, renderer } = await import(src + 'scene.js');
    const { renderComicScene } = await import(src + 'comicOutline.js');
    const { player } = await import(src + 'entities/player.js');
    const T = window.__THREE;
    (await import(src + 'input.js')).setGameRunning(false);
    const rig = g.playerFirstPersonRig, actor = { mesh:g.playerMesh,mixer:g.playerMixer,actions:g.playerActions };
    const original = { eye:camera.position.toArray(), aim:camera.quaternion.toArray(), root:g.playerMesh.position.toArray(), ammo:player.ammo };
    w.show1pWeapon(weapon); w.show3pWeapon(weapon);
    const frames = [], samples = [], ads = [], costs = [];
    const reloadTotal = WEAPONS[weapon].reload / 1000, fireTotal = weapon === 'awp' ? 1.1 : .2;
    let tick = 0;
    const take = (tier, label, raw, capture = false) => {
      w.restorePlayerWeaponHandling();
      const pose = driver.tickPresentation(actor, { identity:'view-four-weapon', weapon,
        position:{ x:original.eye[0],y:original.eye[1],z:original.eye[2] }, sampleTimeSeconds:++tick / 20,
        bodyYaw:player.yaw,aimYaw:player.yaw,pitch:0,onGround:true,alive:true,...raw }, .05);
      w.updatePlayerWeaponHandling(pose, g.playerMesh);
      const begin = performance.now();
      fp.updateFirstPersonRig(rig, { pose,camera,weapon:w.wpn,dt:.02,
        rawCorrections:w.playerWeaponHandling.get(`3p:${weapon}`).corrections,
        spineQuaternion:actor._presentationCorrection?.get(actor.mesh.getObjectByName('spine_03')) });
      costs.push(performance.now() - begin);
      const owner = [...rig.handlers].find(h => h.weapon === weapon);
      const visible = [], palms = [];
      const draw = () => {
        visible.push(rig.arms.visible,rig.body.visible,rig.weapon.visible,g.playerMesh.visible,w.wpn.visible,w.weapon3p.visible);
        scene.updateMatrixWorld(true);
        if (capture) renderComicScene(renderer, scene, camera);
      };
      fp.renderFirstPersonRig(rig, { weapon:w.wpn,worldWeapon:w.weapon3p,firstPerson:true,active:true }, draw);
      for (const side of ['l','r']) {
        const hand = rig.arms.getObjectByName(`hand_${side}`);
        const point = hand.localToWorld(new T.Vector3(0,.085,.012)).project(camera);
        palms.push(point.toArray());
      }
      samples.push({ tier,label,upper:pose.upper,phase:pose.action.phase, contacts:owner.contacts,
        fingers:[...owner.corrections].filter(([bone]) => /middle_02/.test(bone.name)).map(([bone,q]) => q.angleTo(bone.quaternion)),
        magazine:owner.parts.magazine.position.toArray(), charging:owner.parts.charging.position.toArray(),
        visible,palms,forward:new T.Vector3(0,0,-1).applyQuaternion(owner.root.getWorldQuaternion(new T.Quaternion())).dot(camera.getWorldDirection(new T.Vector3())),
        motion:rig.motionSample,phaseSame:rig.pose === pose,
        shadowless:(() => { let yes=true; rig.arms.traverse(n=>{if(n.isMesh && n.castShadow)yes=false;}); rig.weapon.traverse(n=>{if(n.isMesh && n.castShadow)yes=false;});return yes; })(),
        flashMatches:rig.flash.view.position.equals(w.flash.position) && rig.flash.view.scale.equals(w.flash.scale),
        sourceStatus:owner.root.userData.handlingStatus ?? 'articulated original',
        gunCount:rig.weapon.children.filter(n=> /_(1p)$/.test(n.name) && n.visible).length });
      if (capture) frames.push({ name:`${weapon}-${tier}-${label}.png`,data:renderer.domElement.toDataURL('image/png') });
      return rig.motionSample.aim;
    };
    camera.quaternion.setFromEuler(new T.Euler(0,player.yaw,0,'YXZ'));
    for (const tier of ['low','medium','high']) {
      quality.setGraphicsQuality(tier); quality.applyGraphicsQuality(renderer,1);
      take(tier,'ready',{ action:{kind:'ready'} },true);
      for (const phase of [0,.2,.4,.6,.8,1])
        take(tier,`reload-${phase}`,{ action:phase<1 ? {kind:'reload',total:reloadTotal,elapsed:phase*reloadTotal} : {kind:'ready'} },[.4,.8,1].includes(phase));
      const raised = Array.from({length:6},(_,i)=>take(tier,`ads-${i}`,{ aiming:true,action:{kind:'ready'} },i===5));
      const lowered = Array.from({length:6},(_,i)=>take(tier,`lower-${i}`,{ aiming:false,action:{kind:'ready'} }));
      ads.push({tier,raised,lowered});
      w.flashMat.opacity = 1; w.flash.scale.setScalar(1.1);
      take(tier,'fire',{action:{kind:'fire',total:fireTotal,elapsed:fireTotal*.42}},true);
      w.flashMat.opacity = 0;
      take(tier,'reduced-reload',{reducedMotion:true,action:{kind:'reload',total:reloadTotal,elapsed:reloadTotal*.4}},true);
      take(tier,'cancel-melee',{action:{kind:'melee',total:.7,elapsed:.35}});
      take(tier,'recontact',{action:{kind:'ready'}});
    }
    const after = { eye:camera.position.toArray(),aim:camera.quaternion.toArray(),root:g.playerMesh.position.toArray(),ammo:player.ammo };
    const owner = [...rig.handlers].find(h=>h.weapon===weapon);
    return { samples,ads,costs,frames,original,after,sourceEyeSame:JSON.stringify(original.eye)===JSON.stringify(after.eye),
      zeroProps:owner.props.length===0,borrowedSocket: w.flash.position.toArray(),
      meta:{ userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],dpr:renderer.getPixelRatio(), renderer:renderer.getContext().getParameter(renderer.getContext().RENDERER) } };
  }, weapon);
  for (const frame of result.frames) await writeFile(info.outputPath(frame.name),Buffer.from(frame.data.split(',')[1],'base64'));
  delete result.frames; await writeFile(info.outputPath('view-contacts.json'),JSON.stringify(result,null,2));
  const contacts = result.samples.filter(s=>!s.label.startsWith('cancel-'));
  expect(contacts.every(s=>s.contacts && s.contacts.leftError<.025 && s.contacts.rightError<.025)).toBe(true);
  expect(contacts.every(s=>s.fingers.every(angle=>angle<=.81 && angle>.7))).toBe(true);
  expect(contacts.every(s=>s.phaseSame && s.shadowless && s.gunCount===1 && s.flashMatches)).toBe(true);
  expect(contacts.every(s=>s.visible.join(',')==='true,true,true,false,false,false')).toBe(true);
  expect(contacts.filter(s=>s.label==='ready').every(s=>s.forward>.9 && s.palms.every(p=>Math.abs(p[0])<1 && Math.abs(p[1])<1))).toBe(true);
  for (const row of result.ads) {
    expect(row.raised[0]).toBeGreaterThan(0); expect(row.raised.at(-1)).toBe(1);
    expect(row.raised.every((v,i)=>i===0 || v>=row.raised[i-1])).toBe(true);
    expect(row.lowered.at(-1)).toBe(0); expect(row.lowered.every((v,i)=>i===0 || v<=row.lowered[i-1])).toBe(true);
  }
  expect(result.samples.filter(s=>s.label==='ads-5' || s.label==='reduced-reload').every(s=>s.motion.sway.every(n=>n===0))).toBe(true);
  expect(result.sourceEyeSame && result.zeroProps).toBe(true);
  expect(result.after.ammo).toBe(result.original.ammo); expect(result.after.root).toEqual(result.original.root);
  if (weapon==='p90') expect(result.samples.every(s=>s.sourceStatus==='Procedural fallback — detailed weapon handling unavailable')).toBe(true);
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
test('lit: full-pitch standing/crouched body and V handoff retain one anatomy and gun owner', async ({ page }, info) => {
  const result = await page.evaluate(async () => {
    const src=new URL('src/',location.href).href,T=window.__THREE;
    const g=await import(src+'builders/enemyGLTF.js'),w=await import(src+'builders/weapon.js');
    const fp=await import(src+'builders/firstPersonRig.js'),driver=await import(src+'builders/enemyAnimations.js');
    const {camera,scene,renderer}=await import(src+'scene.js');
    const {renderComicScene}=await import(src+'comicOutline.js');
    const {player}=await import(src+'entities/player.js');
    (await import(src+'input.js')).setGameRunning(false);
    const rig=g.playerFirstPersonRig,actor={mesh:g.playerMesh,mixer:g.playerMixer,actions:g.playerActions};
    const eye=camera.position.clone(),aim=camera.quaternion.clone(),sourceRoot=actor.mesh.position.clone();
    const frames=[],samples=[]; let tick=0;
    try {
      for(const crouching of [false,true]) for(const pitch of [-1.38,-.9,0,1.38]) {
        camera.position.copy(eye); if(crouching)camera.position.y-=.8;
        camera.quaternion.setFromEuler(new T.Euler(pitch,player.yaw,0,'YXZ'));
        w.restorePlayerWeaponHandling();
        const pose=driver.tickPresentation(actor,{identity:'pitch-view',weapon:'m4',
          position:{x:eye.x,y:camera.position.y,z:eye.z},sampleTimeSeconds:++tick*.05,
          bodyYaw:player.yaw,aimYaw:player.yaw,pitch,crouching,onGround:true,alive:true,action:{kind:'ready'}},.05);
        w.updatePlayerWeaponHandling(pose,actor.mesh);
        fp.updateFirstPersonRig(rig,{pose,camera,weapon:w.wpn,dt:.05,
          rawCorrections:w.playerWeaponHandling.get('3p:m4').corrections,
          spineQuaternion:actor._presentationCorrection.get(actor.mesh.getObjectByName('spine_03'))});
        const handler=[...rig.handlers].find(h=>h.weapon==='m4');
        for(const firstPerson of [true,false]) {
          const before=[rig.source,rig.arms,rig.body,rig.weapon,w.wpn,w.weapon3p].map(n=>n.visible);
          let during;
          fp.renderFirstPersonRig(rig,{weapon:w.wpn,worldWeapon:w.weapon3p,firstPerson,active:true},()=>{
            during=[rig.source,rig.arms,rig.body,rig.weapon,w.wpn,w.weapon3p].map(n=>n.visible);
            if(firstPerson)renderComicScene(renderer,scene,camera);
          });
          const after=[rig.source,rig.arms,rig.body,rig.weapon,w.wpn,w.weapon3p].map(n=>n.visible);
          samples.push({crouching,pitch,firstPerson,before,after,during,contacts:handler.contacts,
            forward:new T.Vector3(0,0,-1).applyQuaternion(handler.root.getWorldQuaternion(new T.Quaternion())).dot(camera.getWorldDirection(new T.Vector3())),
            eye:camera.position.toArray(),root:actor.mesh.position.toArray(),floor:rig.body.position.y,
            downPoints:['calf_l','calf_r','foot_l','foot_r'].map(name=>{
              const point=rig.body.getObjectByName(name).getWorldPosition(new T.Vector3());
              const source=actor.mesh.getObjectByName(name).getWorldPosition(new T.Vector3());
              return {name,screen:point.clone().project(camera).toArray(),floorDelta:point.y-source.y};
            }),
            scaleSafe:rig.armPairs.every(([bone,copy])=>copy.scale.equals(bone.scale)),
            hiddenFaces:['Eye_l','Eye_r','RaisedFabricCollar','OpenHelmet'].every(name=>!rig.body.getObjectByName(name)?.visible)});
          if(firstPerson)frames.push({name:`${crouching?'crouch':'stand'}-${pitch}.png`,data:renderer.domElement.toDataURL('image/png')});
        }
      }
      return {frames,samples,sourceRoot:sourceRoot.toArray(),bodyMeshes:(()=>{const a=[];rig.body.traverse(n=>{if(n.isSkinnedMesh&&n.visible)a.push(n.name)});return a;})()};
    } finally {camera.position.copy(eye);camera.quaternion.copy(aim);}
  });
  for(const frame of result.frames)await writeFile(info.outputPath(frame.name),Buffer.from(frame.data.split(',')[1],'base64'));
  delete result.frames;await writeFile(info.outputPath('pitch.json'),JSON.stringify(result,null,2));
  expect(result.samples.every(s=>s.before.join(',')===s.after.join(',')&&s.scaleSafe&&s.hiddenFaces)).toBe(true);
  expect(result.samples.every(s=>s.contacts.leftError<.025&&s.contacts.rightError<.025&&s.forward>.9)).toBe(true);
  expect(result.samples.every(s=>s.root.join(',')===result.sourceRoot.join(',')&&s.floor===result.sourceRoot[1])).toBe(true);
  expect(result.samples.every(s=>s.during.join(',')===(s.firstPerson?'false,true,true,true,false,false':'true,false,false,false,false,true'))).toBe(true);
  expect(['ChestPlate','LowerChestPlate','KneeGuard_l','KneeGuard_r','BootToe_l','BootToe_r'].every(name=>result.bodyMeshes.includes(name))).toBe(true);
  expect(result.samples.filter(s=>s.firstPerson&&s.pitch===-1.38).every(s=>s.downPoints.every(p=>
    Math.abs(p.screen[0])<1&&Math.abs(p.screen[1])<1&&Math.abs(p.floorDelta)<1e-6))).toBe(true);
});
for(const missing of [false,true])test(`p90 view: ${missing?'missing':'inspected'} FBX selects truthful articulated fallback`,async({page})=>{
  if(missing){await page.route('**/models/FBX/P90.fbx',route=>route.fulfill({status:404,body:''}));await page.goto(url);await expect(page.locator('#range-startbtn')).toBeEnabled();await page.locator('#range-startbtn').click();}
  const result=await page.evaluate(async()=>{
    const src=new URL('src/',location.href).href,g=await import(src+'builders/enemyGLTF.js'),f=await import(src+'builders/weaponFBX.js');
    return {status:g.playerFirstPersonRig.weapon.getObjectByName('p90_1p').userData.handlingStatus,
      inspected:!!f.inspectedWeaponFBX,magazine:!!g.playerFirstPersonRig.weapon.getObjectByName('p90_magazine')};
  });
  expect(result.status).toBe('Procedural fallback — detailed weapon handling unavailable');
  expect(result.magazine).toBe(true);expect(result.inspected).toBe(!missing);
});
test('lifecycle: view-owned resources retire twice while borrowed gun, keeper and new clone survive',async({page})=>{
  const result=await page.evaluate(async()=>{
    const src=new URL('src/',location.href).href,g=await import(src+'builders/enemyGLTF.js'),w=await import(src+'builders/weapon.js');
    const fp=await import(src+'builders/firstPersonRig.js'),driver=await import(src+'builders/enemyAnimations.js');
    const {camera}=await import(src+'scene.js');
    const {disposeCharacter}=await import(src+'builders/characterResources.js');
    const {updateWeaponHandling}=await import(src+'builders/weaponHandling.js');
    (await import(src+'input.js')).setGameRunning(false);
    const keeper=g.buildEnemyMesh(10,10),source=g.buildEnemyMesh(15,15);
    const view=fp.createFirstPersonRig({source:source.mesh});
    const pose=driver.tickPresentation(source,{identity:'retire-view',weapon:'m4',position:{x:15,y:1.65,z:15},sampleTimeSeconds:0,
      bodyYaw:0,aimYaw:0,onGround:true,alive:true,action:{kind:'reload',total:1.8,elapsed:.72}},.05);
    const sourceOwner=w.playerWeaponHandling.get('1p:m4');updateWeaponHandling(sourceOwner,pose);
    const borrowedGeometry=new Set(),maps=new Set(),ownedGeometry=new Set();let borrowedDisposals=0,ownedDisposals=0;
    w.wpn.traverse(n=>{if(n.geometry)borrowedGeometry.add(n.geometry);for(const m of(Array.isArray(n.material)?n.material:[n.material]))if(m?.map)maps.add(m.map);});
    keeper.mesh.traverse(n=>{if(n.isSkinnedMesh)borrowedGeometry.add(n.geometry);for(const m of(Array.isArray(n.material)?n.material:[n.material]))if(m?.map)maps.add(m.map);});
    fp.updateFirstPersonRig(view,{pose,camera,weapon:w.wpn});
    const posedRestSafe=[...view.handlers].find(o=>o.weapon==='m4').parts.magazine.position.equals(sourceOwner.parts.magazine.position);
    for(const root of[view.arms,view.body,view.weapon])root.traverse(n=>{if(n.geometry)ownedGeometry.add(n.geometry);});
    for(const geo of borrowedGeometry)geo.addEventListener('dispose',()=>borrowedDisposals++);
    for(const map of maps)map.addEventListener('dispose',()=>borrowedDisposals++);
    for(const geo of ownedGeometry)geo.addEventListener('dispose',()=>ownedDisposals++);
    const owners=[...view.handlers];fp.disposeFirstPersonRig(view);fp.disposeFirstPersonRig(view);
    const newView=fp.createFirstPersonRig({source:keeper.mesh});fp.updateFirstPersonRig(newView,{pose:{...pose,upper:'ready',action:{kind:'ready'},weapon:'m4'},camera,weapon:w.wpn});
    const newOwner=[...newView.handlers].find(o=>o.weapon==='m4');
    const answer={posedRestSafe,borrowedDisposals,ownedDisposals,ownedCount:ownedGeometry.size,retired:view.disposed&&owners.every(o=>o.disposed&&o.corrections.size===0),
      sourceChildren:source.mesh.children.length,borrowedParent:!!w.wpn.parent,keeperFinite:keeper.mesh.getObjectByName('hand_l').quaternion.toArray().every(Number.isFinite),
      newViewFinite:newOwner.contacts?.leftError<.025&&newOwner.contacts?.rightError<.025,newProps:newOwner.props.length};
    fp.disposeFirstPersonRig(newView);disposeCharacter(source.mesh,source.mixer);disposeCharacter(keeper.mesh,keeper.mixer);
    return answer;
  });
  expect(result.borrowedDisposals).toBe(0);expect(result.ownedDisposals).toBe(result.ownedCount);
  expect(result.posedRestSafe&&result.retired&&result.borrowedParent&&result.keeperFinite&&result.newViewFinite).toBe(true);expect(result.newProps).toBe(0);
});
test('runtime: normal reload, action interruption, life replacement and menu clear current view',async({page},info)=>{
  const initial=await page.evaluate(async()=>{
    const src=new URL('src/',location.href).href,p=await import(src+'entities/player.js');
    const {tryShoot}=await import(src+'combat/shoot.js');
    const before=p.player.ammo;tryShoot();p.startReload();return {before,after:p.player.ammo,total:p.player.reloadTotal};
  });
  expect(initial.after).toBe(initial.before-1);expect(initial.total).toBe(1800);
  await page.waitForFunction(()=>window.__presentationDebug()?.upper==='reload'&&window.__presentationDebug()?.action.phase>.1);
  const interruption=await page.evaluate(async()=>{
    const src=new URL('src/',location.href).href,p=await import(src+'entities/player.js');
    p.beginPlayerAction('throw',.9,[]);return {reload:p.player.reloading,aim:p.player.aiming,ammo:p.player.ammo};
  });
  expect(interruption.reload||interruption.aim).toBe(false);
  await page.waitForFunction(()=>window.__presentationDebug()?.upper==='throw');
  const throwing=await page.evaluate(async()=>{
    const g=await import(new URL('src/builders/enemyGLTF.js',location.href).href);
    return {hiddenGun:!g.playerFirstPersonRig.weapon.visible,pose:g.playerFirstPersonRig.pose.upper,
      props:[...g.playerFirstPersonRig.handlers].reduce((n,h)=>n+h.props.length,0)};
  });
  expect(throwing.hiddenGun).toBe(true);expect(throwing.props).toBe(0);
  await page.evaluate(async()=>{const p=await import(new URL('src/entities/player.js',location.href).href);p.cancelPlayerActions('fixture-replacement');p.beginPlayerAction('melee',.7,[]);});
  await page.waitForFunction(()=>window.__presentationDebug()?.upper==='melee');
  await page.evaluate(async()=>{const p=await import(new URL('src/entities/player.js',location.href).href);p.player.dead=true;p.cancelPlayerActions('death');});
  await page.waitForFunction(async()=>{const g=await import(new URL('src/builders/enemyGLTF.js',location.href).href);return g.playerFirstPersonRig.pose?.alive===false&&!g.playerFirstPersonRig.arms.visible;});
  await page.evaluate(async()=>{const p=await import(new URL('src/entities/player.js',location.href).href);p.player.dead=false;p.cancelPlayerActions('respawn');});
  await page.waitForFunction(()=>window.__presentationDebug()?.alive===true&&window.__presentationDebug()?.upper==='ready');
  await page.evaluate(()=>{document.getElementById('pause-mainmenu-btn').click();});
  await expect(page.locator('#overlay')).toBeVisible();
  const retired=await page.evaluate(async()=>{
    const src=new URL('src/',location.href).href,g=await import(src+'builders/enemyGLTF.js'),p=await import(src+'entities/player.js');
    return {pose:g.playerFirstPersonRig.pose,arms:g.playerFirstPersonRig.arms.visible,body:g.playerFirstPersonRig.body.visible,gun:g.playerFirstPersonRig.weapon.visible,
      props:[...g.playerFirstPersonRig.handlers].reduce((n,h)=>n+h.props.length,0),reload:p.player.reloading};
  });
  await writeFile(info.outputPath('runtime.json'),JSON.stringify({initial,interruption,throwing,retired},null,2));
  expect(retired.pose).toBeNull();expect(retired.arms||retired.body||retired.gun||retired.reload).toBe(false);expect(retired.props).toBe(0);
});
