import * as THREE from 'three';
import { scene } from './scene.js';

// r155+ physical light units — multiply by Math.PI (directional/ambient) or 4*Math.PI (point)

export const ambientLight = new THREE.AmbientLight(0x8ab4d4, 0.65 * Math.PI);
scene.add(ambientLight);

export const sunLight = new THREE.DirectionalLight(0xffe0a0, 2.0 * Math.PI);
sunLight.position.set(40, 60, 20);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 200;
sunLight.shadow.camera.left = -60;
sunLight.shadow.camera.right = 60;
sunLight.shadow.camera.top = 60;
sunLight.shadow.camera.bottom = -60;
sunLight.shadow.bias = -0.001;
scene.add(sunLight);

export const fillLight = new THREE.DirectionalLight(0x6080a0, 0.4 * Math.PI);
fillLight.position.set(-30, 20, -20);
scene.add(fillLight);

// Populated by mapDef.buildExtras() inside buildLevel() — starts empty.
export const torchLights = [];

export function tickTorches(dt) {
  for (const tl of torchLights) {
    tl.userData.ft += dt * 8;
    tl.intensity =
      tl.userData.base *
      (0.82 + Math.sin(tl.userData.ft) * 0.12 + Math.sin(tl.userData.ft * 2.3) * 0.06);
  }
}
