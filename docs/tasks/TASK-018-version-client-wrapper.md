# TASK-018 — Put the native client wrapper under Git

Status: `review_ready`

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

### 2026-10-12 23:41 (Asia/Singapore) — local baseline created — `review_ready`

Steps 1–9 executed in `F:\DSH-workspace\stronghold-app`. Nothing in the wrapper tree was modified except `.gitignore`;
no runtime code, bundle index, update manifest or release signature changed, and nothing was deleted or moved.

**1. Freeze recomputation — pass.** `.local/task018/freeze-check.mjs` re-hashed the reconnaissance section 2 manifest
over `windows/`, `android/` and `scripts/`: `files=42 totalBytes=213928 expectedFiles=42`, `mismatched=0 missing=0
extra=0`, `FREEZE MATCH`. Re-run after the commit with the same result.

**2. `.gitignore` — backed up, then extended.** Original saved to `.local/task018/gitignore.before-task018.txt`
(89 bytes, SHA256 `64b8b6e650b53665a13fa1950583ad539f751c6623e682dc5821783e0fa189af`). The committed `.gitignore`
(1668 bytes) keeps all nine original rules and adds, in commented groups: signing/credential guards (`.signing/`,
`password.txt`, `*.p12`, `*.pfx`, `*.pem`, `*.jks`, `*.keystore`, `*.key`); `.toolchain/`, `node_modules/`; build
outputs (`build/`, `dist/`, `$out/`, `windows/bin/`, `windows/obj/`, `android/build/`, `.vs/`, `.gradle/`, `*.user`,
`*.suo`); payload (`bundle/`, `bundle.bad-*/`); publication (`download/`, `release/`, `*.sig`); logs/backups (`*.log`,
`*.bak`, `*.bak-*`, `*.tmp`, `*.orig`); package/binary containers (`*.apk`, `*.aab`, `*.exe`, `*.dll`, `*.pdb`,
`*.msi`, `*.nupkg`, `*.zip`, `*.7z`, `*.gz`, `*.jar`); and one deferral rule, `deploy/`.
Beyond the steps 2 minimum: the `*.bak`/`*.tmp`/`*.orig` group, the container group and the `deploy/` rule. Codex should
confirm the last two. `deploy/` (2 files, 1552 bytes) was added only because steps 5 and the acceptance check require
both "`deploy/` out of the first commit" and "`git status --short` clean"; the rule carries an in-file comment and
reverts by deleting one line — no `git add -f` is needed to commit it later. `windows/Program.cs.bak-vc12-023123` is
ignored by `.gitignore:45` (`*.bak-*`) and was additionally never named in the staging pathspec; it is still on disk,
unchanged at 35 291 bytes.

**3. Secret scan — no secret found.** `.local/task018/secret-scan.mjs` writes `.local/task018/secret-scan.json`:
54 files scanned (allowlist 52 + `deploy/` 2 as non-staged advisory), 69 findings,
`byClass={"signing-file-reference":10,"chinese-credential-word":8,"base64-blob-60":48,"url-with-credentials":3}`.
Zero private-key blocks, zero openssh keys, zero credential assignments, zero AWS/GitHub/Slack tokens, zero
authorization headers, zero private IPv4 addresses. All 11 credential-shaped hits are benign by construction: eight
Chinese words for password/key inside refusal strings and comments (`README.md:39,56`, `MainActivity.java:378,385`,
`ResourcePolicy.java:15`, `Program.cs:161`, `ServerPolicy.cs:12`), and three `https://user@…` strings that are
deliberate "reject embedded credentials" cases (`windows/Program.cs:407`, `scripts/verify-client-rules.mjs:139`). The
48 base64 blobs are 40 `package-lock.json` integrity hashes (88 chars) plus the intentionally embedded **public**
update key (8 lines, 64 chars each) at `windows/ReleaseInfo.cs:10-17` and
`android/src/fun/leio/stronghold/ReleaseInfo.java:17-24` — the matching private half stays ignored inside `.signing/`.
No secret value was printed or written to any record.

**4–6. Repository, allowlist, staged inspection.** `git init -b main`, no remote; repo-local `core.autocrlf=false` so
committed blobs stay byte-identical to the frozen CRLF source; local identity `Leiothrix <leiothrix@local>`. Staging
used `git add --pathspec-from-file=.local/task018/stage-list.txt` (51 explicit paths; no `git add -A`, `git add .` or
`-f`): 5 root files + `android/` 13 + `windows/` 7 + `scripts/` 21 + `test/` 2 + `assets/` 3 icons = **51 files,
232 016 bytes**. Pre-commit verification: every index entry matches its working-tree file by object hash
(`indexWorktreeMismatches=0`), cached diff = 4 128 insertions over 51 files, `git diff --cached --numstat` marks only
the two icons as binary, and count-only scans of the cached diff report `privateKeyBlock=0`, `opensshKey=0`,
`longLineOver2k=0` (`pkcs12Base64=2` = the first line of each embedded public key). The path-level refusal scan
(archives, packages, signing files, game-art bundle, build output, release manifest, `bin`/`obj`, backups) is clean.

**7. Offline verification.** `node scripts/verify-bundle.cjs` exit 0:
`{"verifiedFiles":13642,"verifiedBytes":835966781,"sourceCommit":"d460f77fe746d5530c0456f067a5bdd3cc586307"}`.
`node scripts/verify-client-rules.mjs` exit 1 with exactly one stale failure, recorded and not "fixed":
`❌ sourceCommit 是素材基线 2cadc618  d460f77fe746d5530c0456f067a5bdd3cc586307`
(`scripts/verify-client-rules.mjs:65` still expects `2cadc6183c133fb22f5853c15db945bbaf4ce700`); every other assertion
passes. `test/ResourcePolicyTest.java` compiled with the available JDK 8 into `.local/task018/javac-out` (no class file
written inside the wrapper tree) and run: `Android asset policy: 22 assertions passed`, exit 0. Deliberately skipped:
`scripts/test-windows.ps1` (requires a built `dist\windows-client\StrongholdProtocol.exe` and launches WebView2 — not an
offline check) and `test/ApkPatchTest.java` (requires three withdrawn-release artifacts and writes a restored APK).

**8–9. Commit and proofs.** Initial commit `7ec87b4082d33c53c09ec6d68ff3f516fdc79e96` — "chore: establish native
client wrapper source baseline", root commit on `main`, 2026-10-12 23:41:41 +08:00, 51 files, 4 128 insertions,
232 016 bytes; `.git` on disk 136 476 bytes (0.13 MiB) — source-scale.

- `git status --short` is empty after the commit; tracked files = 51; `remotes=0`, `tags=0`, `stashes=0`.
- `git check-ignore -v` proofs: `.signing/release.p12` → `.gitignore:8:.signing/`; `$out/Accessibility.dll` →
  `.gitignore:24:$out/`; `bundle/index.json` → `.gitignore:34:bundle/`; `release/index.html` →
  `.gitignore:39:release/`; plus `deploy/stronghold-paper.service` → `.gitignore:53:deploy/` and
  `windows/Program.cs.bak-vc12-023123` → `.gitignore:45:*.bak-*`.
- `git status --short --ignored` lists exactly 14 ignored entries (`$out/`, `.signing/`, `.toolchain/`, `build/`,
  `bundle.bad-030829/`, `bundle/`, `deploy/`, `dist/`, `download/`, `node_modules/`, `release/`,
  `windows/Program.cs.bak-vc12-023123`, `windows/bin/`, `windows/obj/`); all still exist on disk — ignoring is not
  deletion.
- Post-commit freeze re-check: `FREEZE MATCH` (42 files, 213 928 bytes, 0 mismatched).
- Safety: no remote, tag, push, release, client build, production action, Git LFS or repository publication;
  `PROJECT-STATUS.md` and `docs/tasks/README.md` are untouched and remain Codex's review-record step.

Exact next action: Codex reviews the ignore boundary (including the `deploy/` deferral rule and the two extra added
groups), the 51-path inventory, the secret-scan report, the quoted stale verifier failure and commit `7ec87b40`.
Rollback is as recorded below; nothing else is pending from this task.

### Earlier checkpoint (preserved)

- Planning only. The wrapper tree was inspected read-only; no `.git` existed and no wrapper file was changed.
- Exact next action after TASK-017 review: DeepSeek rechecks the 42-file freeze and prepares the expanded `.gitignore`
  for Codex review before running `git init`.

## Review notes

Codex reviews the ignore boundary, staged inventory, secret scan and initial commit. A remote/backup strategy is a
separate maintainer decision after acceptance.

## Rollback

Before any remote exists, rollback Git metadata by archiving the initial commit hash and then removing only the newly
created `.git` directory after Codex confirms the absolute path is exactly `F:\DSH-workspace\stronghold-app\.git`.
Do not delete or alter any wrapper source/output directory.
