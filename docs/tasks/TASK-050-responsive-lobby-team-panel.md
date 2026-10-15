# TASK-050 — Responsive lobby and 20-seat team panel

Status: `released` (visual acceptance pending)

Owner: Codex

Starting point: dirty 0.2.6 integration worktree at `4c517699`; live changes by another agent must not be overwritten.

## Goal

Keep the maintainer's two-column lobby design in landscape phone and moderately narrow desktop viewports. Bound the 20-seat in-match member panel, allow vertical scrolling and one-click collapse.

## Scope

- Change only the lobby breakpoint and member-panel presentation/component.
- Preserve the lobby cards, announcement, room-list controls and in-match teammate interactions.

## Protected areas

- No deployment, service restart, version update, Git push or native-client packaging.
- Do not run project tests/builds or render screenshots without maintainer authorization.
- Do not modify active server rules or the asset pipeline in this task.

## Acceptance checks

- A landscape phone around 900 CSS px wide retains the desktop left/right lobby columns.
- At truly narrow widths the lobby remains scrollable and can stack.
- Twenty member rows remain within the viewport; users can scroll to every row and collapse/reopen the list without losing selection behavior.

## Checkpoint

- Root cause identified: `lobby.css` stacks the grid at 1050 CSS px regardless of landscape orientation; `.team` had no height limit or scrolling.
- Lowered the lobby stacking breakpoint from 1050 to 740 CSS px; added a height-bounded scrolling list and a one-click member-list toggle. At the maintainer's explicit instruction, hot-deployed only `lobby.css`, `game.css` and `teamPanel.js` to JING after confirming each differed from production solely by these TASK-050 hunks. Remote hashes matched the local files; `sp2.service` remained active with PID `2366839` and was not restarted. Backup: `/opt/sp2/backups/task050-ui-20261015/old/`. Maintainer mobile/desktop visual acceptance is pending; no project tests/builds/screenshots run. GitHub unchanged.

## Rollback

Revert only TASK-050 hunks in `public/css/screens/lobby.css`, `public/css/screens/game.css` and `public/js/ui/teamPanel.js`.
