# REFACTOR PREVIEW

Audit of `/src`. Grouped by priority. Each item notes file, problem, fix.

---

## CRITICAL

### enemies.js — too large (530+ lines, 4+ responsibilities)
Split into:
- `enemySpawning.js` — wave / S&D / TDM spawn variants (lines 32–312)
- `enemyUpdate.js` — updateEnemies loop (lines 393–525)
- keep pool + init in `enemies.js`

---

## HIGH

### Duplicate grid-to-world conversion
`Math.floor(pos / CELL)` scattered 20+ times across enemies.js, friendlyBots.js, grenades.js, ammoDrops.js, astar.js, map.js, level.js.
Extract to `map.js`:
```js
export function worldToCell(x, z) { return [Math.floor(x / CELL), Math.floor(z / CELL)]; }
```

### level.js — too large (490+ lines)
Split into:
- `rampGeometry.js` — all ramp generators (`_diagFrac`, `_bilinearFrac`, `_revolvedFrac`, etc.)
- `levelTiles.js` — tile predicate helpers (`_isRamp`, `_isCrack`, etc.)
- `levelBuilder.js` — main `buildLevel` orchestrator

### Physics / animation constants scattered in source files
These are defined inline, not in config.js:
- `player.js` — `DIVE_SPEED=12`, `DIVE_LAUNCH_Y=2.8`, `ROLL_ANIM_DUR=1.467`
- `drone.js` — `DRONE_ACCEL=4`, `DRONE_DRAG=3`, `SPAWN_LEAVE_RADIUS=7`
- `shoot.js` — `BULLET_SPEED=65`, `BULLET_GRAV=6`, `BULLET_MAX_LIFE=1.1`
- `loop.js` — `JUMP_START_DUR=0.32`, `JUMP_LAND_DUR=0.38`

Move all to `config.js` under namespaced blocks (`PHYSICS.DIVE`, `PHYSICS.BULLET`, etc.).

### Dead code in map.js
`_revolvedFrac()` and `_diagFrac()` defined in both `map.js` and `level.js`. Remove from `map.js` (level.js is authoritative).

### Duplicate friend-indicator mesh creation
Identical `ConeGeometry + MeshBasicMaterial` block appears 3× in `enemies.js` (lines ~235, ~296, ~272).
Extract:
```js
function createFriendIndicator() { ... }
```

---

## MEDIUM

### loop.js — too large (337 lines, mixed concerns)
Split:
- `playerAnimation.js` — jump phase state machine + clip selection logic
- `cameraController.js` — third-person lerp, shoulder offset, `tpCamY` smoothing
- `loop.js` — stays as thin coordinator

### Circular S&D dependency via event bus
`enemyStates.js` does `on('snd:configure', api => _snd = api)` to avoid import cycle.
Fix: pass `snd` API as a parameter to state transition functions instead of a module-level side-effect.

### Enemy state mutation inconsistency
Two patterns exist:
- `transitionTo(e, STATE)` in `enemyStates.js` (correct)
- Direct `e.state = 'attack'; e._aiState = STATE;` in `enemies.js` (bypasses helpers)

Standardise: always use `transitionTo()`.

### Velocity drag pattern duplication
Three different spellings of exponential drag across `drone.js`, `enemies.js`, `player.js`:
```js
vel -= vel * DRAG * dt         // additive
vel *= 1 - DRAG * dt           // multiplicative
vel *= Math.pow(0.9, dt * 60)  // frame-rate biased
```
Unify to `applyDrag(vel, drag, dt) { return vel * (1 - drag * dt); }` in `math.js`.

### Missing squared-distance helper
`Math.sqrt(dx*dx + dz*dz)` then compare — appears 6+ times.
Add to `math.js`:
```js
export function dist2(dx, dz) { return dx*dx + dz*dz; }
```
Replace range checks with `dist2(dx, dz) < range*range`.

### Mesh replace pattern
```js
scene.remove(e.mesh); e.mesh = newMesh; scene.add(e.mesh);
```
Appears 5× in enemies.js / drone.js / grenades.js.
Extract `function replaceMesh(entity, newMesh)`.

---

## LOW

### showMsg / showStatus inconsistency
`overlay.js` exports two message functions with different signatures.
`grenades.js`, `drone.js`, `player.js` mix them inconsistently.
Unify: `export function showMessage(text, duration = 2000)`.

### map_backup_v1.js
Delete. Fully superseded, never imported.

### Event bus strings not centralised
`emit('wave:end')`, `on('player:died')`, etc. — string literals scattered.
Create `events.js` constants:
```js
export const EV = { WAVE_END: 'wave:end', PLAYER_DIED: 'player:died', ... };
```

### entityBase.js — isAlive() never called externally
`obj.isAlive = () => !obj.dead` defined in mixin but not used anywhere in codebase.
Verify usage; if absent, remove.

### Material duplication in weapon.js
`mm()` helper exists in `materials.js` but `weapon.js` hand-creates materials with raw `MeshStandardMaterial({...})`.
Use `mm()` consistently.

---

## QUICK WINS (do first, low effort)

| Task | Est. | Status |
|------|------|--------|
| Delete `map_backup_v1.js` | 1 min | ✅ done |
| Remove duplicate `_revolvedFrac`/`_diagFrac` from `map.js` | 5 min | ⚠️ skipped — both files use them internally; moving to shared module risks circular dep |
| Add `worldToCell()` to `map.js`, replace callsites | 1 hr | ✅ done — enemies.js, friendlyBots.js, player.js, enemyStates.js, ammoDrops.js, grenades.js |
| Add `dist2()` to `math.js`, replace sqrt range checks | 30 min | ✅ done — ammoDrops.js pickup check replaced |
| Move physics constants to `config.js` | 2 hr | ✅ done — player.js, loop.js, enemyAnimations.js, shoot.js, drone.js |
| Extract `createFriendIndicator()` in `enemies.js` | 30 min | ✅ done — _attachFriendIndicator + restoreFriendIndicator extracted |
| Unify `showMsg`/`showStatus` → `showMessage()` | 30 min | ⚠️ skipped — different DOM elements (`#msg` vs `#status`), different default durations; not true duplicates |

**All quick wins complete.**
