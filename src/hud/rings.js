import { hudCtx, hudCanvas } from '../scene.js';
import { MAX_AMMO, GRENADE_ENERGY_COST, MAX_ENERGY, RELOAD_MS } from '../config.js';
import { player } from '../entities/player.js';
import { sprayHeat } from '../combat/shoot.js';

// Maps a 0-1 pct to a red-to-green RGB pair (used by ammo ring and enemy bars).
export function healthColor(pct, gMax = 220) {
  const r = pct > 0.5 ? Math.floor(255 * (2 - pct * 2)) : 255;
  const g = pct > 0.5 ? gMax : Math.floor(gMax * pct * 2);
  return { r, g };
}

export function drawRings() {
  const cx = hudCanvas.width / 2,
    cy = hudCanvas.height / 2;

  // Scale ring radii proportionally to viewport so they look the same on mobile + desktop.
  // 900 is the design reference (shortest dimension for a 1600×900 display).
  const vs = Math.min(hudCanvas.width, hudCanvas.height) / 900;

  // ── Ammo ring ──────────────────────────────────────────────────────────
  const ammoR = 34 * vs, ammoW = 5 * vs;
  const ammoPct   = player.ammo / MAX_AMMO;
  const ammoAngle = ammoPct * Math.PI * 2;
  const { r: aR, g: aG } = healthColor(ammoPct);

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
    ag.addColorStop(0,   `rgba(${aR},${Math.min(255, aG + 60)},80,0.45)`);
    ag.addColorStop(0.5, `rgba(${aR},${aG},20,0.50)`);
    ag.addColorStop(1,   `rgba(${Math.floor(aR * 0.5)},${Math.floor(aG * 0.4)},8,0.45)`);
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
      hudCtx.moveTo(cx + Math.cos(a) * (ammoR - ammoW * 0.5), cy + Math.sin(a) * (ammoR - ammoW * 0.5));
      hudCtx.lineTo(cx + Math.cos(a) * (ammoR + ammoW * 0.5), cy + Math.sin(a) * (ammoR + ammoW * 0.5));
      hudCtx.strokeStyle = i < player.ammo ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.0)';
      hudCtx.lineWidth = 0.8;
      hudCtx.stroke();
    }
  }

  // ── Energy ring ────────────────────────────────────────────────────────
  const energyR = 44 * vs, energyW = 4 * vs;
  const energyPct = player.energy / MAX_ENERGY;

  hudCtx.beginPath();
  hudCtx.arc(cx, cy, energyR, 0, Math.PI * 2);
  hudCtx.strokeStyle = 'rgba(0,0,0,0.12)';
  hudCtx.lineWidth = energyW + 1;
  hudCtx.stroke();

  if (energyPct > 0) {
    const full = player.energy >= GRENADE_ENERGY_COST;
    if (full) {
      const pulse = 0.7 + Math.sin(performance.now() / 180) * 0.3;
      hudCtx.beginPath();
      hudCtx.arc(cx, cy, energyR, 0, Math.PI * 2);
      hudCtx.strokeStyle = `rgba(50,255,200,${pulse * 0.1})`;
      hudCtx.lineWidth = energyW + 6;
      hudCtx.stroke();
    }
    hudCtx.beginPath();
    hudCtx.arc(cx, cy, energyR, -Math.PI / 2, -Math.PI / 2 + energyPct * Math.PI * 2);
    hudCtx.strokeStyle = full ? 'rgba(50,255,200,0.55)' : 'rgba(60,160,255,0.48)';
    hudCtx.lineWidth = energyW;
    hudCtx.lineCap = 'round';
    hudCtx.stroke();
    hudCtx.lineCap = 'butt';
  }

  // ── Reload ring ────────────────────────────────────────────────────────
  if (player.reloading) {
    const rp = 1 - player.reloadTimer / RELOAD_MS;
    const reloadR = energyR + energyW + 5 * vs;
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

  // ── Hit direction indicator ────────────────────────────────────────────
  if (player.lastHitDir !== undefined && player.lastHitTime) {
    const elapsed = performance.now() - player.lastHitTime;
    if (elapsed < 1500) {
      const alpha = (1 - elapsed / 1500) * 0.88;
      // lastHitDir: 0=front, PI/2=right — canvas arc 0=right so subtract PI/2 to put 0 at top
      const canvasAngle = player.lastHitDir - Math.PI / 2;
      const r = Math.min(cx, cy) * 0.62;
      hudCtx.beginPath();
      hudCtx.arc(cx, cy, r, canvasAngle - 0.28, canvasAngle + 0.28);
      hudCtx.strokeStyle = `rgba(255,40,40,${alpha})`;
      hudCtx.lineWidth = 6;
      hudCtx.lineCap = 'round';
      hudCtx.stroke();
      hudCtx.lineCap = 'butt';
    }
  }

  // ── Spray cone ─────────────────────────────────────────────────────────
  if (sprayHeat > 0.02) {
    const gap     = (10 + sprayHeat * 28) * vs;
    const lineLen = (6  + sprayHeat * 10) * vs;
    const alpha   = Math.min(0.85, sprayHeat * 1.2);
    const cR = sprayHeat > 0.5 ? 255 : Math.floor(255 * sprayHeat * 2);
    const cG = sprayHeat > 0.5 ? Math.floor(255 * (1 - sprayHeat) * 2) : 255;
    hudCtx.strokeStyle = `rgba(${cR},${cG},30,${alpha})`;
    hudCtx.lineWidth = 1.5;
    hudCtx.lineCap = 'round';
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      hudCtx.beginPath();
      hudCtx.moveTo(cx + dx * gap, cy + dy * gap);
      hudCtx.lineTo(cx + dx * (gap + lineLen), cy + dy * (gap + lineLen));
      hudCtx.stroke();
    }
    hudCtx.lineCap = 'butt';
    if (sprayHeat > 0.6) {
      const diagGap = gap * 0.7, diagL = lineLen * 0.6, diagA = alpha * 0.5;
      hudCtx.strokeStyle = `rgba(${cR},${cG},30,${diagA})`;
      hudCtx.lineWidth = 1;
      for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        hudCtx.beginPath();
        hudCtx.moveTo(cx + sx * diagGap, cy + sz * diagGap);
        hudCtx.lineTo(cx + sx * (diagGap + diagL), cy + sz * (diagGap + diagL));
        hudCtx.stroke();
      }
    }
  }
}
