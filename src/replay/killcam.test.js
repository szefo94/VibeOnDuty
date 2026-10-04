import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../scene.js', () => ({
  camera: { position: { set: vi.fn() }, lookAt: vi.fn() },
}));

import { startKillcam, stopKillcam, tickKillcam, isKillcamActive } from './killcam.js';

let elements;
let listeners;
beforeEach(() => {
  elements = new Map([['kc-skip', { addEventListener: (name, fn) => listeners.set(name, fn) }]]);
  listeners = new Map();
  vi.stubGlobal('document', {
    getElementById: (id) => elements.get(id),
    createElement: () => ({ style: {} }),
    body: { appendChild: (element) => elements.set(element.id, element) },
    addEventListener: (name, fn) => listeners.set(name, fn),
  });
});
afterEach(() => {
  stopKillcam();
  vi.unstubAllGlobals();
});

describe('killcam completion ownership', () => {
  it('cancels the retired death callback before a new session starts', () => {
    const retired = vi.fn(), current = vi.fn();
    startKillcam({ dead: true }, retired);
    stopKillcam();
    expect(isKillcamActive()).toBe(false);
    expect(elements.get('killcam-wrap').style.display).toBe('none');
    tickKillcam(10);
    expect(retired).not.toHaveBeenCalled();
    startKillcam({ dead: true }, current);
    tickKillcam(3);
    tickKillcam(3);
    expect(current).toHaveBeenCalledTimes(1);
    expect(retired).not.toHaveBeenCalled();
  });

  it.each(['click', 'keydown'])('still completes the current death once on %s skip', (name) => {
    const done = vi.fn();
    startKillcam({ dead: true }, done);
    listeners.get(name)({ code: 'KeyK' });
    tickKillcam(3);
    stopKillcam();
    expect(done).toHaveBeenCalledTimes(1);
    expect(isKillcamActive()).toBe(false);
  });
});
