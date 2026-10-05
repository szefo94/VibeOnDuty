/*
 * Projected-normal outline shader adapted from three.js r160 OutlineEffect:
 * https://github.com/mrdoob/three.js/blob/r160/examples/jsm/effects/OutlineEffect.js
 * The MIT License — Copyright © 2010-2023 three.js authors
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
import { BackSide, BufferAttribute, Color, ShaderMaterial, UniformsLib, UniformsUtils, Vector2 } from 'three';
import { characterDomain, characterOwner } from './builders/characterAppearance.js';
import { registerCharacterDisposer } from './builders/characterResources.js';

let quality = 'medium';
const contexts = new Map();
const registered = new WeakSet();
const actorDomains = new Set(['skin', 'fabric', 'armor', 'team-accent', 'teamAccent', 'weapon']);

const vertexShader = `
#include <common>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
attribute vec3 comicNormal;
uniform vec2 outlineViewport;
uniform float outlineThickness;
void main() {
  #include <uv_vertex>
  vec3 objectNormal = vec3(comicNormal);
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <morphtarget_vertex>
  #include <skinning_vertex>
  #include <displacementmap_vertex>
  #include <project_vertex>
  // BackSide: project the inward normal, then subtract it for outward ink.
  vec4 neighbor = projectionMatrix * modelViewMatrix * vec4(transformed - objectNormal, 1.0);
  vec2 direction = (gl_Position.xy / gl_Position.w - neighbor.xy / neighbor.w) * outlineViewport;
  float len = length(direction);
  if (len > 0.00001 && gl_Position.w > 0.0) {
    gl_Position.xy += direction / len * outlineThickness * 2.0 / outlineViewport * gl_Position.w;
  }
  #include <logdepthbuf_vertex>
  #include <clipping_planes_vertex>
  #include <fog_vertex>
}`;
const fragmentShader = `
#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
uniform vec3 outlineColor;
void main() {
  #include <clipping_planes_fragment>
  #include <logdepthbuf_fragment>
  gl_FragColor = vec4(outlineColor, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

function eligible(node, material) {
  if (!node.isMesh || !node.geometry?.attributes.normal || !material ||
      node.userData.artContour === false || material.userData.artContour === false ||
      material.visible === false || material.transparent || material.opacity < 1 ||
      material.wireframe || material.depthTest === false) return false;
  const domain = characterDomain(node, material);
  return actorDomains.has(domain) || (quality === 'high' && domain === 'stone');
}

function releaseRecord(context, node) {
  const record = context.records.get(node);
  if (!record) return;
  for (const material of record.materials.values()) material.dispose();
  context.records.delete(node);
}

// UV/material boundaries duplicate positions with split lighting normals. A
// separate averaged attribute closes the ink hull without changing the authored
// shading normals, topology, bind weights, or geometry ownership. Never weld
// vertices whose skin deformation differs, even when their bind positions match.
function prepareOutlineNormals(geometry) {
  if (geometry.getAttribute('comicNormal')) return;
  const position = geometry.attributes.position, normal = geometry.attributes.normal;
  const indices = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight;
  const groups = new Map(), keys = [];
  for (let i = 0; i < position.count; i++) {
    let key = [position.getX(i), position.getY(i), position.getZ(i)]
      .map((n) => Math.round(n * 100000)).join('/');
    if (indices && weights) {
      const influences = [];
      for (let j = 0; j < 4; j++) {
        const weight = Math.round(weights.getComponent(i, j) * 100000);
        if (weight) influences.push([indices.getComponent(i, j), weight]);
      }
      influences.sort((a, b) => a[0] - b[0]);
      key += ':' + influences.map((entry) => entry.join(',')).join('/');
    }
    keys.push(key);
    const sum = groups.get(key) ?? [0, 0, 0];
    sum[0] += normal.getX(i); sum[1] += normal.getY(i); sum[2] += normal.getZ(i);
    groups.set(key, sum);
  }
  const values = new Float32Array(normal.count * 3);
  for (let i = 0; i < normal.count; i++) {
    const sum = groups.get(keys[i]);
    const length = Math.hypot(...sum);
    values.set(length > 0.00001 ? sum.map((n) => n / length) :
      [normal.getX(i), normal.getY(i), normal.getZ(i)], i * 3);
  }
  geometry.setAttribute('comicNormal', new BufferAttribute(values, 3));
}

export function disposeComicOwner(owner) {
  const context = contexts.get(owner);
  if (context) {
    for (const node of context.records.keys()) releaseRecord(context, node);
    context.hidden.dispose();
    owner.domElement?.removeEventListener('webglcontextlost', context.onLost);
    contexts.delete(owner);
    return;
  }
  for (const context of contexts.values()) {
    for (const [node, record] of context.records) {
      if (record.owner === owner || node === owner) releaseRecord(context, node);
    }
  }
}

export function setComicQuality(value) {
  quality = ['low', 'medium', 'high'].includes(value) ? value : 'medium';
  // Quality transitions release unused GPU programs immediately, including High stone.
  for (const context of contexts.values())
    for (const [node, record] of context.records)
      if (quality === 'low' || ![...record.materials.keys()].some((m) => eligible(node, m)))
        releaseRecord(context, node);
  return quality;
}

function getContext(renderer) {
  let context = contexts.get(renderer);
  if (context) return context;
  context = { records: new Map(), viewport: new Vector2(),
    hidden: new ShaderMaterial({ visible: false }), onLost: () => disposeComicOwner(renderer) };
  renderer.domElement?.addEventListener('webglcontextlost', context.onLost);
  contexts.set(renderer, context);
  return context;
}

function outlineMaterial(context, node, original) {
  let record = context.records.get(node);
  if (!record) {
    const owner = characterOwner(node) ?? node;
    record = { owner, materials: new Map() }; context.records.set(node, record);
    if (characterOwner(node) && !registered.has(owner)) {
      registered.add(owner);
      registerCharacterDisposer(owner, () => disposeComicOwner(owner));
    }
  }
  let material = record.materials.get(original);
  if (!material) {
    material = new ShaderMaterial({
      name: 'Comic silhouette', uniforms: UniformsUtils.merge([
        UniformsLib.fog, UniformsLib.displacementmap, {
          outlineViewport: { value: new Vector2() },
          outlineThickness: { value: 2 }, outlineColor: { value: new Color(0x08090b) },
        },
      ]), vertexShader, fragmentShader, side: BackSide, toneMapped: false,
      fog: original.fog, clipping: true, depthWrite: false,
    });
    material.displacementMap = original.displacementMap;
    material.clippingPlanes = original.clippingPlanes;
    material.clipIntersection = original.clipIntersection;
    record.materials.set(original, material);
  }
  material.uniforms.outlineViewport.value.copy(context.viewport);
  const domain = characterDomain(node, original);
  const pixels = domain === 'stone' ? 1 : domain === 'skin' ? 1.35 : 2;
  material.uniforms.outlineThickness.value = pixels * context.viewport.y / 720;
  material.uniforms.displacementMap.value = original.displacementMap;
  material.uniforms.displacementScale.value = original.displacementScale;
  material.uniforms.displacementBias.value = original.displacementBias;
  return material;
}

// The original mesh, geometry, skeleton and morph influences draw both passes.
// No duplicate rig or per-frame model correction is introduced.
export function renderComicScene(renderer, scene, camera) {
  renderer.render(scene, camera);
  if (quality === 'low') return;
  const selected = [], visible = [];
  scene.traverseVisible((node) => {
    if (!node.isMesh && !node.isLine && !node.isPoints && !node.isSprite) return;
    visible.push(node);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (materials.some((m) => eligible(node, m))) selected.push(node);
  });
  const context = contexts.get(renderer);
  const keep = new Set(selected);
  // A removed or hidden node expires on the next render, including map rebuilds.
  if (context) for (const node of context.records.keys()) if (!keep.has(node)) releaseRecord(context, node);
  if (!selected.length) return;
  const cache = getContext(renderer);
  renderer.getSize(cache.viewport);
  const state = { autoClear: renderer.autoClear, shadows: renderer.shadowMap.enabled,
    background: scene.background, update: scene.matrixWorldAutoUpdate, override: scene.overrideMaterial };
  const saved = visible.map((node) => ({ node, visible: node.visible,
    material: node.material, callback: node.onBeforeRender }));
  try {
    for (const { node, material } of saved) {
      if (!keep.has(node)) { node.visible = false; continue; }
      prepareOutlineNormals(node.geometry);
      const current = new Set(Array.isArray(material) ? material : [material]);
      const record = cache.records.get(node);
      if (record) for (const [original, generated] of record.materials) {
        if (!current.has(original)) { generated.dispose(); record.materials.delete(original); }
      }
      const assign = (m) => eligible(node, m) ? outlineMaterial(cache, node, m) : cache.hidden;
      node.material = Array.isArray(material) ? material.map(assign) : assign(material);
      node.onBeforeRender = () => {};
    }
    scene.matrixWorldAutoUpdate = false; scene.background = null; scene.overrideMaterial = null;
    renderer.autoClear = false; renderer.shadowMap.enabled = false;
    renderer.render(scene, camera);
  } finally {
    for (const { node, visible, material, callback } of saved) {
      node.visible = visible; node.material = material; node.onBeforeRender = callback;
    }
    scene.matrixWorldAutoUpdate = state.update; scene.background = state.background;
    scene.overrideMaterial = state.override;
    renderer.autoClear = state.autoClear; renderer.shadowMap.enabled = state.shadows;
  }
}
