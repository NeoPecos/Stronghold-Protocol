# TASK-003 — Hybrid deployment wheel and mobile result exit

Status: `in_progress`

Lead: Codex

Implementer: unassigned

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
