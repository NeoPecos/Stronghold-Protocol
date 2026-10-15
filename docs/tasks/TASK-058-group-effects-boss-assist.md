# TASK-058 — Group-local team effects and boss assistance

Status: `in_progress` (local source only)

Owner: Codex

Starting point: detached `4c517699` with the existing dirty 0.2.6 and TASK-045/052/054/057 work. Preserve all unrelated edits.

## Goal

Keep team-targeted strategy/item effects within the fixed four-player group. In multiplayer boss rounds, give each group a share of the common boss HP proportional to its alive players at fight start; damage beyond its share contributes 50% to the common pool.

## Scope

- Scope Touch's retained medic grant and other teammate-targeted match effects to the player's group; one-group games remain unchanged.
- Pair boss-field players within their own group. Freeze group HP shares at each boss round's start, including the Hidden Core.
- Credit the first group-share worth of raw leader damage at 100%, further raw damage at 50%; victory still requires the full common pool to reach zero.
- Announce each group's first share completion once per boss round with the requested assistance message.
- Keep client-side boss HP prediction, server reports, handover and displayed damage consistent with weighted credits.
- Update relevant rule and operation documentation. Do not change art or unrelated UI.

## Protected areas

- No deployment, restart, native update or version bump as part of this implementation. The maintainer later authorized a source-only Git push together with the other pending work; this does not authorize release.
- No tests, builds or screenshot verification unless the maintainer separately requests them.
- Preserve all staged and unstaged edits from other tasks.

## Acceptance checks

- A Touch/鸭爵 or teammate-targeted item in one group has no effect on another group; its own group retains the current behavior.
- With four groups and 10,000 common boss HP, each four-player group receives a 2,500-HP normal-damage share. After reaching 2,500 credited damage, its subsequent raw damage is worth half; all groups' weighted credits total 10,000 to win.
- With uneven groups, the quota follows each group's surviving player count at boss start; double boss fields never cross group boundaries.
- Each completed group gets exactly one announcement in that boss round, including if it continues assisting afterward.
- Client and server combat paths agree on remaining HP and completion, including reconnection and server takeover.
- Maintainer owns runtime/gameplay validation unless they separately authorize agent-run checks.

## Checkpoint

- Source review: `teamMedicGranted()` and `ctx.teammates()` currently span the whole match; the latter feeds strategy/medic metadata and teammate-targeted items. The boss uses one unweighted `SharedBossPool` and pairs globally. Browser `LocalBossPool` subtracts raw unacknowledged damage, so server-only weighting would permit premature client victory.
- The maintainer chose proportional alive-player shares, within-group boss pairing and group-only scope for all these team effects.
- Local source now scopes retained Touch, `ctx.teammates()` (including 鸭爵 and teammate items) and bot teammate strategy reservations to one fixed group. Boss fields pair within groups; `SharedBossPool` weights group damage past its frozen quota, broadcasts a one-time completion ticker, and records weighted player credits. `LocalBossPool` and `b.pool.groupRaw` predict the weighted HP from raw client reports; accepted results expose weighted leader damage.
- Source review only. No project tests, build, screenshot, live match or deployment were run under the maintainer's rule. The maintainer authorized a source-only Git push while keeping this task pending validation. Next: maintainer-led checks of 4/6/8/20-player Touch and teammate effects, weighted boss shares, simultaneous fields, reconnect/takeover and the ticker before release.

## Rollback

Revert only TASK-058 hunks from the existing dirty tree. Do not reset TASK-045/052/054/057 or the 0.2.6 integration.
