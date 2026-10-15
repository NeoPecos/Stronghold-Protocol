# TASK-045 — Variable-size co-op rooms

Status: `in_progress` (local integration only)

Owner: Codex

Starting commit: `4c517699` in `F:\DSH-workspace\stronghold-026-integration`; the 0.2.6 merge and unrelated UI work are already staged/unstaged. Source reference: `LongQianChen/Stronghold-Protocol` `feat/IncreasePlayerCapacity` at `d7d541e73b307500c024c06feef8fcd1f0cd6248`.

## Goal

Port variable-size co-op play from the reference branch without replacing this project's current UI, CDN, native-client compatibility or other local changes. The owner requested an additional 6-person room tier alongside the reference branch's 4/8/10/16/20 tiers. A room may start below its capacity; group rules use occupied human and AI seats, not empty slots.

## Scope

- Shared seat/capacity protocol and room admission, host resizing and lobby discovery.
- Fixed card/equipment pool groups, per-group strategy/draft flow, host-configurable multi-round unite, boss scaling and result limits needed for 1–20 participants.
- Preserve the existing simulation-select appearance while adding a capacity picker and updating its 1–4-person copy; adapt the room's seat layout and count.
- Preserve the current server-room directory on the left of the lobby and all existing room-page controls/buttons; do not adopt the reference branch's replacement matchmaking panel or remove room actions.
- Update relevant localized strings and rule documentation. Do not replace unrelated UI or adopt unrelated fork features.

## Protected areas

- No production deployment, service restart, native update publication, version bump or Git push without a later explicit release instruction.
- Preserve existing CDN/hash asset routing, browser pre-cache, native-client workaround, transitions, operator HUD and TASK-044 spectator/avatar edits.
- Do not import the fork's unrelated announcement, chat, cache or server-settings systems wholesale.
- Do not run tests, builds or rendering checks unless the maintainer explicitly asks.

## Acceptance checks

- Room capacities 4/6/8/10/16/20; 6–8 participants can start in the selected room without filling unused seats.
- Existing 1–4-person behavior remains; occupied seats are partitioned in seat order into fixed groups of at most four: 5 = 4+1, 6 = 4+2, 8 = 4+4, 20 = five groups of four. Groups are fixed when the match starts and are not reshuffled after elimination or disconnect.
- Each group has an independent operator/item pool and R11 机变-card draft. Choices and sold-out state must be isolated to that group, including bot decisions and reconnect/public views. The opening-strategy draft also needs group-local duplicate checks.
- Grouped pools, draft order, unite rounds and boss health use actual participants and remain coherent through disconnect/elimination.
- Before a co-op match starts, the host can choose the maximum number of distinct unite helpers; default remains two. Choices are 2, 4, 6, 8, 10 up to `max(2, 2 × floor(occupiedPlayers / 4))`: 18 participants allow eight, 20 allow ten. Each selected pair below that maximum adds ten game seconds to every unite wave. Each field still supports at most two simultaneous helpers; additional helpers take later waves only if leaks remain. The setting and time bonus are room options, not a global data change.
- Before start, occupied seats automatically form four-player groups in seat order; the host may swap members between groups on the independent room-rules page. AI seats count. The start snapshot fixes membership for the entire match.
- At each SP draft, groups choose concurrently with separate cards, taken state, item stock and turn timers; reconnect views show the player's own group.
- The simulation-select and room pages expose the chosen capacity without overwriting the established visual design.
- Maintainer owns runtime/gameplay validation unless they separately authorize agent-run checks.

## Checkpoint

- Read-only cloned the reference branch to `C:\Users\Leiothrix\AppData\Local\Temp\sp-capacity-review` and compared it with its `master` baseline. Its capacity work spans core rules, protocol, room UI and battle flow; the full fork diff also carries unrelated systems and cannot be copied wholesale.
- Confirmed the fork's 20 is a maximum, not minimum. Its capacity tiers are 4/8/10/16/20, while start logic uses occupied seats. The owner approved adding a 6-person tier. Before integrating runtime or changing the existing page, the owner requested an independent visual preview of the capacity selector and multi-row seats.
- Ran the source branch itself from a separate temp clone on `http://127.0.0.1:3917/` for a maintainer-requested UI preview. Its actual lobby has a capacity selector below difficulty and a different left-side matchmaking panel; its 8-seat room uses two rows of four cards. The branch still lacks the owner-requested 6-person capacity choice. An earlier hand-built overlay preview was rejected and closed; do not use it as design evidence. The owner chose to keep our current room-list lobby and explicitly preserve our room-page buttons.
- Existing game worktree runtime, production and GitHub are unchanged. No project tests or builds were run; the only screenshots were of the requested isolated preview.
- 2026-10-15 live audit: the published 20-seat build still instantiates one `SharedPool` and one `SharedItemPool` in `Match.js`, and R11 creates one shared `this.sp` draft. `createPoolGroups` exists but is not wired into the match. The owner corrected the grouping rule from the reference branch's 3+3 layout to strict four-seat chunks. The local `poolGroupSizes` helper now expresses that rule, but runtime pooling/drafting remain incomplete and must not be described as fixed or deployed. `bandTaken` also currently checks the whole room rather than one group.
- The owner approved boss HP at +25% of the four-player baseline per additional surviving participant: mathematically `bloodPoint × alivePlayers` through 20. The local HP helper and existing assertions were updated; this has not been run or deployed.
- 2026-10-15 unite clarification: the owner rejected a fixed global two-helper limit as the only choice. They confirmed two helpers per complete four-player group (20→10, 18→8), selectable in pairs from two with a two-helper default, and ten additional game seconds per unselected pair on every wave. Options unlock from actually occupied human and AI seats; when occupancy falls, a selection beyond the new limit is reduced. The owner chose a separate, full room-rules page reached from a new room button; existing client settings remain unchanged.
- Local-only unite implementation now includes the room message/state and host authorization, helper/time calculation, two-at-a-time sequential waves, forwarding remaining leaks to unused helpers, multi-wave settlement rewards/losses, and the separate room-rules screen. The field/map dimensions remain unchanged; ten selected helpers means up to five successive two-helper waves, never ten helpers on one small board. This selective port has **not** had project tests, build, visual or live-match validation; do not deploy it as ready. All other TASK-045 group-pool/R11 work is still missing.
- At the owner's explicit preview request, started the dirty local game server on `http://127.0.0.1:3921/` (loopback only), created a disposable 20-seat local room with one human and 19 AI seats, and opened the real room-rules page in the in-app browser. The page visibly offered 2/4/6/8/10 helpers and showed +40 game seconds per wave for the default 2-helper choice. This confirms the preview UI appeared, not gameplay correctness. The preview tab is left open; no production service was touched.
- After owner confirmation, locally added deterministic four-seat group membership, host-only pre-start swaps, group-local operator and item pools, group-local strategy duplicate checks, and concurrent per-group SP drafts with independent timers and card stocks. Room state and match public views carry group membership; the client selects its own SP group. This code was not run through project tests, a build or a full match, and is not release-ready. The owner explicitly chose concurrent rather than sequential group drafts.
- Follow-up source review: strategy assignments now reconcile when occupancy changes, the 20-person draft-order rows cannot shrink out of their scrolling region, and spectators select an active SP group rather than a completed one when possible. The scope of team-wide SP effects across groups is awaiting the owner's choice; no gameplay validation or production action occurred.
- The owner chose group-only application for team-wide SP tactics: all surviving members of the picker's fixed group receive the full effect, nobody outside it receives a partial effect. Local card application now follows that rule; no project test or match validation was run.
- Updated the optional match audit to inspect each concurrent group's order, cards, picks and timer instead of assuming one global SP state. Kept the first group's legacy card/order references for existing four-player audit and harness consumers. Source review only; no automated checks or match run.
- The owner asked whether many helpers would shrink the map. Answered no: the existing two-helper arena is reused each wave; a large volume of leaks in the first wave could still crowd it or impact performance, which is a separate runtime concern.
- No project tests, builds, Git push or deployment were run in this checkpoint. A local screenshot was viewed only because the owner requested the earlier preview. Next: maintainer-authorized validation of 4/6/8/20-seat pool accounting, simultaneous SP turns, reconnect and multi-wave unite before any separately approved release.

## Rollback

Revert only TASK-045 hunks/files against the preserved 0.2.6 local base; do not roll back TASK-044 or other dirty work. No server rollback is needed until a separate approved release occurs.
