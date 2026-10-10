import { test, expect } from '@playwright/test';
import { startMpFixture } from './helpers/mpServer.js';
import { MOUSE_SENS, PLAYER_H, PLAYER_H_CROUCH } from '../src/config.js';
import { encode } from '@colyseus/schema';
import { Protocol } from '@colyseus/shared-types';
import { Packr, RESERVE_START_SPACE } from 'msgpackr';

// Continuous WebGL screenshots delay keyboard release on software-rendered runners.
// Keep the action/network trace; capture explicit gameplay evidence below.
test.use({ trace: { mode: 'retain-on-failure', screenshots: false, snapshots: false } });

test('teams: solo start and smaller-team assignments are visible in both browsers', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const fixture = await startMpFixture({
    testSettings: { killLimit: 7, matchSeconds: 120, respawnSeconds: 2, friendlyFire: 0.5 },
  });
  const contexts = [];
  try {
    for (let i = 0; i < 2; i++)
      contexts.push(
        await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 0.25 })
      );
    const [a, b] = await Promise.all(contexts.map((c) => c.newPage()));
    await a.goto(fixture.url);
    await expect(a.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
    await a.locator('#mp-join-btn').click();
    await expect.poll(async () => (await snapshot(a)).phase).toBe('active');
    const solo = await snapshot(a);
    expect(solo.players).toHaveLength(1);
    expect(solo.players[0]).toMatchObject({ team: 'blue', joinOrdinal: 1, nickname: 'Guest-1' });
    expect(solo.settings).toEqual({
      killLimit: 7,
      matchSeconds: 120,
      respawnSeconds: 2,
      friendlyFire: 0.5,
      resultsSeconds: 15,
    });
    await expect(a.locator('#tdm-label')).toHaveText('ONLINE · BLUE');
    await expect(a.locator('#mp-switch-team')).toBeDisabled();
    await b.goto(fixture.url);
    await expect(b.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
    await b.locator('#mp-join-btn').click();
    for (const page of [a, b]) {
      await expect.poll(async () => (await snapshot(page)).players.length).toBe(2);
      expect((await snapshot(page)).players.map((p) => [p.team, p.joinOrdinal])).toEqual([
        ['blue', 1],
        ['red', 2],
      ]);
      await expect(page.locator('#mp-switch-team')).toBeDisabled();
      await expect(page.locator('#tdm-us')).toHaveText('0');
      await expect(page.locator('#tdm-them')).toHaveText('0');
    }
    await expect(b.locator('#tdm-label')).toHaveText('ONLINE · RED');
    expect((await snapshot(a)).timeRemaining).toBeLessThan(solo.timeRemaining);
    for (const page of [a, b]) {
      const controls = await page.locator('#mp-match-controls').boundingBox();
      const ammo = await page.locator('#ammo-display').boundingBox();
      expect(controls).toBeTruthy();
      expect(ammo).toBeTruthy();
      expect(controls.y + controls.height).toBeLessThanOrEqual(ammo.y - 8);
    }
    await b.evaluate(() => document.exitPointerLock());
    await expect(b.locator('#mp-resume')).toBeVisible();
    await expect(b.locator('#pause-title')).toHaveText('MOUSE RELEASED');
    await expect(b.locator('#pause-online-hint')).toBeVisible();
    await b.evaluate(() => {
      document.getElementById('c').requestPointerLock = () => Promise.reject(new Error('test capture denied'));
    });
    await b.locator('#mp-resume').click();
    await expect(b.locator('#mp-input-message')).toContainText('Select Resume to retry');
    await expect(b.locator('#mp-error-banner')).toBeHidden();
    expect((await snapshot(b)).phase).toBe('active');
    await a.screenshot({ path: test.info().outputPath('teams.png') });
  } finally {
    try {
      await Promise.all(contexts.map((c) => c.close()));
    } finally {
      await fixture.stop();
    }
  }
});

for (const path of ['score', 'time'])
  test(`${path === 'score' ? 'resources: ' : ''}lifecycle: two browsers complete ${path}-limit results and automatic same-settings rematch`, async ({
    browser,
  }) => {
    test.setTimeout(240000);
    const fixture = await startMpFixture({
      testSettings: {
        killLimit: path === 'score' ? 2 : 50,
        matchSeconds: path === 'score' ? 180 : 6,
        respawnSeconds: 5,
        friendlyFire: 0.25,
      },
      env: { VOD_COMBAT_SEED: '7' },
    });
    const contexts = [];
    try {
      for (let i = 0; i < 2; i++)
        contexts.push(
          await browser.newContext({
            viewport: { width: 800, height: 600 },
            deviceScaleFactor: 0.25,
          })
        );
      const [a, b] = await Promise.all(contexts.map((c) => c.newPage()));
      for (const page of [a, b]) {
        await page.goto(fixture.url);
        await expect(page.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
        await page.locator('#kills-num').evaluate((counter) => { counter.textContent = '99'; });
        await page.locator('#mp-join-btn').click();
        await expect.poll(async () => (await snapshot(page)).sessionId).toBeTruthy();
        await expect(page.locator('#kills-num')).toHaveText('0');
        expect((await snapshot(page)).presentation.kills).toBe(0);
      }
      await expect.poll(async () => (await snapshot(a)).players.length).toBe(2);
      const first = await snapshot(a),
        targetId = (await snapshot(b)).sessionId;
      if (path === 'score') {
        expectHumanArt(await humanArtState(a));
        expectHumanArt(await humanArtState(b));
      }
      const own = (s, id) => s.players.find((p) => p.sessionId === id);
      if (path === 'score') {
        await aimAt(a, null);
        await walkTo(a, first.sessionId, 62, 46);
        await walkTo(a, first.sessionId, 62, 22);
        await walkTo(a, first.sessionId, 34, 22);
        await walkTo(a, first.sessionId, 34, 46);
        await aimAt(a, targetId);
        // Observe every server snapshot, so short death/respawn transitions survive runner scheduling.
        await b.evaluate(() => {
          const seen = { dead: false, life: 0, freshInventory: false };
          window.__lifecycleSeen = () => ({ ...seen });
          setInterval(() => {
            const s = window.__mpDebug(),
              me = s.players.find((p) => p.sessionId === s.sessionId);
            if (!me) return;
            if (!me.alive) seen.dead = true;
            seen.life = Math.max(seen.life, me.lifeGeneration);
            if (
              me.lifeGeneration === 2 &&
              me.alive &&
              me.ammo === 30 &&
              me.reserve === 90 &&
              me.health === 100
            )
              seen.freshInventory = true;
          }, 10);
        });
        await a.mouse.down();
        try {
          await expect
            .poll(async () => own(await snapshot(b), targetId).alive, { timeout: 8000 })
            .toBe(false);
        } finally {
          await a.mouse.up();
        }
        await expect(b.locator('#mp-switch-team')).toBeDisabled();
        await expect(b.locator('#mp-respawn')).toContainText('Respawn in');
        await expect.poll(async () => (await snapshot(a)).remoteActors[0]?.clip).toBe('death_front');
        await b.screenshot({path:test.info().outputPath('death-respawn-timer.png')});
        // Two balanced members cannot become0v2, including at death.
        await expect(b.locator('#mp-team-rejection')).toContainText('teams must stay balanced');
        for (const page of [a, b]) expect(own(await snapshot(page), targetId).team).toBe('red');
        await expect.poll(async () => own(await snapshot(b), targetId).lifeGeneration).toBe(2);
        expectHumanArt(await humanArtState(a));
        expectHumanArt(await humanArtState(b));
        await expect
          .poll(() => b.evaluate(() => window.__lifecycleSeen().freshInventory))
          .toBe(true);
        expect((await snapshot(a)).scoreBlue).toBe(1);
        await expect(a.locator('#kills-num')).toHaveText('1');
        expect(own(await snapshot(a), first.sessionId).kills).toBe(1);
        expect((await snapshot(a)).presentation.kills).toBe(1);
        await a.screenshot({path:test.info().outputPath('respawn-current-rig.png')});
        await aimAt(a, targetId);
        await a.mouse.down();
        try {
          await expect
            .poll(async () => (await snapshot(a)).phase, { timeout: 8000 })
            .toBe('results');
        } finally {
          await a.mouse.up();
        }
      }
      for (const page of [a, b])
        await expect
          .poll(async () => (await snapshot(page)).phase, { timeout: 12000 })
          .toBe('results');
      const result = await snapshot(a);
      expect(result).toMatchObject({
        winner: path === 'score' ? 'blue' : 'draw',
        scoreBlue: path === 'score' ? 2 : 0,
        scoreRed: 0,
        matchGeneration: 1,
      });
      expect(result.resultsEndsAtMs - result.nowMs).toBeLessThanOrEqual(15000);
      expect(result.settings.resultsSeconds).toBe(15);
      expect(result.resultsRemaining).toBeGreaterThan(0);
      expect(result.resultsRemaining).toBeCloseTo(
        (result.resultsEndsAtMs - result.nowMs) / 1000,
        7
      );
      if (path === 'time') {
        // Results start on the first 30 Hz step at the authoritative match deadline.
        // Browser scheduling may observe that snapshot later in the results window.
        const resultsDuration = result.resultsEndsAtMs - result.endsAtMs;
        expect(resultsDuration + 1e-7).toBeGreaterThanOrEqual(15000);
        expect(resultsDuration).toBeLessThan(15000 + 1000 / 30 + 1e-7);
      }
      for (const page of [a, b]) {
        const s = await snapshot(page);
        expect([s.winner, s.scoreBlue, s.scoreRed, s.resultsEndsAtMs]).toEqual([
          result.winner,
          result.scoreBlue,
          result.scoreRed,
          result.resultsEndsAtMs,
        ]);
        await expect(page.locator('#mp-results')).toBeVisible();
        await expect(page.locator('#mp-result-title')).toHaveText(
          path === 'score' ? 'BLUE WINS' : 'DRAW'
        );
        await expect(page.locator('#mp-result-countdown')).toContainText('Rematch in');
        await expect(page.locator('#mp-switch-team')).toBeDisabled();
        await expect(page.locator('#mp-team-rejection')).toContainText('teams must stay balanced');
        const personalKills = own(s, s.sessionId).kills;
        await expect(page.locator('#kills-num')).toHaveText(String(personalKills));
        expect((await snapshot(page)).presentation.kills).toBe(personalKills);
      }
      await a.screenshot({ path: test.info().outputPath(`results-${path}.png`) });
      await b.screenshot({ path: test.info().outputPath(`results-${path}-peer.png`) });
      let replacement = null;
      if (path === 'time') {
        // The rematch keeps the 6-second setting, so nothing after it may race generation 2.
        // Record its facts inside the page before the leave, switch and rejoin block below.
        for (const page of [a, b]) await installRematchRecorder(page);
        // A valid solo results switch persists, then a fresh connection joins the smaller team.
        await b.locator('#mp-match-leave').click();
        await expect.poll(async () => (await snapshot(a)).players.length).toBe(1);
        await expect(a.locator('#mp-switch-team')).toBeEnabled();
        await a.locator('#mp-switch-team').click();
        await expect(a.locator('#tdm-label')).toHaveText('ONLINE · RED');
        await b.locator('#mp-join-btn').click();
        await expect.poll(async () => (await snapshot(a)).players.length).toBe(2);
        await expect.poll(async () => (await snapshot(b)).sessionId).toBeTruthy();
        replacement = (await snapshot(b)).sessionId;
        await expect
          .poll(async () => {
            const s = await snapshot(b);
            return (
              s.players.some((p) => p.sessionId === replacement) &&
              s.players.some((p) => p.sessionId === first.sessionId)
            );
          })
          .toBe(true);
        expect(replacement).not.toBe(targetId);
        for (const page of [a, b]) {
          const s = await snapshot(page);
          expect(own(s, first.sessionId).team).toBe('red');
          expect(own(s, replacement).team).toBe('blue');
        }
        for (const [label, page] of [['a', a], ['b', b]]) {
          // A leave and rejoin does not navigate; if a page did reload, reinstall at once.
          if (!(await page.evaluate(() => typeof window.__rematchSeen === 'function'))) {
            await installRematchRecorder(page);
            test.info().annotations.push({ type: `recorder-reinstalled:${label}`, description: 'true' });
          }
        }
        test.info().annotations.push({
          type: 'results-remaining-ms-after-join',
          description: String(result.resultsEndsAtMs - (await snapshot(a)).nowMs),
        });
      }
      // Wait using authority milliseconds; never click to begin the rematch.
      await expect
        .poll(async () => (await snapshot(a)).nowMs, { timeout: 16000 })
        .toBeGreaterThanOrEqual(result.resultsEndsAtMs - 1000);
      // One coherent snapshot may already cross the deadline on a busy runner.
      // It must still be results before it, or the correct next match after it.
      // Use the same 1e-7 ms boundary tolerance as shared/tdmRules.js.
      const nearDeadline = await snapshot(a);
      if (nearDeadline.nowMs + 1e-7 < result.resultsEndsAtMs) {
        expect(nearDeadline.phase).toBe('results');
      } else {
        expect(nearDeadline.phase).toBe('active');
        expect(nearDeadline.matchGeneration).toBe(2);
        expect(nearDeadline.startedAtMs + 1e-7).toBeGreaterThanOrEqual(result.resultsEndsAtMs);
      }
      await expect.poll(async () => (await snapshot(a)).matchGeneration, { timeout: 3000 }).toBe(2);
      if (path === 'score') {
        const tailStartedMs = Date.now();
        for (const page of [a, b]) {
          await expect.poll(async () => (await snapshot(page)).phase).toBe('active');
          const s = await snapshot(page);
          expect(s.settings).toEqual(first.settings);
          expect([s.scoreBlue, s.scoreRed, s.winner]).toEqual([0, 0, '']);
          expect(
            s.players.every(
              (p) =>
                p.alive &&
                p.health === 100 &&
                p.ammo === 30 &&
                p.reserve === 90 &&
                p.kills === 0 &&
                p.deaths === 0
            )
          ).toBe(true);
          expect(s.lastConfirmedHit).toBeNull();
          await expect(page.locator('#kills-num')).toHaveText('0');
          expect((await snapshot(page)).presentation.kills).toBe(0);
          expect(s.remoteActors).toHaveLength(1);
          const remote = s.players.find(p => p.sessionId !== s.sessionId);
          expect(s.remoteActors[0]).toMatchObject({ lifeGeneration: remote.lifeGeneration, skinned: true, armed: true });
          expectHumanArt(await humanArtState(page));
          await expect(page.locator('#mp-results')).toBeHidden();
        }
        expect((await snapshot(a)).startedAtMs + 1e-7).toBeGreaterThanOrEqual(
          result.resultsEndsAtMs
        );
        await expect(a.locator('#mp-resume')).toBeVisible();
        await a.locator('#mp-resume').click();
        await expect.poll(() => a.evaluate(() => !!document.pointerLockElement)).toBe(true);
        await a.screenshot({path:test.info().outputPath(`rematch-${path}.png`)});
        for (const page of [a, b]) {
          await focusControls(page);
          await page.evaluate(() => document.exitPointerLock());
          await expect(page.locator('#pause-menu')).toBeVisible();
          const pause = await page.locator('#pause-menu').boundingBox();
          const controls = await page.locator('#mp-match-controls').boundingBox();
          expect(pause, '#pause-menu has no layout box').not.toBeNull();
          expect(controls, '#mp-match-controls has no layout box').not.toBeNull();
          expect(pause.x).toBeGreaterThanOrEqual(controls.x + controls.width + 8);
          await page.locator('#mp-match-leave').click();
          await expect(page.locator('#overlay')).toBeVisible();
          await expect(page.locator('#kills-num')).toHaveText('0');
          expect((await snapshot(page)).presentation.kills).toBe(0);
        }
        test.info().annotations.push({
          type: 'score-tail-wall-ms',
          description: String(Date.now() - tailStartedMs),
        });
      } else {
        // Read the in-page record afterwards; nothing here is bounded by the 6-second match.
        const labelled = [['a', a], ['b', b]];
        for (const [label, page] of labelled)
          await expect
            .poll(async () => !!(await readRematchSeen(page)).firstActive, {
              timeout: 10000,
              message: `generation 2 never became active on client ${label}`,
            })
            .toBe(true);
        for (const [label, page] of labelled)
          await expect
            .poll(
              async () => {
                const r = await readRematchSeen(page);
                return (!!r.presentationSettled && !!r.resumeVisible) || r.ended;
              },
              {
                timeout: 12000,
                message: `client ${label} recorder neither settled nor ended generation 2`,
              }
            )
            .toBe(true);
        for (const [label, page] of labelled) {
          const r = await readRematchSeen(page);
          const s = r.firstActive.snapshot;
          expect([s.matchGeneration, s.phase]).toEqual([2, 'active']);
          expect(s.settings).toEqual(first.settings);
          expect([s.scoreBlue, s.scoreRed, s.winner]).toEqual([0, 0, '']);
          expect(
            s.players.every(
              (p) =>
                p.alive &&
                p.health === 100 &&
                p.ammo === 30 &&
                p.reserve === 90 &&
                p.kills === 0 &&
                p.deaths === 0
            )
          ).toBe(true);
          expect(s.lastConfirmedHit).toBeNull();
          expect(own(s, first.sessionId).team).toBe('red');
          expect(own(s, replacement).team).toBe('blue');
          if (label === 'a')
            expect(s.startedAtMs + 1e-7).toBeGreaterThanOrEqual(result.resultsEndsAtMs);
          const never = `fact never held during generation 2 (ended=${r.ended}, ticks with results visible=${r.resultsVisibleTicks})`;
          expect(r.presentationSettled, `presentation: ${never}`).toBeTruthy();
          expect([r.presentationSettled.snapshot.matchGeneration, r.presentationSettled.snapshot.phase]).toEqual([2, 'active']);
          expect(r.presentationSettled.killsText).toBe('0');
          expect(r.presentationSettled.snapshot.presentation.kills).toBe(0);
          expect(r.presentationSettled.resultsHidden).toBe(true);
          const presentationLateMs = r.presentationSettled.wallMs - r.firstActive.wallMs;
          test.info().annotations.push({
            type: `presentation-lateness-ms:${label}`,
            description: String(presentationLateMs),
          });
          expect(presentationLateMs).toBeLessThanOrEqual(1500);
          expect(r.resumeVisible, `#mp-resume: ${never}`).toBeTruthy();
          expect([r.resumeVisible.snapshot.matchGeneration, r.resumeVisible.snapshot.phase]).toEqual([2, 'active']);
          const resumeLateMs = r.resumeVisible.wallMs - r.firstActive.wallMs;
          test.info().annotations.push({
            type: `resume-lateness-ms:${label}`,
            description: String(resumeLateMs),
          });
          expect(resumeLateMs).toBeLessThanOrEqual(1500);
        }
      }
    } finally {
      try {
        await Promise.all(contexts.map((c) => c.close()));
      } finally {
        await fixture.stop();
      }
    }
  });

test('lifecycle: a rematched match reaching results again hides resume and pause and releases the pointer', async ({
  browser,
}) => {
  test.setTimeout(240000);
  const fixture = await startMpFixture({
    testSettings: { killLimit: 50, matchSeconds: 30, respawnSeconds: 5, friendlyFire: 0.25 },
  });
  const contexts = [];
  try {
    for (let i = 0; i < 2; i++)
      contexts.push(
        await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 0.25 })
      );
    const [a, b] = await Promise.all(contexts.map((c) => c.newPage()));
    for (const page of [a, b]) {
      await page.goto(fixture.url);
      await expect(page.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
      await page.locator('#mp-join-btn').click();
      await expect.poll(async () => (await snapshot(page)).sessionId).toBeTruthy();
    }
    await expect.poll(async () => (await snapshot(a)).players.length).toBe(2);
    const first = await snapshot(a),
      targetId = (await snapshot(b)).sessionId;
    const own = (s, id) => s.players.find((p) => p.sessionId === id);
    for (const page of [a, b])
      await expect
        .poll(async () => (await snapshot(page)).phase, { timeout: 60000 })
        .toBe('results');
    const result = await snapshot(a);
    expect(result.matchGeneration).toBe(1);
    // A valid solo results switch persists, then a fresh connection joins the smaller team.
    await b.locator('#mp-match-leave').click();
    await expect.poll(async () => (await snapshot(a)).players.length).toBe(1);
    await expect(a.locator('#mp-switch-team')).toBeEnabled();
    await a.locator('#mp-switch-team').click();
    await expect(a.locator('#tdm-label')).toHaveText('ONLINE · RED');
    await b.locator('#mp-join-btn').click();
    await expect.poll(async () => (await snapshot(a)).players.length).toBe(2);
    await expect.poll(async () => (await snapshot(b)).sessionId).toBeTruthy();
    const replacement = (await snapshot(b)).sessionId;
    await expect
      .poll(async () => {
        const s = await snapshot(b);
        return (
          s.players.some((p) => p.sessionId === replacement) &&
          s.players.some((p) => p.sessionId === first.sessionId)
        );
      })
      .toBe(true);
    expect(replacement).not.toBe(targetId);
    for (const page of [a, b]) {
      const s = await snapshot(page);
      expect(own(s, first.sessionId).team).toBe('red');
      expect(own(s, replacement).team).toBe('blue');
    }
    test.info().annotations.push({
      type: 'results-remaining-ms-after-join',
      description: String(result.resultsEndsAtMs - (await snapshot(a)).nowMs),
    });
    // Wait using authority milliseconds; never click to begin the rematch.
    await expect
      .poll(async () => (await snapshot(a)).nowMs, { timeout: 16000 })
      .toBeGreaterThanOrEqual(result.resultsEndsAtMs - 1000);
    await expect.poll(async () => (await snapshot(a)).matchGeneration, { timeout: 3000 }).toBe(2);
    for (const page of [a, b])
      await expect.poll(async () => (await snapshot(page)).phase).toBe('active');

    // Replacement client: capture, release, pause layout, leave.
    await focusControls(b);
    await b.evaluate(() => document.exitPointerLock());
    await expect(b.locator('#pause-menu')).toBeVisible();
    const pause = await b.locator('#pause-menu').boundingBox();
    const controls = await b.locator('#mp-match-controls').boundingBox();
    expect(pause, '#pause-menu has no layout box').not.toBeNull();
    expect(controls, '#mp-match-controls has no layout box').not.toBeNull();
    expect(pause.x).toBeGreaterThanOrEqual(controls.x + controls.width + 8);
    await b.locator('#mp-match-leave').click();
    await expect(b.locator('#overlay')).toBeVisible();
    await expect(b.locator('#kills-num')).toHaveText('0');
    expect((await snapshot(b)).presentation.kills).toBe(0);

    // Switched client: capture the pointer while generation 2 is still running.
    await expect(a.locator('#mp-resume')).toBeVisible();
    await focusControls(a);
    const atLock = await snapshot(a);
    const remainingMs = atLock.endsAtMs - atLock.nowMs;
    test.info().annotations.push({
      type: 'match-remaining-ms-at-lock',
      description: String(remainingMs),
    });
    expect(remainingMs).toBeGreaterThan(5000);

    // Results of the rematched match release the pointer and hide resume and pause.
    await expect
      .poll(
        async () => {
          const s = await snapshot(a);
          return [s.phase, s.matchGeneration];
        },
        { timeout: 40000 }
      )
      .toEqual(['results', 2]);
    await expect(a.locator('#mp-resume')).toBeHidden();
    await expect(a.locator('#pause-menu')).toBeHidden();
    await expect.poll(() => a.evaluate(() => document.pointerLockElement)).toBeNull();
    await expect(a.locator('#mp-results')).toBeVisible();
    await a.locator('#mp-match-leave').click();
    await expect(a.locator('#overlay')).toBeVisible();
    await expect(a.locator('#kills-num')).toHaveText('0');
    expect((await snapshot(a)).presentation.kills).toBe(0);
  } finally {
    try {
      await Promise.all(contexts.map((c) => c.close()));
    } finally {
      await fixture.stop();
    }
  }
});

/** @param {import('@playwright/test').Page} page */
async function snapshot(page) {
  return page.evaluate(() => window.__mpDebug());
}

/** Observation only: records generation-2 facts from each tick's own snapshot and the live DOM.
 * @param {import('@playwright/test').Page} page
 */
async function installRematchRecorder(page) {
  await page.evaluate(() => {
    const rec = {
      firstActive: null,
      presentationSettled: null,
      resumeVisible: null,
      resultsVisibleTicks: 0,
      ended: false,
    };
    window.__rematchSeen = () => structuredClone(rec);
    const shown = (id) => {
      const el = document.getElementById(id);
      if (!el || el.hidden) return false;
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
    };
    setInterval(() => {
      if (rec.ended) return;
      const s = window.__mpDebug();
      const wallMs = performance.now();
      const live = s.matchGeneration === 2 && s.phase === 'active';
      if (!live) {
        if (rec.firstActive) rec.ended = true;
        return;
      }
      if (!rec.firstActive) rec.firstActive = { snapshot: s, wallMs };
      const resultsShown = shown('mp-results');
      if (resultsShown) rec.resultsVisibleTicks++;
      const killsText = document.getElementById('kills-num')?.textContent ?? null;
      if (
        !rec.presentationSettled &&
        killsText === '0' &&
        s.presentation.kills === 0 &&
        !resultsShown
      )
        rec.presentationSettled = { snapshot: s, wallMs, killsText, resultsHidden: !resultsShown };
      if (!rec.resumeVisible && shown('mp-resume')) rec.resumeVisible = { snapshot: s, wallMs };
    }, 10);
  });
}

/** @param {import('@playwright/test').Page} page */
async function readRematchSeen(page) {
  return page.evaluate(() => window.__rematchSeen());
}

test('animation retirement: two real M4 clients reload, die and render a fresh life', async ({ browser }) => {
  test.setTimeout(240000);
  const fixture = await startMpFixture({ testSettings: { killLimit: 50, matchSeconds: 180,
    respawnSeconds: 3, friendlyFire: .25 }, env: { VOD_COMBAT_SEED: '7' } });
  const contexts = [];
  try {
    for (let i = 0; i < 2; i++) contexts.push(await browser.newContext({
      viewport: { width: 800, height: 600 }, deviceScaleFactor: .25 }));
    const [a,b] = await Promise.all(contexts.map(c => c.newPage()));
    for (const page of [a,b]) {
      await page.goto(fixture.url);
      await expect(page.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
      await page.locator('#mp-join-btn').click();
      await expect.poll(async () => (await snapshot(page)).sessionId).toBeTruthy();
    }
    await expect.poll(async () => (await snapshot(a)).players.length).toBe(2);
    const first = await snapshot(a), targetId = (await snapshot(b)).sessionId;
    await aimAt(a, null);
    for (const [x,z] of [[62,46],[62,22],[34,22],[34,46]]) await walkTo(a, first.sessionId, x,z);
    await aimAt(a,targetId);
    // Observation only: preserve transient actual schema and sampled pose together.
    await a.evaluate(targetId => {
      const seen = { reload: null, death: null, fresh: null };
      window.__animationSeen = () => structuredClone(seen);
      window.__animationTimer = setInterval(() => {
        const s = window.__mpDebug(), p = s.players.find(p => p.sessionId === targetId);
        const actor = s.remoteActors.find(p => p.sessionId === targetId);
        if (!p || !actor) return;
        if (p.reloadRemaining > 0 && !seen.reload) seen.reload = { p,actor,tick:s.currentTick };
        if (!p.alive) seen.death = { p,actor,tick:s.currentTick };
        if (p.lifeGeneration > 1 && p.alive) seen.fresh = { p,actor,tick:s.currentTick };
      },10);
    },targetId);
    await focusControls(b);
    await b.mouse.click(400,300);
    await expect.poll(async () => (await snapshot(b)).players.find(p=>p.sessionId===targetId).ammo).toBeLessThan(30);
    await b.keyboard.press('KeyR');
    await expect.poll(() => a.evaluate(() => !!window.__animationSeen().reload)).toBe(true);
    await focusControls(a); await a.mouse.down();
    try { await expect.poll(async () => (await snapshot(b)).players.find(p=>p.sessionId===targetId).alive).toBe(false); }
    finally { await a.mouse.up(); }
    await expect.poll(() => a.evaluate(() => !!window.__animationSeen().fresh), { timeout: 12000 }).toBe(true);
    const seen = await a.evaluate(() => { clearInterval(window.__animationTimer); return window.__animationSeen(); });
    expect(seen.reload.actor.pose.upper).toBe('reload');
    expect(seen.reload.actor.pose.phase).toBeCloseTo(1-seen.reload.p.reloadRemaining/1.8,5);
    expect(seen.death.actor.clip).toBe('death_front');
    expect(seen.death.actor.pose.deathDirectionSource).toBe('body-heading-fallback');
    expect(seen.death.actor.pose.settled).toBe(true);
    expect(seen.fresh.p).toMatchObject({ alive:true, ammo:30,reserve:90,health:100,reloadRemaining:0 });
    expect(seen.fresh.actor.pose).toMatchObject({ upper:'ready',settled:false,phase:0 });
    expect(seen.fresh.actor.lifeGeneration).toBe(seen.fresh.p.lifeGeneration);
    for (const state of Object.values(seen)) {
      expect(state.actor.root.x).toBeCloseTo(state.p.x, 6);
      expect(state.actor.root.z).toBeCloseTo(state.p.z, 6);
      expect(state.actor.pose.sampleTimeSeconds).toBeCloseTo(state.tick/30,6);
    }
    expectHumanArt(await humanArtState(a)); expectHumanArt(await humanArtState(b));
    await a.screenshot({ path:test.info().outputPath('animation-fresh-life.png') });
  } finally { try { await Promise.all(contexts.map(c=>c.close())); } finally { await fixture.stop(); } }
});

test('animation authority: directional, blocked, pitch, stance, sprint and landing follow two-client snapshots', async ({ browser }) => {
  test.setTimeout(180000);
  const fixture = await startMpFixture(), contexts = [];
  try {
    for(let i=0;i<2;i++) contexts.push(await browser.newContext({ viewport:{width:800,height:600},deviceScaleFactor:.25 }));
    const [a,b] = await Promise.all(contexts.map(c=>c.newPage()));
    for(const page of [a,b]) { await page.goto(fixture.url); await expect(page.locator('#mp-join-btn')).toBeEnabled({timeout:60000}); await page.locator('#mp-join-btn').click(); }
    await expect.poll(async()=>(await snapshot(b)).players.length).toBe(2);
    const id=(await snapshot(a)).sessionId;
    await b.evaluate(id=>{
      window.__poseSamples=[];
      window.__poseTimer=setInterval(()=>{
        const s=window.__mpDebug(),p=s.players.find(p=>p.sessionId===id),actor=s.remoteActors.find(p=>p.sessionId===id);
        if(p&&actor?.pose&&actor.pose.sampleTimeSeconds===s.currentTick/30) window.__poseSamples.push({p,actor,tick:s.currentTick});
      },10);
    },id);
    await aimAt(a,null);
    for(const key of ['KeyW','KeyD','KeyS','KeyA']) await pulseRouteKey(a,key,350);
    await a.keyboard.down('ShiftLeft'); await pulseRouteKey(a,'KeyW',500); await a.keyboard.up('ShiftLeft');
    await a.keyboard.down('ControlLeft'); await pulseRouteKey(a,'KeyD',350); await a.keyboard.up('ControlLeft');
    await a.keyboard.press('Space');
    await expect.poll(()=>b.evaluate(()=>window.__poseSamples.some(s=>!s.p.onGround))).toBe(true);
    await expect.poll(()=>b.evaluate(()=>window.__poseSamples.some(s=>s.actor.pose.jump==='land'))).toBe(true);
    await a.mouse.move(400,1200); await a.mouse.move(400,-1200);
    await expect.poll(()=>b.evaluate(()=>window.__poseSamples.some(s=>Math.abs(s.p.pitch)>1.1))).toBe(true);
    await aimAt(a,null);
    await a.keyboard.down('KeyS');
    await expect.poll(async()=>{
      const s=await snapshot(b),p=s.players.find(p=>p.sessionId===id),actor=s.remoteActors.find(p=>p.sessionId===id);
      return !p.moving&&!actor.pose.moving&&actor.pose.speed<.05;
    },{timeout:12000}).toBe(true);
    await a.keyboard.up('KeyS');
    const samples=await b.evaluate(()=>{clearInterval(window.__poseTimer);return window.__poseSamples;});
    expect(samples.some(s=>s.actor.pose.crouching&&s.p.crouching)).toBe(true);
    expect(samples.some(s=>s.p.sprinting&&s.actor.pose.upper==='sprint')).toBe(true);
    for(const direction of ['forward','back','left','right']) expect(samples.some(s=>s.actor.pose.gait.some(g=>g.key===`walk_${direction}`&&g.weight>0))).toBe(true);
    for(const s of samples) {
      expect(s.actor.root.x).toBeCloseTo(s.p.x,6); expect(s.actor.root.z).toBeCloseTo(s.p.z,6);
      expect(s.actor.root.y).toBeCloseTo(s.p.y-(s.p.crouching?PLAYER_H_CROUCH:PLAYER_H),6);
      expect(s.actor.pose.bodyYaw).toBe(s.p.yaw);
      expect(s.actor.pose.pitch).toBeCloseTo(Math.max(-1.1,Math.min(1.1,s.p.pitch)),6);
      expect(s.actor.pose.sampleTimeSeconds).toBeCloseTo(s.tick/30,6);
      expect(s.p.ammo).toBe(30); expect(s.p.health).toBe(100);
    }
  } finally {try{await Promise.all(contexts.map(c=>c.close()));}finally{await fixture.stop();}}
});

test('animation authority: forged, unsupported, repeated and stale-life cues grant no pose or inventory', async ({ browser }) => {
  test.setTimeout(120000);
  const fixture = await startMpFixture(), contexts=[];
  try {
    for(let i=0;i<2;i++)contexts.push(await browser.newContext({viewport:{width:800,height:600},deviceScaleFactor:.25}));
    const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));
    // Test-only transport attack. No room/state reference or mutation endpoint is added to production.
    await a.addInitScript(() => {
      const send=WebSocket.prototype.send;let socket;
      WebSocket.prototype.send=function(data){socket=this;return send.call(this,data);};
      window.__sendWireForTest=bytes=>send.call(socket,new Uint8Array(bytes));
    });
    for(const page of [a,b]){await page.goto(fixture.url);await expect(page.locator('#mp-join-btn')).toBeEnabled({timeout:60000});await page.locator('#mp-join-btn').click();}
    await expect.poll(async()=>(await snapshot(b)).players.length).toBe(2);
    await a.evaluate(()=>document.exitPointerLock());
    const s=await snapshot(a),p=s.players.find(p=>p.sessionId===s.sessionId);
    const base={protocolVersion:1,seq:s.inputSeq+1,ackTick:s.currentTick,matchGeneration:s.matchGeneration,
      lifeGeneration:p.lifeGeneration,moveX:0,moveZ:0,yaw:p.yaw,pitch:p.pitch,
      fire:false,reload:false,sprint:false,jump:false,crouch:false,aiming:false,neutral:true};
    const packr=new Packr({useRecords:false});
    const attack=async(type,payload,reason)=>{
      if(type==='input')payload={...payload,ackTick:(await snapshot(a)).currentTick};
      const header=new Uint8Array(128),it={offset:1};header[0]=Protocol.ROOM_DATA;encode.string(header,type,it);
      const bytes=packr.pack(payload,RESERVE_START_SPACE|it.offset);bytes.set(header.subarray(0,it.offset));
      await a.evaluate(bytes=>window.__sendWireForTest(bytes),Array.from(bytes));
      await expect.poll(async()=>(await snapshot(a)).lastInputRejection).toBe(reason);
      const after=await snapshot(b),actor=after.remoteActors.find(actor=>actor.sessionId===s.sessionId);
      expect(after.players.find(player=>player.sessionId===s.sessionId)).toMatchObject({ammo:30,reserve:90,health:100,alive:true,reloadRemaining:0});
      expect(actor.pose.upper).toBe('ready');expect(actor.pose.phase).toBe(0);expect(actor.pose.settled).toBe(false);
      expect(after.scoreBlue).toBe(0);expect(after.scoreRed).toBe(0);
    };
    await attack('input',{...base,action:'throw',weapon:'awp',direction:'back'},'invalid_shape');
    await attack('animation',{kind:'death',phase:1,impact:{x:1,z:0}},'unknown_message');
    await attack('input',{...base,lifeGeneration:0},'wrong_generation');
    await attack('input',{...base,seq:0},'duplicate_seq');
    await attack('input',{...base,action:'reload'},'invalid_shape');
    expect((await snapshot(a)).inputHandlerCount).toBe(12);
    expect(await a.evaluate(()=>Object.isFrozen(window.__mpDebug())&& !('room' in window.__mpDebug()))).toBe(true);
  }finally{try{await Promise.all(contexts.map(c=>c.close()));}finally{await fixture.stop();}}
});

async function focusControls(page) {
  await page.bringToFront();
  if (!(await page.evaluate(() => !!document.pointerLockElement))) {
    const resume = (await page.locator('#mp-resume').isVisible())
      ? '#mp-resume'
      : '#pause-resume-btn';
    await page.locator(resume).click({ timeout: 10000 });
    await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  }
}

/** Observe transient presentation without awarding outcomes or changing game state.
 * @param {import('@playwright/test').Page} page
 */
async function observeFeedback(page) {
  await page.evaluate(() => {
    const seen = { marker: false, numbers: [] };
    window.__observedFeedback = () => structuredClone(seen);
    new MutationObserver((records) => {
      for (const record of records) {
        if (
          record.target.id === 'xhair-dot' &&
          record.target.style.background === 'rgb(231, 76, 60)'
        )
          seen.marker = true;
        for (const node of record.addedNodes)
          if (node.nodeType === 1 && node.classList.contains('dmg-num'))
            seen.numbers.push(node.textContent);
      }
    }).observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['style'],
    });
  });
}

/** Walk using ordinary keys and observed state; no teleport/test mutation API.
 * @param {import('@playwright/test').Page} page
 * @param {string} sessionId
 * @param {number} x
 * @param {number} z
 */
async function walkTo(page, sessionId, x, z) {
  await focusControls(page);
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const state = await snapshot(page);
    const me = state.players.find((player) => player.sessionId === sessionId);
    const dx = x - me.x;
    const dz = z - me.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.35) return;
    const forward = -dx * Math.sin(me.yaw) - dz * Math.cos(me.yaw);
    const right = dx * Math.cos(me.yaw) - dz * Math.sin(me.yaw);
    const key =
      Math.abs(forward) > Math.abs(right)
        ? forward > 0
          ? 'KeyW'
          : 'KeyS'
        : right > 0
          ? 'KeyD'
          : 'KeyA';
    const precise = distance < 2;
    if (precise) {
      await page.keyboard.down('ControlLeft');
      const stanceSeq = (await snapshot(page)).inputSeq;
      await expect.poll(async () => {
        const current = (await snapshot(page)).players.find((b) => b.sessionId === sessionId);
        return current.crouching && current.lastConsumedSeq >= stanceSeq;
      }).toBe(true);
    }
    let releaseSeq;
    try {
      // The page owns the release timer: driver IPC can stretch a requested
      // 150ms keyboard.press into seconds while WebGL is contended.
      releaseSeq = await pulseRouteKey(page, key, Math.min(150, Math.max(100, distance * 40)));
    } finally {
      if (precise) await page.keyboard.up('ControlLeft');
    }
    // Wait for the neutral command's replicated body before choosing another pulse.
    await expect.poll(async () => {
      const current = (await snapshot(page)).players.find((b) => b.sessionId === sessionId);
      return !current.moving && current.lastConsumedSeq >= releaseSeq;
    }).toBe(true);
  }
  throw new Error(
    `Keyboard route did not reach (${x}, ${z}) within 45s: ${JSON.stringify(await snapshot(page))}`
  );
}

/** Release ordinary key input in the page, independent of driver response latency.
 * @param {import('@playwright/test').Page} page
 * @param {string} key
 * @param {number} duration
 */
async function pulseRouteKey(page, key, duration) {
  await page.evaluate(({ key, duration }) => {
    const pulse = { released: false, releaseSeq: -1, timer: null, start: null };
    pulse.start = (event) => {
      if (event.code !== key) return;
      document.removeEventListener('keydown', pulse.start, true);
      pulse.timer = setTimeout(() => {
        // Use the same keyup handlers as native input; never alter gameplay state.
        document.dispatchEvent(new KeyboardEvent('keyup', { code: key, bubbles: true }));
        pulse.releaseSeq = window.__mpDebug().inputSeq;
        pulse.released = true;
      }, duration);
    };
    window.__routePulse = pulse;
    document.addEventListener('keydown', pulse.start, true);
  }, { key, duration });
  try {
    await page.keyboard.down(key);
    await page.waitForFunction(() => window.__routePulse.released);
    return await page.evaluate(() => window.__routePulse.releaseSeq);
  } finally {
    await page.keyboard.up(key);
    await page.evaluate(() => {
      const pulse = window.__routePulse;
      clearTimeout(pulse.timer);
      document.removeEventListener('keydown', pulse.start, true);
      delete window.__routePulse;
    });
  }
}

async function aimAt(page, targetId) {
  await focusControls(page);
  // A mouse move updates local intention before its authoritative yaw patch.
  // Wait for a subsequently sent command to be consumed; a fixed sleep can
  // falsely report convergence against the pre-move snapshot.
  const moveAndObserve = async (x, y) => {
    const beforeSeq = (await snapshot(page)).inputSeq;
    await page.mouse.move(x, y);
    await expect.poll(async () => (await snapshot(page)).inputSeq).toBeGreaterThan(beforeSeq);
    const sentSeq = (await snapshot(page)).inputSeq;
    await expect.poll(async () => {
      const state = await snapshot(page);
      return state.players.find((p) => p.sessionId === state.sessionId).lastConsumedSeq >= sentSeq;
    }).toBe(true);
  };
  await moveAndObserve(400, 300);
  let mouseX = 400, mouseY = 300;
  for (let attempt = 0; attempt < 6; attempt++) {
    const state = await snapshot(page);
    const me = state.players.find((p) => p.sessionId === state.sessionId);
    const target = state.players.find((p) => p.sessionId === targetId);
    const dx = target ? target.x - me.x : 0, dz = target ? target.z - me.z : 0;
    const yaw = target ? Math.atan2(-dx, -dz) : 0;
    const pitch = target ? Math.atan2(target.y - me.y - 0.1, Math.hypot(dx, dz)) : 0;
    const yawError = Math.atan2(Math.sin(yaw - me.yaw), Math.cos(yaw - me.yaw));
    const pitchError = pitch - me.pitch;
    if (Math.abs(yawError) < 0.02 && Math.abs(pitchError) < 0.02) return;
    mouseX -= yawError / MOUSE_SENS; mouseY -= pitchError / MOUSE_SENS;
    await moveAndObserve(mouseX, mouseY);
  }
  throw new Error(`Real control aiming did not converge: ${JSON.stringify(await snapshot(page))}`);
}

// Test-only browser instrumentation binds the actual bundled offline event bus.
// The production build/room has no mutation endpoint. An attacker can execute
// local JS; these exact legacy emits must still never award server outcomes.
async function bindOfflineAttackProbe(page) {
  await page.route('**/assets/index-*.js', async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const emitters = [...source.matchAll(/([$\w]+)=\(([$\w]+),([$\w]+)\)=>\(([$\w]+)\[\2\]\?\?\[\]\)\.slice\(\)\.forEach\(([$\w]+)=>\5\(\3\)\)/g)];
    expect(emitters).toHaveLength(1);
    await route.fulfill({ response, body: `${source}\nwindow.__emitOfflineForTest = ${emitters[0][1]};` });
  });
}

for (const kind of ['combat', 'authority', 'feedback']) test(`${kind==='feedback'?'animation authority: ':''}${kind}: real M4 cover, ammo, reload and private hit outcomes agree${kind === 'authority' ? ' after forged offline outcomes' : ''}`, async ({ browser }) => {
  const authority = kind === 'authority';
  test.setTimeout(240000);
  const fixture = await startMpFixture({ env: { VOD_COMBAT_SEED: '7' } });
  const contexts = [];
  try {
    for (let i = 0; i < 2; i++) contexts.push(await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 0.25 }));
    const [shooter, victim] = await Promise.all(contexts.map((c) => c.newPage()));
    if (authority) await bindOfflineAttackProbe(shooter);
    if (kind === 'feedback') for (const page of [shooter, victim]) await page.route('**/assets/index-*.js', async route => {
      const response = await route.fetch(), source = await response.text();
      const pattern=/\.onMessage\(["'`]hit-confirmed["'`],/g;
      expect(source.match(pattern)).toHaveLength(1);
      await route.fulfill({ response, body: source.replace(pattern, '$&window.__receiveHitForTest=') });
    });
    for (const page of [shooter, victim]) {
      await page.goto(fixture.url);
      await expect(page.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
      await page.locator('#mp-join-btn').click();
      await expect.poll(async () => (await snapshot(page)).sessionId, { timeout: 30000 }).toBeTruthy();
      await observeFeedback(page);
    }
    await expect.poll(async () => (await snapshot(shooter)).players.length).toBe(2);
    const initial = await snapshot(shooter), targetId = (await snapshot(victim)).sessionId;
    const me = (state) => state.players.find((p) => p.sessionId === initial.sessionId);
    const target = (state) => state.players.find((p) => p.sessionId === targetId);
    if (kind === 'feedback') {
      await shooter.evaluate(() => {
        const s = window.__mpDebug(), me = s.players.find(p => p.sessionId === s.sessionId), target = s.players.find(p => p.sessionId !== s.sessionId);
        window.__receiveHitForTest({shooterSessionId:s.sessionId,targetSessionId:target.sessionId,matchGeneration:s.matchGeneration,lifeGeneration:me.lifeGeneration,targetLifeGeneration:target.lifeGeneration,eventId:900,shotId:900,damage:999,impact:{x:NaN,y:0,z:0}});
      });
      expect(await shooter.evaluate(() => window.__observedFeedback())).toEqual({marker:false,numbers:[]});
    }
    if (authority) {
      await shooter.evaluate((targetSessionId) => {
        for (const name of ['enemy:killed', 'friendly:killed', 'player:died', 'damage', 'hit', 'kill', 'score'])
          window.__emitOfflineForTest(name, { sessionId: targetSessionId, damage: 999, score: 999, ammo: 999 });
      }, targetId);
      await expect.poll(async () => (await snapshot(victim)).currentTick).toBeGreaterThan(initial.currentTick + 3);
      const after = await snapshot(shooter), peer = await snapshot(victim);
      expect(after.score).toEqual({ alpha: 0, bravo: 0 });
      expect(peer.score).toEqual(after.score);
      for (const state of [after, peer]) {
        expect(state.players.every((p) => p.health === 100 && p.alive && p.ammo === 30)).toBe(true);
        expect(state.lastConfirmedHit).toBeNull();
      }
      expect(await shooter.evaluate(() => window.__observedFeedback())).toEqual({ marker: false, numbers: [] });
    }
    // Existing central cover separates the two spawn positions.
    await aimAt(shooter, targetId);
    await shooter.mouse.down(); await shooter.mouse.up();
    await expect.poll(async () => me(await snapshot(shooter)).ammo).toBe(29);
    const tick = (await snapshot(shooter)).currentTick;
    await expect.poll(async () => (await snapshot(victim)).currentTick).toBeGreaterThan(tick + 35);
    expect(target(await snapshot(victim)).health).toBe(100);
    expect((await snapshot(shooter)).lastConfirmedHit).toBeNull();
    await expect(shooter.locator('#ammo-cur')).toHaveText('29');
    await shooter.keyboard.press('KeyR');
    await expect(shooter.locator('#reloadwrap')).toBeVisible();
    await shooter.mouse.click(400, 300);
    expect(me(await snapshot(shooter)).ammo).toBe(29);
    await expect.poll(async () => me(await snapshot(victim)).ammo).toBe(30);
    await expect(shooter.locator('#ammo-rsv')).toHaveText('89');
    // Reach the target through normal keys around the existing central cover.
    await aimAt(shooter, null);
    await walkTo(shooter, initial.sessionId, 62, 46);
    await walkTo(shooter, initial.sessionId, 62, 22);
    await walkTo(shooter, initial.sessionId, 34, 22);
    await walkTo(shooter, initial.sessionId, 34, 46);
    await aimAt(shooter, targetId);
    await shooter.mouse.down(); await shooter.mouse.up();
    await expect.poll(async () => target(await snapshot(victim)).health).toBe(72);
    await expect.poll(async () => (await snapshot(shooter)).lastConfirmedHit?.damage).toBe(28);
    if(kind==='feedback') {
      await shooter.screenshot({path:test.info().outputPath('feedback-shooter-hit.png')});
      await victim.screenshot({path:test.info().outputPath('feedback-victim.png')});
    }
    expect(me(await snapshot(shooter)).ammo).toBe(29);
    expect(me(await snapshot(victim)).ammo).toBe(29);
    expect((await snapshot(shooter)).score).toEqual((await snapshot(victim)).score);
    expect(await shooter.evaluate(() => window.__observedFeedback().numbers)).toEqual(['-28']);
    expect(await victim.evaluate(() => window.__observedFeedback())).toEqual({ marker: false, numbers: [] });
    if (kind === 'feedback') {
      const confirmed = (await snapshot(shooter)).lastConfirmedHit;
      await shooter.evaluate(event => {
        window.__receiveHitForTest(event);
        window.__receiveHitForTest({...event,eventId:event.eventId+1,matchGeneration:event.matchGeneration-1});
      }, confirmed);
      await victim.evaluate(event => window.__receiveHitForTest(event), confirmed);
      expect(await shooter.evaluate(() => window.__observedFeedback().numbers)).toEqual(['-28']);
      expect(await victim.evaluate(() => window.__observedFeedback())).toEqual({marker:false,numbers:[]});
      await shooter.evaluate(() => document.exitPointerLock());
      await expect(shooter.locator('.dmg-num')).toHaveCount(0);
      await expect(shooter.locator('#xhair-dot')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    }
    await shooter.screenshot({ path: test.info().outputPath(`${authority ? 'authority' : 'combat'}-confirmed.png`) });
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
    await fixture.stop();
  }
});

test('animation retirement: errors: unavailable join and disconnected session offer visible top Retry and Return', async ({ browser }) => {
  test.setTimeout(120000);
  const fixture = await startMpFixture();
  const context = await browser.newContext({viewport:{width:800,height:600},deviceScaleFactor:0.25});
  try {
    const page = await context.newPage();
    await page.goto(fixture.url);
    await expect(page.locator('#mp-join-btn')).toBeEnabled({timeout:60000});
    const unavailable = route => route.abort('connectionrefused');
    await page.route('**/matchmake/**', unavailable);
    await page.locator('#mp-join-btn').click();
    await expect(page.locator('#mp-error-banner')).toBeVisible();
    await expect(page.locator('#mp-error-banner')).toHaveAttribute('role','alert');
    await expect(page.locator('#mp-error-message')).toContainText('server');
    const rect = await page.locator('#mp-error-banner').boundingBox();
    expect(rect.y).toBeLessThanOrEqual(24);
    await page.unroute('**/matchmake/**', unavailable);
    await page.locator('#mp-retry-btn').click();
    await expect.poll(async()=> (await snapshot(page)).sessionId).toBeTruthy();
    await expect(page.locator('#mp-error-banner')).toBeHidden();
    await fixture.restart();
    await expect(page.locator('#mp-error-banner')).toBeVisible();
    expect(await snapshot(page)).toMatchObject({sessionId:null,remoteActorCount:0,inputHandlerCount:0});
    await page.screenshot({path:test.info().outputPath('connection-error.png')});
    await page.locator('#mp-retry-btn').click();
    await expect.poll(async()=> (await snapshot(page)).sessionId, {message:'Retry must join a fresh room'}).toBeTruthy();
    await fixture.restart();
    await expect(page.locator('#mp-error-banner')).toBeVisible();
    await page.locator('#mp-error-return-btn').click();
    await expect(page.locator('#overlay')).toBeVisible();
    await expect(page.locator('#mp-error-banner')).toBeHidden();
    expect(await snapshot(page)).toMatchObject({sessionId:null,remoteActorCount:0,inputHandlerCount:0});
  } finally { try { await context.close(); } finally { await fixture.stop(); } }
});

// Read only existing real-rig debug references. Event listeners observe disposal;
// this does not add a production mutation API or alter authoritative snapshots.
async function humanArtState(page) {
  return page.evaluate(() => {
    const player = window.__bodyRef();
    let scene = player;
    while (scene?.parent) scene = scene.parent;
    if (!scene?.isScene) throw Error('Actual scene reference missing');
    let playerRoot = player;
    while (playerRoot.parent && playerRoot.parent !== scene) playerRoot = playerRoot.parent;
    const state = window.__artLifetime ??= { watched: new WeakSet(), sharedDisposals: 0 };
    const roots = [];
    for (const root of scene.children) {
      if (!root.getObjectByName('HumanBody')) continue;
      if (root.name.startsWith('firstPerson_')) continue;
      const domains = [], accents = [], shared = [];
      root.traverse((n) => {
        for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
          if (!m) continue;
          const domain = m.userData.artDomain ?? n.userData.artDomain ?? n.parent?.userData.artDomain;
          if (!['skin', 'fabric', 'armor', 'team-accent', 'teamAccent'].includes(domain)) continue;
          domains.push(domain);
          if (m.map) {
            shared.push({ uuid: m.map.uuid, width: m.map.image.width, domain });
            if (!state.watched.has(m.map)) {
              state.watched.add(m.map);
              m.map.addEventListener('dispose', () => { state.sharedDisposals++; });
            }
          }
          if (['team-accent', 'teamAccent'].includes(domain)) accents.push({ owned: m.userData.characterOwned, color: m.color.getHexString() });
        }
      });
      roots.push({ uuid: root.uuid, player: root === playerRoot, domains: [...new Set(domains)], accents, shared });
    }
    return { roots, sharedDisposals: state.sharedDisposals };
  });
}

function expectHumanArt(state) {
  expect(state.sharedDisposals).toBe(0);
  for (const actor of state.roots) {
    expect(actor.domains).toEqual(expect.arrayContaining(['skin', 'fabric', 'armor', 'team-accent']));
    expect(actor.shared.length).toBeGreaterThan(0);
    expect(actor.shared.every((map) => map.width === 512)).toBe(true);
    expect(actor.accents.length).toBeGreaterThan(0);
    expect(actor.accents.every((m) => m.owned && ['4488ff', 'ff5555', 'ffffff'].includes(m.color))).toBe(true);
  }
}

test('resources: repeated leave and rejoin preserve real template clones and stabilize allocations', async ({ browser }) => {
  test.setTimeout(120000);
  const fixture = await startMpFixture(), contexts=[];
  try {
    for(let i=0;i<2;i++) contexts.push(await browser.newContext({viewport:{width:800,height:600},deviceScaleFactor:0.25}));
    const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));
    for(const page of [a,b]) { await page.goto(fixture.url); await expect(page.locator('#mp-join-btn')).toBeEnabled({timeout:60000}); await page.locator('#mp-join-btn').click(); }
    const counts=[];
    for(let cycle=0;cycle<3;cycle++) {
      await expect.poll(async()=> (await snapshot(a)).remoteActorCount).toBe(1);
      const s=await snapshot(a);
      expect(s.usingGLTF).toBe(true);
      expect(s.remoteActors[0]).toMatchObject({skinned:true,armed:true});
      expect(s.remoteResourceCounts.created-s.remoteResourceCounts.disposed).toBe(1);
      const art = await humanArtState(a);
      expectHumanArt(art);
      expect(art.roots.filter((root) => !root.player)).toHaveLength(1);
      const keeper = (await humanArtState(b)).roots.find((root) => root.player);
      counts.push(s.renderMemory);
      await a.evaluate(()=>document.exitPointerLock());
      await a.locator('#mp-match-leave').click();
      await expect.poll(async()=> (await snapshot(b)).remoteActorCount).toBe(0);
      expect(await snapshot(a)).toMatchObject({remoteActorCount:0,inputHandlerCount:0});
      const surviving = await humanArtState(b);
      expectHumanArt(surviving);
      expect(surviving.roots.find((root) => root.player).shared).toEqual(keeper.shared);
      await a.locator('#mp-join-btn').click();
      await expect.poll(async()=> (await snapshot(a)).sessionId).toBeTruthy();
    }
    // The map rebuild randomizes rubble geometry. Record total allocations,
    // while exact live ownership and stable textures prove remote retirement.
    expect(counts[2].textures).toBe(counts[1].textures);
    console.log('[resources] rendered allocation samples', JSON.stringify(counts));
    await a.screenshot({path:test.info().outputPath('resource-rejoin.png')});
  } finally { try { await Promise.all(contexts.map(c=>c.close())); } finally { await fixture.stop(); } }
});

test('tracer: two browsers join and move', async ({ browser }) => {
  test.setTimeout(240000);
  const fixture = await startMpFixture();
  expect((await fetch(`${fixture.url}/health`)).status).toBe(200);
  const contexts = [];
  try {
    for (let i = 0; i < 2; i++) {
      contexts.push(
        await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 0.25 })
      );
    }
    const [shooter, target] = await Promise.all(contexts.map((context) => context.newPage()));
    for (const page of [shooter, target]) {
      await page.goto(fixture.url);
      await expect(page.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
      await page.mouse.move(400, 300);
      await page.locator('#mp-join-btn').click();
      await expect.poll(async () => (await snapshot(page)).sessionId, { timeout: 30000 }).toBeTruthy();
    }

    await expect.poll(async () => (await snapshot(shooter)).players.length).toBe(2);
    await expect.poll(async () => (await snapshot(target)).players.length).toBe(2);
    const initial = await snapshot(shooter);
    const second = await snapshot(target);
    expect(initial.sessionId).not.toBe(second.sessionId);
    expect(initial.roomId).toBe(second.roomId);
    expect(initial.mapId).toBe(second.mapId);
    expect(initial.mapId).toBe('bunker');
    expect(initial.usingGLTF).toBe(true);
    expect(second.usingGLTF).toBe(true);
    expect(await shooter.evaluate(() => Object.isFrozen(window.__mpDebug()))).toBe(true);
    await expect.poll(async () => (await snapshot(shooter)).remoteActorCount).toBe(1);
    await expect.poll(async () => (await snapshot(target)).remoteActorCount).toBe(1);

    const before = second.players.find((player) => player.sessionId === initial.sessionId);
    await focusControls(shooter);
    await shooter.keyboard.down('KeyW');
    try {
      await expect
        .poll(async () => {
          const state = await snapshot(target);
          const moved = state.players.find((player) => player.sessionId === initial.sessionId);
          return Math.hypot(moved.x - before.x, moved.z - before.z);
        })
        .toBeGreaterThan(0.25);
    } finally {
      await shooter.keyboard.up('KeyW');
    }

    // Greek Columns has central walls between the team spawns at z=46.
    // Walk around them through the open row at z=22 before aiming at the target.
    const current = await snapshot(shooter);
    const startBody = current.players.find((player) => player.sessionId === initial.sessionId);
    const targetBody = current.players.find((player) => player.sessionId === second.sessionId);
    const startLane = startBody.x < 48 ? 34 : 62;
    const targetLane = targetBody.x < 48 ? 34 : 62;
    await walkTo(shooter, initial.sessionId, startLane, startBody.z);
    await walkTo(shooter, initial.sessionId, startLane, 22);
    await walkTo(shooter, initial.sessionId, targetLane, 22);
    await walkTo(shooter, initial.sessionId, targetLane, targetBody.z);
    await shooter.mouse.move(400, 300);
    await shooter.waitForTimeout(150);
    const aiming = await snapshot(shooter);
    const body = aiming.players.find((player) => player.sessionId === initial.sessionId);
    const victim = aiming.players.find((player) => player.sessionId === second.sessionId);
    const dx = victim.x - body.x;
    const dz = victim.z - body.z;
    const desiredYaw = Math.atan2(-dx, -dz);
    const desiredPitch = Math.atan2(victim.y - body.y, Math.hypot(dx, dz));
    const yawDelta = Math.atan2(Math.sin(desiredYaw - body.yaw), Math.cos(desiredYaw - body.yaw));
    // Aim and fire through ordinary mouse input, never mutate trusted state.
    let aimX = 400 - yawDelta / MOUSE_SENS;
    let aimY = 300 - (desiredPitch - body.pitch) / MOUSE_SENS;
    await shooter.mouse.move(aimX, aimY);
    // Software WebGL can delay/coalesce a pointer-lock event. Correct through
    // ordinary mouse input until replicated aim agrees; keep the same strict bound.
    for (let attempt = 0; attempt < 4; attempt++) {
      await shooter.waitForTimeout(250);
      const state = await snapshot(shooter);
      const aimed = state.players.find((p) => p.sessionId === initial.sessionId);
      const error = Math.atan2(Math.sin(desiredYaw - aimed.yaw), Math.cos(desiredYaw - aimed.yaw));
      if (Math.abs(error) < 0.05) break;
      aimX -= error / MOUSE_SENS;
      aimY -= (desiredPitch - aimed.pitch) / MOUSE_SENS;
      await shooter.mouse.move(aimX, aimY);
    }
    await expect
      .poll(async () => {
        const state = await snapshot(shooter);
        const me = state.players.find((player) => player.sessionId === initial.sessionId);
        return Math.abs(Math.atan2(Math.sin(me.yaw - desiredYaw), Math.cos(me.yaw - desiredYaw)));
      })
      .toBeLessThan(0.05);
    await shooter.screenshot({ path: test.info().outputPath('current-rig.png') });
    const ammo = body.ammo;
    await observeFeedback(shooter);
    await observeFeedback(target);
    await shooter.mouse.down({ button: 'left' });
    await shooter.mouse.up({ button: 'left' });
    await expect.poll(() => shooter.evaluate(() => window.__observedFeedback().marker)).toBe(true);
    expect(await shooter.evaluate(() => window.__observedFeedback().numbers)).toHaveLength(1);
    expect(await target.evaluate(() => window.__observedFeedback().numbers)).toHaveLength(0);
    await expect
      .poll(async () => {
        const state = await snapshot(target);
        return state.players.find((player) => player.sessionId === second.sessionId).health;
      })
      .toBeLessThan(victim.health);
    const confirmed = await snapshot(shooter);
    expect(confirmed.players.find((player) => player.sessionId === initial.sessionId).ammo).toBe(
      ammo - 1
    );
    expect(confirmed.lastConfirmedHit).toMatchObject({ targetSessionId: second.sessionId });
    expect((await snapshot(target)).lastConfirmedHit).toBeNull();
    expect(confirmed.lastConfirmedHit.damage).toBeGreaterThan(0);
    expect(confirmed.lastConfirmedHit.impact).toEqual({
      x: expect.any(Number),
      y: expect.any(Number),
      z: expect.any(Number),
    });
  } finally {
    try {
      await Promise.all(contexts.map((context) => context.close()));
    } finally {
      await fixture.stop();
    }
  }
});

test('movement: real sprint jump crouch ADS, ramps, walls and camera restore agree in two browsers', async ({ browser }) => {
  test.setTimeout(240000);
  const fixture = await startMpFixture();
  const contexts = [];
  try {
    for (let i = 0; i < 2; i++) contexts.push(await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 0.25 }));
    const [page, peer] = await Promise.all(contexts.map((c) => c.newPage()));
    for (const p of [page, peer]) {
      await p.goto(fixture.url);
      await expect(p.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
      await p.locator('#mp-join-btn').click();
      await expect.poll(async () => (await snapshot(p)).sessionId, { timeout: 30000 }).toBeTruthy();
      await p.evaluate(() => {
        const seen = { moving: false, airborne: false };
        window.__movementSeen = () => ({ ...seen });
        setInterval(() => {
          const state = window.__mpDebug();
          const b = state.players.find((p) => p.sessionId === state.players[0]?.sessionId);
          if (b?.moving) seen.moving = true;
          if (b?.onGround === false) seen.airborne = true;
        }, 10);
      });
    }
    await expect.poll(async () => (await snapshot(page)).players.length).toBe(2);
    const initial = await snapshot(page);
    const id = initial.sessionId;
    const body = async (p = page) => (await snapshot(p)).players.find((b) => b.sessionId === id);
    const same = async (field, value) => {
      if ((field === 'moving' && value === true) || (field === 'onGround' && value === false)) {
        const observed = field === 'moving' ? 'moving' : 'airborne';
        for (const p of [page, peer]) await expect.poll(() => p.evaluate((key) => window.__movementSeen()[key], observed)).toBe(true);
        return;
      }
      try {
        await expect.poll(async () => (await body())[field]).toBe(value);
        await expect.poll(async () => (await body(peer))[field]).toBe(value);
      } catch (error) {
        throw new Error(`${field}=${value}: ${JSON.stringify(await snapshot(page))}`, { cause: error });
      }
    };
    await focusControls(page);
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyD');
    try {
      await same('sprinting', true);
      await same('moving', true);
      await expect.poll(async () => (await body()).x).toBeGreaterThan(67);
    } finally { await page.keyboard.up('KeyD'); await page.keyboard.up('ShiftLeft'); }
    await same('moving', false);
    await page.keyboard.down('ControlLeft');
    try {
      await same('crouching', true);
      await expect.poll(async () => (await body()).y).toBeCloseTo(0.85, 5);
      await page.keyboard.down('KeyA');
      try { await same('moving', true); } finally { await page.keyboard.up('KeyA'); }
    } finally { await page.keyboard.up('ControlLeft'); }
    await same('crouching', false);
    await page.keyboard.down('Space');
    try { await same('onGround', false); } finally { await page.keyboard.up('Space'); }
    await same('onGround', true);
    await expect.poll(async () => (await body()).y).toBeCloseTo(1.65, 5);
    await page.mouse.down({ button: 'right' });
    try {
      await same('aiming', true);
      await expect.poll(async () => (await snapshot(page)).aimT).toBeGreaterThan(0.9);
      await expect.poll(async () => (await snapshot(page)).cameraFov).toBeLessThan(52);
    } finally { await page.mouse.up({ button: 'right' }); }
    await same('aiming', false);
    // East ramp (tile6) rises from x76 to80 into the existing 1.4m walkway.
    await walkTo(page, id, 74, 46);
    await walkTo(page, id, 74, 30);
    await walkTo(page, id, 78, 30);
    await expect.poll(async () => {
      const b = await body(); return Math.abs(b.y - (1.65 + (b.x - 76) / 4 * 1.4));
    }).toBeLessThan(0.001);
    await walkTo(page, id, 82, 30);
    await expect.poll(async () => (await body()).y).toBeCloseTo(3.05, 5);
    await page.keyboard.down('KeyC');
    try { await same('crouching', true); await expect.poll(async () => (await body()).y).toBeCloseTo(2.25, 5); }
    finally { await page.keyboard.up('KeyC'); }
    await same('crouching', false);
    await page.keyboard.press('KeyV');
    await page.waitForTimeout(700);
    const restored = await snapshot(page);
    const current = restored.players.find((b) => b.sessionId === id);
    expect(restored.simulationEye).toEqual({ x: current.x, y: current.y, z: current.z });
    expect(restored.usingGLTF).toBe(true);
    await page.screenshot({ path: test.info().outputPath('movement-rig.png') });
    await page.keyboard.down('KeyD');
    try {
      await expect.poll(async () => (await body()).x).toBeGreaterThan(91.3);
      await page.waitForTimeout(300);
      expect((await body()).x).toBeLessThanOrEqual(92 - 0.35);
    } finally { await page.keyboard.up('KeyD'); }
    await same('moving', false);
    const stopped = await body();
    await expect.poll(async () => {
      const remote = await body(peer); return Math.abs(remote.x - stopped.x) + Math.abs(remote.y - stopped.y) + Math.abs(remote.z - stopped.z);
    }).toBeLessThan(0.00001);
    await page.evaluate(() => document.exitPointerLock());
    await expect(page.locator('#pause-resume-btn')).toBeVisible();
    await page.keyboard.down('KeyA');
    const tick = (await snapshot(page)).currentTick;
    try {
      await expect.poll(async () => (await snapshot(page)).currentTick).toBeGreaterThan(tick + 8);
      expect((await body()).x).toBe(stopped.x);
      expect((await body()).aiming).toBe(false);
    } finally { await page.keyboard.up('KeyA'); }
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
    await fixture.stop();
  }
});

test('entry: assets gate online join, leave clears actors, and offline controls remain usable', async ({ browser }) => {
  test.setTimeout(240000);
  const fixture = await startMpFixture();
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 0.25 });
  const peerContext = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 0.25 });
  let releaseAssets;
  const assetGate = new Promise((resolve) => { releaseAssets = resolve; });
  try {
    const page = await context.newPage();
    const peer = await peerContext.newPage();
    let assetHeld = false;
    await page.route('**/models/enemy.glb', async (route) => {
      assetHeld = true;
      await assetGate;
      await route.continue();
    });
    await page.goto(fixture.url, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => assetHeld).toBe(true);
    await expect(page.locator('#mp-join-btn')).toHaveCount(1);
    await expect(page.locator('#mp-leave-btn')).toHaveCount(1);
    await expect(page.locator('#mp-join-btn')).toBeDisabled();
    await expect(page.locator('#startbtn')).toBeDisabled();
    releaseAssets();
    await expect(page.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
    await expect(page.locator('#mp-actions')).toContainText('M4');
    await page.screenshot({ path: test.info().outputPath('online-menu.png') });

    await peer.goto(fixture.url);
    await expect(peer.locator('#mp-join-btn')).toBeEnabled({ timeout: 60000 });
    await peer.locator('#mp-join-btn').click();
    await page.locator('#mp-join-btn').click();
    await expect.poll(async () => (await snapshot(page)).players.length).toBe(2);
    await expect.poll(async () => (await snapshot(page)).remoteActorCount).toBe(1);
    const initial = await snapshot(page);
    expect(initial.usingGLTF).toBe(true);
    const me = initial.players.find((p) => p.sessionId === initial.sessionId);
    await expect(page.locator('#tdm-label')).toHaveText(`ONLINE · ${me.team.toUpperCase()}`);
    await expect(page.locator('#hp-num')).toHaveText(String(me.health));
    await expect(page.locator('#ammo-cur')).toHaveText(String(me.ammo));
    await expect(page.locator('#tdm-us')).toHaveText(String(me.team === 'blue' ? initial.scoreBlue : initial.scoreRed));
    await focusControls(page);
    for (const key of ['Digit2', 'Digit3', 'Digit4', 'KeyF', 'KeyG', 'KeyT', 'KeyQ', 'KeyE', 'KeyZ', 'KeyB'])
      await page.keyboard.press(key);
    await page.mouse.click(400, 300, { button: 'middle' });
    await page.mouse.click(400, 300, { button: 'right' });
    const guarded = await snapshot(page);
    expect(guarded.presentation).toMatchObject({ weapon: 'm4', punching: false, throwingNade: false, dancing: false, aiming: false, mode: null });
    expect(guarded.lastConfirmedHit).toBeNull();
    expect(guarded.score).toEqual(initial.score);
    expect(guarded.players.find((p) => p.sessionId === me.sessionId).ammo).toBe(me.ammo);

    // Ordinary fire/reload changes the replicated inventory, not a browser-owned outcome.
    await focusControls(page);
    await page.mouse.click(400, 300);
    await expect.poll(async () => (await snapshot(page)).players.find((p) => p.sessionId === me.sessionId).ammo).toBe(29);
    await page.keyboard.press('KeyR');
    await expect(page.locator('#reloadwrap')).toBeVisible();
    await expect.poll(async () => (await snapshot(page)).players.find((p) => p.sessionId === me.sessionId).ammo).toBe(30);
    await expect(page.locator('#ammo-rsv')).toHaveText('89');

    await page.evaluate(() => document.exitPointerLock());
    await expect(page.locator('#mp-leave-btn')).toBeVisible();
    await page.locator('#mp-leave-btn').click();
    await expect(page.locator('#overlay')).toBeVisible();
    expect(await snapshot(page)).toMatchObject({ sessionId: null, remoteActorCount: 0, phase: 'offline' });
    await expect.poll(async () => (await snapshot(peer)).players.length).toBe(1);
    await expect.poll(async () => (await snapshot(peer)).remoteActorCount).toBe(0);
    await expect(page.locator('#mp-join-btn')).toHaveCount(1);
    await expect(page.locator('#mp-join-btn')).toBeEnabled();

    // Rejoin exercises removal/reinstallation of the same named authority handlers.
    await page.locator('#mp-join-btn').click();
    await expect.poll(async () => (await snapshot(page)).players.length).toBe(2);
    const rejoined = await snapshot(page);
    expect(rejoined.sessionId).not.toBe(initial.sessionId);
    await page.evaluate(() => document.exitPointerLock());
    await expect(page.locator('#pause-mainmenu-btn')).toBeVisible();
    await page.locator('#pause-mainmenu-btn').click();
    await expect(page.locator('#overlay')).toBeVisible();
    await expect(page.locator('#range-startbtn')).toBeEnabled();
    await page.locator('#range-startbtn').click();
    await expect(page.locator('#overlay')).toBeHidden();
    await page.keyboard.press('Digit4');
    await expect(page.locator('#weapon-name')).toHaveText('M9');
    expect((await snapshot(page)).presentation).toMatchObject({ weapon: 'pistol', mode: 'range', gameRunning: true });
    expect((await snapshot(page)).sessionId).toBeNull();
    await page.screenshot({ path: test.info().outputPath('offline-after-online.png') });
  } finally {
    releaseAssets();
    await context.close();
    await peerContext.close();
    await fixture.stop();
  }
});
