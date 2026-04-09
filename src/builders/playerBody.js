import * as THREE from 'three';
import { mm } from '../materials.js';
import { scene } from '../scene.js';

export const playerBody=new THREE.Group();
const pbMat=mm(0x2255aa,0.7,0.1);
const pbMat2=mm(0x3377cc,0.6,0.15);
function pbPart(geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;playerBody.add(m);}
pbPart(new THREE.CylinderGeometry(0.12,0.14,0.7,8),pbMat,-0.12,0.35,0);
pbPart(new THREE.CylinderGeometry(0.12,0.14,0.7,8),pbMat, 0.12,0.35,0);
pbPart(new THREE.CylinderGeometry(0.22,0.18,0.7,10),pbMat2,0,0.9,0);
pbPart(new THREE.SphereGeometry(0.18,8,8),pbMat2,0,1.42,0);
playerBody.visible=false;
scene.add(playerBody);
