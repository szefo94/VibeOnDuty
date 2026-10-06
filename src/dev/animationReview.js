const clamp = n => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
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
export const REVIEW_SCENARIOS = Object.freeze({ ready: 'Ready', reload: 'Reload' });

/** Actual accepted template and shared pose/view pipeline; no live actor is driven. */
export async function createActualReviewActor(selection, { scene, renderer, origin, weapon, worldWeapon }) {
  const THREE = await import('three');
  const gltf = await import('../builders/enemyGLTF.js');
  const fp = await import('../builders/firstPersonRig.js');
  const driver = await import('../builders/enemyAnimations.js');
  const handling = await import('../builders/weaponHandling.js');
  const { disposeCharacter } = await import('../builders/characterResources.js');
  const { renderComicScene } = await import('../comicOutline.js');
  const { WEAPONS } = await import('../config.js');
  const { WEAPON3P_ROT, WEAPON3P_GRIP } = await import('../builders/weapon3pTransform.js');
  const actor = gltf.createReviewCharacter(selection.weapon);
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
  camera.add(gun); scene.add(camera, actor.mesh, view.body);
  actor.mesh.position.set(origin.x + 3, origin.y - 1.65, origin.z + 3);
  actor.mesh.getObjectByName('hand_r').add(mounted);
  mounted.position.copy(WEAPON3P_GRIP); mounted.rotation.copy(WEAPON3P_ROT);
  const root = mounted.getObjectByName(`${selection.weapon}_3p`);
  const worldHandler = handling.createWeaponHandling({ weapon: selection.weapon, root, skeleton: actor.mesh });
  const duration = WEAPONS[selection.weapon].reload / 1000;
  let pose, disposed = false;
  const update = (phase, reset, dt) => {
    handling.restoreWeaponHandlingBones(worldHandler);
    pose = driver.tickPresentation(actor, { identity: 'review', generation: 'review',
      position: { x: actor.mesh.position.x, y: actor.mesh.position.y + 1.65, z: actor.mesh.position.z },
      sampleTimeSeconds: phase * duration, bodyYaw: -Math.PI, aimYaw: -Math.PI,
      weapon: selection.weapon, alive: true, onGround: true,
      action: !reset && selection.scenario === 'reload' ? { kind: 'reload', total: duration, elapsed: phase * duration } : { kind: 'ready' },
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches }, 0);
    handling.updateWeaponHandling(worldHandler, pose);
    const p = actor.mesh.position;
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    if (selection.view === 'third') { camera.position.set(p.x - 2.5,p.y + 1.6,p.z + 3); camera.lookAt(p.x,p.y + 1,p.z); }
    else { camera.position.set(p.x,p.y + 1.65,p.z); camera.quaternion.setFromEuler(new THREE.Euler(selection.view === 'down' ? -1.3 : 0, -Math.PI, 0, 'YXZ')); }
    fp.updateFirstPersonRig(view, { pose, camera, weapon: gun, dt,
      active: true, thirdPerson: selection.view === 'third',
      spineQuaternion: actor._presentationCorrection?.get(actor.mesh.getObjectByName('spine_03')),
      rawCorrections: worldHandler.corrections });
  };
  return {
    duration,
    update,
    render() { if (disposed) return; const previous = actor.mesh.visible;
      try { actor.mesh.visible = selection.view === 'third';
        fp.renderFirstPersonRig(view, { weapon: gun, worldWeapon: mounted, firstPerson: selection.view !== 'third', active: true }, () => renderComicScene(renderer, scene, camera));
      } finally { actor.mesh.visible = previous; }
    },
    getFrozenDebug() { return { joints: view.armPairs.length, contacts: worldHandler.contacts,
      pose: pose ? structuredClone(pose) : null, weapon: selection.weapon, view: selection.view,
      mixerCount: 1, ownedViewMixers: 0 }; },
    dispose() { if (disposed) return; disposed = true; fp.disposeFirstPersonRig(view);
      handling.disposeWeaponHandling(worldHandler); disposeCharacter(actor.mesh, actor.mixer); disposeCharacter(gun); camera.removeFromParent(); },
  };
}

/** One clock and generation. Factories receive only bounded selection values. */
export function createAnimationReviewOwner({ createActor, suspend = () => {}, restore = () => {},
  eligible = () => '', changed = () => {} }) {
  let opened = false, generation = 0, actor = null, state = 'closed', phase = 0, playing = false;
  let selection = { weapon: 'm4', view: 'third', scenario: 'ready' }, reset = true;
  const snapshot = () => Object.freeze({ opened, generation, state, phase, playing, reset,
    selection: Object.freeze({ ...selection }), actorCount: actor ? 1 : 0, viewCount: actor ? 1 : 0,
    actor: actor?.getFrozenDebug?.() ?? null });
  const announce = () => changed(snapshot());
  const retire = () => { const previous = actor; actor = null; previous?.dispose(); };
  async function load() {
    const request = ++generation; retire(); state = 'loading'; phase = 0; playing = false; reset = true; announce();
    try {
      const candidate = await createActor(Object.freeze({ ...selection }));
      if (!opened || request !== generation) { candidate?.dispose(); return; }
      actor = candidate; state = candidate ? 'ready' : 'empty';
      actor?.update(0, true, 0); announce();
    } catch { if (opened && request === generation) { retire(); state = 'error'; announce(); } }
  }
  return {
    async open() { if (opened || eligible()) return false; opened = true; suspend(); await load(); return true; },
    select(patch) { if (!opened) return; selection = { ...selection, ...patch }; return load(); },
    retry() { if (opened) return load(); },
    play() { if (state !== 'ready') return; phase = 0; reset = false; playing = true; actor.update(phase, false, 0); announce(); },
    pause() { if (state !== 'ready') return; playing = !playing; reset = false; announce(); },
    scrub(percent) { if (state !== 'ready' || playing) return; phase = clamp(Number(percent) / 100); reset = false; actor.update(phase, false, 0); announce(); },
    reset() { if (state !== 'ready') return; phase = 0; playing = false; reset = true; actor.update(0, true, 0); announce(); },
    tick(dt) { if (!opened || !actor) return; if (playing) {
      phase = clamp(phase + Math.max(0, Math.min(.05, dt)) / actor.duration);
      actor.update(phase, false, dt); if (phase === 1) { playing = false; announce(); }
    } },
    render() { if (opened && actor) { try { actor.render(); } catch { playing = false; state = 'error'; announce(); } } },
    close(focus = true) { if (!opened) return; ++generation; opened = false; playing = false; retire(); state = 'closed'; restore(focus); announce(); },
    getFrozenDebug: snapshot,
  };
}

export function initAnimationReview({ createActor, eligible, suspend, restore, host = document.body }) {
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
  controls.retry.setAttribute('aria-describedby',status.id); host.append(panel);
  const owner = createAnimationReviewOwner({ createActor, eligible, suspend,
    restore(focus) { restore(); if (focus && !diagnostics.hidden) opener.focus(); },
    changed(s) {
      panel.hidden = !s.opened;
      for (const key of ['play','pause','reset']) controls[key].disabled = s.state !== 'ready';
      controls.pause.textContent = s.playing ? 'Pause transition' : 'Resume transition';
      controls.retry.hidden = s.state !== 'error'; slider.disabled = s.state !== 'ready' || s.playing;
      slider.value = String(Math.round(s.phase * 100)); readout.textContent = `${slider.value}%`;
      status.textContent = s.state === 'ready' ? `Ready: ${REVIEW_WEAPONS[s.selection.weapon]} · ${REVIEW_VIEWS[s.selection.view]} · ${REVIEW_SCENARIOS[s.selection.scenario]}.`
        : s.state === 'empty' ? `Animation preview unavailable. ${REVIEW_COPY.empty}` : REVIEW_COPY[s.state] ?? REVIEW_COPY.exit;
    } });
  const releaseLateCapture = () => { if (owner.getFrozenDebug().opened && document.pointerLockElement) document.exitPointerLock(); };
  document.addEventListener('pointerlockchange', releaseLateCapture);
  opener.addEventListener('click', () => { owner.open(); controls.close.focus(); });
  for (const key of ['weapon','view','scenario']) controls[key].addEventListener('change', () => owner.select({ [key]: controls[key].value }));
  for (const key of ['play','pause','reset','retry']) controls[key].addEventListener('click', () => owner[key]());
  controls.close.addEventListener('click', () => owner.close()); slider.addEventListener('input', () => owner.scrub(slider.value));
  const guard = event => {
    if (!panel.contains(event.target) && !diagnostics.contains(event.target)) return;
    event.stopPropagation();
    if (event.type === 'keydown' && event.code === 'Escape' && panel.contains(event.target)) { event.preventDefault(); owner.close(); }
  };
  for (const type of ['keydown','keyup','mousedown','mouseup','pointerdown','pointerup','wheel','click']) { panel.addEventListener(type,guard); diagnostics.addEventListener(type,guard); }
  const tick = owner.tick;
  owner.tick = dt => { const unavailable = eligible(); opener.disabled = !!unavailable; reason.textContent = unavailable; if (owner.getFrozenDebug().opened && unavailable) owner.close(false); tick(dt);
    const s = owner.getFrozenDebug(); slider.value = String(Math.round(s.phase * 100)); readout.textContent = `${slider.value}%`; };
  owner.toggleDiagnostics = () => { diagnostics.hidden = !diagnostics.hidden; if (!diagnostics.hidden && !opener.disabled) opener.focus(); };
  window.__animationReviewDebug = owner.getFrozenDebug;
  return owner;
}
