# Phase 6 — UI Review

**Audited:** 2026-10-05
**Source:** HEAD `3df1565`; current working-tree UI inspected without implementation changes.
**Baseline:** approved `06-UI-SPEC.md`; existing HUD/menu dimensions excluded except where Phase 6 responsive additions change them.
**Screenshots:** captured: five fresh static menu viewports at 1440×900, 375×812, 768×1024, 320×568 and 568×320 under `.planning/ui-reviews/06-20261005-audit/`. Existing export-bound actual-game frames and compact menu/pause evidence also inspected.
**Interaction captures:** off (workflow.ui_interaction_capture is false). No new post-interaction state capture is claimed; interaction conclusions are source-derived and supported by previously recorded tests/captures.
**needs_human_review:** true — subjective character/grip/weapon/motion acceptance and representative-device performance remain pending.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Quality/error copy matches; loaded review-destination labels lose contract brackets. |
| 2. Visuals | 2/4 | Human/paint/ink present, but support fingers wrap the barrel and first-person M4 remains a broad box form. |
| 3. Color | 4/4 | Added UI uses the declared palette; selective team accents preserve protected material domains. |
| 4. Typography | 3/4 | New controls match 14/16/20px roles; compact heading override loses the cascade. |
| 5. Spacing | 2/4 | Parent specificity defeats the quality group's 320px maximum, visibly misaligning desktop settings. |
| 6. Experience Design | 4/4 | Native, synchronized, reversible controls cover loading/fallback/save errors and reserve ammo/Leave access. |

**Overall: 18/24**

No newly demonstrated task-completion BLOCKER. Four pillars retain WARNING findings; a technically playable flow does not constitute aesthetic acceptance.

---

## Top 3 Priority Fixes

1. **WARNING — constrain and center the menu quality group** — the desktop label/select/help sit at x=32, disconnected from centered mode actions — add `#overlay > .graphics-quality { max-width:320px; }` after the generic child rule, preserving its existing responsive width and 16px margin. Verify the group itself, not only the select, at desktop/tablet widths.
2. **WARNING — resolve or explicitly obtain human disposition of the current rifle contact and first-person presentation** — support fingers surround the barrel; the first-person receiver dominates the lower-right image as a long rectangular form — inspect armed hands at 2–5m and first-person M4 in both lighting probes, then fit mesh/contact and framing within the preserved rig/mount contract. Do not count inherited origin or planned later motion work as fulfillment of the credible-grip requirement.
3. **WARNING — make compact heading rules win** — a 320px menu title occupies three lines at 52px with 12px tracking — move the max-width:480px heading overrides after their base rules, or strengthen their scoped selectors. Verify computed 32px/4px menu title and 20px/1px offline pause title without modifying the 16px online-title override.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- **WARNING C-01:** `index.html:157,161` declares `[ TEAM DEATHMATCH ]` and `[ TRAINING RANGE ]`, as the contract requests, but `src/main.js:528,530` replaces them with unbracketed labels after loading. Fresh metrics confirm `TRAINING RANGE`. Preserve the two declared labels in the loading-settled handler. This is a small exact-copy deviation, not an inability to locate the mode.
- Quality label/options and help match verbatim at `index.html:169–175,189–195` and `src/main.js:45–65`. Loading/fallback heading/body match at `index.html:164–167`; asset-error copy matches `src/main.js:523–524`; save failure retains the session setting and exact recovery wording at `src/main.js:64–65`. No generic new Submit/OK/Cancel action exists.

### Pillar 2: Visuals (2/4)

- **WARNING V-01, needs_human_review:** `range-medium-range-ambient-hands-idle.png` in the export-bound `reviewed-3d92a093fc67` evidence shows separate fingers but a support hand closed around the exposed barrel, rather than credible fore-end support. `docs/ART.md:125–127` acknowledges the limit; the approved character contract explicitly requires credible current weapon grips. The review cannot award substantial visual fulfillment solely because the anatomical model and original motion load correctly.
- **WARNING V-02, needs_human_review:** `range-medium-range-ambient-first-person-idle.png` shows painted metal but a broad elongated rectangular receiver dominating the foreground. `src/builders/weapon.js:21` retains box geometry; `docs/ART.md:128–130` records inherited framing/model limits. Improve the current M4's readable silhouette/framing or obtain explicit human disposition of this slice. Painting does not alone establish finished weapon presentation.
- **WARNING V-03:** fresh `desktop.png` places quality controls against the left page margin while the main action row is centered. This is the visible consequence of S-01, not a separate priority count.
- Reviewed game evidence shows a visible face, fingers, fitted plates, soft painted planes and equipment ink. Selected Greek Columns daylight/shadow and near/far team frames retain recognizable bodies and selected stone linework. These establish implemented art, not a human aesthetic pass or complete motion-view shimmer assessment.

### Pillar 3: Color (4/4)

- **PASS finding COL-01:** `style.css:67–78` uses neutral `#ddd` text, `#111` select surface, one selected-control `#e8c84a` border and white focus outline. Hover changes only the border. The two controls share one CSS rule; no new decorative accent instances, colored glow or destructive action were found. Neutral menu surfaces dominate; the existing multicolored mode/HUD treatments are outside the new-control scope. The contract's 60/30/10 hierarchy is visually supported, not asserted as an exact pixel-area ratio.
- `review-sheet-6.png` and protected-domain tests at `tests/character-art.spec.js:407–426` support localized blue/red shoulder/chest/helmet accents, with skin/fabric/weapon/ink protected. Muted skin/materials and near-black contours remain intact. No color deduction is warranted merely because existing HUD colors differ from the addition's palette.

### Pillar 4: Typography (3/4)

- **WARNING T-01:** `style.css:71` compact menu/offline pause heading declarations occur before equal-specificity base declarations at `style.css:72,79`. Fresh computed styles at 320/375px confirm the menu still uses **52px and 12px tracking**; 320px title height is **177px**. Move responsive overrides after base styles and keep the later online-specific override. The existing title is outside the three-size addition limit, but the implemented responsive remedy is ineffective and increases the new scroll burden.
- Added roles at `style.css:67–78` use **14px/400**, **16px/700**, **20px/700**, Courier New, 1.5 body/control and 1.2 heading line-height, with no added tracking. Fresh selects compute 16px/700. Exactly three addition sizes and two weights match the contract; do not count unrelated existing HUD sizes as failures.

### Pillar 5: Spacing (2/4)

- **WARNING S-01:** `style.css:61` (`#overlay>* { max-width:100% }`) has greater specificity than `.graphics-quality` at `style.css:73`, overriding its **320px maximum**. At 1440px the group measures **1376px**, while the select correctly measures **320px**; tablet group is **704px**, landscape **504px**. The broad left-aligned group breaks the intended compact secondary-settings hierarchy. Add a scoped max-width rule and verify group bounding width/alignment at all affected widths. Existing tests at `tests/character-art.spec.js:311–312` assert only select width and miss this parent failure.
- New-control spacing otherwise uses 8px help/label gaps, 16px group margins/horizontal padding and 24px panel padding (`style.css:63–78,96`), within the declared scale. Select height is **44px** at all five fresh viewports; compact width **256px** fits 320px. The 4px focus offset/3px stroke are correctly excluded from spacing-token counting.
- Compact menu overflow remains vertically scrollable: 320px metrics show scrollHeight **2051px**, clientHeight **568px**. All actions remain reachable according to the recorded compact checks, but T-01 needlessly adds title height. No horizontal control clipping was demonstrated.

### Pillar 6: Experience Design (4/4)

- **PASS finding E-01:** `src/graphicsQuality.js:6–46` bounds saved values, defaults to Medium, caps DPR at 1/1.5/2, retains the session setting when storage throws and restores the captured shadow configuration. `src/main.js:51–90` owns both selects, synchronizes help/status/value and preserves native defaults while stopping gameplay input propagation. No restart or pointer-lock request occurs in the change handler.
- Loading and partial/error states at `src/main.js:500–541` keep mode gates until `loadAll()` settles and then allow playable fallback with exact recovery copy. `06-REVIEW-FIX.md` supplies focused missing/corrupt-model regression evidence for independently colored fallback actors. No repeated per-frame error toast or interference with connection error ownership was found.
- `style.css:60–66,95–98` scrolls affected containers, raises pause above the range HUD, reserves the bottom ammo band and moves desktop online pause right of match controls. Native labels/aria-describedby and polite statuses are present. Recorded compact tests cover target reachability, native keyboard, unprevented touch scroll and independent Resume; focused online checks retain Leave access. These are prior test/code evidence, **not new interaction captures**.
- No new destructive action requires a confirmation. Empty media, invalid saved values, bounded options, long recovery copy and disabled loading controls are handled. Previously retained intermittent comparison-pixel failure remains capture-tool evidence, not a newly reproduced product UI defect. SwiftShader renderer measurements do not certify device FPS.

---

Registry audit skipped: `components.json` absent; approved contract initializes no shadcn or third-party registry.

## Files Audited

- `AGENTS.md`, `.planning/config.json`, agent-skills bootstrap (configured mapping empty; project skill directories absent).
- All six `06-0N-PLAN.md` and `06-0N-SUMMARY.md` files; `06-CONTEXT.md`, `06-UI-SPEC.md`, `06-REVIEW-FIX.md`.
- `index.html`, `style.css`, `src/main.js`, `src/graphicsQuality.js`, `src/touch.js`, `src/builders/weapon.js`.
- `tests/character-art.spec.js`, `docs/ART.md`, phase `evidence/06-review.json`.
- Fresh five-view static screenshots and `metrics.json`; export-bound hand/M4 captures and Greek Columns review sheet; retained compact menu/pause test capture paths.

## Audit Boundaries

Root pin ran before writes with process-scoped Git trust. Screenshot ignore gate ran before fresh captures. No server was reachable on 3000/5173/8080; the audit opened its own loopback Vite listener and Chromium, then closed both in `finally`. No packages, implementation changes, full-suite reruns, commits or later-phase work occurred. Read/Write tools are unavailable in this runtime; filesystem reads used PowerShell and the report used the available `apply_patch` tool.

**Recommendation count:** 3 priority fixes; 1 additional minor recommendation (C-01). V-01/V-02 share one priority; V-03 duplicates S-01. Human aesthetic/device review flags are retained, not automatically passed.
