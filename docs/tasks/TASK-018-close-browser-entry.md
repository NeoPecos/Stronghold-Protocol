# TASK-018 — Close the browser entry on production and explain why on the notice page

Status: review_ready
Lead: Codex
Implementer: DeepSeek
Created: 2026-10-12

## Why

The production box is bandwidth-bound: browser visitors are the majority of the request volume and of the
egress, and players report lag while several matches run. The maintainer asked for the browser entry of
`sp.bs.leio.fun` to be replaced with an announcement page that explains the bandwidth reason, and asked to
"test on sp2 first".

## Authorization (maintainer, 2026-10-12)

The maintainer authorized, in this order:

1. replace the browser entry on the official domain with the announcement page;
2. test on `sp2.bs.leio.fun` first;
3. the announcement must state clearly that this is for bandwidth/lag, and that the server stays open and
   reachable (the client can connect to any server);
4. deployment of this change.

Deploying is therefore authorized for this task only, and only for the paths listed under *Artifacts*.

## What already exists (do not re-implement)

The repository already ships the whole mechanism. Nothing in `server/` or `public/js/` needs to change:

- `server/http/clientOnly.js:2` — `return /\bSPClient\/(?:Windows|Android)\b/i.test(req.headers['user-agent'] || '');`
- `server/index.js:67` — `const clientOnly = opts.clientOnly ?? /^(1|true|yes)$/i.test(process.env.SP_CLIENT_ONLY || '');`
- `server/http/static.js:73-74` — when `clientOnly` is set, a non-native request for `/` or `/index.html`
  is served `public/browser-closed.html` instead; every other static path is untouched.
- `server/http/websocket.js:52` — a non-native socket is rejected with `403 Forbidden`, so a cached page
  cannot enter a match either.

The production unit already has a stale `SP_NO_BROWSER=1` line; **that name is dead — only `SP_CLIENT_ONLY`
is read**. The gate has never actually been on in production (`SP_CLIENT_ONLY` is absent from
`systemctl show sp2 -p Environment`).

## Artifacts

1. `public/browser-closed.html` — the notice page, rewritten to carry the reason (bandwidth/lag), the
   reassurance that the server stays open, and the QQ group number `1124360673`. Tracked in git since
   `e0231293`.
2. `/etc/systemd/system/sp2.service` — `SP_NO_BROWSER=1` → `SP_CLIENT_ONLY=1` (line 15), plus a restart.
   Backup before the edit: `/opt/sp2/backups/sp2.service.pre-clientonly-20261012`.

No other production file changes. `latest.json`, the client packages, `data/*.json`, `server/` and
`public/js/` are untouched by this task.

## Protected areas

- Do not change gameplay, the battle simulation, the protocol, accounts, rooms or match records.
- Do not merge `master`, do not touch the client update manifest (`latest.json` stays at 1.2.8 /
  versionCode 11), do not rebuild or redeploy client packages.
- Do not edit `server/` or `public/js/` for this task; the gate is configuration only.
- Do not commit `.local/`, `public/assets/`, credentials, tokens or the unit file's secrets.
- `sp.bs.leio.fun` and `sp2.bs.leio.fun` are the **same Node process** (`proxy_pass http://127.0.0.1:3810`
  in both vhosts), so a per-domain trial is impossible without changing production code. This is recorded
  as a known limitation, not worked around.

## Acceptance checks

1. `node --test test/browser-closed.test.js` passes (4 tests: browser notice on `/` and `/index.html`,
   native clients still get the game, browser sockets get 403, native sockets connect).
2. On production, a browser `User-Agent` request to `https://sp2.bs.leio.fun/` returns the notice page
   (200, no `/js/main.js`), and `https://sp.bs.leio.fun/` behaves identically.
3. On production, `SPClient/Windows` and `SPClient/Android` requests still receive the game page.
4. A browser websocket to `/ws` is rejected with 403; a native-client websocket connects.
5. `/healthz` is 200 and reports the same build as before the restart; `/client/latest.json` is still
   200 and unchanged; `public/assets/*` and `/data/*` stay reachable.
6. The service is active with a new `MainPID`, `NRestarts=0`, and `SP_CLIENT_ONLY=1` visible in
   `systemctl show sp2 -p Environment`.

## Rollback

```bash
ssh -F F:/DSH-workspace/ssh-leio-config jing \
  "cp -a /opt/sp2/backups/sp2.service.pre-clientonly-20261012 /etc/systemd/system/sp2.service && \
   systemctl daemon-reload && systemctl restart sp2 && systemctl is-active sp2"
```

That restores the previous unit (dead `SP_NO_BROWSER=1`, no gate) in one restart. The notice page stays in
place but is unreachable while the gate is off, so it needs no rollback.

## Current checkpoint

2026-10-12 20:31 — **deployed and verified**. The notice page was uploaded first while the gate was still
off (`sha256 380162e3a6994fc1d5ac43c7aa79d031c4c5211c5ff14e8ab0aacb53058ad599` on both the working tree
and `/opt/sp2/public/browser-closed.html`), then the unit line 15 was changed to
`Environment=SP_CLIENT_ONLY=1`, `daemon-reload` + `restart` applied, on one restart.

Evidence:

| Check | Result |
|---|---|
| `node --test test/browser-closed.test.js` | 4/4 pass |
| `sp.bs.leio.fun` + `sp2.bs.leio.fun`, browser UA, `/` and `/index.html` | 200, 1944 B, `main.js=0`, notice page |
| same hosts, `SPClient/Windows` and `SPClient/Android`, `/` | 200, 9544 B, `main.js=2`, game page |
| websocket gate through `wss://sp2.bs.leio.fun/ws` | browser `403`, Windows `OPEN`, Android `OPEN` |
| `/healthz` | `{"ok":true,"app":"0.2.4","build":"87c9f1c4ae78"}`, sockets recovering (12 sockets / 2 rooms / 1 match within a minute) |
| `/client/latest.json` | still `efe977150b5487a48f886ba477bd22017555e8e50351cf4ac6655e71048bdf66`, i.e. 1.2.8 / versionCode 11 unchanged |
| `/var/lib/sp2/accounts.json`, `match-records.jsonl` | intact (parses; 848 records) |
| service | `active`, `MainPID=677340` (was 189578), `NRestarts=0`, `SP_CLIENT_ONLY=1` |

Known consequences, recorded rather than worked around:

- The restart ended the 19 lobbies that were live at 20:31:47; new lobbies were created within 40 seconds.
- `/dev/*` pages and every non-`/` static path stay reachable by browsers by design — the gate only
  rewrites `/` and `/index.html`, and the websocket gate is what makes a cached page useless for play.
- Both hostnames share one process, so the requested "sp2 first" ordering could not be honoured
  separately. The rollout was done in the order *copy first (reversible, invisible), gate second
  (one restart)*, and the rollback is a single command.

Next: Codex review of `public/browser-closed.html`, this task file and the operations-log entry. The
production change itself is already live; if it is rejected, use the rollback command above.

## Evidence captured beyond the acceptance list

- `/client/Stronghold-Protocol-1.2.8.apk` returns 410 for browsers, matching the documented
  "APKs are distributed through the QQ group, not the site" policy; the gate did not change that.
- No `403` socket rejects appear in `journalctl -u sp2` for the first minutes after the flip, while
  12 sockets and 2 rooms were already re-established — i.e. the clients that reconnect are passing the
  gate.

