# TASK-014 — Replace the top HUD frame and rest capsule art

Status: `accepted`

Lead: Codex

Implementer: Codex

Starting commit: `591d3d45`

## Goal

Use the maintainer-provided official-style art for the top HUD's middle frame and the literal `休息一下` capsule,
without changing any match rules or other combat UI.

## Scope

- Replace the locally installed `hudPanel/frame_mid_normal.png` and `hudPanel/bg_rest.png` art at their existing
  manifest paths; game art remains ignored by Git.
- Position the source PNGs through CSS so their transparent source margins do not shrink the visible artwork.
- Use the baked `休息一下` capsule only for `PHASE.PREP`; retain dynamic text for draft, round-start, battle-check
  and settle states.
- Add a focused UI regression test for that phase split.

## Protected areas

- No server, simulation, placement protocol, room, account, record or result changes.
- No changes to the boss bar, check buttons, round counter, LP counter, mobile DPR work or native wrapper.
- No `data/*.json` edits and no new game art committed to Git.
- No package, client build, deployment or production update in this task.

## Acceptance checks

- The normal and boss-width top meters use the supplied dark frame without visible transparent padding.
- `PHASE.PREP` uses the supplied complete `休息一下` art and has an accessible label.
- Other non-combat phases continue to show their translated live labels rather than the baked rest text.
- `node --test test/ui/top-hud-art.test.js` passes.
- Relevant package/art checks confirm the two existing manifest paths still ship.

## Current checkpoint

- Source images inspected: both are 2172×724 ARGB PNGs with large transparent margins.
- Existing manifest paths confirmed in `data/assets.json`; replacing those ignored files keeps full-package inclusion.
- Installed art hashes: `frame_mid_normal.png` = `4FA2E8DC…5704`; `bg_rest.png` = `4B0EDA5E…64BA`.
- CSS crops only the transparent source margins; it does not resample or recompress either PNG.
- `PHASE.PREP` alone receives `capsule--rest-art`; other preparation labels remain live and translated.
- Visual check: project game mock at 1920×1080, captured in
  `.local/task-014-top-hud-art/top-center.png`; frame and capsule fill their intended boxes without clipping.
- Verification: targeted UI/package tests 71/71; changed-file eslint 0 errors and one pre-existing `MicroLabel`
  warning in `hud.js`; full-package dry run lists both replaced manifest paths.
- No build, deployment, production update or Git push performed.

## Review notes

Accepted by Codex after code, package and 1920×1080 visual review. The supplied capsule is intentionally limited to
the literal rest phase so it cannot lie during `机变阶段`, `回合开始`, `协议启动` or `回合结算`.

## Rollback

Restore the two original ignored PNGs from `.local/task-014-top-hud-art/original/` and revert the TASK-014 code/docs
diff. No service restart or production rollback is involved.
