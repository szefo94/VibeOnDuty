import * as THREE from 'three';

/**
 * Placement of the third-person weapon group inside the hand_r bone.
 *
 * Current retargeted rifle pose: hand +Y is forward, +Z up, -X right.
 * Weapon models use -Z forward and +Y up. Rotating +90 degrees about X
 * maps these axes without rolling the scope/magazine sideways. Browser regression
 * tests measure the posed GLB hand, not just this documented basis.
 */
export const WEAPON3P_ROT = new THREE.Euler(Math.PI / 2, 0, 0);

/**
 * Lift the receiver above the palm; move slightly forward and outboard. The old
 * -Z offset moved the weapon below the fingers after the rig was retargeted.
 */
export const WEAPON3P_GRIP = new THREE.Vector3(-0.015, 0.015, 0.025);

/**
 * Per-weapon shift along the model's own barrel axis (-Z), aligning the grip rather
 * than the centre of the body box with the hand. The models are centred on their
 * receiver, so without this roughly half of each weapon sits behind the hands — which
 * is why the short P90 and M9 read as missing entirely while the longer M4 and AWP
 * still poked far enough out to be seen.
 */
export const WEAPON3P_BARREL_SHIFT = { m4: -0.10, p90: -0.06, awp: -0.14, pistol: -0.03 };
