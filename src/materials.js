import * as THREE from 'three';

const mm=(c,r=0.85,m=0.05)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const matFloor=mm(0xc4a96a,0.96,0.0),matWall=mm(0x8a7660,0.92,0.02),matWallD=mm(0x6e5e4e,0.94,0.01);
const matWallT=mm(0xa08870,0.88,0.03),matCrack=mm(0x9a8868,0.96,0.0);
const matTrim=mm(0xb8a882,0.80,0.04),matRamp=mm(0xb0956a,0.90,0.01);

export { mm, matFloor, matWall, matWallD, matWallT, matCrack, matTrim, matRamp };
