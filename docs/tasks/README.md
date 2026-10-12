# Task Index

| Task | Status | Owner | Summary |
|---|---|---|---|
| [TASK-001](TASK-001-project-governance.md) | accepted | Codex | Establish durable multi-agent project workflow |
| [TASK-002](TASK-002-release-baseline.md) | accepted | Codex | Reconcile the dirty tree and freeze the next release baseline |
| [TASK-003](TASK-003-mobile-deployment-ui.md) | accepted | Codex lead / DeepSeek implementer | Hybrid deployment wheel and reliable mobile result exit |
| [TASK-004](TASK-004-player-avatar.md) | planned | unassigned | Account-bound selectable player avatar |
| [TASK-005](TASK-005-room-communications.md) | planned | unassigned | Room text chat plus announcement/admin tools; no voice |
| [TASK-006](TASK-006-deploy-wheel.md) | accepted | DeepSeek (maintainer-authorised) | Push TASK-003 and deploy the wheel to production |
| [TASK-007](TASK-007-native-fullscreen-button.md) | accepted | DeepSeek | Native clients hide the browser fullscreen button; shared detection accepted |
| [TASK-008](TASK-008-mobile-blur-diagnosis.md) | blocked | DeepSeek | Browser contributor proven; native WebView and usable-height evidence pending |
| [TASK-009](TASK-009-native-local-assets.md) | planned | unassigned | Deterministic native local assets and mobile rendering fallback |
| [TASK-010](TASK-010-bounded-resource-preload.md) | planned | unassigned | Bounded manifest-driven resource preload and cache |
| [TASK-011](TASK-011-live-combat-statistics.md) | planned | unassigned | Live per-operator combat statistics using existing record truth |
| [TASK-012](TASK-012-quick-matchmaking.md) | planned | unassigned | Instrumented quick matchmaking; AI fill disabled by default |
| [TASK-013](TASK-013-teamspeak-room-voice.md) | planned (deferred) | unassigned | TeamSpeak temporary room voice through WebSpeak; do not start |
| [TASK-014](TASK-014-top-hud-official-art.md) | accepted | Codex | Replace the top HUD frame and literal rest capsule with supplied art |
| [TASK-015](TASK-015-upstream-0.2.5-integration.md) | planned | DeepSeek | Selectively integrate upstream v0.2.5 while preserving fork behavior |
| [TASK-016](TASK-016-release-0.2.5.md) | planned | DeepSeek after review | Build a real increment and deploy the accepted v0.2.5 release |
| [TASK-017](TASK-017-workspace-git-checkpoint.md) | accepted | DeepSeek | Freeze current dirty work into reviewable Git checkpoints before v0.2.5 |
| [TASK-018](TASK-018-version-client-wrapper.md) | planned | DeepSeek | Initialise safe local Git history for the unversioned native wrapper source |
| [TASK-020](TASK-020-close-browser-entry.md) | review_ready | DeepSeek | Production browser gate is live; Codex review pending |
| [TASK-021](TASK-021-nginx-media-cache.md) | review_ready | DeepSeek | Immutable `/media/` cache headers are live; Codex review pending |
| [TASK-022](TASK-022-media-etag-validator.md) | review_ready | DeepSeek | Align Node media ETags with nginx; implemented locally, not deployed |

Only one task should be the repository-wide active implementation task unless tasks use isolated worktrees and do not
touch overlapping files.

The execution order and Paper-Yuan exclusions are recorded in
[Paper-Yuan 0.2.4 selective integration plan](../PAPER-0.2.4-SELECTIVE-PORT-PLAN.md).

Copy [TEMPLATE.md](TEMPLATE.md) for new work. An implementer must fill the current checkpoint before handing the task
back to the lead/reviewer.
