import { detachSkeletonDebug } from './enemyAnimations.js';

// Template geometry is shared by SkeletonUtils.clone / Object3D.clone. Everything
// created for an individual character (weapons, flashes, helpers) belongs to it.
const sharedGeometry = new WeakSet();
const disposed = new WeakSet();
const disposers = new WeakMap();
const ownedTextures = new WeakMap();

export function registerCharacterDisposer(root, callback) {
  if (!root || disposed.has(root)) return;
  if (!disposers.has(root)) disposers.set(root, new Set());
  disposers.get(root).add(callback);
  return () => {
    const callbacks = disposers.get(root);
    callbacks?.delete(callback);
    if (callbacks?.size === 0) disposers.delete(root);
  };
}

// Shared GLB/atlas maps are never registered here.
export function registerCharacterTexture(root, texture) {
  if (!root || !texture || disposed.has(root)) return;
  if (!ownedTextures.has(root)) ownedTextures.set(root, new Set());
  ownedTextures.get(root).add(texture);
}

export function preserveTemplateGeometry(root) {
  root.traverse(node => { if (node.geometry) sharedGeometry.add(node.geometry); });
}

/** Reuse only exactly equal palettes inside this instance, before its first render. */
export function consolidateCharacterSkeletons(root) {
  const meshes = [], bones = new Set(), original = new Set(), buckets = new Map();
  root.traverse(node => {
    if (node.isBone) bones.add(node);
    if (node.isSkinnedMesh) { meshes.push(node); original.add(node.skeleton); }
  });
  for (const mesh of meshes) {
    const skeleton = mesh.skeleton;
    if (!skeleton.bones.length || !skeleton.bones.every(bone => bones.has(bone))) continue;
    const key = skeleton.bones.map(bone => bone.uuid).join('/');
    const candidates = buckets.get(key) ?? [];
    const canonical = candidates.find(candidate =>
      candidate.bones.length === skeleton.bones.length &&
      candidate.bones.every((bone, i) => bone === skeleton.bones[i]) &&
      candidate.boneInverses.length === skeleton.boneInverses.length &&
      candidate.boneInverses.every((inverse, i) => inverse.equals(skeleton.boneInverses[i])));
    // Do not call bind(): it can recalculate inverses or replace mesh bind matrices.
    // Ordered skin indices, geometry, materials and each mesh's bind basis survive.
    if (canonical) mesh.skeleton = canonical;
    else { candidates.push(skeleton); buckets.set(key, candidates); }
  }
  const retained = new Set(meshes.map(mesh => mesh.skeleton));
  for (const skeleton of original) if (!retained.has(skeleton)) skeleton.dispose();
  return { before: original.size, after: retained.size };
}

export function disposeCharacter(root, mixer) {
  if (!root || disposed.has(root)) return;
  disposed.add(root);
  // Retire ownership before invoking foreign callbacks. A failed owner must
  // neither strand its siblings nor make a second disposal replay callbacks.
  const failures = [];
  const retire = callback => { try { callback(); } catch (error) { failures.push(error); } };
  for (const callback of disposers.get(root) ?? []) retire(callback);
  disposers.delete(root);
  retire(() => mixer?.stopAllAction());
  retire(() => mixer?.uncacheRoot(root));
  retire(() => detachSkeletonDebug(root));
  retire(() => root.removeFromParent());

  const geometries = new Set(), materials = new Set(), skeletons = new Set();
  root.traverse(node => {
    if (node.geometry && !sharedGeometry.has(node.geometry)) geometries.add(node.geometry);
    if (node.skeleton) skeletons.add(node.skeleton);
    for (const mat of (Array.isArray(node.material) ? node.material : [node.material])) {
      if (mat?.userData?._tinted || mat?.userData?.characterOwned) materials.add(mat);
    }
  });
  for (const geometry of geometries) retire(() => geometry.dispose());
  for (const material of materials) retire(() => material.dispose());
  for (const texture of ownedTextures.get(root) ?? []) retire(() => texture.dispose());
  ownedTextures.delete(root);
  for (const skeleton of skeletons) retire(() => skeleton.dispose());
  if (failures.length) throw new AggregateError(failures, 'Character retirement failed after cleanup');
}

/** Allocation-free retirement query for owners that hold references into a character. */
export function isCharacterDisposed(root) { return !!root && disposed.has(root); }

/** Scalar ownership diagnostics; never expose resources or count shared maps as retired. */
export function inspectCharacterResources(root) {
  return { disposed: !!root && disposed.has(root), callbacks: disposers.get(root)?.size ?? 0,
    textures: ownedTextures.get(root)?.size ?? 0 };
}
