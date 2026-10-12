# TASK-011 — Live per-operator combat statistics

Status: `planned`

Lead: Codex

Implementer: unassigned

Starting commit: assign when work begins

Depends on: performance phases stable; existing record schema reviewed

## Goal

Add an optional in-match per-operator damage and DPS view using the same authoritative events and identities as the
existing post-match records and group-card output.

## Scope

- Map the current record collector's damage events, player identity and operator identity.
- Add only missing counters needed for live damage and average DPS.
- Build a compact optional panel that can be hidden and remains readable on measured mobile viewports.
- Reconcile final live totals with the stored match record and card payload.
- Treat Paper's damage panel as a UI reference, not a second statistics engine.

## Protected areas

- Do not replace or fork the existing records/cards pipeline.
- Do not reveal another room's private statistics or accept client-authored authoritative totals.
- Do not move or restyle the custom combat HUD outside the panel's explicitly allocated area.
- No gameplay, targeting or damage-calculation change.

## Acceptance checks

- Live totals and the completed record agree for deterministic fixtures.
- Reconnect/spectate cannot duplicate damage or attribute it to the wrong player/operator.
- The panel is optional, keyboard/touch accessible and does not overlap critical controls at target mobile sizes.
- Record/card backward compatibility is covered by tests.
- Targeted checks, `npm run ci` and `npm run golden` are recorded; goldens remain unchanged.

## Current checkpoint

- Planned only. Paper's `damageStats` and `damagePanel` are candidate references; their local client totals are not
  accepted as authoritative without reconciliation to this fork's server records.

## Review notes

- Reviewer must confirm one statistics truth and inspect reconnect/spectator behavior.

## Rollback

Disable and remove the live panel/counters while keeping the existing stored record schema readable. Any additive
stored fields must be optional so rollback needs no destructive migration.
