import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WEAPON3P_ROT, WEAPON3P_GRIP, WEAPON3P_BARREL_SHIFT } from './weapon3pTransform.js';

// Character axes as measured on the live rig, expressed in hand_r local space.
const FORWARD = new THREE.Vector3(0, 1, 0);
const UP      = new THREE.Vector3(1, 0, 0);
const RIGHT   = new THREE.Vector3(0, 0, -1);
// Weapon model axes: built barrel along -Z, up +Y.
const BARREL    = new THREE.Vector3(0, 0, -1);
const MODEL_UP  = new THREE.Vector3(0, 1, 0);

const applied = (v) => v.clone().applyQuaternion(new THREE.Quaternion().setFromEuler(WEAPON3P_ROT));

describe('third-person weapon transform', () => {
  it('points the barrel along the character forward axis', () => {
    expect(applied(BARREL).dot(FORWARD)).toBeCloseTo(1, 6);
  });

  it('keeps the weapon upright rather than rolled', () => {
    // The bug this guards: (PI/2, 0, +PI/2) also aims the barrel forward, so a barrel
    // check alone passes while every weapon hangs upside down. Only the roll differs.
    expect(applied(MODEL_UP).dot(UP)).toBeCloseTo(1, 6);

    const rolled = MODEL_UP.clone().applyQuaternion(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, Math.PI / 2)));
    expect(rolled.dot(UP)).toBeCloseTo(-1, 6);   // the old value, inverted
  });

  it('is a proper rotation, not a reflection', () => {
    const m = new THREE.Matrix4().makeRotationFromEuler(WEAPON3P_ROT);
    expect(m.determinant()).toBeCloseTo(1, 6);
  });

  it('sits the weapon forward of and outboard from the fist', () => {
    expect(WEAPON3P_GRIP.dot(FORWARD)).toBeGreaterThan(0);   // clear of the chest
    expect(WEAPON3P_GRIP.dot(RIGHT)).toBeGreaterThan(0);     // clear of the forearms
  });

  it('shifts every weapon back along its own barrel so the grip meets the hand', () => {
    for (const key of ['m4', 'p90', 'awp', 'pistol']) {
      expect(WEAPON3P_BARREL_SHIFT[key], key).toBeLessThan(0);
      expect(WEAPON3P_BARREL_SHIFT[key], key).toBeGreaterThan(-0.5);
    }
    // Longer weapons need a bigger shift; this ordering is the whole point of the table.
    expect(WEAPON3P_BARREL_SHIFT.awp).toBeLessThan(WEAPON3P_BARREL_SHIFT.m4);
    expect(WEAPON3P_BARREL_SHIFT.m4).toBeLessThan(WEAPON3P_BARREL_SHIFT.pistol);
  });
});
