# Phase 6 — UI Review

**Audited:** 2026-10-05
**Source:** re-audit HEAD `f727404`, following committed source fix `fae889a`; UI source is clean. Initial audit at `3df1565` is preserved in commit `f727404`.
**Baseline:** approved `06-UI-SPEC.md`; existing HUD/menu dimensions excluded except where Phase 6 responsive additions change them.
**Screenshots:** captured: five fresh re-audit static menu viewports at 1440×900, 375×812, 768×1024, 320×568 and 568×320 under `.planning/ui-reviews/06-20261005-reaudit-fae889a/`. Initial captures remain untouched under `06-20261005-audit/`. Existing export-bound actual-game frames and compact menu/pause evidence also inspected.
**Interaction captures:** off (workflow.ui_interaction_capture is false). No new post-interaction state capture is claimed; interaction conclusions are source-derived and supported by previously recorded tests/captures.
**needs_human_review:** true — subjective character/grip/weapon/motion acceptance and representative-device performance remain pending.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Loaded review-destination labels now retain exact contract brackets; quality/error copy matches. |
| 2. Visuals | 2/4 | Human/paint/ink present, but support fingers wrap the barrel and first-person M4 remains a broad box form. |
| 3. Color | 4/4 | Added UI uses the declared palette; selective team accents preserve protected material domains. |
| 4. Typography | 4/4 | New controls match 14/16/20px roles; compact title overrides now win. |
| 5. Spacing | 4/4 | Quality group is centered and at most 320px at every fresh viewport. |
| 6. Experience Design | 4/4 | Native, synchronized, reversible controls cover loading/fallback/save errors and reserve ammo/Leave access. |

**Overall: 22/24**

No newly demonstrated task-completion BLOCKER. Visuals retain WARNING findings; a technically playable flow does not constitute aesthetic acceptance. C-01, T-01 and S-01 are resolved by `fae889a`, with fresh source/computed-style/pixel evidence.

---

## Top 3 Priority Fixes

1. **WARNING — credible support-hand contact** — fingers still surround the exposed barrel — inspect armed hands at 2–5m and fit contact within the preserved rig/mount contract, or obtain explicit human disposition of the current pose. Inherited origin does not establish fulfillment of the grip requirement.
2. **WARNING — first-person M4 silhouette/framing** — its receiver dominates the lower-right image as a long rectangular form — improve readable current-M4 form/framing within this slice or obtain explicit human disposition. Painting alone does not establish finished weapon presentation.
3. **Human-review follow-up, not a newly discovered defect** — inspect moving near/far characters, grips and all three tiers in the running game, then record the actual human decision. Static agent evidence cannot close subjective appearance, motion-view shimmer or representative-device acceptance. No third unresolved implementation defect is invented to fill this list.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

- **RESOLVED C-01 / PASS finding:** `src/main.js:528,530` now preserves `[ TEAM DEATHMATCH ]` and `[ TRAINING RANGE ]`, matching `index.html:157,161` and the contract. Fresh loaded-page metrics verify both exact labels at all five viewports.
- Quality label/options and help match verbatim at `index.html:169–175,189–195` and `src/main.js:45–65`. Loading/fallback heading/body match at `index.html:164–167`; asset-error copy matches `src/main.js:523–524`; save failure retains the session setting and exact recovery wording at `src/main.js:64–65`. No generic new Submit/OK/Cancel action exists.

### Pillar 2: Visuals (2/4)

- **WARNING V-01, needs_human_review:** `range-medium-range-ambient-hands-idle.png` in the export-bound `reviewed-3d92a093fc67` evidence shows separate fingers but a support hand closed around the exposed barrel, rather than credible fore-end support. `docs/ART.md:125–127` acknowledges the limit; the approved character contract explicitly requires credible current weapon grips. The review cannot award substantial visual fulfillment solely because the anatomical model and original motion load correctly.
- **WARNING V-02, needs_human_review:** `range-medium-range-ambient-first-person-idle.png` shows painted metal but a broad elongated rectangular receiver dominating the foreground. `src/builders/weapon.js:21` retains box geometry; `docs/ART.md:128–130` records inherited framing/model limits. Improve the current M4's readable silhouette/framing or obtain explicit human disposition of this slice. Painting does not alone establish finished weapon presentation.
- **RESOLVED V-03:** fresh re-audit `desktop.png` shows the quality group centered below the mode actions. This was the visible consequence of S-01, not an independent visual defect. The visual score remains 2 because V-01/V-02 are unchanged.
- Reviewed game evidence shows a visible face, fingers, fitted plates, soft painted planes and equipment ink. Selected Greek Columns daylight/shadow and near/far team frames retain recognizable bodies and selected stone linework. These establish implemented art, not a human aesthetic pass or complete motion-view shimmer assessment.

### Pillar 3: Color (4/4)

- **PASS finding COL-01:** `style.css:67–78` uses neutral `#ddd` text, `#111` select surface, one selected-control `#e8c84a` border and white focus outline. Hover changes only the border. The two controls share one CSS rule; no new decorative accent instances, colored glow or destructive action were found. Neutral menu surfaces dominate; the existing multicolored mode/HUD treatments are outside the new-control scope. The contract's 60/30/10 hierarchy is visually supported, not asserted as an exact pixel-area ratio.
- `review-sheet-6.png` and protected-domain tests at `tests/character-art.spec.js:407–426` support localized blue/red shoulder/chest/helmet accents, with skin/fabric/weapon/ink protected. Muted skin/materials and near-black contours remain intact. No color deduction is warranted merely because existing HUD colors differ from the addition's palette.

### Pillar 4: Typography (4/4)

- **RESOLVED T-01 / PASS finding:** `style.css:80` now follows the base heading declarations. At both 320/375px, fresh computed menu title is **32px/4px tracking**, occupies **37px** height and fits one line; offline pause title is **20px/1px**. The later online-specific rule at `style.css:98` remains **16px/2px** at every viewport. Pause values are computed-style evidence on existing markup, not new captured interaction states.
- Added roles at `style.css:67–78` use **14px/400**, **16px/700**, **20px/700**, Courier New, 1.5 body/control and 1.2 heading line-height, with no added tracking. Fresh selects compute 16px/700. Exactly three addition sizes and two weights match the contract; do not count unrelated existing HUD sizes as failures.

### Pillar 5: Spacing (4/4)

- **RESOLVED S-01 / PASS finding:** `style.css:73` adds `#overlay .graphics-quality` with **max-width:320px; margin:16px auto**, winning the generic child rule. Fresh measured group widths are **320/311/320/256/320px** for desktop/mobile/tablet/compact/landscape; each horizontal midpoint equals its viewport midpoint. Desktop group now starts at **x=560**, tablet **x=224**, landscape **x=124**. Select widths equal group widths and every select remains **44px** high. Fresh desktop pixels confirm the restored compact secondary-settings hierarchy.
- New-control spacing otherwise uses 8px help/label gaps, 16px group margins/horizontal padding and 24px panel padding (`style.css:63–78,96`), within the declared scale. Select height is **44px** at all five fresh viewports; compact width **256px** fits 320px. The 4px focus offset/3px stroke are correctly excluded from spacing-token counting.
- Compact menu overflow remains vertically scrollable: 320px re-audit metrics show scrollHeight **1911px**, clientHeight **568px**. The title correction removes 140px of excess height. All actions remain reachable according to the recorded compact checks; the parent reports three focused compact browser cases passing after the fix, including native keyboard/touch and online Leave coverage. No horizontal control clipping was demonstrated.

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
- Initial and fresh re-audit five-view static screenshots and `metrics.json`; export-bound hand/M4 captures and Greek Columns review sheet; retained compact menu/pause test capture paths.

## Audit Boundaries

Root pin ran before initial and re-audit writes with process-scoped Git trust. Screenshot ignore gate ran before initial captures and was checked before re-audit captures. No server was reachable on 3000/5173/8080 during initial detection; both audit passes opened their own loopback Vite listener and Chromium, then closed both in `finally`. No packages, implementation changes, full-suite reruns, commits or later-phase work occurred in this audit. Parent-owned source fix and three focused passing browser checks are identified separately. Read/Write tools are unavailable in this runtime; filesystem reads used PowerShell and the report used the available `apply_patch` tool.

**Recommendation count after re-audit:** 2 remaining implementation priorities (V-01/V-02), 0 remaining minor UI recommendations, 1 human-review follow-up. C-01/T-01/S-01/V-03 resolved with fresh evidence. Human aesthetic/device review flags are retained, not automatically passed.
