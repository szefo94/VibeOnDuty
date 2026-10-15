# Phase 6: Human Characters and Comic-Book Blender Iteration — Context

Gathered: 2026-10-04. Status: Ready for planning and execution.

<domain>
Deliver ART-01 through ART-04: a human character and representative character,
weapon and existing environment comic-book slice, backed by editable Blender
sources, asset provenance, reproducible scripted exports and a demonstrated
iteration/revert workflow. Preserve the current rig, gameplay and authoritative
multiplayer where practical. Scope is Phase 6 only; the selected order remains
6, then 7, then 5. Do not implement later phases automatically.
</domain>

<decisions>
### Character design
- **D-01:** Real human proportions, with credible hands, visible face and weapon grips.
- **D-02:** Near-future soldiers wearing streamlined tactical armor: fitted plates
  over fabric and restrained futuristic details, with a helmet and visible face.

### Comic-book treatment
- **D-03:** Intensive black contour lines. Strong outer silhouette plus selected
  finer internal details on armor, seams and faces.
- **D-04:** Illustrated/painted surface treatment with soft shading, readable
  realistic forms and detail on armor, fabric and skin.
- **D-05:** Grounded muted armor/fabric colors, painted wear and bold colored accents.

### Delivery
- **D-06:** Remain a browser game. Provide scalable visual quality suitable for
  phones, integrated graphics and stronger PCs; target 60 FPS without claiming
  unmeasured device qualification.
- **D-07:** Iterate through Blender with LLM-authored operations. Actual available
  tools must be verified. A documented, bounded Python script workflow is valid;
  reproducible editable sources, exports, comparison and restoration are required.

### the agent's Discretion
The user explicitly delegates all remaining interpretation and implementation:
"do your interpretation till the end of this phase, please implement".
Choose the face, armor construction, palette details, team accent placement,
outline technique, first-person presentation and practical review cadence.
Interpret the earlier gameplay appearance "yes" as consistency between visible
first-person elements, third-person bodies and readable friendly/hostile actors.
Use actual in-game pose captures to review the slice and improve it before final
delivery. Preserve asset loading fallbacks and resource ownership. Prefer a
portable, pinned official Blender runtime if no local executable exists; no paid
service, account or machine-wide installation is implied. Select sensible
quality defaults and record measured costs. Do not substitute shader changes
alone for improving the model. Human subjective acceptance must be accurately
distinguished from automated and agent visual verification.
</decisions>

<canonical_refs>
- .planning/PROJECT.md, .planning/REQUIREMENTS.md, .planning/ROADMAP.md
- .planning/phases/01-two-client-authoritative-tdm/01-CONTEXT.md
- .planning/codebase/STACK.md, INTEGRATIONS.md, STRUCTURE.md (historical; verify source)
- AGENTS.md
- tools/README.md, tools/retarget.py
- src/builders/enemyGLTF.js, src/builders/enemyAnimations.js
- src/builders/characterResources.js, src/builders/weapon3pTransform.js
- src/materials.js, src/lighting.js, src/scene.js
- src/network/remoteActors.js
</canonical_refs>

<code_context>
Three.js r160 and Vite, plain JavaScript modules. The existing enemy GLB is shared
by player, offline bots and remote actors, with skeleton cloning and per-instance
mixers. Keep retargeted clip spaces, aliases, translation stripping and hand mount
basis intact. Current weapon models mix FBX and procedural geometry. Existing
materials are mostly standard shaded materials; investigate outline and paint
integration. Shared template geometry must survive instance disposal; owned
materials and any new outline resources need explicit cleanup. Team tinting must
not recolor black outlines or skin. Inspect the real GLB, current camera behavior
and actual animation poses before choosing the model approach. Existing Blender
retargeting scripts are useful, but no Blender executable or connector has yet
been found in the bounded checks. Verify asset-specific licenses/provenance.
Phase 1 multiplayer is already implemented and accepted; its server authority,
TLS startup, lifecycle and offline/animation regression coverage must survive.
</code_context>

<specifics>
The desired visual reference is the Borderlands-style combination of 3D forms,
illustrated surfaces and conspicuous black linework, interpreted as an original
near-future soldier design. Realistic proportions take precedence over exaggerated
cartoon anatomy. Deliver a reviewable running game, not only planning documents.
</specifics>

<deferred>
Animation overhaul and smoother transitions belong to Phase 7. Omnimovement,
terrain/camera collision fixes and final movement/animation acceptance belong to
Phase 5. Map generation/editor, attachments, loadout preview and broader netcode,
platform and Raspberry Pi qualification remain in their scheduled phases.
</deferred>
