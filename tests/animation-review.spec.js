import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as portProbe } from 'node:net';
import { once } from 'node:events';
import { startMpFixture } from './helpers/mpServer.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
let server, url;
test.beforeAll(async () => {
  const probe = portProbe(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  server = await createServer({ root: ROOT, base: '/',
    server: { host: '127.0.0.1', port, strictPort: true,
      watch: { ignored: ['**/.planning/**', '**/tools/art/sources/**'] } } });
  await server.listen(); url = `http://127.0.0.1:${server.httpServer.address().port}/`;
});
test.afterAll(async () => { await server?.close(); });
async function range(page) {
  await page.goto(url); await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 30000 });
  await page.locator('#range-startbtn').click();
  await page.keyboard.press('F3');
}
async function live(page) {
  return page.evaluate(async () => {
    const { player } = await import('/src/entities/player.js');
    const { camera } = await import('/src/scene.js');
    return { weapon: player.weapon, ammo: player.ammo, hp: player.hp,
      position: camera.position.toArray(), reload: player.reloadTimer };
  });
}
test('tracer: isolated real M4 playback pauses, scrubs, resets and closes without outcomes', async ({ page }) => {
  await range(page);
  await expect(page.getByRole('button', { name: 'Open animation review', exact: true })).toBeVisible({ timeout: 1500 });
  await expect(page.getByRole('button', { name: 'Open animation review', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Animation review', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play transition', exact: true })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(false);
  await page.evaluate(async () => {
    const { beginPlayerAction } = await import('/src/entities/player.js');
    window.__liveReviewMarkers = 0;
    if (!beginPlayerAction('throw', .2, [{ at: .1, run() { window.__liveReviewMarkers++; } }]))
      throw Error('Live action fixture did not start');
  });
  const frozenSource = await page.evaluate(async () => {
    const { playerActions } = await import('/src/entities/player.js');
    const { playerMixer, playerMesh } = await import('/src/builders/enemyGLTF.js');
    return { action: playerActions.presentation, time: playerMixer.time, root: playerMesh.position.toArray() };
  });
  const before = await live(page);
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => window.__animationReviewDebug().phase)).toBe(0);
  await page.getByLabel('Transition', { exact: true }).selectOption('reload');
  await expect(page.getByRole('button', { name: 'Play transition', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Play transition', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__animationReviewDebug().phase)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause transition', exact: true }).click();
  await page.getByLabel('Animation phase', { exact: true }).fill('40');
  const debug = await page.evaluate(() => window.__animationReviewDebug());
  expect(debug.phase).toBe(.4); expect(debug.actorCount).toBe(1); expect(debug.viewCount).toBe(1);
  expect(debug.actor.joints).toBe(65); expect(debug.actor.contacts.leftError).toBeLessThan(.025);
  expect(await live(page)).toEqual(before);
  expect(await page.evaluate(async () => {
    const { playerActions } = await import('/src/entities/player.js');
    const { playerMixer, playerMesh } = await import('/src/builders/enemyGLTF.js');
    return { action: playerActions.presentation, time: playerMixer.time, root: playerMesh.position.toArray() };
  })).toEqual(frozenSource);
  expect(await page.evaluate(() => window.__liveReviewMarkers)).toBe(0);
  await page.getByRole('button', { name: 'Reset preview', exact: true }).click();
  expect(await page.evaluate(() => window.__animationReviewDebug().phase)).toBe(0);
  await page.getByRole('button', { name: 'Close review', exact: true }).click();
  expect(await page.evaluate(() => window.__animationReviewDebug().actorCount)).toBe(0);
  await expect(page.getByRole('button', { name: 'Open animation review', exact: true })).toBeFocused();
  expect(await page.evaluate(() => !!document.pointerLockElement)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__liveReviewMarkers)).toBe(1);
});

async function open(page) { await range(page); await page.keyboard.press('Enter'); await expect(page.getByRole('button',{name:'Play transition',exact:true})).toBeEnabled(); }
async function fixture(page, kind) {
  await page.goto(url); await expect(page.locator('#range-startbtn')).toBeEnabled({timeout:30000});
  await page.evaluate(async kind => {
    document.getElementById('developer-animation-diagnostics').remove();
    const { initAnimationReview }=await import('/src/dev/animationReview.js');
    let count=0; window.__fixtureCalls=[];
    const resource=()=>({duration:1, update(){},render(){},dispose(){window.__fixtureCalls.push('dispose');},
      compatibleScenarios:kind==='one'?['ready']:kind==='zero'?[]:undefined,
      partial:kind==='partial', identity:{source:'<img onerror=alert(1)>'.repeat(40),export:'abcdef'.repeat(70)},
      getFrozenDebug:()=>({joints:65})});
    const owner=initAnimationReview({eligible:()=>'',suspend(){},restore(){},createActor:()=>{
      count++; if(kind==='loading')return new Promise(resolve=>window.__fixtureResolve=()=>resolve(resource()));
      if(kind==='error'&&count===1)return Promise.reject(Error('<svg onload=alert(1)>'));
      if(kind==='empty'||kind==='zero')return Promise.resolve(null);return Promise.resolve(resource());
    }});
    window.__reviewFixture=owner; owner.toggleDiagnostics(); owner.open();
  },kind);
}
test('UI-01/06/13/24: empty keeps selections, quality and Close while disabling playback', async ({page})=>{
  await fixture(page,'empty'); await expect(page.getByText('Animation preview unavailable',{exact:true})).toBeVisible();
  await expect(page.getByText('No compatible motion is available for this selection. Choose another transition or close review to keep playing.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Play transition',exact:true})).toBeDisabled();
  await expect(page.getByLabel('Weapon',{exact:true})).toBeEnabled(); await expect(page.getByRole('button',{name:'Close review',exact:true})).toBeEnabled();
  expect(await page.locator('#graphics-quality-menu,#graphics-quality-pause').count()).toBe(2);
});
test('UI-02/07/14/21/25: loading preserves Close and retires stale load without focus theft',async({page})=>{
  await fixture(page,'loading'); await expect(page.getByRole('status').filter({hasText:'Loading animation preview…'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Play transition',exact:true})).toBeDisabled();
  await expect(page.getByLabel('Animation phase',{exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Close review',exact:true}).click();
  await page.evaluate(()=>window.__fixtureResolve());
  await expect(page.getByRole('button',{name:'Open animation review',exact:true})).toBeFocused();
  expect(await page.evaluate(()=>window.__fixtureCalls)).toEqual(['dispose']);
});
test('UI-03/08/15/22/26: recoverable error Retry keeps one current actor',async({page})=>{
  await fixture(page,'error'); await expect(page.getByText('Animation preview could not load. Select Retry preview, or close review to keep playing.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Retry preview',exact:true}).click();
  await expect(page.getByRole('button',{name:'Play transition',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>window.__reviewFixture.getFrozenDebug().actorCount)).toBe(1);
  await expect(page.getByRole('button',{name:'Retry preview',exact:true})).toBeHidden();
});
test('UI-04/10/27: visible partial fallback disables detailed comparisons with reason',async({page})=>{
  await fixture(page,'partial'); await expect(page.getByText('Using fallback weapon geometry. Detailed handling for M4A1 is unavailable.',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Transition',{exact:true}).locator('option[value="reload"]')).toHaveJSProperty('disabled',true);
  await expect(page.getByText('Detailed handling comparisons are unavailable for this fallback.',{exact:true})).toBeVisible();
});
test('UI-05/18/20/23/28: long identity wraps as text with native focus at narrow width',async({page})=>{
  await page.setViewportSize({width:360,height:700}); await fixture(page,'long');
  const panel=page.getByRole('region',{name:'Animation review',exact:true});
  await expect(panel.locator('img,svg')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(360);
  const layout=await panel.evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,scroll:el.scrollHeight>el.clientHeight}));
  expect(layout.width).toBeLessThanOrEqual(328); expect(layout.height).toBeLessThanOrEqual(350); expect(layout.scroll).toBe(true);
  await page.getByRole('button',{name:'Close review',exact:true}).focus(); await page.keyboard.press('Escape');
  await expect(panel).toBeHidden(); await expect(page.getByRole('button',{name:'Open animation review',exact:true})).toBeFocused();
});
test('UI-09/16: sixteen actual scenarios and all three views use one accepted actor/view',async({page})=>{
  test.setTimeout(180000); await open(page); const before=await live(page);
  expect(await page.getByLabel('Transition',{exact:true}).locator('option').count()).toBe(16);
  for(const scenario of ['ready','locomotion','sprint','crouch','jump','ads-fire','reload','reload-melee','reload-grenade','damage','death','supersprint','slide','dive','prone','sprint-reload']) {
    await page.getByLabel('Transition',{exact:true}).selectOption(scenario); await expect(page.getByRole('button',{name:'Play transition',exact:true})).toBeEnabled();
    await page.getByLabel('Animation phase',{exact:true}).fill('60');
    const debug=await page.evaluate(()=>window.__animationReviewDebug());
    expect(debug.actorCount).toBe(1);expect(debug.viewCount).toBe(1);expect(debug.actor.joints).toBe(65);
    if(['supersprint','slide','dive','prone','sprint-reload'].includes(scenario))await expect(page.locator('#animation-review-status')).toContainText('Preview —');
  }
  for(const view of ['first','down','third']) {await page.getByLabel('View',{exact:true}).selectOption(view);await expect(page.getByRole('button',{name:'Play transition',exact:true})).toBeEnabled();}
  const evidence=path.join(ROOT,'.planning/research/.cache/07-08-qualified');
  await mkdir(evidence,{recursive:true}); const observations=[];
  for(const tier of ['low','medium','high']) {
    await page.getByRole('button',{name:'Close review',exact:true}).click();
    await page.locator('#graphics-quality-pause').selectOption(tier);
    await page.getByRole('button',{name:'Open animation review',exact:true}).click();
    for(const weapon of ['m4','p90','awp','pistol']) {
      await page.getByLabel('Transition',{exact:true}).selectOption('ready');
      await page.getByLabel('Weapon',{exact:true}).selectOption(weapon);
      await expect(page.getByRole('button',{name:'Play transition',exact:true})).toBeEnabled();
      for(const view of ['first','down','third']) {
        await page.getByLabel('View',{exact:true}).selectOption(view);
        await expect(page.getByRole('button',{name:'Play transition',exact:true})).toBeEnabled();
        await page.getByLabel('Animation phase',{exact:true}).fill('40');
        const debug=await page.evaluate(()=>window.__animationReviewDebug());
        expect(debug.actor.joints).toBe(65);expect(debug.actor.armsAttached).toBe(true);expect(debug.actor.weapon).toBe(weapon);expect(debug.actor.view).toBe(view);
        expect(debug.actor.partial).toBe(weapon==='p90');
        if(weapon!=='p90') {
          expect(debug.actor.contacts.leftError).toBeLessThan(.025);
          if(view!=='third') {
            const contacts=debug.actor.viewContacts.find(owner=>owner.weapon===weapon).contacts;
            expect(contacts.leftError).toBeLessThan(.025);expect(contacts.rightError).toBeLessThan(.025);
          }
        }
        observations.push({tier,weapon,view,actor:debug.actor,identity:debug.identity});
        await page.locator('#animation-review,#animation-review-diagnostics').evaluateAll(els=>els.forEach(el=>el.style.visibility='hidden'));
        await page.screenshot({path:`${evidence}/${weapon}-${tier}-${view}.png`});
        await page.locator('#animation-review,#animation-review-diagnostics').evaluateAll(els=>els.forEach(el=>el.style.visibility=''));
      }
    }
  }
  await writeFile(`${evidence}/observations.json`,JSON.stringify(observations,null,2));
  expect(await live(page)).toEqual(before);
});
test('UI-11/17/19: keyboard document order, 44px controls and scroll never widen viewport',async({page})=>{
  await open(page); await page.getByLabel('Weapon',{exact:true}).focus(); await page.keyboard.press('Tab');
  await expect(page.getByLabel('View',{exact:true})).toBeFocused(); await page.keyboard.press('Tab');await expect(page.getByLabel('Transition',{exact:true})).toBeFocused();
  const boxes=await page.locator('#animation-review button:visible,#animation-review select:visible,#animation-review input:visible').evaluateAll(els=>els.map(el=>({height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width})));
  expect(boxes.every(b=>b.height>=44&&b.width>=44)).toBe(true);
  const before=await live(page); await page.keyboard.press('KeyR');await page.keyboard.press('Digit2');await page.keyboard.press('KeyV'); expect(await live(page)).toEqual(before);
});
test('UI-12: zero/one/many compatible choices share fixed select and disabled reasons',async({page})=>{
  await fixture(page,'one'); expect(await page.getByLabel('Transition',{exact:true}).locator('option:enabled').count()).toBe(1);
  await expect(page.getByText('This motion candidate has not been exported. Choose another transition.',{exact:true})).toBeVisible();
  await fixture(page,'zero'); await expect(page.getByRole('button',{name:'Play transition',exact:true})).toBeDisabled();
});
test('production: real same-origin online game has no active review controls',async({page})=>{
  test.setTimeout(120000); const previousEnv=process.env.NODE_ENV;process.env.NODE_ENV='production';
  const fixture=await startMpFixture();try {
    await page.goto(fixture.url);await expect(page.locator('#mp-join-btn')).toBeEnabled({timeout:30000});
    await page.locator('#mp-join-btn').click(); await expect(page.locator('#mp-match-controls')).toBeVisible({timeout:30000});
    await page.keyboard.press('F3');await expect(page.getByRole('button',{name:'Open animation review',exact:true})).toHaveCount(0);
    await expect(page.getByRole('region',{name:'Animation review',exact:true})).toHaveCount(0);
  }finally{await fixture.stop();if(previousEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previousEnv;}
});
