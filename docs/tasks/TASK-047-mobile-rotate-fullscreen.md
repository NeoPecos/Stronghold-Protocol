# TASK-047 — Mobile portrait rotate and fullscreen action

Status: `review_ready` (local only; maintainer visual check pending)

Lead/implementer: Codex

Starting commit: `4c517699`; the checkout already contains unrelated uncommitted 0.2.6 and TASK-044/045/046 work.

## Goal

Replace only the portrait-orientation prompt's “添加到桌面” action with “横置并全屏”.

## Scope

- The portrait overlay in `public/index.html`, its styles in `public/css/devices.css`, the click handler in `public/js/ui/device.js`, the language refresh in `public/js/ui/lang.js`, and the four translation packs.
- Use the existing fullscreen entry path, which also requests a landscape orientation lock where the browser permits it. If that is unavailable or declined, tell the player to rotate the phone manually.

## Protected areas

- Leave title/lobby PWA installation controls, game screens, native wrappers, server routes, room features, and current UI layout unchanged.
- No build, test, screenshot verification, deployment, restart, version bump, Git commit, or push without a separate maintainer request.

## Acceptance checks

- Portrait mobile browser shows “横置并全屏” instead of “添加到桌面”.
- A tap requests fullscreen/landscape where supported; unsupported browsers give an honest manual-rotation hint rather than claiming success.
- Landscape play and existing title/lobby PWA controls remain unchanged. Maintainer owns visual/device verification.

## Current checkpoint

- Implemented the portrait-only button, fallback message, styles, and translations locally. Existing `fullscreen.enter` is reused.
- No tests, builds, screenshots or device verification run under the repository owner's instruction.
- Next: maintainer checks on Android browser and iPhone Safari; adjust only reported issues, then separately decide release.
- GitHub/production unchanged.

## Rollback

Revert only TASK-047 hunks in the eight listed UI/i18n files, preserving other uncommitted changes in those files. No production rollback is needed until a separate release.
