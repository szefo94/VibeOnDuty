import { player } from '../entities/player.js';
import { MAX_HP } from '../config.js';

export function updateHUD() {
  document.getElementById('ammo-cur').textContent = player.ammo;
  document.getElementById('ammo-rsv').textContent = player.reserve;
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
export function triggerHitFlash() {
  player.lastHitTime = performance.now();
  const f = document.getElementById('hitflash');
  f.style.opacity = '1';
  setTimeout(() => (f.style.opacity = '0'), 110);
}
