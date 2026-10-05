import { setComicQuality } from './comicOutline.js';

export const GRAPHICS_QUALITY_KEY = 'vod_graphics_quality_v1';
const caps = { low: 1, medium: 1.5, high: 2 };
const normalize = (value) => ['low', 'medium', 'high'].includes(value) ? value : 'medium';

// No DOM dependency: storage and the contour owner are injectable for policy tests.
export function createGraphicsQuality({
  storage = () => globalThis.localStorage,
  outline = setComicQuality,
} = {}) {
  let quality = 'medium';
  const shadows = new WeakMap();
  try { quality = normalize(storage()?.getItem(GRAPHICS_QUALITY_KEY)); } catch { /* Session default. */ }

  function getGraphicsQuality() { return quality; }

  function setGraphicsQuality(value) {
    quality = normalize(value);
    let saved = false;
    try {
      const target = storage();
      if (target) { target.setItem(GRAPHICS_QUALITY_KEY, quality); saved = true; }
    } catch { /* Keep the applied session choice. */ }
    return { quality, saved };
  }

  function applyGraphicsQuality(renderer, deviceRatio = globalThis.devicePixelRatio) {
    const ratio = Math.min(Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1, caps[quality]);
    if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
    if (!shadows.has(renderer)) shadows.set(renderer, renderer.shadowMap.enabled);
    const enabled = quality !== 'low' && shadows.get(renderer);
    if (renderer.shadowMap.enabled !== enabled) {
      renderer.shadowMap.enabled = enabled;
      renderer.shadowMap.needsUpdate = true;
    }
    outline(quality);
    return { quality, ratio, shadows: enabled };
  }

  return { getGraphicsQuality, setGraphicsQuality, applyGraphicsQuality };
}

export const { getGraphicsQuality, setGraphicsQuality, applyGraphicsQuality } = createGraphicsQuality();
