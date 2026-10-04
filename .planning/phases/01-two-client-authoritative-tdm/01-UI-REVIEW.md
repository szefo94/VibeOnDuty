# Phase 1 — UI Review

**Audited:** 2026-10-04
**Baseline:** `01-UI-SPEC.md`, an orchestrator-authored implementation reference, not a separately approved design contract; locked `01-CONTEXT.md` decisions D-05–D-11.
**Screenshots:** Existing 26-image evidence set; no new screenshots (ports 3000, 5173 and 8080 unavailable).
**Interaction captures:** off

The review uses actual HTML/CSS/JavaScript and selected existing captures from `evidence/01-07/manifest.json`. Eighteen online images are 200×150, two entry images 250×200, and six offline images 800×600. Online captures represent 800×600 or 1000×800 viewports at DPR 0.25; their physical resolution cannot establish full-size text, pose or hit-feedback quality. They predate the latest review fixes. The supplementary DPR 1 controller failed twice with no images (WINDOWS31); it was not repeated. No new capture files were created, so the screenshot-storage gate was not needed for this artifact-only audit; the existing evidence is already committed, not newly ignored audit output.

The findings distinguish reproducible source defects from limited historical visual evidence. None establishes real LAN certificate trust, normal pointer-lock gesture acceptance, cross-device support, Raspberry Pi capacity or FPS qualification. `needs_human_review: true` applies to full-size visual and gesture acceptance. Phone input is outside this desktop slice; no phone-layout failure is inferred.

---

## Pillar Scores

| Pillar | Score | Key Finding |
| --- | --- | --- |
| 1. Copywriting | 3/4 | Online PAUSED label inaccurately describes the continuing authoritative match. |
| 2. Visuals | 2/4 | Match controls obscure the existing ammo/weapon HUD. |
| 3. Color | 3/4 | Online entry uses blue instead of the reference's gold key-action treatment. |
| 4. Typography | 3/4 | New online instructions use 11px and entry uses 13px rather than 14px. |
| 5. Spacing | 2/4 | Bottom-left panel has no reserved HUD clearance; entry spacing also diverges from scale. |
| 6. Experience Design | 2/4 | Team-switch eligibility omits balance; failed pointer lock receives no actionable UI. |

**Overall: 15/24**

Scores are independent assessments of implemented behavior. Limited screenshots do not prove excellent visual quality, but missing human acceptance alone is not scored as a broken feature.

---

## Top 3 Priority Fixes

1. **BLOCKER — Keep ammo visible during online play.** `#mp-match-controls` covers the M4 ammo/weapon display, removing information needed for firing/reloading. Reserve the existing 68px bottom HUD band plus an 8px gap (for example, place the panel at bottom 76px), or place compact match controls in a clear region. Verify active, dead, results and rematch states at desktop size with both ammo and all actions visible.
2. **WARNING — Describe online unlock accurately and explain failed Resume.** Use online-specific text such as “Mouse released — match continues” while retaining the offline label. Show a short retry explanation if `requestPointerLock()` rejects; keep the gesture-driven Resume action available.
3. **WARNING — Disable known invalid team switches.** Derive projected BLUE/RED counts from the snapshot in addition to life/phase eligibility; disable the control when the projected difference exceeds one. Explain why beside the control while retaining the server's final validation and rejection path.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- **WARNING C-01, strong code evidence:** `index.html:168` labels the shared overlay PAUSED. `src/main.js:301` shows it on online unlock, while `src/network/onlineSession.js` continues consuming snapshots and the server continues the match. This suggests a safety the player does not have. Set the title and one sentence of explanation according to online/offline state (priority 2).
- **WARNING C-02, strong code evidence:** `src/main.js:316` disables Online TDM during joining without changing its label or showing connecting status. Assets also initially disable that button (`index.html:157`), so a user cannot distinguish loading assets from joining. Add a short “Connecting…” status during join and clear it on success/error. No cancellation/lobby flow is requested.
- Contract substantially met: errors specify recovery and avoid precise certificate diagnosis (`src/network/onlineUi.js:95`); Retry/Return, configured rules, final scores, per-player kills/deaths and authoritative Rematch countdown exist (`src/network/onlineSession.js:647`). The unsupported-action explanation is explicit (`index.html:163`). Generic labels in unrelated editor/offline controls were not treated as Phase 1 defects.

### Pillar 2: Visuals (2/4)

- **BLOCKER V-01, strong code plus limited visual evidence:** `style.css:34` positions ammo in the 68px bottom band beginning at left 36px; `style.css:79` positions the opaque match panel at left/bottom 12px with z-index 120, above the HUD's z-index 10 (`style.css:25`). The panel occupies the same ammo area throughout online play. Selected `feedback-shooter-hit.png`, `results-score.png`, `death-respawn-timer.png` and `rematch-time.png` visibly replace the lower-left ammo region with the panel. Pixel-resolution limits prevent detailed text judgment but do not obscure this geometric collision. Fix as priority 1; do not merely lower panel opacity.
- Error hierarchy is sound in code: banner z-index 2000 exceeds controls/pause; visible heading and labeled buttons provide a focal point (`style.css:77–84`, `index.html:10`). Team names accompany indicators (`src/network/onlineSession.js:454`), and online controls use text labels rather than unexplained icon-only buttons.
- **Human evidence limitation:** historical shooter/victim/rig images establish the existence of presentation states, not accepted pose, impact-position readability or animation quality. Inspect the running full-size two-window game after the overlap fix; `needs_human_review: true`.

### Pillar 3: Color (3/4)

- **WARNING COL-01, strong code evidence:** `style.css:73` gives Online TDM and Leave Online TDM `#3498db` surfaces and `#5dade2` hover surfaces, while the reference calls for existing gold `#e8c84a` on key actions. New match/error action styling already uses gold (`style.css:83`). Align the online entry/leave treatment with that bounded reference, or explicitly document this deliberate exception before treating it as compliant. Do not restyle unrelated blue S&D controls.
- New error/match rules use dark `#111e` surfaces, white text, gray border and gold headings/actions. Gold is applied by two scoped CSS declarations (heading and button groups), not a scattered accent class system. The stylesheet is plain CSS: Tailwind accent counts are inapplicable. Existing green/red health/damage and blue/red teams are integration exceptions, not evidence of accent overuse.
- No 60/30/10 ratio is declared by this reference. A rendered area ratio cannot be measured from these tiny, gameplay-dependent captures; no ratio violation or color-contrast certification is claimed. Team identification has readable words as required.

### Pillar 4: Typography (3/4)

- **WARNING T-01, strong code evidence:** new online instructions are `11px/1.6` (`style.css:76`) and entry/leave buttons 13px (`style.css:73`), below the reference's 14px body/status expectation. Raise online instructions and entry text to 14px and confirm the supported-control text wraps without pushing actions out of reach. This recommendation does not change legacy map/difficulty labels.
- Scoped overlay type uses 14px body/button text and 16px headings at inherited line-height 1.4 (`style.css:77,81,83`); `strong` supplies heading weight. The online entry/panel subset has four explicit sizes (11,13,14,16px) and normal/bold weights. Existing 17px damage numbers and compact HUD metrics are explicitly preserved by the reference (`style.css:2`). No arbitrary site-wide size/weight cap was substituted for it.
- Small online captures cannot verify perceptual readability; full-size typography acceptance remains `needs_human_review: true`.

### Pillar 5: Spacing (2/4)

- **WARNING S-01, strong code evidence, same underlying defect as V-01:** the 12px viewport inset is preserved but does not account for the existing 68px HUD. Add explicit clearance and validate panel growth for results, rejection and wrapped rules; priority 1 counts this once rather than as a separate recommendation.
- **WARNING S-02, strong code evidence:** entry/leave buttons use `12px 28px` padding and online instructions `12px 20px 0` margin (`style.css:73,76`). The reference's new-overlay scale is 4/8/16/24/32px, with a specific 12px match-control viewport-inset exception; these entry values do not follow that scale. Use scale values such as 16px 24px and 8px/16px instruction margins, preserving the existing menu layout.
- Other scoped overlay spacing follows the reference: 16px panel padding, 8px paragraph margins, 8px 16px action padding and 4px button margins. Width uses `calc(100% - 24px)`; controls have height-limited scrolling and long-text wrapping (`style.css:77–83`). A static screenshot cannot prove all wrapped-action reachability, but code supplies safeguards.

### Pillar 6: Experience Design (2/4)

- **WARNING E-01, strong code evidence:** `src/network/onlineSession.js:474` disables switching solely while alive outside results. The server also forbids a projected imbalance above one (`src/shared/tdmRules.js:109–112`), so two balanced players receive an enabled button during death/results for an action known to be impossible. Reflect snapshot balance in the disabled state and explain the reason; preserve server authority (priority 3). Current rejection text is present and safely rendered.
- **WARNING E-02, strong code evidence:** `src/network/onlineSession.js:585` catches pointer-lock rejection silently; the synchronous catch also only comments that the browser reports failure. A failed Resume leaves no application explanation. Report a concise user-facing recovery message and retain Resume (priority 2). No failure-state capture or successful normal-gesture acceptance is claimed.
- Coverage present in code: asset-disabled entry, join/retry disabling, actionable top errors with alert/live region, fresh-session retirement before Retry, safe textContent, generation-owned feedback expiry/reset, death/respawn/results countdown, snapshot-owned KILLS and automatic rematch independent of Resume. Full lifecycle cleanup includes Training Range and retired killcam cancellation. Leave is reversible and does not require a destructive-action confirmation.
- **Verification limit, not a new defect claim:** `01-REVIEW-FIX.md` supersedes historical SUMMARY/manifest passes: latest lint, both types/builds pass; 244 unit and 19 offline cases pass; multiplayer is **9/14 passing with 5 unresolved failures**. The passing recovery/lifecycle/resource cases support those paths; latest combat/authority/feedback/tracer/movement failures prevent a complete current-tree interaction acceptance claim. Host driver delays are observed, but not a proven explanation for every failure. No suites were rerun for this report.

---

## Files Audited

Registry audit skipped: `components.json` does not exist and UI-SPEC declares no component registry. No registry dependencies or CLI downloads were introduced.

- `AGENTS.md`; `.planning/config.json`; GSD UI review workflow, UI brand reference and agent-skills bootstrap (configured agent-skills mapping empty; no project skill directories present).
- Phase `01-01` through `01-07` PLAN/SUMMARY files; `01-CONTEXT.md`; `01-UI-SPEC.md`; `01-REVIEW-FIX.md`.
- `index.html`, `style.css`, `src/main.js`, `src/network/onlineSession.js`, `src/network/onlineUi.js`, `src/shared/tdmRules.js`.
- `evidence/01-07/manifest.json` and selected images: connection-error, online-menu, feedback-shooter-hit, feedback-victim, results-score, death-respawn-timer, rematch-time, offline-startbtn.

## Recommendation Count

- Priority fixes: 3 (V-01/S-01; C-01/E-02; E-01).
- Additional minor recommendations: 4 (C-02, COL-01, T-01, S-02).
- Full-size visual, trust and gesture judgment remains pending; no implementation changes were made by this audit.

## Post-audit remediation — 2026-10-04

The parent fixed all three priorities and four minor recommendations after the audit:
controls reserve the bottom 68px HUD band plus an 8px gap and retain bounded scrolling;
online unlock says MOUSE RELEASED and explains that the match continues; both Resume
buttons report failed capture through a separate safe-text input message without
mislabeling a live connection. Successful capture and teardown clear the message.
Snapshot-based projected team counts disable illegal switches; server validation
remains final. Entry shows Connecting…, and scoped entry text, gold styling and
spacing now follow the reference.

Lint and both types passed. All eight online UI unit cases passed, including legal
and illegal projected balance and capture recovery/reset. The two focused production
browser cases passed in44.5s: actual ammo/panel rectangles have at least8px clearance,
failed Resume retains an active session and shows recovery, balanced results switches
are disabled, and solo results switching/replacement/rematch remains legal. Original
server rejection/replay assertions remain in shared/server tests. Full reruns are
pending at this amendment. The original15/24 is the pre-fix score, not a new visual
approval; full-size human inspection remains pending.
