// S&D HUD — all DOM manipulation for the match header, timers, bars, and result overlay.
// snd.js calls these; it stays a pure state machine with no direct DOM knowledge.

export function setSndHudVisible(v) {
  const el = document.getElementById('snd-bar');
  if (el) el.style.display = v ? 'block' : 'none';
}

export function updateMatchHUD(playerRole, matchRound, totalRounds, playerScore, enemyScore) {
  const role = document.getElementById('snd-role-label');
  if (role) {
    role.textContent = playerRole === 'attack' ? '⚔ ATTACK' : '🛡 DEFEND';
    role.style.color = playerRole === 'attack' ? '#e74c3c' : '#3498db';
  }
  const rnd = document.getElementById('snd-round-num');
  if (rnd) rnd.textContent = `ROUND ${matchRound}/${totalRounds}`;
  const ps = document.getElementById('snd-player-score');
  if (ps) ps.textContent = playerScore;
  const es = document.getElementById('snd-enemy-score');
  if (es) es.textContent = enemyScore;
}

export function updateRoundTimerHUD(t) {
  const el = document.getElementById('snd-round-timer');
  if (el) { el.textContent = Math.ceil(t) + 's'; el.style.color = t < 10 ? '#e74c3c' : '#e8c84a'; }
}

export function updateBombTimerHUD(remaining, total) {
  const timer = document.getElementById('snd-bomb-timer');
  if (timer) timer.textContent = Math.ceil(remaining) + 's';
  const fill = document.getElementById('snd-bomb-bar-fill');
  if (fill) fill.style.width = (remaining / total * 100) + '%';
}

export function showBombBarWrap() {
  const el = document.getElementById('snd-bomb-bar-wrap');
  if (el) el.style.display = 'flex';
}

export function hideBombBarWrap() {
  const el = document.getElementById('snd-bomb-bar-wrap');
  if (el) el.style.display = 'none';
}

export function updatePlantBar(pct) {
  const wrap = document.getElementById('snd-plant-bar-wrap');
  if (wrap) wrap.style.display = 'flex';
  const fill = document.getElementById('snd-plant-fill');
  if (fill) fill.style.width = (pct * 100) + '%';
}

export function hidePlantBar() {
  const el = document.getElementById('snd-plant-bar-wrap');
  if (el) el.style.display = 'none';
}

export function updateDefuseBar(pct) {
  const wrap = document.getElementById('snd-defuse-bar-wrap');
  if (wrap) wrap.style.display = pct > 0.01 ? 'flex' : 'none';
  const fill = document.getElementById('snd-defuse-fill');
  if (fill) fill.style.width = (pct * 100) + '%';
}

export function hideDefuseBar() {
  const el = document.getElementById('snd-defuse-bar-wrap');
  if (el) el.style.display = 'none';
}

export function showPlantHint(txt) {
  const el = document.getElementById('snd-plant-hint');
  if (el) { el.textContent = txt; el.style.opacity = '1'; }
}

export function hidePlantHint() {
  const el = document.getElementById('snd-plant-hint');
  if (el) el.style.opacity = '0';
}

export function showSndResult(title, sub, color, matchOver) {
  const el = document.getElementById('snd-result');
  if (!el) return;
  document.getElementById('snd-result-title').textContent = title;
  document.getElementById('snd-result-title').style.color = color;
  document.getElementById('snd-result-sub').textContent  = sub;
  const btn = document.getElementById('snd-next-btn');
  if (btn) btn.textContent = matchOver ? '[ PLAY AGAIN ]' : '[ NEXT ROUND ]';
  el.style.display = 'flex';
}

export function hideSndResult() {
  const el = document.getElementById('snd-result');
  if (el) el.style.display = 'none';
}
