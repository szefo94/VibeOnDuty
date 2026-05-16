// Pure-math helpers shared by map.js (groundElevation) and level.js (buildLevel).
// No imports — safe to import from either without circular deps.

// peak NE/NW/SE/SW — two adjacent full edges at loY, one corner at hiY
export function bilinearFrac(type, tx, tz) {
  return [tx*(1-tz), (1-tx)*(1-tz), tx*tz, (1-tx)*tz][type];
}

// 0-3: quarter-turn (90°) pivot NW/NE/SE/SW; 4-7: half-turn (180°) NS-CW/CCW EW-CW/CCW
export function revolvedFrac(type, tx, tz) {
  const h = Math.PI / 2;
  switch (type) {
    case 0: return Math.atan2(tz, tx)     / h;
    case 1: return Math.atan2(tz, 1-tx)   / h;
    case 2: return Math.atan2(1-tz, 1-tx) / h;
    case 3: return Math.atan2(1-tz, tx)   / h;
    case 4: return 0.5 - 0.5 * Math.cos(tz * Math.PI) * (1 - 2*tx);
    case 5: return 0.5 + 0.5 * Math.cos(tz * Math.PI) * (1 - 2*tx);
    case 6: return 0.5 - 0.5 * Math.cos(tx * Math.PI) * (1 - 2*tz);
    default:return 0.5 + 0.5 * Math.cos(tx * Math.PI) * (1 - 2*tz);
  }
}

// diagType 0-3 = Outer (valley), 4-7 = Peak (pyramid); dir index: 0=NW 1=NE 2=SE 3=SW
export function diagFrac(diagType, tx, tz) {
  switch (diagType) {
    case 0: return Math.max(1 - tz, 1 - tx); // Outer NW: valley at SE
    case 1: return Math.max(1 - tz, tx);     // Outer NE: valley at SW
    case 2: return Math.max(tz, tx);         // Outer SE: valley at NW
    case 3: return Math.max(tz, 1 - tx);     // Outer SW: valley at NE
    case 4: return Math.min(1 - tz, 1 - tx); // Peak NW
    case 5: return Math.min(1 - tz, tx);     // Peak NE
    case 6: return Math.min(tz, tx);         // Peak SE
    default: return Math.min(tz, 1 - tx);   // Peak SW
  }
}

// F½=1.5 m (FLOOR1/2), F1=3 m, F1½=4.5 m ((F1+F2)/2), F2=6 m
export const RAMP_PROFILE = [
  [0,   null], // 4-7:  0 → F1 (H2 from mapDef)
  [3.0, 6.0],  // 8-11: F1 → F2
  [0,   1.5],  // 12-15: 0 → F½
  [1.5, 3.0],  // 16-19: F½ → F1
  [3.0, 4.5],  // 20-23: F1 → F1½
  [4.5, 6.0],  // 24-27: F1½ → F2
];
