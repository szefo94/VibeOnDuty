import * as THREE from 'three';
import { hudCtx, hudCanvas, camera } from '../scene.js';
import { ENEMY_SIGHT, HP_SEGS } from '../config.js';
import { enemies } from '../entities/enemies.js';
import { activeDrone } from '../entities/drone.js';
import { grenImpactZones } from '../fx/particles.js';
import { healthColor } from './rings.js';

const _prj = new THREE.Vector3();

function _w2s(wx, wy, wz) {
  _prj.set(wx, wy, wz).project(camera);
  if (_prj.z > 1) return null;
  return { x: (_prj.x * 0.5 + 0.5) * hudCanvas.width, y: (-0.5 * _prj.y + 0.5) * hudCanvas.height };
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawImpactZones() {
  for (const z of grenImpactZones) {
    const alpha  = z.life / z.maxLife;
    const center = _w2s(z.pos.x, z.pos.y, z.pos.z);
    if (!center) continue;
    const edge = _w2s(z.pos.x + z.radius, z.pos.y, z.pos.z);
    if (!edge) continue;
    const screenR = Math.abs(edge.x - center.x);
    if (screenR < 2) continue;
    const grad = hudCtx.createRadialGradient(center.x, center.y, 0, center.x, center.y, screenR);
    grad.addColorStop(0,   `rgba(255,100,10,${alpha * 0.25})`);
    grad.addColorStop(0.7, `rgba(255,60,0,${alpha * 0.12})`);
    grad.addColorStop(1,   `rgba(255,60,0,0)`);
    hudCtx.fillStyle = grad;
    hudCtx.beginPath();
    hudCtx.arc(center.x, center.y, screenR, 0, Math.PI * 2);
    hudCtx.fill();
    hudCtx.beginPath();
    hudCtx.arc(center.x, center.y, screenR, 0, Math.PI * 2);
    hudCtx.strokeStyle = `rgba(255,120,20,${alpha * 0.7})`;
    hudCtx.lineWidth = 2;
    hudCtx.stroke();
    hudCtx.beginPath();
    hudCtx.arc(center.x, center.y, screenR * 0.5, 0, Math.PI * 2);
    hudCtx.strokeStyle = `rgba(255,200,20,${alpha * 0.5})`;
    hudCtx.lineWidth = 1.5;
    hudCtx.setLineDash([4, 4]);
    hudCtx.stroke();
    hudCtx.setLineDash([]);
  }
}

function drawDroneBar() {
  if (!activeDrone || activeDrone.dead) return;
  const sc = _w2s(activeDrone.x, activeDrone.y + 0.6, activeDrone.z);
  if (!sc) return;
  const BW = 60, BH = 6;
  const bx = sc.x - BW / 2, by = sc.y - 10;
  hudCtx.fillStyle = 'rgba(0,0,0,0.5)';
  hudCtx.fillRect(bx - 1, by - 1, BW + 2, BH + 2);
  hudCtx.fillStyle = 'rgba(0,180,255,0.7)';
  hudCtx.fillRect(bx, by, BW * (activeDrone.hp / activeDrone.maxHp), BH);
  hudCtx.fillStyle = 'rgba(255,255,255,0.7)';
  hudCtx.font = 'bold 8px Courier New';
  hudCtx.textAlign = 'center';
  hudCtx.fillText('DRONE', bx + BW / 2, by - 3);
}

export function drawEnemyOverlays() {
  drawImpactZones();
  drawDroneBar();

  const BW = 78, BH = 9, BR = 5;
  for (const e of enemies) {
    if (e.dead || e.hp >= e.maxHp) continue;
    const dxe = camera.position.x - e.x, dze = camera.position.z - e.z;
    if (dxe * dxe + dze * dze > (ENEMY_SIGHT + 2) ** 2) continue;
    const sc = _w2s(e.x, e.mesh.position.y + 2.1, e.z);
    if (!sc || sc.x < -BW || sc.x > hudCanvas.width + BW || sc.y < 0 || sc.y > hudCanvas.height) continue;

    const dist  = Math.sqrt(dxe * dxe + dze * dze);
    const alpha = Math.min(1, Math.max(0.25, 1 - (dist - 4) / 18));
    const pct   = Math.max(0, e.hp / e.maxHp);
    const drPct = Math.max(0, e.hpDrain / e.maxHp);
    const bx = sc.x - BW / 2, by = sc.y - 14;

    hudCtx.save();
    hudCtx.shadowColor = `rgba(0,0,0,${0.55 * alpha})`;
    hudCtx.shadowBlur = 4;
    hudCtx.shadowOffsetY = 2;
    _roundRect(hudCtx, bx - 1, by - 1, BW + 2, BH + 2, BR + 1);
    hudCtx.fillStyle = `rgba(0,0,0,${0.5 * alpha})`;
    hudCtx.fill();
    hudCtx.shadowColor = 'transparent';
    hudCtx.shadowBlur = 0;
    hudCtx.shadowOffsetY = 0;

    _roundRect(hudCtx, bx, by, BW, BH, BR);
    hudCtx.fillStyle = `rgba(15,15,15,${0.88 * alpha})`;
    hudCtx.fill();

    // Drain ghost
    hudCtx.save();
    _roundRect(hudCtx, bx, by, BW, BH, BR);
    hudCtx.clip();
    hudCtx.fillStyle = `rgba(110,14,14,${0.9 * alpha})`;
    hudCtx.fillRect(bx, by, BW * drPct, BH);
    hudCtx.restore();

    // HP fill with per-segment gradient
    if (pct > 0) {
      hudCtx.save();
      _roundRect(hudCtx, bx, by, BW * pct, BH, pct > 0.95 ? BR : Math.min(BR, BW * pct * 0.4));
      hudCtx.clip();
      for (let s = 0; s < HP_SEGS; s++) {
        const s0 = s / HP_SEGS, s1 = (s + 1) / HP_SEGS;
        if (pct <= s0) break;
        const fw = (Math.min(pct, s1) - s0) * BW;
        const { r: eR, g: eG } = healthColor(pct, 210);
        const grad = hudCtx.createLinearGradient(bx + s0 * BW, by, bx + s0 * BW, by + BH);
        grad.addColorStop(0,    `rgba(${Math.min(255, eR + 60)},${Math.min(255, eG + 50)},40,${alpha})`);
        grad.addColorStop(0.45, `rgba(${eR},${eG},20,${alpha})`);
        grad.addColorStop(1,    `rgba(${Math.floor(eR * 0.45)},${Math.floor(eG * 0.4)},8,${alpha})`);
        hudCtx.fillStyle = grad;
        hudCtx.fillRect(bx + s0 * BW, by, fw, BH);
      }
      // Segment dividers
      hudCtx.fillStyle = `rgba(0,0,0,${0.5 * alpha})`;
      for (let s = 1; s < HP_SEGS; s++) {
        const sx = bx + s * (BW / HP_SEGS);
        if (sx < bx + BW * pct) hudCtx.fillRect(sx - 0.8, by, 1.6, BH);
      }
      hudCtx.restore();
    }

    // Gloss highlight
    hudCtx.save();
    _roundRect(hudCtx, bx, by, BW, BH, BR);
    hudCtx.clip();
    const gloss = hudCtx.createLinearGradient(bx, by, bx, by + BH * 0.45);
    gloss.addColorStop(0, `rgba(255,255,255,${0.18 * alpha})`);
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    hudCtx.fillStyle = gloss;
    hudCtx.fillRect(bx, by, BW, BH * 0.45);
    hudCtx.restore();

    // Border
    _roundRect(hudCtx, bx, by, BW, BH, BR);
    hudCtx.strokeStyle = `rgba(0,0,0,${0.7 * alpha})`;
    hudCtx.lineWidth = 1;
    hudCtx.stroke();

    // State dot + HP text
    const dc = e.state === 'attack'
      ? `rgba(255,60,60,${alpha})`
      : e.state === 'spotted'
        ? `rgba(255,210,40,${alpha})`
        : `rgba(60,210,60,${alpha})`;
    hudCtx.fillStyle = dc;
    hudCtx.beginPath();
    hudCtx.arc(bx - 8, by + BH / 2, 3.5, 0, Math.PI * 2);
    hudCtx.fill();
    hudCtx.fillStyle = `rgba(255,255,255,${0.82 * alpha})`;
    hudCtx.font = `bold 9px 'Courier New'`;
    hudCtx.textAlign = 'center';
    hudCtx.fillText(Math.ceil(e.hp), bx + BW / 2, by - 3);
    hudCtx.restore();
  }
}
