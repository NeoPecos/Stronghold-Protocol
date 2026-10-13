# TASK-027 — Enemy status effects and funds badge

Status: released

Scope: Add lightweight client-side looping visuals for enemy stealth and refraction using the existing smoke and hex textures; remove the rectangular background outside the funds badge artwork. Keep existing status icons and gameplay rules.

Protected: Existing battle HUD, simulation, network protocol, and unrelated local rendering edits.

Acceptance: Stealth shows light dark smoke confined to the enemy model; refraction shows two or three rising, tilted purple hexagons with pointed top and bottom; each disappears when its status ends, including refraction under silence. Effects follow their enemy and use fewer sprites on low quality.

Rollback: Restore the three existing static files from `/opt/sp2/backups/status-vfx-shopbadge-20261013-90adad7a/old/` and remove `public/js/render/statusAura.js` from production. The local source changes remain separate.

Checkpoint: The dedicated `?scene=status` preview exposed a dropped initial status event and an obstructed stealth sample; both were fixed. After player feedback, smoke was reduced to the model area and refraction limited to three tall, tilted hexagons (two on low quality). The maintainer approved these effects and the funds badge fix for production. Four static files were deployed on 2026-10-13 without restarting `sp2` or changing client versions/update manifests. Remote files match the staged SHA256 values; the process stayed active with the same PID. No gameplay or visual acceptance test was run by the agent at the maintainer's request. Existing client pages must be refreshed manually because `/healthz.build` is cached until the next server restart.
