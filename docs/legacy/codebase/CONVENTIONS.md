---
last_mapped_commit: 748d8199047ad3344e6356a82371757d90413145
last_mapped_at: 2026-10-03
---
# Coding Conventions

**Analysis Date:** 2026-10-03

## Naming Patterns

**Files:**
- Use camelCase JavaScript module names for multiword concepts, matching `src/builders/assetManager.js`, `src/entities/enemySpawning.js`, and `src/modes/modeManager.js`.
- Keep unit tests beside the implementation with `.test.js`, as in `src/combat/damage.test.js`; browser specs live in `tests/animation-regressions.spec.js`.
- Put domain modules under existing responsibility directories such as `src/combat/`, `src/builders/`, and `src/modes/`; avoid framework component naming for this plain ES-module application (`package.json`).

**Functions:**
- Use camelCase verbs: `grenadeFalloff`, `register`, `loadAll`, `tryLoadEnemyGLTF`, and `buildPlayerMesh` in `src/combat/damage.js`, `src/builders/assetManager.js`, and `src/builders/enemyGLTF.js`.
- Prefix lifecycle operations consistently with `init`, `start`, `tick`, `build`, `dispose`, or `set` where appropriate; examples appear in `src/main.js` and `src/builders/enemyGLTF.js`.

**Variables:**
- Use camelCase for state and UPPER_SNAKE_CASE for shared constants, matching `gltfTemplate`, `playerMesh`, `CLIP_KEYS`, and `REQUIRED_KEYS` in `src/builders/enemyGLTF.js`.
- Underscore-prefixed names mark internal state/helpers, for example `_registry` in `src/builders/assetManager.js` and `_mapRegistry` in `src/main.js`; this is a convention, not enforced privacy.
- Keep externally meaningful string keys intact: weapon keys, animation names, and event names are runtime contracts in `src/builders/weapon3pTransform.js`, `src/builders/enemyGLTF.js`, and `src/events.js`.

**Types:**
- Runtime code uses JavaScript objects; reference interfaces use PascalCase (`EntityBase`, `AiState`, `Enemy`, `Player`) in `types/entities.d.ts`.
- Verify declarations against implementations: `types/entities.d.ts` is a reference rather than a checked JavaScript model, because `tsconfig.json` sets `checkJs: false` and `strict: false`.

## Code Style

**Formatting:**
- Follow `.prettierrc`: two spaces, semicolons, single quotes, ES5 trailing commas, and print width 100.
- Preserve surrounding layout when editing. Existing aligned object fields and compact statements in `src/events.js` and `src/builders/enemyGLTF.js` do not always follow Prettier output.
- `package.json` provides no formatting script and `.github/workflows/test.yml` contains no formatter check; formatting configuration does not imply CI enforcement.

**Linting:**
- `eslint.config.js` uses ESLint recommended rules, ECMAScript 2022, ES modules, browser globals, and readonly Vite build-stamp globals.
- `no-unused-vars` is a warning, with `argsIgnorePattern` and `varsIgnorePattern` set to `^_`; `npm run lint` uses `--max-warnings 0`, so unsuppressed warnings fail the command (`package.json`).
- `no-console` is disabled; `dist/**` and `node_modules/**` are ignored in `eslint.config.js`.
- The configured lint command checks `src/`; browser tests, tools, and root configs are outside that command's target (`package.json`).
- `npm run typecheck` runs `tsc --noEmit`; do not claim it checks runtime JavaScript property usage because `tsconfig.json` explicitly disables `checkJs`.

## Import Organization

**Order:**
1. External libraries typically lead, for example `three` at the top of `src/main.js` and `src/builders/weapon3pTransform.js`.
2. Local modules follow, generally grouped by responsibility rather than sorted alphabetically (`src/main.js`).
3. Test framework imports precede helpers under test in `src/combat/damage.test.js`; mock declarations precede the imported mode in `src/modes/snd.test.js`.

- No import-order lint rule is configured in `eslint.config.js`; follow nearby imports instead of rearranging unrelated code.
- Use explicit `.js` suffixes for relative ES-module imports, as in `src/combat/damage.js`.

**Path Aliases:**
- Not detected in `tsconfig.json`; runtime imports use relative paths in `src/main.js` and `src/builders/enemyGLTF.js`.
- Three.js helper modules use package subpaths such as `three/examples/jsm/loaders/GLTFLoader.js` in `src/builders/rifleClips.test.js`.

## Error Handling

**Patterns:**
- Asset loading uses recoverable failure: `src/builders/assetManager.js` aggregates `Promise.allSettled()` results and returns `false` for rejected loaders.
- `src/builders/enemyGLTF.js` catches load failures, logs a warning, and allows procedural fallback; retain that contract when extending loaders.
- User-entered map import failures display `alert('Invalid map data.')` in `src/editor/mapEditor.js`.
- Best-effort storage/clipboard operations may swallow errors in `src/editor/mapEditor.js`; reserve that pattern for optional operations rather than core gameplay failures.
- Pure domain helpers return values instead of throwing for ordinary boundary cases, for example zero falloff outside the grenade radius in `src/combat/damage.js`.

## Logging

**Framework:** Browser console; no logging package in `package.json`.

**Patterns:**
- Use stable subsystem prefixes for diagnostics: `[GLTF]` in `src/builders/enemyGLTF.js` and `[BUILD]` in `src/version.js`.
- Keep transition logging opt-in via `window.__animDebug`, exposed by `src/main.js`; browser coverage checks its behavior in `tests/assets.spec.js`.
- Console messages are observable test inputs for asset loading and build stamps in `tests/assets.spec.js` and `tests/smoke.spec.js`; adjust those assertions if message contracts change.

## Comments

**When to Comment:**
- Explain coordinate bases, transform ownership, and resource invariants as in `src/builders/weapon3pTransform.js` and `src/builders/enemyGLTF.js`.
- Use section comments in larger modules, matching `src/main.js`; keep explanations close to the code they constrain.
- Document behavioral regressions with rationale in tests, for example ramp/hitbox agreement in `src/entities/groundSync.test.js`.

**JSDoc/TSDoc:**
- JSDoc appears selectively for public helpers and domain contracts; `src/builders/assetManager.js` annotates loader parameters and `src/builders/weapon3pTransform.js` explains exported transforms.
- Type declarations in `types/entities.d.ts` are incomplete; maintain documentation and source together when changing entity contracts (`AGENTS.md`, `tsconfig.json`).

## Function Design

**Size:** No enforced function-size limit in `eslint.config.js`. Pure calculations are small exports in `src/combat/damage.js`; initialization/controller modules such as `src/main.js` contain broader orchestration.

**Parameters:** Use explicit scalar arguments for math helpers in `src/combat/damage.js`; mutable actor objects and elapsed time for animation operations in `src/builders/enemyAnimations.js`. Preserve timer units documented in `AGENTS.md` when combining APIs.

**Return Values:** Return scalars for math helpers (`src/combat/damage.js`), named result maps for batch loaders (`src/builders/assetManager.js`), and mutate shared runtime state through its existing lifecycle API (`src/main.js`).

## Module Design

**Exports:** Prefer named exports, matching `src/events.js` and `src/combat/damage.js`. Live exported bindings represent initialized assets in `src/builders/enemyGLTF.js`; consumers must respect asynchronous readiness.

**Barrel Files:** No broad application barrel is used by `src/main.js`. Focused re-exports exist, such as `disposeCharacter as disposeEnemyMesh` in `src/builders/enemyGLTF.js`.

- Keep pure calculation modules free of DOM/render initialization so they remain directly testable, following `src/combat/damage.js`.
- Preserve synchronous event behavior and subscription ordering in `src/events.js`; event-mediated mode configuration is an architectural constraint described by `AGENTS.md`.
- Coordinate markup IDs, styles, and consumers across `index.html`, `style.css`, and `src/main.js`; browser UI modules depend on existing elements.
- No project-local skills are detected under `.codex/skills/` or `.agents/skills/`; repository conventions come from `AGENTS.md` and the checked source/configuration.

---

*Convention analysis: 2026-10-03*
