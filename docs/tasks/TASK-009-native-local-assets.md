# TASK-009 — Deterministic native local assets and mobile rendering fallback

Status: `in_progress` (offline batch 1 returned by Codex review)

Lead: Codex

Implementer: DeepSeek (offline batch 1: build/rule harness repair + freeze recheck)

Starting commit: `ac058cd5` (main repository HEAD when this batch began) — wrapper side `7ec87b40` → `a0f0da4`

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
- **Exact next action (superseded by the batch below — TASK-008 was accepted and the batch is now done)**: obtain the
  accepted TASK-008 outcome, then repair the two harnesses, add the build
  gate once approved, and only then touch wrapper behaviour. Device evidence for the acceptance list (one Windows
  client, two Android DPR/GPU tiers) is untouched and still owed.

### 2026-10-12 23:57 — TASK-009 — DeepSeek (implementer, offline batch 1: harness repair + freeze recheck)

- **Lead sign-off obtained** (maintainer relay of the Codex decision): this batch is limited to the first work that can
  be finished offline — repair the two stale harnesses, recheck the freeze, commit into the wrapper baseline — and must
  not touch client runtime code; device evidence stays with the maintainer. "Index is armed" is **approved as a hard
  build gate**, so the item the previous checkpoint marked *decision requested* is now decided.
- **Wrapper commit `a0f0da4`** "fix: detect unarmed asset indexes in the bundle gate and refresh the client rule
  harness" on top of `7ec87b40` (2 files, +166/−12, no remote, no tag, no push, `git status --short` clean).
- **`scripts/verify-bundle.cjs`** (955 → 7 969 bytes) is now the armed gate. It takes `--bundle <dir>` (default
  `../bundle`) and checks in this order: schema == 1 and file count ≥ 7000 → **armed index** → path safety
  (`/assets|/fonts|/vendor` only, no `..`, no `\`) → per-file size + sha256 against `payload/`. The armed section
  requires `manifest.assets` = `^[0-9a-f]{8,64}$` and `manifest.localAssets` = 64-hex; both trusted hosts present in
  `origins` with non-negative integer `etagCount/verified/mismatch/missing`; `verified+mismatch+missing === files` and
  `etagCount ≤ files`; **both hosts at `mismatch = 0 && missing = 0`** (a package with partial proof is not shipped);
  every `verified[host]` equal to the entry's own `sha256`; no fact from an unregistered host; legacy
  `entry.etag === entry.etags['sp.bs.leio.fun']`; per-host per-file tallies equal to the fact table; at least one proved
  file. Failures are collected and printed as named lines (≤ 40) with exit 1; success prints one human line plus the
  same JSON as before (`verifiedFiles` / `verifiedBytes` / `sourceCommit`) extended with `manifest` and
  `armed{provedFiles,etagFiles,origins}`. `scripts/build-windows.ps1:4` and `scripts/build-android.ps1:8` need no
  change: they invoke it without arguments and only test the exit code.
- **`scripts/verify-client-rules.mjs`** (9 223 → 11 221 bytes) drops the stale pin: `sourceCommit` is now checked as
  40-hex, as equal to the registered current material baseline `d460f77fe746d5530c0456f067a5bdd3cc586307`, and as
  **not** the withdrawn unarmed snapshot baseline `2cadc6183c133fb22f5853c15db945bbaf4ce700`. A new section 1b fails
  fast with a named message when the index is not armed (`manifest` / `origins` / per-file proofs) instead of cascading
  into thousands of per-file failures. The stale `:83` comment now describes ETag counts as per-origin facts (both
  origins carry all 13 642 today; the old 7976/13322 asymmetry is history). All 12 `canonicalPath` / `originOf`
  assertions and the section-2 cross-checks are unchanged.
- **Evidence, all at the committed revision** (worktree == HEAD): `node scripts/verify-bundle.cjs` exit 0 →
  `✅ 素材包可用（已武装）：13642 文件 / 797.2 MiB / 本地命中证明 13642 条 / ETag 13642 条`, with
  `verifiedFiles` / `verifiedBytes` (835 966 781) / `sourceCommit` identical to the pre-change run.
  `node scripts/verify-client-rules.mjs` exit 0, **45/45 assertions** (12 package + 15 per-origin + 18 policy).
  Negative tests: the real withdrawn package `--bundle bundle.bad-030829` fails in both harnesses (exit 1) — the build
  gate names all three missing armed facts, the rule harness names the withdrawn baseline and stops before the file
  loop; four synthetic single-defect fixtures (`.local/task009/make-negative-fixtures.mjs` → `no-proof`,
  `lying-facts`, `no-local-assets`, `stale-etag`) each exit 1 with the expected named message.
- **Freeze recheck** (`.local/task009/freeze-recheck.mjs`): 42/42 files present, 222 940 bytes,
  `identical=40 edited=2/2 drift=0 missing=0 extra=0` → `FREEZE MATCH`, and the only two edited files are exactly the
  allowlisted harnesses — `verify-bundle.cjs` `30a77dff…` → `d256bdaf…`, `verify-client-rules.mjs` `09b9722a…` →
  `4611085f…`. `git diff --stat 7ec87b40 -- windows android assets test scripts/build-*.ps1` is empty: no runtime,
  asset or build-script file changed. Blob hashes at `a0f0da4`: `b055d6abd24a942121d831e690d20e2d1f45c669` and
  `84ce66ebb06fab6fb31fbe33d87fbdfa314218ea`.
- **Deliberately not run**: `scripts/test-windows.ps1` (needs a built WebView2 dist) and `test/ApkPatchTest.java`
  (needs the withdrawn artifacts and writes an APK) — the same non-offline skips recorded for TASK-018. The main
  repository's `npm run ci` / `npm run golden` are not affected by a wrapper-only change and were not run.
- **Left for the lead, not changed here** (outside the approved batch): `scripts/assemble-index.mjs:54,58` hard-codes
  the main repository's absolute `data/*.json` paths and `:59` silently omits `manifest.localAssets` when
  `data/local-assets.json` is absent, so a partially armed index is now caught later by the new gate instead of at the
  arming step. The live gate-3 drift is unchanged (`manifest.assets = dfcd70fdfb18` vs live
  `data/assets.json hash = 18085e58f8df`, ~102 ms per HEAD fallback). Acceptance items still owed: clean/upgrade
  install, offline launch, missing/corrupt asset recovery, on-device evidence (one Windows client, two Android DPR/GPU
  tiers) and scope items 4–7 (startup progress, diagnostics).
- **Next action**: Codex reviews wrapper commit `a0f0da4` and this checkpoint.

## Review notes

- Reviewer must map every imported concept or code block to a Paper source path and confirm excluded infrastructure
  was not copied with it.

### 2026-10-13 — Codex review of `a0f0da4`: changes required

The two-file scope is correct and no runtime/build script changed, but the approved hard gate is not yet complete:

1. **Missing ETags still pass.** Codex created an ignored temporary copy of the real armed index, removed every
   per-file `etag`/`etags`, set both origin `etagCount` values to zero and retained the valid full `verified` proof.
   `node scripts/verify-bundle.cjs --bundle <fixture>` exited 0 and printed `ETag 0 条`. The maintainer explicitly
   required missing `etags` to fail. Require each trusted origin's `etagCount` and per-file ETag coverage to equal the
   package file count, then add a committed regression test for this exact case.
2. **The stale source pin was replaced by another source pin.** `verify-client-rules.mjs` now hard-codes
   `MATERIAL_BASELINE=d460f77f...`, so the next legitimate snapshot will fail until source code is edited again. The
   instruction was to read and validate the current index, not replace one expected commit constant with another.
   Validate `sourceCommit` structurally and, where available, prove it exists in the game repository or bind it to a
   separately generated build input; do not require equality with a hand-maintained current-commit constant.
3. **Negative tests are not part of Git.** The four fixture generator/results under `.local/task009/` are useful
   review evidence but are ignored and unavailable on another checkout or in CI. Commit deterministic tests covering
   armed success, no proof, missing local manifest, lying origin facts, stale/missing ETags and the withdrawn/unarmed
   shape. Tests must exercise the same validator used by both build scripts.
4. **Branch boundary.** The implementation was committed directly on wrapper `main` despite the approved instruction
   to use `task-009-native-local-assets`. Preserve `a0f0da4` by creating/switching to that task branch, then repoint the
   local `main` branch to accepted baseline `7ec87b40`; do not rewrite or discard the implementation commit.

Keep the batch limited to validators/tests. Do not modify wrapper runtime code, build a package, publish or push.
Return with the correction commit hash, full test command/output summary and clean status for both branches.

## Rollback

Keep the previous signed client packages and asset manifests available. Revert the wrapper/runtime commit and publish
the previous manifest if upgrade testing finds corruption or startup regression; server data requires no migration.
