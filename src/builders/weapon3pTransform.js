import * as THREE from 'three';

/**
 * Placement of the third-person weapon group inside the hand_r bone.
 *
 * Measured off the live rig rather than guessed. Expressed in hand_r local space the
 * character's axes are:
 *     forward = +Y      up = +X      right = -Z
 * and the 3p weapon models are built barrel along -Z with up +Y. The basis that maps
 * model space onto character space is therefore
 *     model +X -> (0, 0,-1)      model +Y -> (1, 0, 0)      model +Z -> (0,-1, 0)
 * which is Euler XYZ (PI/2, 0, -PI/2).
 *
 * The previous value was (PI/2, 0, +PI/2). It aims the barrel forward too — the two
 * differ only by a 180 deg roll about the barrel — so every third-person weapon was
 * mounted upside down.
 */
export const WEAPON3P_ROT = new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2);

/**
 * Grip offset in hand_r local space (+Y forward, +X up, -Z right). Sits the weapon
 * slightly forward of and outboard from the fist so it clears the forearms: the aim
 * pose holds both hands together at chest centre, and a weapon centred exactly on the
 * hand is swallowed by the character's own silhouette from the chase camera.
 */
export const WEAPON3P_GRIP = new THREE.Vector3(-0.03, 0.15, -0.10);

/**
 * Per-weapon shift along the model's own barrel axis (-Z), aligning the grip rather
 * than the centre of the body box with the hand. The models are centred on their
 * receiver, so without this roughly half of each weapon sits behind the hands — which
 * is why the short P90 and M9 read as missing entirely while the longer M4 and AWP
 * still poked far enough out to be seen.
 */
export const WEAPON3P_BARREL_SHIFT = { m4: -0.10, p90: -0.06, awp: -0.14, pistol: -0.03 };
