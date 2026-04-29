import { DIFFICULTY_PRESETS } from './config.js';

let _key = 'regular';

export function setDifficulty(key) {
  _key = DIFFICULTY_PRESETS[key] ? key : 'regular';
}

export function getDifficultyKey() { return _key; }
export function getDifficulty()    { return DIFFICULTY_PRESETS[_key]; }
