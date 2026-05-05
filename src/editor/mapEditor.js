import { CELL, PLAYER_H } from '../config.js';
import { matFloor, matWall, matWallD, matWallT, matCrack, matTrim, matRamp } from '../materials.js';
import { camera } from '../scene.js';
import { setActiveMap } from '../map.js';
import { buildLevel, clearLevel } from '../level.js';
import { setGameRunning } from '../input.js';
import { deactivateAllEnemies } from '../entities/enemies.js';

const GRID_W = 24, GRID_H = 24;

// Tool descriptor tables
const TILE_TOOLS = [
  { id: 0, label: 'Floor',   color: '#1a1a1a' },
  { id: 1, label: 'Wall',    color: '#5c4e3e' },
  { id: 2, label: 'Crack-H', color: '#2a5578' },
  { id: 3, label: 'Crack-V', color: '#1e4a66' },
  { id: 4, label: 'Ramp N',  color: '#7a5c28' },
  { id: 5, label: 'Ramp S',  color: '#6a4c18' },
  { id: 6, label: 'Ramp W',  color: '#8a6c38' },
  { id: 7, label: 'Ramp E',  color: '#5a4008' },
];
const MARKER_TOOLS = [
  { id: 'spawn_p', label: 'Spawn P', color: '#2ecc71', letter: 'P' },
  { id: 'spawn_a', label: 'Attack',  color: '#e74c3c', letter: 'A' },
  { id: 'spawn_d', label: 'Defend',  color: '#3498db', letter: 'D' },
  { id: 'site_a',  label: 'Site A',  color: '#ff8800', letter: '①' },
  { id: 'site_b',  label: 'Site B',  color: '#ff6600', letter: '②' },
];
const _TILE_COLORS  = ['#1a1a1a','#5c4e3e','#2a5578','#1e4a66','#7a5c28','#6a4c18','#8a6c38','#5a4008'];
const _MARKER_COLOR = { spawn_p:'#2ecc71', spawn_a:'#e74c3c', spawn_d:'#3498db', site_a:'#ff8800', site_b:'#ff6600' };
const _MARKER_LETTER= { spawn_p:'P', spawn_a:'A', spawn_d:'D', site_a:'①', site_b:'②' };

let _tiles   = null;
let _markers = { spawn_p: null, spawn_a: null, spawn_d: null, site_a: null, site_b: null };
let _tool    = 0;        // number (tile) or string (marker key)
let _undo    = [];
let _painting = false;
let _paintBtn = 0;
let _inPreview = false;
let _canvas  = null;
let _ctx     = null;

// ── Grid factory ──────────────────────────────────────────────────────────
function _blankGrid() {
  return Array.from({ length: GRID_H }, (_, r) =>
    Array.from({ length: GRID_W }, (_, c) =>
      (r === 0 || r === GRID_H - 1 || c === 0 || c === GRID_W - 1) ? 1 : 0
    )
  );
}

// Arrow direction for each ramp tile: which side is the HIGH end
// 4=Ramp N → high at south (↓), 5=Ramp S → high at north (↑)
// 6=Ramp W → high at east  (→), 7=Ramp E → high at west  (←)
const _RAMP_ARROW = { 4: 'down', 5: 'up', 6: 'right', 7: 'left' };

function _drawRampArrow(c, r, cpx, cpy, dir) {
  const cx = (c + 0.5) * cpx, cy = (r + 0.5) * cpy;
  const hw = cpx * 0.28, hh = cpy * 0.28; // half-width / half-height of arrow head
  _ctx.fillStyle = 'rgba(255,255,255,0.7)';
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
      _ctx.fillStyle = _TILE_COLORS[tile] ?? '#111';
      _ctx.fillRect(c * cpx + 0.5, r * cpy + 0.5, cpx - 1, cpy - 1);
      if (_RAMP_ARROW[tile]) _drawRampArrow(c, r, cpx, cpy, _RAMP_ARROW[tile]);
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

  if (typeof _tool === 'string') {
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
  if (op.type === 'tile') _tiles[op.row][op.col] = op.from;
  else _markers[op.key] = op.from;
  _draw();
}

// ── Tool button selection ─────────────────────────────────────────────────
function _selectTool(raw) {
  _tool = isNaN(+raw) ? raw : +raw;
  document.querySelectorAll('.ed-tool').forEach(b => {
    b.classList.toggle('selected', (isNaN(+b.dataset.tile) ? b.dataset.tile : +b.dataset.tile) === _tool);
  });
}

// ── Export / Import ───────────────────────────────────────────────────────
function _encode() {
  const mk = (pos) => pos ? [pos.col, pos.row] : null;
  return btoa(JSON.stringify({
    w: GRID_W, h: GRID_H,
    t: _tiles.flat(),
    sp: mk(_markers.spawn_p), sa: mk(_markers.spawn_a),
    sd: mk(_markers.spawn_d), sA: mk(_markers.site_a), sB: mk(_markers.site_b),
  }));
}

function _decode(b64) {
  const d = JSON.parse(atob(b64));
  const w = d.w ?? 24, h = d.h ?? 24;
  _tiles = Array.from({ length: h }, (_, r) => d.t.slice(r * w, r * w + w));
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

  const { siteA, siteB } = { siteA: _markers.site_a, siteB: _markers.site_b };
  return {
    name: 'Custom Map',
    tiles: _tiles.map(row => [...row]),
    heightmap: Array.from({ length: GRID_H }, () => new Array(GRID_W).fill(0)),
    width: GRID_W, height: GRID_H,
    H1: 0.7, H2: 1.4,
    spawnPlayer:   toWorld(_markers.spawn_p),
    spawnAttacker: toWorld(_markers.spawn_a),
    spawnDefender: toWorld(_markers.spawn_d),
    sites: [
      ...(siteA ? [{ id: 'A', x: siteA.col * CELL + CELL / 2, z: siteA.row * CELL + CELL / 2 }] : []),
      ...(siteB ? [{ id: 'B', x: siteB.col * CELL + CELL / 2, z: siteB.row * CELL + CELL / 2 }] : []),
    ],
    fog: { color: 0x2a3a4a, density: 0.010 },
    skyColor: 0x4a6070,
    wallHeight: 3,
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
}

export function closeEditor() {
  if (_inPreview) exitEditorPreview();
  document.getElementById('editor-overlay').style.display = 'none';
  document.getElementById('overlay').style.display = 'flex';
}

export function isEditorPreview() { return _inPreview; }

export function initEditor() {
  _tiles   = _blankGrid();
  _markers = { spawn_p: null, spawn_a: null, spawn_d: null, site_a: null, site_b: null };

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
    const st = document.getElementById('ed-status');
    if (st) st.textContent = `col ${col}  row ${row}  tile ${_tiles[row][col]}`;
  });
  _canvas.addEventListener('mouseup',    () => { _painting = false; });
  _canvas.addEventListener('mouseleave', () => { _painting = false; });

  // ── Toolbar buttons ──────────────────────────────────────────────────
  document.querySelectorAll('.ed-tool').forEach(btn => {
    btn.addEventListener('click', () => _selectTool(btn.dataset.tile));
  });

  // ── Action buttons ───────────────────────────────────────────────────
  document.getElementById('ed-undo').addEventListener('click', _doUndo);

  document.getElementById('ed-clear').addEventListener('click', () => {
    _tiles   = _blankGrid();
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
    // Mirror to URL bar without reloading
    const url = new URL(window.location.href);
    url.searchParams.set('map', b64);
    window.history.replaceState(null, '', url.toString());
  });

  document.getElementById('ed-import-btn').addEventListener('click', () => {
    const v = document.getElementById('ed-share-field').value.trim();
    if (v) { try { _decode(v); } catch (_) { alert('Invalid map data.'); } }
  });

  document.getElementById('ed-back').addEventListener('click', closeEditor);

  // ── Keyboard shortcuts (active when editor overlay visible or previewing) ──
  document.addEventListener('keydown', e => {
    // Exit preview
    if (_inPreview && (e.code === 'KeyP' || e.code === 'Escape')) {
      exitEditorPreview();
      return;
    }
    const overlay = document.getElementById('editor-overlay');
    if (!overlay || overlay.style.display === 'none') return;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); _doUndo(); }
    if (e.code === 'KeyP') _preview();
  });

  // ── URL map param ────────────────────────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  const mapParam = params.get('map');
  if (mapParam) {
    try {
      _decode(mapParam);
      // Auto-open editor when a map is in the URL
      requestAnimationFrame(() => openEditor());
    } catch (_) {}
  }

  _draw();
}
