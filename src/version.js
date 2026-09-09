// Build stamp, injected by vite.config.js at build time.
// Dev server (`npm run dev`) also goes through Vite, so these are always defined.
export const BUILD = {
  sha:    typeof __BUILD_SHA__    !== 'undefined' ? __BUILD_SHA__    : 'dev',
  branch: typeof __BUILD_BRANCH__ !== 'undefined' ? __BUILD_BRANCH__ : 'local',
  time:   typeof __BUILD_TIME__   !== 'undefined' ? __BUILD_TIME__   : '',
  tag:    typeof __BUILD_TAG__    !== 'undefined' ? __BUILD_TAG__    : '',
};

// "v0.2.0 (main@abc1234)" once a tag exists, "main@abc1234" before that.
export const VERSION_STRING = BUILD.tag
  ? `${BUILD.tag} (${BUILD.branch}@${BUILD.sha})`
  : `${BUILD.branch}@${BUILD.sha}`;

// Stamps the version into the DOM and the console so it can be read three ways:
// the corner of the start overlay, the console on boot, and window.__build.
export function initVersionStamp() {
  console.log(
    `%c[BUILD] ${VERSION_STRING}  built ${BUILD.time}`,
    'color:#00ccff;font-weight:bold'
  );
  window.__build = { ...BUILD, toString: () => VERSION_STRING };

  const el = document.getElementById('build-stamp');
  if (el) {
    el.textContent = VERSION_STRING;
    el.title = `built ${BUILD.time}`;
  }
}
