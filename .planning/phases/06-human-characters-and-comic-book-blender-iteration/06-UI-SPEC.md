---
phase: "6"
slug: "human-characters-and-comic-book-blender-iteration"
status: approved
shadcn_initialized: false
preset: none
created: "2026-10-04"
---

# Phase 6 — UI Design Contract

Visual and interaction source of truth for ART-01–04. Defaults below are chosen within the user's delegated discretion; they do not require another preference round.

## Design System

| Property | Value |
|----------|-------|
| Tool | none; existing plain HTML/CSS and JavaScript |
| Preset | not applicable |
| Component library | none |
| Icon library | none; use text labels |
| Font | 'Courier New', monospace, inherited from style.css |

Evidence: index.html, style.css, package.json and src/scene.js inspected on 2026-10-04. No components.json or React dependency exists. The user requires the existing browser stack; do not initialize shadcn. No installed UI package inventory applies. Project skill directories were absent and configured agent_skills is empty.

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Inline gaps |
| sm | 8px | Label/control gaps |
| md | 16px | Control padding, group gaps |
| lg | 24px | Section padding |
| xl | 32px | Separate groups |
| 2xl | 48px | Large separation |
| 3xl | 64px | Reserved major separation |

Use this scale for new controls only. Minimum interactive height: 44px. Borders and focus outlines are strokes, not spacing tokens. Existing HUD and menu dimensions stay governed by their current CSS.

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body/help | 14px | 400 | 1.5 |
| Label/control | 16px | 700 | 1.5 |
| Heading | 20px | 700 | 1.2 |

Exactly three sizes and two weights for Phase 6 additions. Use sentence case and at most 1px tracking for help/control labels. Existing title/HUD styles are outside this addition.

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | #000000 | Existing menu backdrop |
| Secondary (30%) | #111111 | Settings controls and grouped surfaces |
| Accent (10%) | #e8c84a | Section title, selected quality border, existing primary mode button |
| Destructive | #e74c3c | Reserved; no new destructive action |
| Text | #dddddd | Help and controls; heading text may use accent |
| Focus | #ffffff | 3px visible focus outline, 4px offset |

The 60/30/10 balance describes UI surfaces, not skin or team materials. Accent is reserved for the three listed elements. Error text uses the neutral readable text color and an explicit message. Do not add colored glows or animated settings decoration.

## Character and Art Contract

Source: CONTEXT D-01–05 and delegated choices; RESEARCH human fitting, paint, outline and tint findings.

| Domain | Required result |
|--------|-----------------|
| Character | Original adult near-future soldier with realistic limb/head proportions, distinct fingers and a visible human face; retain compatible rig and credible current weapon grips |
| Face | Open helmet framing visible brow, eyes, nose, lips and jaw; warm muted skin planes with soft shaded transitions, restrained facial ink and no opaque face visor |
| Armor | Fitted chest/back plates, shoulder and forearm guards, shin panels over a flexible fabric suit; readable joint gaps and restrained hardware |
| Base palette | Armor #59645a, fabric #303940, wear #aaa58d, ink #08090b; skin uses a separately painted warm complexion, never the armor pattern |
| Team accents | Shoulder plates, upper chest identifier and helmet side panels only; online blue #4488ff and red #ff5555 follow existing assignments; neutral accents use muted ochre #b6a05b |
| Painted surfaces | Broad hand-painted light/dark planes, sparse fabric marks, armor brush strokes, edge wear and selected seam ink; keep forms softly shaded rather than flat unlit fills |
| Silhouette ink | Opaque near-black contour on eligible character and weapon meshes; Medium/High target a continuous approximately 2px actor contour at 720px viewport height, finer than the visible face planes |
| Internal ink | Paint armor seams, brows/eyes and selected cloth folds into maps; thinner and less dense than the outer silhouette; remains present at every quality tier |
| Weapon slice | Current M4 receives matching muted metal, painted edge wear and selected black seams/contour; first-person equipped surfaces and third-person gun share the visual language |
| Environment slice | Greek Columns existing wall/column/floor materials receive restrained painted stone planes, edge/seam marks and soft lighting; High adds selected structural silhouettes |

No added ink on HUD, particles, transparent effects or debug helpers. Avoid outlining every decorative edge. Maintain face/hands readability at 2–5m and team/silhouette distinction at 10–20m in both indoor shadow and daylight. Geometry must improve the mannequin anatomy; shader changes alone cannot meet ART-01.

Team changes restore immutable base appearance before tinting designated accents. Skin, ink, fabric and weapon colors remain intact. All material groups must survive cloning. Shared texture/template geometry stays alive when actors retire; instance materials, skeleton resources and generated contour resources have explicit owners and cleanup.

## Quality and Interaction Contract

Add a labeled native select, **Graphics quality**, to the main menu below mode actions and to the existing pause/unlock panel below its action group. Both selects reflect one setting and have one named handler owner. Keep the setting out of the live HUD and reserve the existing bottom ammo band.

| Tier | Pixel-ratio cap | Rendering policy | Help copy |
|------|-----------------|------------------|-----------|
| Low | 1 | Painted maps/internal ink, no extra silhouette pass, shadows disabled | Fewer effects for smoother play. |
| Medium | 1.5 | Actor/weapon silhouettes and current shadow configuration | Balanced detail and performance. |
| High | 2 | Medium plus selected environment silhouettes | Extra outlines and higher resolution. |

Default: Medium on every device unless a valid saved preference exists. Apply immediately without reload or gameplay restart; effective ratio is min(devicePixelRatio, tier cap). Preserve soft lighting and painted maps across tiers. These are starting caps, not certified device performance claims.

Persist only low/medium/high under vod_graphics_quality_v1. Unknown values use Medium. Storage exceptions keep the session setting and show the documented save message. Changing tiers must update actor templates, current actors and future spawns consistently, without accumulating materials or contour passes.

Use native keyboard/select behavior, an associated label, aria-describedby help, and polite status text. Hover changes the border; focus uses the documented white outline; disabled/loading controls retain a visible label. Select width is min(320px, 100%); group has 16px outer margin. Long help wraps. Permit vertical scrolling in affected menu/pause containers when needed so all actions remain reachable at 320px width or short landscape height.

Editing the setting must not acquire pointer lock or alter simulation. Existing Resume requires its own user gesture; online unlock retains the existing message that the match continues. Use current modes and V/F3 inspection controls for review; no new preview application or gameplay mode is required.

## Copywriting Contract

| Element | Copy |
|---------|------|
| Visual review destinations | Existing [ TRAINING RANGE ]; existing [ TEAM DEATHMATCH ] supplies armed opponents |
| Quality label | Graphics quality |
| Options | Low; Medium; High |
| Applied status | Graphics quality: {Low/Medium/High}. |
| Loading | Loading character assets… |
| Empty/fallback heading | Character preview unavailable |
| Empty/fallback body | Using the fallback character. Reload the page to try loading the detailed model again. |
| Asset error | Detailed character could not load. You can keep playing with the fallback or reload the page to retry. |
| Save error | Quality changed for this session. Your browser could not save the setting. |
| Destructive confirmation | Not applicable: quality changes are reversible; editable-source restoration is a documented creator workflow |

Show fallback copy near existing menu asset status only when the detailed asset is unavailable. Do not repeat a failure toast every frame or obscure connection errors. Existing start-button loading gates remain in force.

## UI Considerations

Applicable state considerations resolved: 8 covered, 0 backstop, 0 unresolved. These are explicit implementation contracts, not claims that verification already passed.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Character media | ✅ covered | Missing detailed media uses the fallback heading/body in Copywriting Contract |
| loading | Character media, mode controls | ✅ covered | Show loading copy and keep current start-button gating until asset loading settles |
| error | Asset load, quality persistence | ✅ covered | Preserve playable fallback/session setting and show the relevant documented error |
| populated | Character media, quality control | ✅ covered | Human model and exactly one selected tier appear; menu/pause values agree |
| partial | Asset/media set | ✅ covered | Missing weapon/character assets retain supported procedural fallback independently |
| overflow | Menu/pause additions | ✅ covered | Constrain control width and scroll affected containers vertically; do not cover the HUD band |
| zero-one-many | Quality options | ✅ covered | Three fixed options always exist; invalid/missing saved choice selects Medium |
| long-text | Help/status labels | ✅ covered | Wrap help/status with overflow-wrap:anywhere; no tooltip-only error or ellipsis hides recovery copy |

## In-Game Review and Acceptance

Capture matched before/after frames from the actual game: frontal/three-quarter face, full armed silhouette, first-person M4, crouch/jump/locomotion, blue/red actors and Greek Columns structural slice. Compare all three tiers at the same camera/viewport/light; inspect near hands and distant outlines for gaps, shimmer and grip drift.

Demonstrate one bounded LLM-authored Blender material/model edit, export, in-game comparison, then restore editable source and regenerate the previous appearance. Record source/export revision and screenshot settings. Document the actual review device, viewport, renderer, actor count, median/p95 frame time and rendering/resource costs; separately label software/headless measurements. Keep the 60 FPS goal distinct from unmeasured phone/iGPU qualification.

An agent may assess and revise visual defects autonomously. Only an actual human review can be recorded as subjective human acceptance. Preserve current combat authority, animation aliases, hand basis, map topology, collision and source/provenance records throughout the slice.

## Registry Safety

Not applicable: Tool none, no shadcn initialization and no third-party UI registry/block is proposed. Existing Three rendering code is governed by RESEARCH source/ownership review.

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS

**Approval:** Checker approved all seven dimensions. The advisory is incorporated: existing mode actions and Resume remain the primary interaction anchors; graphics quality is secondary. Training Range and Team Deathmatch are review destinations. This design approval is separate from pending human aesthetic acceptance of the implemented assets.
