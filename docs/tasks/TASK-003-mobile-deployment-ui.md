# TASK-003 — Hybrid deployment wheel and mobile result exit

Status: `review_ready`

Lead: Codex

Implementer: DeepSeek (implementation complete; awaiting lead review)

Starting baseline: `e0231293`

## Goal

Improve deployment feel on touch devices without losing the current quick controls, and guarantee that a phone user
can always leave the result screen without depending on browser fullscreen.

## Scope

- Port Paper-Yuan's circular four-way joystick visuals, knob/beam feedback, 45-degree snapping and lower-cost wheel
  tracking.
- Preserve this fork's direct direction-chevron tap and keyboard operation.
- Keep mirrored Final Assault direction mapping and range preview behavior.
- Preserve and harden the safe-area-aware result exit action for short landscape screens; reproduce any remaining
  native-wrapper failure before changing its layout.
- Verify at 568x320, 640x360, 756x366, 812x375 and 844x390 CSS-pixel viewports.

## Protected areas

- Do not replace the custom combat HUD.
- Do not copy Paper-Yuan's room voice, native Android runtime or unrelated device styles.
- Do not alter placement protocol semantics or server simulation rules.

## Acceptance checks

- Dragging from the wheel centre reliably chooses one of four directions; centre release cancels.
- Tapping a direction remains supported on touch screens.
- Result exit remains visible and tappable without entering fullscreen.
- Mouse, touch, keyboard and mirrored-board tests pass.

## Rollback

Revert the wheel/component and responsive result-screen changes as one task; no data migration is involved.

## Current checkpoint

### 2026-10-12 13:58 — implementer (DeepSeek), steps 1-3 of 5 done

- Worktree: branch `integrate-upstream-0.2.3`, clean at start; runtime baseline `e0231293` (HEAD `8e97423d` is a
  docs-only checkpoint on top, verified to touch no runtime file).
- Done, all four files in scope:
  1. **45-degree sector snapping** — `dirFromDelta` (`public/js/ui/facing.js`) resolves the swipe through `atan2`
     sectors (RIGHT −45..45, DOWN 45..135, UP −135..−45, LEFT the rest) instead of the dominant axis. Bounds reproduce
     Paper-Yuan `e0a28445` exactly. `test/ui/facing.test.js` extended with the boundary and just-past-boundary cases.
  2. **Circular joystick visuals** — `public/js/ui/facingWheel.js`: the diamond became a circle with four 45-degree
     sector paths, a dashed sub-ring, two diagonal dividers and a knob + beam that follow the drag. The knob is
     clamped to 60% of the radius (feedback, not a cursor), is drawn only while a pointer is down, and the `inside()`
     test became radial (the old `|dx| + |dy|` diamond reached sqrt(2) further at its corners than the drawn shape).
     `public/css/screens/game-panels.css` gained `.fwheel__subring`, `.fwheel__axis`, `.fwheel__stick`,
     `.fwheel__knob`, `.fwheel__knobdot` and Paper's ring/sector values.
  3. **Lower-cost tracking** — the wheel's tile follower and both range-stripe loops re-project at ~30 Hz instead of
     per animation frame (Paper's change), plus Paper's guard for the stripe layer when the canvas has been
     re-parented between effect and run.
- **Preserved deliberately**: the chevron tap (`onPick`, the r=22 `.fwheel__chevhit`, `.fwheel__chev` + `:active`
  CSS), the `audio` tab blip, the keyboard path, `boardDir()` mirroring and the range preview. Paper deletes all of
  the tap control; nothing of it was taken from upstream.
- New test: `test/ui/facing-wheel-geometry.e2e.test.js` (3 tests) renders the real `FacingWheel` over a synthetic view
  bridge and asserts the circle/sub-ring/dead-zone radii, that each sector is a 100-radius wedge whose corners sit on
  the diagonals 90 degrees apart, the knob's clamp, and that the lit sector always equals the direction the wheel
  commits.
- New coverage: `test/ui/community-layout.e2e.test.js` now runs the five viewports the task names (568x320, 640x360,
  756x366, 812x375, 844x390) plus the two it already had, x3 text sizes = 21 cases, all pass without fullscreen.
- Tests run: `eslint` 0 errors (changed files clean at `--max-warnings 0`); `node --test test/ui/facing.test.js` 17/17;
  `unitFacing`/`gameLogic`/`uiFixes`/`text-scale`/`devices` 131/131; `npm run golden` 287/287 (unchanged);
  full `node --test` 6049 pass, 23 skip, **1 fail = `test/assets-env-proxy.test.js`**, proven pre-existing by
  stashing this work and reproducing it identically on the clean baseline (Node 24 vs `nodeHonoursEnvProxy`).
  E2E: `facing-tap` 2/2, `facing` 4/4, `facing-wheel-geometry` 3/3, `community-layout` 21/21.
- Remaining: (4) the native-wrapper result-exit reproduction, still blocked on the maintainer's APK and on-device
  measurements — not reproducible by viewport alone, and no layout change was made to the protected result screen;
  (5) the lead's review.
- Files changed: `public/js/ui/facing.js`, `public/js/ui/facingWheel.js`, `public/css/screens/game-panels.css`,
  `test/ui/facing.test.js`, `test/ui/community-layout.e2e.test.js`, new
  `test/ui/facing-wheel-geometry.e2e.test.js`, plus this task file and `docs/ops/2026-10.md`.
- Production/GitHub: unchanged; nothing committed, pushed, built or deployed.
- Rollback: `git checkout -- public/js/ui/facing.js public/js/ui/facingWheel.js public/css/screens/game-panels.css
  test/ui/facing.test.js test/ui/community-layout.e2e.test.js` and delete the new test file; no data migration.

### 2026-10-12 13:53 — implementer (DeepSeek), implementation complete → `review_ready`

- CI: `npm run ci` stops at the `test` step on the pre-existing `assets-env-proxy` failure (proven pre-existing on the
  clean baseline), so its later steps never ran. Run separately and all green:
  `node tools/ci.mjs --only setup,smoke,lint,imports,typecheck` → setup ok, smoke ok, lint ok (0 errors, 553
  warnings), imports ok, typecheck ok, "all steps passed".
- `imports` prints three `sim-node` violations in `server/sim/nodeData.js` (`node:fs` / `node:path` / `node:url`) but
  still reports ok. That file is **untouched by this task** (`git status` clean) — the notes are pre-existing and
  outside this scope; recorded here so the reviewer does not attribute them to TASK-003.
- Docs consistency: `node --test test/docs-consistency.test.js test/docs-paths.test.js` 31/31 pass.
- Golden: `npm run golden` 287/287 unchanged, so no intended gameplay change and no golden move.
- Honest statement of what is NOT done: the result screen was not modified at all. Its exit passes at every required
  viewport without fullscreen, so per the scope wording ("reproduce any remaining native-wrapper failure before
  changing its layout") the layout change is withheld until an APK and on-device measurements arrive.
- Reviewer should verify: that no Paper-Yuan code beyond the wheel/visual/tracking changes was imported; that the
  chevron-tap, `audio` blip, keyboard path, mirroring and range preview survive; and that `git diff e0231293` touches
  no protected area.

## Preparation checkpoint

- Paper-Yuan reference: branch `0.2.4`, commit `e0a28445`.
- Candidate wheel files: `public/js/ui/facing.js`, `public/js/ui/facingWheel.js` and the `.fwheel__*` rules in
  `public/css/screens/game-panels.css`/`public/css/devices.css`.
- Paper changes the diamond into a circular joystick, adds knob/beam feedback, 45-degree sectors and ~30 Hz geometry
  tracking, but removes this fork's direct chevron-tap commit. Port selectively and keep the tap behavior.
- Current result-exit E2E passes at 1366x768, 844x390, 640x360 and 844x320 with md/lg/xl text, Android client UA and
  no fullscreen (12/12). The earlier real-device complaint therefore needs wrapper/viewport reproduction rather than
  an assumed CSS rewrite.

## Next action

Diff the two wheel implementations at function and style-rule level, then port the circular interaction behind focused
mouse/touch tests without changing protocol behavior.
