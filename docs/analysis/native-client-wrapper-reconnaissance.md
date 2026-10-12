# Native client wrapper: source freeze + gate reconnaissance (TASK-009 prerequisite)

Written: 2026-10-12, by the implementer (DeepSeek). **Read-only reconnaissance — no wrapper file, no game
file and no build script was modified to produce this.** Commands used are quoted inline so every number can
be re-derived.

TASK-009's own checkpoint makes this the first mandatory step: *"The current repository does not contain an
obvious Android wrapper tree, so locating and freezing the real client-shell source is the first mandatory
step. Do not invent a new wrapper inside this repository."* This document discharges the locating and the
freezing. The task itself is **not** thereby started — its gate (`Depends on: … TASK-008 accepted with a
proven cause or explicit non-reproduction report`) is still open, and the maintainer has paused TASK-008.

## 1. Where the authoritative wrapper source is

`F:\DSH-workspace\stronghold-app` — **outside** this repository, and it has **no version control at all**
(no `.git` anywhere; the only versioned sibling trees are `stronghold-base-0.2.1`, `stronghold-merge-0.2.4`,
`stronghold-paper-client`, `stronghold-server-custom`, `stronghold-skin-src`, `dsh-routing-suite`,
`paper-yuan-audit-0.2.4`). Anything built from it is therefore only as identifiable as the bytes on disk,
which is why the hash manifest in section 2 exists.

Layout (directories that matter, `$out` is the PowerShell-expanded output tree):

| path | role |
|---|---|
| `windows/` | C# WinForms + WebView2 host: `BundledAssets.cs`, `Program.cs`, `ReleaseInfo.cs`, `ServerPolicy.cs`, `.csproj`, `installer.nsi` |
| `android/` | plain-Java APK host (no Gradle in the build path): `MainActivity.java`, `BundledAssets.java`, `ResourcePolicy.java`, `ReleaseInfo.java`, `UpdateInstaller.java`, `ApkPatch.java`, `ApkProvider.java`, `UpdaterActivity.java`, `AndroidManifest.xml` |
| `android/updater/` | the updater APK's own manifest + strings |
| `scripts/` | the bundle pipeline and the verification harnesses (section 3) |
| `bundle/` | the shippable payload: `index.json` + `payload/**` |
| `bundle.bad-030829/` | a **snapshot-only** index kept aside; see section 4 |
| `dist/`, `$out/`, `build/`, `download/`, `release/` | outputs (gitignored here, and unversioned anyway) |

## 2. Freeze manifest

Enumerated with `node` over `windows/`, `android/`, `scripts/`, skipping `bin`, `obj`, `.gradle`, `build`,
`.vs`; sha256 over file bytes; sorted by path. Re-derive with:

```powershell
# from F:\DSH-workspace\stronghold-app
node -e "…walk windows,android,scripts; print sha256+size+path…"   # implementation in the session's .local/gen-tree.mjs
```

| file | bytes | sha256 |
|---|---:|---|
| `android/AndroidManifest.xml` | 1459 | `9d486de2cb991cdbd17cd9d10d195a0e2bbe32beda29d9a0dad123edc71209ff` |
| `android/res/drawable/icon.xml` | 463 | `a8bf1c1f5069641954a16e94dcec7456d4d51b798e70a3510ed2ce3ac56b35e0` |
| `android/res/values/styles.xml` | 669 | `45ec616a94d3cba28a885a10dbbbd8ce29e76c6833b1b035ada694fef03ff354` |
| `android/src/fun/leio/stronghold/ApkPatch.java` | 3625 | `2862c940291b3f1337e45348473ddc234f6087c7043dc7312ccbef18ee7844ca` |
| `android/src/fun/leio/stronghold/ApkProvider.java` | 1277 | `eadfcaa142e8b46e5a4416f9d9522e3e2784faeed1a9dca06d7f8784e1ea3923` |
| `android/src/fun/leio/stronghold/BundledAssets.java` | 13175 | `84d7493e7f356c9e77309a751714868da3ac6917b2cd4a74f42f65259c195bf0` |
| `android/src/fun/leio/stronghold/MainActivity.java` | 20141 | `5bfe89f8b55bc31389a654f1535779b69ec0f0e18720fd4223ae0ad6f876727a` |
| `android/src/fun/leio/stronghold/ReleaseInfo.java` | 4071 | `154038239ac9e0b60ece85fe8a76ad762f33c21bee00c0aafcb8ec1268a4ccab` |
| `android/src/fun/leio/stronghold/ResourcePolicy.java` | 5008 | `5a11df43ce351893c397666f26e04fa16cca9e7ed55a5fa4b5a40250fc4dd700` |
| `android/src/fun/leio/stronghold/UpdateInstaller.java` | 4991 | `036b563f46a48aef8531dbc77fc0f138f5650f73379507e860b2e76c91820840` |
| `android/src/fun/leio/stronghold/UpdaterActivity.java` | 2849 | `bdb4016ee753fa72204520bc1a0a1454bd8690ccaf9947c3e0425158f515addf` |
| `android/updater/AndroidManifest.xml` | 1227 | `330c82fc94a10f827d6239349f43cfe407befe93bcd40c46e29e64a95a91d975` |
| `android/updater/res/values/strings.xml` | 117 | `1dfe50d1911b4524725fb50e1d8d1e715483b9f3ed415ed7410c225ad5964eef` |
| `scripts/apply-etags.mjs` | 2526 | `ae673ff896520946526adf297f76ac91b84d4dae26bcf7fb6ea8d23f9211929d` |
| `scripts/assemble-index.mjs` | 3500 | `342b8c916e9b54d7e156dd28a0e5a91ffac0af5514d69088d3f37970e2ae5493` |
| `scripts/build-android-updater.ps1` | 2534 | `7f8942d0e3a29ffc11d0c127282cb631d3e8847baf4c67859cc81026fbb5561d` |
| `scripts/build-android.ps1` | 2766 | `6d78a89744ab71df2f32ec815585db05648da5c4198d1320aba43a72dbdcc516` |
| `scripts/build-windows.ps1` | 2365 | `e395b35f2773ba67ee7c4ea27f56b59862f14ad4ed03ee4f493e65b3c0f4d640` |
| `scripts/collect-http-digests.mjs` | 1350 | `a70fef8eeb8b0b85c2e6582a4ffebddc5626c9a3843940ae55be860c4d00225d` |
| `scripts/collect-server-digests.mjs` | 2891 | `4d201f626f1e746112af1c31040284fb9aad21dd85767e4534679c25ea71eb6f` |
| `scripts/collect-server-etags.mjs` | 2530 | `d6383219c408f33cdb7637ccfa55189607d6753c9c7d4457fc44fc0641d66ffe` |
| `scripts/compare-digests.mjs` | 1736 | `a4ad44bf1b99640a832312a3cb45c13da5075efe62b328a773ceba09869626a7` |
| `scripts/http-digest-remote.mjs` | 2707 | `a59987311c116cc6bc6144f54a97d154d56e8b9cbf0d2ef89c23f8ba4e071905` |
| `scripts/http-etag-remote.mjs` | 1961 | `ac4278bedbff50ef0156ffa4f4a6aa65024fd5a6ddd3cdb73fd5fbfb3a1710fe` |
| `scripts/icons.cjs` | 759 | `4e31fc35d4bc7b889f639829db68f6a8588cd8ed495451683b0a20dc8e84e738` |
| `scripts/make-apk-patch.mjs` | 4060 | `603ab305d3b2bb503d1beda97a10044812beb71edd00a46b1c05dc8f8d20b158` |
| `scripts/make-windows-patch.mjs` | 2040 | `3b5c97e49ebe34e185aafe56fe2f99fa003b30e7c2f47f7fca8f80018e8198ec` |
| `scripts/prepare-paper.cjs` | 1977 | `136ffa0a397c5941e3d8250a6a06a33958e2326679d07af19ece9c33e0a30b64` |
| `scripts/sign-release.ps1` | 859 | `b8c8958b6481d4fd917e886c05382b8b04c8c42d50f36aa3c21c55e813d6e84d` |
| `scripts/snapshot-assets.mjs` | 5834 | `950a060405f3c2cc8dfb0e3ebf5ec3b84f09832a0463dc0ff850eefd6bcd2321` |
| `scripts/snapshot-assets.py` | 2713 | `ee32271f443da9517261c96c7da26942635f3ca5a4f5b5d95cea30262a45b047` |
| `scripts/test-windows.ps1` | 1381 | `6921ef4e47d86be03b41a3b319761928da2e04d0748dc7fc405a2ead3e007895` |
| `scripts/verify-bundle.cjs` | 955 | `30a77dff50f744c8e1edb7e54d220185b285f77b0643714eae3e370dc81d208b` |
| `scripts/verify-client-rules.mjs` | 9223 | `09b9722a2f0272493943d79f280777becd2c6189fb0b9b27e53c055b1614eb57` |
| `windows/BundledAssets.cs` | 12650 | `b28b49d40f81f419f8ca35f4942e6e99385af51639a88b265e241810130784ee` |
| `windows/Program.cs` | 35291 | `01a170ce34d31ea0ce12b8d9ef8bff842a10bd15d1fad9f130355f52a4a7efd6` |
| `windows/Program.cs.bak-vc12-023123` | 35291 | `4c8468bb249128a9882e75268a5c98944ebfc26c9747297fd6fc61dfbae9f05a` |
| `windows/ReleaseInfo.cs` | 3330 | `af9a301d89410b99409c834cbd7e5e9582207243fc2d9cd5f92a6155da47aadb` |
| `windows/ServerPolicy.cs` | 3596 | `2cc7907e7cf6a5de78676b3ddf8e0fa6b1f1e4e087455c765deb1a548c0dac5b` |
| `windows/StrongholdProtocol.csproj` | 1225 | `e0cd537af5154b3870d715055943ec4e0b9d55e898f334a85ac71a9cadad1317` |
| `windows/installer.nsi` | 2769 | `82472c19a6fbab71af24821b32394abcd9bb1a3bcc6d0a029fad8d08af5248a0` |
| `windows/update-windows.ps1` | 4037 | `c646c63ff8babb812c94e6e16213da64fd06acd9c5e68bb7a0ce1512e9b18f09` |

Total: **42 files, 213928 bytes** (208.9 KiB).

## 3. How local assets actually reach the client, and the three gates

The wrapper intercepts its own WebView requests and answers them from the bundled payload. Windows does it in
`windows/BundledAssets.cs`, Android in `android/src/fun/leio/stronghold/BundledAssets.java`; the body of the
two implementations is the same rule set, and `scripts/verify-client-rules.mjs` is written as the offline
twin of the in-app smoke checks.

Three gates decide whether a request may be served locally:

1. **Source** — `windows/ServerPolicy.cs` / `android/.../ResourcePolicy.java` keep one trusted-origin table
   (`https://sp.bs.leio.fun`, `https://sp2.bs.leio.fun`); `canonicalPath()` rejects an unknown origin, plain
   `http:`, embedded credentials, a non-443 port, path traversal, and any path outside `/assets/`, `/fonts/`,
   `/vendor/`; `/media/<x>` is aliased to `/assets/audio/<x>` (appending `.mp3` only when the last segment has
   no extension).
2. **Content** — a file is served locally only when the index records that **this exact file** was verified
   byte-identical for **that** origin (`files[url].verified[host] === files[url].sha256`). ETag equality is
   deliberately *not* sufficient; the index carries `etags` and `verified` per origin precisely because the
   two origins' mtimes differ.
3. **Release** — the whole payload is trusted at once only when the live `/data/assets.json` `hash` equals the
   index's recorded `manifest.assets`. If it does not, every path falls back to per-file validation (a HEAD
   request per path, result cached per origin+path).

The index schema (from `scripts/assemble-index.mjs`):

```
{ schema: 1, capturedAt, sourceCommit,
  sourceManifests,                       // what was captured
  files:   { "<url>": { size, sha256, mime, etag?, etags?, verified? } },
  manifest:{ assets: <data/assets.json hash>, localAssets: <sha256 of data/local-assets.json> },
  origins: { "<host>": { etagCount, verified, mismatch, missing } } }
```

`manifest`, per-origin `etags` and per-origin `verified` are written **only** by `scripts/assemble-index.mjs`
(and `scripts/apply-etags.mjs`). `scripts/snapshot-assets.mjs` — the other producer — emits only
`schema`, `capturedAt`, `sourceCommit`, `sourceManifests`, `files` (per-file `size`, `etag`, `sha256`, `mime`).

## 4. Findings

### 4.1 The shipped payload on disk is armed, and it is older than production

`bundle/index.json` (also byte-identical in `dist/windows-client/bundle/` and `$out/bundle/`), read
2026-10-12:

| field | value |
|---|---|
| `schema` | `1` |
| `sourceCommit` | `d460f77fe746d5530c0456f067a5bdd3cc586307` (2026-10-11 01:21, "Prevent production connection exhaustion and guard deployments") |
| `files` | 13 642 (797.2 MiB verified by the harness below) |
| `manifest` | `{"assets":"dfcd70fdfb18","localAssets":"3438b638aa45a64942e390f1e55c124a6e575bf51556b9af8bc943a99d26b2df"}` |
| `origins` | both hosts `{etagCount:13642, verified:13642, mismatch:0, missing:0}` |
| `verified[host]` populated | 13 642 / 13 642 for **each** host |
| `etags[host]` populated | 13 642 / 13 642 |

Cross-checks against this checkout: `manifest.localAssets` equals the current
`sha256(data/local-assets.json)` = `3438b638…b2df`; but `data/assets.json.hash` is now
**`18085e58f8df`**, not the recorded `dfcd70fdfb18`.

Measured against live production with `.local/gate-probe.mjs` (read-only HEAD/GET only):

| | sp.bs.leio.fun | sp2.bs.leio.fun |
|---|---|---|
| live `/data/assets.json` `hash` | `18085e58f8df` | `18085e58f8df` |
| gate 3 (release trust) | **FAIL** → per-file ETag validation | **FAIL** → per-file ETag validation |
| per-file ETag sample (12 paths, canonical `/assets/…`) | 12/12 `304` (unchanged), **102 ms per HEAD** | 12/12 `304`, 45 ms per HEAD |
| per-file ETag probe on `/media/…` (the route the client really uses for audio) | **0/12 `304`** — corrected 2026-10-12, see below | **0/12 `304`** |

So today's shipped 1.2.8 bundle cannot take the whole-release fast path on either origin: it revalidates file
by file for the life of a session. At the sampled 102 ms per request to the official origin, and with the
client's own concurrency cap of 8, 13 642 paths would cost roughly `13642/8×0.102 ≈ 174 s ≈ 3 min` of
wall-clock revalidation. Nothing is *wrong* with the served bytes (every sample still matches), but the
"local assets" win is being paid for with per-file round trips.

**Correction (2026-10-12, TASK-022).** The 12/12 `304` above only holds for **canonical `/assets/…` paths**,
which nginx serves straight from disk. Audio is requested through the extension-less `/media/…` alias
(`server/http/media.js`), which is **proxied to Node**, and Node emitted `<size>-<mtime-ms>` while nginx (and
therefore the bundle index) emits `<mtime-seconds>-<size>`. Every `/media/…` validation therefore returned
**200 with the full body**, which is the same outcome as having no local payload at all for the 11.73 GB/day
of audio egress. Re-measured against the index extracted from the shipped APK: 6/6 `/media/` probes → 200,
6/6 canonical `/assets/audio/…` probes → 304. Fixed in `server/http/files.js` (TASK-022) — the repository
twin at `scripts/verify-client-rules.mjs` should grow the same assertion.

### 4.2 Both offline gate-verification scripts are stale — one cannot even finish

`node scripts/verify-client-rules.mjs` exits **1** against the current bundle. Exactly one assertion fails:

```
❌ sourceCommit 是素材基线 2cadc618  d460f77fe746d5530c0456f067a5bdd3cc586307
❌ 1 项未通过
```

The script's own constant (`scripts/verify-client-rules.mjs:65`) expects the older asset baseline
`2cadc6183c133fb22f5853c15db945bbaf4ce700`; the bundle was rebuilt from `d460f77f`. The other 30 assertions
pass, including the whole per-origin whitelist group (13 642 ETags, 13 642 verified, 0 mismatch, 0 missing for
each host), the traversal/unknown-origin/plain-http/credential/port rejections, the `/media/` alias and the
`/assets|/fonts|/vendor` fence. Two further staleness facts in the same file:

- Its comment at `scripts/verify-client-rules.mjs:83` still says *"正式服只对「它自己存在的文件」发 ETag（7976 条），
  sp2 全量（13322 条）"* — neither number matches the current index (13 642 / 13 642 either way).
- The assertion at `scripts/verify-client-rules.mjs:124` is only satisfiable while **some** path lacks
  official-server proof. It is fine on this bundle by luck (the sum is 0), but the guard is written against a
  state that no longer exists.

`scripts/verify-bundle.cjs` (955 bytes) is the preflight both builders call
(`scripts/build-android.ps1:8`, `scripts/build-windows.ps1`) and it verifies **only** the payload: every
indexed file exists with the recorded size and sha256. It never looks at `manifest`, `origins`, `etags` or
`verified` — i.e. it cannot notice a payload that is complete but unarmed.

### 4.3 A released-looking package was already built unarmed — the strongest reason for a build gate

On disk: `dist/_withdrawn-129-031341/Stronghold-Protocol-1.2.9.apk`. Extracting `assets/index.json` from it
with `7z e <apk> assets/index.json`:

```
top-level keys : schema, capturedAt, sourceCommit, sourceManifests, files
has manifest   : false
origins        : undefined
entries with etags   : 0 / 13642
entries with verified: 0 / 13642
```

Its sha256 is `00c62b497b1b561e44d42d982aa8036ed3858e0072e0783d34e2276f33dee63b`, which is **byte-identical**
to `bundle.bad-030829/index.json` — the snapshot-only shape of section 3's tail. Consequences in that build:

- gate 2 can never pass (no `verified` array at all), and gate 3 can never pass (no `manifest`), so **every**
  "local" asset would have been fetched from the live server at runtime — surfacing as the per-file HEAD cost
  of 4.1 for all 13 642 paths, i.e. the exact behaviour TASK-009 exists to prevent;
- the payload itself is intact, so nothing looks broken to a user — it degrades silently, which is why
  `verify-bundle.cjs` passed it.

Nothing reached users: `https://sp.bs.leio.fun/client/Stronghold-Protocol-1.2.9.apk`,
`…-1.2.8.apk`, `…Setup-1.2.9.exe`, `…Setup-1.2.8.exe`, `…1.2.8-to-1.2.9.patch.gz` and `SHA256SUMS.txt` all
return **410** today, `/client/latest.json` returns 200 and still advertises **1.2.8** for both platforms. The
1.2.8 APK's index, by contrast, matches the armed `bundle/index.json` exactly (same `manifest`, same
`sourceCommit d460f77f`, same 13 642 files).

### 4.4 Smaller maintenance hazards (no action taken)

- `windows/Program.cs.bak-vc12-023123` (35 291 B) sits next to `windows/Program.cs` (35 291 B, different
  sha256). A second copy of the program entry point in the build directory invites building the wrong one by
  hand.
- `windows/bin/` and `windows/obj/` hold prebuilt artefacts (`StrongholdProtocol.dll`, `.exe`, `.pdb` from
  2026-10-11; WebView2 assemblies from 2026-09-21), and both directories are gitignored. A release is
  therefore reproducible only if the build really recompiles; a stale `bin/` is invisible to the freeze
  manifest.
- Two snapshot implementations coexist for one job: `scripts/snapshot-assets.mjs` (5 834 B) and
  `scripts/snapshot-assets.py` (2 713 B). Only the `.mjs` one feeds `assemble-index.mjs`.
- The task's acceptance items 3–7 (pre-install manifest validation with version/path/size/hash, interception
  limited to manifest-owned non-traversing paths, extraction/validation/connection progress, measured
  WebGL2 fallback, diagnosis of where slow loading comes from) already exist in the wrapper to a large extent
  — `BundledAssets`, `ResourcePolicy`/`ServerPolicy`, `MainActivity`/`Program` startup path. The remaining
  work in TASK-009 is therefore mostly *proving* and *hardening*, not inventing. That assessment is what the
  gate on TASK-008 has to be applied to before any of it is touched.

## 5. What this document does not claim

- It does not start TASK-009. Its gate — an accepted TASK-008 outcome — is still open.
- It is not a code review of the wrapper: apart from the files cited above, the wrapper was read only far
  enough to establish the gates, the pipeline and the freeze manifest.
- It records no device measurement. The acceptance criterion "at least one Windows client and two Android
  devices at different DPR/GPU tiers" is untouched.
- Running `verify-client-rules.mjs` currently exits 1 (section 4.2). That is a stale expectation in the
  harness, not a failing rule — but until it is repaired it cannot serve as TASK-009's evidence line.
