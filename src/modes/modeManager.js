// Active game mode — null means free-play (wave) mode.
// Satisfies: { name: string, tick: (dt: number, keys: object) => void }
let _mode = null;

export function setMode(mode) { _mode = mode; }
export function getMode()     { return _mode; }

/** True whenever any structured game mode is running (e.g. S&D). */
export function isAnyModeActive() { return _mode !== null; }
