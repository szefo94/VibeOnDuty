import * as THREE from 'three';
import { CELL, PLAYER_H } from './config.js';
import { mm } from './materials.js';
import { renderer, scene } from './scene.js';
import { torchLights, ambientLight, sunLight } from './lighting.js';

export const wallMeshes = [];
export let debugLines = null;

let _levelGroup = null;

// Remove and dispose all geometry added by the last buildLevel call.
export function clearLevel() {
  if (!_levelGroup) return;
  _levelGroup.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
  });
  scene.remove(_levelGroup);
  _levelGroup = null;
  wallMeshes.length = 0;
  torchLights.length = 0;
}

const _isRamp     = (c) => (c >= 4 && c <= 27) || (c >= 33 && c <= 128);
const _isDiagRamp = (c) => c >= 33 && c <= 80;
const _isRevRamp  = (c) => c >= 81 && c <= 128;
const _isCrack    = (c) => c === 2 || c === 3;

// 0-3: quarter-turn (90°) pivot NW/NE/SE/SW; 4-7: half-turn (180°) NS-CW/CCW EW-CW/CCW
function _revolvedFrac(type, tx, tz) {
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

function _diagFrac(diagType, tx, tz) {
  switch (diagType) {
    case 0: return Math.max(1 - tz, 1 - tx);
    case 1: return Math.max(1 - tz, tx);
    case 2: return Math.max(tz, tx);
    case 3: return Math.max(tz, 1 - tx);
    case 4: return Math.min(1 - tz, 1 - tx);
    case 5: return Math.min(1 - tz, tx);
    case 6: return Math.min(tz, tx);
    default: return Math.min(tz, 1 - tx);
  }
}

// [loY, hiY] per ramp group; null hiY = use mapDef.H2 (backward compat for tiles 4-7)
// F½=1.5 m (FLOOR1/2), F1=3 m, F1½=4.5 m ((F1+F2)/2), F2=6 m
const _RAMP_PROFILE = [
  [0,   null], // 4-7:  0 → F1 (H2 from mapDef)
  [3.0, 6.0],  // 8-11: F1 → F2
  [0,   1.5],  // 12-15: 0 → F½
  [1.5, 3.0],  // 16-19: F½ → F1
  [3.0, 4.5],  // 20-23: F1 → F1½
  [4.5, 6.0],  // 24-27: F1½ → F2
];

export function buildLevel(mapDef) {
  clearLevel();
  _levelGroup = new THREE.Group();

  const {
    width, height,
    wallHeight: WH_DEF, materials: mats,
    fog, skyColor, showRubble,
  } = mapDef;

  const debugLineData = [];

  // Apply scene theme
  scene.fog = new THREE.FogExp2(fog.color, fog.density);
  scene.background = new THREE.Color(skyColor);
  renderer.setClearColor(skyColor);

  const H2 = mapDef.H2 ?? 0;

  // ── Ground plane ─────────────────────────────────────────────────────
  const fl = new THREE.Mesh(
    new THREE.PlaneGeometry((width + 4) * CELL, (height + 4) * CELL),
    mats.floor
  );
  fl.rotation.x = -Math.PI / 2;
  fl.position.set((width * CELL) / 2, 0, (height * CELL) / 2);
  fl.receiveShadow = true;
  _levelGroup.add(fl);

  // Normalise to floors array — built-in maps pass a flat tiles/heightmap,
  // custom editor maps pass a floors array with separate grids per storey.
  const floors = mapDef.floors
    ? mapDef.floors
    : [{ base: 0, tiles: mapDef.tiles, heightmap: mapDef.heightmap, wallHeight: WH_DEF }];

  // Sink every wall box this far below its floor so the bottom face is underground
  // and can never be coplanar with a floor/slab surface at the same Y.
  // Safe now that stacked walls are merged into one box (no wall-wall overlap).
  const WALL_SINK = 0.01;

  // Wall materials with negative polygonOffset so wall faces always win the depth
  // test against any coplanar surface (slab side faces, trim, other walls).
  const _wo = (m) => { const c = m.clone(); c.polygonOffset = true; c.polygonOffsetFactor = -1; c.polygonOffsetUnits = -2; return c; };
  const _wDark = _wo(mats.wallDark), _wTop = _wo(mats.wallTop);
  const _wFlr  = _wo(mats.floor),   _wWall = _wo(mats.wall);
  const _wallMatsArr = [_wDark, _wDark, _wTop, _wFlr, _wWall, _wWall];

  // ── Pre-compute merged wall columns ──────────────────────────────────────────
  // When multiple floors share a wall at the same (col,row), merge them into one
  // tall box so the coplanar top/bottom faces at the floor boundary don't exist.
  const _mergedWallSpans = new Map(); // "col,row" → [{base, top}]
  const _mergedWallCells = new Set(); // "fi,col,row" consumed by a merge
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const segs = [];
      for (let fi = 0; fi < floors.length; fi++) {
        const fd = floors[fi];
        if (fd.tiles[row]?.[col] !== 1) continue;
        const fdWH = fd.wallHeight ?? WH_DEF ?? 3.0;
        const gN = (r2, c2) => (r2 < 0 || r2 >= height || c2 < 0 || c2 >= width) ? 1 : fd.tiles[r2][c2];
        const isPillar = mapDef.style !== 'rooftop' &&
          gN(row-1,col)===0 && gN(row+1,col)===0 &&
          gN(row,col+1)===0 && gN(row,col-1)===0;
        if (isPillar) continue;
        segs.push({ fi, base: fd.base, top: fd.base + fdWH });
      }
      if (segs.length <= 1) continue;
      segs.sort((a, b) => a.base - b.base);
      const merged = [{ base: segs[0].base, top: segs[0].top }];
      for (let i = 1; i < segs.length; i++) {
        const last = merged[merged.length - 1];
        if (segs[i].base <= last.top + 0.001) last.top = Math.max(last.top, segs[i].top);
        else merged.push({ base: segs[i].base, top: segs[i].top });
      }
      _mergedWallSpans.set(`${col},${row}`, merged);
      for (const seg of segs) _mergedWallCells.add(`${seg.fi},${col},${row}`);
    }
  }

  // ── Per-floor tile geometry ───────────────────────────────────────────
  for (let fi = 0; fi < floors.length; fi++) {
    const flDef = floors[fi];
    const { tiles, heightmap, base: BASE } = flDef;
    const WH = flDef.wallHeight ?? WH_DEF ?? 3.0;

    const getCell = (col, row) => {
      if (col < 0 || row < 0 || col >= width || row >= height) return 1;
      return tiles[row][col];
    };

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const cell = tiles[row][col];
        if (cell === 0) continue;
        const wx = col * CELL + CELL / 2, wz = row * CELL + CELL / 2;

        if (cell === 1 || cell === 28) {
          const n = getCell(col, row - 1), s = getCell(col, row + 1);
          const e = getCell(col + 1, row), w = getCell(col - 1, row);
          const isPillar = cell === 28 ||
            (n === 0 && s === 0 && e === 0 && w === 0 && mapDef.style !== 'rooftop');
          // Skip non-pillar walls that are merged across floors — rendered below.
          if (!isPillar && _mergedWallCells.has(`${fi},${col},${row}`)) continue;
          if (isPillar) {
            const shaft = new THREE.Mesh(
              new THREE.CylinderGeometry(0.55, 0.62, WH + 0.8 + WALL_SINK, 12),
              mats.wall
            );
            shaft.position.set(wx, BASE + (WH + 0.8 - WALL_SINK) / 2, wz);
            shaft.castShadow = shaft.receiveShadow = true;
            _levelGroup.add(shaft);
            wallMeshes.push(shaft);
            const cap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 1.4), _wTop);
            cap.position.set(wx, BASE + WH + 0.8, wz);
            _levelGroup.add(cap);
            const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22 + WALL_SINK, 1.5), _wTop);
            base.position.set(wx, BASE + (0.22 - WALL_SINK) / 2, wz);
            _levelGroup.add(base);
            debugLineData.push({ x: wx - 0.7, y: BASE, z: wz - 0.7, w: 1.4, h: WH + 0.8, d: 1.4, col: 0xff8800 });
          } else {
            const wm = new THREE.Mesh(new THREE.BoxGeometry(CELL, WH + WALL_SINK, CELL), _wallMatsArr);
            wm.position.set(wx, BASE + (WH - WALL_SINK) / 2, wz);
            wm.castShadow = wm.receiveShadow = true;
            _levelGroup.add(wm);
            wallMeshes.push(wm);
            const t = new THREE.Mesh(new THREE.BoxGeometry(CELL + 0.004, 0.18 + WALL_SINK, CELL + 0.004), mats.trim);
            t.position.set(wx, BASE + (0.18 - WALL_SINK) / 2, wz);
            _levelGroup.add(t);
            debugLineData.push({ x: wx - CELL / 2, y: BASE, z: wz - CELL / 2, w: CELL, h: WH, d: CELL, col: 0xff3300 });
          }
        } else if (_isCrack(cell)) {
          const loH = PLAYER_H - 0.28, upH = 0.55;
          const gw = cell === 2 ? CELL : 0.35, gd = cell === 2 ? 0.35 : CELL;
          const lo = new THREE.Mesh(new THREE.BoxGeometry(gw, loH + WALL_SINK, gd), mats.crack);
          lo.position.set(wx, BASE + (loH - WALL_SINK) / 2, wz);
          lo.castShadow = lo.receiveShadow = true;
          _levelGroup.add(lo);
          wallMeshes.push(lo);
          const up = new THREE.Mesh(new THREE.BoxGeometry(gw, upH, gd), mats.crack);
          up.position.set(wx, BASE + PLAYER_H + 0.28 + upH / 2, wz);
          up.castShadow = true;
          _levelGroup.add(up);
          wallMeshes.push(up);
          debugLineData.push({ x: wx - gw / 2, y: BASE, z: wz - gd / 2, w: gw, h: loH, d: gd, col: 0x0088ff });
          debugLineData.push({ x: wx - gw / 2, y: BASE + PLAYER_H + 0.28, z: wz - gd / 2, w: gw, h: upH, d: gd, col: 0x0088ff });
        } else if (_isDiagRamp(cell)) {
          const diagType = Math.floor((cell - 33) / 6);
          const grp      = (cell - 33) % 6;
          const [loYr, hiYRaw] = _RAMP_PROFILE[grp];
          const hiYr = hiYRaw ?? H2;
          const RAMP_T = 0.10;
          const x0 = col * CELL, x1 = (col + 1) * CELL;
          const z0 = row * CELL, z1 = (row + 1) * CELL;
          const hNW = loYr + (hiYr - loYr) * _diagFrac(diagType, 0, 0);
          const hNE = loYr + (hiYr - loYr) * _diagFrac(diagType, 1, 0);
          const hSW = loYr + (hiYr - loYr) * _diagFrac(diagType, 0, 1);
          const hSE = loYr + (hiYr - loYr) * _diagFrac(diagType, 1, 1);
          // Top face + bottom face (shifted by RAMP_T)
          const pos = new Float32Array([
            x0, hNW,        z0,  x0, hSW,        z1,  x1, hNE,        z0,
            x1, hNE,        z0,  x0, hSW,        z1,  x1, hSE,        z1,
            x0, hNW-RAMP_T, z0,  x1, hNE-RAMP_T, z0,  x0, hSW-RAMP_T, z1,
            x1, hNE-RAMP_T, z0,  x1, hSE-RAMP_T, z1,  x0, hSW-RAMP_T, z1,
          ]);
          const dgeo = new THREE.BufferGeometry();
          dgeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
          dgeo.computeVertexNormals();
          const dmat = new THREE.MeshStandardMaterial({
            color: mats.ramp.color, roughness: mats.ramp.roughness,
            metalness: mats.ramp.metalness, side: THREE.DoubleSide,
          });
          const dm = new THREE.Mesh(dgeo, dmat);
          dm.castShadow = dm.receiveShadow = true;
          _levelGroup.add(dm);
          debugLineData.push({ x: x0, y: loYr, z: z0, w: CELL, h: hiYr - loYr, d: CELL, col: 0xffcc00 });
        } else if (_isRevRamp(cell)) {
          const type = Math.floor((cell - 81) / 6);
          const grp  = (cell - 81) % 6;
          const [loYr, hiYRaw] = _RAMP_PROFILE[grp];
          const hiYr = hiYRaw ?? H2;
          const RAMP_T = 0.10;
          const N = 8, M = N + 1;
          const x0 = col * CELL, z0 = row * CELL;
          const topVerts = [], botVerts = [];
          for (let zi = 0; zi <= N; zi++) {
            for (let xi = 0; xi <= N; xi++) {
              const tx = xi / N, tz = zi / N;
              const y = loYr + (hiYr - loYr) * _revolvedFrac(type, tx, tz);
              topVerts.push(x0 + tx * CELL, y, z0 + tz * CELL);
              botVerts.push(x0 + tx * CELL, y - RAMP_T, z0 + tz * CELL);
            }
          }
          const verts = [...topVerts, ...botVerts];
          const inds = [];
          const off = M * M;
          for (let zi = 0; zi < N; zi++) {
            for (let xi = 0; xi < N; xi++) {
              const a = zi*M+xi, b = a+1, c2 = a+M, d = c2+1;
              inds.push(a, c2, b, b, c2, d);
              inds.push(a+off, b+off, c2+off, b+off, d+off, c2+off);
            }
          }
          const rgeo = new THREE.BufferGeometry();
          rgeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
          rgeo.setIndex(inds);
          rgeo.computeVertexNormals();
          const rmat = new THREE.MeshStandardMaterial({
            color: mats.ramp.color, roughness: mats.ramp.roughness,
            metalness: mats.ramp.metalness, side: THREE.DoubleSide,
          });
          const rm = new THREE.Mesh(rgeo, rmat);
          rm.castShadow = rm.receiveShadow = true;
          _levelGroup.add(rm);
          debugLineData.push({ x: x0, y: loYr, z: z0, w: CELL, h: hiYr - loYr, d: CELL, col: 0xff88ff });
        } else if (cell >= 4 && cell <= 27) {
          const dir = (cell - 4) % 4;
          const grp = Math.floor((cell - 4) / 4);
          const [loY, hiYRaw] = _RAMP_PROFILE[grp];
          const hiY = hiYRaw ?? H2;
          const RAMP_T   = 0.10;
          const slopeLen = Math.sqrt(CELL * CELL + (hiY - loY) * (hiY - loY));
          const angle    = Math.atan2(hiY - loY, CELL);
          const centerY  = (loY + hiY) / 2;
          const rampGeo  = (dir === 0 || dir === 1)
            ? new THREE.BoxGeometry(CELL, RAMP_T, slopeLen)
            : new THREE.BoxGeometry(slopeLen, RAMP_T, CELL);
          const rampMat = new THREE.MeshStandardMaterial({
            color: mats.ramp.color, roughness: mats.ramp.roughness,
            metalness: mats.ramp.metalness,
          });
          const rm = new THREE.Mesh(rampGeo, rampMat);
          rm.position.set(wx, centerY, wz);
          if      (dir === 0) rm.rotation.x = -angle;
          else if (dir === 1) rm.rotation.x =  angle;
          else if (dir === 2) rm.rotation.z =  angle;
          else                rm.rotation.z = -angle;
          rm.castShadow = rm.receiveShadow = true;
          _levelGroup.add(rm);
          debugLineData.push({ x: wx - CELL / 2, y: loY, z: wz - CELL / 2, w: CELL, h: hiY - loY, d: CELL, col: 0xffee00 });
        } else if (cell >= 29 && cell <= 32) {
          // Legacy swall tile (pre-swallBits maps) — still rendered for compat.
          const WALL_T = 0.18;
          let mx, mz, pw, pd;
          if (cell === 29) {        mx = wx; mz = row * CELL + WALL_T / 2;        pw = CELL; pd = WALL_T; }
          else if (cell === 30) {   mx = wx; mz = (row + 1) * CELL - WALL_T / 2; pw = CELL; pd = WALL_T; }
          else if (cell === 31) {   mx = col * CELL + WALL_T / 2; mz = wz;        pw = WALL_T; pd = CELL; }
          else {                    mx = (col + 1) * CELL - WALL_T / 2; mz = wz;  pw = WALL_T; pd = CELL; }
          const sw = new THREE.Mesh(new THREE.BoxGeometry(pw, WH + WALL_SINK, pd), _wallMatsArr);
          sw.position.set(mx, BASE + (WH - WALL_SINK) / 2, mz);
          sw.castShadow = sw.receiveShadow = true;
          _levelGroup.add(sw);
          wallMeshes.push(sw);
          debugLineData.push({ x: mx - pw / 2, y: BASE, z: mz - pd / 2, w: pw, h: WH, d: pd, col: 0x6090ff });
        }
      }
    }

    // ── Side walls from swallBits (bitmask: bit0=N, bit1=S, bit2=W, bit3=E) ─
    if (flDef.swallBits) {
      const WALL_T = 0.18;
      const swMat = _wallMatsArr;
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          const bits = flDef.swallBits[r][c];
          if (!bits) continue;
          const wx2 = c * CELL + CELL / 2, wz2 = r * CELL + CELL / 2;
          const edgeDefs = [
            [1, wx2,                      r * CELL + WALL_T / 2,        CELL,   WALL_T], // N
            [2, wx2,                      (r + 1) * CELL - WALL_T / 2,  CELL,   WALL_T], // S
            [4, c * CELL + WALL_T / 2,    wz2,                          WALL_T, CELL  ], // W
            [8, (c + 1) * CELL - WALL_T / 2, wz2,                       WALL_T, CELL  ], // E
          ];
          for (const [bit, mx, mz, pw, pd] of edgeDefs) {
            if (!(bits & bit)) continue;
            const sw = new THREE.Mesh(new THREE.BoxGeometry(pw, WH + WALL_SINK, pd), swMat);
            sw.position.set(mx, BASE + (WH - WALL_SINK) / 2, mz);
            sw.castShadow = sw.receiveShadow = true;
            _levelGroup.add(sw);
            wallMeshes.push(sw);
            debugLineData.push({ x: mx - pw / 2, y: BASE, z: mz - pd / 2, w: pw, h: WH, d: pd, col: 0x6090ff });
          }
        }
      }
    }

    // ── Elevated floor slabs for this floor layer ─────────────────────────
    // Thickness: 0.3 m so the slab top is at exactly y=h (absolute) and
    // players can walk freely below (under Floor 1 at 3 m, Floor 2 at 6 m…).
    const SLAB_T   = 0.3;
    const elevMat  = mm(0xb8a070, 0.94, 0.01);
    const elevSide = mm(0x8a7050, 0.96, 0.01);
    const built = new Set();
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const h = heightmap[r][c];
        if (!h || tiles[r][c] !== 0) continue;
        const key = `${c},${r}`;
        if (built.has(key)) continue;
        let ww = 1;
        while (c + ww < width && heightmap[r][c + ww] === h && tiles[r][c + ww] === 0 && !built.has(`${c + ww},${r}`)) ww++;
        let d = 1;
        outer: while (r + d < height) {
          for (let cc = c; cc < c + ww; cc++) {
            if (heightmap[r + d][cc] !== h || tiles[r + d][cc] !== 0 || built.has(`${cc},${r + d}`)) break outer;
          }
          d++;
        }
        for (let dr = 0; dr < d; dr++) for (let dc = 0; dc < ww; dc++) built.add(`${c + dc},${r + dr}`);
        const pw = ww * CELL, pd = d * CELL, cx2 = (c + ww / 2) * CELL, cz2 = (r + d / 2) * CELL;
        // Thin slab: top surface at y=h (absolute), underside at y=h-SLAB_T
        const slab = new THREE.Mesh(
          new THREE.BoxGeometry(pw, SLAB_T, pd),
          [elevSide, elevSide, elevMat, elevMat, elevSide, elevSide]
        );
        slab.position.set(cx2, h - SLAB_T / 2, cz2);
        slab.receiveShadow = slab.castShadow = true;
        _levelGroup.add(slab);
        debugLineData.push({ x: cx2 - pw / 2, y: h - SLAB_T, z: cz2 - pd / 2, w: pw, h: SLAB_T, d: pd, col: 0x00ff88 });
      }
    }
  }

  // ── Merged wall columns (spans that cross multiple floors) ───────────────────
  for (const [key, spans] of _mergedWallSpans) {
    const [mcol, mrow] = key.split(',').map(Number);
    const wx = mcol * CELL + CELL / 2, wz = mrow * CELL + CELL / 2;
    for (const span of spans) {
      const spanH = span.top - span.base;
      const wm = new THREE.Mesh(new THREE.BoxGeometry(CELL, spanH + WALL_SINK, CELL), _wallMatsArr);
      wm.position.set(wx, span.base + (spanH - WALL_SINK) / 2, wz);
      wm.castShadow = wm.receiveShadow = true;
      _levelGroup.add(wm);
      wallMeshes.push(wm);
      const t = new THREE.Mesh(new THREE.BoxGeometry(CELL + 0.004, 0.18 + WALL_SINK, CELL + 0.004), mats.trim);
      t.position.set(wx, span.base + (0.18 - WALL_SINK) / 2, wz);
      _levelGroup.add(t);
      debugLineData.push({ x: wx - CELL/2, y: span.base, z: wz - CELL/2, w: CELL, h: spanH, d: CELL, col: 0xff3300 });
    }
  }

  // ── Rubble (bunker style — skipped for rooftop) ───────────────────────
  if (showRubble) {
    const tiles0 = floors[0].tiles;
    const rubbleMat = mm(0x8a7a60, 0.97, 0.0);
    for (let i = 0; i < 80; i++) {
      const rc = 1 + Math.floor(Math.random() * (width - 2));
      const rr = 1 + Math.floor(Math.random() * (height - 2));
      if (tiles0[rr][rc] !== 0) continue;
      const sz = 0.15 + Math.random() * 0.35;
      const rb = new THREE.Mesh(new THREE.BoxGeometry(sz, sz * 0.5, sz * 0.85), rubbleMat);
      rb.position.set(rc * CELL + Math.random() * CELL * 0.8, sz * 0.25, rr * CELL + Math.random() * CELL * 0.8);
      rb.rotation.y = Math.random() * Math.PI;
      rb.rotation.z = (Math.random() - 0.5) * 0.3;
      rb.receiveShadow = rb.castShadow = true;
      _levelGroup.add(rb);
    }
  }

  // ── Map-specific extras (lights, props, decor) ────────────────────────
  mapDef.buildExtras(scene, torchLights, ambientLight, sunLight);

  // ── Debug lines ───────────────────────────────────────────────────────
  const groups = {};
  for (const dd of debugLineData) {
    const k = dd.col.toString(16);
    if (!groups[k]) groups[k] = { pts: [], col: dd.col };
    const { x, y, z, w, h, d: depth } = dd;
    const corners = [[x,y,z],[x+w,y,z],[x+w,y,z+depth],[x,y,z+depth],[x,y+h,z],[x+w,y+h,z],[x+w,y+h,z+depth],[x,y+h,z+depth]];
    [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].forEach(
      ([a, b]) => groups[k].pts.push(...corners[a], ...corners[b])
    );
  }
  const grp = new THREE.Group();
  for (const { pts, col } of Object.values(groups)) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    grp.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.8 })));
  }
  debugLines = grp;
  debugLines.visible = false;
  _levelGroup.add(debugLines);

  scene.add(_levelGroup);
}
