## Deferred Items

- Incursion can place an enemy of the first wave on the player's own cell
  status: open
  **Found in:** plan 07-38, task 1 (read from source; the spawn itself was not observed in a run).
  **What:** `rebuildAllEnemies()` places ten enemies on random walkable cell centres
  (`randomSpawnCell` in `src/entities/enemies.js`). It leaves out cells near cell (1,1) and cells near
  another enemy, not the player's cell. On `bunker` the player starts at the centre of cell (11,11),
  one of 394 walkable cells.
  **Why it matters here:** the pitch-view case of `tests/first-person-rig.spec.js` starts Incursion and
  lowers the camera by hand at the player's start. A labelled control in plan 07-38 put one enemy within
  0.1 to 0.25 m of that cell centre: 12 of 324 placements left the four standing frames under 1 percent
  ink and blackened a crouched frame by more than 5 percent, the pattern of the frames on record from
  2026-10-11 13:26 UTC. Whether an enemy stood there in that run cannot be told from its files.
  **Not fixed:** `src/entities/enemies.js` is outside plan 07-38.

- A crouched character stands up on its legs for each foot turn
  status: resolved
  **Resolved in:** plan 07-38, Amendment 2, decision F (commit `83f5ca5`): the driver no longer plays a
  foot turn on the leg layer while the pose is crouching. The text below is the finding as first logged.
  **Found in:** plan 07-38, task 3 (read from source and measured in Node on the real rig).
  **What:** when the view has twisted more than 0.42 rad from planted feet, the driver plays a foot
  turn of 0.4 s on the lower layer (`key = pose.jump ? ... : pose.turn || ...`,
  `src/builders/enemyAnimations.js` line 520). Both turn clips are the held frame of the standing idle
  (`turn_left: ['idle', 0, 'held']`, `src/builders/enemyGLTF.js` line 138); there is no crouched one. So
  the legs of a crouched actor take the standing pose for the turn: the pelvis goes from 0.47 m to
  0.877 m above the root, which is 0.027 m above the crouched eye of 0.85 m.
  **Why it matters here:** the first-person body view copies those legs, so hips and thighs pass
  through the eye while a crouched view turns (nearest surface 0.000 to 0.109 m; a black shape over
  11 to 39 percent of the screen in 2 to 5 of about 120 frames of a swing). It is also what third
  person and other players see of a crouched character turning on the spot.
  **Not fixed:** both files are outside plan 07-38, and `enemyAnimations.js` is pinned to commit 3665406.
