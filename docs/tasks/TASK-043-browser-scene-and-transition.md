# TASK-043 — Browser official scenes and transition motion

Status: `in_progress`
Lead / implementer: Codex
Starting commit: `4c517699`; isolated 0.2.6 integration worktree already contains staged and unstaged release work.

## Scope

- Make the existing unite, perfect-battle/settlement and round-start animations play in browsers even when the host reports reduced motion.
- Identify why browsers show the procedural 3D board instead of the 0.2.5 official scenes across the eleven supported stages; change scene loading only after the shared failure is identified.

## Protected areas

- Keep every other reduced-motion rule intact, including non-transition effects.
- Do not change Android-native behavior, animation artwork/timings, game rules, CDN configuration, native packages, versions or release metadata.
- Do not deploy without a separate maintainer instruction.

## Acceptance

- Browser transitions animate for the three named sequences; Windows behavior remains, Android-native behavior is unchanged.
- A supported official-scene stage displays its stage-specific scene instead of the procedural board after assets are available.
- Maintainer performs visual acceptance; no project tests, screenshots or evidence-style verification without an explicit request.

## Rollback

- Revert the browser-only class activation in `public/js/ui/device.js`; restore any later scene-loading changes independently.

## Checkpoint

- Maintainer clarified that this is the 0.2.5 eleven-scene feature, absent in browser generally, not one missing stage. The supplied screenshot shows the procedural 3D board. Production has eleven stage packs and matching manifest groups; scene JSON versions and binary byte counts match. The production scene loader, asset store, field host and board-scene code are byte-identical to this worktree. Existing nginx conditional logs contain successful 304 revalidations for several browser scene JSON/BIN URLs, but they do not show whether rendering received and accepted a pack.
- CSS has explicit reduced-motion suppression for all three transitions. `device.js` now activates its existing override for browsers as well as `SPClient/Windows`, without changing Android-native behavior. The exact affected stage or browser asset failure is still unknown; no scene-loading code has been changed.
- Tests/visual verification: not run, per maintainer instruction. Production/GitHub: unchanged.
- Next: inspect a browser's scene-load outcome (manifest entry, JSON/BIN decode, scene insertion and any console error) with maintainer permission; fix the shared failure rather than guessing from the presence of files.
