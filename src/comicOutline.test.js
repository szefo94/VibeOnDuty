import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
vi.mock('./builders/enemyAnimations.js', () => ({ detachSkeletonDebug: vi.fn() }));
import { disposeCharacter } from './builders/characterResources.js';
import { applyCharacterAppearance } from './builders/characterAppearance.js';

// The baseline renderer has one pass; a missing new module is represented by
// that real baseline so RED fails on behavior, rather than test discovery/import.
const ink = await import('./comicOutline.js').catch(() => ({
  renderComicScene: (renderer, scene, camera) => renderer.render(scene, camera),
  setComicQuality: () => {}, disposeComicOwner: () => {},
}));

function setup(domain = 'skin') {
  const scene = new THREE.Scene(), root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial(); material.userData.artDomain = domain;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material); root.add(mesh); scene.add(root);
  applyCharacterAppearance(root);
  scene.background = new THREE.Color(0x808080);
  const renderer = { autoClear: true, shadowMap: { enabled: true },
    getSize: (v) => v.set(1280, 720), render: vi.fn() };
  return { scene, root, mesh, material, renderer, camera: new THREE.PerspectiveCamera() };
}

describe('comic outlines', () => {
  it('adds one selective pass and retains exact geometry/skeleton and skinning shader path', () => {
    const f = setup(); ink.setComicQuality('medium');
    const skeleton = new THREE.Skeleton([]); f.mesh.skeleton = skeleton;
    const geometry = f.mesh.geometry;
    const seen = [];
    f.renderer.render.mockImplementation(() => seen.push(f.mesh.material));
    ink.renderComicScene(f.renderer, f.scene, f.camera);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(f.material);
    expect(seen[1].side).toBe(THREE.BackSide);
    expect(seen[1].vertexShader).toContain('#include <skinning_vertex>');
    expect(seen[1].vertexShader).toContain('#include <morphnormal_vertex>');
    expect(f.mesh.geometry).toBe(geometry); expect(f.mesh.skeleton).toBe(skeleton);
    expect(f.mesh.material).toBe(f.material);
    ink.disposeComicOwner(f.renderer);
  });
  it('restores arrays, callbacks, visibility and renderer state when ink rendering throws', () => {
    const f = setup(); ink.setComicQuality('high');
    const effect = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ transparent: true }));
    f.scene.add(effect);
    const array = [f.material, new THREE.MeshStandardMaterial()]; f.mesh.material = array;
    const background = f.scene.background, beforeRender = f.mesh.onBeforeRender;
    f.renderer.render.mockImplementationOnce(() => {}).mockImplementationOnce(() => { throw new Error('GPU fault'); });
    expect(() => ink.renderComicScene(f.renderer, f.scene, f.camera)).toThrow('GPU fault');
    expect(f.mesh.material).toBe(array); expect(f.mesh.onBeforeRender).toBe(beforeRender);
    expect(effect.visible).toBe(true); expect(f.renderer.autoClear).toBe(true);
    expect(f.renderer.shadowMap.enabled).toBe(true); expect(f.scene.background).toBe(background);
    expect(f.scene.matrixWorldAutoUpdate).toBe(true);
    ink.disposeComicOwner(f.renderer);
  });
  it('retires ink exactly once and keeps base maps/geometry alive', () => {
    const f = setup(); ink.setComicQuality('medium');
    const materials = [];
    f.renderer.render.mockImplementation(() => materials.push(f.mesh.material));
    ink.renderComicScene(f.renderer, f.scene, f.camera);
    expect(materials).toHaveLength(2);
    const disposed = vi.spyOn(materials[1], 'dispose');
    disposeCharacter(f.root); disposeCharacter(f.root);
    ink.disposeComicOwner(f.root); ink.disposeComicOwner(f.renderer);
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(f.mesh.material).toBe(f.material);
  });
  it('Low omits silhouettes; High alone selects stone; effects and untagged surfaces stay excluded', () => {
    const f = setup('stone');
    ink.setComicQuality('low'); ink.renderComicScene(f.renderer, f.scene, f.camera);
    expect(f.renderer.render).toHaveBeenCalledTimes(1);
    f.renderer.render.mockClear();
    ink.setComicQuality('medium'); ink.renderComicScene(f.renderer, f.scene, f.camera);
    expect(f.renderer.render).toHaveBeenCalledTimes(1);
    f.renderer.render.mockClear();
    ink.setComicQuality('high'); ink.renderComicScene(f.renderer, f.scene, f.camera);
    expect(f.renderer.render).toHaveBeenCalledTimes(2);
    ink.disposeComicOwner(f.renderer);
  });
});
