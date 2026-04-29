import { player } from '../entities/player.js';
import { camera } from '../scene.js';
import { MAX_HP, WEAPONS } from '../config.js';

export function updateHUD() {
  document.getElementById('ammo-cur').textContent = player.ammo;
  document.getElementById('ammo-rsv').textContent = player.reserve;
  document.getElementById('weapon-name').textContent = WEAPONS[player.weapon]?.name ?? 'M4A1';
  const hpPct = player.hp / MAX_HP;
  document.getElementById('hp-num').textContent = Math.round(player.hp);
  const hpCol = player.hp > 50 ? '#2ecc71' : player.hp > 25 ? '#e67e22' : '#e74c3c';
  document.getElementById('hp-num').style.color = hpCol;
  document.getElementById('player-hp-bar').style.width = hpPct * 100 + '%';
  document.getElementById('player-hp-bar').style.background = hpCol;
  document.getElementById('energy-label').textContent = `ENERGY: ${Math.floor(player.energy)}%`;
  document.getElementById('vignette').style.boxShadow =
    player.hp < 40 ? `inset 0 0 130px rgba(200,0,0,${0.35 * (1 - player.hp / 40)})` : 'none';
}

let msgT = null,
  statusT = null;
export function showMsg(txt, dur = 2000) {
  const m = document.getElementById('msg');
  m.textContent = txt;
  m.style.opacity = '1';
  clearTimeout(msgT);
  msgT = setTimeout(() => (m.style.opacity = '0'), dur);
}
export function showStatus(txt, dur = 1200) {
  const m = document.getElementById('status');
  m.textContent = txt;
  m.style.opacity = '1';
  clearTimeout(statusT);
  statusT = setTimeout(() => (m.style.opacity = '0'), dur);
}
export function triggerHitFlash(srcX, srcZ) {
  player.lastHitTime = performance.now();
  if (srcX !== undefined && srcZ !== undefined) {
    const dx = srcX - camera.position.x;
    const dz = srcZ - camera.position.z;
    const yaw = player.yaw;
    // Project world delta onto camera-local right/forward to get screen-space angle.
    // Right = (cos yaw, 0, -sin yaw), Fwd = (-sin yaw, 0, -cos yaw)
    const rightDot = dx * Math.cos(yaw) + dz * (-Math.sin(yaw));
    const fwdDot   = dx * (-Math.sin(yaw)) + dz * (-Math.cos(yaw));
    player.lastHitDir = Math.atan2(rightDot, fwdDot); // 0=front, PI/2=right, PI=behind
  }
  const f = document.getElementById('hitflash');
  f.style.opacity = '1';
  setTimeout(() => (f.style.opacity = '0'), 110);
}

export function showKillFeed(label = 'ENEMY') {
  const feed = document.getElementById('kill-feed');
  if (!feed) return;
  const entry = document.createElement('div');
  entry.className = 'kill-feed-entry';
  entry.textContent = `YOU ✕ ${label}`;
  feed.appendChild(entry);
  setTimeout(() => { entry.style.opacity = '0'; }, 3500);
  setTimeout(() => { if (feed.contains(entry)) feed.removeChild(entry); }, 4000);
  while (feed.children.length > 5) feed.removeChild(feed.firstChild);
}
