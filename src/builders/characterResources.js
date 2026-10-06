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

export function disposeCharacter(root, mixer) {
  if (!root || disposed.has(root)) return;
  disposed.add(root);
  for (const callback of disposers.get(root) ?? []) callback();
  disposers.delete(root);
  mixer?.stopAllAction();
  mixer?.uncacheRoot(root);
  detachSkeletonDebug(root);
  root.removeFromParent();

  const geometries = new Set(), materials = new Set(), skeletons = new Set();
  root.traverse(node => {
    if (node.geometry && !sharedGeometry.has(node.geometry)) geometries.add(node.geometry);
    if (node.skeleton) skeletons.add(node.skeleton);
    for (const mat of (Array.isArray(node.material) ? node.material : [node.material])) {
      if (mat?.userData?._tinted || mat?.userData?.characterOwned) materials.add(mat);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of ownedTextures.get(root) ?? []) texture.dispose();
  ownedTextures.delete(root);
  for (const skeleton of skeletons) skeleton.dispose();
}
