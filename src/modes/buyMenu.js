import { WEAPONS } from '../config.js';
import { player } from '../entities/player.js';
import { show1pWeapon, show3pWeapon } from '../builders/weapon.js';
import { updateHUD } from '../hud/overlay.js';
import { getCash, canAfford, spendCash } from './economy.js';
import { on } from '../events.js';

let _active    = false;
let _timer     = 0;
let _panelOpen = false;
let _domReady  = false;

// ── DOM ───────────────────────────────────────────────────────────────────

function _buildDOM() {
  if (_domReady) return;
  _domReady = true;

  const banner = document.createElement('div');
  banner.id = 'buy-banner';
  banner.innerHTML =
    '<span class="buy-label">BUY PHASE</span>' +
    '<span id="buy-cd">10</span>s' +
    '<span id="buy-cash-hud">$800</span>' +
    '<span class="buy-hint">[1/2/3] BUY  [B] SHOP</span>';
  banner.style.display = 'none';
  document.body.appendChild(banner);

  const panel = document.createElement('div');
  panel.id = 'buy-panel';
  panel.style.display = 'none';
  panel.innerHTML =
    '<div id="buy-ph">' +
      '<span class="buy-pt">SHOP</span>' +
      '<span id="buy-pcash">$800</span>' +
      '<span class="buy-phint">[B / ESC] CLOSE</span>' +
    '</div>' +
    '<div id="buy-rows"></div>';
  panel.addEventListener('mousedown', (e) => e.stopPropagation());
  document.body.appendChild(panel);

  _buildRows();

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && _panelOpen) _closePanel();
  });

  on('economy:updated', (cash) => {
    const fmt = `$${cash.toLocaleString()}`;
    const h = document.getElementById('buy-cash-hud');
    const p = document.getElementById('buy-pcash');
    if (h) h.textContent = fmt;
    if (p) p.textContent = fmt;
    if (_panelOpen) _refreshRows();
  });
}

const _ITEMS = [
  { sep: 'RIFLES' },   { key: 'm4',  bind: '1' },
  { sep: 'SMGs' },     { key: 'p90', bind: '2' },
  { sep: 'SNIPERS' },  { key: 'awp', bind: '3' },
];

function _buildRows() {
  const c = document.getElementById('buy-rows');
  if (!c) return;
  c.innerHTML = '';
  for (const item of _ITEMS) {
    if (item.sep) {
      const h = document.createElement('div');
      h.className = 'buy-sep';
      h.textContent = `── ${item.sep} ──`;
      c.appendChild(h);
      continue;
    }
    const w = WEAPONS[item.key];
    const row = document.createElement('div');
    row.className = 'buy-row';
    row.dataset.key = item.key;
    row.innerHTML =
      `<span class="buy-wbind">[${item.bind}]</span>` +
      `<span class="buy-wname">${w.name}</span>` +
      `<span class="buy-wprice">$${w.price.toLocaleString()}</span>`;
    row.addEventListener('click', () => _buy(item.key));
    c.appendChild(row);
  }
}

function _refreshRows() {
  document.querySelectorAll('.buy-row').forEach(row => {
    const key = row.dataset.key;
    const owned = player.weapon === key;
    const poor  = !canAfford(WEAPONS[key].price);
    row.classList.toggle('buy-owned', owned);
    row.classList.toggle('buy-poor',  poor && !owned);
  });
}

// ── Purchase ──────────────────────────────────────────────────────────────

function _buy(key) {
  if (!_active) return;
  const w = WEAPONS[key];
  if (!canAfford(w.price)) return;
  spendCash(w.price);
  player.weaponAmmo[player.weapon]    = WEAPONS[player.weapon].maxAmmo;
  player.weaponReserve[player.weapon] = WEAPONS[player.weapon].reserve;
  player.weapon  = key;
  player.ammo    = w.maxAmmo;
  player.reserve = w.reserve;
  player.weaponAmmo[key]    = w.maxAmmo;
  player.weaponReserve[key] = w.reserve;
  show1pWeapon(key);
  show3pWeapon(key);
  updateHUD();
  _closePanel();
}

// ── Panel open/close ──────────────────────────────────────────────────────

function _openPanel() {
  _panelOpen = true;
  document.exitPointerLock?.();
  const fmt = `$${getCash().toLocaleString()}`;
  const hh = document.getElementById('buy-cash-hud');
  const pp = document.getElementById('buy-pcash');
  if (hh) hh.textContent = fmt;
  if (pp) pp.textContent = fmt;
  _refreshRows();
  const p = document.getElementById('buy-panel');
  if (p) p.style.display = 'flex';
}

function _closePanel() {
  if (!_panelOpen) return;
  _panelOpen = false;
  const p = document.getElementById('buy-panel');
  if (p) p.style.display = 'none';
  if (_active) document.getElementById('c')?.requestPointerLock();
}

// ── Public API ────────────────────────────────────────────────────────────

export function startBuyPhase(duration = 10) {
  _buildDOM();
  _active    = true;
  _timer     = duration;
  _panelOpen = false;
  // Reset player to pistol
  player.weapon  = 'pistol';
  player.ammo    = WEAPONS.pistol.maxAmmo;
  player.reserve = WEAPONS.pistol.reserve;
  player.weaponAmmo    = { m4: WEAPONS.m4.maxAmmo, p90: WEAPONS.p90.maxAmmo, awp: WEAPONS.awp.maxAmmo, pistol: WEAPONS.pistol.maxAmmo };
  player.weaponReserve = { m4: WEAPONS.m4.reserve,  p90: WEAPONS.p90.reserve,  awp: WEAPONS.awp.reserve,  pistol: WEAPONS.pistol.reserve };
  show1pWeapon('pistol');
  show3pWeapon('pistol');
  updateHUD();
  const b = document.getElementById('buy-banner');
  if (b) { b.style.display = 'flex'; _tick_banner(); }
}

function _tick_banner() {
  const el = document.getElementById('buy-cd');
  if (el) el.textContent = Math.max(0, Math.ceil(_timer));
}

export function tickBuyPhase(dt) {
  if (!_active) return;
  _timer -= dt;
  _tick_banner();
  if (_timer <= 0) endBuyPhase();
}

export function endBuyPhase() {
  if (!_active) return;
  _active = false;
  _closePanel();
  const b = document.getElementById('buy-banner');
  if (b) b.style.display = 'none';
}

export function toggleBuyPanel() {
  if (!_active) return;
  _panelOpen ? _closePanel() : _openPanel();
}

export function isBuyPhaseActive() { return _active; }
export function isBuyPanelOpen()   { return _panelOpen; }

export function buyWeapon(key) {
  if (!_active) return false;
  _buy(key);
  return true;
}
