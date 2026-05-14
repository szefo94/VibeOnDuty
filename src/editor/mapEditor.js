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
const _MARKER_KEYS   = new Set(Object.keys(_MARKER_COLOR));
const _MARKER_LETTER = { spawn_p:'P', spawn_a:'A', spawn_d:'D', site_a:'①', site_b:'②' };

// Per-group canvas colors for ramp tiles (group = Math.floor((tile-4)/4))
const _RAMP_GROUP_COLOR  = ['#7a5c28','#c8901a','#3e2c10','#503c1e','#604c2e','#706040'];
const _DIAG_TYPE_NAMES   = ['O-NW','O-NE','O-SE','O-SW','P-NW','P-NE','P-SE','P-SW'];
const _RREV_TYPE_NAMES   = ['Q-NW','Q-NE','Q-SE','Q-SW','H-NS+','H-NS-','H-EW+','H-EW-'];
const _BLIN_TYPE_NAMES   = ['B-NE','B-NW','B-SE','B-SW'];

function _getTileColor(tile) {
  if (tile === 0)  return '#1a1a1a';
  if (tile === 1)  return '#5c4e3e';
  if (tile === 2)  return '#2a5578';
  if (tile === 3)  return '#1e4a66';
  if (tile === 28) return '#7a5030';
  if (tile >= 29 && tile <= 32) return '#18181e';
  if (tile >= 4  && tile <= 27) return _RAMP_GROUP_COLOR[Math.floor((tile - 4) / 4)] ?? '#7a5c28';
  if (tile >= 33 && tile <= 80) return _RAMP_GROUP_COLOR[(tile - 33) % 6] ?? '#7a5c28';
  if (tile >= 81  && tile <= 128) return _RAMP_GROUP_COLOR[(tile - 81)  % 6] ?? '#7a5c28';
  if (tile >= 129 && tile <= 152) return _RAMP_GROUP_COLOR[(tile - 129) % 6] ?? '#7a5c28';
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
function _blankSwallBits() {
  return Array.from({ length: GRID_H }, () => new Array(GRID_W).fill(0));
}
function _blankFloors() {
  return _FLOOR_DEFS.map(fd => ({
    base: fd.base,
    tiles:     _blankGrid(),
    heightmap: _blankHeightmap(),
    swallBits: _blankSwallBits(),
  }));
}

let _floors   = null;   // [{base, tiles, heightmap}]  — 3 entries
let _floorIdx = 0;      // which floor the user is currently editing (0/1/2)
let _markers  = { spawn_p: null, spawn_a: null, spawn_d: null, site_a: null, site_b: null };
let _tool     = 'h0';   // current active tool (number = tile id, string = height/marker key)
let _undo     = [];
let _painting = false;
let _paintBtn = 0;
let _inPreview = false;
let _fillMode   = false;
let _rectMode   = false;
let _rectStart  = null;
let _rectPreviewEnd = null;
let _mirrorMode = 0;       // 0=off 1=H 2=V 3=H+V
let _zoom       = 22;      // canvas px per tile (8–40)
let _mapName    = '';
let _activeSlot = -1;
let _canvas   = null;
let _ctx      = null;

// Compound toolbar state
let _typeMode   = 'floor';  // 'floor' | 'ramp' | 'dramp' | 'rramp' | 'wall' | 'column' | 'swall' | 'crack'
let _rampDir    = 0;         // 0=N 1=S 2=W 3=E
let _rampRange  = 0;         // 0-5 → ramp tile groups (shared by ramp/dramp/rramp)
let _crackTile  = 2;         // 2=H 3=V
let _swallDir   = 0;         // side-wall edge: 0=N 1=S 2=W 3=E
let _floorHKey  = 'h0';      // active height key for current floor
let _drampType  = 0;         // 0-7: OuterNW/NE/SE/SW, PeakNW/NE/SE/SW
let _rrampType  = 0;         // 0-3: Q-NW/NE/SE/SW, 4-7: H-NS+/-/EW+/-
let _brampType  = 0;         // 0-3: peak NE/NW/SE/SW

// ── Convenience accessors ─────────────────────────────────────────────────────
const _curFloor     = () => _floors[_floorIdx];
const _curTiles     = () => _floors[_floorIdx].tiles;
const _curHmap      = () => _floors[_floorIdx].heightmap;
const _curSwallBits = () => _floors[_floorIdx].swallBits;

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

// Draw a diagonal indicator: line from adj1→adj3 + dot at key corner.
// diagType 0-3 = Outer (dot at valley/low corner), 4-7 = Peak (dot at high corner).
function _drawDiagRampIndicator(c, r, cpx, cpy, diagType, alpha) {
  const x0 = c * cpx + 2, y0 = r * cpy + 2;
  const x1 = (c + 1) * cpx - 2, y1 = (r + 1) * cpy - 2;
  // Corners: 0=NW 1=NE 2=SE 3=SW
  const pts = [[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  const dir = diagType % 4;
  const adj1 = (dir + 1) % 4, adj3 = (dir + 3) % 4;
  const isOuter = diagType < 4;
  const a = alpha < 1 ? alpha * 0.7 : 1;
  // Diagonal cut line
  _ctx.strokeStyle = `rgba(255,255,255,${0.6 * a})`;
  _ctx.lineWidth = 1.5;
  _ctx.beginPath();
  _ctx.moveTo(pts[adj1][0], pts[adj1][1]);
  _ctx.lineTo(pts[adj3][0], pts[adj3][1]);
  _ctx.stroke();
  // Key corner dot
  const [kx, ky] = pts[dir];
  _ctx.fillStyle = isOuter
    ? `rgba(80,160,255,${0.85 * a})`   // blue = valley
    : `rgba(255,200,40,${0.9 * a})`;   // yellow = peak
  _ctx.beginPath();
  _ctx.arc(kx, ky, Math.max(2, Math.min(cpx, cpy) * 0.13), 0, Math.PI * 2);
  _ctx.fill();
}

// Two flat edges (blue) + peak corner dot (yellow) for bilinear corner ramps.
function _drawBilinearRampIndicator(c, r, cpx, cpy, type, alpha) {
  const x0 = c * cpx + 2, y0 = r * cpy + 2;
  const x1 = (c + 1) * cpx - 2, y1 = (r + 1) * cpy - 2;
  const a = alpha < 1 ? alpha * 0.7 : 1;
  // Flat edges per type (NE=0: west+south, NW=1: east+south, SE=2: west+north, SW=3: east+north)
  const edges = [
    [[x0,y0,x0,y1],[x0,y1,x1,y1]], // NE
    [[x1,y0,x1,y1],[x0,y1,x1,y1]], // NW
    [[x0,y0,x0,y1],[x0,y0,x1,y0]], // SE
    [[x1,y0,x1,y1],[x0,y0,x1,y0]], // SW
  ];
  _ctx.strokeStyle = `rgba(80,160,255,${0.7 * a})`;
  _ctx.lineWidth = 2;
  _ctx.beginPath();
  for (const [ax, ay, bx, by] of edges[type]) {
    _ctx.moveTo(ax, ay); _ctx.lineTo(bx, by);
  }
  _ctx.stroke();
  // Peak corner dot
  const peaks = [[x1,y0],[x0,y0],[x1,y1],[x0,y1]]; // NE, NW, SE, SW in canvas coords
  const [kx, ky] = peaks[type];
  _ctx.fillStyle = `rgba(255,200,40,${0.9 * a})`;
  _ctx.beginPath();
  _ctx.arc(kx, ky, Math.max(2, Math.min(cpx, cpy) * 0.14), 0, Math.PI * 2);
  _ctx.fill();
}

// Draw arc (quarter-turn) or S-curve (half-turn) indicator for revolved ramps.
function _drawRevolvedRampIndicator(c, r, cpx, cpy, type, alpha) {
  const x0 = c * cpx + 2, y0 = r * cpy + 2;
  const x1 = (c + 1) * cpx - 2, y1 = (r + 1) * cpy - 2;
  const a = alpha < 1 ? alpha * 0.7 : 1;
  _ctx.strokeStyle = `rgba(160,220,255,${0.75 * a})`;
  _ctx.lineWidth = 1.5;
  _ctx.beginPath();
  if (type < 4) {
    // Quarter-circle arc from one edge to adjacent edge, centred on pivot corner.
    const pivotX = [x0, x1, x1, x0][type];
    const pivotY = [y0, y0, y1, y1][type];
    const r2 = Math.min(cpx, cpy) * 0.72;
    const startA = [0, Math.PI / 2, Math.PI, -Math.PI / 2][type];
    _ctx.arc(pivotX, pivotY, r2, startA, startA + Math.PI / 2);
    _ctx.stroke();
    // Dot at low (start) end
    const dotLX = pivotX + Math.cos(startA) * r2;
    const dotLY = pivotY + Math.sin(startA) * r2;
    _ctx.fillStyle = `rgba(80,160,255,${0.85 * a})`;
    _ctx.beginPath();
    _ctx.arc(dotLX, dotLY, Math.max(2, Math.min(cpx, cpy) * 0.10), 0, Math.PI * 2);
    _ctx.fill();
    // Dot at high (end) end
    const dotHX = pivotX + Math.cos(startA + Math.PI / 2) * r2;
    const dotHY = pivotY + Math.sin(startA + Math.PI / 2) * r2;
    _ctx.fillStyle = `rgba(255,200,40,${0.9 * a})`;
    _ctx.beginPath();
    _ctx.arc(dotHX, dotHY, Math.max(2, Math.min(cpx, cpy) * 0.10), 0, Math.PI * 2);
    _ctx.fill();
  } else {
    // Half-turn: S-curve across the tile
    const isNS = type < 6;
    const flip = (type === 5 || type === 7) ? -1 : 1;
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      let px, py;
      if (isNS) {
        py = y0 + t * (y1 - y0);
        px = (x0 + x1) / 2 + flip * (x1 - x0) * 0.38 * Math.sin(t * Math.PI);
      } else {
        px = x0 + t * (x1 - x0);
        py = (y0 + y1) / 2 + flip * (y1 - y0) * 0.38 * Math.sin(t * Math.PI);
      }
      if (i === 0) _ctx.moveTo(px, py);
      else _ctx.lineTo(px, py);
    }
    _ctx.stroke();
  }
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
      if (tile >= 33 && tile <= 80) {
        const diagType = Math.floor((tile - 33) / 6);
        _drawDiagRampIndicator(c, r, cpx, cpy, diagType, alpha);
      }
      if (tile >= 81 && tile <= 128) {
        const rtype = Math.floor((tile - 81) / 6);
        _drawRevolvedRampIndicator(c, r, cpx, cpy, rtype, alpha);
      }
      if (tile >= 129 && tile <= 152) {
        const btype = Math.floor((tile - 129) / 6);
        _drawBilinearRampIndicator(c, r, cpx, cpy, btype, alpha);
      }
      if (tile === 28) {
        _ctx.fillStyle = alpha < 1 ? 'rgba(192,128,80,0.4)' : '#c08050';
        _ctx.beginPath();
        _ctx.arc((c + 0.5) * cpx, (r + 0.5) * cpy, Math.min(cpx, cpy) * 0.36, 0, Math.PI * 2);
        _ctx.fill();
      }
      // legacy swall tiles — shouldn't appear in new maps but draw if present
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
  // Side-wall bitmask overlay (bit0=N, bit1=S, bit2=W, bit3=E)
  if (fl.swallBits) {
    const swColor = alpha < 1 ? 'rgba(96,144,208,0.35)' : '#6090d0';
    _ctx.fillStyle = swColor;
    for (let r = 0; r < GRID_H; r++) {
      for (let c = 0; c < GRID_W; c++) {
        const bits = fl.swallBits[r][c];
        if (!bits) continue;
        const ew = Math.max(3, Math.round(Math.min(cpx, cpy) * 0.22));
        if (bits & 1) _ctx.fillRect(c * cpx + 1,             r * cpy + 1,             cpx - 2, ew);       // N
        if (bits & 2) _ctx.fillRect(c * cpx + 1,             (r + 1) * cpy - ew - 1,  cpx - 2, ew);       // S
        if (bits & 4) _ctx.fillRect(c * cpx + 1,             r * cpy + 1,             ew,      cpy - 2);  // W
        if (bits & 8) _ctx.fillRect((c + 1) * cpx - ew - 1,  r * cpy + 1,             ew,      cpy - 2);  // E
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

  // Rect-mode drag preview
  if (_rectMode && _rectStart && _rectPreviewEnd) {
    const rc1 = Math.min(_rectStart.col, _rectPreviewEnd.col);
    const rc2 = Math.max(_rectStart.col, _rectPreviewEnd.col);
    const rr1 = Math.min(_rectStart.row, _rectPreviewEnd.row);
    const rr2 = Math.max(_rectStart.row, _rectPreviewEnd.row);
    _ctx.fillStyle = 'rgba(232,200,74,0.22)';
    _ctx.fillRect(rc1 * cpx, rr1 * cpy, (rc2 - rc1 + 1) * cpx, (rr2 - rr1 + 1) * cpy);
    _ctx.strokeStyle = 'rgba(232,200,74,0.85)';
    _ctx.lineWidth = 2;
    _ctx.strokeRect(rc1 * cpx + 1, rr1 * cpy + 1, (rc2 - rc1 + 1) * cpx - 2, (rr2 - rr1 + 1) * cpy - 2);
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

// Single-cell paint — caller must call _draw() when done.
function _paintAt(col, row, erase) {
  if (col < 0 || row < 0 || col >= GRID_W || row >= GRID_H) return;
  const fi = _floorIdx;
  const tiles = _curTiles(), hmap = _curHmap();

  if (_typeMode === 'swall') {
    const swallMap = _curSwallBits();
    const bit = 1 << _swallDir;
    const prev = swallMap[row][col];
    const next = erase ? (prev & ~bit) : (prev | bit);
    if (prev === next) return;
    _undoPush({ type: 'swall', fi, row, col, from: prev, to: next });
    swallMap[row][col] = next;
    return;
  }

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
    const next = erase ? 0 : _tool;
    const prev = tiles[row][col];
    if (prev === next) return;
    _undoPush({ type: 'tile', fi, row, col, from: prev, to: next });
    tiles[row][col] = next;
  }
}

function _paint(e) {
  const { col, row } = _cellAt(e);
  const erase = _paintBtn === 2;

  // Fill mode: flood-fill tile region instead of single cell
  if (_fillMode && typeof _tool === 'number' && !_HEIGHT_TOOLS.has(_tool)) {
    _floodFill(col, row, erase);
    return;
  }

  _paintAt(col, row, erase);
  // Mirror mode — skip for unique marker tools
  if (!_MARKER_KEYS.has(_tool)) {
    if (_mirrorMode & 1) _paintAt(GRID_W - 1 - col, row, erase);
    if (_mirrorMode & 2) _paintAt(col, GRID_H - 1 - row, erase);
    if (_mirrorMode === 3) _paintAt(GRID_W - 1 - col, GRID_H - 1 - row, erase);
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
  } else if (op.type === 'swall') {
    _floors[op.fi].swallBits[op.row][op.col] = op.from;
  } else if (op.type === 'batch') {
    for (const sub of [...op.ops].reverse()) {
      if (sub.type === 'tile') _floors[sub.fi].tiles[sub.row][sub.col] = sub.from;
      else if (sub.type === 'cell') {
        _floors[sub.fi].tiles[sub.row][sub.col] = sub.fromT;
        _floors[sub.fi].heightmap[sub.row][sub.col] = sub.fromH;
      }
    }
  } else {
    _markers[op.key] = op.from;
  }
  _draw();
}

function _floodFill(startCol, startRow, erase) {
  const tiles = _curTiles();
  const fi = _floorIdx;
  const targetTile = tiles[startRow][startCol];
  const nextTile = erase ? 0 : _tool;
  if (targetTile === nextTile) return;

  const ops = [];
  const visited = new Uint8Array(GRID_W * GRID_H);
  const queue = [[startCol, startRow]];
  while (queue.length) {
    const [c, r] = queue.shift();
    if (c < 0 || r < 0 || c >= GRID_W || r >= GRID_H) continue;
    const key = r * GRID_W + c;
    if (visited[key]) continue;
    if (tiles[r][c] !== targetTile) continue;
    visited[key] = 1;
    ops.push({ type: 'tile', fi, row: r, col: c, from: tiles[r][c], to: nextTile });
    tiles[r][c] = nextTile;
    queue.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
  }
  if (ops.length) { _undoPush({ type: 'batch', ops }); _draw(); }
}

function _applyRect(c1, r1, c2, r2, erase) {
  if (typeof _tool !== 'number') return;
  const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
  const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
  const fi = _floorIdx;
  const tiles = _curTiles();
  const nextTile = erase ? 0 : _tool;
  const ops = [];
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const prev = tiles[r][c];
      if (prev === nextTile) continue;
      ops.push({ type: 'tile', fi, row: r, col: c, from: prev, to: nextTile });
      tiles[r][c] = nextTile;
    }
  }
  if (ops.length) _undoPush({ type: 'batch', ops });
  _draw();
}

// ── Compound toolbar state → _tool ───────────────────────────────────────────
function _computeToolFromCompound() {
  switch (_typeMode) {
    case 'floor':  _tool = _floorHKey; break;
    case 'ramp':   _tool = 4 + _rampRange * 4 + _rampDir; break;
    case 'dramp':  _tool = 33 + _drampType * 6 + _rampRange; break;
    case 'rramp':  _tool = 81  + _rrampType * 6 + _rampRange; break;
    case 'bramp':  _tool = 129 + _brampType * 6 + _rampRange; break;
    case 'wall':   _tool = 1; break;
    case 'column': _tool = 28; break;
    case 'swall':  _tool = 'swall'; break;
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
  document.getElementById('ed-dramp-sub').style.display  = _typeMode === 'dramp'  ? '' : 'none';
  document.getElementById('ed-rramp-sub').style.display  = _typeMode === 'rramp'  ? '' : 'none';
  document.getElementById('ed-bramp-sub').style.display  = _typeMode === 'bramp'  ? '' : 'none';
  document.getElementById('ed-swall-sub').style.display  = _typeMode === 'swall'  ? '' : 'none';
  document.getElementById('ed-crack-sub').style.display  = _typeMode === 'crack'  ? '' : 'none';
  document.querySelectorAll('.ed-type-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.type === _typeMode));
  _updateHeightButtons();
  document.querySelectorAll('.ed-subfacing-btn').forEach(b =>
    b.classList.toggle('selected', +b.dataset.dir === _rampDir));
  document.querySelectorAll('.ed-subrange-btn').forEach(b =>
    b.classList.toggle('selected', +b.dataset.range === _rampRange));
  document.querySelectorAll('.ed-dramptype-btn').forEach(b =>
    b.classList.toggle('selected', +b.dataset.dtype === _drampType));
  document.querySelectorAll('.ed-rramptype-btn').forEach(b =>
    b.classList.toggle('selected', +b.dataset.rtype === _rrampType));
  document.querySelectorAll('.ed-bramptype-btn').forEach(b =>
    b.classList.toggle('selected', +b.dataset.btype === _brampType));
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
  } else if (_typeMode === 'dramp') {
    _drampType = (_drampType + 1) % 8;
  } else if (_typeMode === 'rramp') {
    _rrampType = (_rrampType + 1) % 8;
  } else if (_typeMode === 'bramp') {
    _brampType = (_brampType + 1) % 4;
  } else if (_typeMode === 'swall') {
    _swallDir = (_swallDir + 1) % 4;
  } else if (_typeMode === 'crack') {
    _crackTile = _crackTile === 2 ? 3 : 2;
  } else return;
  _computeToolFromCompound();
  _updateCompoundUI();
}

// ── Mode / mirror UI helpers ──────────────────────────────────────────────────
function _updateMirrorBtn() {
  const btn = document.getElementById('ed-mirror');
  if (btn) btn.textContent = ['Mirror: OFF [M]', 'Mirror: ↔ [M]', 'Mirror: ↕ [M]', 'Mirror: ↔↕ [M]'][_mirrorMode];
}
function _updateModeButtons() {
  document.getElementById('ed-fill')?.classList.toggle('ed-mode-active', _fillMode);
  document.getElementById('ed-rect')?.classList.toggle('ed-mode-active', _rectMode);
}

// ── Save slots (localStorage) ─────────────────────────────────────────────────
const SLOT_COUNT = 5;
function _slotLabel(idx) {
  const raw = localStorage.getItem(`vod_slot_${idx}`);
  if (!raw) return '[ empty ]';
  try { return JSON.parse(raw).name || `Map ${idx + 1}`; } catch (_) { return `Map ${idx + 1}`; }
}
function _saveToSlot(idx) {
  if (idx < 0 || idx >= SLOT_COUNT) return;
  localStorage.setItem(`vod_slot_${idx}`, JSON.stringify({ name: _mapName, map: _encode() }));
  _activeSlot = idx;
  _updateSlotUI();
  const msg = document.getElementById('ed-export-msg');
  if (msg) { msg.textContent = `Saved to slot ${idx + 1}`; setTimeout(() => { msg.textContent = ''; }, 2000); }
}
function _loadFromSlot(idx) {
  const raw = localStorage.getItem(`vod_slot_${idx}`);
  if (!raw) {
    const msg = document.getElementById('ed-export-msg');
    if (msg) { msg.textContent = 'Slot is empty'; setTimeout(() => { msg.textContent = ''; }, 2000); }
    return;
  }
  try {
    const data = JSON.parse(raw);
    _mapName = data.name ?? '';
    const nf = document.getElementById('ed-map-name');
    if (nf) nf.value = _mapName;
    _decode(data.map);
    _activeSlot = idx;
    _updateSlotUI();
  } catch (_) {}
}
function _updateSlotUI() {
  document.querySelectorAll('.ed-slot-btn').forEach(btn => {
    const idx = +btn.dataset.slot;
    btn.textContent = `${idx + 1}: ${_slotLabel(idx)}`;
    btn.classList.toggle('selected', idx === _activeSlot);
  });
}

// ── Export / Import ───────────────────────────────────────────────────────────
function _encode() {
  const mk = (pos) => pos ? [pos.col, pos.row] : null;
  return btoa(JSON.stringify({
    v: 2, w: GRID_W, h: GRID_H, name: _mapName,
    floors: _floors.map(fl => ({
      base: fl.base,
      t:  fl.tiles.flat(),
      hm: fl.heightmap.flat(),
      sw: fl.swallBits.flat(),
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
      base:      fd.base,
      tiles:     Array.from({ length: h }, (_, r) => Array.from(fd.t.slice(r * w, r * w + w))),
      heightmap: Array.from({ length: h }, (_, r) => Array.from(fd.hm.slice(r * w, r * w + w))),
      swallBits: fd.sw
        ? Array.from({ length: h }, (_, r) => Array.from(fd.sw.slice(r * w, r * w + w)))
        : _blankSwallBits(),
    }));
  } else {
    // Legacy v1: single floor — migrate old swall tile IDs (29-32) to swallBits
    _floors = _blankFloors();
    _floors[0].tiles     = Array.from({ length: h }, (_, r) => Array.from(d.t.slice(r * w, r * w + w)));
    _floors[0].heightmap = d.hm
      ? Array.from({ length: h }, (_, r) => Array.from(d.hm.slice(r * w, r * w + w)))
      : _blankHeightmap();
    // Convert old swall tile IDs to swallBits
    for (let r = 0; r < h; r++) {
      for (let c2 = 0; c2 < w; c2++) {
        const t = _floors[0].tiles[r][c2];
        if (t >= 29 && t <= 32) {
          _floors[0].swallBits[r][c2] = 1 << (t - 29);
          _floors[0].tiles[r][c2] = 0;
        }
      }
    }
  }
  _markers = { spawn_p: mk(d.sp), spawn_a: mk(d.sa), spawn_d: mk(d.sd), site_a: mk(d.sA), site_b: mk(d.sB) };
  _mapName = d.name ?? '';
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
    name: _mapName || 'Custom Map',
    floors: _floors.map((fl, i) => ({
      base:       fl.base,
      wallHeight: _FLOOR_DEFS[i].wallHeight,
      tiles:      fl.tiles.map(row => [...row]),
      heightmap:  fl.heightmap.map(row => [...row]),
      swallBits:  fl.swallBits.map(row => [...row]),
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
  const nf = document.getElementById('ed-map-name');
  if (nf) nf.value = _mapName;
  _draw();
  _updateCompoundUI();
  _updateMirrorBtn();
  _updateModeButtons();
  _updateSlotUI();
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
  _typeMode   = 'floor';
  _rampDir    = 0;
  _rampRange  = 0;
  _crackTile  = 2;
  _swallDir   = 0;
  _drampType  = 0;
  _rrampType  = 0;
  _brampType  = 0;
  _floorHKey  = _FLOOR_DEFS[0].hKeys[0];
  _computeToolFromCompound();

  _canvas = document.getElementById('editor-canvas');
  _ctx    = _canvas.getContext('2d');
  _canvas.width  = GRID_W * _zoom;
  _canvas.height = GRID_H * _zoom;

  // ── Canvas mouse events ──────────────────────────────────────────────
  _canvas.addEventListener('contextmenu', e => e.preventDefault());
  _canvas.addEventListener('mousedown', e => {
    _painting = true;
    _paintBtn = e.button;
    e.preventDefault();
    if (_rectMode && typeof _tool === 'number' && !_HEIGHT_TOOLS.has(_tool)) {
      _rectStart = _cellAt(e);
      _rectPreviewEnd = { ..._rectStart };
      _draw();
    } else {
      _paint(e);
    }
  });
  _canvas.addEventListener('mousemove', e => {
    if (_painting) {
      if (_rectMode && _rectStart && typeof _tool === 'number' && !_HEIGHT_TOOLS.has(_tool)) {
        _rectPreviewEnd = _cellAt(e);
        _draw();
      } else {
        _paint(e);
      }
    }
    const { col, row } = _cellAt(e);
    const h = _curHmap()[row][col];
    const t = _curTiles()[row][col];
    const swBits = _curSwallBits()[row][col];
    const swDesc = swBits
      ? ' swall:' + ['N','S','W','E'].filter((_, i) => swBits & (1 << i)).join('+')
      : '';
    const _RANGE_LABELS = ['0→F1','F1→F2','0→F½','F½→F1','F1→F1½','F1½→F2'];
    const tDesc = (t >= 4 && t <= 27)
      ? `ramp-${['N','S','W','E'][(t-4)%4]} [${_RANGE_LABELS[Math.floor((t-4)/4)]}]`
      : (t >= 33 && t <= 80)
      ? `diag-${_DIAG_TYPE_NAMES[Math.floor((t-33)/6)]} [${_RANGE_LABELS[(t-33)%6]}]`
      : (t >= 81 && t <= 128)
      ? `rev-${_RREV_TYPE_NAMES[Math.floor((t-81)/6)]} [${_RANGE_LABELS[(t-81)%6]}]`
      : (t >= 129 && t <= 152)
      ? `bilin-${_BLIN_TYPE_NAMES[Math.floor((t-129)/6)]} [${_RANGE_LABELS[(t-129)%6]}]`
      : ({ 0:'floor', 1:'wall', 2:'crack-H', 3:'crack-V', 28:'column' })[t] ?? `tile${t}`;
    const flLabel = _FLOOR_DEFS[_floorIdx].label;
    const st = document.getElementById('ed-status');
    if (st) st.textContent = `[${flLabel}] col ${col}  row ${row}  ${tDesc}${swDesc}  h=${h ? h.toFixed(1) : '0'}m`;
  });
  _canvas.addEventListener('mouseup', () => {
    if (_painting && _rectMode && _rectStart && _rectPreviewEnd) {
      _applyRect(_rectStart.col, _rectStart.row, _rectPreviewEnd.col, _rectPreviewEnd.row, _paintBtn === 2);
      _rectStart = null; _rectPreviewEnd = null;
    }
    _painting = false;
  });
  _canvas.addEventListener('mouseleave', () => {
    if (_painting && _rectMode && _rectStart && _rectPreviewEnd) {
      _applyRect(_rectStart.col, _rectStart.row, _rectPreviewEnd.col, _rectPreviewEnd.row, _paintBtn === 2);
      _rectStart = null; _rectPreviewEnd = null;
    }
    _painting = false;
  });
  _canvas.addEventListener('wheel', e => {
    e.preventDefault();
    _zoom = Math.max(8, Math.min(40, _zoom + (e.deltaY < 0 ? 2 : -2)));
    _canvas.width  = GRID_W * _zoom;
    _canvas.height = GRID_H * _zoom;
    _draw();
  }, { passive: false });

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
      if (_typeMode === 'ramp' || _typeMode === 'dramp' || _typeMode === 'rramp' || _typeMode === 'bramp') _computeToolFromCompound();
      _updateCompoundUI();
    });
  });
  document.querySelectorAll('.ed-dramptype-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _drampType = +btn.dataset.dtype;
      if (_typeMode === 'dramp') _computeToolFromCompound();
      _updateCompoundUI();
    });
  });
  document.querySelectorAll('.ed-rramptype-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _rrampType = +btn.dataset.rtype;
      if (_typeMode === 'rramp') _computeToolFromCompound();
      _updateCompoundUI();
    });
  });
  document.querySelectorAll('.ed-bramptype-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _brampType = +btn.dataset.btype;
      if (_typeMode === 'bramp') _computeToolFromCompound();
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
    _floors  = _blankFloors();  // blankFloors already includes blank swallBits
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

  // ── New tool buttons ─────────────────────────────────────────────────
  document.getElementById('ed-fill')?.addEventListener('click', () => {
    _fillMode = !_fillMode; if (_fillMode) _rectMode = false; _updateModeButtons();
  });
  document.getElementById('ed-rect')?.addEventListener('click', () => {
    _rectMode = !_rectMode; if (_rectMode) _fillMode = false; _updateModeButtons();
  });
  document.getElementById('ed-mirror')?.addEventListener('click', () => {
    _mirrorMode = (_mirrorMode + 1) % 4; _updateMirrorBtn();
  });

  // ── Save slots ───────────────────────────────────────────────────────
  document.querySelectorAll('.ed-slot-btn').forEach(btn => {
    btn.addEventListener('click', () => _loadFromSlot(+btn.dataset.slot));
  });
  document.querySelectorAll('.ed-slot-btn').forEach(btn => {
    btn.addEventListener('dblclick', () => _saveToSlot(+btn.dataset.slot));
  });

  // ── Map name field ───────────────────────────────────────────────────
  const _nameField = document.getElementById('ed-map-name');
  if (_nameField) _nameField.addEventListener('input', () => { _mapName = _nameField.value; });

  _updateSlotUI();
  _updateMirrorBtn();
  _updateModeButtons();

  // ── Keyboard shortcuts ───────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (_inPreview && (e.code === 'KeyP' || e.code === 'Escape')) {
      exitEditorPreview();
      return;
    }
    const overlay = document.getElementById('editor-overlay');
    if (!overlay || overlay.style.display === 'none') return;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); _doUndo(); }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') { e.preventDefault(); _saveToSlot(_activeSlot >= 0 ? _activeSlot : 0); }
    const _kd = parseInt(e.code.replace('Digit', ''));
    if ((e.ctrlKey || e.metaKey) && _kd >= 1 && _kd <= SLOT_COUNT) { e.preventDefault(); _saveToSlot(_kd - 1); }
    if (e.code === 'KeyP' && !e.ctrlKey) _preview();
    if (e.code === 'KeyR' && !e.ctrlKey) _rotateTool();
    if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey) { _fillMode = !_fillMode; if (_fillMode) _rectMode = false; _updateModeButtons(); }
    if (e.code === 'KeyX' && !e.ctrlKey && !e.metaKey) { _rectMode = !_rectMode; if (_rectMode) _fillMode = false; _updateModeButtons(); }
    if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey) { _mirrorMode = (_mirrorMode + 1) % 4; _updateMirrorBtn(); }
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
