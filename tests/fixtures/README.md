# Immutable uncached owner comparisons

These files contain exact source bytes from reviewed pre-cache revision
`1e537a47030d535ceefde6c4af445e5cfb5d1a3e`:

| Fixture | Original path | SHA256 |
| --- | --- | --- |
| `enemyAnimations.uncached.js` | `src/builders/enemyAnimations.js` | `8217f32ff2c4a65613aadcf62442c092a3e0d604f8ff5f7c5dc361b730d4aee0` |
| `weaponHandling.uncached.js` | `src/builders/weaponHandling.js` | `15a060eeb4ea2ce4054293ea6737afe3c346e5bb01be6ef3cd7db90257c217ea` |

The browser specs verify these hashes before adapting only the Three.js browser
binding and Vite JSON import spelling. The originals retain all uncached lookup,
pose, correction, layer, contact and rest logic. They are routed at their original
module directory so their relative runtime imports resolve against the loaded
game. Tests compare that implementation with the current cached owners on separate
real loaded rigs. Fixtures do not run directly or update with current source.

Checking them in makes test discovery independent of Git history, worktree trust,
and checkout path. No CI history fetch is required.
