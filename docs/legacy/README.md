# Legacy documentation (for review)

Kept from the GSD planning setup that was removed on 2026-10-15, and from older docs that
describe past work. Nothing here is a current instruction: paths, counts, test names and tools
mentioned in these files may no longer exist. The full history, including everything not
copied here (every plan, summary, evidence file and review record), stays in git: commit `4a136f0` is the last one with the
old `.planning/` tree (`git show 4a136f0:.planning/ROADMAP.md`, or check it out in a separate worktree).
The untracked research cache (captured videos, frames, timing sessions) was deleted and is not
in git.

Worth reading first:

| File | Why |
| --- | --- |
| `phases/07-animation/07-PHASE5-HANDOFF.md` | The owner's direction for the next movement work (prone and dive first, live review of every animation) and every known motion limit left open |
| `debug/phase7-human-motion-review.md` | Measured defects of the authored `vod7_` clips (knee signs, missing pelvis motion, identical dive/prone) |
| `research/` | Early research on stack, features, architecture and pitfalls for the multiplayer FPS direction |
| `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md` | The previous product goals, requirement IDs and the 12-phase plan |
| `codebase/` | A map of the code as of September 2026 (architecture, concerns, conventions, testing) |

Also here:

- `phases/01-two-client-tdm/`, `phases/06-human-characters/`, `phases/07-animation/`: context,
  discussion, research, verification and UAT records of the three phases that were executed,
  plus the Phase 7 reviews and the owner's recorded verdicts.
- `debug/phase7-repair-browser-failures.md`: the first-person crouch contact regression and
  how it was found.
- `ANIMATION-SPACES.md`, `ANIMATION-REVIEW.md`, `ANIMATIONS.html`: the earlier animation audits
  and the retargeting investigation.
- `ART.md`, `tools-README.md`: the Phase 6/7 art and measurement workflow in full, including
  commands for tools that were deleted.
- `REFACTOR.md`: an old refactor audit with completed and deferred items.
- `WINDOWS.md`, `ONBOARDING-SUMMARY.md`: setup notes from onboarding.
