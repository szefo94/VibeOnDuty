import manifest from '../../tools/art/motion-manifest.json';

const clamp = n => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const freezeObservation = value => {
  if(value===null||typeof value!=='object')return value;
  const copy=Array.isArray(value)?value.map(freezeObservation):Object.fromEntries(Object.entries(value).map(([key,item])=>[key,freezeObservation(item)]));
  return Object.freeze(copy);
};
export const REVIEW_COPY = Object.freeze({
  loading: 'Loading animation preview…',
  empty: 'No compatible motion is available for this selection. Choose another transition or close review to keep playing.',
  error: 'Animation preview could not load. Select Retry preview, or close review to keep playing.',
  missing: 'This motion candidate has not been exported. Choose another transition.',
  online: 'Animation review is available in offline Training Range. Leave online before opening review.',
  death: 'Finish the current death view before opening animation review.',
  exit: 'Review closed. Select Resume to capture the mouse and continue.',
});
export const REVIEW_WEAPONS = Object.freeze({ m4: 'M4A1', p90: 'P90', awp: 'AWP', pistol: 'M9' });
export const REVIEW_VIEWS = Object.freeze({ first: 'First person', down: 'Looking down', third: 'Third person' });
export const REVIEW_SCENARIOS = Object.freeze({ ready: 'Ready', locomotion: 'Directional locomotion',
  sprint: 'Normal sprint', crouch: 'Crouch', jump: 'Jump and landing', 'ads-fire': 'ADS and fire',
  reload: 'Reload', 'reload-melee': 'Reload to melee', 'reload-grenade': 'Reload to grenade',
  damage: 'Damage', death: 'Directional death', supersprint: 'Preview — supersprint',
  slide: 'Preview — slide', dive: 'Preview — dive', prone: 'Preview — prone',
  'sprint-reload': 'Preview — sprint reload rules' });
const baseReload = { m4:1.8, p90:2, awp:2.5, pistol:1.2 };
const detailedScenarios=['reload','reload-melee','reload-grenade','ads-fire','sprint-reload'];
let exportIdentity;
async function getExportIdentity() {
  exportIdentity ??= fetch(`${import.meta.env.BASE_URL}models/enemy.glb`).then(async response => {
    if(!response.ok)throw Error('Export identity unavailable');
    const digest=await crypto.subtle.digest('SHA-256',await response.arrayBuffer());
    return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  }).catch(error=>{exportIdentity=null;throw error;});
  return exportIdentity;
}
export function sampleReviewScenario(selection, phase, reset = false) {
  const weapon = selection.weapon, p = clamp(phase), key = reset ? 'ready' : selection.scenario;
  const base = baseReload[weapon], sprintReload = base * 1.15;
  const duration = key === 'reload' ? base : key === 'sprint-reload' ? sprintReload + base * .4 + .8 : 3;
  const time = duration * p;
  let clip = `${weapon}_ready`, upper = 'ready', actionPhase = p, clipPhase=p, actionTotal = 1;
  let aiming = false, oneHandedCarry = false, moving = false;
  if (['locomotion','sprint','crouch'].includes(key)) {
    const directions = ['forward','right','back','left'];
    clip = key === 'crouch' && p < .2 ? 'crouch_idle' : `${key === 'sprint' ? 'run' : key === 'crouch' ? 'crouch' : 'walk'}_${directions[Math.min(3,Math.floor(p*4))]}`;
    moving = !clip.endsWith('idle'); upper = key === 'sprint' ? 'sprint' : 'ready';
  } else if (key === 'jump') {clip = p < .2 ? 'jump_start' : p < .7 ? 'jump_loop' : 'jump_land';clipPhase=p<.2?p/.2:p<.7?(p-.2)/.5:(p-.7)/.3;}
  else if (key === 'ads-fire') { aiming = true; upper = p > .35 && p < .75 ? 'fire' : 'ads'; clip = `${weapon}_${upper}`; actionPhase = clamp((p-.35)/.4); actionTotal = weapon === 'awp' ? 1.1 : .2; }
  else if (key.startsWith('reload')) {
    upper = 'reload'; clip = `${weapon}_reload`; actionTotal = base;
    if (key !== 'reload') {
      if(p<.4) actionPhase=p/.4*.65;
      else { upper=key==='reload-melee'?'melee':'throw'; clip=upper==='melee'?'melee_cross':'throw';actionPhase=(p-.4)/.6;actionTotal=upper==='throw'?.9:.7; }
    }
  } else if (key === 'damage') clip = 'damage';
  else if (key === 'death') { clip='death_front';upper='death'; }
  else if (key === 'supersprint') { clip='supersprint';upper='supersprint';oneHandedCarry=true;moving=true; }
  else if (['slide','dive','prone'].includes(key)) { clip=`${key}_${p<.25?'entry':p<.7?'hold':'exit'}`;upper=key;clipPhase=p<.25?p/.25:p<.7?(p-.25)/.45:(p-.7)/.3; }
  else if (key === 'sprint-reload') {
    moving = true;
    if(time<sprintReload) {clip=`${weapon}_sprint_reload`;upper='reload';actionTotal=sprintReload;actionPhase=time/sprintReload;}
    else if(time<sprintReload+base*.4){clip=`${weapon}_reload`;upper='reload';actionTotal=base;actionPhase=(time-sprintReload)/base;}
    else{clip='supersprint';upper='supersprint';oneHandedCarry=true;actionPhase=1;}
  }
  return Object.freeze({ clip, upper, phase:p, clipPhase:clamp(clipPhase), actionPhase:clamp(actionPhase), actionTotal, duration,
    aiming, moving, crouching:key==='crouch', alive:key!=='death', oneHandedCarry,
    previewOnly:REVIEW_SCENARIOS[key]?.startsWith('Preview —')===true,
    reloadDurationSeconds:sprintReload, baseReloadSeconds:base, sourceOwner:key==='death'?'body-heading-fallback':null });
}
function compatibleScenarios(actions, weapon) {
  const has = id => !!actions[id];
  const needs = { ready:[`${weapon}_ready`], locomotion:['walk_forward','walk_back','walk_left','walk_right'],
    sprint:['run_forward','run_back','run_left','run_right'],crouch:['crouch_idle','crouch_forward'],
    jump:['jump_start','jump_loop','jump_land'],'ads-fire':[`${weapon}_ads`,`${weapon}_fire`],reload:[`${weapon}_reload`],
    'reload-melee':[`${weapon}_reload`,'melee_cross'],'reload-grenade':[`${weapon}_reload`,'throw'],damage:['damage'],
    death:['death_front'],supersprint:['supersprint'],slide:['slide_entry','slide_hold','slide_exit'],
    dive:['dive_entry','dive_hold','dive_exit'],prone:['prone_entry','prone_hold','prone_exit'],
    'sprint-reload':[`${weapon}_sprint_reload`, 'supersprint'] };
  return Object.keys(REVIEW_SCENARIOS).filter(key => needs[key].every(has));
}

/** Actual accepted template and shared pose/view pipeline; no live actor is driven. */
export async function createActualReviewActor(selection, { scene, renderer, origin, weapon, worldWeapon, liveBody = null }) {
  const THREE = await import('three');
  const gltf = await import('../builders/enemyGLTF.js');
  const fp = await import('../builders/firstPersonRig.js');
  const driver = await import('../builders/enemyAnimations.js');
  const handling = await import('../builders/weaponHandling.js');
  const { disposeCharacter } = await import('../builders/characterResources.js');
  const { renderComicScene } = await import('../comicOutline.js');
  const { WEAPON3P_ROT, WEAPON3P_GRIP } = await import('../builders/weapon3pTransform.js');
  if(manifest.schemaVersion!==1||!Array.isArray(manifest.actions)||!manifest.sourceHash)throw Error('Unsupported motion manifest');
  const exportHash=await getExportIdentity();
  const actor = gltf.createReviewCharacter(selection.weapon);
  const compatible = compatibleScenarios(actor.actions, selection.weapon);
  if (!compatible.includes(selection.scenario)) { disposeCharacter(actor.mesh,actor.mixer); return null; }
  const view = fp.createFirstPersonRig({ source: actor.mesh });
  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, .05, 120);
  const cloneGun = source => {
    const copy = fp.cloneVisualHierarchy(source);
    copy.traverse(node => { if (node.isMesh) {
      node.geometry = node.geometry.clone();
      const own = material => material.userData.characterOwned ? material.clone() : material;
      node.material = Array.isArray(node.material) ? node.material.map(own) : own(node.material);
    } });
    for (const child of copy.children) {
      const original = source.getObjectByName(child.name), owner = handling.getWeaponHandling(original);
      for (const [part, rest] of owner?.rest ?? []) { const owned = child.getObjectByName(part.name); owned?.position.copy(rest.position); owned?.quaternion.copy(rest.quaternion); }
      child.visible = child.name === `${selection.weapon}_${source === weapon ? '1p' : '3p'}`;
    }
    return copy;
  };
  const gun = cloneGun(weapon), mounted = cloneGun(worldWeapon);
  camera.add(gun); scene.add(camera, actor.mesh, view.body, view.arms);
  actor.mesh.position.set(origin.x + 3, origin.y - 1.65, origin.z + 3);
  actor.mesh.getObjectByName('hand_r').add(mounted);
  mounted.position.copy(WEAPON3P_GRIP); mounted.rotation.copy(WEAPON3P_ROT);
  const root = mounted.getObjectByName(`${selection.weapon}_3p`);
  const worldHandler = handling.createWeaponHandling({ weapon: selection.weapon, root, skeleton: actor.mesh });
  const duration = sampleReviewScenario(selection,0).duration;
  const prop = new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),new THREE.MeshStandardMaterial({color:0x414535}));
  prop.material.userData.characterOwned = true;
  actor.mesh.getObjectByName('hand_l').add(prop);
  const viewProp=prop.clone();viewProp.geometry=prop.geometry.clone();viewProp.material=prop.material.clone();view.arms.getObjectByName('hand_l').add(viewProp);
  const anchor = actor.mesh.position.clone();
  let pose, disposed = false;
  const update = (phase, reset, dt) => {
    const sample = sampleReviewScenario(selection,phase,reset);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    handling.restoreWeaponHandlingBones(worldHandler);
    pose = driver.tickPresentation(actor, { identity: 'review', generation: 'review',
      position: { x: actor.mesh.position.x, y: actor.mesh.position.y + 1.65, z: actor.mesh.position.z },
      sampleTimeSeconds: phase * duration, bodyYaw: -Math.PI, aimYaw: -Math.PI,
      weapon: selection.weapon, alive: sample.alive, onGround: true,
      aiming:sample.aiming, crouching:sample.crouching,
      action: {kind:sample.upper,total:sample.actionTotal,elapsed:sample.actionPhase*sample.actionTotal}, reducedMotion }, 0);
    // Seek the same prepared source clip on the one source mixer. No simulation markers.
    actor.mixer.stopAllAction();
    const clip = actor.actions[reducedMotion && sample.clip==='damage' ? `${selection.weapon}_ready` : sample.clip];
    clip.reset().setEffectiveWeight(1).setEffectiveTimeScale(0).play();
    clip.time = clip.getClip().duration * (sample.upper==='reload'||sample.upper==='fire'||sample.upper==='throw'||sample.upper==='melee' ? sample.actionPhase : sample.clipPhase);
    pose = Object.freeze({...pose,upper:sample.upper,alive:sample.alive,aiming:sample.aiming,
      moving:sample.moving,phase,previewOnly:sample.previewOnly,oneHandedCarry:sample.oneHandedCarry,
      action:Object.freeze({kind:sample.upper,phase:sample.actionPhase,total:sample.actionTotal}),
      deathPhase:sample.alive?0:phase,deathDirectionSource:'body-heading-fallback'});
    actor.presentation = pose; actor._inertia = null;
    driver.finishPresentation(actor,0);
    actor.mesh.position.copy(anchor);
    if(selection.scenario==='jump'&&!reset)actor.mesh.position.y+=Math.max(0,Math.sin(Math.PI*phase))*.3;
    prop.visible=sample.upper==='throw'&&sample.actionPhase<.45;
    viewProp.visible=prop.visible;
    handling.updateWeaponHandling(worldHandler, pose);
    const p = actor.mesh.position;
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    if(innerWidth>=768)camera.setViewOffset(innerWidth,innerHeight,180,0,innerWidth,innerHeight);else camera.clearViewOffset();
    if (selection.view === 'third') { camera.position.set(p.x - 2.5,p.y + 1.6,p.z + 3); camera.lookAt(p.x,p.y + 1,p.z); }
    else { camera.position.set(p.x,p.y + (sample.crouching?1.25:1.65),p.z); camera.quaternion.setFromEuler(new THREE.Euler(selection.view === 'down' ? -1.3 : 0, -Math.PI, 0, 'YXZ')); }
    fp.updateFirstPersonRig(view, { pose, camera, weapon: gun, dt,
      active: true, thirdPerson: selection.view === 'third',
      spineQuaternion: actor._presentationCorrection?.get(actor.mesh.getObjectByName('spine_03')),
      rawCorrections: worldHandler.corrections });
  };
  return {
    duration,
    update,
    render() { if (disposed) return; const previous = actor.mesh.visible;
      const liveNodes=[gltf.playerMesh,gltf.playerFirstPersonRig?.arms,gltf.playerFirstPersonRig?.body,
        gltf.playerFirstPersonRig?.weapon,liveBody,weapon,worldWeapon].filter(Boolean);
      const liveVisibility=liveNodes.map(node=>node.visible);
      try { liveNodes.forEach(node=>{node.visible=false;});actor.mesh.visible = selection.view === 'third';
        fp.renderFirstPersonRig(view, { weapon: gun, worldWeapon: mounted, firstPerson: selection.view !== 'third', active: true }, () => renderComicScene(renderer, scene, camera));
      } finally { actor.mesh.visible = previous;liveNodes.forEach((node,i)=>{node.visible=liveVisibility[i];}); }
    },
    getFrozenDebug() { return { joints: view.armPairs.length, contacts: worldHandler.contacts,
      viewContacts:[...view.handlers].map(owner=>({weapon:owner.weapon,contacts:owner.contacts})),
      pose: pose ? structuredClone(pose) : null, weapon: selection.weapon, view: selection.view,
      mixerCount: 1, ownedViewMixers: 0, armsAttached:view.arms.parent===scene, sample:sampleReviewScenario(selection,pose?.phase??0),heldProp:prop.visible,
      partial:selection.weapon==='p90', sharedMaps:6 }; },
    compatibleScenarios:compatible,
    partial:selection.weapon==='p90',
    identity:{source:manifest.source,sourceHash:manifest.sourceHash,export:'public/models/enemy.glb',
      exportHash,baselineHash:manifest.baselineHash},
    dispose() { if (disposed) return; disposed = true; fp.disposeFirstPersonRig(view);
      handling.disposeWeaponHandling(worldHandler); disposeCharacter(actor.mesh, actor.mixer); disposeCharacter(gun); camera.removeFromParent(); },
  };
}

/** One clock and generation. Factories receive only bounded selection values. */
export function createAnimationReviewOwner({ createActor, suspend = () => {}, restore = () => {},
  eligible = () => '', changed = () => {} }) {
  let opened = false, generation = 0, actor = null, state = 'closed', phase = 0, playing = false;
  let selection = { weapon: 'm4', view: 'third', scenario: 'ready' }, reset = true;
  let compatible=Object.keys(REVIEW_SCENARIOS), identity=null;
  const statusSnapshot = () => Object.freeze({ opened, generation, state, phase, playing, reset,
    selection: Object.freeze({ ...selection }), actorCount: actor ? 1 : 0, viewCount: actor ? 1 : 0,
    partial:actor?.partial===true,compatibleScenarios:compatible,identity });
  const snapshot=()=>freezeObservation({...statusSnapshot(),actor:actor?.getFrozenDebug?.()??null});
  const announce = () => changed(statusSnapshot());
  const canPlay=()=>state==='ready'&&!(actor?.partial&&detailedScenarios.includes(selection.scenario));
  const retire = () => { const previous = actor; actor = null; previous?.dispose(); };
  async function load() {
    const request = ++generation; retire(); state = 'loading'; phase = 0; playing = false; reset = true; announce();
    try {
      const candidate = await createActor(Object.freeze({ ...selection }));
      if (!opened || request !== generation) { candidate?.dispose(); return; }
      compatible=candidate?.compatibleScenarios??Object.keys(REVIEW_SCENARIOS);identity=candidate?.identity??null;
      if(candidate&&(!Number.isFinite(candidate.duration)||candidate.duration<=0||candidate.duration>60||!['update','render','dispose'].every(key=>typeof candidate[key]==='function'))){candidate.dispose?.();throw Error('Unsupported preview resource');}
      if(candidate&&(!compatible.length||!compatible.includes(selection.scenario))){candidate.dispose();state='empty';announce();return;}
      actor = candidate; state = candidate ? 'ready' : 'empty';
      actor?.update(0, true, 0); announce();
    } catch { if (opened && request === generation) { retire(); state = 'error'; announce(); } }
  }
  return {
    async open() { if (opened || eligible()) return false; opened = true; suspend(); await load(); return true; },
    select(patch) { if (!opened) return;
      const valid={};for(const [key,options] of [['weapon',REVIEW_WEAPONS],['view',REVIEW_VIEWS],['scenario',REVIEW_SCENARIOS]])if(Object.hasOwn(options,patch[key]))valid[key]=patch[key];
      if(!Object.keys(valid).length)return;selection={...selection,...valid};return load(); },
    retry() { if (opened) return load(); },
    play() { if (!canPlay()) return; phase = 0; reset = false; playing = true; actor.update(phase, false, 0); announce(); },
    pause() { if (!canPlay()) return; playing = !playing; reset = false; announce(); },
    scrub(percent) { if (!canPlay() || playing) return; phase = clamp(Number(percent) / 100); reset = false; actor.update(phase, false, 0); announce(); },
    reset() { if (state !== 'ready') return; phase = 0; playing = false; reset = true; actor.update(0, true, 0); announce(); },
    tick(dt) { if (!opened || !actor) return; if (playing) {
      phase = clamp(phase + Math.max(0, Math.min(.05, dt)) / actor.duration);
      actor.update(phase, false, dt); if (phase === 1) { playing = false; announce(); }
    } },
    render() { if (opened && actor && state==='ready') { try { actor.render(); } catch { playing = false; state = 'error'; announce(); } } },
    close(focus = true) { if (!opened) return; ++generation; opened = false; playing = false; retire(); state = 'closed'; restore(focus); announce(); },
    getFrozenDebug: snapshot,
    getStatus:statusSnapshot,
  };
}

export function initAnimationReview({ createActor, eligible, suspend, restore, getQuality=()=> 'medium', host = document.body }) {
  const diagnostics = document.createElement('div'); diagnostics.id = 'animation-review-diagnostics'; diagnostics.hidden = true;
  const opener = document.createElement('button'); opener.type = 'button'; opener.textContent = 'Open animation review';
  const reason = document.createElement('p'); reason.id = 'animation-review-reason'; opener.setAttribute('aria-describedby', reason.id);
  diagnostics.append(opener, reason); host.append(diagnostics);
  const panel = document.createElement('section'); panel.id = 'animation-review'; panel.hidden = true;
  panel.setAttribute('role', 'region'); panel.setAttribute('aria-labelledby', 'animation-review-heading');
  // Constant author-owned markup only; runtime manifest and status use textContent.
  panel.innerHTML = '<h2 id="animation-review-heading">Animation review</h2><p id="animation-review-help">Clip preview. Gameplay outcomes are unchanged.</p>';
  const controls = {};
  for (const [key, label, options] of [['weapon','Weapon',REVIEW_WEAPONS], ['view','View',REVIEW_VIEWS], ['scenario','Transition',REVIEW_SCENARIOS]]) {
    const wrapper = document.createElement('label'); wrapper.textContent = label;
    const select = document.createElement('select'); select.setAttribute('aria-label', label); select.setAttribute('aria-describedby','animation-review-help');
    for (const [value, text] of Object.entries(options)) { const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option); }
    select.value = key === 'weapon' ? 'm4' : key === 'view' ? 'third' : 'ready'; wrapper.append(select); panel.append(wrapper); controls[key] = select;
  }
  for (const [key, label] of [['play','Play transition'], ['pause','Pause transition'], ['reset','Reset preview'], ['retry','Retry preview'], ['close','Close review']]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label; panel.append(button); controls[key] = button;
  }
  const phaseLabel = document.createElement('label'); phaseLabel.textContent = 'Animation phase';
  const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.step = '1'; slider.value = '0'; slider.setAttribute('aria-label','Animation phase');
  const readout = document.createElement('output'); readout.textContent = '0%'; phaseLabel.append(slider, readout); panel.append(phaseLabel);
  const status = document.createElement('p'); status.id = 'animation-review-status'; status.setAttribute('role','status'); status.setAttribute('aria-live','polite'); panel.append(status);
  const emptyHeading=document.createElement('h3');emptyHeading.textContent='Animation preview unavailable';panel.append(emptyHeading);
  const fallback=document.createElement('p'),missing=document.createElement('p'),context=document.createElement('p'),identity=document.createElement('p'),motion=document.createElement('p');
  panel.append(fallback,missing,context,identity,motion);
  missing.id='animation-review-missing';controls.scenario.setAttribute('aria-describedby',`${missing.id} animation-review-help`);
  controls.retry.setAttribute('aria-describedby',status.id); host.append(panel);
  const owner = createAnimationReviewOwner({ createActor, eligible, suspend,
    restore(focus) { restore(); if (focus && !diagnostics.hidden) opener.focus(); },
    changed(s) {
      panel.hidden = !s.opened;
      const blocked=s.state!=='ready'||s.partial&&detailedScenarios.includes(s.selection.scenario);
      for (const key of ['play','pause']) controls[key].disabled = blocked;
      controls.reset.disabled=s.state!=='ready';
      controls.pause.textContent = s.playing ? 'Pause transition' : 'Resume transition';
      controls.retry.hidden = s.state !== 'error'; slider.disabled = blocked || s.playing;
      slider.value = String(Math.round(s.phase * 100)); readout.textContent = `${slider.value}%`;
      const scenario=REVIEW_SCENARIOS[s.selection.scenario];
      status.textContent = s.state === 'ready' ? scenario.startsWith('Preview —')
        ? s.selection.scenario==='sprint-reload'?'Preview — normal sprint reload: base duration × 1.15. Supersprint cancels reload. Gameplay timing belongs to Phase 5.'
          : `${scenario}. Gameplay integration belongs to Phase 5.`
        : `Ready: ${REVIEW_WEAPONS[s.selection.weapon]} · ${REVIEW_VIEWS[s.selection.view]} · ${scenario}.`
        : s.state === 'empty' ? REVIEW_COPY.empty : REVIEW_COPY[s.state] ?? REVIEW_COPY.exit;
      emptyHeading.hidden=s.state!=='empty';
      let unavailable=0;
      for(const option of controls.scenario.options){option.disabled=s.state==='ready'&&(!s.compatibleScenarios.includes(option.value)||s.partial&&detailedScenarios.includes(option.value));if(option.disabled)unavailable++;}
      missing.textContent=unavailable?s.partial?'Detailed handling comparisons are unavailable for this fallback.':REVIEW_COPY.missing:'';
      fallback.textContent=s.partial?`Using fallback weapon geometry. Detailed handling for ${REVIEW_WEAPONS[s.selection.weapon]} is unavailable.`:'';
      context.textContent=`${REVIEW_WEAPONS[s.selection.weapon]} · ${REVIEW_VIEWS[s.selection.view]} · ${scenario} · ${getQuality()}.`;
      identity.textContent=s.identity?Object.entries(s.identity).map(([key,value])=>`${key}: ${String(value)}`).join(' · '):'';
      motion.textContent=window.matchMedia('(prefers-reduced-motion: reduce)').matches?'Reduced motion active. Added camera bob and cosmetic sway are disabled.':s.selection.scenario==='death'?'Death direction unavailable. Showing the body-heading fallback.':'';
    } });
  const releaseLateCapture = () => { if (owner.getStatus().opened && document.pointerLockElement) document.exitPointerLock(); };
  const guard = event => {
    if (!panel.contains(event.target) && !diagnostics.contains(event.target)) return;
    event.stopPropagation();
    if (event.type === 'keydown' && event.code === 'Escape' && panel.contains(event.target)) { event.preventDefault(); owner.close(); }
  };
  const eventTypes=['keydown','keyup','mousedown','mouseup','pointerdown','pointerup','wheel','click','touchstart','touchmove','touchend'];
  let sessionListeners=null;
  const diagnosticListeners=new AbortController();
  opener.addEventListener('click', () => { if(eligible())return; owner.open();controls.close.focus(); },{signal:diagnosticListeners.signal});
  for(const type of eventTypes)diagnostics.addEventListener(type,guard,{signal:diagnosticListeners.signal});
  const bindSession=()=>{
    sessionListeners=new AbortController();const options={signal:sessionListeners.signal};
    document.addEventListener('pointerlockchange',releaseLateCapture,options);
    for (const key of ['weapon','view','scenario']) controls[key].addEventListener('change', () => owner.select({ [key]: controls[key].value }),options);
    for (const key of ['play','pause','reset','retry']) controls[key].addEventListener('click', () => owner[key](),options);
    controls.close.addEventListener('click', () => owner.close(),options);slider.addEventListener('input', () => owner.scrub(slider.value),options);
    for(const type of eventTypes)panel.addEventListener(type,guard,options);
  };
  const openOwner=owner.open,closeOwner=owner.close;
  owner.open=()=>{if(eligible())return Promise.resolve(false);if(!owner.getStatus().opened)bindSession();return openOwner();};
  owner.close=focus=>{sessionListeners?.abort();sessionListeners=null;return closeOwner(focus);};
  const tick = owner.tick;
  owner.tick = dt => { const unavailable = eligible(); opener.disabled = !!unavailable; reason.textContent = unavailable; if (owner.getStatus().opened && unavailable) owner.close(false); tick(dt);
    const s = owner.getStatus(); slider.value = String(Math.round(s.phase * 100)); readout.textContent = `${slider.value}% · ${sampleReviewScenario(s.selection,s.phase,s.reset).upper}`; };
  owner.toggleDiagnostics = () => { diagnostics.hidden = !diagnostics.hidden; if (!diagnostics.hidden && !opener.disabled) opener.focus(); };
  window.__animationReviewDebug = owner.getFrozenDebug;
  owner.dispose=()=>{owner.close(false);diagnosticListeners.abort();diagnostics.remove();panel.remove();};
  return owner;
}
