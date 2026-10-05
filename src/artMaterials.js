import * as THREE from 'three';

// Shared source image, fixed regions and persistent map ownership. Actors own materials only.
const REGIONS = Object.freeze({
  metal: [0, 0, 0.5, 0.5],
  polymer: [0.5, 0, 0.5, 0.5],
  stoneWall: [0, 0.5, 0.5, 0.5],
  stoneFloor: [0.5, 0.5, 0.5, 0.5],
});
const FALLBACK = { metal: 0x4a5254, polymer: 0x3d453b, stoneWall: 0xada387, stoneFloor: 0x7d7a69 };
const textures = new Map();
const materials = new Set();
let atlas = null;
let state = 'idle';

function atlasRegion(region) {
  // Map definitions are also consumed by DOM-free navigation/world tests. Their
  // surface metadata needs materials, while image IO belongs to the browser.
  if (typeof document === 'undefined') {
    state = 'nonbrowser';
    return null;
  }
  if (!atlas) {
    state = 'loading';
    atlas = new THREE.TextureLoader().load(
      import.meta.env.BASE_URL + 'textures/comic-slice.png',
      () => {
        state = 'ready';
        for (const texture of textures.values()) texture.needsUpdate = true;
        for (const material of materials) {
          material.color.set(0xffffff);
          material.userData.baseAppearance.color = 0xffffff;
          material.userData.paintState = state;
          material.needsUpdate = true;
        }
        materials.clear();
      },
      undefined,
      () => {
        state = 'failed';
        for (const material of materials) {
          material.map = null;
          material.userData.paintState = state;
          material.needsUpdate = true;
        }
        materials.clear();
      }
    );
    atlas.colorSpace = THREE.SRGBColorSpace;
  }
  if (!textures.has(region)) {
    const [u, v, w, h] = REGIONS[region];
    const texture = atlas.clone();
    texture.name = 'comic-slice:' + region;
    texture.colorSpace = THREE.SRGBColorSpace;
    // Two-pixel gutter prevents adjacent atlas domains bleeding under minification.
    texture.offset.set(u + 2 / 1024, v + 2 / 1024);
    texture.repeat.set(w - 4 / 1024, h - 4 / 1024);
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.userData.artSharedTexture = true;
    if (state === 'ready') texture.needsUpdate = true;
    textures.set(region, texture);
  }
  return textures.get(region);
}

export function makeIllustratedMaterial(region, options = {}) {
  if (!Object.hasOwn(REGIONS, region)) throw new Error('Unknown illustrated atlas region');
  const map = atlasRegion(region);
  const domain = region.startsWith('stone') ? 'stone' : 'weapon';
  const material = new THREE.MeshStandardMaterial({
    color: state === 'ready' ? 0xffffff : FALLBACK[region],
    roughness: options.roughness ?? 0.82,
    metalness: options.metalness ?? (region === 'metal' ? 0.35 : 0.02),
    map: state === 'failed' ? null : map,
  });
  material.name = 'Illustrated:' + region;
  material.userData = {
    artDomain: domain,
    atlasRegion: region,
    paintState: state,
    artContour: options.contour ?? domain === 'weapon',
    baseAppearance: { color: state === 'ready' ? 0xffffff : FALLBACK[region], roughness: material.roughness, metalness: material.metalness },
    artSharedTexture: true,
  };
  if (state === 'loading') {
    materials.add(material);
    material.addEventListener('dispose', () => materials.delete(material));
  }
  if (region === 'stoneFloor') {
    // The existing ground plane spans the whole map. Repeat a four-metre paint
    // patch in world space instead of stretching three stones across 112 metres.
    // Standard lighting/normals remain intact; only the atlas lookup changes.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = 'varying vec3 vArtFloorWorld;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvArtFloorWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = 'varying vec3 vArtFloorWorld;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
        THREE.ShaderChunk.map_fragment.replace('vMapUv',
          '(vec2(0.501953125) + fract(vArtFloorWorld.xz / 4.0) * vec2(0.49609375))'));
    };
    material.customProgramCacheKey = () => 'illustrated-stone-floor-v1';
  }
  return material;
}

export function illustratedClone(base, region, options = {}) {
  const painted = makeIllustratedMaterial(region, options);
  // Retain the original slot's surface behavior while changing only appearance.
  painted.side = base.side;
  painted.transparent = base.transparent;
  painted.opacity = base.opacity;
  return painted;
}
