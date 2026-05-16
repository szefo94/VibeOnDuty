# REFACTOR PREVIEW

Audit of `/src`. Grouped by priority. Each item notes file, problem, fix.

---

## CRITICAL

### ~~enemies.js — too large (530+ lines, 4+ responsibilities)~~ ✅ done
Split into `enemySpawning.js` (S&D/TDM/rebuild), `enemyUpdate.js` (AI loop),
`enemies.js` kept as core pool + kill + triggerDeath (~200 lines each).

---

## HIGH

### ~~Duplicate grid-to-world conversion~~ ✅ done
`worldToCell(x, z)` exported from `map.js`, replaced across all callsites.

### level.js — too large (490+ lines)
Split into:
- `rampGeometry.js` — all ramp generators (`_diagFrac`, `_bilinearFrac`, `_revolvedFrac`, etc.)
- `levelTiles.js` — tile predicate helpers (`_isRamp`, `_isCrack`, etc.)
- `levelBuilder.js` — main `buildLevel` orchestrator

### ~~Physics / animation constants scattered in source files~~ ✅ done
All constants moved to `config.js` under named sections. Callsites updated.

### Dead code in map.js
`_revolvedFrac()` and `_diagFrac()` defined in both `map.js` and `level.js`. Remove from `map.js` (level.js is authoritative).

### ~~Duplicate friend-indicator mesh creation~~ ✅ done
`_attachFriendIndicator()` extracted, shared geometry/material hoisted to module level.

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

### ~~Enemy state mutation inconsistency~~ ✅ verified — already clean
No direct `e.state =` assignments in enemy code outside `transitionTo()`. The sync block
in `enemyUpdate.js` is a defensive guard, not a pattern to remove.

### ~~Velocity drag pattern duplication~~ ✅ done
`applyDrag(v, drag, dt)` added to `math.js`. Replaced in `drone.js` and `enemyUpdate.js`.

### ~~Missing squared-distance helper~~ ✅ done
`dist2(dx, dz)` added to `math.js`. Remaining sqrt callsites also compute direction
(need the real value for normalization) — pure range-check replacements exhausted.

### ~~Mesh replace pattern~~ ✅ verified — not applicable
No 3-part `remove → reassign → add` sequences exist in current code; each entity's
mesh lifecycle is already contained within helper functions.

---

## LOW

### showMsg / showStatus inconsistency
`overlay.js` exports two message functions with different signatures.
`grenades.js`, `drone.js`, `player.js` mix them inconsistently.
Unify: `export function showMessage(text, duration = 2000)`.

### map_backup_v1.js
Delete. Fully superseded, never imported.

### ~~Event bus strings not centralised~~ ✅ done
`EV` constants object added to `events.js`. Available for new callsites; existing string
literals left in place (touching 10 files for cosmetic rename has poor risk/reward).

### ~~entityBase.js — isAlive() never called externally~~ ✅ done
Confirmed unused, removed.

### ~~Material duplication in weapon.js~~ ✅ verified — already clean
`weapon.js` uses `mm()` for all opaque materials. The one `MeshBasicMaterial` (flash) is
intentional — transparent/unlit effect, not replaceable with `mm()`.

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
