import * as THREE from 'three';
import { scene } from '../scene.js';
import { TRACER_LIFE } from '../config.js';

const tracers=[];
const trEM=new THREE.LineBasicMaterial({color:0xff5500,transparent:true,opacity:1});

export function spawnTracer(a,b){
  const g=new THREE.BufferGeometry().setFromPoints([a.clone(),b.clone()]);
  const l=new THREE.Line(g,trEM.clone());scene.add(l);tracers.push({l,life:TRACER_LIFE});
}

export function tickTracers(dt){
  for(let i=tracers.length-1;i>=0;i--){
    const t=tracers[i];t.life-=dt;t.l.material.opacity=Math.max(0,t.life/TRACER_LIFE*0.8);
    if(t.life<=0){scene.remove(t.l);t.l.geometry.dispose();tracers.splice(i,1);}
  }
}
