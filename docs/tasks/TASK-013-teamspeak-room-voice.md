# TASK-013 — TeamSpeak-backed room voice

Status: `planned` (`deferred` by maintainer; do not implement until explicitly resumed)

Lead: Codex

Implementer: unassigned

Starting commit: assign only when the maintainer resumes the task

Depends on: TASK-005 accepted; room/account contracts stable; WebSpeak credential incident remediated

## Goal

Let a player join a TeamSpeak-backed temporary voice channel bound to the current Stronghold Protocol room, using the
existing WebSpeak browser audio bridge and the authenticated in-game identity. This is a separate integration and is
not a port of Paper-Yuan room voice or WebRTC.

## Deferred decision

- The maintainer requested that this task be recorded but not started.
- No source change, server change, credential change, migration or deployment is authorised by this task file.
- Keep room voice excluded from release plans until the maintainer explicitly resumes TASK-013.

## Proposed architecture

- Stronghold Protocol remains authoritative for room membership, account identity and host kicks.
- A trusted server-side voice coordinator creates or locates a uniquely named temporary TeamSpeak channel for a room.
- The game server issues a short-lived, single-use signed voice grant containing account id, room id, expiry and nonce.
- WebSpeak validates the grant and derives the nickname/channel server-side; the browser cannot choose another room or
  impersonate another callsign through query parameters.
- Channel creation may be lazy on the first voice join. An empty temporary channel is deleted automatically or by an
  idempotent room-disposal cleanup. Startup reconciliation removes stale task-owned channels.
- Leaving the room, host kick, account-session revocation or grant expiry revokes voice access. Spectator behavior must
  be decided explicitly before implementation.
- The game UI uses a collapsible voice panel or a thin WebSpeak protocol adapter. It must not duplicate the TeamSpeak
  audio implementation inside the game server.

## Infrastructure prerequisite

- Evaluate moving WebSpeak from leioserver to JING so WebSpeak, TeamSpeak 6 and Stronghold Protocol do not traverse the
  home-server/WireGuard hop for every browser voice session.
- Load-test concurrent users before changing the current WebSpeak connection limit.
- Keep TeamSpeak WebQuery private; no browser receives its API key, server password or administrative credentials.

## Mandatory security remediation

Before any integration work begins:

- Stop WebSpeak from serializing secrets in startup logs; configuration logging must redact passwords, API keys,
  tokens and signing secrets.
- Rotate every TeamSpeak/WebQuery credential that may already be present in historical WebSpeak logs.
- Restrict the query identity to the minimum channel/client permissions required by this task.
- Define log retention and remove exposed secret values from retained logs and backups where operationally safe.
- Add automated tests that fail when secret-shaped configuration fields are logged.

Do not copy credential values into this repository, task notes, operation logs, test fixtures or chat handoffs.

## Scope when resumed

- Add the authenticated voice-grant contract and replay protection.
- Add a minimal privileged coordinator API for temporary-channel create/find/delete and room-member move/disconnect.
- Extend WebSpeak to validate grants and join the assigned channel directly.
- Add an in-game join/leave/mute/PTT/status panel consistent with the existing UI.
- Handle room create/join/leave/kick/dispose, reconnect and service restart idempotently.
- Add health metrics for gateway reachability, active voice sessions, channel cleanup and rejected grants.

## Protected areas

- No Paper-Yuan room voice code, WebRTC signaling or browser peer-to-peer mesh.
- No public WebQuery endpoint, client-side administrative credential or user-selected arbitrary channel id.
- Do not make voice mandatory for room creation or play; normal rooms continue when voice is unavailable.
- Do not alter the simulation, placement protocol, custom HUD, records or gameplay timing.
- Do not reuse a visible room code as the sole channel identity; include a non-guessable internal room identifier.
- No production activation in the implementation task.

## Acceptance checks when resumed

- An authenticated room member joins only that room's temporary channel under the server-derived callsign.
- A forged, expired, replayed or wrong-room grant is rejected and audited without exposing secrets.
- Room leave, host kick and room disposal remove access; cleanup is safe to repeat after crashes/restarts.
- Voice gateway or TeamSpeak failure does not block room play and produces a clear non-fatal UI state.
- Browser microphone/autoplay permissions work over HTTPS; Windows and Android wrappers pass real-device microphone,
  audio-focus, PTT and background/restore checks.
- Concurrency and bandwidth tests document the supported room/player limit before production activation.
- No startup/runtime log contains configured passwords, API keys, tokens or signing secrets.
- Targeted checks, `npm run ci` and `npm run golden` are recorded; goldens remain unchanged.

## Current checkpoint

- Planning complete; implementation deliberately deferred.
- Existing WebSpeak already provides a browser audio bridge, TeamSpeak channel listing/switching and an initial
  `channel` connection parameter. It does not yet provide the trusted Stronghold room coordinator or signed grant.
- Existing topology places TeamSpeak 6 on JING and WebSpeak on leioserver through WireGuard. Migration is a design
  candidate, not an approved operation.
- A read-only inspection found that WebSpeak startup logging includes sensitive configuration values. Values are not
  reproduced here. Rotation and redaction are mandatory before this task can leave deferred state.

## Review notes

- Reviewer must treat authentication, replay protection, minimum query permissions, secret redaction and cleanup as
  release blockers, not follow-up polish.

## Rollback

Disable the voice feature flag and coordinator routes, revoke the voice-signing key, delete only task-owned temporary
channels, and restore the previously accepted WebSpeak deployment. Room/account data must require no migration.
