# TASK-025 — 客户端 1.2.9 增量发布（本地素材 + 顶栏修复）

Status: `review_ready`
Lead: Codex
Implementer: DeepSeek（维护者直接指示：用内置更新器把 1.2.8 增量升到 1.2.9）
Starting commits: 主仓库 `2785e273`；wrapper 分支 `task-009-native-local-assets`（已验收的素材门禁 `b6b2030` + 离线优先本地素材 `498847b`）+ 本次版本号改动

## 背景与目标

维护者 2026-10-13 指示：「增量更新将1.2.8升为1.2.9吧」，并说明「我们有内部更新器啊，可以通过内推少量更新文件到客户端然后通过更新按钮更新」。

已安装的 1.2.8 客户端内置的是**旧素材**（顶栏中框、休息一下胶囊、查看按钮），而服务器侧素材已在 0.2.5 上线时修正（TASK-024）。本次目标：让已安装的 1.2.8 客户端通过内置「更新」按钮拿到 1.2.9——新素材、离线优先的本地资源解析、版本号自增——同时提供新的完整安装包。

## 范围

- 版本号：`windows/StrongholdProtocol.csproj`、`windows/Program.cs`（ClientVersion/ClientVersionCode）、`windows/installer.nsi`、`android/AndroidManifest.xml`、`scripts/build-windows.ps1`、`scripts/build-android.ps1` → 1.2.9 / versionCode 12。
- 素材包：`scripts/snapshot-assets.mjs` 重建 `bundle/`（旧索引备份 `build/bak-129/index-armed-1.2.8.json`），`scripts/assemble-index.mjs` 用服务器 ETag + sha256 重新武装（两个来源各 13 642 条），`scripts/verify-bundle.cjs` 作为构建硬门禁。
- 增量包：`windows-1.2.8-to-1.2.9.zip`（以 1.2.8 安装包解出的真实安装树为基线做逐文件 diff）、`1.2.8-to-1.2.9.patch.gz`（以已发布的 1.2.8 APK 为基线）。
- 完整包：`Stronghold-Protocol-Setup-1.2.9.exe`、`Stronghold-Protocol-1.2.9.apk`。
- 发布清单：`release/latest.json` 升到 versionCode 12 / 1.2.9，`scripts/sign-release.ps1` 重签 `release/latest.sig`，上传到 `/opt/sp2/public/client/`（先传包，最后传 `latest.json` + `latest.sig`）。

## 保护范围

只动客户端产物与 `public/client/`；不改服务端代码与 `data/*.json`；不提交素材、签名密钥或构建产物（`.signing/`、`dist/`、`bundle/` 仍按 wrapper 忽略规则）；不发布到 GitHub Release；不做生产部署之外的操作。

## 验收

- `node scripts/verify-bundle.cjs` 通过（已武装：13 642 文件，两个来源 ETag 13 642 / 内容一致 13 642）。
- Windows 发布树内置素材为最新（`frame_mid_normal.png` 482 174 B、`bg_rest.png` 900 142 B、`assets/local/ui/battle/btn_check_enemy.png` 1 746 B），exe 版本号 1.2.9。
- Android APK：`apksigner verify` 通过，badging = versionCode 12 / versionName 1.2.9。
- 增量包与真实基线一致：Windows zip 内 `manifest.json` 的每条 `oldSha256` 都能在 1.2.8 安装树里命中（`update-windows.ps1` 会逐条校验并拒绝不匹配）；APK 补丁头 `baseSha256` = 已发布 1.2.8 APK 的 sha256 `645de666…`。
- 线上：`/client/latest.json` 与 `latest.sig` 签名校验通过，新包 HTTP 可达且 sha256 与清单一致。

## 回滚

- 服务器：`/root/sp2-backups/client-<时间戳>/` 保留旧的 `latest.json` / `latest.sig`（旧包文件一律不删除）；恢复这两个文件即让客户端回到 1.2.8 的更新路径。
- 仓库：revert 本任务提交；`bundle/index.json` 可用 `build/bak-129/index-armed-1.2.8.json` 恢复索引（素材需由旧安装包重建）。

## 检查点

### 2026-10-13 03:36 — TASK-025 — DeepSeek（1.2.8 → 1.2.9 增量发布）

- Action: 重建并重新武装素材包（新顶栏素材进包）；六个版本号文件升到 1.2.9 / versionCode 12；全量构建 Windows 安装包与 Android APK；以真实 1.2.8 安装树做 Windows 逐文件 diff、以「线上 1.2.8 APK」与「本机 1.2.8 APK」两个基线各做一份 APK 补丁；更新并重签发布清单；按「先包、最后清单」的顺序上线到 `/opt/sp2/public/client/`。
- Result: 5 个产物 + 清单已上线并逐条复核（见「证据」）；两个客户端内嵌公钥验签通过；增量包 Windows 2.13 MB / Android 3.86 MB。
- Verification: `verify-bundle.cjs`（已武装 13 642 文件、两个来源各 13 642 条一致）；`npm run test:validators` 21/21；`build/check-manifest-key.mjs`（双客户端公钥验签）与外网复核 `build/verify-published-129.mjs` 全部一致；服务器端 8 个文件 sha256 与本机发布哈希逐条一致。
- Next: 维护者用已安装的 1.2.8（Windows/Android）点「更新」验证增量安装；完整安装包按既定政策由 QQ 群分发（网页 410 属预期）。
- Production/GitHub: 生产 `/opt/sp2/public/client/`（清单与增量包可达）；服务端代码与 `data/*.json` 未改；GitHub 未发布。

## 证据

### 素材包（重建 + 重新武装）

- `node scripts/snapshot-assets.mjs` 重建 `bundle/`：13 642 文件 / 798.6 MiB，`skipped 0 / missing 0`，`sourceCommit 2785e273d7d87fbfea6ae8ea825c81432a7eee50`；旧索引备份 `build/bak-129/index-armed-1.2.8.json`（6 272 997 B）。
- 武装：`collect-server-etags.mjs` 13 642 条 ETag（0 missing）、`collect-server-digests.mjs` 13 642 条 sha256（0 missing）；`assemble-index.mjs` 两个来源均 `ETag 13642 / 内容一致 13642 / 内容不同 0 / 服务器缺失 0`；`manifest` = `{"assets":"18085e58f8df","localAssets":"3438b638…b2df"}`。
- 门禁：`node scripts/verify-bundle.cjs` → `✅ 素材包可用（已武装）：13642 文件 / 798.6 MiB / 本地命中证明 13642 条 / ETag 13642 条`，`provenance.notes = []`（此前 `manifest.assets` 的漂移已消失）。
- 包内新素材：`frame_mid_normal.png` 482 174 B `4fa2e8dc…`、`bg_rest.png` 900 142 B `4b0eda5e…`、`assets/local/ui/battle/btn_check_enemy.png` 1 746 B `55923c01…`。

### 版本号

`windows/StrongholdProtocol.csproj:10` `<Version>1.2.9</Version>`；`windows/Program.cs:24-25` `ClientVersion = "1.2.9"` / `ClientVersionCode = 12`；`windows/installer.nsi`（OutFile / VIProductVersion / FileVersion / DisplayVersion）；`android/AndroidManifest.xml:2` versionCode 12 / versionName 1.2.9；`scripts/build-windows.ps1:37`、`scripts/build-android.ps1:35,37,38`。

### 构建产物

| 产物 | 大小 (B) | sha256 |
| --- | --- | --- |
| `Stronghold-Protocol-Setup-1.2.9.exe` | 584 961 214 | `9510a7b270a9b564f6ba5c7eb0b3378c4a5c1183adc4935b2a19f9c93042b98e` |
| `Stronghold-Protocol-1.2.9.apk` | 626 987 980 | `8b84b683dc4e254eff3253017f0c11b2bcb90341ff1552ab51f68dd0c7c97245` |
| `windows-1.2.8-to-1.2.9.zip` | 2 134 089 | `39644323d93abc2e45741d98230d68376476f0d973669203bfef12ba1089f51f` |
| `1.2.8-to-1.2.9.patch.gz`（基线 = 线上 1.2.8 APK `645de666…`） | 3 861 651 | `bd65c12031f4c533580d06897f7dbdffff6cff35fa92a641cb51e038f8704641` |
| `1.2.8-local-to-1.2.9.patch.gz`（基线 = 本机 1.2.8 APK `da98a468…`） | 3 905 431 | `720e6a6ea7ebbf379991fa30353fee27222cacbe40ec4372e2bbcc7340fd3825` |

- Windows 发布树 `dist/windows-client`：13 917 文件 / 965 481 620 B；`StrongholdProtocol.exe` 162 304 B `8a141797…`，FileVersion 1.2.9.0 / ProductVersion `1.2.9+498847b2…`。安装包与发布树都**不含**索引武装的中间产物（`windows/StrongholdProtocol.csproj:17` 的 `Exclude="../bundle/etags-*.json;../bundle/digests-*.json"`，四份中间文件移到 `build/arm-129/`）。
- Windows 增量包只含 6 个变化文件：`bundle/index.json`、`bundle/payload/assets/ui/hudPanel/{bg_rest,frame_mid_normal}.png`、`StrongholdProtocol.deps.json`、`StrongholdProtocol.dll`、`StrongholdProtocol.exe`；`make-windows-patch.mjs` 对 1.2.8 安装树逐条核对 `oldSha256`、对 1.2.9 发布树核对 `newSha256`，0 问题（`update-windows.ps1` 会按同样规则逐条校验并拒绝不匹配的补丁）。
- Android：`apksigner verify` → v1 false / v2 true / v3 true；badging versionCode 12 / versionName 1.2.9；两份 APK 补丁的目标 sha256 均为 `8b84b683…`。基线发现：本机 `dist/android/Stronghold-Protocol-1.2.8.apk`（`da98a468…`）与线上发布的同名文件（`645de666…`）同尺寸但字节不同，故对两个基线各出一份补丁。

### 清单与签名

- `release/latest.json` 2 287 B `0eaef28a348df3221ec770cffbb9fc79ae7925d3b8ee8eafe22fd25c47154f02`：Windows versionCode 12 + 3 个增量（from 11 / 10 / 9），Android versionCode 12 + 4 个补丁（`645de666…`、`da98a468…`、`aa16afe3…`、`1cd2595a…`），`apkSha256 8b84b683…`。
- `scripts/sign-release.ps1` 必须在 PowerShell 7 下运行：Windows PowerShell 5.1 上 `RSA` 是 `RSACryptoServiceProvider`，没有 `ImportFromPem`（报 `Method invocation failed … does not contain a method named 'ImportFromPem'`）。签名产物 `release/latest.sig` 512 B `5e993d3d035346305e32940e27875b9af0df18bd5fab44c82e03d65da6b4971a`。
- `build/check-manifest-key.mjs`：新清单用**两个客户端内嵌公钥**验签均通过，且两把公钥与 `.signing/update-release-public.pem` 逐字节相同。

### 上线与线上复核（2026-10-13 03:36 +08）

- 上传：8 个文件先传到服务器 `/tmp/client129/`（远端 sha256 与本机一致），再由 `build/publish-129.sh` 先落 5 个包 + `index.html`、**最后**落 `latest.json` + `latest.sig`；旧清单对备份到 `/root/sp2-backups/client-20261013-033604/`（旧 `latest.json` 1 487 B / `latest.sig` 512 B / `index.html` 1 109 B）。
- 安装后服务器端 8 个文件的 sha256 与本机发布哈希逐条一致。
- 外网复核 `build/verify-published-129.mjs`：清单签名用客户端内嵌公钥验签 `true`；`windows-1.2.8-to-1.2.9.zip` 200 / 2 134 089 B / sha256 与清单一致；`1.2.8-to-1.2.9.patch.gz` 200 / 3 861 651 B / 一致；`1.2.8-local-to-1.2.9.patch.gz` 200 / 3 905 431 B / 一致。
- nginx 策略（2026-10-11 起）：`/client/` 只放行 `latest.json`、`latest.sig`、`*.patch.gz`、`windows-*.zip`（`Cache-Control: no-store`）；其余（含 `/client/index.html`、APK、EXE）返回 `410 Client downloads moved to the QQ group.` —— 完整安装包按既定政策走 QQ 群，本次上传的安装包/APK/下载页留在服务器上但**不经网页下载**（与 1.2.8 相同）。
- 客户端可执行文件与 `dist/`、`release/`、`.signing/`、`bundle/` 仍不入库（wrapper `.gitignore`），本次入库的只有六个版本号文件与 `.gitignore` 的 `$stage/` 规则。
