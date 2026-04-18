import * as THREE from 'three';
import { hudCanvas, hudCtx, camera } from '../scene.js';
import {
  MAX_AMMO,
  ENEMY_SIGHT,
  HP_SEGS,
  GRENADE_ENERGY_COST,
  MAX_ENERGY,
  RELOAD_MS,
} from '../config.js';
import { player } from '../entities/player.js';
import { enemies, activeDrone } from '../entities/enemies.js';
import { sprayHeat } from '../combat/shoot.js';
import { grenImpactZones } from '../fx/particles.js';

const _prj = new THREE.Vector3();

const _animDebugEl = document.getElementById('anim-debug');
const _animHistory = [];
let _lastAnimName = '';
export function setDebugAnimClip(name) {
  if (!_animDebugEl) return;
  if (name !== _lastAnimName) {
    _animHistory.unshift(name);
    if (_animHistory.length > 3) _animHistory.pop();
    _lastAnimName = name;
  }
  _animDebugEl.innerHTML = _animHistory.map((n, i) => `<span style="opacity:${1 - i * 0.3}">${i === 0 ? '▶' : '·'} ${n}</span>`).join('<br>');
  _animDebugEl.style.display = 'block';
}

export function w2s(wx, wy, wz) {
  _prj.set(wx, wy, wz).project(camera);
  if (_prj.z > 1) return null;
  return { x: (_prj.x * 0.5 + 0.5) * hudCanvas.width, y: (-0.5 * _prj.y + 0.5) * hudCanvas.height };
}

function drawImpactZones() {
  for (const z of grenImpactZones) {
    const alpha = z.life / z.maxLife;
    const center = w2s(z.pos.x, z.pos.y, z.pos.z);
    if (!center) continue;
    const edge = w2s(z.pos.x + z.radius, z.pos.y, z.pos.z);
    if (!edge) continue;
    const screenR = Math.abs(edge.x - center.x);
    if (screenR < 2) continue;
    const grad = hudCtx.createRadialGradient(center.x, center.y, 0, center.x, center.y, screenR);
    grad.addColorStop(0, `rgba(255,100,10,${alpha * 0.25})`);
    grad.addColorStop(0.7, `rgba(255,60,0,${alpha * 0.12})`);
    grad.addColorStop(1, `rgba(255,60,0,0)`);
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

export function drawHUD() {
  hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
  const cx = hudCanvas.width / 2,
    cy = hudCanvas.height / 2;

  // Ammo ring
  const ammoR = 34,
    ammoW = 5,
    ammoPct = player.ammo / MAX_AMMO,
    ammoAngle = ammoPct * Math.PI * 2;
  const aR = ammoPct > 0.5 ? Math.floor(255 * (2 - ammoPct * 2)) : 255,
    aG = ammoPct > 0.5 ? 220 : Math.floor(220 * ammoPct * 2);
  hudCtx.beginPath();
  hudCtx.arc(cx, cy, ammoR, 0, Math.PI * 2);
  hudCtx.strokeStyle = 'rgba(0,0,0,0.18)';
  hudCtx.lineWidth = ammoW + 2;
  hudCtx.stroke();
  hudCtx.beginPath();
  hudCtx.arc(cx, cy, ammoR, 0, Math.PI * 2);
  hudCtx.strokeStyle = 'rgba(255,255,255,0.04)';
  hudCtx.lineWidth = ammoW;
  hudCtx.stroke();
  if (ammoPct > 0) {
    const ag = hudCtx.createLinearGradient(cx - ammoR, cy, cx + ammoR, cy);
    ag.addColorStop(0, `rgba(${aR},${Math.min(255, aG + 60)},80,0.45)`);
    ag.addColorStop(0.5, `rgba(${aR},${aG},20,0.50)`);
    ag.addColorStop(1, `rgba(${Math.floor(aR * 0.5)},${Math.floor(aG * 0.4)},8,0.45)`);
    hudCtx.beginPath();
    hudCtx.arc(cx, cy, ammoR, -Math.PI / 2, -Math.PI / 2 + ammoAngle);
    hudCtx.strokeStyle = ag;
    hudCtx.lineWidth = ammoW;
    hudCtx.lineCap = 'round';
    hudCtx.stroke();
    hudCtx.lineCap = 'butt';
    for (let i = 0; i < MAX_AMMO; i++) {
      const a = -Math.PI / 2 + (i / MAX_AMMO) * Math.PI * 2;
      hudCtx.beginPath();
      hudCtx.moveTo(
        cx + Math.cos(a) * (ammoR - ammoW * 0.5),
        cy + Math.sin(a) * (ammoR - ammoW * 0.5)
      );
      hudCtx.lineTo(
        cx + Math.cos(a) * (ammoR + ammoW * 0.5),
        cy + Math.sin(a) * (ammoR + ammoW * 0.5)
      );
      hudCtx.strokeStyle = i < player.ammo ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.0)';
      hudCtx.lineWidth = 0.8;
      hudCtx.stroke();
    }
  }

  // Energy ring
  const energyR = 44,
    energyW = 4,
    energyPct = player.energy / MAX_ENERGY;
  hudCtx.beginPath();
  hudCtx.arc(cx, cy, energyR, 0, Math.PI * 2);
  hudCtx.strokeStyle = 'rgba(0,0,0,0.12)';
  hudCtx.lineWidth = energyW + 1;
  hudCtx.stroke();
  if (energyPct > 0) {
    const fc = player.energy >= GRENADE_ENERGY_COST;
    if (fc) {
      const pulse = 0.7 + Math.sin(performance.now() / 180) * 0.3;
      hudCtx.beginPath();
      hudCtx.arc(cx, cy, energyR, 0, Math.PI * 2);
      hudCtx.strokeStyle = `rgba(50,255,200,${pulse * 0.1})`;
      hudCtx.lineWidth = energyW + 6;
      hudCtx.stroke();
    }
    hudCtx.beginPath();
    hudCtx.arc(cx, cy, energyR, -Math.PI / 2, -Math.PI / 2 + energyPct * Math.PI * 2);
    hudCtx.strokeStyle = fc ? 'rgba(50,255,200,0.55)' : 'rgba(60,160,255,0.48)';
    hudCtx.lineWidth = energyW;
    hudCtx.lineCap = 'round';
    hudCtx.stroke();
    hudCtx.lineCap = 'butt';
  }

  // Reload ring
  if (player.reloading) {
    const rp = 1 - player.reloadTimer / RELOAD_MS;
    const reloadR = energyR + energyW + 5;
    hudCtx.beginPath();
    hudCtx.arc(cx, cy, reloadR, 0, Math.PI * 2);
    hudCtx.strokeStyle = 'rgba(0,0,0,0.20)';
    hudCtx.lineWidth = 4;
    hudCtx.stroke();
    hudCtx.beginPath();
    hudCtx.arc(cx, cy, reloadR, -Math.PI / 2, -Math.PI / 2 + rp * Math.PI * 2);
    hudCtx.strokeStyle = 'rgba(230,120,20,0.90)';
    hudCtx.lineWidth = 4;
    hudCtx.lineCap = 'round';
    hudCtx.stroke();
    hudCtx.lineCap = 'butt';
  }

  // Spray cone
  if (sprayHeat > 0.02) {
    const gap = 10 + sprayHeat * 28;
    const lineLen = 6 + sprayHeat * 10;
    const coneAlpha = Math.min(0.85, sprayHeat * 1.2);
    const cR = sprayHeat > 0.5 ? 255 : Math.floor(255 * sprayHeat * 2);
    const cG = sprayHeat > 0.5 ? Math.floor(255 * (1 - sprayHeat) * 2) : 255;
    hudCtx.strokeStyle = `rgba(${cR},${cG},30,${coneAlpha})`;
    hudCtx.lineWidth = 1.5;
    hudCtx.lineCap = 'round';
    hudCtx.beginPath();
    hudCtx.moveTo(cx, cy - gap);
    hudCtx.lineTo(cx, cy - gap - lineLen);
    hudCtx.stroke();
    hudCtx.beginPath();
    hudCtx.moveTo(cx, cy + gap);
    hudCtx.lineTo(cx, cy + gap + lineLen);
    hudCtx.stroke();
    hudCtx.beginPath();
    hudCtx.moveTo(cx - gap, cy);
    hudCtx.lineTo(cx - gap - lineLen, cy);
    hudCtx.stroke();
    hudCtx.beginPath();
    hudCtx.moveTo(cx + gap, cy);
    hudCtx.lineTo(cx + gap + lineLen, cy);
    hudCtx.stroke();
    hudCtx.lineCap = 'butt';
    if (sprayHeat > 0.6) {
      const diagGap = gap * 0.7,
        diagA = coneAlpha * 0.5,
        diagL = lineLen * 0.6;
      hudCtx.strokeStyle = `rgba(${cR},${cG},30,${diagA})`;
      hudCtx.lineWidth = 1;
      [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].forEach(([sx, sz]) => {
        hudCtx.beginPath();
        hudCtx.moveTo(cx + sx * diagGap, cy + sz * diagGap);
        hudCtx.lineTo(cx + sx * (diagGap + diagL), cy + sz * (diagGap + diagL));
        hudCtx.stroke();
      });
    }
  }

  // Drone HP
  if (activeDrone && !activeDrone.dead) {
    const sc = w2s(activeDrone.x, activeDrone.y + 0.6, activeDrone.z);
    if (sc) {
      const BW = 60,
        BH = 6;
      const bx = sc.x - BW / 2,
        by = sc.y - 10;
      hudCtx.fillStyle = 'rgba(0,0,0,0.5)';
      hudCtx.fillRect(bx - 1, by - 1, BW + 2, BH + 2);
      hudCtx.fillStyle = 'rgba(0,180,255,0.7)';
      hudCtx.fillRect(bx, by, BW * (activeDrone.hp / activeDrone.maxHp), BH);
      hudCtx.fillStyle = 'rgba(255,255,255,0.7)';
      hudCtx.font = 'bold 8px Courier New';
      hudCtx.textAlign = 'center';
      hudCtx.fillText('DRONE', bx + BW / 2, by - 3);
    }
  }

  drawImpactZones();

  // Enemy HP bars
  const BW = 78,
    BH = 9,
    BR = 5;
  function rr(ctx, x, y, w, h, r) {
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
  for (const e of enemies) {
    if (e.dead || e.hp >= e.maxHp) continue;
    const dxe = camera.position.x - e.x,
      dze = camera.position.z - e.z;
    const dist = Math.sqrt(dxe * dxe + dze * dze);
    if (dist > ENEMY_SIGHT + 2) continue;
    const sc = w2s(e.x, e.mesh.position.y + 2.1, e.z);
    if (!sc || sc.x < -BW || sc.x > hudCanvas.width + BW || sc.y < 0 || sc.y > hudCanvas.height)
      continue;
    const alpha = Math.min(1, Math.max(0.25, 1 - (dist - 4) / 18)),
      pct = Math.max(0, e.hp / e.maxHp),
      drPct = Math.max(0, e.hpDrain / e.maxHp);
    const bx = sc.x - BW / 2,
      by = sc.y - 14;
    hudCtx.save();
    hudCtx.shadowColor = `rgba(0,0,0,${0.55 * alpha})`;
    hudCtx.shadowBlur = 4;
    hudCtx.shadowOffsetY = 2;
    rr(hudCtx, bx - 1, by - 1, BW + 2, BH + 2, BR + 1);
    hudCtx.fillStyle = `rgba(0,0,0,${0.5 * alpha})`;
    hudCtx.fill();
    hudCtx.shadowColor = 'transparent';
    hudCtx.shadowBlur = 0;
    hudCtx.shadowOffsetY = 0;
    rr(hudCtx, bx, by, BW, BH, BR);
    hudCtx.fillStyle = `rgba(15,15,15,${0.88 * alpha})`;
    hudCtx.fill();
    hudCtx.save();
    rr(hudCtx, bx, by, BW, BH, BR);
    hudCtx.clip();
    hudCtx.fillStyle = `rgba(110,14,14,${0.9 * alpha})`;
    hudCtx.fillRect(bx, by, BW * drPct, BH);
    hudCtx.restore();
    if (pct > 0) {
      hudCtx.save();
      rr(hudCtx, bx, by, BW * pct, BH, pct > 0.95 ? BR : Math.min(BR, BW * pct * 0.4));
      hudCtx.clip();
      for (let s = 0; s < HP_SEGS; s++) {
        const s0 = s / HP_SEGS,
          s1 = (s + 1) / HP_SEGS;
        if (pct <= s0) break;
        const fw = (Math.min(pct, s1) - s0) * BW;
        const eR = pct > 0.5 ? Math.floor(255 * (2 - pct * 2)) : 255,
          eG = pct > 0.5 ? 210 : Math.floor(210 * pct * 2);
        const grad = hudCtx.createLinearGradient(bx + s0 * BW, by, bx + s0 * BW, by + BH);
        grad.addColorStop(
          0,
          `rgba(${Math.min(255, eR + 60)},${Math.min(255, eG + 50)},40,${alpha})`
        );
        grad.addColorStop(0.45, `rgba(${eR},${eG},20,${alpha})`);
        grad.addColorStop(1, `rgba(${Math.floor(eR * 0.45)},${Math.floor(eG * 0.4)},8,${alpha})`);
        hudCtx.fillStyle = grad;
        hudCtx.fillRect(bx + s0 * BW, by, fw, BH);
      }
      hudCtx.fillStyle = `rgba(0,0,0,${0.5 * alpha})`;
      for (let s = 1; s < HP_SEGS; s++) {
        const sx = bx + s * (BW / HP_SEGS);
        if (sx < bx + BW * pct) hudCtx.fillRect(sx - 0.8, by, 1.6, BH);
      }
      hudCtx.restore();
    }
    hudCtx.save();
    rr(hudCtx, bx, by, BW, BH, BR);
    hudCtx.clip();
    const gg = hudCtx.createLinearGradient(bx, by, bx, by + BH * 0.45);
    gg.addColorStop(0, `rgba(255,255,255,${0.18 * alpha})`);
    gg.addColorStop(1, 'rgba(255,255,255,0)');
    hudCtx.fillStyle = gg;
    hudCtx.fillRect(bx, by, BW, BH * 0.45);
    hudCtx.restore();
    rr(hudCtx, bx, by, BW, BH, BR);
    hudCtx.strokeStyle = `rgba(0,0,0,${0.7 * alpha})`;
    hudCtx.lineWidth = 1;
    hudCtx.stroke();
    const dc =
      e.state === 'attack'
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
