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
