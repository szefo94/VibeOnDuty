import * as THREE from 'three';
import manifest from '../../tools/art/motion-manifest.json';

const V = (...xyz) => new THREE.Vector3(...xyz);
const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const M4 = Object.freeze({ grip: [0, -.06, .06], support: [0, -.032, -.15],
  magazine: [0, -.06, -.04], charging: [.024, .018, .1], travel: -.14 });
const definitions = {
  m4: M4,
  p90: { grip: [0, -.052, .06], support: [0, -.028, -.09], magazine: [0, .033, -.04],
    charging: [.03, .012, -.1], travel: .14 },
  awp: { grip: [0, -.07, .08], support: [0, -.03, -.13], magazine: [0, -.065, -.035],
    charging: [.032, .016, .09], travel: -.14 },
  pistol: { grip: [0, -.062, .05], support: [-.024, -.052, .048], magazine: [0, -.086, .05],
    charging: [0, .016, -.025], travel: -.1 },
};
const owners = new WeakMap();
export function getWeaponHandling(root) { return owners.get(root) ?? null; }

/** Weapon-local, read-only phase sample. It never advances a gameplay clock. */
export function sampleWeaponHandling(weapon, pose = {}) {
  const def = definitions[weapon];
  if (!def) return null;
  const reload = pose.alive !== false && pose.weapon === weapon && pose.upper === 'reload';
  const firing = pose.alive !== false && pose.weapon === weapon && pose.upper === 'fire'
    && pose.action?.kind === 'fire' && pose.action.total > 0;
  const phase = reload || firing ? clamp(pose.action?.phase) : 1;
  const action = manifest.actions.find(a => a.id === `${weapon}_reload`);
  const markers = action.markers;
  const removed = !reload ? 0 : phase < markers.remove ? smooth(phase / markers.remove)
    : phase < .4 ? 1 : 1 - smooth((phase - .4) / (markers.insert - .4));
  let charge = reload && phase >= markers.insert && phase < markers.recontact
    ? Math.sin(Math.PI * clamp((phase - markers.insert) / (markers.recontact - markers.insert))) : 0;
  if (firing && ['awp', 'pistol'].includes(weapon)) {
    const fireMarkers = manifest.actions.find(a => a.id === `${weapon}_fire`).markers;
    charge = phase <= fireMarkers.bolt ? smooth((phase - fireMarkers.shot) / (fireMarkers.bolt - fireMarkers.shot))
      : 1 - smooth((phase - fireMarkers.bolt) / (fireMarkers.return - fireMarkers.bolt));
  }
  const magazine = V(...def.magazine); magazine.y += def.travel * removed;
  const charging = V(...def.charging); charging.z += .045 * charge;
  const support = V(...def.support);
  if (reload) {
    if (phase < markers.insert) {
      const blend = smooth(phase / .12);
      support.lerp(magazine, blend);
    } else if (phase < markers.recontact) {
      support.copy(charging).lerp(V(...def.support), smooth((phase - markers.charge) / (markers.recontact - markers.charge)));
    }
  }
  const boltHand = weapon === 'awp' && charge > 0;
  return Object.freeze({ weapon, phase, reload, firing, boltHand, mechanism: action.mechanism,
    magazine: Object.freeze(magazine.toArray()), charging: Object.freeze(charging.toArray()),
    grip: boltHand ? Object.freeze(charging.toArray()) : def.grip,
    support: Object.freeze(support.toArray()), markers });
}

export function createWeaponHandling({ weapon, root, skeleton = null }) {
  const parts = Object.fromEntries(['receiver', 'grip', 'support', 'magazine', 'charging'].map(name =>
    [name, root.getObjectByName(`${weapon}_${name}`) ||
      (name === 'charging' ? root.getObjectByName(weapon === 'awp' ? 'awp_bolt' : 'pistol_slide') : null) ||
      root.getObjectByName(name)]));
  const owner = { weapon, root, skeleton, parts, props: [], disposed: false, sample: null,
    corrections: new Map(), updates: 0, contacts: null,
    rest: new Map(Object.values(parts).filter(Boolean).map(part =>
      [part, { position: part.position.clone(), quaternion: part.quaternion.clone() }])) };
  owners.set(root, owner);
  return owner;
}

export function restoreWeaponHandlingBones(owner) {
  if (!owner) return;
  for (const [bone, q] of owner.corrections) bone.quaternion.copy(q);
  if (owner.corrections.size && owner.mountRest) {
    owner.mountRest.root.position.copy(owner.mountRest.position);
    owner.mountRest.root.quaternion.copy(owner.mountRest.quaternion);
  }
  owner.corrections.clear();
}
function save(owner, bone) {
  if (!owner.corrections.has(bone)) owner.corrections.set(bone, bone.quaternion.clone());
}
function worldRotate(owner, bone, delta) {
  save(owner, bone);
  const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
  bone.updateWorldMatrix(false, true);
}
function align(owner, bone, from, to) {
  if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
  worldRotate(owner, bone, new THREE.Quaternion().setFromUnitVectors(from.normalize(), to.normalize()));
}

// Analytic two-segment solve; authored elbow plane is retained and reach clamps.
// Exactly two rotations, no iterative unbounded CCD, no bone translations/scales.
function solveArm(owner, side, target, orientation) {
  const root = owner.skeleton;
  const upper = root.getObjectByName(`upperarm_${side}`);
  const lower = root.getObjectByName(`lowerarm_${side}`);
  const hand = root.getObjectByName(`hand_${side}`);
  if (!upper || !lower || !hand) return null;
  const a = upper.getWorldPosition(V()), b = lower.getWorldPosition(V()), c = hand.getWorldPosition(V());
  const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
  const direction = target.clone().sub(a);
  const distance = Math.max(Math.abs(l1 - l2) + 1e-5, Math.min(direction.length(), l1 + l2 - 1e-5));
  direction.normalize();
  let pole = b.clone().sub(a).addScaledVector(direction, -b.clone().sub(a).dot(direction));
  if (pole.lengthSq() < 1e-8) pole = V(0, -1, 0).addScaledVector(direction, direction.y);
  if (pole.lengthSq() < 1e-8) pole = V(1, 0, 0);
  pole.normalize();
  const along = (l1 * l1 + distance * distance - l2 * l2) / (2 * distance);
  const elbow = a.clone().addScaledVector(direction, along)
    .addScaledVector(pole, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
  align(owner, upper, b.clone().sub(a), elbow.clone().sub(a));
  const nextB = lower.getWorldPosition(V()), nextC = hand.getWorldPosition(V());
  align(owner, lower, nextC.sub(nextB), target.clone().sub(nextB));
  save(owner, hand);
  hand.quaternion.copy(hand.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
  hand.updateWorldMatrix(false, true);
  return hand.getWorldPosition(V()).distanceTo(target);
}

function closeFingers(owner, side) {
  const hand = owner.skeleton.getObjectByName(`hand_${side}`);
  if (!hand) return;
  const axis = V(1, 0, 0).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()));
  for (const name of ['index', 'middle', 'ring', 'pinky', 'thumb']) {
    if (name === 'thumb') {
      // Thumb opposition follows its actual proximal segment, whose rest roll
      // differs from the four fingers. Aim across the palm, not along finger X.
      const center = hand.localToWorld(V(side === 'l' ? -.012 : .012, .095, .03));
      for (const segment of [1, 2, 3]) {
        const bone = owner.skeleton.getObjectByName(`thumb_0${segment}_${side}`);
        const next = owner.skeleton.getObjectByName(segment === 3 ? `thumb_04_leaf_${side}` : `thumb_0${segment + 1}_${side}`);
        if (!bone || !next) continue;
        const origin = bone.getWorldPosition(V());
        const from = next.getWorldPosition(V()).sub(origin).normalize();
        const to = center.clone().sub(origin).normalize();
        const delta = new THREE.Quaternion().setFromUnitVectors(from, to);
        const radians = 2 * Math.acos(Math.min(1, Math.abs(delta.w)));
        if (radians > .7) delta.slerp(new THREE.Quaternion(), 1 - .7 / radians);
        worldRotate(owner, bone, delta);
      }
      continue;
    }
    for (let segment = 1; segment <= 3; segment++) {
      const bone = owner.skeleton.getObjectByName(`${name}_0${segment}_${side}`);
      if (!bone) continue;
      const angle = name === 'index' && side === 'r' ? [.15, .35, .4][segment - 1] : [.45, .8, .65][segment - 1];
      worldRotate(owner, bone, new THREE.Quaternion().setFromAxisAngle(axis, angle));
    }
  }
}

export function updateWeaponHandling(owner, pose) {
  if (!owner || owner.disposed) return null;
  restoreWeaponHandlingBones(owner);
  // Capture after the asynchronous canonical hand attachment, never at module
  // construction while the weapon mount still has its procedural identity basis.
  if (!owner.fixedAnchor && !owner.mountRest && owner.skeleton && owner.root.parent) {
    const mount = owner.root.parent;
    owner.mountRest = { root: mount, position: mount.position.clone(), quaternion: mount.quaternion.clone() };
  }
  if (!owner.fixedAnchor && owner.mountRest && owner.skeleton && pose.weapon === owner.weapon) {
    owner.mountRest.root.position.copy(owner.mountRest.position);
    owner.mountRest.root.quaternion.copy(owner.mountRest.quaternion);
  }
  for (const [part, rest] of owner.rest) {
    part.position.copy(rest.position); part.quaternion.copy(rest.quaternion);
  }
  owner.updates++;
  const sample = sampleWeaponHandling(owner.weapon, pose);
  owner.sample = sample; owner.contacts = null;
  if (!sample) return null;
  for (const name of ['grip', 'support', 'magazine', 'charging']) {
    owner.root.getObjectByName(`${owner.weapon}_${name}Socket`)?.position.fromArray(sample[name]);
  }
  const def = definitions[owner.weapon];
  if (owner.parts.magazine) owner.parts.magazine.position.add(V(...sample.magazine).sub(V(...def.magazine)));
  if (owner.parts.charging) owner.parts.charging.position.add(V(...sample.charging).sub(V(...def.charging)));
  if (owner.skeleton && pose.alive !== false && pose.weapon === owner.weapon
    && !['throw', 'melee', 'dance', 'roll'].includes(pose.upper)) {
    owner.skeleton.updateMatrixWorld(true);
    const right = owner.skeleton.getObjectByName('hand_r');
    const shoulder = owner.skeleton.getObjectByName('upperarm_l');
    if (!owner.fixedAnchor && right && shoulder) {
      // Bounded carry fit moves the authored firing wrist towards the other
      // shoulder by at most 10cm. The mounted gun stays in that hand's grip.
      const wrist = right.getWorldPosition(V());
      const toward = shoulder.getWorldPosition(V()).sub(wrist).normalize();
      solveArm(owner, 'r', wrist.addScaledVector(toward, .1),
        right.getWorldQuaternion(new THREE.Quaternion()));
    }
    const orientation = owner.root.getWorldQuaternion(new THREE.Quaternion())
      .multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2));
    // Wrist-to-palm measured on the actual inherited rig (+Y finger chains).
    const palmOffset = V(0, .085, .012).applyQuaternion(orientation);
    const target = owner.root.localToWorld(V(...sample.support)).sub(palmOffset);
    let rightError = null;
    if (owner.fixedAnchor && right) {
      rightError = solveArm(owner, 'r', owner.root.localToWorld(V(...sample.grip)).sub(palmOffset), orientation);
    }
    if (sample.boltHand && owner.mountRest && right) {
      const mount = owner.mountRest.root;
      mount.updateWorldMatrix(true, true);
      const anchor = mount.matrixWorld.clone();
      const rightTarget = owner.root.localToWorld(V(...sample.grip)).sub(palmOffset);
      rightError = solveArm(owner, 'r', rightTarget, orientation);
      // The firing hand releases the bolt; keep the receiver anchored to its
      // sampled carry rather than dragging the gun after its manipulating hand.
      const local = mount.parent.matrixWorld.clone().invert().multiply(anchor);
      local.decompose(mount.position, mount.quaternion, mount.scale);
      mount.updateWorldMatrix(false, true);
    }
    const leftError = solveArm(owner, 'l', target, orientation);
    closeFingers(owner, 'l'); closeFingers(owner, 'r');
    owner.contacts = { leftError, rightError, solveRotations: sample.boltHand ? 6 : 4,
      carryFitMaxMeters: .1, fingerMaxRadians: .8,
      supportWorld: owner.root.localToWorld(V(...sample.support)).toArray() };
  }
  return sample;
}

export function disposeWeaponHandling(owner) {
  if (!owner || owner.disposed) return;
  restoreWeaponHandlingBones(owner);
  for (const [part, rest] of owner.rest) {
    part.position.copy(rest.position); part.quaternion.copy(rest.quaternion);
  }
  for (const prop of owner.props) prop.removeFromParent();
  owner.props.length = 0; owner.disposed = true;
  if (owners.get(owner.root) === owner) owners.delete(owner.root);
}
