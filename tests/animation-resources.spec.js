import { test, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { compareAnimationCandidate } from '../tools/art/review.mjs';
import { parseGLB } from '../tools/art/inspect-character.mjs';
import { createHash } from 'node:crypto';

const animationBytes = await readFile(new URL('./fixtures/enemyAnimations.uncached.js', import.meta.url));
if (createHash('sha256').update(animationBytes).digest('hex') !==
  '61db86321fb6d179d643e74d9b2797a463e1f6c9eabed215b37d74a918239f67')
  throw Error('Immutable uncached animation fixture changed');
const uncachedAnimation = animationBytes.toString('utf8')
  .replace("import * as THREE from 'three';", 'const THREE = window.__THREE;');

test('owner cache: loaded presentation preserves layers and lazily created masks across interruptions and replacement', async ({ page }, info) => {
  test.setTimeout(90000);
  await page.route('**/src/builders/__uncachedAnimation.js', route =>
    route.fulfill({ contentType: 'text/javascript', body: uncachedAnimation }));
  await page.goto('/'); await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 60000 });
  await page.locator('#range-startbtn').click();
  const result = await page.evaluate(async () => {
    const T = window.__THREE, g = await import('/src/builders/enemyGLTF.js');
    const a = await import('/src/builders/enemyAnimations.js');
    const original = await import('/src/builders/__uncachedAnimation.js');
    const h = await import('/src/builders/weaponHandling.js');
    const r = await import('/src/builders/characterResources.js');
    (await import('/src/input.js')).setGameRunning(false);
    const actor = g.buildEnemyMesh(0, 0), baseline = g.buildEnemyMesh(0, 0);
    for (const owner of [actor, baseline]) for (const action of new Set(Object.values(owner.actions))) action.time = 0;
    const duplicate = new T.Group(); duplicate.name = 'enemyWeaponMount'; actor.mesh.add(duplicate);
    const matched = [];
    const snapshot = (e, driver) => {
      const bones = []; e.mesh.traverse(n => { if (n.isBone) bones.push([n.name, n.quaternion.toArray()]); });
      return { bones, layers: driver.inspectPresentationLayers(e), root: e.mesh.position.toArray(), pose: e.presentation };
    };
    const masks = () => [...actor._presentationMasks.values()].flatMap(pair => Object.values(pair)).filter(Boolean);
    const outcomes = [];
    const inputs = [
      { weapon: 'm4', action: { kind: 'ready' } },
      { weapon: 'm4', aiming: true, action: { kind: 'reload', total: 1.8, elapsed: .7 } },
      { weapon: 'pistol', action: { kind: 'reload', total: 1.2, elapsed: .3 } },
      { weapon: 'pistol', action: { kind: 'melee', total: .4, elapsed: .1 } },
      { weapon: 'pistol', alive: false, action: { kind: 'ready' } },
    ];
    for (const [i, input] of inputs.entries()) {
      const raw = { identity: 'cache-equivalence', generation: 'one', alive: true,
        position: { x: i * .04, y: 0, z: -.1 * i }, sampleTimeSeconds: i * .05,
        onGround: true, bodyYaw: .2, aimYaw: .4, pitch: -.2, ...input };
      a.tickPresentation(actor, raw, .05); original.tickPresentation(baseline, raw, .05);
      matched.push(JSON.stringify(snapshot(actor, a)) === JSON.stringify(snapshot(baseline, original)));
      outcomes.push({ allMasksCollected: masks().every(action => actor._presentationActions?.has(action)),
        interruptedStopped: i < 3 || masks().every(action => !action.isScheduled()) });
    }
    let lookups = 0, enumerations = 0;
    const lookup = actor.mesh.getObjectByName;
    actor.mesh.getObjectByName = function (...args) { lookups++; return lookup.apply(this, args); };
    actor.actions = new Proxy(actor.actions, { ownKeys(target) { enumerations++; return Reflect.ownKeys(target); } });
    const ready = { identity: 'cache-equivalence', generation: 'two', alive: true, onGround: true,
      position: { x: 0, y: 0, z: 0 }, sampleTimeSeconds: 1, bodyYaw: 0, aimYaw: 0, weapon: 'm4', action: { kind: 'ready' } };
    a.tickPresentation(actor, ready, .05); lookups = enumerations = 0;
    for (let i = 0; i < 20; i++) a.tickPresentation(actor, { ...ready, sampleTimeSeconds: 1 + i * .05 }, .05);
    const currentMount = actor._handlingMount === lookup.call(actor.mesh, 'enemyWeaponMount');
    const old = { mesh: actor.mesh, mixer: actor.mixer, actions: actor._presentationActions, masks: masks() };
    const replacement = g.buildEnemyMesh(0, 0);
    Object.assign(actor, replacement); a.tickPresentation(actor, { ...ready, generation: 'three' }, .05);
    const replaced = actor._handlingMount === replacement.mesh.getObjectByName('enemyWeaponMount')
      && actor._presentationActions !== old.actions && old.actions?.size === 0
      && old.masks.every(action => !action.isScheduled());
    r.disposeCharacter(old.mesh, old.mixer); r.disposeCharacter(old.mesh, old.mixer);
    const staleSafe = actor._presentationActions?.size > 0 && actor.presentation?.alive === true;
    const mount = actor._handlingMount ?? actor.mesh.getObjectByName('enemyWeaponMount');
    const firstWeapon = mount.children[0];
    const sibling = g.buildEnemyMesh(0, 0), nextWeapon = sibling.mesh.getObjectByName('enemyWeaponMount').children[0];
    firstWeapon.removeFromParent(); mount.add(nextWeapon);
    const nextOwner = h.getWeaponHandling(nextWeapon); nextOwner.skeleton = actor.mesh;
    a.tickPresentation(actor, { ...ready, generation: 'three' }, .05);
    const weaponReplacement = nextOwner.updates > 0;
    mount.add(firstWeapon); nextWeapon.removeFromParent();
    sibling.mesh.getObjectByName('enemyWeaponMount').add(nextWeapon);
    const oldCollection = actor._presentationActions;
    const mixer = new T.AnimationMixer(actor.mesh), actions = {};
    for (const [key, action] of Object.entries(actor.actions)) actions[key] = mixer.clipAction(action.getClip());
    actor.mixer = mixer; actor.actions = actions; a.tickPresentation(actor, ready, .05);
    const mixerReplacement = oldCollection?.size === 0 && actor._presentationMixer === mixer;
    r.disposeCharacter(actor.mesh, actor.mixer); r.disposeCharacter(actor.mesh, actor.mixer);
    const retired = actor._handlingMount === null && actor._presentationActions?.size === 0 && actor._bones.length === 0;
    a.tickPresentation(sibling, ready, .05);
    const keeper = sibling.presentation.alive && sibling._presentationActive.size > 0;
    const next = g.buildEnemyMesh(0, 0); a.tickPresentation(next, ready, .05);
    const nextUsable = next.presentation.alive && next._presentationActive.size > 0;
    for (const e of [baseline, sibling, next]) r.disposeCharacter(e.mesh, e.mixer);
    return { matched, outcomes, lookups, enumerations, currentMount, replaced, staleSafe,
      weaponReplacement, mixerReplacement, retired, keeper, nextUsable };
  });
  await writeFile(info.outputPath('owner-cache-presentation.json'), JSON.stringify(result, null, 2));
  // The research cache is gitignored, so a fresh checkout does not have it.
  await mkdir('.planning/research/.cache', { recursive: true });
  await writeFile('.planning/research/.cache/07-09-owner-cache-presentation-latest.json', JSON.stringify(result, null, 2));
  expect(result.matched).toEqual(Array(5).fill(true));
  expect(result.outcomes.every(row => row.allMasksCollected && row.interruptedStopped)).toBe(true);
  expect(result.lookups).toBe(0); expect(result.enumerations).toBe(0);
  for (const key of ['currentMount', 'replaced', 'staleSafe', 'weaponReplacement', 'mixerReplacement', 'retired', 'keeper', 'nextUsable']) expect(result[key], key).toBe(true);
});

test('resources: a warmed first-person view reuses its exact bone lookup and releases it on retirement', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/');
  await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 60000 });
  await page.locator('#range-startbtn').click();
  const result = await page.evaluate(async () => {
    const g = await import('/src/builders/enemyGLTF.js');
    const f = await import('/src/builders/firstPersonRig.js');
    const input = await import('/src/input.js'); input.setGameRunning(false);
    const { camera } = await import('/src/scene.js');
    const source = g.buildEnemyMesh(1, 1), rig = f.createFirstPersonRig({ source: source.mesh });
    const args = { pose: { identity: 'cache', weapon: 'm4', alive: true, upper: 'ready',
      action: { phase: 0 } }, camera,
      rawCorrections: [[source.mesh.getObjectByName('hand_r'), new window.__THREE.Quaternion()]] };
    f.updateFirstPersonRig(rig, args);
    let lookups = 0;
    const original = rig.arms.getObjectByName;
    rig.arms.getObjectByName = function (...values) { lookups++; return original.apply(this, values); };
    for (let i = 0; i < 20; i++) f.updateFirstPersonRig(rig, args);
    // No gun means no handling solver can contribute recursive lookups here.
    // Retain the actual arms/body calculation and its source correction copying.
    const hand = original.call(rig.arms, 'hand_r');
    const cachedHand = rig.armBones?.get('hand_r') === hand;
    const sameCorrection = hand.quaternion.equals(args.rawCorrections[0][1]);
    f.disposeFirstPersonRig(rig); f.disposeFirstPersonRig(rig);
    const released = rig.armBones?.size === 0;
    g.disposeEnemyMesh(source.mesh, source.mixer);
    return { lookups, cachedHand, sameCorrection, released };
  });
  expect(result).toEqual({ lookups: 0, cachedHand: true, sameCorrection: true, released: true });
});

test('resources: each world actor uploads one independent skeleton palette', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 60000 });
  await page.locator('#range-startbtn').click();
  const result = await page.evaluate(async () => {
    const g = await import('/src/builders/enemyGLTF.js');
    const { scene, camera, renderer } = await import('/src/scene.js');
    const input = await import('/src/input.js'); input.setGameRunning(false);
    const a = g.buildEnemyMesh(camera.position.x, camera.position.z - 3);
    const b = g.buildEnemyMesh(camera.position.x + 1, camera.position.z - 3);
    scene.add(a.mesh, b.mesh); renderer.render(scene, camera); renderer.getContext().finish();
    const palettes = actor => { const set = new Set(); actor.mesh.traverse(n => { if (n.skeleton) set.add(n.skeleton); }); return [...set]; };
    const left = palettes(a), right = palettes(b);
    const result = { counts: [left.length, right.length], independent: left.every(s => !right.includes(s)),
      uploaded: [...left, ...right].every(s => s.boneTexture?.image?.data.length > 0) };
    g.disposeEnemyMesh(a.mesh, a.mixer); g.disposeEnemyMesh(b.mesh, b.mixer);
    return result;
  });
  expect(result.counts).toEqual([1, 1]);
  expect(result.independent).toBe(true); expect(result.uploaded).toBe(true);
});

test('resources: consolidation preserves actual posed vertices, pixels and bindings with single retirement', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/'); await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 60000 });
  await page.locator('#range-startbtn').click();
  const result = await page.evaluate(async () => {
    const T = window.__THREE, r = await import('/src/builders/characterResources.js');
    const g = await import('/src/builders/enemyGLTF.js');
    const { renderer } = await import('/src/scene.js');
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const { clone } = await import('/node_modules/three/examples/jsm/utils/SkeletonUtils.js');
    const input = await import('/src/input.js'); input.setGameRunning(false);
    const template = await new GLTFLoader().loadAsync(new URL('models/enemy.glb', location.href).href);
    r.preserveTemplateGeometry(template.scene);
    const root = clone(template.scene), sibling = clone(template.scene);
    const scene = new T.Scene(); scene.background = new T.Color(0x26354a);
    scene.add(new T.AmbientLight(0xffffff, 2));
    const light = new T.DirectionalLight(0xffffff, 3); light.position.set(3, 4, 5); scene.add(light, root);
    const camera = new T.PerspectiveCamera(44, 4 / 3, .1, 100);
    camera.position.set(0, 1.6, 5); camera.lookAt(0, .9, 0);
    renderer.setSize(800, 600);
    const meshes = []; root.traverse(n => { if (n.isSkinnedMesh) { n.frustumCulled = false; meshes.push(n); } });
    const mixer = new T.AnimationMixer(root);
    const action = mixer.clipAction(g.findMotionClip(template.animations, 'reload', 'm4')); action.play();
    const vertices = () => meshes.map(mesh => {
      const positions = []; for (let i = 0; i < mesh.geometry.attributes.position.count; i++)
        positions.push(...mesh.getVertexPosition(i, new T.Vector3()).toArray());
      return positions;
    });
    const bind = () => meshes.map(mesh => ({ matrix: mesh.bindMatrix.toArray(), inverse: mesh.bindMatrixInverse.toArray(),
      skinIndices: Array.from(mesh.geometry.attributes.skinIndex.array), skinWeights: Array.from(mesh.geometry.attributes.skinWeight.array) }));
    const render = () => { renderer.render(scene, camera); renderer.getContext().finish(); return renderer.domElement.toDataURL('image/png'); };
    mixer.setTime(.6); root.updateMatrixWorld(true);
    const beforeVertices = vertices(), beforeBind = bind(), beforePixels = render();
    const original = new Set(meshes.map(n => n.skeleton));
    const originalPalettes = [...original].map(s => Array.from(s.boneMatrices));
    let discardedTextures = 0; for (const skeleton of original)
      skeleton.boneTexture.addEventListener('dispose', () => discardedTextures++);
    const consolidation = r.consolidateCharacterSkeletons(root);
    const discardedAtMerge = discardedTextures;
    const afterPixels = render(), vertexExact = JSON.stringify(vertices()) === JSON.stringify(beforeVertices);
    const bindingExact = JSON.stringify(bind()) === JSON.stringify(beforeBind);
    const shared = meshes[0].skeleton, palette = Array.from(shared.boneMatrices);
    const paletteExact = meshes.every(mesh => mesh.skeleton === shared);
    const paletteValuesExact = originalPalettes.every(values => JSON.stringify(values) === JSON.stringify(palette));
    const geometryMaterials = meshes.map(mesh => [mesh.geometry, mesh.material]);
    const poses = [];
    for (const time of [.1, .55, 1.2]) {
      mixer.setTime(time); root.updateMatrixWorld(true); const expected = vertices();
      // Independent palettes with the same ordered exact bones/inverses prove that
      // consolidation does not change the deformation at later moving poses.
      const replaced = new Set(meshes.map(mesh => mesh.skeleton));
      meshes.forEach(mesh => { mesh.skeleton = new T.Skeleton(shared.bones, shared.boneInverses); });
      for (const skeleton of replaced) skeleton.dispose();
      const independent = vertices(); r.consolidateCharacterSkeletons(root); render();
      poses.push(JSON.stringify(expected) === JSON.stringify(independent));
    }
    const retained = meshes[0].skeleton; let retainedDisposals = 0;
    retained.boneTexture.addEventListener('dispose', () => retainedDisposals++);
    let sharedDisposals = 0; const watched = new Set();
    for (const mesh of meshes) { watched.add(mesh.geometry); for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
      for (const texture of [material.map, material.normalMap]) if (texture) watched.add(texture); }
    for (const resource of watched) resource.addEventListener('dispose', () => sharedDisposals++);
    const siblingSkeletons = new Set(); sibling.traverse(n => { if (n.skeleton) siblingSkeletons.add(n.skeleton); });
    const independentSibling = [...siblingSkeletons].every(s => !meshes.some(mesh => mesh.skeleton === s));
    r.disposeCharacter(root, mixer); r.disposeCharacter(root, mixer);
    scene.add(sibling); render();
    const siblingUsable = [...siblingSkeletons].every(s => s.boneTexture?.image?.data.length > 0);
    const next = clone(template.scene); r.consolidateCharacterSkeletons(next); scene.add(next); render();
    const nextUsable = next.getObjectByProperty('isSkinnedMesh', true).skeleton.boneTexture?.image?.data.length > 0;
    const resourcesExact = meshes.every((mesh, i) => mesh.geometry === geometryMaterials[i][0] && mesh.material === geometryMaterials[i][1]);
    r.disposeCharacter(sibling); r.disposeCharacter(next);
    return { consolidation, vertexExact, bindingExact, pixelExact: beforePixels === afterPixels, paletteExact, paletteValuesExact,
      paletteLength: palette.length, discardedTexturesAtMerge: discardedAtMerge,
      discardedTextures, poses, independentSibling, siblingUsable, nextUsable, resourcesExact,
      retainedDisposals, sharedDisposals, bindings: mixer.stats.bindings.inUse,
      beforePixels, afterPixels };
  });
  expect(result.consolidation).toEqual({ before: 51, after: 1 });
  for (const name of ['vertexExact', 'bindingExact', 'pixelExact', 'paletteExact', 'paletteValuesExact', 'independentSibling', 'siblingUsable', 'nextUsable', 'resourcesExact'])
    expect(result[name], name).toBe(true);
  expect(result.poses).toEqual([true, true, true]); expect(result.retainedDisposals).toBe(1);
  expect(result.discardedTexturesAtMerge).toBe(50); expect(result.discardedTextures).toBe(51);
  expect(result.sharedDisposals).toBe(0); expect(result.bindings).toBe(0);
  // Retain actual full pixels outside Playwright's shared output directory.
  const directory = '.planning/research/.cache/07-09-skeleton-proof'; await mkdir(directory, { recursive: true });
  for (const name of ['beforePixels', 'afterPixels']) await writeFile(`${directory}/${name}.png`, Buffer.from(result[name].split(',')[1], 'base64'));
  const { beforePixels, afterPixels, ...metrics } = result;
  await writeFile(`${directory}/metrics.json`, JSON.stringify(metrics, null, 2) + '\n');
});

test('resources: unequal inverse binds or ordered bone palettes are not consolidated', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const T = window.__THREE, r = await import('/src/builders/characterResources.js');
    const root = new T.Group(), a = new T.Bone(), b = new T.Bone(); root.add(a, b);
    const add = (bones, inverses) => { const mesh = new T.SkinnedMesh(new T.BufferGeometry(), new T.MeshBasicMaterial());
      mesh.skeleton = new T.Skeleton(bones, inverses); root.add(mesh); return mesh; };
    add([a, b], [new T.Matrix4(), new T.Matrix4()]);
    add([b, a], [new T.Matrix4(), new T.Matrix4()]);
    add([a, b], [new T.Matrix4().makeTranslation(.1, 0, 0), new T.Matrix4()]);
    const result = r.consolidateCharacterSkeletons(root); r.disposeCharacter(root); return result;
  });
  expect(result).toEqual({ before: 3, after: 3 });
});

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
