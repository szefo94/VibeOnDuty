# VIBE ON DUTY — Development Roadmap

## Current State

```
index.html              — HTML shell (entry: src/main.js)
style.css               — all styles
vite.config.js          — Vite entry: index.html
src/
  main.js               — DOM listeners, start buttons, asset-gated init
  loop.js               — game loop, 3rd-person camera, lean offset, drone tick
  config.js             — all game constants (player, enemy, S&D, physics)
  events.js             — 4-line pub/sub event bus (on/off/emit)
  map.js                — MAP, HMAP, mapCell, hAt, groundElevation, canMoveTo
  math.js               — normA, slerp
  astar.js              — A* pathfinding with dev-mode failure logging
  level.js              — level geometry — exports wallMeshes, debugLines
  scene.js              — renderer, scene, camera, hudCanvas, hudCtx
  materials.js          — mm(), shared MeshStandardMaterials
  lighting.js           — ambient, sun, fill, torches — exports tickTorches
  input.js              — keys, locked, gameRunning, mouseHeld, setGameRunning
  touch.js              — mobile touch controls
  modes/
    modeManager.js      — setMode/getMode/isAnyModeActive (zero-dep registry)
    snd.js              — S&D match state machine, round lifecycle, bomb logic
  ai/
    enemyStates.js      — PATROL/SPOTTED/ATTACK + transitionTo, alertEnemy, semiAlertEnemy
  builders/
    weapon.js           — player weapon model
    playerBody.js       — full soldier body
    enemy.js            — ground soldier model (procedural fallback)
    drone.js            — drone model (procedural)
    enemyGLTF.js        — GLTF enemy + player mesh loader
    enemyAnimations.js  — AnimationMixer crossfade
    enemyWeapon.js      — enemy pistol GLTF
    weaponFBX.js        — player M4/P90 FBX loader
    assetManager.js     — register/loadAll parallel asset registry
  combat/
    shoot.js            — bullet physics, hit detection, weapon anim, spray
    damage.js           — grenade falloff, entity/player damage formulas
  entities/
    entityBase.js       — applyEntityBase mixin (isAlive, takeDamage)
    player.js           — player state, movement, dive, lean, reload
    enemies.js          — enemy AI loop, S&D team spawn, kill/death events
    friendlyBots.js     — allied bot AI (A*, LOS, bot-vs-bot shooting)
    drone.js            — drone runtime (AI, EMP, orbit, S&D recon drones)
    waveSystem.js       — wave state, tickWave, triggerWaveEnd
    ammoDrops.js        — ammo pickup spawn and collection
    grenades.js         — grenade throw, flight, explosion
  utils/
    los.js              — hasLOS raycaster utility
  fx/
    tracers.js          — enemy muzzle tracers
    impacts.js          — bullet impact sparks
    particles.js        — grenade particles + impact zones
    meleeRange.js       — melee ring flash
  hud/
    overlay.js          — updateHUD, showMsg, showStatus, triggerHitFlash
    hitmarker.js        — hitMarkerT, spawnHitMarker, tickHitMarker
    hud.js              — drawHUD dispatcher (35 lines)
    rings.js            — ammo/energy/reload rings + spray cone; healthColor helper
    enemyBars.js        — drone bar, grenade impact zones, enemy HP bars
    radar.js            — drawMinimap (canvas)
    sndHud.js           — S&D match header, bomb timer, plant/defuse bars, result overlay
  *.test.js             — Vitest unit tests (54 tests, 5 files)
tests/
  smoke.spec.js         — Playwright smoke tests (7 tests)
types/
  entities.d.ts         — EntityBase, Enemy, Player, Drone, AiState, AiCtx interfaces
```

> **Run:** `npm run dev` — Vite dev server. Do NOT open via `file://`.

---

## Completed

| Phase | Summary |
|-------|---------|
| 1–4 | npm + Vite, module split from monolithic game.js, Vitest + Playwright, ESLint/Prettier/TS |
| 5 | Velocity movement, stagger on hit, A\* throttle, drone orbit + EMP, 3rd-person camera, lean, dive |
| 6 | GLTF enemy + player mesh, AnimationMixer crossfade, M4/P90 FBX, enemy pistol GLTF |
| 7 | S&D mode: best-of-7, two sites, plant/defuse, 60 s timer, 5v5 bot teams, round lifecycle |
| 8 | `los.js`, `friendlyBots.js`, `waveSystem.js`, `sndHud.js` extracted; 21 S&D unit tests |
| 9 | `entityBase.js` mixin, AI state machine in `ai/enemyStates.js`, TS interfaces |
| 10 | `events.js` pub/sub; enemies/waveSystem emit events instead of direct cross-module calls |
| 11 | `assetManager.js` with `register`/`loadAll`; start buttons gated until all assets resolve |
| 12 | Drone constants to module scope, grenade→drone damage fix, A\* diagnostic, state guard |
| 13 | Dead `ehm`/`rebuildEHM` removed (bullet detection uses distance, not raycasting) |
| 14 | HUD split: `rings.js` (player rings), `enemyBars.js` (bars + impact zones), `hud.js` → 35 lines |
| 15 | `modeManager.js`; `snd.js` decoupled from loop/enemies/drone/waveSystem via event bus |

---

## Upcoming

### Phase 16 — Drone GLTF *(stretch — needs asset)*

Wire `src/builders/droneGLTF.js` once `public/models/drone.glb` is available. Register as `'drone-glb'` in `assetManager`. Procedural fallback stays if asset missing.

---

### Phase 17 — Audio system

Web Audio API with spatial sound via `PannerNode` (positioned relative to camera). No external library needed — Three.js `AudioListener` + `PositionalAudio` or raw `AudioContext` both work.

- Gunshot blast (player + enemy), footstep surface detection, grenade explosion
- Bomb plant/defuse tick, round-start countdown
- Ambient loop, alert bark when enemy spots player
- Mute/volume control in overlay

---

### Phase 18 — Weapon expansion

The P90 FBX loader already exists (`weaponFBX.js`) but the P90 is never selectable. Make weapons a first-class concept.

- Per-weapon config block in `config.js` (damage, fire rate, spray pattern, mag size, reload time, ADS FOV)
- Key `1`/`2` to switch M4 ↔ P90; pistol as tertiary (`3`)
- Weapon indicator in HUD (icon + active ammo ring)
- S&D round reset applies full loadout per weapon

---

### Phase 19 — Game feel pass

Small changes, large perceived impact:

- **Screen shake** — translate `renderer.domElement` for ~80 ms on explosion/grenade hit
- **Kill feed** — top-right sliding log: `[PLAYER] ✕ [ENEMY]`, auto-dismiss after 4 s
- **Post-round stats overlay** — kills, deaths, plants, defuses, accuracy; dismiss on `TAB`
- **Smoke cloud** — spawn a billow particle group on grenade detonation (separate from sparks)
- **Hit direction indicator** — arc on the HUD edge pointing toward damage source

---

### Phase 20 — Second map + map selector

- Design a second tilemap (rooftop / outdoor) with different site positions and spawn zones
- `level.js` accepts a map data argument instead of hardcoding MAP import
- Map select screen on the overlay before mode select
- S&D site coordinates become part of the map config rather than constants in `config.js`

---

### Phase 21 — Multiplayer foundation

Real-time player vs. player using WebSocket relay (Cloudflare Worker or small Node server).

- Authoritative tick: server echoes position packets, resolves kills
- Client sends: position, facing, actions (shoot, grenade, plant)
- Server sends: enemy positions, hit confirmations, round state
- Chat / team callout system (`Y` for team, `U` for all)
- AI bots fill empty team slots below 5

---

### Phase 22 — Performance & LOD

- Skip AI tick for enemies outside `ENEMY_SIGHT * 1.5` and not on path to player
- Particle budget cap — keep a global counter; oldest particles evicted when over limit
- Enemy mesh LOD: swap to a simpler geometry beyond 20 units (Three.js `LOD` object)
- Profile with `performance.mark` in the game loop; surface frame budget in debug overlay

---

### Phase 23 — Mobile & gamepad

Touch controls exist (`touch.js`) but are minimal.

- Virtual joystick (left thumb: move, right thumb: look) using pointer events
- Fire button, grenade button, crouch toggle in corners
- Gamepad API: `navigator.getGamepads()` polled each frame; axes mapped to movement/look
- HUD scales to viewport — replace fixed pixel sizes with `vmin`-based canvas layout

---

### Phase 24 — Progression & persistence

- `localStorage` store: lifetime kills, matches won, best wave, accuracy
- Match-end scoreboard (K/D/A, accuracy %, plants/defuses) with share-to-clipboard
- Kill streak rewards: 3-kill → ammo refill, 5-kill → drone strike (reuses recon drone logic), 7-kill → EMP across map
- Wave mode: difficulty ramp-up curve (enemy speed + damage increase per wave tier)
