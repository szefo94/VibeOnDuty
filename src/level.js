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

const _isRamp  = (c) => c >= 4 && c <= 27;
const _isCrack = (c) => c === 2 || c === 3;

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

  // ── Per-floor tile geometry ───────────────────────────────────────────
  for (const flDef of floors) {
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
          if (isPillar) {
            const shaft = new THREE.Mesh(
              new THREE.CylinderGeometry(0.55, 0.62, WH + 0.8, 12),
              mats.wall
            );
            shaft.position.set(wx, BASE + (WH + 0.8) / 2, wz);
            shaft.castShadow = shaft.receiveShadow = true;
            _levelGroup.add(shaft);
            wallMeshes.push(shaft);
            const cap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 1.4), mats.wallTop);
            cap.position.set(wx, BASE + WH + 0.8, wz);
            _levelGroup.add(cap);
            const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 1.5), mats.wallTop);
            base.position.set(wx, BASE + 0.11, wz);
            _levelGroup.add(base);
            debugLineData.push({ x: wx - 0.7, y: BASE, z: wz - 0.7, w: 1.4, h: WH + 0.8, d: 1.4, col: 0xff8800 });
          } else {
            const wm = new THREE.Mesh(new THREE.BoxGeometry(CELL, WH, CELL), [
              mats.wallDark, mats.wallDark, mats.wallTop, mats.floor, mats.wall, mats.wall,
            ]);
            wm.position.set(wx, BASE + WH / 2, wz);
            wm.castShadow = wm.receiveShadow = true;
            _levelGroup.add(wm);
            wallMeshes.push(wm);
            const t = new THREE.Mesh(new THREE.BoxGeometry(CELL, 0.18, CELL), mats.trim);
            t.position.set(wx, BASE + 0.09, wz);
            _levelGroup.add(t);
            debugLineData.push({ x: wx - CELL / 2, y: BASE, z: wz - CELL / 2, w: CELL, h: WH, d: CELL, col: 0xff3300 });
          }
        } else if (_isCrack(cell)) {
          const loH = PLAYER_H - 0.28, upH = 0.55;
          const gw = cell === 2 ? CELL : 0.35, gd = cell === 2 ? 0.35 : CELL;
          const lo = new THREE.Mesh(new THREE.BoxGeometry(gw, loH, gd), mats.crack);
          lo.position.set(wx, BASE + loH / 2, wz);
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
        } else if (_isRamp(cell)) {
          const H = CELL / 2;
          const dir = (cell - 4) % 4;
          const grp = Math.floor((cell - 4) / 4);
          const [loY, hiYRaw] = _RAMP_PROFILE[grp];
          const hiY = hiYRaw ?? H2;
          let A, B, C, D, E, F;
          if (dir === 0)      { A=[-H,loY,-H]; B=[H,loY,-H]; C=[H,hiY,H];  D=[-H,hiY,H];  E=[-H,loY,H];  F=[H,loY,H];  }
          else if (dir === 1) { A=[-H,loY,H];  B=[H,loY,H];  C=[H,hiY,-H]; D=[-H,hiY,-H]; E=[-H,loY,-H]; F=[H,loY,-H]; }
          else if (dir === 2) { A=[-H,loY,-H]; B=[-H,loY,H]; C=[H,hiY,H];  D=[H,hiY,-H];  E=[H,loY,-H];  F=[H,loY,H];  }
          else                { A=[H,loY,H];   B=[H,loY,-H]; C=[-H,hiY,-H]; D=[-H,hiY,H]; E=[-H,loY,H];  F=[-H,loY,-H]; }
          const verts = [...D,...C,...B,...D,...B,...A,...A,...B,...F,...A,...F,...E,...A,...E,...D,...B,...C,...F,...D,...E,...F,...D,...F,...C];
          const rampGeo = new THREE.BufferGeometry();
          rampGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
          rampGeo.computeVertexNormals();
          const rampMat = new THREE.MeshStandardMaterial({
            color: mats.ramp.color, roughness: mats.ramp.roughness,
            metalness: mats.ramp.metalness, side: THREE.DoubleSide,
          });
          const rm = new THREE.Mesh(rampGeo, rampMat);
          rm.position.set(wx, 0, wz);  // ramp Y already absolute in profile
          rm.castShadow = rm.receiveShadow = true;
          _levelGroup.add(rm);
          debugLineData.push({ x: wx - CELL / 2, y: loY, z: wz - CELL / 2, w: CELL, h: hiY - loY, d: CELL, col: 0xffee00 });
        } else if (cell >= 29 && cell <= 32) {
          // Side wall: 18 cm thick panel on one edge of the cell, full wall height
          const WALL_T = 0.18;
          let mx, mz, pw, pd;
          if (cell === 29) {        // N edge (low Z)
            mx = wx; mz = row * CELL + WALL_T / 2; pw = CELL; pd = WALL_T;
          } else if (cell === 30) { // S edge (high Z)
            mx = wx; mz = (row + 1) * CELL - WALL_T / 2; pw = CELL; pd = WALL_T;
          } else if (cell === 31) { // W edge (low X)
            mx = col * CELL + WALL_T / 2; mz = wz; pw = WALL_T; pd = CELL;
          } else {                   // E edge (high X)
            mx = (col + 1) * CELL - WALL_T / 2; mz = wz; pw = WALL_T; pd = CELL;
          }
          const sw = new THREE.Mesh(new THREE.BoxGeometry(pw, WH, pd), [
            mats.wallDark, mats.wallDark, mats.wallTop, mats.floor, mats.wall, mats.wall,
          ]);
          sw.position.set(mx, BASE + WH / 2, mz);
          sw.castShadow = sw.receiveShadow = true;
          _levelGroup.add(sw);
          wallMeshes.push(sw);
          debugLineData.push({ x: mx - pw / 2, y: BASE, z: mz - pd / 2, w: pw, h: WH, d: pd, col: 0x6090ff });
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
