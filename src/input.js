export const keys = {};
export let locked = false,
  gameRunning = false,
  mouseHeld = false;

export function setGameRunning(v) {
  gameRunning = v;
}
export function setLocked(v) {
  locked = v;
}

export function neutralizeInput() {
  for (const key of Object.keys(keys)) keys[key] = false;
  mouseHeld = false;
  locked = false;
}

document.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
document.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});
document.addEventListener('mousedown', (e) => {
  if (e.button === 0) mouseHeld = true;
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseHeld = false;
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === document.getElementById('c');
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
