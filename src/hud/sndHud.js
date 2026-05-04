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

export function showSndResult(title, sub, color, matchOver, dmgStats = null) {
  const el = document.getElementById('snd-result');
  if (!el) return;
  document.getElementById('snd-result-title').textContent = title;
  document.getElementById('snd-result-title').style.color = color;
  document.getElementById('snd-result-sub').textContent  = sub;
  const btn = document.getElementById('snd-next-btn');
  if (btn) btn.textContent = matchOver ? '[ PLAY AGAIN ]' : '[ NEXT ROUND ]';
  _renderDmgPanel(dmgStats, matchOver);
  el.style.display = 'flex';
}

function _renderDmgPanel(dmgStats, matchOver) {
  const panel = document.getElementById('snd-dmg-panel');
  if (!panel || !dmgStats) { if (panel) panel.innerHTML = ''; return; }
  const { summary, rounds } = dmgStats;
  const { player: pd, ally: ad, enemy: ed } = summary;

  let html = '<div class="dmg-panel-title">DAMAGE DEALT</div>';
  html += '<div class="dmg-row"><span class="dmg-src dmg-you">YOU</span>'
    + `<span class="dmg-bar-wrap"><span class="dmg-bar dmg-bar-you" style="width:${_pct(pd, pd+ad+ed)}%"></span></span>`
    + `<span class="dmg-num">${pd}</span></div>`;
  html += '<div class="dmg-row"><span class="dmg-src dmg-ally">ALLIES</span>'
    + `<span class="dmg-bar-wrap"><span class="dmg-bar dmg-bar-ally" style="width:${_pct(ad, pd+ad+ed)}%"></span></span>`
    + `<span class="dmg-num">${ad}</span></div>`;
  html += '<div class="dmg-row"><span class="dmg-src dmg-enemy">ENEMIES</span>'
    + `<span class="dmg-bar-wrap"><span class="dmg-bar dmg-bar-enemy" style="width:${_pct(ed, pd+ad+ed)}%"></span></span>`
    + `<span class="dmg-num">${ed}</span></div>`;

  if (matchOver && rounds.length > 1) {
    html += '<div class="dmg-panel-title dmg-rounds-title">PER ROUND</div>';
    html += '<div class="dmg-rounds-header"><span>RND</span><span>YOU</span><span>ALLIES</span><span>ENEMIES</span></div>';
    for (let i = 0; i < rounds.length; i++) {
      const r = rounds[i];
      html += `<div class="dmg-round-row"><span>${i + 1}</span><span>${r.player}</span><span>${r.ally}</span><span>${r.enemy}</span></div>`;
    }
  }

  panel.innerHTML = html;
}

function _pct(val, total) {
  return total > 0 ? Math.round((val / total) * 100) : 0;
}

export function hideSndResult() {
  const el = document.getElementById('snd-result');
  if (el) el.style.display = 'none';
}
