import * as THREE from 'three';
import { CELL, PLAYER_H } from './config.js';
import { mm } from './materials.js';
import { renderer, scene } from './scene.js';
import { torchLights, ambientLight, sunLight } from './lighting.js';

export const wallMeshes = [];
export let debugLines = null;

const _isRamp  = (c) => c >= 4 && c <= 7;
const _isCrack = (c) => c === 2 || c === 3;

export function buildLevel(mapDef) {
  const {
    tiles, heightmap, width, height,
    wallHeight: WH, materials: mats,
    fog, skyColor, showRubble,
  } = mapDef;

  // Reset
  wallMeshes.length = 0;
  torchLights.length = 0;
  const debugLineData = [];

  // Apply scene theme
  scene.fog = new THREE.FogExp2(fog.color, fog.density);
  scene.background = new THREE.Color(skyColor);
  renderer.setClearColor(skyColor);

  const getCell = (col, row) => {
    if (col < 0 || row < 0 || col >= width || row >= height) return 1;
    return tiles[row][col];
  };

  const H2 = mapDef.H2 ?? 0;

  // ── Ground plane ─────────────────────────────────────────────────────
  const fl = new THREE.Mesh(
    new THREE.PlaneGeometry((width + 4) * CELL, (height + 4) * CELL),
    mats.floor
  );
  fl.rotation.x = -Math.PI / 2;
  fl.position.set((width * CELL) / 2, 0, (height * CELL) / 2);
  fl.receiveShadow = true;
  scene.add(fl);

  // ── Tile geometry ─────────────────────────────────────────────────────
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const cell = tiles[row][col];
      if (cell === 0) continue;
      const wx = col * CELL + CELL / 2, wz = row * CELL + CELL / 2;

      if (cell === 1) {
        const n = getCell(col, row - 1), s = getCell(col, row + 1);
        const e = getCell(col + 1, row), w = getCell(col - 1, row);
        const isPillar = n === 0 && s === 0 && e === 0 && w === 0 && mapDef.style !== 'rooftop';
        if (isPillar) {
          const shaft = new THREE.Mesh(
            new THREE.CylinderGeometry(0.55, 0.62, WH + 0.8, 12),
            mats.wall
          );
          shaft.position.set(wx, (WH + 0.8) / 2, wz);
          shaft.castShadow = shaft.receiveShadow = true;
          scene.add(shaft);
          wallMeshes.push(shaft);
          const cap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 1.4), mats.wallTop);
          cap.position.set(wx, WH + 0.8, wz);
          scene.add(cap);
          const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 1.5), mats.wallTop);
          base.position.set(wx, 0.11, wz);
          scene.add(base);
          debugLineData.push({ x: wx - 0.7, y: 0, z: wz - 0.7, w: 1.4, h: WH + 0.8, d: 1.4, col: 0xff8800 });
        } else {
          const wm = new THREE.Mesh(new THREE.BoxGeometry(CELL, WH, CELL), [
            mats.wallDark, mats.wallDark, mats.wallTop, mats.floor, mats.wall, mats.wall,
          ]);
          wm.position.set(wx, WH / 2, wz);
          wm.castShadow = wm.receiveShadow = true;
          scene.add(wm);
          wallMeshes.push(wm);
          const t = new THREE.Mesh(new THREE.BoxGeometry(CELL, 0.18, CELL), mats.trim);
          t.position.set(wx, 0.09, wz);
          scene.add(t);
          debugLineData.push({ x: wx - CELL / 2, y: 0, z: wz - CELL / 2, w: CELL, h: WH, d: CELL, col: 0xff3300 });
        }
      } else if (_isCrack(cell)) {
        const loH = PLAYER_H - 0.28, upH = 0.55;
        const gw = cell === 2 ? CELL : 0.35, gd = cell === 2 ? 0.35 : CELL;
        const lo = new THREE.Mesh(new THREE.BoxGeometry(gw, loH, gd), mats.crack);
        lo.position.set(wx, loH / 2, wz);
        lo.castShadow = lo.receiveShadow = true;
        scene.add(lo);
        wallMeshes.push(lo);
        const up = new THREE.Mesh(new THREE.BoxGeometry(gw, upH, gd), mats.crack);
        up.position.set(wx, PLAYER_H + 0.28 + upH / 2, wz);
        up.castShadow = true;
        scene.add(up);
        wallMeshes.push(up);
        debugLineData.push({ x: wx - gw / 2, y: 0, z: wz - gd / 2, w: gw, h: loH, d: gd, col: 0x0088ff });
        debugLineData.push({ x: wx - gw / 2, y: PLAYER_H + 0.28, z: wz - gd / 2, w: gw, h: upH, d: gd, col: 0x0088ff });
      } else if (_isRamp(cell)) {
        const H = CELL / 2;
        let A, B, C, D, E, F;
        if (cell === 4)      { A=[-H,0,-H]; B=[H,0,-H]; C=[H,H2,H]; D=[-H,H2,H]; E=[-H,0,H]; F=[H,0,H]; }
        else if (cell === 5) { A=[-H,0,H];  B=[H,0,H];  C=[H,H2,-H]; D=[-H,H2,-H]; E=[-H,0,-H]; F=[H,0,-H]; }
        else if (cell === 6) { A=[-H,0,-H]; B=[-H,0,H];  C=[H,H2,H]; D=[H,H2,-H]; E=[H,0,-H]; F=[H,0,H]; }
        else                 { A=[H,0,H];   B=[H,0,-H];  C=[-H,H2,-H]; D=[-H,H2,H]; E=[-H,0,H]; F=[-H,0,-H]; }
        const verts = [...D,...C,...B,...D,...B,...A,...A,...B,...F,...A,...F,...E,...A,...E,...D,...B,...C,...F,...D,...E,...F,...D,...F,...C];
        const rampGeo = new THREE.BufferGeometry();
        rampGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
        rampGeo.computeVertexNormals();
        const rampMat = new THREE.MeshStandardMaterial({
          color: mats.ramp.color, roughness: mats.ramp.roughness,
          metalness: mats.ramp.metalness, side: THREE.DoubleSide,
        });
        const rm = new THREE.Mesh(rampGeo, rampMat);
        rm.position.set(wx, 0, wz);
        rm.castShadow = rm.receiveShadow = true;
        scene.add(rm);
        debugLineData.push({ x: wx - CELL / 2, y: 0, z: wz - CELL / 2, w: CELL, h: H2, d: CELL, col: 0xffee00 });
      }
    }
  }

  // ── Rubble (bunker style — skipped for rooftop) ───────────────────────
  if (showRubble) {
    const rubbleMat = mm(0x8a7a60, 0.97, 0.0);
    for (let i = 0; i < 80; i++) {
      const rc = 1 + Math.floor(Math.random() * (width - 2));
      const rr = 1 + Math.floor(Math.random() * (height - 2));
      if (tiles[rr][rc] !== 0) continue;
      const sz = 0.15 + Math.random() * 0.35;
      const rb = new THREE.Mesh(new THREE.BoxGeometry(sz, sz * 0.5, sz * 0.85), rubbleMat);
      rb.position.set(rc * CELL + Math.random() * CELL * 0.8, sz * 0.25, rr * CELL + Math.random() * CELL * 0.8);
      rb.rotation.y = Math.random() * Math.PI;
      rb.rotation.z = (Math.random() - 0.5) * 0.3;
      rb.receiveShadow = rb.castShadow = true;
      scene.add(rb);
    }
  }

  // ── Elevated terrain slabs ───────────────────────────────────────────
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
      const slab = new THREE.Mesh(new THREE.BoxGeometry(pw, h, pd), [elevSide, elevSide, elevMat, elevMat, elevSide, elevSide]);
      slab.position.set(cx2, h / 2, cz2);
      slab.receiveShadow = slab.castShadow = true;
      scene.add(slab);
      debugLineData.push({ x: cx2 - pw / 2, y: 0, z: cz2 - pd / 2, w: pw, h, d: pd, col: 0x00ff88 });
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
  scene.add(debugLines);
}
