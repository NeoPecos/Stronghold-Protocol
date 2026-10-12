# TASK-015 — Selectively integrate upstream v0.2.5

Status: `planned`

Lead/reviewer: Codex

Implementer: DeepSeek

Starting commit: `TBD after TASK-017 is accepted and pushed`

Upstream target: `sganggs/Stronghold-Protocol` tag `v0.2.5`, commit
`cf7a9400270d5aa79b2e601e405dab782e25f120`

## Goal

Bring the upstream `v0.2.4..v0.2.5` gameplay fixes, data changes, supported tooling and compatible client features
into this fork without overwriting its account/record systems, room flow, deployment wheel or custom in-game UI.

## Scope

### Required first pass

- Freeze the actual starting commit after all current Codex-owned dirty files are either committed as one reviewed
  checkpoint or explicitly excluded. Do not start from an anonymous dirty tree.
- Produce a provenance table for all 221 upstream-changed files with one of four outcomes:
  `apply`, `selective-port`, `protected-skip`, `generated/recompute`.
- Group the upstream commits by behavior rather than applying the release tag as one merge.

### Expected ports

- Gameplay and deterministic-simulation fixes: drone/operator attacks and redeploy reset, 洛洛 S2 lock behavior,
  Touch aggro/detail behavior, death-fog silence, hit-tile rounding/edge inset, official trigger/funnel fixes and the
  调度中心 promotion reward.
- Match/server fixes: bot opening-faction coordination, refresh request deduplication, reconnect overlay action,
  boss-pair test assumptions, loadout restore/import races and related protocol-compatible changes.
- Optional upstream client features only after conflict review: official damage numbers (default off), official 3D
  battlefield scene support with metal-board fallback, simulation consistency page, packaging/setup fixes and i18n
  corrections.
- Regenerate generated data through its builder and recompute goldens only for named, attributable behavior changes.

### Explicit conflict review

- Compare every upstream change under `public/css/screens/game.css`, `public/js/ui/hud.js`, `public/js/screens/game.js`,
  `public/js/render/`, `public/js/screens/title.js`, `public/js/screens/loadout.js`, `shared/protocol.js` and
  `server/match/` against this fork before applying it.
- Preserve TASK-003's circular deployment wheel, including chevron tap, `r=22` hit target, sound, keyboard path,
  `boardDir` mirroring and range preview.
- Preserve TASK-007 native fullscreen hiding and TASK-014's supplied top-frame / literal-rest art behavior.
- Record upstream features deliberately omitted and why; do not silently drop them.

## Protected areas

- No wholesale merge of `v0.2.5` or `upstream/master`.
- Do not overwrite this fork's account/password database, nickname uniqueness, personal records/cards, room directory,
  alliance flow, spectator behavior, browser gate, client update mechanism or production hotfixes.
- Do not replace the custom battle HUD, health/skill/equipment bars, cost UI, boss bar, covenant strip, result cards,
  deployment animation/voice or mobile layout fixes with upstream versions.
- No room voice, TeamSpeak/WebSpeak, CDN activation or unreviewed native Android runtime.
- Do not commit extracted official scene/game art. Scene support code may land; local assets remain ignored.
- No package, client build, deployment, production restart or version-manifest edit in this task.

## Acceptance checks

- A reviewed provenance table covers all files in `git diff --name-status v0.2.4..v0.2.5`.
- Diff review proves every protected fork feature above remains present and server/sim changes are attributable to
  named upstream commits.
- Targeted tests for every ported behavior pass; generated data is built, never hand-edited.
- `npm run ci` and `npm run golden` pass, or every pre-existing failure is reproduced on the frozen starting commit.
- Golden changes list each moved scenario and the exact upstream behavior responsible.
- TASK-015 reaches `review_ready` before TASK-016 may build or deploy anything.

## Current checkpoint

- Upstream tag fetched read-only on 2026-10-12. Range `v0.2.4..v0.2.5` contains 221 changed files,
  10,420 insertions and 2,027 deletions.
- The release includes substantial deterministic-sim, server, rendering, packaging, data and golden changes; this is
  not safe as a blind merge.
- Current worktree contains accepted/local UI and governance work not yet checkpointed. DeepSeek must not begin until
  Codex records the clean starting commit.
- Exact next action: complete and review TASK-017, push its checkpoint chain to the existing origin branch, then fill
  this task's starting hash from that accepted remote baseline.

## Review notes

Codex reviews the complete diff against the frozen starting commit and the provenance table. A passing upstream test
suite alone is not evidence that fork-specific behavior survived.

## Rollback

Before review, discard only TASK-015-owned commits/files back to its frozen starting commit. Never reset or clean the
shared working tree while unrelated local work exists. Production rollback belongs exclusively to TASK-016.
