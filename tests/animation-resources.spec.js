import { test, expect } from '@playwright/test';

test('resources: a failed owner callback still retires every real clone resource once', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#range-startbtn')).toBeEnabled({ timeout: 60000 });
  await page.locator('#range-startbtn').click();
  const result = await page.evaluate(async () => {
    const src = new URL('src/', location.href).href;
    const g = await import(src + 'builders/enemyGLTF.js');
    const r = await import(src + 'builders/characterResources.js');
    const { scene } = await import(src + 'scene.js');
    const actor = g.buildEnemyMesh(2, 2); scene.add(actor.mesh);
    let later = 0, failures = 0;
    r.registerCharacterDisposer(actor.mesh, () => { throw Error('retired owner failed'); });
    r.registerCharacterDisposer(actor.mesh, () => { ++later; });
    for (let i = 0; i < 2; i++) {
      try { r.disposeCharacter(actor.mesh, actor.mixer); } catch { ++failures; }
    }
    const next = g.buildEnemyMesh(3, 2);
    const usable = !!next.mesh.getObjectByName('HumanBody');
    r.disposeCharacter(next.mesh, next.mixer);
    return { later, failures, attached: !!actor.mesh.parent, active: actor.mixer.stats.bindings.inUse, usable };
  });
  expect(result).toEqual({ later: 1, failures: 1, attached: false, active: 0, usable: true });
});

test('resources: retiring a real first-person weapon view preserves its live source material', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#range-startbtn')).toBeEnabled({timeout:60000});
  await page.locator('#range-startbtn').click();
  const result=await page.evaluate(async()=>{
    const src=new URL('src/',location.href).href;
    const g=await import(src+'builders/enemyGLTF.js'),f=await import(src+'builders/firstPersonRig.js');
    const r=await import(src+'builders/characterResources.js');
    const {camera,scene}=await import(src+'scene.js'),{wpn}=await import(src+'builders/weapon.js');
    const keeper=g.buildEnemyMesh(1,1);const rig=f.createFirstPersonRig({source:keeper.mesh});
    const gun=f.cloneVisualHierarchy(wpn);let sourceDisposals=0;
    const material=gun.getObjectByName('m4_1p').getObjectByProperty('isMesh',true).material.clone();
    material.userData.characterOwned=true;
    gun.getObjectByName('m4_1p').getObjectByProperty('isMesh',true).material=material;
    material.addEventListener('dispose',()=>++sourceDisposals);
    scene.add(keeper.mesh,rig.arms,rig.body);
    f.updateFirstPersonRig(rig,{pose:{identity:'keeper',weapon:'m4',alive:true,upper:'ready',action:{phase:0}},camera,weapon:gun});
    f.disposeFirstPersonRig(rig);f.disposeFirstPersonRig(rig);
    const before=sourceDisposals;
    r.disposeCharacter(gun);r.disposeCharacter(keeper.mesh,keeper.mixer);
    return{before,after:sourceDisposals};
  });
  expect(result).toEqual({before:0,after:1});
});
