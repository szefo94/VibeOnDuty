import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applyCharacterAppearance } from './characterAppearance.js';
import { disposeCharacter, registerCharacterDisposer } from './characterResources.js';
import { createWeaponHandling, getWeaponHandling, updateWeaponHandling, restoreWeaponHandlingBones, disposeWeaponHandling } from './weaponHandling.js';

const armName = /^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)_/;
const hiddenName = /^(head|neck|eye|jaw)/i;
// The four bones the weapon handler turns for the crouched torso lean (weaponHandling.js).
const leanName = new Set(['spine_01', 'clavicle_l', 'clavicle_r', 'neck_01']);
const V = (...xyz) => new THREE.Vector3(...xyz);

/** Cosmetic transition only; action phase, camera and gameplay stay read-only. */
export function sampleFirstPersonMotion(state, pose, dt) {
  const target = pose?.alive !== false && pose?.aiming && !['throw','melee','reload','roll','dance'].includes(pose?.upper) ? 1 : 0;
  state.aim ??= 0;
  if (state.target !== target) { state.from = state.aim; state.target = target; state.elapsed = 0; }
  state.elapsed = Math.min(.12, (state.elapsed ?? 0) + Math.max(0, Math.min(.05, Number.isFinite(dt) ? dt : 0)));
  const t = state.elapsed / .12;
  state.aim = state.from + (target - state.from) * t * t * (3 - 2 * t);
  const sway = pose?.reducedMotion || !pose?.moving ? [0,0,0]
    : [.003 * Math.sin((pose.phase ?? 0) * Math.PI * 2) * (1 - state.aim),
      .004 * Math.sin((pose.phase ?? 0) * Math.PI * 4) * (1 - state.aim), 0];
  return Object.freeze({ aim: state.aim, sway, cameraBob: 0, cameraRoll: 0 });
}

function region(mesh, vertex) {
  const indices = mesh.geometry.attributes.skinIndex;
  const weights = mesh.geometry.attributes.skinWeight;
  if (!indices || !weights) return 'body';
  let best = -1, name = '';
  for (let j = 0; j < 4; j++) {
    const weight = weights.array[vertex * 4 + j];
    if (weight > best) { best = weight; name = mesh.skeleton.bones[indices.array[vertex * 4 + j]]?.name ?? ''; }
  }
  return hiddenName.test(name) ? 'head' : /^upperarm_/.test(name) ? 'upperArms'
    : armName.test(name) ? 'arms' : 'body';
}

/** Select into an owned buffer. Authored normals and source topology stay intact.
 * Welded boundary loops receive skinned fan caps using the adjacent paint domain.
 */
export function selectViewGeometry(mesh, wanted) {
  const source = mesh.geometry, position = source.attributes.position;
  const index = source.index?.array ?? Array.from({ length: position.count }, (_, i) => i);
  const groups = source.groups.length ? source.groups : [{ start: 0, count: index.length, materialIndex: 0 }];
  const data = Object.fromEntries(Object.entries(source.attributes).map(([name, attr]) => [name, Array.from(attr.array)]));
  const output = [], selectedGroups = [], boundaries = new Map();
  const vertexKey = i => [position.getX(i), position.getY(i), position.getZ(i)].map(n => n.toFixed(5)).join('/');
  let triangles = 0;
  for (const group of groups) {
    const start = output.length;
    for (let offset = group.start; offset < group.start + group.count; offset += 3) {
      const ids = [index[offset], index[offset + 1], index[offset + 2]];
      if (!ids.every(i => region(mesh, i) === wanted)) continue;
      output.push(...ids); triangles++;
      for (let j = 0; j < 3; j++) {
        const a = ids[j], b = ids[(j + 1) % 3], ka = vertexKey(a), kb = vertexKey(b);
        const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        if (boundaries.has(key)) boundaries.delete(key);
        else boundaries.set(key, { a, b, ka, kb, material: group.materialIndex });
      }
    }
    if (output.length > start) selectedGroups.push({ start, count: output.length - start, materialIndex: group.materialIndex });
  }
  let caps = 0;
  while (boundaries.size) {
    const [key, first] = boundaries.entries().next().value;
    boundaries.delete(key);
    const loop = [first.a, first.b]; let end = first.kb;
    while (end !== first.ka) {
      const entry = Array.from(boundaries).find(([, edge]) => edge.ka === end || edge.kb === end);
      if (!entry) break;
      const [edgeKey, edge] = entry; boundaries.delete(edgeKey);
      const next = edge.ka === end ? edge.b : edge.a;
      end = edge.ka === end ? edge.kb : edge.ka;
      if (end !== first.ka) loop.push(next);
    }
    if (end !== first.ka || loop.length < 3) continue;
    const center = data.position.length / 3;
    for (const [name, attr] of Object.entries(source.attributes)) {
      const averages = Array.from({ length: attr.itemSize }, (_, k) =>
        loop.reduce((sum, i) => sum + attr.array[i * attr.itemSize + k], 0) / loop.length);
      // Skin indices are categorical. Cap follows the adjacent endpoint, with
      // the original normalized weights; it never invents fractional bone IDs.
      if (name === 'skinIndex' || name === 'skinWeight')
        for (let k = 0; k < attr.itemSize; k++) averages[k] = attr.array[loop[0] * attr.itemSize + k];
      data[name].push(...averages);
    }
    const start = output.length;
    for (let i = 0; i < loop.length; i++) output.push(loop[(i + 1) % loop.length], loop[i], center);
    selectedGroups.push({ start, count: output.length - start, materialIndex: first.material });
    caps++;
  }
  const geometry = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(source.attributes))
    geometry.setAttribute(name, new THREE.BufferAttribute(new attr.array.constructor(data[name]), attr.itemSize, attr.normalized));
  geometry.setIndex(output);
  for (const group of selectedGroups) geometry.addGroup(group.start, group.count, group.materialIndex);
  geometry.userData = { ...source.userData, selectedTriangles: triangles, boundaryCaps: caps, viewRegion: wanted };
  return geometry;
}

function copyMetadata(value, seen = new WeakSet(), depth = 0) {
  if (value === null || ['string','boolean','number'].includes(typeof value)) return value;
  if (!value || typeof value !== 'object' || depth > 8 || value.isObject3D || value.isMaterial ||
      value.isTexture || seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) return value.map(entry => copyMetadata(entry, seen, depth + 1));
  const data = {};
  for (const [key, child] of Object.entries(value)) {
    const safe = copyMetadata(child, seen, depth + 1);
    if (safe !== undefined) data[key] = safe;
  }
  return data;
}

export function cloneVisualHierarchy(source) {
  // Runtime actors carry observation back-references (enemyGroup). Three r160
  // JSON-copies userData; isolate that metadata only for the synchronous clone,
  // and always restore the exact source objects, including on clone failure.
  const saved = new Map();
  try {
    source.traverse(node => {
      saved.set(node, node.userData);
      // Filter raw references before Object3D.toJSON can expand a whole scene.
      node.userData = copyMetadata(node.userData);
    });
    return skeletonClone(source);
  }
  finally { for (const [node, data] of saved) node.userData = data; }
}

const cloneHierarchy = cloneVisualHierarchy;

function makeView(source, selection) {
  const root = cloneHierarchy(source), pairs = [], meshPairs = [], skeletons = new Map();
  const originalNodes = [], clonedNodes = [];
  source.traverse(node => originalNodes.push(node)); root.traverse(node => clonedNodes.push(node));
  const originals = new Map(clonedNodes.map((node, i) => [node, originalNodes[i]]));
  const remove = [];
  root.traverse(node => {
    if (node.isBone) pairs.push([originals.get(node), node]);
    if (node.isMesh) {
      if (!node.isSkinnedMesh) { remove.push(node); return; }
      node.geometry = selectViewGeometry(node, selection);
      // All painted domains use the same retained skin. SkeletonUtils creates
      // one Skeleton object per mesh; reuse an exactly equal owned binding so
      // each view uploads one bone texture instead of one per clothing domain.
      const key = node.skeleton.bones.map(b => b.uuid).join('/');
      const existing = skeletons.get(key);
      if (existing && existing.boneInverses.length === node.skeleton.boneInverses.length &&
          existing.boneInverses.every((matrix, i) => matrix.equals(node.skeleton.boneInverses[i])))
        node.skeleton = existing;
      else skeletons.set(key, node.skeleton);
      node.visible = node.geometry.userData.selectedTriangles > 0;
      node.castShadow = selection === 'body'; node.frustumCulled = false;
      // Every owned accent is cloned again: view retirement cannot dispose a
      // live source actor's material. Packed paint maps remain borrowed.
      const copy = material => material.userData.characterOwned ? material.clone() : material;
      node.material = Array.isArray(node.material) ? node.material.map(copy) : copy(node.material);
      meshPairs.push([originals.get(node), node]);
    } else if (node.isLine || node.isLight || node.type.endsWith('Helper')) remove.push(node);
  });
  for (const node of remove) node.removeFromParent();
  applyCharacterAppearance(root);
  root.name = `firstPerson_${selection}`; root.visible = false;
  return { root, pairs, meshPairs };
}

export function createFirstPersonRig({ source }) {
  const arms = makeView(source, 'arms'), body = makeView(source, 'body');
  // The owned view hierarchy is fixed until retirement. Preserve exactly the
  // first depth-first name match used by Three's getObjectByName, once per rig.
  const armBones = new Map();
  arms.root.traverse(node => { if (!armBones.has(node.name)) armBones.set(node.name, node); });
  const bodyBones = new Map();
  body.root.traverse(node => { if (!bodyBones.has(node.name)) bodyBones.set(node.name, node); });
  const rig = { source, arms: arms.root, body: body.root, armPairs: arms.pairs,
    armBones, bodyBones,
    bodyPairs: body.pairs, meshPairs: [...arms.meshPairs,...body.meshPairs],
    disposed: false, handlers: new Set(), updates: 0, pose: null };
  rig.releaseSource = registerCharacterDisposer(source, () => disposeFirstPersonRig(rig));
  return rig;
}

function copyPose(pairs) {
  for (const [source, node] of pairs) {
    node.position.copy(source.position); node.quaternion.copy(source.quaternion); node.scale.copy(source.scale);
  }
}
function copyAccents(pairs) {
  for (const [source, view] of pairs) {
    const original = Array.isArray(source.material) ? source.material : [source.material];
    const owned = Array.isArray(view.material) ? view.material : [view.material];
    owned.forEach((material, i) => {
      if (!material.userData.characterOwned || !original[i]) return;
      material.color?.copy(original[i].color);
      if (material.emissive && original[i].emissive) material.emissive.copy(original[i].emissive);
      material.emissiveIntensity = original[i].emissiveIntensity;
    });
  }
}

function buildViewWeapon(rig, source, camera) {
  const root = cloneHierarchy(source);
  root.name = 'firstPerson_weapon';
  root.traverse(node => {
    if (node.isMesh) {
      node.geometry = node.geometry.clone(); node.castShadow = false; node.frustumCulled = false;
      // Actor-owned materials cannot be borrowed by another disposal owner.
      const own = material => material.userData.characterOwned || material.userData._tinted
        ? material.clone() : material;
      node.material = Array.isArray(node.material) ? node.material.map(own) : own(node.material);
    }
  });
  camera.add(root); rig.weapon = root;
  const sourceFlash = source.children.find(n => n.isMesh && n.material?.transparent);
  rig.flash = sourceFlash ? { source: sourceFlash, view: root.children[source.children.indexOf(sourceFlash)] } : null;
  for (const key of ['m4', 'p90', 'awp', 'pistol']) {
    const gun = root.getObjectByName(`${key}_1p`);
    const sourceOwner = getWeaponHandling(source.getObjectByName(`${key}_1p`));
    for (const [part, rest] of sourceOwner?.rest ?? []) {
      const ownedPart = gun?.getObjectByName(part.name);
      ownedPart?.position.copy(rest.position); ownedPart?.quaternion.copy(rest.quaternion);
    }
    if (gun) { const owner = createWeaponHandling({ weapon: key, root: gun, skeleton: rig.arms });
      owner.fixedAnchor = true; rig.handlers.add(owner); }
  }
}

/** One visible set during the existing V transition, with exception-safe state. */
export function renderFirstPersonRig(rig, { weapon, worldWeapon, firstPerson, active }, render) {
  if (!rig || rig.disposed) return render();
  const nodes = [rig.source, rig.arms, rig.body, rig.weapon, weapon, worldWeapon].filter(Boolean);
  const saved = nodes.map(node => node.visible);
  try {
    rig.source.visible = active && !firstPerson;
    rig.arms.visible = rig.body.visible = active && firstPerson && rig.pose?.alive !== false;
    if (rig.weapon) rig.weapon.visible = active && firstPerson && rig.pose?.alive !== false && !['throw', 'melee', 'dance', 'roll'].includes(rig.pose?.upper);
    weapon.visible = false;
    if (worldWeapon) worldWeapon.visible = active && !firstPerson && !['throw', 'melee', 'dance', 'roll'].includes(rig.pose?.upper);
    return render();
  } finally { nodes.forEach((node, i) => { node.visible = saved[i]; }); }
}

/** Copy the already sampled pose: no mixer, action clock or gameplay callback. */
export function updateFirstPersonRig(rig, { pose, camera, weapon = null,
  active = true, thirdPerson = false, spineQuaternion = null, rawCorrections = [], eyeHeight = 1.65, dt = .05 }) {
  if (!rig || rig.disposed) return;
  if (weapon && !rig.weapon) buildViewWeapon(rig, weapon, camera);
  for (const owner of rig.handlers) restoreWeaponHandlingBones(owner);
  copyPose(rig.armPairs); copyPose(rig.bodyPairs);
  copyAccents(rig.meshPairs);
  // Source handling is post-mixer. Reuse its saved authored pose before applying
  // the view's independent gun targets; never curl an already curled finger.
  for (const [sourceBone, quaternion] of rawCorrections) {
    rig.armBones.get(sourceBone.name)?.quaternion.copy(quaternion);
    // The crouch lean is the world body's. The body view takes back those four
    // bones only and keeps the solved arm bones it copied.
    if (leanName.has(sourceBone.name)) rig.bodyBones.get(sourceBone.name)?.quaternion.copy(quaternion);
  }
  rig.pose = active ? pose : null; rig.updates++;
  if (rig.identity !== pose?.identity) { rig.motion = {}; rig.identity = pose?.identity; }
  rig.motion ??= {};
  rig.motionSample = sampleFirstPersonMotion(rig.motion, active ? pose : { alive:false }, dt);
  rig.body.position.copy(rig.source.position); rig.body.quaternion.copy(rig.source.quaternion);
  rig.body.scale.copy(rig.source.scale);
  // Keep the same unscaled body and floor. A bounded view-only fore/aft fit keeps
  // the eye in front of the chest at every pitch, standing and crouched: the body
  // sits .18 m back at a level view, as before, and .1 m further back at the pitch
  // bound of the presentation, which is how far the torso lean (.55 x pitch) brings
  // the neck base forward. The earlier term moved the body forward under the camera
  // instead, which put the eye behind the chest and exposed the back. Neither moves
  // the simulated root/eye or changes the third-person silhouette.
  const pitch = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').x;
  const bodyForward = -.18 - .1 * Math.max(0, Math.min(1, -pitch / 1.1));
  rig.body.position.add(V(0, 0, bodyForward).applyQuaternion(rig.source.quaternion));
  // Camera pitch is applied once at the view root. World torso pitch was already
  // corrected for world aiming, so use its pre-correction sample for view arms.
  if (spineQuaternion) rig.armBones.get('spine_03')?.quaternion.copy(spineQuaternion);
  rig.arms.quaternion.copy(camera.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI));
  rig.arms.position.copy(camera.position).add(V(0, -eyeHeight, -.25).applyQuaternion(camera.quaternion));
  rig.arms.scale.copy(rig.source.scale); rig.arms.updateMatrixWorld(true); rig.body.updateMatrixWorld(true);
  // View shoulders retain the same anatomical lengths in every stance. The
  // source body's crouch displacement belongs to the world clone; translating
  // the view root avoids lowering its forearms twice relative to crouched eyes.
  const leftShoulder = rig.armBones.get('upperarm_l');
  const rightShoulder = rig.armBones.get('upperarm_r');
  if (leftShoulder && rightShoulder) {
    const center = leftShoulder.getWorldPosition(V()).add(rightShoulder.getWorldPosition(V())).multiplyScalar(.5);
    const local = center.sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());
    rig.arms.position.add(V(0, -.22 - local.y, 0).applyQuaternion(camera.quaternion));
    rig.arms.updateMatrixWorld(true);
  }
  const visible = active && pose?.alive !== false && !thirdPerson;
  rig.arms.visible = rig.body.visible = visible;
  if (rig.weapon) {
    const aim = rig.motionSample.aim;
    const reload = pose?.upper === 'reload' ? Math.sin(Math.PI * pose.action.phase) : 0;
    rig.weapon.position.set(.08 * (1 - aim), -.105 + .015 * aim + .07 * reload, -.5);
    rig.weapon.position.add(V(...rig.motionSample.sway));
    rig.weapon.quaternion.copy(weapon.quaternion);
    rig.weapon.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -.12 * (1 - aim) + .65 * reload, .3 * reload)));
    rig.weapon.visible = visible && !['throw', 'melee', 'dance', 'roll'].includes(pose?.upper);
    rig.weapon.updateWorldMatrix(true, true);
    if (rig.flash) {
      rig.flash.view.position.copy(rig.flash.source.position);
      rig.flash.view.quaternion.copy(rig.flash.source.quaternion);
      rig.flash.view.scale.copy(rig.flash.source.scale);
    }
  }
  // The view owns its copied gun and handlers, never the camera singleton.
  for (const owner of rig.handlers) {
    owner.root.visible = pose?.weapon === owner.weapon;
    owner.skeleton = pose?.weapon === owner.weapon ? rig.arms : null;
    updateWeaponHandling(owner, active && pose ? pose : { weapon: owner.weapon, alive: false });
  }
}

/** Retire presentation before a server life/session replacement; keep the view allocation. */
export function resetFirstPersonRigGeneration(rig) {
  if (!rig || rig.disposed) return;
  rig.identity = null; rig.motion = null; rig.motionSample = null; rig.pose = null;
  for (const owner of rig.handlers) {
    restoreWeaponHandlingBones(owner);
    updateWeaponHandling(owner, { weapon: owner.weapon, alive: false });
    owner.sample = owner.contacts = null;
  }
}

export function disposeFirstPersonRig(rig) {
  if (!rig || rig.disposed) return;
  rig.armBones.clear(); rig.bodyBones.clear();
  rig.releaseSource?.(); rig.releaseSource = null;
  for (const owner of rig.handlers) disposeWeaponHandling(owner);
  rig.handlers.clear(); disposeCharacter(rig.arms); disposeCharacter(rig.body);
  if (rig.weapon) disposeCharacter(rig.weapon);
  rig.flash = null; rig.motion = null; rig.weapon = null;
  rig.armPairs.length = rig.bodyPairs.length = 0; rig.pose = null; rig.disposed = true;
  rig.meshPairs.length = 0;
}
