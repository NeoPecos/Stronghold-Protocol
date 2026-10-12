# TASK-009 — Deterministic native local assets and mobile rendering fallback

Status: `planned`

Lead: Codex

Implementer: unassigned (proposed: DeepSeek after TASK-008 review)

Starting commit: assign when work begins

Depends on: TASK-007 accepted; TASK-008 accepted with a proven cause or explicit non-reproduction report

## Goal

Windows and Android clients resolve every asset declared local from a verified local package, show useful startup
progress while the package is prepared, and fall back safely on devices without the preferred graphics capability.

## Scope

- Locate and document the authoritative Windows and Android wrapper sources and their package/update pipeline.
- Compare Paper's background extraction and Android WebView request-interception approach with the real wrappers.
- Validate the installed asset manifest before launch: version, path, size and hash where hashes are available.
- Intercept native-client asset requests only for manifest-owned paths; reject traversal and unknown local paths.
- Show extraction/verification/connection progress instead of an unexplained blank or waiting screen.
- Add measured WebGL2 capability handling and a tested fallback only if TASK-008 proves it is needed.
- Add diagnostics that identify whether a slow load came from extraction, local I/O, decode, shader compilation or a
  network fallback.

## Protected areas

- No Paper embedded Node runtime, hard-coded domain, CDN, federation, room voice or deployment script.
- No server-side WebP substitution for a native local path.
- Do not change the custom HUD, placement protocol, simulation, accounts, room directory or records.
- Do not lower image quality or canvas resolution without the accepted TASK-008 evidence.
- No client release or production deployment in this implementation task.

## Acceptance checks

- A clean install and an upgrade install both reach the title screen with all required local assets verified.
- Offline or network-blocked launch proves manifest-owned art is read locally after installation.
- A missing/corrupt local asset produces a named recovery action and never silently renders a lower-quality remote copy.
- Tests cover valid path interception, unknown path rejection, traversal rejection, manifest mismatch and interrupted
  extraction recovery.
- On-device evidence is recorded for at least one Windows client and two Android devices with different DPR/GPU tiers.
- Targeted checks, `npm run ci` and `npm run golden` are recorded; goldens remain unchanged.

## Current checkpoint

- Planned only. The current repository does not contain an obvious Android wrapper tree, so locating and freezing the
  real client-shell source is the first mandatory step. Do not invent a new wrapper inside this repository.
- Paper-Yuan concepts to inspect include background asset extraction, WebView local-resource interception, WebGL2
  fallback and loading diagnostics. Selective adaptation is required; no branch merge.

### 2026-10-12 — implementer (DeepSeek): locating and freezing done, task not started

- **Source located and frozen**: `F:\DSH-workspace\stronghold-app` — outside this repository and **without any version
  control** (no `.git`; checked the whole directory and its siblings). A sha256 freeze manifest of the build-relevant
  source is therefore the only identifier available, and it is recorded together with the full reconnaissance in
  [`docs/analysis/native-client-wrapper-reconnaissance.md`](../analysis/native-client-wrapper-reconnaissance.md)
  (**42 files / 213 928 bytes** across `windows/`, `android/`, `scripts/`). Re-freeze after any wrapper edit by
  comparing hashes; the manifest is a point-in-time baseline, not a lock.
- **The task's required first pass is therefore complete.** The gate remains open: `Depends on: … TASK-008 accepted`
  is unmet (the maintainer paused TASK-008), so no wrapper or runtime change was made. Nothing in
  `F:\DSH-workspace\stronghold-app` was modified — reconnaissance was read-only plus one self-contained probe
  (`.local/gate-probe.mjs`, HEAD/GET only) in this repository's gitignored scratch directory.
- **Scope items 3–7 already exist in the shell**: `windows/BundledAssets.cs` and
  `android/src/fun/leio/stronghold/BundledAssets.java` intercept the WebView's asset requests;
  `windows/ServerPolicy.cs` / `android/.../ResourcePolicy.java` hold the trusted-origin table and `canonicalPath()`
  (unknown origin, plain `http`, credentials, non-443 port, traversal and anything outside `/assets|/fonts|/vendor`
  rejected; `/media/<x>` → `/assets/audio/<x>`); local serving requires per-origin `files[url].verified[host] ===
  files[url].sha256` and is refused when the live `/data/assets.json` hash differs from the index's recorded
  `manifest.assets`. The remaining work is proving and hardening, not inventing.
- **Two gate harnesses are stale against the shipped bundle** (detail in the analysis file): `node
  scripts/verify-client-rules.mjs` exits **1** — its hard-coded `sourceCommit` constant (`:65`, expects
  `2cadc618`) no longer matches the bundle's `d460f77f`, and its `:124` guard assumes a partially verified official
  origin, true of neither host today (both 13 642/13 642). Its `:83` comment still quotes 7976/13322. Until repaired it
  cannot serve as this task's evidence line. `scripts/verify-bundle.cjs` — the preflight both builders call — checks
  only per-file size+sha256 and **cannot detect a complete-but-unarmed bundle**.
- **An unarmed package was already built once**: `dist/_withdrawn-129-031341/Stronghold-Protocol-1.2.9.apk` carries a
  snapshot-only `assets/index.json` (sha256 `00c62b497b1b561e44d42d982aa8036ed3858e0072e0783d34e2276f33dee63b`,
  byte-identical to `bundle.bad-030829/index.json`) with no `manifest`, `origins`, `etags` or `verified` at all — in
  that build every "local" asset could only come from the network. It never reached users
  (`/client/Stronghold-Protocol-1.2.9.apk`, `…1.2.8.apk`, both setups and `SHA256SUMS.txt` return **410**;
  `/client/latest.json` still advertises 1.2.8), and the 1.2.8 APK's index matches the armed `bundle/` exactly.
  **Decision requested, not taken**: make "index is armed" a hard build gate. That is added hardening on top of this
  task's written scope and needs the lead's sign-off before it is implemented.
- **Live release-gate drift measured**: `bundle/index.json` records `manifest.assets = dfcd70fdfb18`, but both origins
  now serve `data/assets.json hash = 18085e58f8df`, so gate 3 fails and every path falls back to per-file validation —
  12/12 sampled paths still returned `304`, at **102 ms per HEAD** to `sp.bs.leio.fun` (45 ms to `sp2`), i.e. roughly
  3 minutes of revalidation per session at the client's concurrency cap of 8. `manifest.localAssets` still equals the
  current `sha256(data/local-assets.json)` = `3438b638…b2df`.
- **Exact next action (blocked)**: obtain the accepted TASK-008 outcome, then repair the two harnesses, add the build
  gate once approved, and only then touch wrapper behaviour. Device evidence for the acceptance list (one Windows
  client, two Android DPR/GPU tiers) is untouched and still owed.

## Review notes

- Reviewer must map every imported concept or code block to a Paper source path and confirm excluded infrastructure
  was not copied with it.

## Rollback

Keep the previous signed client packages and asset manifests available. Revert the wrapper/runtime commit and publish
the previous manifest if upgrade testing finds corruption or startup regression; server data requires no migration.
