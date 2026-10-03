# Phase 01 exact-package review

Refreshed 2026-10-03, approximately 10:23–10:28 UTC, for task 01-01-01. Human approval was pending at that checkpoint; the approval received below now satisfies the gate. No packages were installed, package code executed, application files changed, tasks completed, or task commits created by the initial review itself.

All four exact npm view commands exited 0 and returned the requested version with registry source/publication metadata. Research publication dates and package-wide weekly download observations match the refresh. The download window is 2026-09-25 through 2026-10-01; these are not exact-release download counts.

| Package | Exact version | Published UTC | Weekly package downloads | Source repository | Packaged install hooks |
| --- | --- | --- | ---: | --- | --- |
| @colyseus/core | 0.18.18 | 2026-09-29 15:39:22.570Z | 112434 | https://github.com/colyseus/colyseus | No preinstall/install/postinstall |
| @colyseus/sdk | 0.18.4 | 2026-09-23 05:24:00.382Z | 69971 | https://github.com/colyseus/colyseus | No preinstall/install/postinstall |
| @colyseus/schema | 5.0.35 | 2026-09-30 16:07:13.828Z | 134533 | https://github.com/colyseus/schema | No preinstall/install/postinstall; prepare: npm run build |
| @colyseus/ws-transport | 0.18.4 | 2026-09-25 21:57:07.363Z | 94924 | https://github.com/colyseus/colyseus | No preinstall/install/postinstall |

## Primary evidence

Exact registry manifests: [core](https://registry.npmjs.org/@colyseus/core/0.18.18), [SDK](https://registry.npmjs.org/@colyseus/sdk/0.18.4), [schema](https://registry.npmjs.org/@colyseus/schema/5.0.35), [transport](https://registry.npmjs.org/@colyseus/ws-transport/0.18.4).

Exact npm page fetches returned HTTP 403: [core](https://www.npmjs.com/package/@colyseus/core/v/0.18.18), [SDK](https://www.npmjs.com/package/@colyseus/sdk/v/0.18.4), [schema](https://www.npmjs.com/package/@colyseus/schema/v/5.0.35), [transport](https://www.npmjs.com/package/@colyseus/ws-transport/v/0.18.4). Rendered page contents were not verified. Registry and official repository evidence was accessible.

Official npm download API: [core](https://api.npmjs.org/downloads/point/last-week/%40colyseus%2Fcore), [SDK](https://api.npmjs.org/downloads/point/last-week/%40colyseus%2Fsdk), [schema](https://api.npmjs.org/downloads/point/last-week/%40colyseus%2Fschema), [transport](https://api.npmjs.org/downloads/point/last-week/%40colyseus%2Fws-transport).

Published tarballs were downloaded in memory and their SHA-512 checked against registry dist.integrity. All packaged name/version/repository fields matched. No preinstall, install, postinstall or root binding.gyp was found. No package code/scripts were run. Schema declares prepare, so claiming it has no scripts would be inaccurate. [npm lifecycle documentation](https://docs.npmjs.com/cli/v11/using-npm/scripts/)

Official source manifests matching the requested releases: [core](https://raw.githubusercontent.com/colyseus/colyseus/992b45f2f8f163d11da1b4c4d88d3bc3b9975f46/packages/core/package.json), [SDK](https://raw.githubusercontent.com/colyseus/colyseus/992b45f2f8f163d11da1b4c4d88d3bc3b9975f46/packages/sdk/package.json), [schema](https://raw.githubusercontent.com/colyseus/schema/0c153ad768c5684f805eda12f89ede2fdf190bc5/package.json), [transport](https://raw.githubusercontent.com/colyseus/colyseus/992b45f2f8f163d11da1b4c4d88d3bc3b9975f46/packages/transport/ws-transport/package.json).

## Limitations

Core and transport registry gitHead fields point to older source manifests: [core 0.15.0-preview.8](https://raw.githubusercontent.com/colyseus/colyseus/c45b410e99eadffff4b74e701339992e2faa15f8/packages/core/package.json) and [transport 0.14.17-alpha.8](https://raw.githubusercontent.com/colyseus/colyseus/320a0325f01eff3cd7afa8fb2efa80077ebdbf4a/packages/transport/ws-transport/package.json). Current official source retains those fields. Inherited stale metadata is an inference; the fields cannot prove release-to-commit correspondence. SDK has no gitHead. Schema's registry commit matches its version.

The prior SUS classification means recent publication only, not a vulnerability or malware finding. The source metadata limitations are separate observations and do not establish malware. Registry integrity matching verifies the retrieved bytes against registry metadata; it does not constitute a source-code security audit.

The existing isolated --ignore-scripts probe supplies install/import, two Node SDK clients joining/input, and certificate/HTTPS evidence. It is not approval, browser gameplay/WSS verification, or a Pi performance measurement. Express 5.2.1 and selfsigned 5.5.0 were OK in that research audit.

## Required decision

Task 01-01-01 in [01-01-PLAN.md](01-01-PLAN.md) says: "Do not install flagged packages until the human explicitly approves these versions."

The checkpoint requested approval of @colyseus/core 0.18.18, @colyseus/sdk 0.18.4, @colyseus/schema 5.0.35, and @colyseus/ws-transport 0.18.4 with the disclosed limitations. A changed version requires refreshed compatibility research/planning. At the checkpoint, approval was unrecorded and 0/3 tasks and 0/7 plans were complete; the subsequent human response is recorded below.

Continuation must use a fresh executor with the response and this review, resume task 01-01-01 to record actual approval, and then execute 01-01-02 and 01-01-03. The dispatch root-pin assignment has been corrected without substituting its literal unbound-marker case arm; verify the guard before continuation writes.
## Human approval received

On 2026-10-03, the human replied **approve** to the exact four-release approval request, after receiving the review and its limitations. This authorizes @colyseus/core 0.18.18, @colyseus/sdk 0.18.4, @colyseus/schema 5.0.35 and @colyseus/ws-transport 0.18.4. The blocking-human condition is satisfied; resume the first plan with a fresh executor. No substitute versions are authorized by this record.
