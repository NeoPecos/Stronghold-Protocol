# TASK-022 — Node must emit nginx-shaped ETags so `/media/` revalidates

Status: `review_ready` — implemented, **not deployed** (deployment needs the maintainer's go-ahead: it restarts Node)
Lead: Codex
Implementer: DeepSeek
Created: 2026-10-12
Predecessor: TASK-020 (browser entry closed), TASK-021 (nginx `/media/` cache headers)

## Why — the measured defect

The native/web client validates a bundled asset with one HEAD request
(`windows/BundledAssets.cs` / `android/src/fun/leio/stronghold/BundledAssets.java:170-196`):

```java
connection.setRequestProperty("If-None-Match", expectedEtag);   // the tag recorded at bundle time
connection.setRequestProperty("Accept-Encoding", "identity");
connection.setRequestProperty("Cache-Control", "no-cache");
int status = connection.getResponseCode();
return status == 304 || (status == 200 && expectedEtag.equals(connection.getHeaderField("ETag")));
```

Every audio request goes to `/media/…` (query-less, extension-less) because that route exists precisely to
keep download managers from hijacking `.mp3` URLs (`server/http/media.js:10-18`). `/media/…` is **proxied to
Node**, while `/assets/…` is served by **nginx straight from disk** — and the two emitted different ETags for
the same bytes:

| path | served by | ETag | client's stored tag | result |
|---|---|---|---|---|
| `/assets/audio/bgm/m_sys_act1autochess_loop.mp3` | nginx | `"6ac653aa-116055"` | `"6ac653aa-116055"` | **304** |
| `/media/bgm/m_sys_act1autochess_loop` | Node | `"116055-1a116b6d010"` | `"6ac653aa-116055"` | **200, full body** |

Node built `<size>-<mtime-ms>` (`server/http/files.js:199`), nginx builds `<mtime-seconds>-<size>`
(`ngx_http_set_etag`). The bundle index stores the nginx shape (`etags.sp.bs.leio.fun`), so the client's
`If-None-Match` could never match on the route it actually uses, and the local payload was never allowed to
serve audio.

Evidence (all reproducible, 2026-10-12):

- Production: 13,642-path sample → every `/assets/...` probe 304, every `/media/...` probe 200
  (`.local/repro-validate.py`, run on the server against the index extracted from the shipped 1.2.8 APK).
- Local, before the fix: `HEAD /media/bgm/…` + the bundle's own tag → `200`; after the fix → `304`.
- Traffic: one day of `access.log` = 13.84 GB egress, `/media/` 11.73 GB (BGM loops 5.03 GB), **43,278 × 200
  vs 3,972 × 304**; one client re-fetched a 1,998,679 B loop **174 times at its own 120 s track length,
  always 200, never 304**.

## Scope (what changed)

One line in `server/http/files.js`, plus a regression assertion in `test/lobby.test.js`:

```js
// before
const baseTag = `${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}`;
// after — nginx's own shape, so both halves of the server answer with the same validator
const baseTag = `${Math.floor(stat.mtimeMs / 1000).toString(16)}-${stat.size.toString(16)}`;
```

Not changed: nginx (TASK-021 already done), the client packages, any asset, `/data/*.json` content, the gzip
variant suffix `-gz` (still appended when the response is actually gzip), range/If-Range logic, cache policy.

## Acceptance checks

| Check | Result |
|---|---|
| `HEAD /media/bgm/m_sys_act1autochess_loop` with `If-None-Match: "6ac653aa-116055"` | **304** (was 200) |
| control: wrong tag `"deadbeef-123"` | 200, body intact |
| `Range: bytes=0-9` + `If-Range: "6ac653aa-116055"` | 206 `bytes 0-9/1138773` |
| `HEAD /media/…` ETag equals `HEAD /assets/audio/…mp3` ETag for the same file | equal (existing test, still green) |
| ETag shape `<mtime-seconds>-<size>`, second half = byte size | asserted in `test/lobby.test.js` |
| `node --test test/lobby.test.js` | 3/3 of the touched tests pass |
| `npm run ci` | see the ops log entry for the run |

## Rollback

Revert the single line in `server/http/files.js` and restart Node; nginx needs nothing.
Deployment backup: `/opt/sp2/backups/task022-files.js.<timestamp>` plus the pre-restart `sp2.service` state.

## Residual risk / honest limits

- A client that cached Node's old tag gets one **200** on its next request, then 304s. Content is byte-identical
  (`ETag` is a validator, not content), so this is a single re-download at most.
- `mtime` miscalculation is possible in principle when seconds and size both repeat exactly — the same false-304
  exposure nginx has always had on `/assets/`. Mitigated by the per-file SHA-256 check in the client: a bogus 304
  only makes the client re-download, because the payload digest is verified before it is served
  (`BundledAssets.java:229-232`).
- This does **not** by itself prove the fix works for the field client — the acceptance is the next day's
  `200:304` ratio for `/media/bgm/*`. Expect the ratio to flip, not to become 100 %: a first play per session
  is still a legit 200.
- The `hash` in `/data/assets.json` (`18085e58f8df`) still differs from the bundle's `manifest.assets`
  (`dfcd70fdfb18`), so gate 3 (whole-release trust) still fails and per-file validation still runs. **A full
  re-bundle fixes only the per-file cost; the 200-for-304 waste is what this task removes.**

## Current checkpoint

Code fix implemented and verified locally (304 with the client's own tag). Not committed, not deployed.
Next: `npm run ci` green → commit → maintainer authorizes the Node restart → deploy → measure the next day's
`/media/` `200:304` split and total egress.
