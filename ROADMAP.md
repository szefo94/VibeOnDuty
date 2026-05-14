# VIBE ON DUTY — Development Roadmap

## Current State

```
index.html              — HTML shell (entry: src/main.js)
style.css               — all styles
vite.config.js          — Vite entry: index.html
src/
  main.js               — DOM listeners, start buttons, asset-gated init, map registry
  loop.js               — game loop, 3rd-person camera, lean offset, drone tick
  config.js             — all game constants (player, enemy, S&D, physics)
  events.js             — 4-line pub/sub event bus (on/off/emit)
  map.js                — live-binding MAP/HMAP exports, setActiveMap(def)
  math.js               — normA, slerp
  astar.js              — A* pathfinding with dev-mode failure logging
  level.js              — buildLevel(mapDef) — exports wallMeshes, debugLines
  scene.js              — renderer, scene, camera, hudCanvas, hudCtx
  materials.js          — mm(), shared MeshStandardMaterials
  lighting.js           — ambient, sun, fill, torchLights[] — exports tickTorches
  input.js              — keys, locked, gameRunning, mouseHeld, setGameRunning
  touch.js              — mobile touch controls
  gamepad.js            — Standard Gamepad API (left stick, right stick, all buttons mapped)
  maps/
    bunker.js           — Greek Columns mapDef (complex arena, ramps, cracks, torches)
    rooftop.js          — Rooftop District mapDef (outdoor, HVAC cover, daylight)
    concept.js          — Column Arena mapDef (marble pillar prototype)
    range.js            — Training Range mapDef (56×80 m flat hall, 9 target slots, strip lights)
    vanguard.js         — Vanguard Complex mapDef (24×24, 3 floors at 0/3/6 m, dark industrial)
  difficulty.js         — setDifficulty/getDifficulty; _override API for adaptive mode (setDifficultyOverride/clearDifficultyOverride)
  modes/
    modeManager.js      — setMode/getMode/isAnyModeActive (zero-dep registry)
    snd.js              — S&D match state machine, round lifecycle, bomb logic
    tdm.js              — Team Deathmatch — score, respawn queues, 10-min timer
    trainingRange.js    — Training Range drills (free/flick/reaction/hostage), preset panel, HUD
    economy.js          — S&D cash ledger (kill/plant/defuse bonuses, loss streak)
    buyMenu.js          — S&D buy phase UI, weapon shop, 10 s countdown
  ai/
    enemyStates.js      — PATROL/SPOTTED/ATTACK + transitionTo, alertEnemy, semiAlertEnemy; sniper hold-position
    difficultyAdapter.js — rolling K/D window (60 s), level 1–10, evaluates every 30 s, lerps Recruit→Elite
  builders/
    weapon.js           — player weapon model — 4 weapons (m4/p90/awp/pistol), 1p+3p sub-groups, show1pWeapon/show3pWeapon
    playerBody.js       — full soldier body (weapon3p parented here; reparented to hand_r by GLTF loader)
    enemy.js            — ground soldier model (procedural fallback)
    drone.js            — drone model (procedural)
    enemyGLTF.js        — GLTF enemy + player mesh loader; buildEnemyMesh(wx,wz,role)
    enemyAnimations.js  — AnimationMixer crossfade
    enemyWeapon.js      — role-based procedural enemy weapons (assault/smg/sniper/pistol); FBX pistol fallback
    weaponFBX.js        — player M4/P90 FBX loader; attachWeapons3pToHand
    assetManager.js     — register/loadAll parallel asset registry
  combat/
    shoot.js            — bullet physics, hit detection, weapon anim, spray — per-weapon damage/fireRate/sprayMax
    damage.js           — grenade falloff, entity/player damage formulas
  entities/
    entityBase.js       — applyEntityBase mixin (isAlive, takeDamage)
    player.js           — player state, movement, dive, lean, reload; per-weapon ammo/reserve/weaponAmmo map
    enemies.js          — enemy AI loop, S&D team spawn, kill/death events; deactivateAllEnemies
    friendlyBots.js     — allied bot AI (A*, LOS, bot-vs-bot shooting)
    drone.js            — drone runtime (AI, EMP, orbit, S&D recon drones)
    waveSystem.js       — wave state, tickWave, triggerWaveEnd
    ammoDrops.js        — ammo pickup spawn and collection
    grenades.js         — grenade throw, flight, explosion
    targetDummy.js      — range target mesh, pop/drop animation, hit flash, spring/sine movement
  utils/
    los.js              — hasLOS raycaster utility
  fx/
    tracers.js          — enemy muzzle tracers
    impacts.js          — bullet impact sparks
    particles.js        — grenade sparks + smoke cloud + impact zones; 90-particle budget cap
    meleeRange.js       — melee ring flash
    screenShake.js      — triggerScreenShake / tickScreenShake (CSS translate on canvas)
  hud/
    overlay.js          — updateHUD, showMsg, showStatus, triggerHitFlash(srcX,srcZ), showKillFeed
    hitmarker.js        — hitMarkerT, spawnHitMarker, tickHitMarker
    hud.js              — drawHUD dispatcher; setDebugAnimClip + setDebugFrameMs (⏱ in F3 panel)
    rings.js            — ammo/energy/reload rings + spray cone + hit-dir arc; viewport-scaled; healthColor
    enemyBars.js        — drone bar, grenade impact zones, enemy HP bars
    radar.js            — drawMinimap (canvas)
    sndHud.js           — S&D match header, bomb timer, plant/defuse bars, result overlay
  editor/
    mapEditor.js        — 2D canvas grid editor; all tile types, 3-floor tabs, undo (80 ops), fill/rect/zoom/mirror tools, variable map size (12–48), 5 sky/fog presets, save slots (localStorage×5), map name+desc, minimap thumbnail, playtest, 3D preview, base-64 export/import, URL ?map= sharing; exports mapDefFromB64 for main.js
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
| 16 (patch) | Circular ESM dep broken: `snd:configure` event-bus injection in `enemyStates.js` + `enemies.js` |
| 20 | Screen shake (`screenShake.js`), kill feed, smoke cloud, hit-direction arc in `rings.js` |
| 23 | AI tick culling for distant patrollers, 90-particle budget cap, frame-time in F3 debug panel |
| 24 | Gamepad API (`gamepad.js`), viewport-relative HUD ring scaling in `rings.js` |
| bugfix | Dance animation set to `LoopOnce`; `finished` event auto-clears `player.dancing` |
| 21 | Three maps: Greek Columns (original arena), Rooftop District, Column Arena concept. `buildLevel(mapDef)` refactor, `setActiveMap` live bindings, per-map spawn/sites/lighting/fog. Map selector overlay with 3 cards. Fixed rooftop player spawn + HVAC pillar rendering. |
| 18 | 4-weapon system — M4A1 / P90 / AWP / Pistol on keys 1–4. Per-weapon config in `config.js` (damage, fireRate, sprayMax, sprayGrow, reload, maxAmmo, reserve, adsZoom). Per-weapon ammo state in `player.weaponAmmo`/`weaponReserve`, saved/restored on switch. Weapon name in HUD; ammo ring scales to active weapon mag. ADS FOV per weapon. `show1pWeapon`/`show3pWeapon` toggle sub-group visibility. Status feedback on every key press including same-weapon re-press. Reload bar driven by `player.reloadTotal`. |
| 18+ | Enemy weapon roles — `buildEnemyWeapon3p(role)` generates assault/smg/sniper/pistol procedural meshes; `attachEnemyWeapon(root, role)` replaces per-enemy pistol. `buildEnemyMesh` accepts `role` param passed through from `spawnEnemyIntoSlot`. S&D fixed `SND_ROLES[10]` array specialises each bot slot (sniper holds, SMG rushes). 3p player weapon fix: `weapon3p` added to `playerBody` before async IIFE so `attachWeapons3pToHand` can correctly reparent it to `hand_r`. |
| 35 (partial) | **Team Deathmatch** — `src/modes/tdm.js`. First to 50 kills wins or 10-minute timer. Player respawns after 3 s; enemies respawn after 3 s via queue in TDM tick. `enemy:killed` / `player:died` events drive score tracking and respawn. `getMode()?.name` gating in `killEnemy` and `triggerDeath` ensures S&D round events don't fire in TDM. v1: 10 enemies vs player solo (no friendly bots in TDM yet). |
| 39 (partial) | **Difficulty system** — `src/difficulty.js` + `DIFFICULTY_PRESETS` in `config.js`. 4 tiers (Recruit / Regular / Veteran / Elite) each define `reactMin/Max`, `shootCd`, `damage`, `speedMult`, `aimThresh`, `hp`, `sight`, `strafeChance`. Enemy AI in `enemyStates.js` reads `getDifficulty()` live — reaction delay, shoot cooldown, damage, aim threshold, speed. `_tickStrafe()` added to `ATTACK_STATE`: perpendicular velocity applied each frame, direction flips on timer, active only when `strafeChance > 0`. Recruit: stands still, slow, 70 HP, 16 m sight. Elite: 60–150 ms reaction, 420 ms shoot CD, always strafing, 160 HP, 30 m sight. Picker on main overlay; `setDifficulty` called on card click. `rebuildAllEnemies()` called at game start (not just asset load) so chosen HP applies immediately. |
| 32 | **Training Range** — `src/modes/trainingRange.js` + `src/entities/targetDummy.js` + `src/maps/range.js`. Dedicated 56×80 m flat hall with 9 procedural targets (3 short / 3 medium / 3 long zone). Four drill modes: Free Practice (all targets up, 1.5 s respawn), Flick Drill (60 s; one lit hostile at a time, hit within difficulty window), Reaction Drill (20 pop appearances with configurable up-time window), Hostage Gauntlet (free practice with live +1/−1 score). Hostile targets have red-glowing heads; hostage targets have green-glowing heads. Hit flash, hitmarker, floating damage numbers. Preset panel (`P` key, pointer-lock released) with 6 sections: DRILL, DIFFICULTY (Beginner 2.5 s / Normal 1.5 s / Hard 0.8 s / Elite 0.4 s), TARGETS (Full/Short/Medium/Long/Hostile Only), MOVEMENT (H+V independent checkboxes), H PATTERN (Sine / Spring strafe physics), H SPEED (Slow / Medium / Fast). Horizontal movement sweeps full corridor width (6–50 m). Spring mode uses spring-damper physics with per-speed configs (k, damp, maxV, goal interval). Sine mode: 0.04/0.10/0.22 Hz per speed index. Vertical: sinusoidal bob 0–0.55 m at 0.65 Hz. Live HUD: drill name, timer/score (Hostage Gauntlet shows coloured score), hit count, accuracy, headshots, streak, avg reaction, penalties. `Tab` cycles drills. Infinite ammo. Enemies deactivated via `deactivateAllEnemies()`. |
| map | **Vanguard Complex** — `src/maps/vanguard.js`. 24×24, 3 floors (base 0/3/6 m, each 3 m tall). NW stairwell (floor 0→1, ramp tiles 13+17), SE stairwell (floor 0→1, ramp tiles 12+16), centre stairwell (floor 1→2, ramp tiles 21+25). Floor-1 perimeter balcony ring (hm=3.0), N-S centre bridge (rows 11-12). Floor-2 enclosed top room (rows 2-5, cols 7-16) with south window openings. Dark industrial material palette (0x3a3a42 / 0x5a5a66). Dynamic overhead point lights on all 3 floors. Voids above ramp cells suppress slab rendering. |
| pause | **Pause menu** — Escape releases pointer lock during gameplay; `pointerlockchange` listener shows `#pause-menu` overlay (z-index 25) with RESUME and MAIN MENU buttons. `returnToMainMenu()` resets all player/game state and returns to the main overlay. |
| 38 | **AWP Sniper Polish** — Scope vignette: `#scope-overlay` radial-gradient overlay (z-index 15) with full-screen crosshair lines; fades in with `player.aimT`, hides regular crosshair. AWP sway: Brownian oscillator (`_awpVX/Y → _awpSwayX/Y`) runs in `updateWeapon()`; strongly damped by `player.holdBreath` (Shift+ADS+AWP). Bullet drop: AWP bullets tagged `isSniper=true`; `tickBullets` applies extra 9.8 m/s² gravity. Sniper bots: `weaponRole==='sniper'` in ATTACK_STATE skips movement and strafe, only rotates to face player and fires. |
| 39 | **Adaptive Difficulty** — Separate `[ ADAPTIVE ]` mode button (purple). `src/ai/difficultyAdapter.js`: rolling 60 s kill/death window evaluated every 30 s; level 1–10 linearly interpolates all parameters between Recruit and Elite presets via `setDifficultyOverride()`. Starts at level 5. `adaptStop()` on main menu return clears override. `adaptTick(dt)` called in game loop. |
| bugfix | **Drone death fall + smoke** — `killDrone()` no longer removes the mesh immediately; sets `d.dying=true` with random tumble spin. Fall phase in `updateDrone()`: 22 m/s² gravity, X/Z rotation tumble, `spawnSmokeCloud` trail every 70 ms. On ground contact: 4-puff burst smoke, mesh removed, `activeDrone` nulled. `loop.js` updated to tick dying drones (`!dead \|\| dying`). Respawn delay bumped 3 s → 4.5 s. |
| bugfix | **Crack & column collision** — Cracks (tile 2/3) now block movement with a thin-slab distance check (`\|offset from wall centreline\| < 0.175 + PLAYER_R`) instead of a full-cell block, matching the 0.35 m visual geometry. Columns (tile 28) replaced full-cell AABB with circular distance (`colRadius 0.62 + PLAYER_R = 0.97 m`) so players can approach naturally. |
| 37 | **In-Browser Map Editor** — `src/editor/mapEditor.js`. Full 2D canvas grid view, paint toolbar covering all tile types (floor, wall, crack H/V, ramp N/S/E/W, diagonal/revolved/bilinear ramps, column, side wall bitmask). 3-floor tabs (Ground / F1 / F2) with per-floor height tools (6 levels: 0→F2½). Marker tools for player spawn, attacker/defender spawns, bomb sites A/B. Rotate shortcut (R). Undo stack (80 ops, Ctrl+Z). 3D preview (P key — live `buildLevel()` call, Esc to return). Export/import: `btoa/atob` base-64 JSON, copy-to-clipboard, URL `?map=<b64>` sharing, paste-import via textarea. v1→v2 format migration on import. |
| 40 | **Map Editor v2** — Fill (bucket) tool with BFS flood-fill + batch undo; Rectangle tool with live gold preview rect + batch undo; scroll-to-zoom (8–40 px/tile, scrollable canvas container); Mirror/symmetry mode cycling Off→H→V→Both applied per brush stroke; variable map size 12–48 via New Map dialog with sliders; 5 named localStorage save slots (click=load, dbl-click=save, Ctrl+S/1–5); map name + description fields stored in export; 5 sky/fog presets (Default/Outdoor/Bunker/Night/Dawn) stored as `skyPreset` index; Playtest button launches Wave mode with enemies then returns to editor on Esc; 48×48 minimap thumbnail embedded in export; `mapDefFromB64` pure decoder; `main.js` reads `?map=` param and injects a custom map card into the selector with thumbnail, name, and desc. |

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

### ~~Phase 18 — Weapon expansion~~ ✅ Done

See Completed table — 4-weapon system with per-weapon config, ammo, reload, spray, ADS FOV, HUD indicator, and S&D team role specialisation.

---

### Phase 19 — Weapon buy menu + Grenade arsenal (S&D)

Counter-Strike style buy phase at the start of each S&D round. Player spawns with pistol only; every other weapon must be purchased. Buy window is open for the first **10 s** of the round, or closes early if the player **moves out of spawn radius** (forces commitment). Grenade slots are separate from weapon slots — player can carry one primary, one sidearm, and up to two grenades simultaneously.

#### Buy phase flow

1. Round starts → `round:buyPhase` event emits with `{ deadline: timestamp }`.
2. Player sees a **"BUY PHASE — 10s"** countdown banner and cash balance in the top-left HUD.
3. `B` opens the buy overlay (pointer lock released, game paused for player only — bots still move).
4. Player clicks a weapon or grenade row → purchase confirmed → menu closes → pointer lock re-acquired.
5. Timer expires OR player crosses spawn boundary → buy phase ends, `round:buyPhaseEnd` emits → menu force-closes, weapon locked in for the round.
6. On death mid-round: weapon drops to pistol, cash unchanged.

#### Economy

| Event | Cash delta |
|---|---|
| Match start | +$800 |
| Kill enemy | +$300 |
| Plant bomb | +$300 |
| Defuse bomb | +$300 |
| Win round | +$900 |
| Lose round (1st consecutive loss) | +$1 400 |
| Lose round (2nd consecutive loss) | +$1 900 |
| Lose round (3+ consecutive losses) | +$2 400 |
| Death (no reset, pistol cost refunded) | — |

Loss bonus caps at $2 400 (3+ streak) and resets to $1 400 on a win — same cadence as CS2. Max balance capped at **$16 000**. Minimum floor after any round: **$500** (always able to buy a grenade).

Balance displayed in HUD top-left only during buy phase; hidden during active play to reduce clutter.

#### Weapon & equipment price list

| Item | Key | Price | Notes |
|---|---|---|---|
| M4A1 | `m4` | $2 900 | Full-auto rifle |
| P90 | `p90` | $2 350 | SMG, 50-round mag |
| AWP | `awp` | $4 750 | One-shot bolt-action |
| Pistol | `pistol` | $500 | Default sidearm, free on first round |
| Frag grenade | `frag` | $200 | Classic lethal throw |
| Smoke grenade | `smoke` | $300 | Opaque sphere, 8 s duration, blocks LOS for bots too |
| Flashbang | `flash` | $200 | Blinds player + bots in cone for 1.5 s |
| Molotov | `molotov` | $400 | Burning floor zone, 4 s, deals tick damage |

Prices live in `config.js` under each weapon's entry (`WEAPONS['m4'].price = 2900`). Grenades get their own `GRENADES` map in `config.js`.

#### Grenade arsenal detail

The player can carry a **max of two grenade slots** (e.g. one smoke + one frag). Each grenade type can only be carried once. Throw mechanic is already in place (middle mouse / `G`); the buy menu just gates access and charges cash.

| Type | Visual | Behaviour |
|---|---|---|
| Frag | Red sphere | Explodes after 3 s or on impact; lethal radius 3 m, damage falloff |
| Smoke | Grey-white expanding sphere | `MeshBasicMaterial` semi-transparent sphere; bot `hasLOS` returns false through it |
| Flashbang | White burst | Fullscreen white overlay + FOV distortion on any entity within 8 m and LOS |
| Molotov | Orange particle floor | Particle emitter + floor plane; tick damage 8/s to any entity standing in it |

Smoke and molotov require new visual FX. Frag and flashbang reuse/extend the existing grenade system.

#### Bot economy & auto-buy logic

Bots share the same economy table as the player. On `round:buyPhase`, each bot runs:

```
if (cash >= AWP.price && role === 'sniper')   → buy AWP
else if (cash >= M4.price)                    → buy M4
else if (cash >= P90.price)                   → buy P90
else                                          → eco round (pistol only)
remaining cash → buy frag first, then smoke
```

Enemy bots follow the same rule — low-cash rounds produce visible eco rounds (pistol-only bots), making economy reads meaningful for the player.

#### Implementation sketch

```
src/modes/buyMenu.js      — DOM panel, economy state, buy phase timer
src/modes/economy.js      — cash ledger: addCash(n), spendCash(n), getCash()
                            emits 'economy:updated' for HUD
src/entities/grenades.js  — extend with smoke / flash / molotov logic
config.js                 — add price field to WEAPONS, add GRENADES map
```

Event contracts:
- `round:buyPhase { deadline }` → buyMenu opens countdown, bots auto-buy
- `round:buyPhaseEnd` → buyMenu force-closes, movement unblocked
- `buy:weapon { key }` → player.js equips weapon, economy.js deducts cost
- `buy:grenade { key }` → grenades.js adds to carry slots, economy.js deducts
- `economy:updated { cash }` → HUD re-renders cash display
- `round:end { playerWon, killCount }` → economy.js computes round payout

---

### ~~Phase 21 — Second map + map selector~~ ✅ Done

#### Map 1 — Current: "The Bunker" (indoor, exists)

Dark brutalist interior — concrete walls, torchlit corridors, ramp ledges, cracked crawl gaps. Two bomb sites inside the structure. Tight sightlines, lots of cover.

#### Map 2 — "Rooftop District" (outdoor, new)

An elevated urban rooftop complex — multiple connected building tops with HVAC units, water tanks, cable runs, and open sky. Much longer sightlines than the Bunker; sniping corridors offset by hard cover clusters.

**Scenery ideas:**
- **HVAC units** — large box geometry (sheet metal texture), give cover between lanes. Can be procedural or replaced with a GLTF asset.
- **Water tanks** — cylindrical geometry on tripod legs; landmark for callouts ("tank side", "north tank").
- **Chain-link fences** — low-poly plane meshes with a transparent fence texture (alpha cutout); breaks sightlines partially.
- **Satellite dishes + antenna masts** — tall vertical landmarks visible from anywhere on the map.
- **Overhangs / raised catwalks** — metal grid walkways above the main level; additional vertical plane.
- **Neon signage** — emissive plane meshes, `MeshBasicMaterial` with glow colour. Aesthetic only but adds mood lighting.
- **Distant city backdrop** — low-poly skybox buildings or `THREE.Sprite` billboards at the map edge; sells the "high up" feeling.

**Lighting:**
- Daytime: directional sun at low angle (golden hour), long shadows, `THREE.HemisphereLight` sky/ground gradient.
- Site A: near a glowing billboard — warm orange point light.
- Site B: near an antenna cluster — cool blue point light.
- Replace `FogExp2` with a lighter haze (`density: 0.006`); open air should be clearer than a bunker.

#### Free asset sources to replace procedural shapes

All permissive licences (CC0 / CC-BY / MIT) — drop into `public/models/`:

| Asset | Source | Format | Use |
|-------|--------|--------|-----|
| HVAC unit | [Sketchfab — CC0](https://sketchfab.com/search?q=hvac+unit&licenses=7c23a1ba438d4306920229c12afcb5f9) | GLTF/GLB | Rooftop cover |
| Water tower | [Poly Pizza — CC0](https://poly.pizza/search/water+tower) | GLTF/GLB | Landmark |
| Chain-link fence panel | [ambientCG — CC0](https://ambientcg.com/list?category=&date=&createdUsing=&basedOn=&q=chain+fence) | PNG texture | Alpha plane |
| Brick / concrete textures | [ambientCG — CC0](https://ambientcg.com/list?category=&date=&createdUsing=&basedOn=&q=brick) | PNG (albedo+normal+rough) | Wall materials |
| Metal grating texture | [ambientCG — CC0](https://ambientcg.com/list?category=&date=&createdUsing=&basedOn=&q=metal+grate) | PNG | Catwalk floor |
| Neon sign | [Sketchfab — CC0](https://sketchfab.com/search?q=neon+sign&licenses=7c23a1ba438d4306920229c12afcb5f9) | GLTF/GLB | Mood lighting |

To use a texture from ambientCG: download the 1K PNG set, create a `THREE.MeshStandardMaterial` with `map` (albedo), `normalMap`, `roughnessMap` — instant PBR surface.

#### Code changes

- `level.js` refactored: `buildLevel(mapDef)` accepts a map definition object instead of hardcoding MAP import.
- Map definition shape: `{ tiles, heightmap, sites, spawnZones, lightColor, fogDensity, name }`.
- Map 1 ("Bunker") and Map 2 ("Rooftop") each export a `mapDef` object from `src/maps/`.
- `config.js` S&D site coords move into the map definition — `snd.js` reads them from the active map.
- Overlay gets a map carousel (thumbnail + name) before mode select; selection stored in `modeManager`.

---

### Phase 22 — Multiplayer foundation

Real-time 5v5 S&D over WebSocket. The existing bot AI stays as filler for empty slots; the goal is to replace bots one-for-one with human players without restructuring the game loop.

#### Architecture

```
Browser A ──WS──┐
Browser B ──WS──┤
Browser C ──WS──┤── Server (Node / Cloudflare Worker) ── authoritative match state
Browser D ──WS──┤
Browser E ──WS──┘
```

- **Server is authoritative for round state** (score, timer, bomb, role swap) but **not for movement** — movement stays client-authoritative to keep latency invisible. Hit detection is server-confirmed (lag-compensated rewind to 100 ms history).
- **Tick rate**: server at 20 Hz; clients interpolate remote players between ticks at 60 fps.

#### Packet design (MessagePack or compact JSON)

| Direction | Message | Fields |
|-----------|---------|--------|
| C → S | `move` | `x, z, yaw, pitch, ts` |
| C → S | `shoot` | `ts, targetId` (id of entity hit, or null) |
| C → S | `action` | `type` (plant/defuse/grenade), `x, z, ts` |
| S → C | `world` | array of `{id, x, z, yaw, hp, state, team}` per remote player |
| S → C | `hit` | `victimId, dmg, killerId` |
| S → C | `round` | `event` (start/end/bomb/defuse/timeout), `payload` |
| S → C | `chat` | `senderId, team, text` |

#### Client-side changes

- `src/net/socket.js` — WebSocket wrapper, connect/disconnect, send queue, reconnect backoff.
- `src/net/remotePlayer.js` — one instance per remote human; holds interpolation buffer (last two `world` snapshots), lerps position/yaw between ticks. Reuses `buildEnemyMesh` for rendering so remote players look identical to bots.
- `src/net/netSync.js` — reads local player state each frame, diffs against last sent packet, emits `move` at 20 Hz max. Consumes incoming `world` / `hit` / `round` messages via the event bus (`on('net:world', ...)` etc.).
- `enemies.js` `spawnSndEnemies` — accept a `remotePlayers` map; skip bot slots that are occupied by a remote human connection.

#### Server-side (Node.js, ~300 lines)

- `server/index.js` — `ws` library, room management (one room = one S&D match, up to 10 clients).
- `server/matchState.js` — mirrors `snd.js` state machine: round timer, bomb, score. Ticks at 20 Hz via `setInterval`. Broadcasts `round` events on transitions.
- `server/lagComp.js` — ring buffer of player positions per client (last 10 ticks = 500 ms). On `shoot` message, rewinds world to `ts - latency`, checks hit against rewound positions, broadcasts confirmed `hit`.
- No physics on server — trust client position, only validate that delta per tick is ≤ `ENEMY_SPEED * tickInterval * 1.5` (basic speed-hack guard).

#### Lobby & matchmaking

- Room code system: host generates a 4-char code, shares it out-of-band. Clients join via `?room=XXXX` query param.
- Overlay gets a **[ HOST ]** and **[ JOIN ]** button alongside INCURSION / TDM / S&D. Join flow: enter room code → connect → wait in lobby until host starts the match.
- Lobby shows connected players (name = browser-generated adjective-noun, e.g. "SilentViper"), team assignment, ready state.

#### Bot fill

- Server tracks human slot count per team. Any slot below 5 without a human is flagged `botFill=true`.
- Each client simulates its own team's bots locally (same `friendlyBots.js` tick). Remote team bots are driven by the server's designated "bot host" — the first client to connect. If bot host disconnects, server promotes the next client.

#### Scope boundary

Phase 22 ships: position sync, hit confirmation, round state sync, lobby, room codes.  
Out of scope for Phase 22: voice chat, ranked matchmaking, anti-cheat beyond speed guard, spectator mode.

---

### Phase 25 — Progression & persistence

- `localStorage` store: lifetime kills, matches won, best wave, accuracy
- Match-end scoreboard (K/D/A, accuracy %, plants/defuses) with share-to-clipboard
- Kill streak rewards: 3-kill → ammo refill, 5-kill → drone strike (reuses recon drone logic), 7-kill → EMP across map
- Wave mode: difficulty ramp-up curve (enemy speed + damage increase per wave tier)

---

### Phase 26 — Bot personality modes

Give bots distinct play styles so repeat sessions feel different and difficulty is tunable.

- **Tiers**: Passive (holds angles, retreats when hurt), Competitive (rotates, uses cover intelligently), Aggressive (pushes site, peeks fast, ignores health).
- Per-bot `personality` field on the enemy object; `enemyStates.js` reads it for decision weights (peek chance, retreat threshold, reaction delay).
- S&D lobby lets players choose enemy difficulty before starting — stored in `config.js` as `BOT_PERSONALITY`.
- Passive bots work great as tutorial fodder; Aggressive tier provides a real challenge once players know the maps.

---

### Phase 27 — Killcam / round-end highlight

Replay the last 3 seconds of a round (or the killing blow on the player) when the round ends.

- **Ring buffer**: each tick, snapshot `{ pos, yaw, pitch, hp }` for every entity into a circular buffer (3 s × 60 fps = 180 entries per entity). `src/replay/replayBuffer.js`.
- On player death or round end, detach the live camera and play back the buffer from the killer's POV: position-lerp + yaw-lerp at 1× speed.
- Overlay shows "KILLCAM" badge and a "SKIP" button; after 3 s (or skip) the round result screen appears as normal.
- No additional server state needed — purely client-side ring buffer.
- **Why it matters**: players love rewatching the kill that ended them; it also subtly teaches map positions and angles.

---

### Phase 28 — Advanced movement mechanics

Add a movement skill ceiling that rewards practice and separates casual from competitive play.

- **Bunny hop**: if player jumps within ~80 ms of landing and strafes, preserve a fraction of horizontal momentum (source-engine style). Cap at `PLAYER_SPEED * 1.35` to prevent infinite acceleration.
- **Wall-slide**: when sprinting into a wall at an angle, player slides along it instead of stopping dead — feels smooth and prevents frustrating stutter.
- **Ledge grab**: if the player walks into geometry that is ≤ 0.9 m above their head, auto-climb over it (short tween, ~200 ms). Works on HVAC boxes, low walls, window sills.
- **Slide cancel**: pressing jump during a slide pops the player upward with partial slide momentum — creates a low-profile burst move.
- All mechanics gated behind a `ADVANCED_MOVEMENT` config flag so they can be toggled off for casual modes.

---

### Phase 29 — Operator abilities (Valorant-style)

Each round, the player gets one signature ability charge (free) and can buy a second in the buy phase.

| Ability | Effect | Duration |
|---------|--------|----------|
| **Recon Drone** | Deploy a controllable mini-drone for 8 s; enemies briefly highlighted after | 8 s |
| **Smoke Canister** | Throw a canister that spawns a 4 m smoke sphere blocking LOS | 15 s |
| **EMP Pulse** | Instant AoE that disables enemy HUD overlays and slows drones for 6 s | instant |
| **Flashbang** | Existing grenade slot; add white-screen blind effect to enemies in LOS | 2 s blind |
| **Wall Sensor** | Place a device on any wall; enemies passing within 5 m trigger a ping on radar | 30 s |

- Ability key: `E`. Current ability shown in HUD bottom-center (icon + charge count).
- `src/abilities/abilityManager.js` — maps player ability type → handler function, tracks cooldown.
- Bots get random ability assignment at round start; they use abilities on a timer (no decision-tree complexity needed for v1).
- Pairs naturally with Phase 19 (buy menu) — abilities have prices just like weapons.

---

### Phase 30 — Environmental interaction

Make arenas feel alive and dynamic — small changes that big-studio games take for granted.

- **Destructible crates**: scattered box props (already have rubble geometry) that take damage from bullets and explosions; splinter into 4–6 smaller pieces using `THREE.BufferGeometry` subdivision. Pieces persist until round reset.
- **Shootable lights**: point lights in the scene can be shot out (HP = 1 bullet). Darkness creates new tactical angles; `tickTorches` skips shot-out lights.
- **Explosive barrels**: red barrel prop (`MeshStandardMaterial`, emissive tint) that explodes when shot — `triggerExplosion` radius 4 m, 60 damage. One barrel per S&D site as a map-design risk/reward.
- **Door toggles**: thin box meshes acting as doors that open/close on interact (`F` key when within 1.5 m). Opens new flanking routes mid-round.
- Implementation: `src/entities/destructibles.js` — array of destructible objects with HP; `buildLevel` populates them from `mapDef.destructibles[]`.

---

### Phase 31 — Cosmetic system

Pure visual customisation — no pay-to-win. Gives players identity and a reason to keep playing.

- **Operator skins**: swap the player GLTF mesh material colours (hue-shift on `MeshStandardMaterial.color`). 6 presets (Urban, Desert, Arctic, Neon, Woodland, Ghost). Selected in a new **Locker** tab on the overlay.
- **Weapon finishes**: tint the weapon FBX material. Unlocked by reaching kill milestones (50 kills = Desert finish, 200 kills = Neon finish, etc.).
- **Kill card**: a short particle burst style unique to each operator when they get a kill (orange sparks vs. blue sparks vs. green sparks). `src/fx/killCard.js`, reads `player.operatorStyle`.
- **Player nameplate**: floating text above allied bots using `THREE.Sprite` + canvas texture — shows squad callsign ("ALPHA-1"). Toggle with F3.
- All unlocks stored in `localStorage` alongside Phase 25 progression data.

---

### ~~Phase 32 — Training range~~ ✅ Done

See Completed table — full Training Range with 4 drills (Free Practice, Flick, Reaction, Hostage Gauntlet), hostile/hostage target types, preset panel (`P`) with drill/difficulty/targets/movement/H-pattern/H-speed sections, spring physics and sine movement across the full corridor (6–50 m), live HUD stats.

---

### Phase 33 — Grenade arsenal

Extend the existing grenade system (currently one type) into a full tactical toolkit.

| Grenade | Key | Effect |
|---------|-----|--------|
| Frag (existing) | MMB | Explosive — 60 damage falloff over 4 m |
| **Flashbang** | `4` | Blind all entities (player + enemies) in LOS for 2 s; white screen fade, `player.blinded` flag |
| **Smoke** | `5` | 4 m sphere of fog for 15 s; `hasLOS` returns false through smoke volume |
| **Molotov** | `6` | 3 m fire zone for 8 s; 8 damage/s to any entity standing inside |
| **Decoy** | `7` | Emits fake gunshot audio + muzzle flash for 3 s; enemies in earshot enter SPOTTED state toward the decoy position |

- `src/entities/grenades.js` gains a `grenadeType` param; `damage.js` gets `applyFireDamage(zone, dt)`.
- Carry limit: 1 of each type. Replenish at buy phase or ammo drops.
- HUD shows grenade slots bottom-left with active counts.

---

### Phase 34 — Weather & time-of-day variants

Same map geometry, radically different atmosphere — doubles map count without doubling map work.

- Each `mapDef` gains an optional `variants[]` array of lighting/fog/sky overrides: `{ name, skyColor, fogColor, fogDensity, sunAngle, sunColor, ambientColor, rain }`.
- **Night variant**: low ambient (`0.12 * Math.PI`), no sun, flashlight attached to camera (`THREE.SpotLight` following `camera.position`). Enemies also carry flashlights — visible from across the map, breaks stealth.
- **Rain**: `src/fx/rain.js` — `Points` geometry with ~2000 streaks falling per frame, slight fog increase, puddle-reflection `MeshStandardMaterial` on the floor plane.
- **Dust storm**: heavy `FogExp2` density (0.06), desaturated sand tones — sightlines drop to ~15 m. Fundamentally changes how S&D plays.
- Map variant is chosen randomly at round start in S&D, or selectable in Incursion/TDM via a second row in the map selector.

---

### Phase 35 — Additional game modes *(TDM shipped; CTF pending)*

#### ~~Team Deathmatch~~ ✅ Done
First to 50 kills, 10-minute timer, 3-second respawn for player and enemies, score bar in HUD. See Completed table. **Remaining TDM work:** friendly bot team (4 bots with `sndTeam:'friend'`), per-player kill score vs team kill score split.

#### Capture the Flag (CTF)
- Two flags at opposing team bases (glowing `THREE.Mesh` cylinder + emissive material). Carry enemy flag to your base to score.
- Flag carrier is slowed 15% and cannot sprint. Drop on death; flag auto-returns after 20 s idle.
- `src/entities/flag.js` — flag state machine: `AT_BASE → CARRIED → DROPPED → RETURNING`.
- Radar shows flag position with a distinct icon; `sndHud.js` repurposed to show flag status.

---

### Phase 36 — Ping / communication system

Apex Legends-style contextual pings — full team communication with zero voice setup.

- **Ping key**: `Z` (currently dive — move dive to double-tap `CTRL`). Raycast from camera centre; classify hit surface into: Enemy spotted, Go here, Watch out, Defend, Attack.
- Ping appears as a `THREE.Sprite` billboard at the hit point (colour-coded by type), visible through walls on minimap, auto-expires after 6 s.
- Audio bark plays on ping: short synthesised voice line per type (Web Audio `OscillatorNode` shaped to sound vaguely like a word — or just a distinct tone per type as v1).
- Bots respond to player pings: `Go here` triggers a reroute in their A* path; `Defend` makes them hold current position; `Attack` makes them push the nearest site.
- `src/net/ping.js` — ping state list, tick (expire), render; emits `ping:placed` event consumed by `friendlyBots.js`.

---

### ~~Phase 37 — In-browser map editor~~ ✅ Done

See Completed table — full 2D canvas editor with all tile types, 3-floor support, undo (80 ops), 3D preview, base-64 export/import, URL sharing.

---

### ~~Phase 38 — Sniper polish & advanced weapon feel~~ ✅ Done

See Completed table — scope vignette overlay, AWP sway oscillator with hold-breath (Shift+ADS+AWP), bullet drop, sniper bots hold position.

---

### ~~Phase 39 — Adaptive difficulty AI~~ ✅ Done

See Completed table — `src/ai/difficultyAdapter.js`, rolling 60 s K/D window, level 1–10 lerping Recruit→Elite, separate `[ ADAPTIVE ]` mode button, `adaptTick` in game loop.

---

### ~~Phase 40 — Map Editor v2~~ ✅ Done

See Completed table — fill tool, rect tool, scroll-to-zoom, mirror mode, variable map size, save slots, map name+desc, sky/fog presets, playtest, minimap thumbnail, and custom map card from `?map=` URL param.

---

## Idea Slogan Backlog

Tags — **complexity:** `easy` `medium` `hard` `very hard` · **player demand:** `hot` `solid` `niche` · **feel:** `juicy` `tactical` `polish` `content` `meta`

### Combat feel

| # | Idea | complexity | demand | feel |
|---|------|-----------|--------|------|
| 1 | Aim punch — camera kicks slightly on every hit received. | `easy` | `hot` | `juicy` |
| 2 | Distinct headshot vs. body-hit sound so you know the shot quality without looking at the marker. | `easy` | `hot` | `juicy` |
| 3 | Counter-strafe snaps accuracy to zero instantly when you stop moving, rewarding sharp inputs. | `medium` | `hot` | `tactical` |
| 4 | Reload cancel — tapping fire mid-reload chambers the one remaining round and interrupts the animation. | `medium` | `hot` | `juicy` |
| 5 | Grenade cook — hold the throw key to keep the pin out; release at the last moment for a contact burst. | `medium` | `hot` | `tactical` |
| 6 | Grenade preview arc — while winding up, dots trace the flight path in world space. | `medium` | `hot` | `polish` |
| 7 | Kill distance shown in the kill feed after every sniper kill ("47 m"). | `easy` | `solid` | `polish` |
| 8 | Tactical reload — different animation when the mag still has rounds (keep one in the chamber, faster). | `medium` | `solid` | `juicy` |
| 9 | Spray-transfer discipline — first 5 bullets are guaranteed dead-accurate before cone kicks in. | `medium` | `solid` | `tactical` |
| 10 | Peek advantage — pre-aim an angle and step out faster than the enemy can react, modelling real CS timing. | `hard` | `solid` | `tactical` |
| 11 | Bullet penetration — rounds pass through thin walls at 40% reduced damage, flagged with a `[WALLBANG]` marker. | `hard` | `hot` | `tactical` |
| 12 | Ricochet off angled metal surfaces at reduced damage, max one bounce per bullet. | `hard` | `niche` | `juicy` |
| 13 | Scope glint — the AWP lens catches light and flickers for ~0.3 s before the shot, visible at range. | `medium` | `solid` | `tactical` |
| 14 | Weapon inspect animation plays when the player is idle for 10 s. | `easy` | `solid` | `polish` |

### Audio & perception

| # | Idea | complexity | demand | feel |
|---|------|-----------|--------|------|
| 15 | Footstep sounds vary by surface — concrete thud, metal clang, grass hush. | `medium` | `hot` | `juicy` |
| 16 | Sound occlusion — gunshots are muffled when the source is on the other side of a wall. | `hard` | `hot` | `tactical` |
| 17 | Footstep directionality — enemies heard louder from behind, quieter ahead, using `PannerNode` cones. | `hard` | `hot` | `tactical` |
| 18 | Bomb beep pitch rises as the defuse deadline approaches, turning audio into a countdown. | `easy` | `hot` | `juicy` |
| 19 | Dynamic music that intensifies the moment a bomb is planted and resolves on defuse or explosion. | `medium` | `hot` | `juicy` |
| 20 | Killstreak voice announcer — "DOUBLE KILL", "ACE", "FLAWLESS" barked at the player. | `easy` | `solid` | `juicy` |
| 21 | Friendly bot voice lines for callouts — "SITE A CLEAR", "PLANTING NOW", "ENEMY BEHIND YOU". | `medium` | `solid` | `content` |

### Visuals & polish

| # | Idea | complexity | demand | feel |
|---|------|-----------|--------|------|
| 22 | Post-processing bloom on muzzle flash and fire zones — cheap and makes everything feel louder. | `easy` | `hot` | `juicy` |
| 23 | Bullet hole decals on walls that persist until the round resets. | `medium` | `solid` | `polish` |
| 24 | Player model shadow leaks around corners and gives away position before the body does. | `medium` | `niche` | `tactical` |
| 25 | Time dilation — final kill of the round plays at 0.25× speed for exactly one second, then snaps back. | `medium` | `hot` | `juicy` |
| 26 | Bomb carrier has a subtle glow on their model visible only to their own team on radar. | `easy` | `solid` | `polish` |
| 27 | Hot zone pulse — bomb sites pulse with a red halo on the minimap the entire time the bomb is live. | `easy` | `solid` | `polish` |
| 28 | Enemy death ragdoll using simple per-bone velocity inheritance, no external physics engine needed. | `hard` | `hot` | `juicy` |
| 29 | Tracer rounds briefly illuminate the scene along the bullet path like a flashlight streak. | `easy` | `solid` | `juicy` |

### Tactical / S&D depth

| # | Idea | complexity | demand | feel |
|---|------|-----------|--------|------|
| 30 | Spectator mode — dead players watch from any live teammate's first-person POV, switchable with Tab. | `medium` | `hot` | `content` |
| 31 | Team economy display during buy phase — see each bot's cash so you know if they can afford rifles. | `easy` | `hot` | `meta` |
| 32 | Surrender vote — team can forfeit remaining rounds when down 0-7; requires unanimous agreement. | `easy` | `solid` | `meta` |
| 33 | Interactive bomb defuse mini-game — tap the correct key sequence instead of hold-F. | `medium` | `niche` | `content` |
| 34 | Decoy grenade routes enemies toward the throw site, giving the planting team a free flank. | `medium` | `solid` | `tactical` |
| 35 | Spawn protection bubble — first 1.5 s after spawn you cannot be shot and cannot shoot, prevents spawn-kill cheese. | `easy` | `solid` | `tactical` |
| 36 | Ghost round — every 5th round footsteps are silent for both teams, rewarding visual awareness over audio. | `easy` | `niche` | `content` |
| 37 | Friendly fire toggle per lobby for hardcore mode where every bullet counts. | `easy` | `niche` | `meta` |
| 38 | Wallbang check key — hold `Alt` to highlight penetrable surfaces in view with a colour overlay. | `medium` | `solid` | `tactical` |
| 39 | Round-end MVP card — highest-impact player gets a solo model shot with their stats overlaid. | `medium` | `solid` | `juicy` |

### Progression & meta

| # | Idea | complexity | demand | feel |
|---|------|-----------|--------|------|
| 40 | Challenge cards each round — "3 pistol kills = +$500 bonus" drives creative play. | `medium` | `hot` | `meta` |
| 41 | Loadout presets — save up to 3 buy configurations and trigger with Ctrl+1/2/3 in buy phase. | `easy` | `solid` | `meta` |
| 42 | Spray pattern unlock — completing 100 kills with a weapon reveals its ideal counter-pull pattern on the firing range. | `medium` | `solid` | `meta` |
| 43 | Crosshair customiser — shape, colour, gap, dot, thickness, all stored in `localStorage`. | `easy` | `hot` | `polish` |
| 44 | Kill verification ping — distinct visual pop on the kill shot separate from the regular hitmarker. | `easy` | `hot` | `juicy` |
| 45 | Seasonal map variant — Christmas lights on rooftop in December, skull decorations on bunker in October. | `medium` | `solid` | `content` |

### AI & bots

| # | Idea | complexity | demand | feel |
|---|------|-----------|--------|------|
| 46 | Enemy bots call out their own position over a fake radio when spotted, misdirecting naive players. | `medium` | `niche` | `content` |
| 47 | Body drag — walk up to a fresh corpse and pull it behind cover to deny enemies a death-position read. | `hard` | `niche` | `tactical` |
| 48 | Bots remember where they were last killed and avoid that exact spot for two rounds. | `medium` | `solid` | `tactical` |
| 49 | Sniper bot holds the angle they first acquired a kill from and never moves — genuinely terrifying. | `easy` | `solid` | `tactical` |

### Long-shot / dream

| # | Idea | complexity | demand | feel |
|---|------|-----------|--------|------|
| 50 | Grappling hook as a one-per-round ability — hard to aim, huge vertical mobility, zero second chances. | `hard` | `hot` | `content` |
| 51 | Procedurally generated map variant each match — same tile palette, randomised layout, never the same twice. | `very hard` | `niche` | `content` |
| 52 | Ammo type swap — switch between FMJ (penetration) and hollow-point (extra damage, no wallbang) on the fly. | `hard` | `niche` | `tactical` |
