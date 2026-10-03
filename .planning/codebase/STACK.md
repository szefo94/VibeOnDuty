---
last_mapped_commit: 748d8199047ad3344e6356a82371757d90413145
last_mapped_at: 2026-10-03
---
# Technology Stack

**Analysis Date:** 2026-10-03

## Languages

**Primary:**
- JavaScript ES modules, ECMAScript 2022 lint target: gameplay, renderer, editor, and tests in `src/`, `tests/`, and `eslint.config.js`; `package.json` declares `type: module`.

**Secondary:**
- HTML and CSS: browser entry and interface in `index.html` and `style.css`.
- TypeScript declarations: entity reference types in `types/entities.d.ts`; `tsconfig.json` targets ES2022 with ESNext modules and bundler resolution.
- Python 3 through Blender's embedded interpreter: offline model retargeting in `tools/retarget.py`; exact Python and Blender versions are not pinned in `tools/README.md`.
- YAML and Bash: GitHub Actions jobs and deployment assembly in `.github/workflows/test.yml` and `.github/workflows/deploy.yml`.

## Runtime

**Environment:**
- Browser DOM, WebGL, and Canvas 2D: `src/scene.js` initializes the Three.js renderer, camera, and HUD canvas at module evaluation.
- Node.js 24 for development/tests and the planned multiplayer runtime: `package.json` requires `>=24 <25`; `.github/workflows/test.yml` uses Node 24. Deployment assembly in `.github/workflows/deploy.yml` remains unchanged on Node 20.

**Package Manager:**
- npm; no exact npm version or `packageManager` pin in `package.json`. CI uses `npm ci` in `.github/workflows/test.yml`.
- Lockfile: present, `package-lock.json`, lockfile format 3. Versions below are resolved lockfile versions; `package.json` generally specifies caret ranges.

## Frameworks

**Core:**
- Three.js 0.160.1 (r160), declared `^0.160.0`: scene graph, meshes, rendering, animation mixers, loaders, and math in `src/scene.js`, `src/builders/enemyGLTF.js`, and `src/loop.js`.
- No application UI framework; entry and DOM events remain plain JavaScript in `src/main.js`. Approved server dependencies are installed; server gameplay implementation starts in plan 01-02.

**Testing:**
- Vitest 4.1.3: `src/**/*.test.js` and `server/**/*.test.js`, configured by `vitest.config.js`; `npm test` and `npm run test:unit` run once, `npm run test:watch` watches (`package.json`).
- Playwright Test 1.59.1, declared `^1.40.0`: browser tests in `tests/`, configured by `playwright.config.js`; `npm run test:e2e` (`package.json`).
- Playwright runs headless with SwiftShader, starts Vite on port 5173, and uses one CI worker in `playwright.config.js`.
- `playwright.multiplayer.config.js` selects multiplayer/hosting specs independently of the Vite suite. `tests/helpers/mpServer.js` owns isolated OS-temp production builds and dedicated server child processes; discovery verifies concurrent build/cleanup isolation. The first browser tracer is intentionally RED until plan 01-02 implements `server/index.js` and online entry.

**Build/Dev:**
- Vite 8.0.8: development server, production bundling, and preview via `package.json` scripts and `vite.config.js`.
- ESLint 10.2.0 with `@eslint/js` 10.0.1 and `globals` 17.4.0: flat configuration in `eslint.config.js`; `npm run lint` checks `src/`, `server/`, and `tests/helpers/` with zero warnings and scoped Node globals (`package.json`).
- Prettier 3.8.2: `.prettierrc` sets two spaces, semicolons, single quotes, ES5 trailing commas, and 100-column width; no format script is defined in `package.json`.
- TypeScript 6.0.2: `npm run typecheck` invokes `tsc --noEmit`; `allowJs: true`, `checkJs: false`, and `strict: false` in `tsconfig.json` mean JavaScript correctness is not comprehensively type checked.
- `npm run typecheck:mp` uses strict `tsconfig.multiplayer.json` for shared/server/network/helper boundaries. New files opt into checking with `// @ts-check`; imported legacy browser JavaScript stays unchecked.

## Key Dependencies

**Critical:**
- Production dependencies: existing Three plus exact `@colyseus/core` 0.18.18, `@colyseus/sdk` 0.18.4, `@colyseus/schema` 5.0.35, `@colyseus/ws-transport` 0.18.4, Express 5.2.1, and selfsigned 5.5.0. Human approval of the four Colyseus releases is recorded in phase 01 `01-PACKAGE-REVIEW.md`. Transitive nanoid is locked at 3.3.19; runtime audit is clean, with retained pre-existing development advisories deferred.
- `GLTFLoader` and `SkeletonUtils.clone` come from Three.js example modules in `src/builders/enemyGLTF.js`; preserve skeleton cloning and shared template geometry ownership.
- `FBXLoader` comes from Three.js example modules in `src/builders/weaponFBX.js` and `src/builders/enemyWeapon.js`; no separate loader package is required.
- Browser APIs provide input and editor storage: `navigator.getGamepads` in `src/gamepad.js`, touch detection in `src/touch.js`, and localStorage/clipboard in `src/editor/mapEditor.js`.

**Infrastructure:**
- No database, external hosted service, or monitoring dependency is installed. Colyseus SDK/transport/core supply the selected multiplayer foundation; no server gameplay has shipped in 01-01.
- Blender `bpy` and `mathutils` support `tools/retarget.py`; run this tool through Blender as documented in `tools/README.md`, rather than installing it as a gameplay runtime dependency.
- Git CLI supplies optional build metadata through `node:child_process` in `vite.config.js`; failed metadata commands fall back without blocking a build.

## Configuration

**Environment:**
- `PUBLIC_BASE` optionally overrides the default `/VibeOnDuty/` prefix in `vite.config.js`; `BUILD_BRANCH`, `GITHUB_REF_NAME`, and `GITHUB_SHA` influence the build stamp.
- `CI` controls Playwright workers, timeout, and server reuse in `playwright.config.js`.
- Runtime asset URLs use `import.meta.env.BASE_URL` in `src/builders/enemyGLTF.js`, `src/builders/weaponFBX.js`, and `src/builders/enemyWeapon.js`; keep added public asset requests prefix aware.
- `src/config.js` owns shared gameplay constants; map definitions are JavaScript modules in `src/maps/`.
- No project skill directories detected at `.codex/skills/` or `.agents/skills/`; repository guidance is in `AGENTS.md`.

**Build:**
- `vite.config.js` uses root `.` and entry `index.html`, writes `dist/`, and injects four build constants consumed by `src/version.js`.
- `index.html` loads `src/main.js`; public models live in `public/models/` and are loaded at startup through `src/builders/assetManager.js`.
- `tsconfig.json`, `eslint.config.js`, `.prettierrc`, `vitest.config.js`, and `playwright.config.js` configure separate validation tools.

## Platform Requirements

**Development:**
- Install tracked dependencies with `npm ci`, then serve with `npm run dev`; scripts are in `package.json`. Use an HTTP server for modules and asset requests.
- A browser with WebGL and DOM/Canvas support is required by `src/scene.js`; desktop pointer lock, touch, and gamepad input are implemented in `src/input.js`, `src/touch.js`, and `src/gamepad.js`.
- Install Playwright Chromium for browser tests; CI runs `npx playwright install --with-deps chromium` in `.github/workflows/test.yml`.
- Blender and the FBX source directory `tools/anim-sources/` are needed only to regenerate `public/models/enemy.glb` with `tools/retarget.py`.

**Production:**
- Static GitHub Pages site: `.github/workflows/deploy.yml` publishes main at `/VibeOnDuty/` and optional develop at `/VibeOnDuty/next/` in one artifact.
- Offline/static hosting remains available. Multiplayer commands are defined (`mp-server`, `build:mp`, `test:mp`, `typecheck:mp`), but the dedicated server implementation is the next plan; do not treat installed dependencies or the RED tracer as playable multiplayer.

---

*Stack analysis: 2026-10-03*
