---
last_mapped_commit: 748d8199047ad3344e6356a82371757d90413145
last_mapped_at: 2026-10-03
---
# Testing Patterns

**Analysis Date:** 2026-10-03

## Test Framework

**Runner:**
- Vitest declared as `^4.1.3` in `package.json`; `vitest.config.js` includes `src/**/*.test.js` and otherwise uses defaults, including the Node environment.
- Playwright declared as `^1.40.0` in `package.json`; `playwright.config.js` targets `tests/` and starts Vite on port 5173.
- Mapping reads configuration and test source; it does not establish a passing result for this checkout. Historical pass counts in `AGENTS.md` are not current execution evidence.

**Assertion Library:**
- Vitest `expect` in `src/combat/damage.test.js` and Playwright `expect` in `tests/smoke.spec.js`.
- Use tolerant floating-point assertions (`toBeCloseTo`, angular/distance thresholds) for math and animation, matching `src/map.test.js` and `src/builders/rifleClips.test.js`.

**Run Commands:**

```bash
npm ci                          # Install tracked dependencies
npm test                        # All configured Vitest files
npm run test:unit                # Same Vitest run command
npm run test:watch               # Vitest watch mode
npm run test:e2e                 # Playwright browser specs
npm run lint                    # ESLint src/, no warnings permitted
npm run typecheck               # tsc --noEmit; checkJs is disabled
npm run build                   # Production bundle
npx playwright install chromium # Browser prerequisite when absent
```

- Commands come from `package.json`; the browser installation requirement is explicit in `.github/workflows/test.yml`.
- No coverage script/provider is configured in `package.json` or `vitest.config.js`.

## Test File Organization

**Location:**
- Unit and Node integration tests are colocated under `src/`, selected by `vitest.config.js`.
- Browser integration/UI specs live separately under `tests/`, selected by `playwright.config.js`.

**Naming:**
- Use `<module>.test.js` for Vitest and `<subject>.spec.js` for Playwright, following `src/builders/enemyAnimations.test.js` and `tests/animation-regressions.spec.js`.

**Structure:**

```text
src/
  astar.test.js
  map.test.js
  math.test.js
  tiles.test.js
  combat/damage.test.js
  entities/groundSync.test.js
  modes/snd.test.js
  builders/enemyAnimations.test.js
  builders/rifleClips.test.js
  builders/weapon3pTransform.test.js
tests/
  smoke.spec.js
  assets.spec.js
  animation-regressions.spec.js
```

## Test Structure

**Suite Organization:** Actual boundary-test pattern from `src/combat/damage.test.js`:

```javascript
describe('grenadeFalloff', () => {
  it('returns 0 at the radius boundary', () => {
    expect(grenadeFalloff(GRENADE_RADIUS)).toBeCloseTo(0);
  });
});
```

**Patterns:**
- Group cases by exported helper or behavioral invariant with `describe` and descriptive `it` names (`src/combat/damage.test.js`, `src/builders/enemyAnimations.test.js`).
- Use `it.each` for animation combinations and shipped-clip variants (`src/builders/enemyAnimations.test.js`, `src/builders/rifleClips.test.js`).
- Reset S&D state with `startSnd()` in `beforeEach` and provide the minimal pointer-lock document surface (`src/modes/snd.test.js`).
- Load and compose the real GLB once in asynchronous `beforeAll`, then clone/sample each test pose (`src/builders/rifleClips.test.js`).
- Browser regression `beforeEach` navigates and waits for `#startbtn` to be enabled with a 20-second readiness timeout (`tests/animation-regressions.spec.js`).
- Dispose temporary character meshes/mixers and renderer instances in browser resource tests (`tests/animation-regressions.spec.js`).

## Mocking

**Framework:** Vitest `vi.mock` and `vi.fn` in `src/modes/snd.test.js`.

**Patterns:** Actual scene boundary mock from `src/modes/snd.test.js`:

```javascript
vi.mock('../scene.js', () => ({
  scene: { add: vi.fn(), remove: vi.fn() },
  camera: { position: { set: vi.fn(), x: 0, z: 0 } },
}));
```

- The S&D suite also substitutes Three.js constructors, player state, HUD, events, input, economy, and buy-menu functions before importing `src/modes/snd.js`.
- Modules with render/DOM work at import time need these boundary substitutions; the default Vitest environment has no browser DOM (`vitest.config.js`, `src/modes/snd.test.js`).

**What to Mock:**
- Mock unrelated rendering, HUD, input, and external state when exercising the S&D state machine (`src/modes/snd.test.js`).
- Supply only the API surface needed by the tested behavior; examples use minimal constructors and `document.exitPointerLock` in `src/modes/snd.test.js`.

**What NOT to Mock:**
- Keep damage formulas and geometry math real in `src/combat/damage.test.js`, `src/math.test.js`, and `src/map.test.js`.
- Keep real Three.js `AnimationMixer` behavior for blend ownership tests (`src/builders/enemyAnimations.test.js`).
- Keep the shipped skeleton and clips real for pose tests (`src/builders/rifleClips.test.js`, `public/models/enemy.glb`).
- Browser asset tests exercise actual loading and rendering paths (`tests/assets.spec.js`, `tests/animation-regressions.spec.js`).

## Fixtures and Factories

**Test Data:** Sampling pattern from `src/builders/rifleClips.test.js`:

```javascript
function sample(clip, t) {
  const root = clone(gltf.scene), mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(clip).play();
  mixer.update(t);
  root.updateMatrixWorld(true);
  return root;
}
```

**Location:**
- Factories are local to suites: `actor()` builds synthetic actions in `src/builders/enemyAnimations.test.js`; browser actor construction lives inside `page.evaluate()` in `tests/animation-regressions.spec.js`.
- Real asset fixture: `public/models/enemy.glb`, read with `node:fs` and parsed by `GLTFLoader.parseAsync()` in `src/builders/rifleClips.test.js`.
- Map/pathfinding cases use specific cells of the imported active map in `src/map.test.js` and `src/astar.test.js`; changes to that default map require reviewing those assumptions.
- No shared fixture directory is configured by `vitest.config.js` or `playwright.config.js`.

## Coverage

**Requirements:** No percentage threshold, coverage provider, or coverage report configuration in `vitest.config.js` or `package.json`.

**View Coverage:**
- Not configured. `npm test` produces test execution results, not coverage (`package.json`). Add an explicit compatible provider/configuration if coverage reporting becomes required.
- Do not infer full gameplay coverage from the small browser suite; automated pose metrics need visual inspection for animation quality (`AGENTS.md`, `tests/animation-regressions.spec.js`).

## Test Types

**Unit Tests:**
- `src/math.test.js`: vector/projectile segment calculations.
- `src/combat/damage.test.js`: grenade radius, falloff, proportional entity damage, and player cap.
- `src/tiles.test.js`: tile codec and ramp-related helpers.
- `src/builders/weapon3pTransform.test.js`: weapon mounting basis.
- `src/builders/enemyAnimations.test.js`: action aliases, interrupted fades, death ownership, and one-shot deadlines using real mixer updates.

**Integration Tests:**
- `src/map.test.js`, `src/astar.test.js`, and `src/entities/groundSync.test.js` combine helpers with actual map data for collision, navigation, and surface-height invariants.
- `src/modes/snd.test.js` exercises round/match state with surrounding subsystems mocked; it does not validate their integration.
- `src/builders/rifleClips.test.js` parses the shipped GLB and samples composed clips against bone orientation and lower-body preservation invariants without a renderer.
- `tests/animation-regressions.spec.js` checks real browser actions, weapon orientation, GPU-resource lifecycle, grenade releases, and gameplay duration fitting.

**E2E Tests:**
- `tests/smoke.spec.js` checks menus, HUD entry, S&D initial scores/round state, page errors, and visible/programmatic build stamps.
- `tests/assets.spec.js` checks GLB loading, clip resolution, track stripping, animated-loop errors, and opt-in transition logs.
- `playwright.config.js` uses headless mode, an 800x600 viewport, and `--use-gl=swiftshader`; CI uses one worker and a 60-second test timeout, local timeout is 30 seconds.
- Vite web-server timeout is 30 seconds; local runs reuse an existing server, CI starts its own (`playwright.config.js`).
- Editor interaction coverage is a manual checklist in `docs/TESTING.md`, including zoom, fill/rectangle/mirror tools, and undo; it is not a general automated testing guide.

## Common Patterns

**Async Testing:** Readiness pattern used by `tests/smoke.spec.js`:

```javascript
await page.goto('/');
await expect(page.locator('#snd-startbtn')).toBeEnabled({ timeout: 20000 });
await page.locator('#snd-startbtn').click();
await expect(page.locator('#snd-bar')).toBeVisible();
```

- Prefer enabled-button or animation-state waits for new cases. Existing asset tests also contain fixed 3-second waits (`tests/assets.spec.js`), which should not be treated as a readiness guarantee.
- Use asynchronous `page.evaluate()` with dynamic `src/` imports to drive simulation deterministically and return serializable measurements (`tests/animation-regressions.spec.js`).
- Advance mixers or simulation ticks with explicit deltas for timing tests, following `src/builders/enemyAnimations.test.js` and grenade marker tests in `tests/animation-regressions.spec.js`.

**Error Testing:** Browser error-collection pattern from `tests/assets.spec.js`:

```javascript
const errors = [];
page.on('pageerror', e => {
  if (!/pointer lock/i.test(e.message)) errors.push(e.message);
});
// Navigate, start gameplay, and exercise the relevant behavior.
expect(errors).toEqual([]);
```

- Keep the known headless pointer-lock exception filter narrow; other page errors fail the test (`tests/assets.spec.js`).
- Assert invalid/boundary results explicitly: out-of-bounds height returns zero (`src/map.test.js`), blocked navigation returns an empty path (`src/astar.test.js`), and damage outside radius is zero (`src/combat/damage.test.js`).

**CI Validation:**
- `.github/workflows/test.yml` runs on pushes, pull requests, and reusable workflow calls. It installs with `npm ci` on Node 20, then runs lint, typecheck, unit tests, Chromium/system-dependency installation, and browser tests.
- The workflow disables an unused Chrome apt source before browser dependency installation and attempts to upload `playwright-report/` on failures (`.github/workflows/test.yml`).
- `.github/workflows/deploy.yml` calls the reusable tests and gates its build with `needs: tests`; production and optional staging checkouts are then built separately. The test gate does not itself demonstrate that both separately checked-out branch heads were tested.
- Production build validation is part of deployment; `.github/workflows/test.yml` does not contain an `npm run build` step.

---

*Testing analysis: 2026-10-03*
