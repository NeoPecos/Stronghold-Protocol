# TASK-018 — Put the native client wrapper under Git

Status: `planned`

Lead/reviewer: Codex

Implementer: DeepSeek

Source tree: `F:\DSH-workspace\stronghold-app` (currently has no `.git`)

Depends on: TASK-017 reaches `review_ready` so the main repository checkpoint is no longer moving.

## Goal

Create a safe local Git history for the Windows/Android wrapper source while excluding signing material, toolchains,
bundled game art, generated packages and stale release outputs. Do not publish it until a remote and visibility policy
are explicitly chosen by the maintainer.

## Starting evidence

- `docs/analysis/native-client-wrapper-reconnaissance.md` freezes 42 authoritative wrapper/build-script files by size
  and SHA256 and confirms the tree is currently unversioned.
- Sensitive file present: `.signing/release.p12`; `.signing/` is already ignored and must never enter Git or logs.
- Large/generated trees include `$out/` (~919 MiB), `bundle/`, `bundle.bad-030829/` (~800 MiB), `dist/`, `build/`,
  `node_modules/`, `.toolchain/`, `windows/bin/` and `windows/obj/`.
- `release/` and `download/` contain mutable publication files and withdrawn/backup manifests; they are not source.

## Required procedure

1. Recompute the source freeze from the reconnaissance report and stop if any authoritative source hash changed.
2. Back up the current `.gitignore`, then extend it before `git init` to exclude at least:

```text
.signing/
.toolchain/
node_modules/
dist/
build/
$out/
bundle/
bundle.bad-*/
download/
release/
windows/bin/
windows/obj/
android/build/
*.log
*.bak-*
```

3. Run a secret/credential scan over the proposed source allowlist. Report findings without printing secret values.
4. Initialise a local repository with default branch `main`; do not add a remote.
5. Stage by explicit allowlist only:

```text
.gitignore
README.md
使用说明.md
package.json
package-lock.json
assets/
android/
windows/
scripts/
test/
```

   Exclude `windows/Program.cs.bak-vc12-023123` even if an ignore rule misses it. `deploy/` is excluded from the first
   commit until Codex reviews whether its service/nginx files belong in this repository and contain no environment-
   specific secret.
6. Inspect the complete staged file list, total byte count and cached diff. No staged file may be an archive, package,
   signing file, game-art bundle, build output or generated release manifest.
7. Run the wrapper's existing offline tests and source verification that do not require changing bundle/release bytes.
   Record known stale verifier failures exactly; do not “fix” them in the initial snapshot commit.
8. Create one initial commit with message `chore: establish native client wrapper source baseline`.
9. Record the commit hash, tracked-file count, tracked byte count, ignored-directory proof and test results in this
   task plus the main repository's operations log. Mark `review_ready` and stop.

## Acceptance checks

- `git status --short` in `stronghold-app` is clean after the initial commit.
- `git ls-files` contains only reviewed source/docs/icons/tests and no `.signing`, `.toolchain`, bundle, output,
  release, download, `bin`, `obj`, backup or package file.
- `git check-ignore -v` proves `.signing/release.p12`, one `$out` file, one bundle file and one release file are ignored.
- The authoritative 42-file source hashes match the pre-init reconnaissance except the reviewed `.gitignore` change
  and deliberate exclusion of the `.bak` file.
- Repository size is source-scale, not hundreds of megabytes.
- No remote, tag, push, release, client build or production action occurs.

## Protected areas

- Never move, copy, print, stage or commit `.signing/release.p12` or any password/key material.
- Do not delete outputs or old bundles during Git initialisation; ignoring is not deletion.
- Do not modify wrapper runtime code, bundle indexes, update manifests or release signatures in this task.
- Do not use Git LFS as a workaround for game art or output directories.
- Do not create a public repository or infer a GitHub destination.

## Current checkpoint

- Planning only. The wrapper tree was inspected read-only; no `.git` exists and no wrapper file was changed.
- Exact next action after TASK-017 review: DeepSeek rechecks the 42-file freeze and prepares the expanded `.gitignore`
  for Codex review before running `git init`.

## Review notes

Codex reviews the ignore boundary, staged inventory, secret scan and initial commit. A remote/backup strategy is a
separate maintainer decision after acceptance.

## Rollback

Before any remote exists, rollback Git metadata by archiving the initial commit hash and then removing only the newly
created `.git` directory after Codex confirms the absolute path is exactly `F:\DSH-workspace\stronghold-app\.git`.
Do not delete or alter any wrapper source/output directory.
