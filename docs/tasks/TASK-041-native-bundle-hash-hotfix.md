# TASK-041 · Native bundle compatibility after 0.2.6

Status: review_ready

## Scope

Restore installed Android and Windows clients' access to their bundled art after 0.2.6 added content-hash path segments to served manifests. Keep browser manifests and long caching unchanged. Do not restart the game process, change the client updater, or replace UI/gameplay files.

## Finding

The installed clients' bundle indexes use plain `/assets/` and `/fonts/` keys. The 0.2.6 server rewrites both art manifests to `/assets/~<hash>/...` paths. Those paths miss the native bundle lookup and load over the network; players report 2D fallback. The plain manifest files remain on the production server.

## Release

Back up the current Nginx snippet, then route only `SPClient/Android` and `SPClient/Windows` requests for `/data/assets.json` and `/data/local-assets.json` to the plain files. Keep other requests on the Node manifest view. Check Nginx configuration and reload Nginx only; do not restart `sp2.service`.

## Acceptance and rollback

Native clients receive plain asset paths, browser requests retain hashed paths, and the game process PID remains unchanged. Roll back by restoring the Nginx snippet backup and reloading Nginx. Actual in-game render acceptance belongs to the maintainer and players.

## Checkpoint (2026-10-13 20:13 +08)

- Maintainer approved an immediate Nginx-only hotfix without restarting matches.
- Deployed `/etc/nginx/snippets/stronghold-static.conf` on JING; backup `/etc/nginx/snippets/stronghold-static.conf.pre-task041-20261013-201313`.
- `nginx -t` passed and Nginx reloaded. `sp2.service` remained PID `1441657`.
- A Windows client subsequently received HTTP 200 for both plain manifests with the static-file ETags rather than the hashed Node-view ETags. Browser requests still follow the Node branch by configuration; no browser/gameplay test or screenshot was run.
- Existing clients must reload the page to discard manifests already held in memory. The separate scene pack absent from some 1.2.9 installations remains a possible cause if an individual still sees 2D after reloading; do not claim visual acceptance without player feedback.
