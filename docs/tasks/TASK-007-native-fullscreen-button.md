# TASK-007 — Hide the fullscreen button inside the native clients

Status: `planned`

Lead: Codex

Implementer: unassigned (proposed: DeepSeek)

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

- Not started. No file changed. Plan and reconnaissance only.

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
