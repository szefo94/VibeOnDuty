import { scene } from '../scene.js';
import { showMsg } from '../hud/overlay.js';
import { ammoDrops } from './ammoDrops.js';
import { rebuildEHM } from '../combat/shoot.js';
import { isSndActive } from '../modes/snd.js';

export let wave = 1;
export let respawnTimer = -1;

// enemies + spawnEnemyIntoSlot passed by loop.js to avoid circular dep with enemies.js
export function tickWave(dt, enemies, spawnEnemyIntoSlot) {
  if (isSndActive()) return;
  if (respawnTimer <= 0) return;
  respawnTimer -= dt * 1000;
  const secs = Math.ceil(respawnTimer / 1000);
  showMsg(`WAVE ${wave} INCOMING IN ${secs}...`, 1100);
  if (respawnTimer <= 0) {
    respawnTimer = -1;
    ammoDrops.forEach((d) => scene.remove(d.mesh));
    ammoDrops.length = 0;
    enemies.forEach((e) => spawnEnemyIntoSlot(e));
    rebuildEHM();
    showMsg(`WAVE ${wave} — ENGAGE!`, 2500);
  }
}

export function triggerWaveEnd() {
  wave++;
  showMsg(`ZONE CLEARED — WAVE ${wave - 1} COMPLETE`, 3500);
  respawnTimer = 5000;
}
