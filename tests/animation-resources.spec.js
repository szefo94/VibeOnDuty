import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { compareAnimationCandidate } from '../tools/art/review.mjs';
import { parseGLB } from '../tools/art/inspect-character.mjs';

test('resources: fixed budget comparison rejects wrong properties and incomparable or overrun candidates', async () => {
  const folder='.planning/phases/07-movement-matched-and-action-safe-animation/evidence/';
  const baseline=JSON.parse(await readFile(folder+'07-baseline.json','utf8'));
  const budget=JSON.parse(await readFile(folder+'07-budget.json','utf8'));
  const report={...baseline,baselineSha256:budget.baselineSha256};
  expect(compareAnimationCandidate(report,budget).budgetPass).toBe(true);
  const over=structuredClone(report);over.samples[0].timings.correctionMs.median=100;
  expect(compareAnimationCandidate(over,budget).budgetPass).toBe(false);
  const resource=structuredClone(report);for(const sample of resource.samples[0].resourceSamples)sample.geometries+=1;
  expect(compareAnimationCandidate(resource,budget).resourceChanges).toHaveLength(1);
  const wrong=structuredClone(budget);delete wrong.profiles[0].timings.frameIntervalMs.medianUpperMs;
  expect(()=>compareAnimationCandidate(report,wrong)).toThrow();
  const small=structuredClone(report);small.samples[0].viewport=[800,600];
  expect(()=>compareAnimationCandidate(small,budget)).toThrow('Unmatched viewport');
  const incomplete=structuredClone(report);incomplete.samples.pop();
  expect(()=>compareAnimationCandidate(incomplete,budget)).toThrow('Truncated');
  const unknown=structuredClone(report);for(const sample of unknown.samples)sample.renderScope='invented';
  expect(()=>compareAnimationCandidate(unknown,budget)).toThrow('Unknown candidate');
});

for (const tier of ['low','medium','high']) test(`resources: ${tier} zero, one and eight real actors/views retire once with a keeper and exact shared buffers`,async({page})=>{
  test.setTimeout(180000);
  await page.goto('/');await expect(page.locator('#range-startbtn')).toBeEnabled({timeout:60000});await page.locator('#range-startbtn').click();
  const result=await page.evaluate(async tier=>{
    const src=new URL('src/',location.href).href;
    const g=await import(src+'builders/enemyGLTF.js'),f=await import(src+'builders/firstPersonRig.js');
    const a=await import(src+'builders/enemyAnimations.js'),r=await import(src+'builders/characterResources.js');
    const {scene,camera,renderer}=await import(src+'scene.js'),q=await import(src+'graphicsQuality.js');
    const {renderComicScene}=await import(src+'comicOutline.js');
    const input=await import(src+'input.js');input.setGameRunning(false);q.setGraphicsQuality(tier);
    const keeper=g.buildEnemyMesh(camera.position.x,camera.position.z-3);scene.add(keeper.mesh);
    const templates=new Set(),maps=new Set();keeper.mesh.traverse(n=>{if(n.isSkinnedMesh)templates.add(n.geometry);
      for(const m of Array.isArray(n.material)?n.material:[n.material])for(const t of [m?.map,m?.normalMap])if(t)maps.add(t);});
    const sourceBuffers=[...templates].map(geometry=>Object.values(geometry.attributes).map(attribute=>Array.from(attribute.array)));
    let sharedEvents=0;const listeners=[];
    for(const resource of [...templates,...maps]){const listener=()=>++sharedEvents;resource.addEventListener('dispose',listener);listeners.push([resource,listener]);}
    const outcomes=[],plateaus=[];
    for(let cycle=0;cycle<8;cycle++){
      const actors=Array.from({length:cycle%2?8:1},(_,i)=>g.buildEnemyMesh(camera.position.x+(i%4)*.3,camera.position.z-3));
      const view=f.createFirstPersonRig({source:actors[0].mesh});scene.add(view.arms,view.body);
      const owned=new Set(),events=new Map();
      for(const root of [...actors.map(actor=>actor.mesh),view.arms,view.body])root.traverse(n=>{
        if(n.geometry&&!templates.has(n.geometry))owned.add(n.geometry);
        for(const m of Array.isArray(n.material)?n.material:[n.material])if(m?.userData.characterOwned||m?.userData._tinted)owned.add(m);
      });
      for(const actor of actors){scene.add(actor.mesh);a.tickPresentation(actor,{identity:actor.mesh.uuid,generation:'test',position:{x:0,y:1.65,z:0},sampleTimeSeconds:0,bodyYaw:0,aimYaw:0,weapon:'m4',onGround:true,alive:true,action:{kind:'reload',total:1.8,remaining:.9}},.05);}
      f.updateFirstPersonRig(view,{pose:actors[0].presentation,camera,active:true});
      renderComicScene(renderer,scene,camera);renderer.getContext().finish();
      for(const root of [...actors.map(actor=>actor.mesh),view.arms,view.body])root.traverse(n=>{if(n.skeleton?.boneTexture)owned.add(n.skeleton.boneTexture);});
      for(const resource of owned){events.set(resource,0);resource.addEventListener('dispose',()=>events.set(resource,events.get(resource)+1));}
      const exactBones=actors[0]._bones.map(b=>b.name).sort();
      const triangles=root=>{let count=0;root.traverse(n=>{count+=n.geometry?.userData.selectedTriangles??0;});return count;};
      const essential={armTriangles:triangles(view.arms),bodyTriangles:triangles(view.body)};
      const sourceCallbacks=r.inspectCharacterResources(actors[0].mesh).callbacks;
      f.disposeFirstPersonRig(view);f.disposeFirstPersonRig(view);
      const afterView=r.inspectCharacterResources(actors[0].mesh).callbacks;
      for(const actor of actors){r.disposeCharacter(actor.mesh,actor.mixer);r.disposeCharacter(actor.mesh,actor.mixer);}
      renderComicScene(renderer,scene,camera);renderer.getContext().finish();
      plateaus.push({...renderer.info.memory,programs:renderer.info.programs.length});
      outcomes.push({exactBones,once:[...events.values()].every(n=>n===1),bindings:actors.map(actor=>actor.mixer.stats.bindings.inUse),
        caches:actors.every(actor=>!actor.presentation&&actor._presentationMasks.size===0&&actor._bones.length===0),
        sourceReleased:afterView===sourceCallbacks-1, callbacks:actors.map(actor=>r.inspectCharacterResources(actor.mesh).callbacks),
        essential});
    }
    const next=g.buildEnemyMesh(1,1);scene.add(next.mesh);renderComicScene(renderer,scene,camera);
    const surviving=keeper.mesh.getObjectByProperty('isSkinnedMesh',true).geometry.attributes.position.count>0&&!!next.mesh.getObjectByName('HumanBody');
    const intact=JSON.stringify([...templates].map(geometry=>Object.values(geometry.attributes).map(attribute=>Array.from(attribute.array))))===JSON.stringify(sourceBuffers);
    r.disposeCharacter(next.mesh,next.mixer);r.disposeCharacter(keeper.mesh,keeper.mixer);
    for(const [resource,listener]of listeners)resource.removeEventListener('dispose',listener);
    return{outcomes,plateaus,sharedEvents,surviving,intact,mapCount:maps.size};
  },tier);
  const {json}=parseGLB(await readFile('public/models/enemy.glb'));
  const joints=json.skins[0].joints.map(index=>json.nodes[index].name).sort();
  const manifest=JSON.parse(await readFile('tools/art/motion-manifest.json','utf8'));
  expect(json.animations).toHaveLength(107);
  for(const action of manifest.actions)expect(json.animations.some(clip=>clip.name===action.clip)).toBe(true);
  for(const resultRow of result.outcomes){expect(resultRow.exactBones).toHaveLength(65);expect(resultRow.exactBones).toEqual(joints);
    expect(resultRow.once).toBe(true);expect(resultRow.caches).toBe(true);expect(resultRow.sourceReleased).toBe(true);
    expect(resultRow.essential.armTriangles).toBeGreaterThan(0);expect(resultRow.essential.bodyTriangles).toBeGreaterThan(0);
    expect(resultRow.bindings.every(n=>n===0)).toBe(true);expect(resultRow.callbacks.every(n=>n===0)).toBe(true);}
  expect(result.sharedEvents).toBe(0);expect(result.surviving).toBe(true);expect(result.intact).toBe(true);expect(result.mapCount).toBeGreaterThan(0);
  for(const plateau of result.plateaus.slice(4))expect(plateau).toEqual(result.plateaus[3]);
});

test('resources: a failed owner callback still retires every real clone resource once', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 60000 });
  await page.locator('#range-startbtn').click();
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const g = await import(src + 'builders/enemyGLTF.js');
    const r = await import(src + 'builders/characterResources.js');
    const { scene } = await import(src + 'scene.js');
    const actor = g.buildEnemyMesh(2, 2); scene.add(actor.mesh);
    let later = 0, failures = 0;
    r.registerCharacterDisposer(actor.mesh, () => { throw Error('retired owner failed'); });
    r.registerCharacterDisposer(actor.mesh, () => { ++later; });
    for (let i = 0; i < 2; i++) {
      try { r.disposeCharacter(actor.mesh, actor.mixer); } catch { ++failures; }
    }
    const next = g.buildEnemyMesh(3, 2);
    const usable = !!next.mesh.getObjectByName('HumanBody');
    r.disposeCharacter(next.mesh, next.mixer);
    return { later, failures, attached: !!actor.mesh.parent, active: actor.mixer.stats.bindings.inUse, usable };
  });
  expect(result).toEqual({ later: 1, failures: 1, attached: false, active: 0, usable: true });
});

test('resources: retiring a real first-person weapon view preserves its live source material', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#range-startbtn')).toBeEnabled({timeout:60000});
  await page.locator('#range-startbtn').click();
  const result=await page.evaluate(async()=>{
    const src=new URL('src/',location.href).href;
    const g=await import(src+'builders/enemyGLTF.js'),f=await import(src+'builders/firstPersonRig.js');
    const r=await import(src+'builders/characterResources.js');
    const {camera,scene}=await import(src+'scene.js'),{wpn}=await import(src+'builders/weapon.js');
    const keeper=g.buildEnemyMesh(1,1);const rig=f.createFirstPersonRig({source:keeper.mesh});
    const gun=f.cloneVisualHierarchy(wpn);let sourceDisposals=0;
    gun.traverse(node=>{if(node.isMesh)node.geometry=node.geometry.clone();});
    const material=gun.getObjectByName('m4_1p').getObjectByProperty('isMesh',true).material.clone();
    material.userData.characterOwned=true;
    gun.getObjectByName('m4_1p').getObjectByProperty('isMesh',true).material=material;
    material.addEventListener('dispose',()=>++sourceDisposals);
    scene.add(keeper.mesh,rig.arms,rig.body);
    f.updateFirstPersonRig(rig,{pose:{identity:'keeper',weapon:'m4',alive:true,upper:'ready',action:{phase:0}},camera,weapon:gun});
    f.disposeFirstPersonRig(rig);f.disposeFirstPersonRig(rig);
    const before=sourceDisposals;
    r.disposeCharacter(gun);r.disposeCharacter(keeper.mesh,keeper.mixer);
    return{before,after:sourceDisposals};
  });
  expect(result).toEqual({before:0,after:1});
});

test('resources: stale real review loads, selection, retry and close retire actors without restoring old state',async({page})=>{
  test.setTimeout(120000);await page.goto('/');await expect(page.locator('#range-startbtn')).toBeEnabled({timeout:60000});await page.locator('#range-startbtn').click();
  const result=await page.evaluate(async()=>{
    const src=new URL('src/',location.href).href;
    const review=await import(src+'dev/animationReview.js'),{scene,camera,renderer}=await import(src+'scene.js');
    const {wpn,weapon3p:wpn3p}=await import(src+'builders/weapon.js'),{playerMesh}=await import(src+'builders/enemyGLTF.js');
    const input=await import(src+'input.js');input.setGameRunning(false);
    let release,created=0,disposed=0,restore=0,delay=true;
    const pending=new Promise(resolve=>{release=resolve;});
    const owner=review.createAnimationReviewOwner({restore(){restore++;},async createActor(selection){
      if(delay){delay=false;await pending;}
      const resource=await review.createActualReviewActor(selection,{scene,renderer,origin:camera.position.clone(),weapon:wpn,worldWeapon:wpn3p,liveBody:playerMesh});
      created++;const retire=resource.dispose;let retired=false;
      resource.dispose=()=>{if(!retired){retired=true;disposed++;}retire();};return resource;
    }});
    const first=owner.open();await owner.select({scenario:'reload'});owner.scrub(45);owner.render();
    const keeper=owner.getFrozenDebug();release();await first;
    const current=owner.getFrozenDebug();await owner.retry();owner.close();owner.close();
    const late=review.createAnimationReviewOwner({async createActor(selection){return review.createActualReviewActor(selection,{scene,renderer,origin:camera.position.clone(),weapon:wpn,worldWeapon:wpn3p,liveBody:playerMesh});}});
    const loading=late.open();late.close();await loading;
    return{created,disposed,restore,keeperPhase:keeper.phase,currentPhase:current.phase,closed:owner.getStatus(),late:late.getStatus(),liveSource:!!playerMesh.getObjectByName('HumanBody')};
  });
  expect(result).toMatchObject({created:3,disposed:3,restore:1,keeperPhase:.45,currentPhase:.45,liveSource:true});
  expect(result.closed).toMatchObject({state:'closed',actorCount:0,playing:false});expect(result.late).toMatchObject({state:'closed',actorCount:0});
});

test('resources: review restores its caller even when a retired owner reports a failure',async({page})=>{
  await page.goto('/');const result=await page.evaluate(async()=>{
    const {createAnimationReviewOwner}=await import('/src/dev/animationReview.js');let restores=0,retired=0;
    const owner=createAnimationReviewOwner({restore(){restores++;},async createActor(){return{duration:1,update(){},render(){},dispose(){retired++;throw Error('owner failed');}};}});
    await owner.open();let failure=false;try{owner.close();}catch{failure=true;}owner.close();
    return{state:owner.getStatus().state,actors:owner.getStatus().actorCount,restores,retired,failure};
  });expect(result).toEqual({state:'closed',actors:0,restores:1,retired:1,failure:true});
});
