# TASK-040 — 局内聊天保留阅读位置

Status: `released`

Lead / implementer: Codex
Starting commit: `4c517699` plus the isolated 0.2.6 merge artifact deployed on 2026-10-13.

## Scope

- Request chat history when entering a room or actually reconnecting, not on every connection-status heartbeat.
- Preserve the reader's scroll position when a history response rebuilds the list; stay at the bottom only when already there.

## Protected areas

- Do not change chat protocol, message retention, sending, danmaku or the panel layout.
- Do not restart the game service; deploy this follow-up only with maintainer approval.

## Acceptance

- Scrolling up remains in place without new messages, including across connection-status pings.
- A real reconnect still refreshes history; a reader at the bottom remains at the bottom.
- Maintainer performs the actual UI check; no project tests or screenshots run without instruction.

## Rollback

Restore the prior `public/js/ui/roomChat.js`. No data migration or server restart is needed.

## Checkpoint

2026-10-13: Found that `net` emits `status` on ping, and the listener requested history on every such event. The response cleared and rebuilt the message list, whose append path scrolled to the bottom. The single-file fix gates history requests to an offline-to-online transition and restores scroll position after a history response. At the maintainer's explicit direction, deployed `public/js/ui/roomChat.js` only: old SHA256 `60ac1fee5088abfad87385c191390fe1323dd2bba1d4cd371d8475d398fc0a32`, new SHA256 `475c496c9b8908bbb8fd7857f0c88149bc6e5356e24ecf929f68338b19978fdf`, backup `/opt/sp2/backups/chat-scroll-20261013-2002/roomChat.js`. `sp2` stayed active on PID `1441657`; public script HEAD returned 200. No project tests or visual acceptance. Already-open pages keep the old module until reload; the process build tag does not change for a static-only hotfix.
