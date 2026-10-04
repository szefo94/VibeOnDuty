# Plan01-07 capture evidence

[manifest.json](manifest.json) records each PNG's dimensions, SHA256 and write time.
The clean full production run passed13 tests in6.4minutes. Its20 images come from
two actual Playwright Chromium contexts using the isolated production server,
current GLB and ordinary game input. They show armed/moving rigs, confirmed shooter
feedback versus the victim, death/respawn, both clients' score/time results,
automatic rematch, recovery, repeated joins and offline return.

The production suite uses an800x600 viewport with deviceScaleFactor0.25;18 saved
images are200x150 physical pixels. Its entry scenario uses1000x800 and saves two
250x200 images. Six800x600 offline captures show Incursion,
Adaptive, S&D, TDM, Training Range and the editor after online leave. The final
editor capture follows the Training Range cleanup fix and has no retained range HUD.

These are automated state/capture evidence. They do not establish full-size rig,
map or feedback visual quality, real LAN certificate trust or usable gesture-driven
pointer lock. Automated HTTPS tests bypass certificate errors explicitly. Parent
phase acceptance retains those human judgments, the HOST-03/MODE-01 unclassified
probes and the descriptor-less capacity/transparency prohibition.

The additional800x600 deviceScaleFactor1 controller in[01-07-CAPTURE.mjs](../../01-07-CAPTURE.mjs)
timed out twice at its first waypoint and produced no images. The second attempt
reached approximately(62.23,46.42) while its0.35m tolerance oscillated with software
render/input latency and stale-input rejection. This is an unverified extra capture,
not a passed result or a substitute for human review. Its owned fixture and both
browser contexts were closed in finally; no persistent review server was started.
