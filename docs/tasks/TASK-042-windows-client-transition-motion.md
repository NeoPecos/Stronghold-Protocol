# TASK-042 · Windows client transition motion

Status: released (visual pending)

## Goal

Make the existing 联防、完美作战 and 回合开始 transitions animate in the Windows client when Windows reports reduced motion. The maintainer reports static plates in the Windows client while the Android client animates.

## Scope

- Apply the already-existing `force-round-motion` and `force-unite-motion` overrides only to `SPClient/Windows` at boot.
- Do not alter the animation design, its timing, phase logic, Android/browser behavior, game server, native packages or version metadata.

## Protected areas

- Preserve the system reduced-motion behavior outside the Windows client.
- Do not restart the game service or active matches for a static-file release.

## Acceptance checks

- Windows client shows moving transitions after a page refresh; the maintainer performs visual acceptance.
- Android client and browser behavior stay as before.
- The game process PID stays unchanged if released.

## Current checkpoint

- Compared local and production animation code/style hashes: `game.js`, `components.js`, `game.css`, phase logic and `main.js` match. Production files were not missing.
- The production reduced-motion CSS disables all three animation families; the development preview alone sets `force-round-motion` and `force-unite-motion` to override it. The local Windows `MinAnimate` setting is 0.
- Applied a one-file local change in `public/js/ui/device.js` to set those two classes only for `SPClient/Windows` and remove them on disposer.
- Maintainer explicitly approved a static release without restarting matches. Before replacement, the production file differed from the local file only by the five-line Windows-client motion override.
- Released `public/js/ui/device.js` at 2026-10-13 20:27 +08. Backup: `/opt/sp2/backups/windows-motion-20261013-202735/device.js`; deployed SHA256 `9e9a3d0e4fe239137e0f589d8c928616e6db9ddf5d1cb56e8efd26cc4ed841b7` matches the local file.
- `sp2.service` PID stayed `1441657`; no restart or native package/update-manifest change. No project tests or screenshots run, per maintainer instruction. A client restart is needed to load the new JS; visual acceptance remains with the maintainer.

## Rollback

Restore the previous `public/js/ui/device.js` file and refresh the client. For a static release, back up the production file before replacing it; no service restart is necessary.
