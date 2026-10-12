# TASK-023 — Implement truthful native resolution on mobile

Status: `planned`

Lead/reviewer: Codex

Implementer: DeepSeek

Starting commit: assign after the accepted TASK-017 chain is remote-backed

Depends on: TASK-008 accepted

## Goal

Remove the proven DPR-3 canvas upscaling path without weakening the existing pixel-budget protection or changing the
custom combat HUD. A user-selected `native` mode must mean the device's real pixel ratio, bounded only by the existing
pixel budget; native clients may adopt it as their first-run default only after measured Android performance passes.

## Design decision

1. `resolution=native` uses `devicePixelRatio` as its ceiling instead of the current constant `2`.
2. The sprite/field canvas keeps its `3_700_000` pixel budget. The 3D board keeps its independent `2_100_000` budget
   and board-quality policy; changing sprite sharpness must not silently raise every board tier.
3. Existing explicit `720p`, `1080p` and `1440p` modes retain their current ceilings. Browser `auto/high` remains
   unchanged in the first implementation so desktop fill rate and battery cost do not change without evidence.
4. If physical Android measurements pass, a native client with no saved resolution preference may default to
   `native`. Existing users' saved settings are never overwritten. This default switch must be a separate, clearly
   reviewable hunk and may be withheld while the truthful `native` option still ships.
5. CSS layout, safe areas, HUD geometry, WebP conversion and local-asset routing are separate concerns and are not
   part of this task.

## Scope

- Change the resolution-cap model so `native` has an explicit uncapped/device-ratio meaning rather than aliasing 2×.
- Update field and board renderers to consume that meaning without using `Infinity`, `NaN` or an accidental fallback.
- Preserve resize, rotation, bfcache restore and monitor-DPR-change re-rasterisation.
- Add focused unit tests for DPR 1/2/3/4, phone/tablet/desktop areas, every resolution mode and both pixel budgets.
- Extend the diagnostic probe or an excluded test harness to report before/after backing ratio and frame stability.
- Measure visual result, frame pacing, memory pressure and recovery after rotation on one physical Android device.
- Record the emulator result separately; it is useful regression evidence but does not substitute for physical-device
  thermal, GPU and WebView measurements.

## Protected areas

- No custom combat HUD layout, health/skill/equipment bars, deployment wheel or top-HUD art change.
- No server, simulation, protocol, room, account, record/card or matchmaking change.
- No PNG/WebP conversion, asset replacement, manifest regeneration or native local-asset routing change.
- No wrapper runtime edit unless a separate wrapper task is accepted and its Git baseline exists.
- No client package, production deployment, manifest publication or default-setting migration in this implementation
  task.

## Acceptance checks

- On a DPR-3 phone-sized viewport in `native`, `canvas.width / (cssWidth * devicePixelRatio)` and the height equivalent
  are approximately `1.0` unless the recorded pixel budget is the binding term.
- `720p`, `1080p`, `1440p`, `auto/high`, `medium` and `low` retain their documented behavior.
- Field and board calculations are separately asserted; the board never inherits the field's larger budget by mistake.
- Rotation and viewport restoration settle without oscillation, stale backing sizes or a blank canvas.
- Physical Android before/after evidence records DPR, viewport, backing size, average frame time, worst observed frame
  time and whether the WebView was killed or reloaded under pressure.
- Targeted tests, changed-file lint, `npm run ci` and `npm run golden` pass; golden results remain unchanged.
- Complete diff contains no protected-area or release/deployment change.

## Required implementation sequence

1. Freeze the accepted starting commit and list the exact renderer/settings files expected to change.
2. Add failing tests for truthful `native`, explicit fixed modes and independent board/field budgets.
3. Implement the smallest cap-model change that makes those tests pass.
4. Re-run the TASK-008 probe at DPR 3 and record the backing-ratio correction.
5. Test a physical Android device before proposing any native-client first-run default.
6. Mark `review_ready` and stop. Do not build or publish a client.

## Review notes

Codex must reject any implementation that merely changes every cap from 2 to 3, removes the pixel budgets, couples
the board to the field cap, or treats emulator-only evidence as proof of mobile performance.

## Rollback

Revert the TASK-023 implementation commit. Resolution settings are client-local and this task adds no migration, so a
code revert restores the prior cap behavior without server or data rollback.
