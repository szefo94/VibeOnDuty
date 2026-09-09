import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#startbtn')).toBeEnabled({ timeout: 20000 });
});

test('real character returns from shooting and dies without leftover locomotion', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const g = await import(src + 'builders/enemyGLTF.js');
    const a = await import(src + 'builders/enemyAnimations.js');
    const { killEnemy } = await import(src + 'entities/enemies.js');
    const actor = () => Object.assign(g.buildEnemyMesh(0, 0), {
      x: 0, z: 0, facingY: 0, currentClip: 'idle', onGround: true,
      _prevOnGround: true, stunTimer: 0, crouching: false, muzzleFlashT: 0, state: 'attack',
    });
    const e = actor();
    a.tickEnemyAnimation(e, 0.016);
    e.muzzleFlashT = 55;
    for (let i = 0; i < 4; i++) a.tickEnemyAnimation(e, 0.016);
    e.muzzleFlashT = 0;
    e.state = 'patrol';
    for (let i = 0; i < 40; i++) a.tickEnemyAnimation(e, 0.016);
    const idleWeight = e.actions.idle.getEffectiveWeight();
    g.disposeEnemyMesh(e.mesh, e.mixer);
    const deaths = [];
    for (const team of ['friend', 'enemy']) {
      const d = actor();
      d.state = 'patrol'; d._prevZ = 0; d.z = 0.0288; d.sndTeam = team;
      a.tickEnemyAnimation(d, 0.016);
      killEnemy(d);
      d.mixer.update(0.8);
      deaths.push({
        death: d.actions.death.getEffectiveWeight(),
        competing: Object.entries(d.actions).filter(([key, action]) =>
          key !== 'death' && action.isScheduled() && action.getEffectiveWeight() > 0).map(([key]) => key),
      });
    }
    return { idleWeight, deaths };
  });
  expect(result.idleWeight).toBe(1);
  for (const death of result.deaths) {
    expect(death.death).toBe(1);
    expect(death.competing).toEqual([]);
  }
});

test('player and enemy weapons follow the armed poses with the barrel forward and scope upright', async ({ page }) => {
  const poses = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const g = await import(src + 'builders/enemyGLTF.js');
    const w = await import(src + 'builders/weapon.js');
    const T = window.__THREE, result = [];
    for (const role of ['player', 'assault', 'smg', 'sniper', 'pistol']) {
      const e = role === 'player'
        ? { mesh: g.playerMesh, mixer: g.playerMixer, actions: g.playerActions }
        : g.buildEnemyMesh(0, 0, role);
      const mount = role === 'player' ? w.weapon3p : e.mesh.getObjectByName('enemyWeaponMount');
      for (const key of ['idle', 'crouch', 'crouch_walk', 'jump_start', 'jump_loop', 'jump_land']) {
        e.mixer.stopAllAction();
        const action = e.actions[key];
        action.reset().setEffectiveWeight(1).play();
        e.mixer.update(action.getClip().duration * 0.4);
        e.mesh.updateMatrixWorld(true);
        const q = mount.getWorldQuaternion(new T.Quaternion());
        result.push({ role, key,
          forward: new T.Vector3(0, 0, -1).applyQuaternion(q).z,
          up: new T.Vector3(0, 1, 0).applyQuaternion(q).y,
        });
      }
    }
    return result;
  });
  for (const pose of poses) {
    expect(pose.forward, `${pose.role}:${pose.key}:forward`).toBeGreaterThan(0.85);
    expect(pose.up, `${pose.role}:${pose.key}:up`).toBeGreaterThan(0.8);
  }
});

test('repeated character removal frees instance GPU allocations and preserves live shared geometry', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const g = await import(src + 'builders/enemyGLTF.js');
    const { buildEnemy } = await import(src + 'builders/enemy.js');
    const T = window.__THREE;
    const renderer = new T.WebGLRenderer(); renderer.setSize(128, 128);
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(40, 1, 0.1, 20);
    scene.add(new T.HemisphereLight(0xffffff, 0x999999, 2));
    camera.position.set(2, 1.8, 3); camera.lookAt(0, 0.9, 0);
    const keeper = g.buildEnemyMesh(0, 0);
    scene.add(keeper.mesh); keeper.mixer.update(0);
    let sharedDisposals = 0;
    keeper.mesh.traverse(n => {
      if (n.isSkinnedMesh) n.geometry.addEventListener('dispose', () => sharedDisposals++);
    });
    const counts = [];
    for (let cycle = 0; cycle < 4; cycle++) {
      for (const role of ['assault', 'smg', 'sniper', 'pistol', 'fallback']) {
        const e = role === 'fallback' ? buildEnemy(0, 0) : g.buildEnemyMesh(0, 0, role);
        g.tintEnemyMesh(e.mesh, 0x00bb44);
        scene.add(e.mesh); e.mixer?.update(0);
        renderer.render(scene, camera);
        g.disposeEnemyMesh(e.mesh, e.mixer);
        renderer.render(scene, camera);
      }
      counts.push({ ...renderer.info.memory });
    }
    renderer.dispose();
    return { counts, sharedDisposals };
  });
  expect(result.sharedDisposals).toBe(0);
  for (const count of result.counts) expect(count).toEqual(result.counts[0]);
});

test('grenade releases once at the throw marker and cancels on death', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const { player } = await import(src + 'entities/player.js');
    const g = await import(src + 'entities/grenades.js');
    const { emit } = await import(src + 'events.js');
    const { GRENADE_THROW_DUR: duration, GRENADE_RELEASE_FRACTION: fraction } = await import(src + 'config.js');
    player.energy = 100;
    const initial = g.grenades.length;
    g.tryThrowGrenade();
    g.tickGrenades(duration * fraction - 0.01);
    const before = g.grenades.length - initial;
    g.tickGrenades(0.02);
    const released = g.grenades.length - initial;
    g.tickGrenades(duration * (1 - fraction));
    const finished = !player.throwingNade;
    player.energy = 100;
    g.tryThrowGrenade();
    emit('player:died');
    g.tickGrenades(duration);
    return { before, released, finished, afterCancel: g.grenades.length - initial };
  });
  expect(result).toEqual({ before: 0, released: 1, finished: true, afterCancel: 1 });
});

test('the live player controller fits reload, grenade and roll clips to gameplay time', async ({ page }) => {
  await page.locator('#range-startbtn').click();
  await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const { player } = await import(src + 'entities/player.js');
    const { playerActions: actions } = await import(src + 'builders/enemyGLTF.js');
    const config = await import(src + 'config.js');
    window.__testAnimation = { player, actions, config };
    player.reloading = true; player.reloadTotal = 1800; player.reloadTimer = 1800;
  });
  await page.waitForFunction(() => window.__testAnimation.actions.reload.isRunning());
  expect(await page.evaluate(() => {
    const a = window.__testAnimation.actions.reload;
    return a.getClip().duration / a.getEffectiveTimeScale();
  })).toBeCloseTo(1.8);
  await page.evaluate(() => {
    const { player, config } = window.__testAnimation;
    player.reloading = false; player.rollTimer = config.ROLL_ANIM_DUR;
  });
  await page.waitForFunction(() => window.__testAnimation.actions.roll.isRunning());
  expect(await page.evaluate(() => {
    const { actions, config } = window.__testAnimation;
    return actions.roll.getClip().duration / actions.roll.getEffectiveTimeScale() - config.ROLL_ANIM_DUR;
  })).toBeCloseTo(0);
  await page.evaluate(async () => {
    const { player } = window.__testAnimation;
    player.energy = 100;
    const src = new URL('src/', location.href).href;
    (await import(src + 'entities/grenades.js')).tryThrowGrenade();
  });
  await page.waitForFunction(() => window.__testAnimation.actions.nade.isRunning());
  expect(await page.evaluate(() => {
    const { actions, config } = window.__testAnimation;
    return actions.nade.getClip().duration / actions.nade.getEffectiveTimeScale() - config.GRENADE_THROW_DUR;
  })).toBeCloseTo(0);
});
