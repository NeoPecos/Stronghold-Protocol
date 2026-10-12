# TASK-007 — Hide the fullscreen button inside the native clients

Status: `accepted`

Lead: Codex

Implementer: DeepSeek

Starting commit: `fee08aff`

## Goal

The Windows and Android native clients show no fullscreen button on the title screen or in the game screen, while the
browser keeps the button it has today. The clients must never call the browser Fullscreen API.

## Scope

- Converge native-client detection into the shared device module `public/js/ui/device.js`, using the identifiers that
  already exist — the user agent markers `SPClient/Windows` and `SPClient/Android` and the `chrome.webview` host
  object — so the check lives in exactly one place and is not re-derived per caller.
- Have the existing detection path in `public/js/screens/title.js` (`isNativeClient`) and the browser-notice path in
  `public/js/ui/notice.js` consume that one implementation instead of keeping parallel logic.
- Make `FullscreenButton` render nothing on a native client. It must stay a normal component for browsers: **do not
  delete `FullscreenButton`**, do not remove its CSS, and do not change its behaviour where it is supported.
- The clients must not reach the Fullscreen API — neither through a tap on the button (there is no button) nor while
  initialising. Keep the component's existing subscription lazy in that sense: hidden clients must not add
  `fullscreenchange` listeners.
- Avoid a needless UI refresh: no fullscreen-driven state update may fire on a client, on click or on init.
- Tests: web shows the button, Windows client hides it, Android client hides it. Cover the detection itself as a unit
  test and the rendered button as a component/DOM test.

## Protected areas

- Do not remove or rename `FullscreenButton`; do not touch `fullscreen.enter/exit/toggle` behaviour for browsers
  (including the Android orientation lock).
- Do not touch `server/http/clientOnly.js` (the server-side `SP_CLIENT_ONLY` gate) or the browser-closed page.
- Do not change HUD layout, the custom combat HUD, or the title screen's layout beyond the button's absence.
- Do not change `css/devices.css` / `css/*` rules for `.fsbtn`; hiding happens in the component, not by hiding CSS.
- No deployment, no push to production, no client build.

## Acceptance checks

- `FullscreenButton` returns null for a `SPClient/Windows` user agent, a `SPClient/Android` user agent, and a
  `chrome.webview` host.
- `FullscreenButton` still renders a working button for a plain browser user agent, including the `aria-pressed`
  and label state.
- No `requestFullscreen` / `webkitRequestFullscreen` call is reachable on a client (assert with a spy that the API is
  never called).
- No `fullscreenchange` listener is registered on a client.
- `node --test test/ui/devices.test.js test/ui/browser-notice.test.js test/docs-consistency.test.js` pass, plus
  `npm run golden` unchanged (no goldens are involved, so they must not move).

## Starting reconnaissance (recorded before work starts)

- `FullscreenButton` lives at `public/js/ui/device.js:147`; it renders `<button class="fsbtn tapx …">` and is hidden
  when `fullscreen.supported()` is false.
- It is used in exactly two places: `public/js/screens/title.js:312` (`class="title-fs"`) and
  `public/js/screens/game.js:1499` (`class="gm__gear gm__fs"`). Both call sites can stay as they are if the component
  itself returns null.
- Native-client detection exists today as `isNativeClient()` at `public/js/screens/title.js:89`:
  `/SPClient\/(?:Windows|Android)|; wv[);]/i.test(navigator.userAgent) || !!globalThis.chrome?.webview`.
- `public/js/ui/notice.js:7` imports `isNativeClient` from `../screens/title.js` — the only cross-module consumer.
  Moving the function into `device.js` lets `title.js` and `notice.js` both import it from the device module and keeps
  `device.js` free of any `screens/` import (no new cycle; `device.js` currently imports only `vendor/hooks`,
  `../pwa.js`, `./components.js` and `shared/i18n.js`).
- The server-side gate `server/http/clientOnly.js:isNativeClient(req)` reads the request user agent for `SP_CLIENT_ONLY`
  and is a separate concern; it is **not** part of this task.
- `test/ui/devices.test.js` already exercises `fullscreen.active/enter/toggle/supported` with a fake window, so the
  component test can follow that existing pattern.
- The `; wv[);]` alternative in the current regex also matches generic WebView hosts. Decide explicitly whether the
  client requirement covers that (Android WebView) and record the decision; the task names only
  `SPClient/Windows`, `SPClient/Android` and `chrome.webview`, so keep the existing broader match unless the
  maintainer says otherwise.

## Current checkpoint

### 2026-10-12 18:45 — implemented

- Done:
  - `public/js/ui/device.js` gained `isNativeClient(win = globalThis)` — the one place the client identifiers live:
    `SPClient/Windows|Android`, the Android `; wv[);]` WebView token, and the `chrome.webview` host object. It takes a
    window for testability, matching `detectFeatures(win)`.
  - `public/js/screens/title.js` no longer defines a second copy: it re-exports the device module's function (its
    public home, and what `notice.js` and the tests used). `public/js/ui/notice.js` now imports it from `./device.js`,
    which also removes the only `ui/ → screens/` import edge.
  - `FullscreenButton` reads the fact once in a state initialiser and returns `null` on a client; it also skips
    subscribing to `fullscreenchange` / `webkitfullscreenchange` there. A browser keeps both listeners and the button.
- Not done / deliberately unchanged: no CSS touched, `FullscreenButton` not removed, `fullscreen.enter/exit/toggle`
  untouched (including the Android orientation lock), `server/http/clientOnly.js` untouched.
- Tests added:
  - `test/ui/devices.test.js`: `isNativeClient` over the two client markers, the bare `wv` token, the
    `chrome.webview` host, a plain desktop browser, and the no-navigator cases.
  - `test/ui/fullscreen-button.e2e.test.js` (new, 3 tests): in a real browser with the three user agents —
    browser shows exactly one `.title-fs` labelled 全屏, subscribes to both fullscreenchange spellings and calls no
    API; Windows and Android clients render none, call no Fullscreen API **and no orientation lock**, and register no
    listener.
- One thing the tests had to work around, recorded so it is not mistaken for a feature: the title screen's **settings**
  button reuses the `fsbtn` class for its look (`title.js:309`), so a `.fsbtn` selector matches two buttons. The real
  control is identified by its own `title-fs` class and confirmed through its `aria-label`. The class sharing is
  pre-existing and was **not** changed here.
- Tests run: `node --test test/ui/devices.test.js` 17/17; `fullscreen-button.e2e.test.js` 3/3 with `SP_E2E=1`;
  `browser-notice.test.js` + `devices.test.js` + notice suites 36/37 — the one failure is
  `browser-notice.e2e.test.js` "浏览器用户：看到公告", reproduced **identically on the stashed clean baseline**, so it is
  pre-existing and unrelated (the notice shows for a browser; the assertion that fails is its text/visibility).
  `npm run golden` 287/287 unchanged; `npx tsc --noEmit --checkJs` clean; `check-imports` unchanged (same three
  `server/sim/nodeData.js` notes as before this task).
- eslint: 0 errors. `device.js` carries one pre-existing warning (`importMaps`, line 83) that this task did not touch —
  verified by the diff hunks (33–51, 165–184).
- Files changed: `public/js/ui/device.js`, `public/js/screens/title.js`, `public/js/ui/notice.js`,
  `test/ui/devices.test.js`, new `test/ui/fullscreen-button.e2e.test.js`.
- Next: Codex review. No deployment and no client build is part of this task.

## Review notes

### 2026-10-12 19:12 — Codex review accepted

- No blocking finding. The runtime diff is limited to the shared native-client detector, the fullscreen component and
  its two existing consumers; no CSS, server gate, HUD layout, Fullscreen API implementation or native runtime changed.
- `FullscreenButton` remains present for browsers and returns `null` for the Windows/Android client markers and the
  WebView host path. Native clients do not register either fullscreen event listener and have no rendered click path
  to `requestFullscreen`, `webkitRequestFullscreen` or orientation lock.
- The existing broad Android `; wv` match is deliberately preserved. It can classify another Android WebView as a
  native host, but that was the pre-task behavior and is consistent with the recorded scope.
- Verification repeated by Codex: targeted unit/docs tests 63/63; browser E2E 3/3 using installed Edge; typecheck
  clean; changed-file eslint 0 errors / one pre-existing `device.js` warning; import check unchanged with three
  allowed `server/sim/nodeData.js` notes; golden 287/287 (49+46+22+20+10+140) unchanged.
- The implementer's written `npx tsc --noEmit --checkJs` command is incomplete without `-p jsconfig.json`; Codex ran
  the repository command `npm run typecheck`, which passed. This is a documentation correction, not a code finding.
- Accepted commit: `fe54953c`. No deployment, client package or production change is authorised by this acceptance.

## Rollback

Revert the `device.js` / `title.js` / `notice.js` / test changes as one task. No data migration and no production
change is involved, so `git checkout` of those files is a complete rollback.

## Verification commands

```bash
node --test test/ui/devices.test.js test/ui/browser-notice.test.js
node --test test/docs-consistency.test.js test/docs-paths.test.js
npm run golden     # must stay 287/287: this task changes no rules
npx eslint public/js/ui/device.js public/js/screens/title.js public/js/ui/notice.js
```
