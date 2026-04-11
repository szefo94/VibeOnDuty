import { renderer, scene, camera } from './scene.js';
import { PLAYER_H } from './config.js';
import { gameRunning } from './input.js';
import { player, updatePlayer } from './entities/player.js';
import { playerBody } from './builders/playerBody.js';
import { updateEnemies, tickWave } from './entities/enemies.js';
import { tickTorches } from './lighting.js';
import { drawHUD } from './hud/hud.js';
import { drawMinimap } from './hud/radar.js';

// thirdPerson state: toggled by main.js via setThirdPerson
let thirdPerson = false;
export function setThirdPerson(v) {
  thirdPerson = v;
}
export function getThirdPerson() {
  return thirdPerson;
}

const TP_DIST = 4.5,
  TP_HEIGHT = 2.2;

let last = 0;
export function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000);
  last = ts;
  if (gameRunning) {
    updatePlayer(dt);
    if (thirdPerson) {
      playerBody.position.set(camera.position.x, camera.position.y - PLAYER_H, camera.position.z);
      playerBody.rotation.y = player.yaw + Math.PI;
    }
    updateEnemies(ts, dt);
    tickTorches(dt);
    tickWave(dt);
  }
  drawMinimap(dt);
  const eyeX = camera.position.x,
    eyeY = camera.position.y,
    eyeZ = camera.position.z;
  if (thirdPerson) {
    camera.position.set(
      eyeX + Math.sin(player.yaw) * TP_DIST,
      eyeY + TP_HEIGHT,
      eyeZ + Math.cos(player.yaw) * TP_DIST
    );
    camera.lookAt(eyeX, eyeY + 0.3, eyeZ);
  }
  renderer.render(scene, camera);
  if (thirdPerson) camera.position.set(eyeX, eyeY, eyeZ);
  drawHUD();
  requestAnimationFrame(loop);
}

export function startLoop() {
  last = performance.now();
  requestAnimationFrame(loop);
}
