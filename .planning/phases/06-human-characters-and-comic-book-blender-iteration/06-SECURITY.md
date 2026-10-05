---
phase: "06"
slug: human-characters-and-comic-book-blender-iteration
status: verified
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: "2026-10-05"
---

# Phase 6 — Security

The plan-authored register was checked against the implementation at `675b746`.
All 14 distinct threats have implemented mitigations. This is the configured
ASVS L1 source/evidence check, not a penetration test. Per secure-phase's L1
short-circuit rule, zero open threats does not require a deeper auditor dispatch.

## Trust Boundaries

| Boundary | Control |
| --- | --- |
| External runtime/body inputs → local authoring | Fixed HTTPS sources, pinned archive/input SHA256, retained asset-specific terms |
| Local operation arguments → editable source/cache | Exact operation/schema/ranges; canonical owned paths; linked-path rejection; disabled autoexec |
| Asset data → browser presentation | Bounded GLB/image inspector; protected compatibility and active render graph; playable fallback |
| Local preferences → render/DOM | Exact enum and DPR caps; fixed text; storage-error handling |
| Capture tools → browser/server/files | Owned loopback server/contexts/cache, response-only asset routing and finally cleanup |

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation and checked evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T-06-01 | Tampering | Runtime/base | high | mitigate | `pipeline.mjs` PIN/hash/download bounds; provenance input-specific CC0 evidence; executed bootstrap/probe | closed |
| T-06-02 | Elevation | ZIP/CLI/output paths | high | mitigate | `owned`, `zipEntries`, argument-array spawn, factory startup/disable-autoexec; corrupt archive/link/escape rejection self-tests | closed |
| T-06-03 | Denial of service | GLB/images/weights | medium | mitigate | Inspector accessor, numeric, geometry, PNG and total pixel budgets; 12 negative/semantic self-tests | closed |
| T-06-04 | Denial of service | Geometry/atlas | medium | mitigate | `character-params.json` budgets; bounded packed maps/1024px atlas; inspected current export | closed |
| T-06-05 | Tampering | Visual/world authority | high | mitigate | No server/shared changes in phase diff; bunker change is material assignment; 14 production multiplayer checks passed | closed |
| T-06-06 | Denial of service | Ink/tint caches | medium | mitigate | Weak ownership, explicit retirement; unit and live-keeper production/browser plateau scenarios | closed |
| T-06-07 | Tampering | Skin/team/render state | medium | mitigate | Explicit accent allowlist and clone ownership; finally render/eye restoration; real fallback team regression 2/2 after CR-01 | closed |
| T-06-08 | Denial of service | Quality/DPR | medium | mitigate | Exact low/medium/high enum and caps 1/1.5/2; 14 policy tests and resize/lifecycle cases | closed |
| T-06-09 | Tampering | DOM/error state | medium | mitigate | Fixed `textContent` loading/status copy; separate connection owner; fallback/compact/native-input tests | closed |
| T-06-10 | Elevation | Edit operations/paths | high | mitigate | Node and Python exact allowlists/ranges; source backups; no arbitrary prompt code/network; path/link/duplicate/range negatives | closed |
| T-06-11 | Repudiation | Export/review evidence | medium | mitigate | Source/runtime/script/export/capture/log hashes; schema 2 active render graph; fresh independent recovery; failed pixel attempt retained | closed |
| T-06-12 | Tampering | Multiplayer review | high | mitigate | Test-only browser response routing; observation-only production fixture; protocol/simulation unchanged | closed |
| T-06-13 | Denial of service | Capture/fixture lifetime | medium | mitigate | Explicit free loopback port, bounded samples, owned process/context cleanup in `finally`; existing review server preserved | closed |
| T-06-SC | Tampering | Dependency installs | high | mitigate | No package.json/package-lock changes or npm/pip/cargo additions; pinned portable Blender only; MIT outline attribution retained | closed |

## Accepted Risks Log

No new accepted security risks. Inherited redistribution terms and physical-device
performance remain explicit project limits; this audit does not clear either.
The existing Phase 1 self-signed testing-certificate exception remains unchanged.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
| --- | --- | --- | --- | --- |
| 2026-10-05 | 14 | 14 | 0 | Codex orchestrator, plan-register L1 source/evidence verification |

## Sign-Off

- [x] All planned threats have a disposition and checked mitigation.
- [x] No unapproved accepted-risk closure.
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set; deeper L2/L3 testing was not claimed.

Approval: verified 2026-10-05 at configured L1 depth.
