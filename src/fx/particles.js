import * as THREE from 'three';
import { scene } from '../scene.js';
import { GRENADE_RADIUS } from '../config.js';

// ── Smoke cloud ───────────────────────────────────────────────────────────────
const smokeParts = [];

export function spawnSmokeCloud(pos) {
  if (_activePCount() >= PARTICLE_BUDGET) return;
  for (let i = 0; i < 14; i++) {
    let s = smokeParts.find(p => !p.active);
    if (!s) {
      s = {
        mesh: new THREE.Mesh(
          new THREE.SphereGeometry(1, 5, 5),
          new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })
        ),
        active: false, vel: new THREE.Vector3(), life: 0, maxLife: 0,
      };
      scene.add(s.mesh);
      smokeParts.push(s);
    }
    s.active  = true;
    s.maxLife = 1.4 + Math.random() * 0.8;
    s.life    = s.maxLife;
    s.mesh.visible = true;
    s.mesh.position.set(
      pos.x + (Math.random() - 0.5) * 2,
      pos.y + Math.random() * 0.5,
      pos.z + (Math.random() - 0.5) * 2
    );
    s.vel.set((Math.random()-0.5)*0.9, 0.6+Math.random()*1.0, (Math.random()-0.5)*0.9);
    const grey = 0.55 + Math.random() * 0.3;
    s.mesh.material.color.setRGB(grey, grey, grey);
    s.mesh.material.opacity = 0;
    s.mesh.scale.setScalar(0.15 + Math.random() * 0.25);
  }
}

export function tickSmokeCloud(dt) {
  for (const s of smokeParts) {
    if (!s.active) continue;
    s.life -= dt;
    if (s.life <= 0) { s.active = false; s.mesh.visible = false; continue; }
    s.mesh.position.addScaledVector(s.vel, dt);
    s.vel.multiplyScalar(Math.max(0, 1 - dt * 2));
    s.mesh.scale.addScalar(dt * 0.5);
    const t = s.life / s.maxLife; // 1 = fresh, 0 = dead
    s.mesh.material.opacity = Math.sin(t * Math.PI) * 0.38;
  }
}

const PARTICLE_BUDGET = 90;
function _activePCount() {
  return grenParticles.filter(p => p.active).length + smokeParts.filter(p => p.active).length;
}

const grenParticles = [];
export const grenImpactZones = [];

export function spawnGrenadeParticles(pos) {
  if (_activePCount() >= PARTICLE_BUDGET) return;
  for (let i = 0; i < 32; i++) {
    let m = grenParticles.find((p) => !p.active);
    if (!m) {
      m = {
        mesh: new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 4, 4),
          new THREE.MeshBasicMaterial({ transparent: true })
        ),
        active: false,
        vel: new THREE.Vector3(),
        life: 0,
      };
      scene.add(m.mesh);
      grenParticles.push(m);
    }
    m.active = true;
    m.life = 0.5 + Math.random() * 0.6;
    m.mesh.visible = true;
    m.mesh.position.copy(pos);
    const spd = 4 + Math.random() * 8;
    m.vel.set(
      (Math.random() - 0.5) * spd,
      (Math.random() * 0.5 + 0.3) * spd,
      (Math.random() - 0.5) * spd
    );
    m.mesh.material.color.set(Math.random() > 0.4 ? 0xff6600 : 0xffcc00);
    m.mesh.material.opacity = 1;
  }
  grenImpactZones.push({ pos: pos.clone(), radius: GRENADE_RADIUS, life: 2.5, maxLife: 2.5 });
}

export function tickGrenadeParticles(dt) {
  for (const p of grenParticles) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      p.mesh.visible = false;
      continue;
    }
    p.vel.y -= 14 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.material.opacity = p.life * 1.4;
    p.mesh.scale.setScalar(Math.max(0.05, p.life * 0.7));
  }
  for (let i = grenImpactZones.length - 1; i >= 0; i--) {
    const z = grenImpactZones[i];
    z.life -= dt;
    if (z.life <= 0) {
      grenImpactZones.splice(i, 1);
    }
  }
}
