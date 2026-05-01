# VIBE ON DUTY

A browser-based first-person shooter built with Three.js. Survive endless waves of armed infantry, coordinate with your squad in Team Deathmatch, or go head-to-head in Search & Destroy.

**[Play in browser →](https://szefo94.github.io/VibeOnDuty/)**

> Requires a local dev server — run `npm run dev` and open `http://localhost:5173`.

---

## Game Modes

### Wave Mode (Incursion)
Survive endless waves of enemies in a tactical indoor arena. Clear each wave to face the next. A persistent drone hunts you between waves.

### Team Deathmatch
5v5 bot battle. You and four green-tinted allies face five red-tinted enemies. First team to 50 kills wins. All bots pathfind, fight, and respawn. A recon drone supports each side.

### Search & Destroy
Best-of-7 match. Rounds 1–3: you attack — plant the bomb at Site A or B and protect the fuse. Rounds 4–6: you defend — stop the enemy team from planting, or defuse if they succeed. First to 4 round wins takes the match.

- **10 s** buy phase at round start — pistol only, spend cash on rifles or SMGs
- **60 s** round timer (attackers must plant before it expires)
- **40 s** fuse after plant
- **3 s** plant / **5 s** defuse (hold `G`)
- Round ends on: bomb exploded · bomb defused · team elimination · round timeout
- 5 friendly bots on your team (green); 5 enemy bots on the opposing side (red)
- Recon drones — one per team — patrol the map and reveal enemy positions on the minimap

#### S&D Economy
| Event | Cash |
|-------|------|
| Kill | +$300 |
| Plant / Defuse | +$300 |
| Round win | +$900 |
| 1st consecutive loss | +$1,400 |
| 2nd consecutive loss | +$1,900 |
| 3+ consecutive losses | +$2,400 |

Starting cash: **$3,000**. Cap: $16,000.

---

## Controls

| Key | Action |
|-----|--------|
| `WASD` | Move |
| `SHIFT` | Sprint |
| `CTRL` / `C` | Crouch |
| `W + CTRL` | Slide |
| `Z` | Dive (forward launch → lands into slide) |
| `SPACE` | Jump |
| `Q` / `E` | Lean left / right |
| `LMB` (hold) | Shoot |
| `RMB` | Aim down sights |
| `MMB` | Throw grenade (costs 100% energy) |
| `F` | Melee punch |
| `R` | Reload |
| `G` (near site/bomb) | Plant / Defuse |
| `B` | Buy menu (S&D buy phase) · Shoulder swap (3rd person) |
| `1–4` | Switch weapon (M4 · P90 · AWP · Pistol) |
| `V` | Toggle 3rd person camera |
| `T` | Dance |
| `F3` | Toggle debug overlay |

### Movement tricks

| Trick | How |
|-------|-----|
| Slide cancel | During a slide, press `SPACE` to launch into a jump |
| Crouch-landing slide | Jump, hold `CTRL`, land — converts air momentum into a slide |
| Dive → slide | Press `Z` while running — dives forward and lands into a boosted slide |

---

## Features

### World
- **Three maps**: Greek Columns (indoor CQB), Rooftop District (outdoor), Column Arena (open marble)
- **24×24 tile map** — solid walls, cracked walls (crawl gaps), ramps, pillars, multi-level heightmap terrain
- Two bomb sites (A / B) with pulsing ring markers and point lights in S&D mode
- Torch lights with flicker, PCF soft shadows, exponential fog, ACES filmic tone mapping

### Player
- Full movement system: walk, sprint, crouch, slide, slide-cancel jump, dive, lean
- Gravity, jump, step-height traversal on ramps and ledges
- EMP slow (drone ability): reduces movement speed to 40% for 2 s
- 1st-person death animation: weapon tips forward and drops on death
- Full loadout reset each S&D round; weapon carries over within a round

### Difficulty
Four selectable tiers affect reaction time, aim accuracy, health, speed, and strafe chance:

| Tier | React | Damage | Speed |
|------|-------|--------|-------|
| Recruit | 900–1800 ms | 6 | ×0.60 |
| Regular | 400–950 ms | 10 | ×1.00 |
| Veteran | 150–380 ms | 16 | ×1.25 |
| Elite | 60–150 ms | 22 | ×1.50 |

### Enemy AI
- Patrol waypoints with idle wander rotation
- Line-of-sight detection with reaction delay (difficulty-scaled)
- A\* pathfinding, throttled to once per 600–800 ms or when goal cell changes
- Velocity-based movement with acceleration + drag
- Knockback stagger on hit, crouching and jumping in attack state
- Wave-based respawn (wave mode) or team-based spawn (S&D / TDM)
- **Friendly bots** (green) — A\*-pathfind to sites/enemies, shoot with LOS check, scout when idle
- **Enemy attackers** — rush assigned site, plant bomb when in range, defuse enemy plant

### Drone AI
- **Persistent drone** (wave mode): orbits player at ~8 unit radius, EMP pulse at <30% HP
- **S&D / TDM recon drones** (one per team): fixed waypoint patrol, periodic LOS scan
  - Friendly drone reveals enemy bot positions on minimap
  - Enemy drone compromises player position and alerts nearby bots

### Camera
- 1st person with head bob, weapon sway, spray cone, recoil
- 3rd person over-the-shoulder (Fortnite-style): animated transition, shoulder swap, ADS preserved
- Lean: camera rolls ±0.28 rad and shifts ±0.38 units sideways
- ADS FOV zoom (75° → 50°, weapon-dependent)

### HUD
- Ammo ring, energy ring, HP segments, reload bar, spray cone indicator
- Enemy HP bars (in-world), drone HP bar, S&D match header (role · round · score · timer)
- TDM score bar (team kills vs enemy kills · timer · kill limit)
- Minimap radar: sweep animation, fog of war, enemy/drone/ammo blips
- Plant bar, defuse bar, bomb fuse countdown, round result overlay
- Kill counter, hit flash, damage vignette, status messages
- **Damage numbers** — floating world-projected values (yellow for enemy hits, red for player hits)
- **Buy phase banner** — countdown timer + current cash

### Weapons

| Weapon | Mag | Reserve | Damage | Fire Rate | Reload | Price |
|--------|-----|---------|--------|-----------|--------|-------|
| M4A1 | 30 | 90 | 28 | 88 ms | 1.8 s | $2,900 |
| P90 | 50 | 150 | 20 | 55 ms | 2.0 s | $2,350 |
| AWP | 5 | 20 | 95 | 1100 ms | 2.5 s | $4,750 |
| M9 (Pistol) | 12 | 36 | 38 | 280 ms | 1.2 s | free |
| Melee | — | — | 55 | 700 ms | — | — |
| Grenade | — | — | up to 150 | — | — | 100% energy |

---

## Stack

| Tool | Version | Role |
|------|---------|------|
| [Three.js](https://threejs.org/) | r160 (npm) | 3D rendering |
| [Vite](https://vitejs.dev/) | 8.x | Dev server + production build |
| [Vitest](https://vitest.dev/) | 4.x | Unit tests |
| [Playwright](https://playwright.dev/) | 1.40 | Smoke / e2e tests |
| ESLint 9 | flat config | Linting |
| Prettier | 3.x | Formatting |
| TypeScript | 6.x | Type checking (`allowJs`, `noEmit`) |

---

## Project Structure

```
index.html              — HTML shell + canvas
style.css               — all styles
vite.config.js          — entry point config
src/
  main.js               — entry: DOM listeners, start buttons, asset-gated init
  loop.js               — game loop, 3rd-person camera, lean offset, drone ticks
  config.js             — all game constants (player, enemy, weapons, S&D, physics)
  events.js             — 4-line pub/sub event bus (on/off/emit)
  map.js                — MAP data, heightmap, pathability
  math.js               — normA, slerp
  astar.js              — A* pathfinding with dev-mode failure logging
  scene.js              — renderer, scene, camera
  materials.js          — shared MeshStandardMaterials
  lighting.js           — torches, ambient, sun
  level.js              — level geometry, wall meshes, debug lines
  input.js              — keyboard, mouse, pointer lock state
  touch.js              — mobile touch controls
  difficulty.js         — difficulty preset selection + application
  gamepad.js            — gamepad / controller input
  maps/
    bunker.js           — Greek Columns map definition
    rooftop.js          — Rooftop District map definition
    concept.js          — Column Arena map definition
  modes/
    modeManager.js      — setMode/getMode/isAnyModeActive (zero-dep registry)
    snd.js              — S&D match state machine, bomb logic, round lifecycle
    tdm.js              — TDM score tracking, respawn, timer
    economy.js          — S&D cash ledger (kill/plant/defuse bonuses, loss streak)
    buyMenu.js          — S&D buy phase UI, weapon shop, 10 s countdown
  ai/
    enemyStates.js      — PATROL/SPOTTED/ATTACK state objects + transition helpers
  builders/
    weapon.js           — player weapon model (1st-person)
    playerBody.js       — 3rd-person soldier body
    enemy.js            — ground soldier model (procedural fallback)
    drone.js            — drone model (procedural)
    enemyGLTF.js        — GLTF enemy + player mesh loader, clip aliases, team tinting
    enemyAnimations.js  — AnimationMixer crossfade
    enemyWeapon.js      — enemy pistol GLTF attach
    weaponFBX.js        — player M4 / P90 FBX loader
    assetManager.js     — register/loadAll parallel asset registry
  combat/
    shoot.js            — bullet physics, hit detection, weapon animation, death drop
    damage.js           — grenade falloff formulas
  entities/
    entityBase.js       — applyEntityBase mixin (isAlive, takeDamage)
    player.js           — player state, movement, reload, dive, lean
    enemies.js          — enemy AI loop, S&D / TDM team spawn, kill/death events
    friendlyBots.js     — allied bot AI (A*, LOS, mode-aware: hunt in TDM, site-push in S&D)
    drone.js            — drone runtime (orbit AI, EMP, S&D/TDM recon drones)
    waveSystem.js       — wave state, tickWave, triggerWaveEnd
    ammoDrops.js        — ammo pickup spawning and collection
    grenades.js         — grenade throw, flight, explosion
  utils/
    los.js              — hasLOS raycaster utility
  fx/
    tracers.js          — enemy muzzle tracers
    impacts.js          — bullet impact sparks
    particles.js        — grenade explosion particles
    meleeRange.js       — melee ring flash
    damageNumbers.js    — floating world-space damage numbers
    screenShake.js      — camera shake on hit / explosion
  hud/
    overlay.js          — updateHUD, showMsg, showStatus, triggerHitFlash
    hitmarker.js        — crosshair hit indicator
    hud.js              — drawHUD dispatcher (clears canvas, calls rings + enemyBars)
    rings.js            — ammo/energy/reload rings, spray cone, healthColor helper
    enemyBars.js        — drone HP bar, grenade impact zones, enemy HP bars
    radar.js            — minimap radar canvas
    sndHud.js           — S&D HUD (match header, bomb timer, plant/defuse bars)
  *.test.js             — Vitest unit tests (54 tests, 5 files)
tests/
  smoke.spec.js         — Playwright smoke tests
types/
  entities.d.ts         — EntityBase, Enemy, Player, Drone, AiState, AiCtx interfaces
```

---

## Running Locally

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build → dist/
npm test           # Vitest unit tests
npm run test:e2e   # Playwright smoke tests
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```
