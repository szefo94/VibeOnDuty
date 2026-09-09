export function dist2(dx, dz) { return dx * dx + dz * dz; }
export function applyDrag(v, drag, dt) { return v * (1 - drag * dt); }
export function normA(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
export function slerp(cur, tgt, spd, dt) {
  const d = normA(tgt - cur),
    st = spd * dt;
  if (Math.abs(d) < st) return tgt;
  return cur + Math.sign(d) * st;
}

// Squared distance from point p to the segment a->b.
// Used for swept hit tests: a fast projectile advances metres per frame, so testing
// only its end position against a hit sphere lets it tunnel straight through targets.
// All three args are anything with numeric x/y/z (THREE.Vector3 included).
export function segPointDist2(a, b, p) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const len2 = abx * abx + aby * aby + abz * abz;
  const apx = p.x - a.x, apy = p.y - a.y, apz = p.z - a.z;
  let t = len2 > 1e-9 ? (apx * abx + apy * aby + apz * abz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return dx * dx + dy * dy + dz * dz;
}
