import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseGLB } from '../../tools/art/inspect-character.mjs';
import { validateListedMotion } from '../../tools/art/motion-pipeline.mjs';
import manifest from '../../tools/art/motion-manifest.json';

describe('retained original motion repertoire', () => {
  it('exports complete exact authored action names and weapon phase markers', () => {
    const asset = parseGLB(readFileSync('public/models/enemy.glb'));
    for (const weapon of ['m4', 'p90', 'awp', 'pistol']) {
      for (const kind of ['ready', 'ads', 'fire', 'reload']) {
        const spec = manifest.actions.find((a) => a.id === `${weapon}_${kind}`);
        expect(spec, `${weapon} ${kind} must be retained original motion`).toBeDefined();
        expect(spec.clip).toBe(`vod7_${weapon}_${kind}`);
        expect(asset.json.animations.filter((c) => c.name === spec.clip)).toHaveLength(1);
        if (kind === 'reload') {
          expect(spec.markers.remove).toBeLessThan(spec.markers.insert);
          expect(spec.markers.insert).toBeLessThan(spec.markers.charge);
          expect(spec.markers.charge).toBeLessThan(spec.markers.ready);
          expect(spec.contactTargets.support).toHaveLength(3);
        }
      }
    }
    expect(validateListedMotion(asset, manifest, 48)).toBe(manifest.actions.length);
  });
});
