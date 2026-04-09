import * as THREE from 'three';
import { scene } from '../scene.js';
import { GRENADE_RADIUS } from '../config.js';

const grenParticles=[];
export const grenImpactZones=[];

export function spawnGrenadeParticles(pos){
  for(let i=0;i<32;i++){
    let m=grenParticles.find(p=>!p.active);
    if(!m){m={mesh:new THREE.Mesh(new THREE.SphereGeometry(0.06,4,4),new THREE.MeshBasicMaterial({transparent:true})),active:false,vel:new THREE.Vector3(),life:0};scene.add(m.mesh);grenParticles.push(m);}
    m.active=true;m.life=0.5+Math.random()*0.6;m.mesh.visible=true;m.mesh.position.copy(pos);
    const spd=4+Math.random()*8;
    m.vel.set((Math.random()-0.5)*spd,(Math.random()*0.5+0.3)*spd,(Math.random()-0.5)*spd);
    m.mesh.material.color.set(Math.random()>0.4?0xff6600:0xffcc00);m.mesh.material.opacity=1;
  }
  grenImpactZones.push({pos:pos.clone(),radius:GRENADE_RADIUS,life:2.5,maxLife:2.5});
}

export function tickGrenadeParticles(dt){
  for(const p of grenParticles){
    if(!p.active)continue;p.life-=dt;
    if(p.life<=0){p.active=false;p.mesh.visible=false;continue;}
    p.vel.y-=14*dt;p.mesh.position.addScaledVector(p.vel,dt);
    p.mesh.material.opacity=p.life*1.4;p.mesh.scale.setScalar(Math.max(0.05,p.life*0.7));
  }
  for(let i=grenImpactZones.length-1;i>=0;i--){
    const z=grenImpactZones[i];z.life-=dt;if(z.life<=0){grenImpactZones.splice(i,1);}
  }
}
