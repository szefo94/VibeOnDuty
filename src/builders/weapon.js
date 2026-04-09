import * as THREE from 'three';
import { mm } from '../materials.js';
import { scene, camera } from '../scene.js';

const mGun=mm(0x181818,0.3,0.85),mGun2=mm(0x221810,0.6,0.2),mGunW=mm(0x2a1a0a,0.5,0.05);
export const wpn=new THREE.Group();camera.add(wpn);
const aw=(g,mat,x,y,z)=>{const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);wpn.add(m);return m;};
aw(new THREE.BoxGeometry(0.055,0.064,0.38),mGun,0,0,0);
const brl=new THREE.Mesh(new THREE.CylinderGeometry(0.009,0.009,0.36,8),mGun);brl.rotation.x=Math.PI/2;brl.position.set(0,0.012,-0.33);wpn.add(brl);
aw(new THREE.BoxGeometry(0.044,0.05,0.18),mGun2,0,0.004,-0.15);
aw(new THREE.BoxGeometry(0.044,0.055,0.11),mGunW,0,-0.008,0.22);
aw(new THREE.BoxGeometry(0.034,0.092,0.037),mGun2,0,-0.074,0.06);
aw(new THREE.BoxGeometry(0.027,0.058,0.036),mGun2,0,-0.06,-0.04);
const mzDv=new THREE.Mesh(new THREE.CylinderGeometry(0.013,0.013,0.04,8),mGun);mzDv.rotation.x=Math.PI/2;mzDv.position.set(0,0.012,-0.51);wpn.add(mzDv);
wpn.position.set(0.11,-0.105,-0.20);
export const flashMat=new THREE.MeshBasicMaterial({color:0xffdd55,transparent:true,opacity:0});
export const flash=new THREE.Mesh(new THREE.SphereGeometry(0.042,6,6),flashMat);flash.position.set(0,0.012,-0.54);wpn.add(flash);
export const muzzleLight=new THREE.PointLight(0xffaa22,0,4);scene.add(muzzleLight);
