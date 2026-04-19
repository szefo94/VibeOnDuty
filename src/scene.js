import * as THREE from 'three';
import { CELL, PLAYER_H } from './config.js';

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0x7ca8c8);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ca8c8);
scene.fog = new THREE.FogExp2(0xc8b89a, 0.016);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 120);
camera.position.set(11.5 * CELL, PLAYER_H, 6.5 * CELL); // interior ground, north half
scene.add(camera);
const hudCanvas = document.getElementById('hudCanvas');
const hudCtx = hudCanvas.getContext('2d');
function rsz() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  hudCanvas.width = innerWidth;
  hudCanvas.height = innerHeight;
}
rsz();
window.addEventListener('resize', rsz);

export { renderer, scene, camera, hudCanvas, hudCtx, rsz };
