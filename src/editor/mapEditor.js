import { CELL, PLAYER_H } from '../config.js';
import { matFloor, matWall, matWallD, matWallT, matCrack, matTrim, matRamp } from '../materials.js';
import { camera } from '../scene.js';
import { setActiveMap } from '../map.js';
import { buildLevel, clearLevel } from '../level.js';
import { setGameRunning } from '../input.js';
import { deactivateAllEnemies } from '../entities/enemies.js';

const GRID_W = 24, GRID_H = 24;
const FLOOR1 = 3.0, FLOOR2 = 6.0;

// Height tool identifiers and values (floor painting sets tile=0 + heightmap)
// Floor fractions: F½ = FLOOR1/2 = 1.5 m, F1½ = (FLOOR1+FLOOR2)/2 = 4.5 m
const _HEIGHT_TOOLS = new Set(['h0', 'hF05', 'h1', 'hF15', 'h2']);
const _HEIGHT_VAL   = { h0: 0, hF05: FLOOR1 / 2, h1: FLOOR1, hF15: (FLOOR1 + FLOOR2) / 2, h2: FLOOR2 };

const _MARKER_COLOR  = { spawn_p:'#2ecc71', spawn_a:'#e74c3c', spawn_d:'#3498db', site_a:'#ff8800', site_b:'#ff6600' };
const _MARKER_LETTER = { spawn_p:'P', spawn_a:'A', spawn_d:'D', site_a:'①', site_b:'②' };

// Per-group canvas colors for ramp tiles (group = Math.floor((tile-4)/4))
const _RAMP_GROUP_COLOR = ['#7a5c28','#c8901a','#3e2c10','#503c1e','#604c2e','#706040'];

function _getTileColor(tile) {
  if (tile === 0) return '#1a1a1a';
  if (tile === 1) return '#5c4e3e';
  if (tile === 2) return '#2a5578';
  if (tile === 3) return '#1e4a66';
  if (tile >= 4 && tile <= 27) return _RAMP_GROUP_COLOR[Math.floor((tile - 4) / 4)] ?? '#7a5c28';
  return '#111';
}

function _heightLabel(h) {
  if (!h) return '';
  if (h >= FLOOR2) return 'F2';
  if (h >= (FLOOR1 + FLOOR2) / 2) return 'F1½';
  if (h >= FLOOR1) return 'F1';
  if (h >= FLOOR1 / 2) return 'F½';
  return '?';
}

function _heightTint(h) {
  if (h >= FLOOR2) return 'rgba(200,160,50,0.52)';
  if (h >= FLOOR1) return 'rgba(160,120,30,0.44)';
  if (h >= 2.0)    return 'rgba(130,100,25,0.36)';
  if (h >= 1.5)    return 'rgba(110,84,20,0.30)';
  if (h >= 1.0)    return 'rgba(90,70,15,0.26)';
  return 'rgba(70,55,10,0.20)';
}

let _tiles     = null;
let _heightmap = null;
let _markers   = { spawn_p: null, spawn_a: null, spawn_d: null, site_a: null, site_b: null };
let _tool      = 'h0';   // current active tool (number = tile id, string = height/marker key)
let _undo      = [];
let _painting  = false;
let _paintBtn  = 0;
let _inPreview = false;
let _canvas    = null;
let _ctx       = null;

// Compound toolbar state
let _typeMode  = 'floor';  // 'floor' | 'ramp' | 'wall' | 'column' | 'crack'
let _rampDir   = 0;         // 0=N 1=S 2=W 3=E
let _rampRange = 0;         // 0-5 → ramp tile groups
let _crackTile = 2;         // 2=H 3=V
let _floorHKey = 'h0';      // active height key

// ── Grid factories ────────────────────────────────────────────────────────
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

// ── Canvas helpers ────────────────────────────────────────────────────────
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

// ── Canvas drawing ────────────────────────────────────────────────────────
function _draw() {
  if (!_ctx) return;
  const cw = _canvas.width, ch = _canvas.height;
  const cpx = cw / GRID_W, cpy = ch / GRID_H;
  _ctx.clearRect(0, 0, cw, ch);

  // Tiles
  for (let r = 0; r < GRID_H; r++) {
    for (let c = 0; c < GRID_W; c++) {
      const tile = _tiles[r][c];
      _ctx.fillStyle = _getTileColor(tile);
      _ctx.fillRect(c * cpx + 0.5, r * cpy + 0.5, cpx - 1, cpy - 1);
      if (tile >= 4 && tile <= 27) {
        const dir = (tile - 4) % 4;
        _drawRampArrow(c, r, cpx, cpy, ['down','up','right','left'][dir]);
      }
      // Isolated wall tile → renders as column in 3D; show as circle here
      if (tile === 1) {
        const above = r > 0 ? _tiles[r-1][c] : 1;
        const below = r < GRID_H-1 ? _tiles[r+1][c] : 1;
        const left  = c > 0 ? _tiles[r][c-1] : 1;
        const right = c < GRID_W-1 ? _tiles[r][c+1] : 1;
        if (above === 0 && below === 0 && left === 0 && right === 0) {
          _ctx.fillStyle = '#a07850';
          _ctx.beginPath();
          _ctx.arc((c + 0.5) * cpx, (r + 0.5) * cpy, Math.min(cpx, cpy) * 0.36, 0, Math.PI * 2);
          _ctx.fill();
        }
      }
    }
  }

  // Height overlay — tint floor cells that have elevated heightmap values
  _ctx.textAlign = 'right';
  _ctx.textBaseline = 'top';
  for (let r = 0; r < GRID_H; r++) {
    for (let c = 0; c < GRID_W; c++) {
      const h = _heightmap[r][c];
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

  // Markers
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

// ── Cell hit-test ─────────────────────────────────────────────────────────
function _cellAt(e) {
  const rect = _canvas.getBoundingClientRect();
  const col = Math.floor((e.clientX - rect.left) / rect.width  * GRID_W);
  const row = Math.floor((e.clientY - rect.top)  / rect.height * GRID_H);
  return {
    col: Math.max(0, Math.min(GRID_W - 1, col)),
    row: Math.max(0, Math.min(GRID_H - 1, row)),
  };
}

// ── Paint logic ───────────────────────────────────────────────────────────
function _paint(e) {
  const { col, row } = _cellAt(e);
  const erase = _paintBtn === 2;

  if (_HEIGHT_TOOLS.has(_tool)) {
    // Floor painting: clears tile to 0 and sets heightmap
    const nextH = erase ? 0 : _HEIGHT_VAL[_tool];
    const prevH = _heightmap[row][col];
    const prevT = _tiles[row][col];
    if (prevH === nextH && prevT === 0) return;
    _undoPush({ type: 'cell', row, col, fromT: prevT, toT: 0, fromH: prevH, toH: nextH });
    _heightmap[row][col] = nextH;
    _tiles[row][col] = 0;
  } else if (typeof _tool === 'string') {
    // Marker placement
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
    // Tile painting (ramp, wall, crack)
    const next = erase ? 0 : _tool;
    const prev = _tiles[row][col];
    if (prev === next) return;
    _undoPush({ type: 'tile', row, col, from: prev, to: next });
    _tiles[row][col] = next;
  }
  _draw();
}

function _undoPush(op) {
  _undo.push(op);
  if (_undo.length > 50) _undo.shift();
}

function _doUndo() {
  if (!_undo.length) return;
  const op = _undo.pop();
  if (op.type === 'tile') {
    _tiles[op.row][op.col] = op.from;
  } else if (op.type === 'cell') {
    _tiles[op.row][op.col] = op.fromT;
    _heightmap[op.row][op.col] = op.fromH;
  } else if (op.type === 'height') {
    _heightmap[op.row][op.col] = op.from; // legacy
  } else {
    _markers[op.key] = op.from;
  }
  _draw();
}

// ── Compound toolbar state → _tool ───────────────────────────────────────
function _computeToolFromCompound() {
  switch (_typeMode) {
    case 'floor':  _tool = _floorHKey; break;
    case 'ramp':   _tool = 4 + _rampRange * 4 + _rampDir; break;
    case 'wall':   _tool = 1; break;
    case 'column': _tool = 1; break;  // column = isolated wall tile (auto-detected in 3D)
    case 'crack':  _tool = _crackTile; break;
  }
}

function _updateCompoundUI() {
  document.getElementById('ed-floor-sub').style.display = _typeMode === 'floor'  ? '' : 'none';
  document.getElementById('ed-ramp-sub').style.display  = _typeMode === 'ramp'   ? '' : 'none';
  document.getElementById('ed-crack-sub').style.display = _typeMode === 'crack'  ? '' : 'none';
  document.querySelectorAll('.ed-type-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.type === _typeMode));
  document.querySelectorAll('.ed-sublvl-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.h === _floorHKey));
  document.querySelectorAll('.ed-subfacing-btn').forEach(b =>
    b.classList.toggle('selected', +b.dataset.dir === _rampDir));
  document.querySelectorAll('.ed-subrange-btn').forEach(b =>
    b.classList.toggle('selected', +b.dataset.range === _rampRange));
  document.querySelectorAll('.ed-subcrack-btn').forEach(b =>
    b.classList.toggle('selected', +b.dataset.crack === _crackTile));
  // Clear marker tool selection when a build type is active
  document.querySelectorAll('.ed-tool').forEach(b => b.classList.remove('selected'));
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
    _computeToolFromCompound();
    _updateCompoundUI();
  } else if (_typeMode === 'crack') {
    _crackTile = _crackTile === 2 ? 3 : 2;
    _computeToolFromCompound();
    _updateCompoundUI();
  }
}

// ── Export / Import ───────────────────────────────────────────────────────
function _encode() {
  const mk = (pos) => pos ? [pos.col, pos.row] : null;
  return btoa(JSON.stringify({
    w: GRID_W, h: GRID_H,
    t: _tiles.flat(),
    hm: _heightmap.flat(),
    sp: mk(_markers.spawn_p), sa: mk(_markers.spawn_a),
    sd: mk(_markers.spawn_d), sA: mk(_markers.site_a), sB: mk(_markers.site_b),
  }));
}

function _decode(b64) {
  const d = JSON.parse(atob(b64));
  const w = d.w ?? 24, h = d.h ?? 24;
  _tiles = Array.from({ length: h }, (_, r) => d.t.slice(r * w, r * w + w));
  _heightmap = d.hm
    ? Array.from({ length: h }, (_, r) => d.hm.slice(r * w, r * w + w))
    : _blankHeightmap();
  const mk = (arr) => arr ? { col: arr[0], row: arr[1] } : null;
  _markers = { spawn_p: mk(d.sp), spawn_a: mk(d.sa), spawn_d: mk(d.sd), site_a: mk(d.sA), site_b: mk(d.sB) };
  _undo = [];
  _draw();
}

// ── 3D Preview ────────────────────────────────────────────────────────────
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

// ── mapDef builder ────────────────────────────────────────────────────────
function _buildMapDef() {
  const cx = (GRID_W / 2) * CELL + CELL / 2;
  const cz = (GRID_H / 2) * CELL + CELL / 2;
  const toWorld = (pos) => pos
    ? { x: pos.col * CELL + CELL / 2, z: pos.row * CELL + CELL / 2 }
    : { x: cx, z: cz };

  const siteA = _markers.site_a, siteB = _markers.site_b;
  return {
    name: 'Custom Map',
    tiles:     _tiles.map(row => [...row]),
    heightmap: _heightmap.map(row => [...row]),
    width: GRID_W, height: GRID_H,
    H1: FLOOR1 / 2, H2: FLOOR1,   // ramps go 0 → Floor 1 (3 m)
    spawnPlayer:   toWorld(_markers.spawn_p),
    spawnAttacker: toWorld(_markers.spawn_a),
    spawnDefender: toWorld(_markers.spawn_d),
    sites: [
      ...(siteA ? [{ id: 'A', x: siteA.col * CELL + CELL / 2, z: siteA.row * CELL + CELL / 2 }] : []),
      ...(siteB ? [{ id: 'B', x: siteB.col * CELL + CELL / 2, z: siteB.row * CELL + CELL / 2 }] : []),
    ],
    fog: { color: 0x2a3a4a, density: 0.010 },
    skyColor: 0x4a6070,
    wallHeight: 3.5,  // slightly taller than 1 storey — cover from ground, open to Floor 1
    showRubble: false,
    materials: {
      floor: matFloor, wall: matWall, wallDark: matWallD,
      wallTop: matWallT, crack: matCrack, trim: matTrim, ramp: matRamp,
    },
    buildExtras(_scene, tl) { tl.length = 0; },
  };
}

// ── Public API ────────────────────────────────────────────────────────────
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
  _tiles     = _blankGrid();
  _heightmap = _blankHeightmap();
  _markers   = { spawn_p: null, spawn_a: null, spawn_d: null, site_a: null, site_b: null };
  _typeMode  = 'floor';
  _rampDir   = 0;
  _rampRange = 0;
  _crackTile = 2;
  _floorHKey = 'h0';   // h0=Gnd, hF05=F½(1.5m), h1=F1(3m), hF15=F1½(4.5m), h2=F2(6m)
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
    const h = _heightmap[row][col];
    const t = _tiles[row][col];
    const isColumn = t === 1 &&
      (row > 0 ? _tiles[row-1][col] : 1) === 0 &&
      (row < GRID_H-1 ? _tiles[row+1][col] : 1) === 0 &&
      (col > 0 ? _tiles[row][col-1] : 1) === 0 &&
      (col < GRID_W-1 ? _tiles[row][col+1] : 1) === 0;
    const tDesc = t >= 4 && t <= 27
      ? `ramp-${['N','S','W','E'][(t-4)%4]} [${['0→F1','F1→F2','0→F½','F½→F1','F1→F1½','F1½→F2'][Math.floor((t-4)/4)]}]`
      : isColumn ? 'column' : ['floor','wall','crack-H','crack-V'][t] ?? `tile${t}`;
    const st = document.getElementById('ed-status');
    if (st) st.textContent = `col ${col}  row ${row}  ${tDesc}  h=${h ? h.toFixed(1) : '0'}m`;
  });
  _canvas.addEventListener('mouseup',    () => { _painting = false; });
  _canvas.addEventListener('mouseleave', () => { _painting = false; });

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
      if (_typeMode === 'floor') { _computeToolFromCompound(); }
      _updateCompoundUI();
    });
  });
  document.querySelectorAll('.ed-subfacing-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _rampDir = +btn.dataset.dir;
      if (_typeMode === 'ramp') { _computeToolFromCompound(); }
      _updateCompoundUI();
    });
  });
  document.querySelectorAll('.ed-subrange-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _rampRange = +btn.dataset.range;
      if (_typeMode === 'ramp') { _computeToolFromCompound(); }
      _updateCompoundUI();
    });
  });
  document.querySelectorAll('.ed-subcrack-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _crackTile = +btn.dataset.crack;
      if (_typeMode === 'crack') { _computeToolFromCompound(); }
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
    _tiles     = _blankGrid();
    _heightmap = _blankHeightmap();
    _markers   = { spawn_p: null, spawn_a: null, spawn_d: null, site_a: null, site_b: null };
    _undo      = [];
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
