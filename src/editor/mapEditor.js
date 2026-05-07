import { CELL, PLAYER_H } from '../config.js';
import { matFloor, matWall, matWallD, matWallT, matCrack, matTrim, matRamp } from '../materials.js';
import { camera } from '../scene.js';
import { setActiveMap } from '../map.js';
import { buildLevel, clearLevel } from '../level.js';
import { setGameRunning } from '../input.js';
import { deactivateAllEnemies } from '../entities/enemies.js';

const GRID_W = 24, GRID_H = 24;
const FLOOR1 = 3.0, FLOOR2 = 6.0;

// ── Floor definitions ─────────────────────────────────────────────────────────
// Each floor has a base Y, a wall height (= one storey = FLOOR1), and 2 height keys.
const _FLOOR_DEFS = [
  { base: 0,      wallHeight: FLOOR1, label: 'Ground', hKeys: ['h0',  'hF05'] },
  { base: FLOOR1, wallHeight: FLOOR1, label: 'F1 (3m)', hKeys: ['h1',  'hF15'] },
  { base: FLOOR2, wallHeight: FLOOR1, label: 'F2 (6m)', hKeys: ['h2',  'hF25'] },
];

// Height tool identifiers → absolute Y values
const _HEIGHT_TOOLS = new Set(['h0','hF05','h1','hF15','h2','hF25']);
const _HEIGHT_VAL = {
  h0:   0,
  hF05: FLOOR1 / 2,                // 1.5 m
  h1:   FLOOR1,                    // 3.0 m
  hF15: (FLOOR1 + FLOOR2) / 2,     // 4.5 m
  h2:   FLOOR2,                    // 6.0 m
  hF25: FLOOR2 + FLOOR1 / 2,       // 7.5 m
};

// Labels shown in the height sub-panel per floor
const _FLOOR_H_LABELS = [
  { h0: 'Gnd', hF05: 'F½' },
  { h1: 'F1',  hF15: 'F1½' },
  { h2: 'F2',  hF25: 'F2½' },
];

const _MARKER_COLOR  = { spawn_p:'#2ecc71', spawn_a:'#e74c3c', spawn_d:'#3498db', site_a:'#ff8800', site_b:'#ff6600' };
const _MARKER_LETTER = { spawn_p:'P', spawn_a:'A', spawn_d:'D', site_a:'①', site_b:'②' };

// Per-group canvas colors for ramp tiles (group = Math.floor((tile-4)/4))
const _RAMP_GROUP_COLOR = ['#7a5c28','#c8901a','#3e2c10','#503c1e','#604c2e','#706040'];

function _getTileColor(tile) {
  if (tile === 0)  return '#1a1a1a';
  if (tile === 1)  return '#5c4e3e';
  if (tile === 2)  return '#2a5578';
  if (tile === 3)  return '#1e4a66';
  if (tile === 28) return '#7a5030';  // column
  if (tile >= 29 && tile <= 32) return '#18181e';  // side wall — floor-like bg
  if (tile >= 4 && tile <= 27) return _RAMP_GROUP_COLOR[Math.floor((tile - 4) / 4)] ?? '#7a5c28';
  return '#111';
}

function _heightLabel(h) {
  if (!h) return '';
  if (h >= FLOOR2 + FLOOR1 / 2) return 'F2½';
  if (h >= FLOOR2) return 'F2';
  if (h >= (FLOOR1 + FLOOR2) / 2) return 'F1½';
  if (h >= FLOOR1) return 'F1';
  if (h >= FLOOR1 / 2) return 'F½';
  return '?';
}

function _heightTint(h) {
  if (h >= FLOOR2 + FLOOR1 / 2) return 'rgba(255,140,40,0.55)';
  if (h >= FLOOR2) return 'rgba(200,160,50,0.52)';
  if (h >= FLOOR1) return 'rgba(160,120,30,0.44)';
  if (h >= 2.0)    return 'rgba(130,100,25,0.36)';
  if (h >= 1.5)    return 'rgba(110,84,20,0.30)';
  if (h >= 1.0)    return 'rgba(90,70,15,0.26)';
  return 'rgba(70,55,10,0.20)';
}

// ── Multi-floor state ─────────────────────────────────────────────────────────
function _blankGrid() {
  return Array.from({ length: GRID_H }, (_, r) =>
    Array.from({ length: GRID_W }, (_, c) =>
      (r === 0 || r === GRID_H - 1 || c === 0 || c === GRID_W - 1) ? 1 : 0
    )
  );
}
function _blankHeightmap() {
  return Array.from({ length: GRID_H }, () => new Array(GRID_W).fill(0));
}
function _blankFloors() {
  return _FLOOR_DEFS.map(fd => ({ base: fd.base, tiles: _blankGrid(), heightmap: _blankHeightmap() }));
}

let _floors   = null;   // [{base, tiles, heightmap}]  — 3 entries
let _floorIdx = 0;      // which floor the user is currently editing (0/1/2)
let _markers  = { spawn_p: null, spawn_a: null, spawn_d: null, site_a: null, site_b: null };
let _tool     = 'h0';   // current active tool (number = tile id, string = height/marker key)
let _undo     = [];
let _painting = false;
let _paintBtn = 0;
let _inPreview = false;
let _canvas   = null;
let _ctx      = null;

// Compound toolbar state
let _typeMode   = 'floor';  // 'floor' | 'ramp' | 'wall' | 'column' | 'swall' | 'crack'
let _rampDir    = 0;         // 0=N 1=S 2=W 3=E
let _rampRange  = 0;         // 0-5 → ramp tile groups
let _crackTile  = 2;         // 2=H 3=V
let _swallDir   = 0;         // side-wall edge: 0=N 1=S 2=W 3=E
let _floorHKey  = 'h0';      // active height key for current floor

// ── Convenience accessors ─────────────────────────────────────────────────────
const _curFloor   = () => _floors[_floorIdx];
const _curTiles   = () => _floors[_floorIdx].tiles;
const _curHmap    = () => _floors[_floorIdx].heightmap;

// ── Canvas helpers ────────────────────────────────────────────────────────────
function _drawRampArrow(c, r, cpx, cpy, dir) {
  const cx = (c + 0.5) * cpx, cy = (r + 0.5) * cpy;
  const hw = cpx * 0.28, hh = cpy * 0.28;
  _ctx.fillStyle = 'rgba(255,255,255,0.72)';
  _ctx.beginPath();
  if (dir === 'up') {
    _ctx.moveTo(cx, cy - hh); _ctx.lineTo(cx + hw, cy + hh); _ctx.lineTo(cx - hw, cy + hh);
  } else if (dir === 'down') {
    _ctx.moveTo(cx, cy + hh); _ctx.lineTo(cx - hw, cy - hh); _ctx.lineTo(cx + hw, cy - hh);
  } else if (dir === 'left') {
    _ctx.moveTo(cx - hw, cy); _ctx.lineTo(cx + hw, cy - hh); _ctx.lineTo(cx + hw, cy + hh);
  } else {
    _ctx.moveTo(cx + hw, cy); _ctx.lineTo(cx - hw, cy - hh); _ctx.lineTo(cx - hw, cy + hh);
  }
  _ctx.closePath();
  _ctx.fill();
}

function _drawFloorTiles(fl, cpx, cpy, alpha) {
  _ctx.globalAlpha = alpha;
  for (let r = 0; r < GRID_H; r++) {
    for (let c = 0; c < GRID_W; c++) {
      const tile = fl.tiles[r][c];
      _ctx.fillStyle = _getTileColor(tile);
      _ctx.fillRect(c * cpx + 0.5, r * cpy + 0.5, cpx - 1, cpy - 1);
      if (tile >= 4 && tile <= 27) {
        const dir = (tile - 4) % 4;
        _drawRampArrow(c, r, cpx, cpy, ['down','up','right','left'][dir]);
      }
      if (tile === 28) {
        _ctx.fillStyle = alpha < 1 ? 'rgba(192,128,80,0.4)' : '#c08050';
        _ctx.beginPath();
        _ctx.arc((c + 0.5) * cpx, (r + 0.5) * cpy, Math.min(cpx, cpy) * 0.36, 0, Math.PI * 2);
        _ctx.fill();
      }
      if (tile >= 29 && tile <= 32) {
        const ew = Math.max(3, Math.round(Math.min(cpx, cpy) * 0.20));
        _ctx.fillStyle = alpha < 1 ? 'rgba(96,144,208,0.4)' : '#6090d0';
        if (tile === 29)      _ctx.fillRect(c * cpx + 1,            r * cpy + 1,            cpx - 2, ew);
        else if (tile === 30) _ctx.fillRect(c * cpx + 1,            (r + 1) * cpy - ew - 1, cpx - 2, ew);
        else if (tile === 31) _ctx.fillRect(c * cpx + 1,            r * cpy + 1,            ew,      cpy - 2);
        else                  _ctx.fillRect((c + 1) * cpx - ew - 1, r * cpy + 1,            ew,      cpy - 2);
      }
    }
  }
  // Height overlay for this floor
  if (alpha >= 1) {
    _ctx.textAlign = 'right';
    _ctx.textBaseline = 'top';
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        const h = fl.heightmap[r][c];
        if (!h) continue;
        _ctx.fillStyle = _heightTint(h);
        _ctx.fillRect(c * cpx + 0.5, r * cpy + 0.5, cpx - 1, cpy - 1);
        const lbl = _heightLabel(h);
        if (lbl) {
          _ctx.fillStyle = h >= FLOOR1 ? 'rgba(255,200,60,0.9)' : 'rgba(200,160,60,0.8)';
          _ctx.font = `bold ${Math.max(7, Math.floor(cpx * 0.34))}px monospace`;
          _ctx.fillText(lbl, (c + 1) * cpx - 2, r * cpy + 1.5);
        }
      }
    }
  }
  _ctx.globalAlpha = 1;
}

// ── Canvas drawing ────────────────────────────────────────────────────────────
function _draw() {
  if (!_ctx) return;
  const cw = _canvas.width, ch = _canvas.height;
  const cpx = cw / GRID_W, cpy = ch / GRID_H;
  _ctx.clearRect(0, 0, cw, ch);

  // Ghost floors (non-active) at low opacity
  for (let fi = 0; fi < _floors.length; fi++) {
    if (fi === _floorIdx) continue;
    _drawFloorTiles(_floors[fi], cpx, cpy, 0.22);
  }

  // Current floor at full opacity
  _drawFloorTiles(_curFloor(), cpx, cpy, 1.0);

  // Markers (on top)
  _ctx.textAlign = 'center';
  _ctx.textBaseline = 'middle';
  for (const [key, pos] of Object.entries(_markers)) {
    if (!pos) continue;
    _ctx.globalAlpha = 0.72;
    _ctx.fillStyle = _MARKER_COLOR[key];
    _ctx.fillRect(pos.col * cpx + 0.5, pos.row * cpy + 0.5, cpx - 1, cpy - 1);
    _ctx.globalAlpha = 1;
    _ctx.fillStyle = '#fff';
    _ctx.font = `bold ${Math.max(8, Math.floor(cpx * 0.55))}px monospace`;
    _ctx.fillText(_MARKER_LETTER[key], (pos.col + 0.5) * cpx, (pos.row + 0.5) * cpy);
  }

  // Grid lines
  _ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  _ctx.lineWidth = 0.5;
  for (let c = 0; c <= GRID_W; c++) {
    _ctx.beginPath(); _ctx.moveTo(c * cpx, 0); _ctx.lineTo(c * cpx, ch); _ctx.stroke();
  }
  for (let r = 0; r <= GRID_H; r++) {
    _ctx.beginPath(); _ctx.moveTo(0, r * cpy); _ctx.lineTo(cw, r * cpy); _ctx.stroke();
  }
}

// ── Cell hit-test ─────────────────────────────────────────────────────────────
function _cellAt(e) {
  const rect = _canvas.getBoundingClientRect();
  const col = Math.floor((e.clientX - rect.left) / rect.width  * GRID_W);
  const row = Math.floor((e.clientY - rect.top)  / rect.height * GRID_H);
  return {
    col: Math.max(0, Math.min(GRID_W - 1, col)),
    row: Math.max(0, Math.min(GRID_H - 1, row)),
  };
}

// ── Paint logic ───────────────────────────────────────────────────────────────
function _paint(e) {
  const { col, row } = _cellAt(e);
  const erase = _paintBtn === 2;
  const fi = _floorIdx;
  const tiles = _curTiles(), hmap = _curHmap();

  if (_HEIGHT_TOOLS.has(_tool)) {
    const nextH = erase ? 0 : _HEIGHT_VAL[_tool];
    const prevH = hmap[row][col];
    const prevT = tiles[row][col];
    if (prevH === nextH && prevT === 0) return;
    _undoPush({ type: 'cell', fi, row, col, fromT: prevT, toT: 0, fromH: prevH, toH: nextH });
    hmap[row][col] = nextH;
    tiles[row][col] = 0;
  } else if (typeof _tool === 'string') {
    // Marker placement (markers are floor-agnostic)
    const key = _tool;
    const prev = _markers[key];
    if (erase) {
      if (prev && prev.col === col && prev.row === row) {
        _undoPush({ type: 'marker', key, from: prev, to: null });
        _markers[key] = null;
      }
    } else {
      const next = { col, row };
      if (prev && prev.col === col && prev.row === row) return;
      _undoPush({ type: 'marker', key, from: prev, to: next });
      _markers[key] = next;
    }
  } else {
    // Tile painting (ramp, wall, crack, column, swall)
    const next = erase ? 0 : _tool;
    const prev = tiles[row][col];
    if (prev === next) return;
    _undoPush({ type: 'tile', fi, row, col, from: prev, to: next });
    tiles[row][col] = next;
  }
  _draw();
}

function _undoPush(op) {
  _undo.push(op);
  if (_undo.length > 80) _undo.shift();
}

function _doUndo() {
  if (!_undo.length) return;
  const op = _undo.pop();
  if (op.type === 'tile') {
    _floors[op.fi].tiles[op.row][op.col] = op.from;
  } else if (op.type === 'cell') {
    _floors[op.fi].tiles[op.row][op.col] = op.fromT;
    _floors[op.fi].heightmap[op.row][op.col] = op.fromH;
  } else if (op.type === 'height') {
    _floors[op.fi ?? 0].heightmap[op.row][op.col] = op.from;
  } else {
    _markers[op.key] = op.from;
  }
  _draw();
}

// ── Compound toolbar state → _tool ───────────────────────────────────────────
function _computeToolFromCompound() {
  switch (_typeMode) {
    case 'floor':  _tool = _floorHKey; break;
    case 'ramp':   _tool = 4 + _rampRange * 4 + _rampDir; break;
    case 'wall':   _tool = 1; break;
    case 'column': _tool = 28; break;
    case 'swall':  _tool = 29 + _swallDir; break;  // 29=N 30=S 31=W 32=E
    case 'crack':  _tool = _crackTile; break;
  }
}

function _updateFloorTabs() {
  document.querySelectorAll('.ed-floor-tab').forEach(b =>
    b.classList.toggle('selected', +b.dataset.floor === _floorIdx));
}

function _updateHeightButtons() {
  const validKeys = new Set(_FLOOR_DEFS[_floorIdx].hKeys);
  const labels = _FLOOR_H_LABELS[_floorIdx];
  document.querySelectorAll('.ed-sublvl-btn').forEach(b => {
    const visible = validKeys.has(b.dataset.h);
    b.style.display = visible ? '' : 'none';
    if (visible && labels[b.dataset.h]) b.textContent = labels[b.dataset.h];
    b.classList.toggle('selected', b.dataset.h === _floorHKey);
  });
}

function _updateCompoundUI() {
  document.getElementById('ed-floor-sub').style.display  = _typeMode === 'floor'  ? '' : 'none';
  document.getElementById('ed-ramp-sub').style.display   = _typeMode === 'ramp'   ? '' : 'none';
  document.getElementById('ed-swall-sub').style.display  = _typeMode === 'swall'  ? '' : 'none';
  document.getElementById('ed-crack-sub').style.display  = _typeMode === 'crack'  ? '' : 'none';
  document.querySelectorAll('.ed-type-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.type === _typeMode));
  _updateHeightButtons();
  document.querySelectorAll('.ed-subfacing-btn').forEach(b =>
    b.classList.toggle('selected', +b.dataset.dir === _rampDir));
  document.querySelectorAll('.ed-subrange-btn').forEach(b =>
    b.classList.toggle('selected', +b.dataset.range === _rampRange));
  document.querySelectorAll('.ed-swdir-btn').forEach(b =>
    b.classList.toggle('selected', +b.dataset.dir === _swallDir));
  document.querySelectorAll('.ed-subcrack-btn').forEach(b =>
    b.classList.toggle('selected', +b.dataset.crack === _crackTile));
  document.querySelectorAll('.ed-tool').forEach(b => b.classList.remove('selected'));
  _updateFloorTabs();
}

function _selectMarkerTool(key) {
  _tool = key;
  document.querySelectorAll('.ed-type-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.ed-tool').forEach(b =>
    b.classList.toggle('selected', b.dataset.tile === key));
}

function _rotateTool() {
  if (_typeMode === 'ramp') {
    _rampDir = (_rampDir + 1) % 4;
  } else if (_typeMode === 'swall') {
    _swallDir = (_swallDir + 1) % 4;
  } else if (_typeMode === 'crack') {
    _crackTile = _crackTile === 2 ? 3 : 2;
  } else return;
  _computeToolFromCompound();
  _updateCompoundUI();
}

// ── Export / Import ───────────────────────────────────────────────────────────
function _encode() {
  const mk = (pos) => pos ? [pos.col, pos.row] : null;
  return btoa(JSON.stringify({
    v: 2, w: GRID_W, h: GRID_H,
    floors: _floors.map(fl => ({
      base: fl.base,
      t:  fl.tiles.flat(),
      hm: fl.heightmap.flat(),
    })),
    sp: mk(_markers.spawn_p), sa: mk(_markers.spawn_a),
    sd: mk(_markers.spawn_d), sA: mk(_markers.site_a), sB: mk(_markers.site_b),
  }));
}

function _decode(b64) {
  const d = JSON.parse(atob(b64));
  const w = d.w ?? 24, h = d.h ?? 24;
  const mk = (arr) => arr ? { col: arr[0], row: arr[1] } : null;
  if (d.v === 2 && d.floors) {
    _floors = d.floors.map(fd => ({
      base: fd.base,
      tiles:     Array.from({ length: h }, (_, r) => fd.t.slice(r * w, r * w + w)),
      heightmap: Array.from({ length: h }, (_, r) => fd.hm.slice(r * w, r * w + w)),
    }));
  } else {
    // Legacy v1: single floor
    _floors = _blankFloors();
    _floors[0].tiles     = Array.from({ length: h }, (_, r) => d.t.slice(r * w, r * w + w));
    _floors[0].heightmap = d.hm
      ? Array.from({ length: h }, (_, r) => d.hm.slice(r * w, r * w + w))
      : _blankHeightmap();
  }
  _markers = { spawn_p: mk(d.sp), spawn_a: mk(d.sa), spawn_d: mk(d.sd), site_a: mk(d.sA), site_b: mk(d.sB) };
  _undo = [];
  _draw();
}

// ── 3D Preview ────────────────────────────────────────────────────────────────
function _preview() {
  if (_inPreview) return;
  _inPreview = true;
  document.getElementById('editor-overlay').style.display = 'none';
  const hint = document.getElementById('ed-preview-hint');
  if (hint) hint.style.display = 'block';

  const mapDef = _buildMapDef();
  clearLevel();
  setActiveMap(mapDef);
  buildLevel(mapDef);
  deactivateAllEnemies();

  const sp = mapDef.spawnPlayer;
  camera.position.set(sp.x, PLAYER_H, sp.z);
  setGameRunning(true);
  document.getElementById('c').requestPointerLock();
}

export function exitEditorPreview() {
  if (!_inPreview) return;
  _inPreview = false;
  setGameRunning(false);
  document.exitPointerLock?.();
  const hint = document.getElementById('ed-preview-hint');
  if (hint) hint.style.display = 'none';
  document.getElementById('editor-overlay').style.display = 'flex';
}

// ── mapDef builder ────────────────────────────────────────────────────────────
function _buildMapDef() {
  const cx = (GRID_W / 2) * CELL + CELL / 2;
  const cz = (GRID_H / 2) * CELL + CELL / 2;
  const toWorld = (pos) => pos
    ? { x: pos.col * CELL + CELL / 2, z: pos.row * CELL + CELL / 2 }
    : { x: cx, z: cz };

  const siteA = _markers.site_a, siteB = _markers.site_b;
  return {
    name: 'Custom Map',
    floors: _floors.map((fl, i) => ({
      base:       fl.base,
      wallHeight: _FLOOR_DEFS[i].wallHeight,
      tiles:      fl.tiles.map(row => [...row]),
      heightmap:  fl.heightmap.map(row => [...row]),
    })),
    // Backward-compat fields for code that reads mapDef.tiles directly
    tiles:     _floors[0].tiles.map(row => [...row]),
    heightmap: _floors[0].heightmap.map(row => [...row]),
    width: GRID_W, height: GRID_H,
    H1: FLOOR1 / 2, H2: FLOOR1,
    spawnPlayer:   toWorld(_markers.spawn_p),
    spawnAttacker: toWorld(_markers.spawn_a),
    spawnDefender: toWorld(_markers.spawn_d),
    sites: [
      ...(siteA ? [{ id: 'A', x: siteA.col * CELL + CELL / 2, z: siteA.row * CELL + CELL / 2 }] : []),
      ...(siteB ? [{ id: 'B', x: siteB.col * CELL + CELL / 2, z: siteB.row * CELL + CELL / 2 }] : []),
    ],
    fog: { color: 0x2a3a4a, density: 0.010 },
    skyColor: 0x4a6070,
    wallHeight: _FLOOR_DEFS[0].wallHeight,
    showRubble: false,
    materials: {
      floor: matFloor, wall: matWall, wallDark: matWallD,
      wallTop: matWallT, crack: matCrack, trim: matTrim, ramp: matRamp,
    },
    buildExtras(_scene, tl) { tl.length = 0; },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────
export function openEditor() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('editor-overlay').style.display = 'flex';
  _draw();
  _updateCompoundUI();
}

export function closeEditor() {
  if (_inPreview) exitEditorPreview();
  document.getElementById('editor-overlay').style.display = 'none';
  document.getElementById('overlay').style.display = 'flex';
}

export function isEditorPreview() { return _inPreview; }

export function initEditor() {
  _floors    = _blankFloors();
  _floorIdx  = 0;
  _markers   = { spawn_p: null, spawn_a: null, spawn_d: null, site_a: null, site_b: null };
  _typeMode  = 'floor';
  _rampDir   = 0;
  _rampRange = 0;
  _crackTile = 2;
  _swallDir  = 0;
  _floorHKey = _FLOOR_DEFS[0].hKeys[0];
  _computeToolFromCompound();

  _canvas = document.getElementById('editor-canvas');
  _ctx    = _canvas.getContext('2d');
  _canvas.width  = GRID_W * 22;
  _canvas.height = GRID_H * 22;

  // ── Canvas mouse events ──────────────────────────────────────────────
  _canvas.addEventListener('contextmenu', e => e.preventDefault());
  _canvas.addEventListener('mousedown', e => {
    _painting = true;
    _paintBtn = e.button;
    e.preventDefault();
    _paint(e);
  });
  _canvas.addEventListener('mousemove', e => {
    if (_painting) _paint(e);
    const { col, row } = _cellAt(e);
    const h = _curHmap()[row][col];
    const t = _curTiles()[row][col];
    const tDesc = t >= 4 && t <= 27
      ? `ramp-${['N','S','W','E'][(t-4)%4]} [${['0→F1','F1→F2','0→F½','F½→F1','F1→F1½','F1½→F2'][Math.floor((t-4)/4)]}]`
      : (t >= 29 && t <= 32)
        ? `swall-${['N','S','W','E'][t - 29]}`
        : ({ 0:'floor', 1:'wall', 2:'crack-H', 3:'crack-V', 28:'column' })[t] ?? `tile${t}`;
    const flLabel = _FLOOR_DEFS[_floorIdx].label;
    const st = document.getElementById('ed-status');
    if (st) st.textContent = `[${flLabel}] col ${col}  row ${row}  ${tDesc}  h=${h ? h.toFixed(1) : '0'}m`;
  });
  _canvas.addEventListener('mouseup',    () => { _painting = false; });
  _canvas.addEventListener('mouseleave', () => { _painting = false; });

  // ── Floor tab buttons ────────────────────────────────────────────────
  document.querySelectorAll('.ed-floor-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _floorIdx  = +btn.dataset.floor;
      _floorHKey = _FLOOR_DEFS[_floorIdx].hKeys[0];
      if (_typeMode === 'floor') _computeToolFromCompound();
      _updateCompoundUI();
      _draw();
    });
  });

  // ── Compound build toolbar ───────────────────────────────────────────
  document.querySelectorAll('.ed-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _typeMode = btn.dataset.type;
      _computeToolFromCompound();
      _updateCompoundUI();
    });
  });
  document.querySelectorAll('.ed-sublvl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _floorHKey = btn.dataset.h;
      if (_typeMode === 'floor') _computeToolFromCompound();
      _updateCompoundUI();
    });
  });
  document.querySelectorAll('.ed-subfacing-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _rampDir = +btn.dataset.dir;
      if (_typeMode === 'ramp') _computeToolFromCompound();
      _updateCompoundUI();
    });
  });
  document.querySelectorAll('.ed-subrange-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _rampRange = +btn.dataset.range;
      if (_typeMode === 'ramp') _computeToolFromCompound();
      _updateCompoundUI();
    });
  });
  document.querySelectorAll('.ed-swdir-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _swallDir = +btn.dataset.dir;
      if (_typeMode === 'swall') _computeToolFromCompound();
      _updateCompoundUI();
    });
  });
  document.querySelectorAll('.ed-subcrack-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _crackTile = +btn.dataset.crack;
      if (_typeMode === 'crack') _computeToolFromCompound();
      _updateCompoundUI();
    });
  });

  // ── Marker tools ─────────────────────────────────────────────────────
  document.querySelectorAll('.ed-tool').forEach(btn => {
    btn.addEventListener('click', () => _selectMarkerTool(btn.dataset.tile));
  });

  // ── Action buttons ───────────────────────────────────────────────────
  document.getElementById('ed-undo').addEventListener('click', _doUndo);
  document.getElementById('ed-rotate').addEventListener('click', _rotateTool);

  document.getElementById('ed-clear').addEventListener('click', () => {
    _floors  = _blankFloors();
    _markers = { spawn_p: null, spawn_a: null, spawn_d: null, site_a: null, site_b: null };
    _undo    = [];
    _draw();
  });

  document.getElementById('ed-preview').addEventListener('click', _preview);

  document.getElementById('ed-export').addEventListener('click', () => {
    const b64 = _encode();
    const field = document.getElementById('ed-share-field');
    if (field) { field.value = b64; field.select(); }
    navigator.clipboard?.writeText(b64).catch(() => {});
    const msg = document.getElementById('ed-export-msg');
    if (msg) {
      msg.textContent = 'Copied!';
      setTimeout(() => { msg.textContent = ''; }, 2000);
    }
    const url = new URL(window.location.href);
    url.searchParams.set('map', b64);
    window.history.replaceState(null, '', url.toString());
  });

  document.getElementById('ed-import-btn').addEventListener('click', () => {
    const v = document.getElementById('ed-share-field').value.trim();
    if (v) { try { _decode(v); } catch (_) { alert('Invalid map data.'); } }
  });

  document.getElementById('ed-back').addEventListener('click', closeEditor);

  // ── Keyboard shortcuts ───────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (_inPreview && (e.code === 'KeyP' || e.code === 'Escape')) {
      exitEditorPreview();
      return;
    }
    const overlay = document.getElementById('editor-overlay');
    if (!overlay || overlay.style.display === 'none') return;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); _doUndo(); }
    if (e.code === 'KeyP') _preview();
    if (e.code === 'KeyR') _rotateTool();
  });

  // ── URL map param ────────────────────────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  const mapParam = params.get('map');
  if (mapParam) {
    try {
      _decode(mapParam);
      requestAnimationFrame(() => openEditor());
    } catch (_) {}
  }

  _draw();
  _updateCompoundUI();
}
