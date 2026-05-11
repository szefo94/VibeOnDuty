import { DIFFICULTY_PRESETS } from './config.js';

let _key = 'regular';
let _override = null;

export function setDifficulty(key) {
  _key = DIFFICULTY_PRESETS[key] ? key : 'regular';
}

export function getDifficultyKey()              { return _key; }
export function getDifficulty()                 { return _override ?? DIFFICULTY_PRESETS[_key]; }
export function setDifficultyOverride(preset)   { _override = preset; }
export function clearDifficultyOverride()       { _override = null; }
