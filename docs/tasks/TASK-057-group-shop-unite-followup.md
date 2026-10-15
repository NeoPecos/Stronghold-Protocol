# TASK-057 — Group visibility, shop reroll and unite fairness

Status: `in_progress` (local source only; validation withheld by maintainer instruction)

Owner: Codex

Starting point: detached `4c517699` with the existing dirty TASK-045/052/054 and 0.2.6 changes. Preserve those edits; this task is a follow-up, not a replacement release.

## Goal

Make four-player groups visible in the room and match, let each human join a non-full group, correct shop pools after setup rerolls, rotate unite helpers fairly, and move the AI-last option to room rules.

## Scope

- Show a distinct group label/color on occupied room cards and in the bounded match member list, with group separators.
- Permit a human to move their own seat into an existing group with fewer than four members; keep the host's existing swap control. Reject full target groups.
- Rebuild every group's operator pool when a unanimous setup reroll changes bans; preserve independent item pools and current DIY handling.
- Prefer perfect defenders who have not assisted within the prior three match rounds, then higher active-bond layers; when all candidates assisted recently, use the older assist first. Keep the configured helper count and multi-wave field size.
- Place AI-picks-last under the existing independent room-rules page, retaining host-only behavior.

## Protected areas

- No production deployment, service restart, release/version change, Git push, new tests, build, screenshot or gameplay validation without a separate maintainer request.
- Preserve other room actions, original room visual layout, CDN/browser gate and existing local TASK-045/052/054 changes.

## Acceptance checks

- In a room with 4+2 players, a player can move from the full group into the two-person group; a full target refuses entry. Group membership survives new joins and is frozen at match start.
- Room cards and in-match member rows consistently identify up to five groups, including the viewer's teammates.
- After a setup reroll, every group's shop pool matches the new published banned list. Unbanned cards remain eligible subject to shop level, remaining copies and random draws; no false guarantee that every card appears in a finite number of rolls.
- A helper picked in the previous three match rounds has lower priority than another eligible helper; among similarly eligible helpers, higher layers lead, including first position in multi-helper unite.
- AI-picks-last appears only on the room-rules page; existing server authorization and option remain intact.

## Checkpoint

- 2026-10-15 source review: `completeSetupReroll` replaces only the legacy `this.pool`, but shops draw from `groupPools[*].pool`, so rerolled bans and offers can diverge. `helperOrder` contains no assist history. Group membership currently depends on a flat order and allows host swaps only. No code change, test, build or production action yet.
- 2026-10-16: The maintainer chose to reject self-joining a full group and to show all capacity-based group slots even when only one player is seated. Local changes now carry numbered empty group slots through room state, preserve labels for occupied groups at match start, add self-only selection on room seat cards, color room/match avatars and group separators, and move the existing AI-last toggle to room rules. A setup reroll now rebuilds all group operator pools; unite remembers the last actual assist round and rotates recent helpers behind unused candidates while prioritizing layers. The reported banned/unbanned inversion has a concrete source cause; no deterministic guarantee that every eligible card appears was added. Existing dirty TASK-045/052/054 files were edited in place and must be reconciled as one release. No tests, build, screenshot, full-match check, Git push or deployment were run. Next: maintainer-authorized validation of group moves/joins, setup reroll shops and 3-round unite rotation; review provenance against the actual production build before any separately approved deployment.
- Source touched in this task: `shared/playerCapacity.js`, `shared/protocol.js`, `server/lobby.js`, `server/match/{Match,unite}.js`, `server/match/match/{setupVote,settle,views}.js`, `public/js/screens/room.js`, `public/js/ui/teamPanel.js`, `public/css/screens/{room,game}.css`, the four `public/i18n/` packs and the task/status/design/history/ops notes. Several of these files were already dirty before TASK-057; no staged changes were reset or overwritten. The next safe step is a maintainer-requested focused validation, not a deployment from this mixed tree.

## Rollback

Revert only TASK-057 hunks in room/group UI, pool reroll and unite selection. Do not revert TASK-045/052/054 or browser asset work.
