import { CELL } from '../config.js';
import { MAP_W, MAP_H, MAP, isRamp, isCrack } from '../map.js';
import { normA } from '../math.js';
import { camera } from '../scene.js';
import { player, visited } from '../entities/player.js';
import { enemies } from '../entities/enemies.js';
import { activeDrone, sndDrones } from '../entities/drone.js';
import { ammoDrops } from '../entities/ammoDrops.js';

const mmC = document.getElementById('mm'),
  mmX = mmC.getContext('2d');
const MM = 160,
  MC = MM / MAP_W;
let radarAng = 0;
const RADAR_SPEED = 1 / 3;

export function drawMinimap(dt) {
  radarAng = (radarAng + RADAR_SPEED * dt * Math.PI * 2) % (Math.PI * 2);
  mmX.clearRect(0, 0, MM, MM);
  mmX.fillStyle = 'rgba(0,12,2,0.94)';
  mmX.fillRect(0, 0, MM, MM);

  for (let r = 0; r < MAP_H; r++)
    for (let c = 0; c < MAP_W; c++) {
      const cell = MAP[r][c];
      if (cell === 0) continue;
      const vis = visited[r][c];
      mmX.fillStyle = !vis
        ? 'rgba(30,30,20,0.3)'
        : isCrack(cell)
          ? 'rgba(120,100,60,0.6)'
          : isRamp(cell)
            ? 'rgba(100,130,80,0.65)'
            : 'rgba(80,100,50,0.7)';
      mmX.fillRect(c * MC, r * MC, MC - 0.5, MC - 0.5);
    }
  for (let r = 0; r < MAP_H; r++)
    for (let c = 0; c < MAP_W; c++) {
      if (MAP[r][c] !== 0 || visited[r][c]) continue;
      mmX.fillStyle = 'rgba(0,0,0,0.78)';
      mmX.fillRect(c * MC, r * MC, MC, MC);
    }

  const px = (camera.position.x / CELL) * MC,
    pz = (camera.position.z / CELL) * MC;
  mmX.save();
  mmX.translate(px, pz);
  mmX.beginPath();
  mmX.moveTo(0, 0);
  mmX.arc(0, 0, MM * 1.5, radarAng - 0.2, radarAng, false);
  mmX.closePath();
  const sg = mmX.createLinearGradient(
    0,
    0,
    Math.cos(radarAng) * MM * 1.5,
    Math.sin(radarAng) * MM * 1.5
  );
  sg.addColorStop(0, 'rgba(0,200,60,0.0)');
  sg.addColorStop(1, 'rgba(0,200,60,0.18)');
  mmX.fillStyle = sg;
  mmX.fill();
  mmX.strokeStyle = 'rgba(0,255,70,0.65)';
  mmX.lineWidth = 1.2;
  mmX.beginPath();
  mmX.moveTo(0, 0);
  mmX.lineTo(Math.cos(radarAng) * MM * 1.5, Math.sin(radarAng) * MM * 1.5);
  mmX.stroke();
  mmX.restore();

  const maxAge = 3.5;
  for (const e of enemies) {
    if (e.dead) continue;
    const ex = (e.x / CELL) * MC,
      ez = (e.z / CELL) * MC;
    const ang = Math.atan2(ez - pz, ex - px);
    if (normA(radarAng - ang) >= 0 && normA(radarAng - ang) < 0.24) e.radarAge = 0;
    const fade = Math.max(0, 1 - e.radarAge / maxAge);
    if (fade <= 0) continue;
    const col =
      e.state === 'attack'
        ? `rgba(255,55,55,${fade * 0.92})`
        : e.state === 'spotted'
          ? `rgba(255,190,30,${fade * 0.85})`
          : `rgba(255,160,20,${fade * 0.7})`;
    mmX.fillStyle = col;
    mmX.beginPath();
    mmX.arc(ex, ez, 3.5, 0, Math.PI * 2);
    mmX.fill();
    if (e.state === 'attack') {
      mmX.strokeStyle = `rgba(255,55,55,${fade * 0.35})`;
      mmX.lineWidth = 1;
      mmX.beginPath();
      mmX.arc(ex, ez, 6.5, 0, Math.PI * 2);
      mmX.stroke();
    }
  }

  if (activeDrone && !activeDrone.dead) {
    const ang = Math.atan2((activeDrone.z / CELL) * MC - pz, (activeDrone.x / CELL) * MC - px);
    if (normA(radarAng - ang) >= 0 && normA(radarAng - ang) < 0.24) activeDrone.radarAge = 0;
    activeDrone.radarAge += dt;
    const fade = Math.max(0, 1 - activeDrone.radarAge / maxAge);
    if (fade > 0) {
      mmX.fillStyle = `rgba(0,180,255,${fade * 0.9})`;
      mmX.beginPath();
      mmX.arc((activeDrone.x / CELL) * MC, (activeDrone.z / CELL) * MC, 4, 0, Math.PI * 2);
      mmX.fill();
    }
  }

  // S&D recon drones — always visible (they're known threats/assets)
  for (const d of sndDrones) {
    const ex = (d.x / CELL) * MC, ez = (d.z / CELL) * MC;
    mmX.fillStyle = d.team === 'friend' ? 'rgba(0,200,255,0.9)' : 'rgba(255,60,0,0.9)';
    mmX.beginPath();
    mmX.arc(ex, ez, 3.5, 0, Math.PI * 2);
    mmX.fill();
  }

  for (const d of ammoDrops) {
    const ex = (d.x / CELL) * MC,
      ez = (d.z / CELL) * MC;
    mmX.fillStyle = 'rgba(80,255,80,0.8)';
    mmX.beginPath();
    mmX.arc(ex, ez, 2.5, 0, Math.PI * 2);
    mmX.fill();
  }

  mmX.strokeStyle = 'rgba(0,100,30,0.18)';
  mmX.lineWidth = 0.7;
  [0.28, 0.55, 0.82].forEach((r) => {
    mmX.beginPath();
    mmX.arc(px, pz, r * MM * 0.68, 0, Math.PI * 2);
    mmX.stroke();
  });
  mmX.fillStyle = '#2ecc71';
  mmX.beginPath();
  mmX.arc(px, pz, 4, 0, Math.PI * 2);
  mmX.fill();
  const pa = player.yaw + Math.PI;
  mmX.strokeStyle = 'rgba(46,204,113,0.88)';
  mmX.lineWidth = 1.8;
  mmX.beginPath();
  mmX.moveTo(px, pz);
  mmX.lineTo(px + Math.sin(pa) * 12, pz + Math.cos(pa) * 12);
  mmX.stroke();
  mmX.strokeStyle = 'rgba(46,204,113,0.2)';
  mmX.lineWidth = 1;
  mmX.beginPath();
  mmX.moveTo(px, pz);
  mmX.lineTo(px + Math.sin(pa - 0.65) * 18, pz + Math.cos(pa - 0.65) * 18);
  mmX.moveTo(px, pz);
  mmX.lineTo(px + Math.sin(pa + 0.65) * 18, pz + Math.cos(pa + 0.65) * 18);
  mmX.stroke();
}
