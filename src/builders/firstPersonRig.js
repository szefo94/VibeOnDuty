import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applyCharacterAppearance } from './characterAppearance.js';
import { disposeCharacter, registerCharacterDisposer } from './characterResources.js';
import { createWeaponHandling, updateWeaponHandling, restoreWeaponHandlingBones, disposeWeaponHandling } from './weaponHandling.js';

const armName = /^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)_/;
const hiddenName = /^(head|neck|eye|jaw)/i;
const V = (...xyz) => new THREE.Vector3(...xyz);

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

function makeView(source, selection) {
  const root = skeletonClone(source), pairs = [];
  const remove = [];
  root.traverse(node => {
    if (node.isBone) pairs.push([source.getObjectByName(node.name), node]);
    if (node.isMesh) {
      if (!node.isSkinnedMesh) { remove.push(node); return; }
      node.geometry = selectViewGeometry(node, selection);
      node.visible = node.geometry.userData.selectedTriangles > 0;
      node.castShadow = selection === 'body'; node.frustumCulled = false;
      // Every owned accent is cloned again: view retirement cannot dispose a
      // live source actor's material. Packed paint maps remain borrowed.
      const copy = material => material.userData.characterOwned ? material.clone() : material;
      node.material = Array.isArray(node.material) ? node.material.map(copy) : copy(node.material);
    } else if (node.isLine || node.isLight || node.type.endsWith('Helper')) remove.push(node);
  });
  for (const node of remove) node.removeFromParent();
  applyCharacterAppearance(root);
  root.name = `firstPerson_${selection}`; root.visible = false;
  return { root, pairs };
}

export function createFirstPersonRig({ source }) {
  const arms = makeView(source, 'arms'), body = makeView(source, 'body');
  const rig = { source, arms: arms.root, body: body.root, armPairs: arms.pairs,
    bodyPairs: body.pairs, disposed: false, handlers: new Set(), updates: 0, pose: null };
  registerCharacterDisposer(source, () => disposeFirstPersonRig(rig));
  return rig;
}

function copyPose(pairs) {
  for (const [source, node] of pairs) {
    node.position.copy(source.position); node.quaternion.copy(source.quaternion); node.scale.copy(source.scale);
  }
}

function buildViewWeapon(rig, source, camera) {
  const root = skeletonClone(source);
  root.name = 'firstPerson_weapon';
  root.traverse(node => {
    if (node.isMesh) { node.geometry = node.geometry.clone(); node.castShadow = false; node.frustumCulled = false; }
  });
  camera.add(root); rig.weapon = root;
  for (const key of ['m4', 'p90', 'awp', 'pistol']) {
    const gun = root.getObjectByName(`${key}_1p`);
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
    rig.arms.visible = rig.body.visible = active && firstPerson;
    if (rig.weapon) rig.weapon.visible = active && firstPerson && !['throw', 'melee', 'dance', 'roll'].includes(rig.pose?.upper);
    weapon.visible = false;
    if (worldWeapon) worldWeapon.visible = active && !firstPerson && !['throw', 'melee', 'dance', 'roll'].includes(rig.pose?.upper);
    return render();
  } finally { nodes.forEach((node, i) => { node.visible = saved[i]; }); }
}

/** Copy the already sampled pose: no mixer, action clock or gameplay callback. */
export function updateFirstPersonRig(rig, { pose, camera, weapon = null, handlers = [],
  active = true, thirdPerson = false, spineQuaternion = null, rawCorrections = [], eyeHeight = 1.65 }) {
  if (!rig || rig.disposed) return;
  if (weapon && !rig.weapon) buildViewWeapon(rig, weapon, camera);
  for (const owner of rig.handlers) restoreWeaponHandlingBones(owner);
  copyPose(rig.armPairs); copyPose(rig.bodyPairs);
  // Source handling is post-mixer. Reuse its saved authored pose before applying
  // the view's independent gun targets; never curl an already curled finger.
  for (const [sourceBone, quaternion] of rawCorrections)
    rig.arms.getObjectByName(sourceBone.name)?.quaternion.copy(quaternion);
  rig.pose = pose; rig.updates++;
  rig.body.position.copy(rig.source.position); rig.body.quaternion.copy(rig.source.quaternion);
  rig.body.scale.copy(rig.source.scale);
  rig.body.position.add(V(0, 0, -.18).applyQuaternion(rig.source.quaternion));
  // Camera pitch is applied once at the view root. World torso pitch was already
  // corrected for world aiming, so use its pre-correction sample for view arms.
  if (spineQuaternion) rig.arms.getObjectByName('spine_03')?.quaternion.copy(spineQuaternion);
  rig.arms.quaternion.copy(camera.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI));
  rig.arms.position.copy(camera.position).add(V(0, -eyeHeight, -.25).applyQuaternion(camera.quaternion));
  rig.arms.scale.copy(rig.source.scale); rig.arms.updateMatrixWorld(true); rig.body.updateMatrixWorld(true);
  const visible = active && pose?.alive !== false && !thirdPerson;
  rig.arms.visible = rig.body.visible = visible;
  if (rig.weapon) {
    const aim = pose?.aiming ? 1 : 0;
    const reload = pose?.upper === 'reload' ? Math.sin(Math.PI * pose.action.phase) : 0;
    rig.weapon.position.set(.08 * (1 - aim), -.105 + .015 * aim + .07 * reload, -.5);
    rig.weapon.quaternion.copy(weapon.quaternion);
    rig.weapon.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -.12 * (1 - aim), .3 * reload)));
    rig.weapon.visible = visible && !['throw', 'melee', 'dance', 'roll'].includes(pose?.upper);
    rig.weapon.updateWorldMatrix(true, true);
  }
  // Borrowed handler arguments identify the currently sampled world corrections
  // only. The view owns its copied gun and handlers, never the camera singleton.
  void handlers;
  for (const owner of rig.handlers) {
    owner.root.visible = pose?.weapon === owner.weapon;
    owner.skeleton = pose?.weapon === owner.weapon ? rig.arms : null;
    updateWeaponHandling(owner, pose ?? { weapon: owner.weapon, alive: false });
  }
}

export function disposeFirstPersonRig(rig) {
  if (!rig || rig.disposed) return;
  for (const owner of rig.handlers) disposeWeaponHandling(owner);
  rig.handlers.clear(); disposeCharacter(rig.arms); disposeCharacter(rig.body);
  if (rig.weapon) disposeCharacter(rig.weapon);
  rig.armPairs.length = rig.bodyPairs.length = 0; rig.pose = null; rig.disposed = true;
}
