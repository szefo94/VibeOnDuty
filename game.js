import * as THREE from 'three';
import { CELL, PLAYER_H, PLAYER_H_CROUCH, MOVE_SPEED, SPRINT_MULT, MOUSE_SENS,
  MAX_HP, MAX_AMMO, RESERVE_AMMO, RELOAD_MS, SHOOT_CD, ENEMY_HP, ENEMY_SPEED, ENEMY_ROT_SPD,
  ENEMY_SIGHT, ENEMY_SHOOT_RANGE, ENEMY_SHOOT_CD, ENEMY_DAMAGE, BULLET_DAMAGE,
  REACT_MIN, REACT_MAX, AIM_THRESH, TRACER_LIFE, HP_SEGS, GRAVITY, JUMP_FORCE,
  HEAD_BOB_PITCH, SLIDE_SPEED, SLIDE_DUR, SLIDE_CANCEL_JUMP, ENERGY_PER_DMG,
  MAX_ENERGY, GRENADE_ENERGY_COST, GRENADE_RADIUS, GRENADE_PEAK_DMG } from './src/config.js';
import { MAP_W, MAP_H, MAP, isRamp, isCrack,
  mapCell, hAt, groundElevation, canMoveTo } from './src/map.js';
import { normA, slerp } from './src/math.js';
import { astar } from './src/astar.js';
import { grenadeFalloff, grenadeEntityDamage, grenadePlayerDamage } from './src/combat/damage.js';
import { renderer, scene, camera, hudCanvas, hudCtx } from './src/scene.js';
import { mm } from './src/materials.js';
import { tickTorches } from './src/lighting.js';
import { wallMeshes, debugLines } from './src/level.js';
import { wpn, flash, flashMat, muzzleLight } from './src/builders/weapon.js';
import { playerBody } from './src/builders/playerBody.js';
import { buildEnemy } from './src/builders/enemy.js';
import { buildDrone } from './src/builders/drone.js';

const visited=Array.from({length:MAP_H},()=>new Uint8Array(MAP_W));

let debugVisible=false;
let thirdPerson=false;
const TP_DIST=4.5, TP_HEIGHT=2.2;

// ═══════════════════ ENEMY + DRONE DATA ════════════
const WALKABLE_CELLS=[];
for(let r=1;r<MAP_H-1;r++)for(let c=1;c<MAP_W-1;c++)if(MAP[r][c]===0||isRamp(MAP[r][c]))WALKABLE_CELLS.push([c,r]);

function randomSpawnCell(usedCells){
  const cands=WALKABLE_CELLS.filter(([c,r])=>{
    if(Math.abs(c-1)+Math.abs(r-1)<5)return false;
    for(const[uc,ur] of usedCells)if(Math.abs(c-uc)+Math.abs(r-ur)<3)return false;
    return true;
  });
  return cands.length?cands[Math.floor(Math.random()*cands.length)]:WALKABLE_CELLS[Math.floor(Math.random()*WALKABLE_CELLS.length)];
}
function randomPatrol(sc,sr,rad=2){
  return [0,Math.PI/2,Math.PI,Math.PI*1.5].map(a=>{
    let bc=Math.round(sc+Math.cos(a)*rad),br=Math.round(sr+Math.sin(a)*rad);
    bc=Math.max(1,Math.min(MAP_W-2,bc));br=Math.max(1,Math.min(MAP_H-2,br));
    return MAP[br][bc]===0?[bc,br]:[sc,sr];
  });
}
const WP_WAITS=[600,1200,500,900,1000,500];
const NUM_ENEMIES=10;
let wave=1,respawnTimer=-1;

function spawnEnemyIntoSlot(e){
  if(e.mesh)scene.remove(e.mesh);
  const used=enemies.filter(en=>en!==e&&!en.dead).map(en=>[Math.floor(en.x/CELL),Math.floor(en.z/CELL)]);
  const[mc,mr]=randomSpawnCell(used);
  const patrol=randomPatrol(mc,mr,2);
  const{mesh,muzzleFlash,animT}=buildEnemy(mc*CELL+CELL/2,mr*CELL+CELL/2);
  Object.assign(e,{mesh,muzzleFlash,animT,x:mc*CELL+CELL/2,z:mr*CELL+CELL/2,
    hp:ENEMY_HP,maxHp:ENEMY_HP,hpDrain:ENEMY_HP,state:'patrol',facingY:Math.random()*Math.PI*2,
    alertTimer:0,reactDelay:0,shootCd:0,path:[],pathTick:0,patrolWp:0,
    patrol:patrol.map(([c,r])=>[c*CELL+CELL/2,r*CELL+CELL/2]),
    wpWait:0,bobT:Math.random()*6,dead:false,muzzleFlashT:0,radarAge:Infinity,
    crouching:false,crouchTimer:0,velY:0,onGround:true,jumpCd:0});
}

const usedCells=[];
const enemies=Array.from({length:NUM_ENEMIES},(_,i)=>{
  const[mc,mr]=randomSpawnCell(usedCells);usedCells.push([mc,mr]);
  const patrol=randomPatrol(mc,mr,2);
  const{mesh,muzzleFlash,animT}=buildEnemy(mc*CELL+CELL/2,mr*CELL+CELL/2);
  return{mesh,muzzleFlash,animT,x:mc*CELL+CELL/2,z:mr*CELL+CELL/2,
    hp:ENEMY_HP,maxHp:ENEMY_HP,hpDrain:ENEMY_HP,state:'patrol',facingY:Math.random()*Math.PI*2,
    alertTimer:0,reactDelay:0,shootCd:0,path:[],pathTick:0,patrolWp:0,
    patrol:patrol.map(([c,r])=>[c*CELL+CELL/2,r*CELL+CELL/2]),
    wpWait:0,bobT:Math.random()*6,dead:false,muzzleFlashT:0,radarAge:Infinity,
    crouching:false,crouchTimer:0,velY:0,onGround:true,jumpCd:0};
});

// One drone at a time — aiming practice
const DRONE_FLY_H=4.5;
const dronePool=[];
let activeDrone=null;
function spawnNewDrone(){
  const[mc,mr]=randomSpawnCell([]);
  const d=buildDrone(mc*CELL+CELL/2,DRONE_FLY_H,mr*CELL+CELL/2);
  dronePool.push(d);activeDrone=d;
  // Register drone meshes for raycasting
  d.mesh.traverse(ch=>{if(ch.isMesh)ch.userData.droneRef=d;});
  rebuildEHM();
  return d;
}

// ═══════════════════ RAYCASTERS ════════════════════
const _euler=new THREE.Euler(0,0,0,'YXZ');
const _rc=new THREE.Raycaster(),_los=new THREE.Raycaster();
const _tv=new THREE.Vector3(),_tv2=new THREE.Vector3();
function hasLOS(ax,ay,az,bx,by,bz){
  _tv.set(ax,ay,az);_tv2.set(bx-ax,by-ay,bz-az);const d=_tv2.length();_tv2.normalize();
  _los.set(_tv,_tv2);_los.far=d-0.14;return _los.intersectObjects(wallMeshes,false).length===0;
}

// ═══════════════════ PLAYER STATE ══════════════════
const player={
  hp:MAX_HP,ammo:MAX_AMMO,reserve:RESERVE_AMMO,kills:0,
  reloading:false,reloadTimer:0,shootCd:0,dead:false,yaw:0,pitch:0,
  lastHitTime:0,velY:0,onGround:true,bobPitch:0,
  crouching:false,sliding:false,slideVel:null,slideTimer:0,slideCancelAvail:false,
  energy:0, airVelX:0, airVelZ:0,
};

// ═══════════════════ INPUT ═════════════════════════
const keys={};
let locked=false,gameRunning=false,mouseHeld=false;
document.addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='KeyR'&&gameRunning&&!player.reloading&&player.ammo<MAX_AMMO&&player.reserve>0)startReload();
  if(e.code==='F3'){debugVisible=!debugVisible;if(debugLines)debugLines.visible=debugVisible;}
  if(e.code==='F4'){thirdPerson=!thirdPerson;wpn.visible=!thirdPerson;playerBody.visible=thirdPerson;showStatus(thirdPerson?'3RD PERSON':'1ST PERSON');}
  if(['Space','Tab','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();
});
document.addEventListener('keyup',e=>keys[e.code]=false);
document.addEventListener('mousemove',e=>{
  if(!locked||!gameRunning||player.dead)return;
  player.yaw-=e.movementX*MOUSE_SENS;
  player.pitch=Math.max(-1.38,Math.min(1.38,player.pitch-e.movementY*MOUSE_SENS));
  _euler.set(player.pitch,player.yaw,0);camera.quaternion.setFromEuler(_euler);
});
document.addEventListener('mousedown',e=>{
  if(e.button===0){
    if(!locked&&gameRunning){document.getElementById('c').requestPointerLock();return;}
    mouseHeld=true;if(locked&&gameRunning)tryShoot();
  }
  if(e.button===2&&locked&&gameRunning)tryThrowGrenade();
});
document.addEventListener('mouseup',e=>{if(e.button===0)mouseHeld=false;});
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('pointerlockchange',()=>locked=document.pointerLockElement===document.getElementById('c'));

// ═══════════════════ TRACERS ═══════════════════════
const tracers=[];
const trPM=new THREE.LineBasicMaterial({color:0xffee55,transparent:true,opacity:1});
const trEM=new THREE.LineBasicMaterial({color:0xff5500,transparent:true,opacity:1});
function spawnTracer(a,b,enemy=false){
  const g=new THREE.BufferGeometry().setFromPoints([a.clone(),b.clone()]);
  const l=new THREE.Line(g,enemy?trEM.clone():trPM.clone());scene.add(l);tracers.push({l,life:TRACER_LIFE,enemy});
}
function tickTracers(dt){
  for(let i=tracers.length-1;i>=0;i--){
    const t=tracers[i];t.life-=dt;t.l.material.opacity=Math.max(0,t.life/TRACER_LIFE*(t.enemy?0.8:0.95));
    if(t.life<=0){scene.remove(t.l);t.l.geometry.dispose();tracers.splice(i,1);}
  }
}

// ═══════════════════ IMPACTS ═══════════════════════
const impPool=[],impMat=new THREE.MeshBasicMaterial({color:0xffcc33});
function spawnImpact(pos){
  let m=impPool.find(p=>!p.visible);
  if(!m){m=new THREE.Mesh(new THREE.SphereGeometry(0.04,4,4),impMat);scene.add(m);impPool.push(m);}
  m.position.copy(pos);m.visible=true;m.userData.life=0.09;
}
function tickImpacts(dt){impPool.forEach(m=>{if(!m.visible)return;m.userData.life-=dt;if(m.userData.life<=0)m.visible=false;});}

// ═══════════════════ GRENADE PARTICLES + IMPACT ZONE ════════════
const grenParticles=[];
const grenImpactZones=[]; // {pos, radius, life, maxLife}

function spawnGrenadeParticles(pos){
  for(let i=0;i<32;i++){
    let m=grenParticles.find(p=>!p.active);
    if(!m){m={mesh:new THREE.Mesh(new THREE.SphereGeometry(0.06,4,4),new THREE.MeshBasicMaterial({transparent:true})),active:false,vel:new THREE.Vector3(),life:0};scene.add(m.mesh);grenParticles.push(m);}
    m.active=true;m.life=0.5+Math.random()*0.6;m.mesh.visible=true;m.mesh.position.copy(pos);
    const spd=4+Math.random()*8;
    m.vel.set((Math.random()-0.5)*spd,(Math.random()*0.5+0.3)*spd,(Math.random()-0.5)*spd);
    m.mesh.material.color.set(Math.random()>0.4?0xff6600:0xffcc00);m.mesh.material.opacity=1;
  }
  // Impact zone ring
  grenImpactZones.push({pos:pos.clone(),radius:GRENADE_RADIUS,life:2.5,maxLife:2.5});
}

function tickGrenadeParticles(dt){
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

// ═══════════════════ ENEMY HIT MESHES + DRONE ══════
let ehm=[];
function rebuildEHM(){
  ehm=[];
  enemies.forEach(e=>{if(!e.dead)e.mesh.traverse(c=>{if(c.isMesh)ehm.push(c);});});
  dronePool.forEach(d=>{if(!d.dead)d.mesh.traverse(c=>{if(c.isMesh&&!c.userData.isRotor)ehm.push(c);});});
}

// ═══════════════════ AMMO DROPS ════════════════════
const ammoDrops=[];
const ammoBoxMat=new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:0.4,metalness:0.7,emissive:0x002200,emissiveIntensity:0.3});
const ammoStripMat=new THREE.MeshStandardMaterial({color:0xddaa00,roughness:0.3,metalness:0.2,emissive:0x443300,emissiveIntensity:1.2});
const ammoGlowMat=new THREE.MeshBasicMaterial({color:0x88ff44,transparent:true,opacity:0.22});
const ammoPointLight=new THREE.PointLight(0x88ff44,0,0);scene.add(ammoPointLight);

function spawnAmmoDrop(wx,wz){
  const g=new THREE.Group();
  const crate=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.38,0.38),ammoBoxMat);g.add(crate);
  const s1=new THREE.Mesh(new THREE.BoxGeometry(0.56,0.06,0.06),ammoStripMat);s1.position.set(0,0.1,0.19);g.add(s1);
  const s2=new THREE.Mesh(new THREE.BoxGeometry(0.56,0.06,0.06),ammoStripMat);s2.position.set(0,0.1,-0.19);g.add(s2);
  const halo=new THREE.Mesh(new THREE.SphereGeometry(0.42,8,8),ammoGlowMat);g.add(halo);
  const eGround=hAt(Math.floor(wx/CELL),Math.floor(wz/CELL)); // discrete, no blending
  g.position.set(wx,eGround+0.19,wz);scene.add(g);
  ammoDrops.push({mesh:g,x:wx,z:wz,bobT:Math.random()*Math.PI*2,collected:false,baseY:eGround});
}

function tickAmmoDrops(dt){
  for(const d of ammoDrops){
    if(d.collected)continue;
    d.bobT+=dt*1.8;
    d.mesh.position.y=d.baseY+0.19+Math.sin(d.bobT)*0.12;
    d.mesh.rotation.y+=dt*1.2;
    const dx=camera.position.x-d.x,dz=camera.position.z-d.z;
    if(Math.sqrt(dx*dx+dz*dz)<1.4){
      d.collected=true;scene.remove(d.mesh);
      const gained=15+Math.floor(Math.random()*31);
      player.reserve=Math.min(RESERVE_AMMO+30,player.reserve+gained);
      updateHUD();showMsg(`+${gained} AMMO`);
    }
  }
  if(ammoDrops.some(d=>!d.collected)){
    const nd=ammoDrops.find(d=>!d.collected);
    if(nd){ammoPointLight.position.set(nd.x,nd.baseY+0.5,nd.z);ammoPointLight.intensity=1.4*4*Math.PI;ammoPointLight.distance=8;}
  }else ammoPointLight.intensity=0;
  for(let i=ammoDrops.length-1;i>=0;i--)if(ammoDrops[i].collected)ammoDrops.splice(i,1);
}

// ═══════════════════ GRENADES ══════════════════════
const grenades=[];
const grenMat=mm(0x2a4a1a,0.6,0.4),grenPinMat=mm(0xcccc44,0.3,0.8);

function tryThrowGrenade(){
  if(player.dead||player.energy<GRENADE_ENERGY_COST)return;
  player.energy=0;document.getElementById('energy-label').textContent='ENERGY: 0%';
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);dir.y+=0.18;dir.normalize();
  const g=new THREE.Group();
  g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.14,8),grenMat),{castShadow:true}));
  const pin=new THREE.Mesh(new THREE.TorusGeometry(0.04,0.008,4,8),grenPinMat);pin.position.y=0.08;g.add(pin);
  g.position.copy(camera.position).addScaledVector(dir,0.5);scene.add(g);
  grenades.push({mesh:g,vel:dir.clone().multiplyScalar(12),life:2.2,exploded:false});
  showStatus('GRENADE!');
}

function tickGrenades(dt){
  for(let i=grenades.length-1;i>=0;i--){
    const g=grenades[i];if(g.exploded){grenades.splice(i,1);continue;}
    g.vel.y-=12*dt;g.mesh.position.addScaledVector(g.vel,dt);g.mesh.rotation.x+=dt*5;g.mesh.rotation.z+=dt*3;
    const eGround=hAt(Math.floor(g.mesh.position.x/CELL),Math.floor(g.mesh.position.z/CELL));
    if(g.mesh.position.y<eGround+0.07){g.mesh.position.y=eGround+0.07;g.vel.y*=-0.38;g.vel.x*=0.75;g.vel.z*=0.75;}
    g.life-=dt;if(g.life<=0)explodeGrenade(g);
  }
}

function explodeGrenade(g){
  g.exploded=true;const ep=g.mesh.position.clone();scene.remove(g.mesh);
  const el=new THREE.PointLight(0xff8833,10*4*Math.PI,14);el.position.copy(ep);scene.add(el);setTimeout(()=>scene.remove(el),200);
  spawnGrenadeParticles(ep);
  for(const e of enemies){
    if(e.dead)continue;
    const dist=ep.distanceTo(new THREE.Vector3(e.x,groundElevation(e.x,e.z)+0.9,e.z));
    const dmg=grenadeEntityDamage(dist,e.maxHp);
    if(dmg>0){e.hp=Math.max(0,e.hp-dmg);e.hpDrain=e.hp;player.energy=Math.min(MAX_ENERGY,player.energy+dmg*ENERGY_PER_DMG*0.5);e.state='attack';e.alertTimer=9000;e.reactDelay=0;if(e.hp<=0)killEnemy(e);}
  }
  // Drone blast
  if(activeDrone&&!activeDrone.dead){
    const dist=ep.distanceTo(new THREE.Vector3(activeDrone.x,activeDrone.y,activeDrone.z));
    const fo=grenadeFalloff(dist);if(fo>0)killDrone(activeDrone,Math.floor(activeDrone.maxHp*2*fo));
  }
  const pDist=ep.distanceTo(camera.position);
  const pDmg=grenadePlayerDamage(pDist,MAX_HP);
  if(pDmg>0){player.hp=Math.max(1,player.hp-pDmg);triggerHitFlash();updateHUD();if(player.hp<=0)triggerDeath();}
}

// ═══════════════════ SHOOT ═════════════════════════
let muzzleT=0,bobT=0,recoilT=0;
let sprayHeat=0;const MAX_SPRAY=0.055,SPRAY_GROW=0.08,SPRAY_COOL=0.5;let lastShotTime=0;

function tryShoot(){
  if(player.dead||player.reloading)return;
  if(player.ammo<=0){startReload();return;}
  const now=performance.now();if(now-player.shootCd<SHOOT_CD)return;
  player.shootCd=now;player.ammo--;updateHUD();muzzleT=62;recoilT=1;
  sprayHeat=Math.min(1,sprayHeat+SPRAY_GROW);lastShotTime=now;
  const baseDir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const ca=sprayHeat*MAX_SPRAY;
  const dir=baseDir.clone().addScaledVector(right,(Math.random()-0.5)*2*ca).addScaledVector(up,(Math.random()-0.5)*2*ca).normalize();
  _rc.set(camera.position,dir);_rc.far=52;
  const wHits=_rc.intersectObjects(wallMeshes,false);
  const wDist=wHits.length?wHits[0].distance:Infinity;
  if(wHits.length)spawnImpact(wHits[0].point);
  const eHits=_rc.intersectObjects(ehm,false);
  let hitE=null,hitD=Infinity,hitPt=null,hitDrone=null;
  for(const h of eHits){
    if(h.distance<wDist&&h.distance<hitD){
      // Check if drone
      const dr=h.object.userData.droneRef;
      if(dr&&!dr.dead){hitDrone=dr;hitD=h.distance;hitPt=h.point;hitE=null;continue;}
      const grp=h.object.userData.enemyGroup;
      const e=enemies.find(en=>!en.dead&&en.mesh===grp);
      if(e){hitE=e;hitD=h.distance;hitPt=h.point;hitDrone=null;}
    }
  }
  const bw=new THREE.Vector3(0,0.012,-0.54).applyMatrix4(wpn.matrixWorld);
  const te=hitPt||(wHits.length?wHits[0].point:camera.position.clone().addScaledVector(dir,52));
  spawnTracer(bw,te,false);
  if(hitE){
    const dmg=BULLET_DAMAGE+Math.floor(Math.random()*10);
    hitE.hp=Math.max(0,hitE.hp-dmg);hitE.state='attack';hitE.alertTimer=9000;hitE.reactDelay=0;
    player.energy=Math.min(MAX_ENERGY,player.energy+dmg*ENERGY_PER_DMG);
    spawnHitMarker();if(hitE.hp<=0)killEnemy(hitE);
  }
  if(hitDrone){
    const dmg=BULLET_DAMAGE+Math.floor(Math.random()*10);
    player.energy=Math.min(MAX_ENERGY,player.energy+dmg*ENERGY_PER_DMG);
    spawnHitMarker();killDrone(hitDrone,dmg);
  }
  if(player.ammo===0)startReload();
}

function killDrone(d,dmg){
  d.hp-=dmg;if(d.hp>0)return;
  d.dead=true;scene.remove(d.mesh);activeDrone=null;
  player.kills++;document.getElementById('kills-num').textContent=player.kills;
  showMsg('DRONE DOWN — NEW DRONE INCOMING',2000);
  spawnAmmoDrop(d.x,d.z);
  rebuildEHM();
  setTimeout(()=>{if(gameRunning)spawnNewDrone();},3000);
}

function killEnemy(e){
  e.dead=true;scene.remove(e.mesh);
  player.kills++;document.getElementById('kills-num').textContent=player.kills;
  showMsg('ENEMY DOWN');rebuildEHM();spawnAmmoDrop(e.x,e.z);
  if(enemies.every(en=>en.dead)){wave++;showMsg(`ZONE CLEARED — WAVE ${wave-1} COMPLETE`,3500);respawnTimer=5000;}
}

// ═══════════════════ DRONE UPDATE ══════════════════
function updateDrone(d,dt){
  if(d.dead)return;
  d.floatT+=dt*0.8;
  // Hover toward player XZ slowly
  const pdx=camera.position.x-d.x, pdz=camera.position.z-d.z;
  const dist=Math.sqrt(pdx*pdx+pdz*pdz);
  const targetDist=8;
  if(dist>targetDist+1){d.velX+=(pdx/dist)*0.5*dt;d.velZ+=(pdz/dist)*0.5*dt;}
  else if(dist<targetDist-1){d.velX-=(pdx/dist)*0.3*dt;d.velZ-=(pdz/dist)*0.3*dt;}
  d.velX*=1-dt*1.5;d.velZ*=1-dt*1.5;
  d.x+=d.velX;d.z+=d.velZ;
  // Clamp inside map
  d.x=Math.max(CELL,Math.min((MAP_W-1)*CELL,d.x));d.z=Math.max(CELL,Math.min((MAP_H-1)*CELL,d.z));
  d.y=DRONE_FLY_H+Math.sin(d.floatT)*0.4;
  d.mesh.position.set(d.x,d.y,d.z);
  // Rotate body toward player
  d.mesh.rotation.y=Math.atan2(pdx,pdz);
  // Spin rotors
  d.mesh.children.forEach(ch=>{if(ch.userData.isRotor)ch.rotation.y+=dt*18;});
  // Aim cone toward player
  const coneDir=new THREE.Vector3(pdx,camera.position.y-d.y,pdz).normalize();
  d.cone.lookAt(d.cone.position.clone().add(coneDir));
  // Pulse cone opacity
  d.cone.material.opacity=0.08+Math.abs(Math.sin(d.floatT*2))*0.07;
  // Eye flicker
  d.eye.material.color.setHSL(0.55+Math.sin(d.floatT*3)*0.05,1,0.6+Math.sin(d.floatT*5)*0.2);
}

// ═══════════════════ ENEMY AI ══════════════════════
function animateEnemyLegs(e,dt,moving){
  const spd=moving?(e.state==='attack'?5:2.5):0;e.animT+=dt*spd;
  const kids=e.mesh.children;const sw=Math.sin(e.animT)*0.35;
  if(kids[2])kids[2].rotation.x=sw;if(kids[3])kids[3].rotation.x=-sw;
  if(kids[6])kids[6].rotation.x=-sw*0.6;if(kids[7])kids[7].rotation.x=sw*0.6;
  if(kids[12])kids[12].rotation.x=-sw*0.5;if(kids[13])kids[13].rotation.x=sw*0.5;
}

function updateEnemies(ts,dt){
  for(const e of enemies){
    if(e.dead)continue;
    const pdx=camera.position.x-e.x,pdz=camera.position.z-e.z;
    const distP=Math.sqrt(pdx*pdx+pdz*pdz);
    // Use discrete cell height (not bilinear blend) to prevent sinking at slab edges
    const eGround=hAt(Math.floor(e.x/CELL),Math.floor(e.z/CELL));
    const canSee=distP<ENEMY_SIGHT&&hasLOS(e.x,eGround+PLAYER_H*0.9,e.z,camera.position.x,camera.position.y,camera.position.z);
    if(canSee){if(e.state==='patrol'){e.state='spotted';e.reactDelay=REACT_MIN+Math.random()*(REACT_MAX-REACT_MIN);}else e.state='attack';e.alertTimer=9000;}
    if(e.state!=='patrol'&&!canSee){e.alertTimer=Math.max(0,e.alertTimer-dt*1000);if(e.alertTimer<=0)e.state='patrol';}
    if(e.state==='spotted'){e.reactDelay=Math.max(0,e.reactDelay-dt*1000);if(e.reactDelay<=0)e.state='attack';}
    const desiredY=Math.atan2(-pdx,-pdz);let isMoving=false;
    if(e.state==='attack'||e.state==='spotted'){
      if(e.path.length===0||e.pathTick<=0){e.path=astar(e.x,e.z,camera.position.x,camera.position.z);if(e.path.length>0)e.path.shift();e.pathTick=600+Math.random()*200;}
      e.pathTick-=dt*1000;
      if(e.path.length>0&&distP>CELL*1.4){
        const[tx,tz]=e.path[0];const ddx=tx-e.x,ddz=tz-e.z,dd=Math.sqrt(ddx*ddx+ddz*ddz);
        if(dd<0.18)e.path.shift();
        else{
          const spd2=ENEMY_SPEED*dt*(e.state==='spotted'?0.55:1);
          const nx=e.x+(ddx/dd)*spd2,nz=e.z+(ddz/dd)*spd2;
          if(canMoveTo(nx,e.z,eGround))e.x=nx;if(canMoveTo(e.x,nz,eGround))e.z=nz;
          isMoving=true;
        }
      }
      e.facingY=slerp(e.facingY,desiredY,ENEMY_ROT_SPD,dt);
      if(e.state==='attack'&&distP<ENEMY_SHOOT_RANGE&&canSee&&Math.abs(normA(e.facingY-desiredY))<AIM_THRESH){
        if(ts-e.shootCd>ENEMY_SHOOT_CD){e.shootCd=ts;
          if(hasLOS(e.x,eGround+PLAYER_H*0.85,e.z,camera.position.x,camera.position.y,camera.position.z)){
            player.hp=Math.max(0,player.hp-ENEMY_DAMAGE-Math.floor(Math.random()*7));
            triggerHitFlash();updateHUD();if(player.hp<=0)triggerDeath();
            e.muzzleFlashT=55;spawnTracer(new THREE.Vector3(0.295,1.190,-0.52).applyMatrix4(e.mesh.matrixWorld),camera.position.clone(),true);
          }
        }
      }
    } else {
      if(e.wpWait>0){e.wpWait=Math.max(0,e.wpWait-dt*1000);e.facingY+=dt*0.55*Math.sin(performance.now()/820+e.bobT);}
      else{
        const wp=e.patrol[e.patrolWp];const ddx=wp[0]-e.x,ddz=wp[1]-e.z,dd=Math.sqrt(ddx*ddx+ddz*ddz);
        if(dd<0.22){e.patrolWp=(e.patrolWp+1)%e.patrol.length;e.wpWait=WP_WAITS[e.patrolWp%WP_WAITS.length];}
        else{
          const spd2=ENEMY_SPEED*0.42*dt;const nx=e.x+(ddx/dd)*spd2,nz=e.z+(ddz/dd)*spd2;
          if(canMoveTo(nx,e.z,eGround))e.x=nx;if(canMoveTo(e.x,nz,eGround))e.z=nz;
          e.facingY=slerp(e.facingY,Math.atan2(-ddx,-ddz),ENEMY_ROT_SPD*0.5,dt);isMoving=true;
        }
      }
    }
    animateEnemyLegs(e,dt,isMoving);
    // Crouch/jump
    if(e.state==='attack'){
      if(!e.crouching&&e.crouchTimer<=0&&Math.random()<0.008){e.crouching=true;e.crouchTimer=0.8+Math.random()*1.2;}
      if(e.crouching){e.crouchTimer-=dt;if(e.crouchTimer<=0)e.crouching=false;}
      e.jumpCd=Math.max(0,e.jumpCd-dt);
      if(e.onGround&&e.jumpCd<=0&&Math.random()<0.004){e.velY=5.5;e.onGround=false;e.jumpCd=3+Math.random()*3;}
    } else {e.crouching=false;}
    if(!e.onGround){
      e.velY-=GRAVITY*dt;const newY=e.mesh.position.y+e.velY*dt;
      if(newY<=eGround){e.onGround=true;e.velY=0;e.mesh.position.y=eGround;}else e.mesh.position.y=newY;
    }
    const crOff=e.crouching?-0.45:0;e.bobT+=dt*(e.state==='attack'?3.8:1.6);
    if(e.onGround)e.mesh.position.set(e.x,eGround+crOff+(isMoving?Math.abs(Math.sin(e.bobT))*0.022:0),e.z);
    else{e.mesh.position.x=e.x;e.mesh.position.z=e.z;}
    e.mesh.scale.y+=(( e.crouching?0.6:1)-e.mesh.scale.y)*Math.min(1,dt*10);
    e.mesh.rotation.y=e.facingY;
    if(e.muzzleFlashT>0){e.muzzleFlash.material.opacity=e.muzzleFlashT/55;e.muzzleFlashT=Math.max(0,e.muzzleFlashT-dt*1000);}else e.muzzleFlash.material.opacity=0;
    if(e.hpDrain>e.hp)e.hpDrain=Math.max(e.hp,e.hpDrain-e.maxHp*dt*0.38);
    // Stuck detection
    if(mapCell(Math.floor(e.x/CELL),Math.floor(e.z/CELL))===1){
      const cx2=Math.floor(e.x/CELL),cz2=Math.floor(e.z/CELL);
      for(let r=1;r<=4;r++){let found=false;
        for(let dc=-r;dc<=r&&!found;dc++)for(let dr=-r;dr<=r&&!found;dr++){
          if(Math.abs(dc)!==r&&Math.abs(dr)!==r)continue;
          const nc=cx2+dc,nr=cz2+dr;
          if(nc>=0&&nr>=0&&nc<MAP_W&&nr<MAP_H&&MAP[nr][nc]===0){e.x=nc*CELL+CELL/2;e.z=nr*CELL+CELL/2;e.path=[];found=true;}
        }if(found)break;
      }
    }
    e.radarAge+=dt;
  }
  if(activeDrone&&!activeDrone.dead)updateDrone(activeDrone,dt);
}

// ═══════════════════ HUD CANVAS ════════════════════
const _prj=new THREE.Vector3();
function w2s(wx,wy,wz){_prj.set(wx,wy,wz).project(camera);if(_prj.z>1)return null;return{x:(_prj.x*.5+.5)*hudCanvas.width,y:(-.5*_prj.y+.5)*hudCanvas.height};}

function drawImpactZones(){
  for(const z of grenImpactZones){
    const alpha=(z.life/z.maxLife);
    // Project center + ring edge to find screen radius
    const center=w2s(z.pos.x,z.pos.y,z.pos.z);if(!center)continue;
    const edge=w2s(z.pos.x+z.radius,z.pos.y,z.pos.z);if(!edge)continue;
    const screenR=Math.abs(edge.x-center.x);
    if(screenR<2)continue;
    // Filled circle with gradient
    const grad=hudCtx.createRadialGradient(center.x,center.y,0,center.x,center.y,screenR);
    grad.addColorStop(0,`rgba(255,100,10,${alpha*0.25})`);
    grad.addColorStop(0.7,`rgba(255,60,0,${alpha*0.12})`);
    grad.addColorStop(1,`rgba(255,60,0,0)`);
    hudCtx.fillStyle=grad;hudCtx.beginPath();hudCtx.arc(center.x,center.y,screenR,0,Math.PI*2);hudCtx.fill();
    // Outer ring
    hudCtx.beginPath();hudCtx.arc(center.x,center.y,screenR,0,Math.PI*2);
    hudCtx.strokeStyle=`rgba(255,120,20,${alpha*0.7})`;hudCtx.lineWidth=2;hudCtx.stroke();
    // Inner damage ring (50% radius = half damage zone)
    hudCtx.beginPath();hudCtx.arc(center.x,center.y,screenR*0.5,0,Math.PI*2);
    hudCtx.strokeStyle=`rgba(255,200,20,${alpha*0.5})`;hudCtx.lineWidth=1.5;hudCtx.setLineDash([4,4]);hudCtx.stroke();hudCtx.setLineDash([]);
  }
}

function drawHUD(){
  hudCtx.clearRect(0,0,hudCanvas.width,hudCanvas.height);
  const cx=hudCanvas.width/2,cy=hudCanvas.height/2;

  // Ammo ring
  const ammoR=34,ammoW=5,ammoPct=player.ammo/MAX_AMMO,ammoAngle=ammoPct*Math.PI*2;
  const aR=ammoPct>0.5?Math.floor(255*(2-ammoPct*2)):255,aG=ammoPct>0.5?220:Math.floor(220*ammoPct*2);
  hudCtx.beginPath();hudCtx.arc(cx,cy,ammoR,0,Math.PI*2);hudCtx.strokeStyle='rgba(0,0,0,0.18)';hudCtx.lineWidth=ammoW+2;hudCtx.stroke();
  hudCtx.beginPath();hudCtx.arc(cx,cy,ammoR,0,Math.PI*2);hudCtx.strokeStyle='rgba(255,255,255,0.04)';hudCtx.lineWidth=ammoW;hudCtx.stroke();
  if(ammoPct>0){
    const ag=hudCtx.createLinearGradient(cx-ammoR,cy,cx+ammoR,cy);
    ag.addColorStop(0,`rgba(${aR},${Math.min(255,aG+60)},80,0.45)`);ag.addColorStop(0.5,`rgba(${aR},${aG},20,0.50)`);ag.addColorStop(1,`rgba(${Math.floor(aR*0.5)},${Math.floor(aG*0.4)},8,0.45)`);
    hudCtx.beginPath();hudCtx.arc(cx,cy,ammoR,-Math.PI/2,-Math.PI/2+ammoAngle);
    hudCtx.strokeStyle=ag;hudCtx.lineWidth=ammoW;hudCtx.lineCap='round';hudCtx.stroke();hudCtx.lineCap='butt';
    for(let i=0;i<MAX_AMMO;i++){
      const a=-Math.PI/2+(i/MAX_AMMO)*Math.PI*2;
      hudCtx.beginPath();hudCtx.moveTo(cx+Math.cos(a)*(ammoR-ammoW*.5),cy+Math.sin(a)*(ammoR-ammoW*.5));
      hudCtx.lineTo(cx+Math.cos(a)*(ammoR+ammoW*.5),cy+Math.sin(a)*(ammoR+ammoW*.5));
      hudCtx.strokeStyle=i<player.ammo?'rgba(0,0,0,0.18)':'rgba(0,0,0,0.0)';hudCtx.lineWidth=0.8;hudCtx.stroke();
    }
  }
  // Energy ring
  const energyR=44,energyW=4,energyPct=player.energy/MAX_ENERGY;
  hudCtx.beginPath();hudCtx.arc(cx,cy,energyR,0,Math.PI*2);hudCtx.strokeStyle='rgba(0,0,0,0.12)';hudCtx.lineWidth=energyW+1;hudCtx.stroke();
  if(energyPct>0){
    const fc=player.energy>=GRENADE_ENERGY_COST;
    if(fc){const pulse=0.7+Math.sin(performance.now()/180)*0.3;hudCtx.beginPath();hudCtx.arc(cx,cy,energyR,0,Math.PI*2);hudCtx.strokeStyle=`rgba(50,255,200,${pulse*0.10})`;hudCtx.lineWidth=energyW+6;hudCtx.stroke();}
    hudCtx.beginPath();hudCtx.arc(cx,cy,energyR,-Math.PI/2,-Math.PI/2+energyPct*Math.PI*2);
    hudCtx.strokeStyle=fc?'rgba(50,255,200,0.55)':'rgba(60,160,255,0.48)';hudCtx.lineWidth=energyW;hudCtx.lineCap='round';hudCtx.stroke();hudCtx.lineCap='butt';
  }

  // Reload ring — drawn outside energy ring so it's always visible
  if(player.reloading){
    const rp=1-player.reloadTimer/RELOAD_MS;
    const reloadR=energyR+energyW+5;
    hudCtx.beginPath();hudCtx.arc(cx,cy,reloadR,0,Math.PI*2);hudCtx.strokeStyle='rgba(0,0,0,0.20)';hudCtx.lineWidth=4;hudCtx.stroke();
    hudCtx.beginPath();hudCtx.arc(cx,cy,reloadR,-Math.PI/2,-Math.PI/2+rp*Math.PI*2);
    hudCtx.strokeStyle='rgba(230,120,20,0.90)';hudCtx.lineWidth=4;hudCtx.lineCap='round';hudCtx.stroke();hudCtx.lineCap='butt';
  }

  // ── SPRAY CONE — 4 lines expanding outward from crosshair ──
  if(sprayHeat>0.02){
    const coneR=ammoR-ammoW-3; // just inside the ammo ring
    const gap=10+sprayHeat*28;  // base gap + heat expansion (px from center)
    const lineLen=6+sprayHeat*10;
    const coneAlpha=Math.min(0.85,sprayHeat*1.2);
    // Color tracks heat: green→yellow→red
    const cR=sprayHeat>0.5?255:Math.floor(255*sprayHeat*2);
    const cG=sprayHeat>0.5?Math.floor(255*(1-sprayHeat)*2):255;
    hudCtx.strokeStyle=`rgba(${cR},${cG},30,${coneAlpha})`;
    hudCtx.lineWidth=1.5;hudCtx.lineCap='round';
    // Top
    hudCtx.beginPath();hudCtx.moveTo(cx,cy-gap);hudCtx.lineTo(cx,cy-gap-lineLen);hudCtx.stroke();
    // Bottom
    hudCtx.beginPath();hudCtx.moveTo(cx,cy+gap);hudCtx.lineTo(cx,cy+gap+lineLen);hudCtx.stroke();
    // Left
    hudCtx.beginPath();hudCtx.moveTo(cx-gap,cy);hudCtx.lineTo(cx-gap-lineLen,cy);hudCtx.stroke();
    // Right
    hudCtx.beginPath();hudCtx.moveTo(cx+gap,cy);hudCtx.lineTo(cx+gap+lineLen,cy);hudCtx.stroke();
    hudCtx.lineCap='butt';
    // Diagonal corner marks at full heat
    if(sprayHeat>0.6){
      const diagGap=gap*0.7,diagA=coneAlpha*0.5,diagL=lineLen*0.6;
      hudCtx.strokeStyle=`rgba(${cR},${cG},30,${diagA})`;hudCtx.lineWidth=1;
      [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([sx,sz])=>{
        hudCtx.beginPath();hudCtx.moveTo(cx+sx*diagGap,cy+sz*diagGap);hudCtx.lineTo(cx+sx*(diagGap+diagL),cy+sz*(diagGap+diagL));hudCtx.stroke();
      });
    }
  }

  // Drone HP indicator if active
  if(activeDrone&&!activeDrone.dead){
    const sc=w2s(activeDrone.x,activeDrone.y+0.6,activeDrone.z);
    if(sc){
      const BW=60,BH=6;const bx=sc.x-BW/2,by=sc.y-10;
      hudCtx.fillStyle='rgba(0,0,0,0.5)';hudCtx.fillRect(bx-1,by-1,BW+2,BH+2);
      hudCtx.fillStyle='rgba(0,180,255,0.7)';hudCtx.fillRect(bx,by,BW*(activeDrone.hp/activeDrone.maxHp),BH);
      hudCtx.fillStyle='rgba(255,255,255,0.7)';hudCtx.font='bold 8px Courier New';hudCtx.textAlign='center';
      hudCtx.fillText('DRONE',bx+BW/2,by-3);
    }
  }

  // Impact zones
  drawImpactZones();

  // Enemy HP bars
  const BW=78,BH=9,BR=5;
  function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
  for(const e of enemies){
    if(e.dead||e.hp>=e.maxHp)continue;
    const dxe=camera.position.x-e.x,dze=camera.position.z-e.z;const dist=Math.sqrt(dxe*dxe+dze*dze);if(dist>ENEMY_SIGHT+2)continue;
    const sc=w2s(e.x,e.mesh.position.y+2.1,e.z);if(!sc||sc.x<-BW||sc.x>hudCanvas.width+BW||sc.y<0||sc.y>hudCanvas.height)continue;
    const alpha=Math.min(1,Math.max(0.25,1-(dist-4)/18)),pct=Math.max(0,e.hp/e.maxHp),drPct=Math.max(0,e.hpDrain/e.maxHp);
    const bx=sc.x-BW/2,by=sc.y-14;
    hudCtx.save();
    hudCtx.shadowColor=`rgba(0,0,0,${0.55*alpha})`;hudCtx.shadowBlur=4;hudCtx.shadowOffsetY=2;
    rr(hudCtx,bx-1,by-1,BW+2,BH+2,BR+1);hudCtx.fillStyle=`rgba(0,0,0,${0.5*alpha})`;hudCtx.fill();
    hudCtx.shadowColor='transparent';hudCtx.shadowBlur=0;hudCtx.shadowOffsetY=0;
    rr(hudCtx,bx,by,BW,BH,BR);hudCtx.fillStyle=`rgba(15,15,15,${0.88*alpha})`;hudCtx.fill();
    hudCtx.save();rr(hudCtx,bx,by,BW,BH,BR);hudCtx.clip();hudCtx.fillStyle=`rgba(110,14,14,${0.9*alpha})`;hudCtx.fillRect(bx,by,BW*drPct,BH);hudCtx.restore();
    if(pct>0){
      hudCtx.save();rr(hudCtx,bx,by,BW*pct,BH,pct>0.95?BR:Math.min(BR,BW*pct*0.4));hudCtx.clip();
      for(let s=0;s<HP_SEGS;s++){const s0=s/HP_SEGS,s1=(s+1)/HP_SEGS;if(pct<=s0)break;const fw=(Math.min(pct,s1)-s0)*BW;const eR=pct>0.5?Math.floor(255*(2-pct*2)):255,eG=pct>0.5?210:Math.floor(210*pct*2);const grad=hudCtx.createLinearGradient(bx+s0*BW,by,bx+s0*BW,by+BH);grad.addColorStop(0,`rgba(${Math.min(255,eR+60)},${Math.min(255,eG+50)},40,${alpha})`);grad.addColorStop(0.45,`rgba(${eR},${eG},20,${alpha})`);grad.addColorStop(1,`rgba(${Math.floor(eR*0.45)},${Math.floor(eG*0.4)},8,${alpha})`);hudCtx.fillStyle=grad;hudCtx.fillRect(bx+s0*BW,by,fw,BH);}
      hudCtx.fillStyle=`rgba(0,0,0,${0.5*alpha})`;for(let s=1;s<HP_SEGS;s++){const sx=bx+s*(BW/HP_SEGS);if(sx<bx+BW*pct)hudCtx.fillRect(sx-0.8,by,1.6,BH);}
      hudCtx.restore();
    }
    hudCtx.save();rr(hudCtx,bx,by,BW,BH,BR);hudCtx.clip();const gg=hudCtx.createLinearGradient(bx,by,bx,by+BH*0.45);gg.addColorStop(0,`rgba(255,255,255,${0.18*alpha})`);gg.addColorStop(1,'rgba(255,255,255,0)');hudCtx.fillStyle=gg;hudCtx.fillRect(bx,by,BW,BH*0.45);hudCtx.restore();
    rr(hudCtx,bx,by,BW,BH,BR);hudCtx.strokeStyle=`rgba(0,0,0,${0.7*alpha})`;hudCtx.lineWidth=1;hudCtx.stroke();
    const dc=e.state==='attack'?`rgba(255,60,60,${alpha})`:e.state==='spotted'?`rgba(255,210,40,${alpha})`:`rgba(60,210,60,${alpha})`;
    hudCtx.fillStyle=dc;hudCtx.beginPath();hudCtx.arc(bx-8,by+BH/2,3.5,0,Math.PI*2);hudCtx.fill();
    hudCtx.fillStyle=`rgba(255,255,255,${0.82*alpha})`;hudCtx.font=`bold 9px 'Courier New'`;hudCtx.textAlign='center';hudCtx.fillText(Math.ceil(e.hp),bx+BW/2,by-3);
    hudCtx.restore();
  }
}

// ═══════════════════ RADAR ═════════════════════════
const mmC=document.getElementById('mm'),mmX=mmC.getContext('2d');
const MM=160,MC=MM/MAP_W;let radarAng=0;const RADAR_SPEED=1/3;

function drawMinimap(dt){
  radarAng=(radarAng+RADAR_SPEED*dt*Math.PI*2)%(Math.PI*2);
  mmX.clearRect(0,0,MM,MM);mmX.fillStyle='rgba(0,12,2,0.94)';mmX.fillRect(0,0,MM,MM);
  for(let r=0;r<MAP_H;r++)for(let c=0;c<MAP_W;c++){
    const cell=MAP[r][c];if(cell===0)continue;const vis=visited[r][c];
    mmX.fillStyle=!vis?'rgba(30,30,20,0.3)':isCrack(cell)?'rgba(120,100,60,0.6)':isRamp(cell)?'rgba(100,130,80,0.65)':'rgba(80,100,50,0.7)';
    mmX.fillRect(c*MC,r*MC,MC-0.5,MC-0.5);
  }
  for(let r=0;r<MAP_H;r++)for(let c=0;c<MAP_W;c++){if(MAP[r][c]!==0||visited[r][c])continue;mmX.fillStyle='rgba(0,0,0,0.78)';mmX.fillRect(c*MC,r*MC,MC,MC);}
  const px=(camera.position.x/CELL)*MC,pz=(camera.position.z/CELL)*MC;
  mmX.save();mmX.translate(px,pz);mmX.beginPath();mmX.moveTo(0,0);mmX.arc(0,0,MM*1.5,radarAng-0.20,radarAng,false);mmX.closePath();
  const sg=mmX.createLinearGradient(0,0,Math.cos(radarAng)*MM*1.5,Math.sin(radarAng)*MM*1.5);sg.addColorStop(0,'rgba(0,200,60,0.0)');sg.addColorStop(1,'rgba(0,200,60,0.18)');
  mmX.fillStyle=sg;mmX.fill();mmX.strokeStyle='rgba(0,255,70,0.65)';mmX.lineWidth=1.2;mmX.beginPath();mmX.moveTo(0,0);mmX.lineTo(Math.cos(radarAng)*MM*1.5,Math.sin(radarAng)*MM*1.5);mmX.stroke();mmX.restore();
  const maxAge=3.5;
  for(const e of enemies){
    if(e.dead)continue;const ex=(e.x/CELL)*MC,ez=(e.z/CELL)*MC;
    const ang=Math.atan2(ez-pz,ex-px);if(normA(radarAng-ang)>=0&&normA(radarAng-ang)<0.24)e.radarAge=0;
    const fade=Math.max(0,1-e.radarAge/maxAge);if(fade<=0)continue;
    const col=e.state==='attack'?`rgba(255,55,55,${fade*0.92})`:e.state==='spotted'?`rgba(255,190,30,${fade*0.85})`:`rgba(255,160,20,${fade*0.7})`;
    mmX.fillStyle=col;mmX.beginPath();mmX.arc(ex,ez,3.5,0,Math.PI*2);mmX.fill();
    if(e.state==='attack'){mmX.strokeStyle=`rgba(255,55,55,${fade*0.35})`;mmX.lineWidth=1;mmX.beginPath();mmX.arc(ex,ez,6.5,0,Math.PI*2);mmX.stroke();}
  }
  // Drone on radar
  if(activeDrone&&!activeDrone.dead){
    const ang=Math.atan2((activeDrone.z/CELL)*MC-pz,(activeDrone.x/CELL)*MC-px);
    if(normA(radarAng-ang)>=0&&normA(radarAng-ang)<0.24)activeDrone.radarAge=0;
    activeDrone.radarAge+=dt;
    const fade=Math.max(0,1-activeDrone.radarAge/maxAge);if(fade>0){
      mmX.fillStyle=`rgba(0,180,255,${fade*0.9})`;mmX.beginPath();mmX.arc((activeDrone.x/CELL)*MC,(activeDrone.z/CELL)*MC,4,0,Math.PI*2);mmX.fill();
    }
  }
  for(const d of ammoDrops){const ex=(d.x/CELL)*MC,ez=(d.z/CELL)*MC;mmX.fillStyle='rgba(80,255,80,0.8)';mmX.beginPath();mmX.arc(ex,ez,2.5,0,Math.PI*2);mmX.fill();}
  mmX.strokeStyle='rgba(0,100,30,0.18)';mmX.lineWidth=0.7;[0.28,0.55,0.82].forEach(r=>{mmX.beginPath();mmX.arc(px,pz,r*MM*0.68,0,Math.PI*2);mmX.stroke();});
  mmX.fillStyle='#2ecc71';mmX.beginPath();mmX.arc(px,pz,4,0,Math.PI*2);mmX.fill();
  const pa=player.yaw+Math.PI;mmX.strokeStyle='rgba(46,204,113,0.88)';mmX.lineWidth=1.8;mmX.beginPath();mmX.moveTo(px,pz);mmX.lineTo(px+Math.sin(pa)*12,pz+Math.cos(pa)*12);mmX.stroke();
  mmX.strokeStyle='rgba(46,204,113,0.2)';mmX.lineWidth=1;mmX.beginPath();mmX.moveTo(px,pz);mmX.lineTo(px+Math.sin(pa-0.65)*18,pz+Math.cos(pa-0.65)*18);mmX.moveTo(px,pz);mmX.lineTo(px+Math.sin(pa+0.65)*18,pz+Math.cos(pa+0.65)*18);mmX.stroke();
}

// ═══════════════════ HIT MARKER ════════════════════
let hitMarkerT=0;
function spawnHitMarker(){hitMarkerT=260;document.getElementById('xhair-dot').style.cssText='background:#e74c3c;width:5px;height:5px;border-radius:50%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)';}

// ═══════════════════ WEAPON BOB ════════════════════
function updateWeapon(dt,moving,sprint,crouching,sliding){
  const spd=sliding?4:sprint?3.4:crouching?1.2:moving?2.1:0.22;
  bobT+=dt*spd;const scale=crouching?0.4:sliding?0.15:1;
  const bY=moving?Math.sin(bobT)*0.007*(sprint?1.4:1)*scale:0;
  const bX=moving?Math.sin(bobT*.5)*0.003*scale:0;
  const rc=recoilT>0?recoilT/100:0;
  const crOff=crouching?-0.04:sliding?0.02:0;
  wpn.position.set(0.11+bX,-0.105+bY+rc*0.024+crOff,-0.20-rc*0.055);
  wpn.rotation.x=rc*0.07+(sliding?0.15:0);recoilT=Math.max(0,recoilT-dt*200);
  if(muzzleT>0){flashMat.opacity=muzzleT/62;flash.scale.setScalar(0.75+Math.random()*.55);muzzleLight.intensity=2.4*4*Math.PI*(muzzleT/62);muzzleLight.position.copy(camera.position);muzzleT=Math.max(0,muzzleT-dt*1000);}
  else{flashMat.opacity=0;muzzleLight.intensity=0;}
}

// ═══════════════════ RELOAD / HUD ══════════════════
function startReload(){if(player.reloading||player.reserve<=0)return;player.reloading=true;player.reloadTimer=RELOAD_MS;document.getElementById('reloadwrap').style.display='block';showMsg('RELOADING');}
function updateHUD(){
  document.getElementById('ammo-cur').textContent=player.ammo;document.getElementById('ammo-rsv').textContent=player.reserve;
  const hpPct=player.hp/MAX_HP;document.getElementById('hp-num').textContent=Math.round(player.hp);
  const hpCol=player.hp>50?'#2ecc71':player.hp>25?'#e67e22':'#e74c3c';
  document.getElementById('hp-num').style.color=hpCol;document.getElementById('player-hp-bar').style.width=(hpPct*100)+'%';document.getElementById('player-hp-bar').style.background=hpCol;
  document.getElementById('energy-label').textContent=`ENERGY: ${Math.floor(player.energy)}%`;
  document.getElementById('vignette').style.boxShadow=player.hp<40?`inset 0 0 130px rgba(200,0,0,${0.35*(1-player.hp/40)})`:'none';
}
let msgT=null,statusT=null;
function showMsg(txt,dur=2000){const m=document.getElementById('msg');m.textContent=txt;m.style.opacity='1';clearTimeout(msgT);msgT=setTimeout(()=>m.style.opacity='0',dur);}
function showStatus(txt,dur=1200){const m=document.getElementById('status');m.textContent=txt;m.style.opacity='1';clearTimeout(statusT);statusT=setTimeout(()=>m.style.opacity='0',dur);}
function triggerHitFlash(){player.lastHitTime=performance.now();const f=document.getElementById('hitflash');f.style.opacity='1';setTimeout(()=>f.style.opacity='0',110);}

// ═══════════════════ PLAYER MOVEMENT ═══════════════
function updatePlayer(dt){
  if(player.dead)return;
  if(mouseHeld&&locked)tryShoot();

  const sprint=keys['ShiftLeft']||keys['ShiftRight'];
  const wantCrouch=keys['ControlLeft']||keys['ControlRight']||keys['KeyC'];
  const movingForward=keys['KeyW']||keys['ArrowUp'];
  const wantSlide=movingForward&&wantCrouch&&!player.sliding&&player.onGround&&!player.crouching;

  // Slide
  if(wantSlide){player.sliding=true;player.slideTimer=SLIDE_DUR;player.slideCancelAvail=true;const fwd=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));player.slideVel=fwd.multiplyScalar(SLIDE_SPEED);showStatus('SLIDE');}
  if(player.sliding){
    player.slideTimer-=dt;
    if(SLIDE_CANCEL_JUMP&&player.slideCancelAvail&&keys['Space']){player.sliding=false;player.slideVel=null;player.velY=JUMP_FORCE*0.85;player.onGround=false;player.slideCancelAvail=false;showStatus('SLIDE CANCEL');}
    if(player.slideTimer<=0){player.sliding=false;player.slideVel=null;}
  }
  player.crouching=wantCrouch&&!player.sliding;

  // Discrete cell height for physics/collision (no bilinear blending = no sinking at edges)
  const groundH=hAt(Math.floor(camera.position.x/CELL),Math.floor(camera.position.z/CELL));
  // Smooth bilinear elevation for camera Y (nice smooth transitions on ramps)
  const groundHSmooth=groundElevation(camera.position.x,camera.position.z);
  const targetH=player.sliding?PLAYER_H_CROUCH:(player.crouching?PLAYER_H_CROUCH:PLAYER_H);
  const eyeFloor=groundHSmooth+targetH;

  // Horizontal movement
  let moving=false;
  let mvX=0,mvZ=0;

  if(player.onGround){
    // Normal WASD movement
    const moveScale=player.crouching?0.72:sprint?SPRINT_MULT:1;
    const spd=MOVE_SPEED*moveScale*dt;
    const fwd=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
    const rgt=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
    const mv=new THREE.Vector3();
    if(keys['KeyW']||keys['ArrowUp'])mv.add(fwd);if(keys['KeyS']||keys['ArrowDown'])mv.sub(fwd);
    if(keys['KeyA']||keys['ArrowLeft'])mv.sub(rgt);if(keys['KeyD']||keys['ArrowRight'])mv.add(rgt);
    if(mv.length()>0){mv.normalize();mv.multiplyScalar(spd);moving=true;}
    // Slide velocity added on top of WASD
    if(player.sliding&&player.slideVel){mv.x+=player.slideVel.x*dt;mv.z+=player.slideVel.z*dt;moving=true;}
    mvX=mv.x; mvZ=mv.z;
    // Store velocity for air carry (units/s not units/frame)
    player.airVelX=mvX/dt; player.airVelZ=mvZ/dt;

    if(mvX!==0){const nx=camera.position.x+mvX;if(canMoveTo(nx,camera.position.z,groundH))camera.position.x=nx;}
    if(mvZ!==0){const nz=camera.position.z+mvZ;if(canMoveTo(camera.position.x,nz,groundH))camera.position.z=nz;}
  } else {
    // Airborne: carry last grounded velocity, no steering, only walls block
    mvX=player.airVelX*dt; mvZ=player.airVelZ*dt;
    // Also carry slide momentum
    if(player.slideVel){mvX+=player.slideVel.x*dt;mvZ+=player.slideVel.z*dt;}
    if(mvX!==0){const nx=camera.position.x+mvX;if(canMoveTo(nx,camera.position.z,groundH,true))camera.position.x=nx;}
    if(mvZ!==0){const nz=camera.position.z+mvZ;if(canMoveTo(camera.position.x,nz,groundH,true))camera.position.z=nz;}
    moving=Math.abs(mvX)+Math.abs(mvZ)>0.0001;
    // Slight air drag (no friction, just very gentle drag so long jumps feel right)
    player.airVelX*=1-dt*0.4; player.airVelZ*=1-dt*0.4;
  }

  // Decay slide velocity
  if(player.slideVel){
    const friction=player.onGround?3.5:0.8; // more friction on ground, little in air
    player.slideVel.multiplyScalar(1-dt*friction);
    if(player.slideVel.length()<0.05)player.slideVel=null;
  }

  // Jump + gravity
  if(player.onGround&&!player.sliding&&keys['Space']){player.velY=JUMP_FORCE;player.onGround=false;}
  if(!player.onGround){
    player.velY-=GRAVITY*dt;camera.position.y+=player.velY*dt;
    if(camera.position.y<=eyeFloor){camera.position.y=eyeFloor;player.velY=0;player.onGround=true;}
  } else {
    camera.position.y+=(eyeFloor-camera.position.y)*Math.min(1,dt*14);
  }

  // Head bob
  if(moving&&player.onGround){player.bobPitch=Math.sin(bobT)*HEAD_BOB_PITCH*(sprint?1.4:1)*(player.crouching?0.4:1);}
  else{player.bobPitch*=0.82;}

  // Apply first-person orientation always (physics lives at camera.position)
  _euler.set(player.pitch+player.bobPitch,player.yaw,player.sliding?0.04:0);
  camera.quaternion.setFromEuler(_euler);

  if(thirdPerson){
    // Show body at player's feet, facing yaw
    playerBody.position.set(camera.position.x, camera.position.y-PLAYER_H, camera.position.z);
    playerBody.rotation.y=player.yaw+Math.PI;
  }

  // Fog of war
  const pc=Math.floor(camera.position.x/CELL),pr=Math.floor(camera.position.z/CELL);
  for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){const vc=pc+dc,vr=pr+dr;if(vc>=0&&vr>=0&&vc<MAP_W&&vr<MAP_H)visited[vr][vc]=1;}

  updateWeapon(dt,moving,sprint,player.crouching,player.sliding);
  tickImpacts(dt);tickTracers(dt);tickAmmoDrops(dt);tickGrenades(dt);tickGrenadeParticles(dt);
  sprayHeat=Math.max(0,sprayHeat-SPRAY_COOL*dt);

  if(player.reloading){
    player.reloadTimer-=dt*1000;document.getElementById('reloadbar').style.width=((1-player.reloadTimer/RELOAD_MS)*100)+'%';
    if(player.reloadTimer<=0){const take=Math.min(MAX_AMMO-player.ammo,player.reserve);player.ammo+=take;player.reserve-=take;player.reloading=false;document.getElementById('reloadwrap').style.display='none';updateHUD();showMsg('READY');}
  }
  if(hitMarkerT>0){hitMarkerT-=dt*1000;if(hitMarkerT<=0){document.getElementById('xhair-dot').style.cssText='background:#fff;width:3px;height:3px;border-radius:50%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)';['xh-t','xh-b','xh-l','xh-r'].forEach(id=>document.getElementById(id).style.transform='');}}
  const now2=performance.now();
  if(player.hp>0&&player.hp<MAX_HP&&now2-player.lastHitTime>3000){player.hp=Math.min(MAX_HP,player.hp+8*dt);updateHUD();}
}

function triggerDeath(){player.dead=true;gameRunning=false;document.exitPointerLock?.();const ov=document.getElementById('overlay');ov.style.display='flex';
  ov.innerHTML=`<div class="dead-h">KILLED IN ACTION</div><div class="stat">Kills: ${player.kills}</div><div class="stat" style="color:#333;margin-top:6px">Wave ${wave} — the vibes remain hostile</div><button onclick="location.reload()" style="margin-top:28px;padding:12px 52px;background:#e74c3c;color:#fff;border:none;font-family:'Courier New',monospace;font-size:14px;letter-spacing:4px;cursor:pointer">[ REDEPLOY ]</button>`;}

// ═══════════════════ MAIN LOOP ══════════════════════
let last=0;
function loop(ts){
  const dt=Math.min(0.05,(ts-last)/1000);last=ts;
  if(gameRunning){
    updatePlayer(dt);updateEnemies(ts,dt);
    tickTorches(dt);
    if(respawnTimer>0){respawnTimer-=dt*1000;const secs=Math.ceil(respawnTimer/1000);showMsg(`WAVE ${wave} INCOMING IN ${secs}...`,1100);
      if(respawnTimer<=0){respawnTimer=-1;ammoDrops.forEach(d=>scene.remove(d.mesh));ammoDrops.length=0;enemies.forEach(e=>spawnEnemyIntoSlot(e));rebuildEHM();showMsg(`WAVE ${wave} — ENGAGE!`,2500);}}
  }
  drawMinimap(dt);
  // Third-person: offset camera behind player just for rendering, then restore
  const eyeX=camera.position.x,eyeY=camera.position.y,eyeZ=camera.position.z;
  if(thirdPerson){
    const bx=eyeX+Math.sin(player.yaw)*TP_DIST;
    const bz=eyeZ+Math.cos(player.yaw)*TP_DIST;
    const by=eyeY+TP_HEIGHT;
    camera.position.set(bx,by,bz);
    camera.lookAt(eyeX,eyeY+0.3,eyeZ);
  }
  renderer.render(scene,camera);
  if(thirdPerson) camera.position.set(eyeX,eyeY,eyeZ);
  drawHUD();requestAnimationFrame(loop);
}

// ═══════════════════ START ══════════════════════════
document.getElementById('startbtn').addEventListener('click',()=>{
  document.getElementById('overlay').style.display='none';document.getElementById('c').requestPointerLock();
  gameRunning=true;rebuildEHM();updateHUD();spawnNewDrone();showMsg('VIBE ON DUTY — LOCK AND LOAD',2500);
});
document.getElementById('c').addEventListener('click',()=>{if(gameRunning&&!player.dead&&!locked)document.getElementById('c').requestPointerLock();});
last=performance.now();requestAnimationFrame(loop);
