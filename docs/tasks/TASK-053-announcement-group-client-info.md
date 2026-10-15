# TASK-053 — Restore group and client instructions in announcements

Status: `released` (publication complete)

Owner: Codex

## Goal

Make the current announcement archive clearly show the player QQ group number and how to get/update Windows and Android clients.

## Scope

- Prepare a concise Markdown announcement sourced from the old public browser notice and current client distribution policy.
- Publish only after the maintainer separately approves publication; do not overwrite or delete announcement history.

## Protected areas

- No service restart, static-file deployment, client/version change or Git push.
- Do not invent a download URL or expose direct installer URLs blocked by nginx.

## Acceptance checks

- The published notice shows QQ group `1124360673`, Windows/Android group-file instructions and in-client upgrade guidance.
- Existing historical notice remains readable. Any inaccurate “all skins available” claim is not repeated in the new notice.

## Checkpoint

- 2026-10-15: Read-only production check found exactly one announcement, “本次更新内容”; it has no group/client guidance and claims “全皮肤头像” despite missing asset entries. Old `public/browser-closed.html` specifies QQ group `1124360673`; the maintainer confirmed reusing that number and the proposed client guidance.
- The maintainer explicitly approved immediate publication. Published and uniquely pinned `client-and-group-20261015` on the live JING server at `2026-10-15T04:01:21.600Z`; the previous “本次更新内容” announcement remains in history. Backup: `/root/sp2-backups/announcements-20261015-task053/`. The publisher's list showed both entries. No service restart, project tests, version change or Git push.

## Rollback

If later published, unpin/delete only this announcement through the announcement CLI; preserve prior history.
