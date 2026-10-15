---
last_mapped_commit: 748d8199047ad3344e6356a82371757d90413145
last_mapped_at: 2026-10-03
---
# External Integrations

**Analysis Date:** 2026-10-03

## APIs & External Services

**Gameplay services:**
- `server/index.js` serves the validated root-base production build, `/health`, and Colyseus transport on one HTTP or HTTPS origin. `server/cli.js` owns bind/port/public/build/rules validation; omitted build directory defaults to repository `dist` independently of cwd. WebSocket upgrade requires the actual listen or advertised Origin. `server/tls.js` atomically stores/reuses the self-signed SAN/key pair under ignored restricted `.vod-server/tls/`; manual trust remains phase-end UAT. See `docs/MULTIPLAYER.md` for exact command and reverse-proxy semantics.
  - SDK/Client: pinned `@colyseus/sdk` in `src/network/onlineSession.js`, connecting through `location.origin` to the server-local `tdm` room.
  - Authority: room-bound session intentions drive isolated shared simulation; state replicates to participants and hit confirmations go only to the shooter. No account credentials or persistence.

**Static asset delivery:**
- Same-origin HTTP model loading, using the deployed static site or Vite server.
  - SDK/Client: Three.js `GLTFLoader` in `src/builders/enemyGLTF.js`; `FBXLoader` in `src/builders/weaponFBX.js` and `src/builders/enemyWeapon.js`.
  - Auth: none; public model URLs use `import.meta.env.BASE_URL`.
  - Requests: HEAD probes followed by loader requests for `public/models/enemy.glb`, `public/models/FBX/P90.fbx`, and `public/models/FBX/Pistol.fbx` through their respective loader modules.
  - Lifecycle: `src/main.js` registers these loaders; `src/builders/assetManager.js` uses `Promise.allSettled`, allowing procedural fallback on load failure.

**Offline asset pipeline:**
- Mixamo FBX source animations reside in `tools/anim-sources/`; `tools/retarget.py` imports them through Blender and exports `public/models/enemy.glb`.
  - SDK/Client: Blender `bpy` and `mathutils`, invoked as documented in `tools/README.md`.
  - Auth: no live Mixamo API or credentials configured in `tools/retarget.py`.

## Data Storage

**Databases:**
- Not detected in `package.json` or `src/editor/mapEditor.js`; no database connection or ORM client is configured.
- Browser localStorage stores map slots as JSON containing a name and base64 map representation in `src/editor/mapEditor.js`, with keys `vod_slot_<index>`.

**File Storage:**
- Repository/static filesystem assets in `public/models/` and animation inputs in `tools/anim-sources/`; no cloud object-storage client in `package.json`.
- Editor sharing serializes map JSON to base64 and places it in a `map` query parameter in `src/editor/mapEditor.js`; `src/main.js` reads that parameter and calls `mapDefFromB64()`.
- The editor copies exported data with `navigator.clipboard.writeText` in `src/editor/mapEditor.js`; there is no server upload endpoint.

**Caching:**
- In-memory loaded templates in `src/builders/enemyGLTF.js` and `src/builders/enemyWeapon.js`; no Redis or external cache in `package.json`.
- No service worker or IndexedDB integration detected in `src/`; persistent editor data uses localStorage in `src/editor/mapEditor.js`.

## Authentication & Identity

**Auth Provider:**
- None detected in `package.json` and `src/main.js`; no login flow, account API, or player identity persistence is implemented there.
- Deployment uses GitHub Pages permissions and OIDC (`pages: write`, `id-token: write`) in `.github/workflows/deploy.yml`, separate from gameplay identity.

## Monitoring & Observability

**Error Tracking:**
- No hosted error tracking SDK in `package.json`; model-load failures log warnings and return fallback status in `src/builders/weaponFBX.js` and `src/builders/enemyGLTF.js`.

**Logs:**
- Browser console logging and warnings in `src/version.js`, `src/builders/weaponFBX.js`, and `src/entities/enemyUpdate.js`; development-only diagnostics use `import.meta.env.DEV` in `src/astar.js` and `src/entities/enemyUpdate.js`.
- `src/version.js` shows the build identifier in the menu, console, and `window.__build`; values originate in `vite.config.js`.
- Animation diagnostics are exposed by `src/builders/enemyAnimations.js` and initialized through `src/main.js`.
- `.github/workflows/test.yml` uploads `playwright-report/` on failure with seven-day retention.

## CI/CD & Deployment

**Hosting:**
- GitHub Pages through `.github/workflows/deploy.yml`: main is built into `prod/dist`; optional develop output is copied into `prod/dist/next` and published as a single Pages artifact.
- `vite.config.js` sets `/VibeOnDuty/` by default; staging sets `PUBLIC_BASE=/VibeOnDuty/next/` and `BUILD_BRANCH=develop` in `.github/workflows/deploy.yml`.
- Preserve BASE_URL-based asset requests in `src/builders/enemyGLTF.js`, `src/builders/weaponFBX.js`, and `src/builders/enemyWeapon.js` for both paths.

**CI Pipeline:**
- `.github/workflows/test.yml` runs on push, pull request, and reusable workflow calls: Node 20, npm ci, ESLint, TypeScript, Vitest, Chromium installation, and Playwright.
- `.github/workflows/deploy.yml` runs on main/develop pushes and manual dispatch, waits for the reusable test job, checks out main and optional develop, builds, uploads, and deploys.
- GitHub Actions integrations use `actions/checkout@v4`, `actions/setup-node@v4`, and `actions/upload-artifact@v4` in `.github/workflows/test.yml`; Pages uses `actions/upload-pages-artifact@v3` and `actions/deploy-pages@v4` in `.github/workflows/deploy.yml`.
- Pages deployments share concurrency group `pages` with cancellation enabled in `.github/workflows/deploy.yml`.

## Environment Configuration

**Required env vars:**
- No application secret environment variables required by `package.json`, `src/main.js`, or `vite.config.js`.
- Optional build inputs in `vite.config.js`: `PUBLIC_BASE`, `BUILD_BRANCH`, `GITHUB_SHA`, and `GITHUB_REF_NAME`; local Git metadata and safe defaults fill missing stamp values.
- `CI` selects browser-test behavior in `playwright.config.js`; GitHub provides `GITHUB_REPOSITORY` and `GITHUB_OUTPUT` used by `.github/workflows/deploy.yml` to detect develop.
- Build-time `__BUILD_SHA__`, `__BUILD_BRANCH__`, `__BUILD_TIME__`, and `__BUILD_TAG__` are Vite-injected constants in `vite.config.js`, consumed by `src/version.js`, rather than runtime secrets.

**Secrets location:**
- No `.env*` files detected in the repository root; no application credential requirement is declared in `vite.config.js` or `package.json`.
- GitHub Pages deploy authorization is managed by the workflow permission block and `github-pages` environment in `.github/workflows/deploy.yml`; no repository credential file is referenced.

## Webhooks & Callbacks

**Incoming:**
- The dedicated server exposes readiness, static game assets and Colyseus matchmaking/WebSocket endpoints; no application webhook receiver is implemented.
- The `map` query parameter is a browser import entry in `src/main.js` and `src/editor/mapEditor.js`, not a webhook receiver.
- Repository push, pull-request, and manual workflow events are configured in `.github/workflows/test.yml` and `.github/workflows/deploy.yml`.

**Outgoing:**
- No application webhook delivery detected in `src/`; model loaders issue same-origin asset requests in `src/builders/enemyGLTF.js`, `src/builders/weaponFBX.js`, and `src/builders/enemyWeapon.js`.
- Local synchronous game-event subscriptions use `src/events.js`; they do not send network callbacks.

---

*Integration audit: 2026-10-03*
