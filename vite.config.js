import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

// Build stamp — so you can tell at a glance which commit a running build came from
// (the deployed Pages site especially). Prefers the values GitHub Actions provides,
// since actions/checkout makes a shallow clone where git metadata is thin, and falls
// back to local git for dev builds. Never throws: a missing stamp must not break a build.
function sh(cmd) {
  try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return ''; }
}
const sha    = (process.env.GITHUB_SHA || sh('git rev-parse HEAD') || 'unknown').slice(0, 7);
const branch = process.env.BUILD_BRANCH || process.env.GITHUB_REF_NAME || sh('git rev-parse --abbrev-ref HEAD') || 'unknown';
// Nearest tag, so a released build reads "v0.2.0 (main@abc1234)" instead of a bare
// SHA. Empty until the first tag exists, and empty on a shallow clone without tags.
const tag    = sh('git describe --tags --abbrev=0') || '';
const dirty  = process.env.GITHUB_SHA ? '' : (sh('git status --porcelain') ? '+dirty' : '');
const built  = new Date().toISOString().replace('T', ' ').slice(0, 16) + 'Z';

export default defineConfig({
  root: '.',
  // Overridable so the same source can be published under more than one path —
  // prod at /VibeOnDuty/ and staging at /VibeOnDuty/next/. See deploy.yml.
  base: process.env.PUBLIC_BASE ?? '/VibeOnDuty/',
  define: {
    __BUILD_SHA__:    JSON.stringify(sha + dirty),
    __BUILD_BRANCH__: JSON.stringify(branch),
    __BUILD_TIME__:   JSON.stringify(built),
    __BUILD_TAG__:    JSON.stringify(tag),
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
});
