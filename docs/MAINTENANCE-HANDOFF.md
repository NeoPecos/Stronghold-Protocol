# 维护交接单（历史操作记录，已停止追加）

> 当前生产与仓库状态以 `PROJECT-STATUS.md` 为准。新任务写入 `docs/tasks/`，新操作写入 `docs/ops/`，
> 新发布写入 `docs/releases/`。此文件保留用于事故审计，其中不同时间段的状态可能互相矛盾。

> 这份文件是给**下一个会话**看的。上下文结束后，读这里就能接着干，不必重新调查。
> 线上是 `sp.bs.leio.fun`（jing: `/opt/sp2`，systemd `sp2.service`）。**未经允许不要动正式服**。

## 已完成（本次会话，全部已上线并验证）

| # | 事项 | 文件 | 上线哈希 |
|---|---|---|---|
| 1 | **休整期落格动作 + 落地光柱** | `public/js/render/app.js`（`_prevArea` 判据） | `2ec9ec406694` |
| 2 | **`highlightTiles` 崩溃**（销毁后仍调 `clear()`） | `public/js/render/tiles.js`（3 处守卫 + 销毁置空） | `1103546d899d` |
| 3 | **「保持登录」设置开关** | `ui/gameLogic/settings.js`、`ui/settings.js`、`main.js` | 已上线 |
| 4 | **`公告` msgid + `保持登录` 译文**（4 语言） | `public/i18n/*.json` | 已上线 |
| 5 | **loadout 6 个标签包 `t()`**（i18n 测试全绿） | `public/js/screens/loadout.js` | `d9cbef1c5f4c` |
| 6 | **手机矮屏：`transform:scale` → `zoom`** | `public/css/screens/title.css` | `ebd4d2f31dba` |
| 6b | **手机登录页左侧空白**（标题页被安全区整列右推） | `public/css/devices.css`（选择器加 `:not(.title-screen)`） | `9ec0a8c58bd9` ✅ **用户真机确认已修** |
| 7 | **旧补丁撤除 7 个** | 服务器 `/client/`（归档在 `backups/retired-patches-*`） | — |
| 8 | **旧完整包清理**（释放 2.88 GB） | 服务器 `/client/` | — |
| 9 | **默认登录 + 标签对调** | `public/js/screens/title.js` | 已上线 |
| 10 | **公告按钮只留在标题页**（按路由渲染） | `index.html` + `main.js` | 已上线 |
| 11 | **客户端 1.2.8 发布**（APK/exe/补丁/签名清单） | 服务器 `/client/` | 全链路验证 |

**测试基线**：`5924 / 5950` 通过（起点 5921/5950）。剩余 3 个失败**全是既有的**（见下"已知遗留"）。

## 待办（按建议优先级）

### ① 买卡底栏去黑底（用户最新要求）

**素材已确认干净**：6 个金币/图标 PNG 均为 `RGBA`、四角不透明黑像素 `0/4`。**黑底全在 CSS**：

| 位置 | 代码 | 作用 |
|---|---|---|
| `public/css/screens/game-shop.css:92` | `.scard { background: #151a18 }` | 卡片实心黑底 |
| `game-shop.css:97-101` | `.scard__bg` 的 `linear-gradient(180deg, #1a1e1c, #0d100f)` | 卡面暗色渐变 |
| `game-shop.css:113` | `.scard__body` 的 `linear-gradient(0deg, rgba(8,11,10,.96) 45%, …)` | **底部黑带**（用户主要不满处） |
| `game-shop.css:108` | `.scard__price { filter: drop-shadow(0 1px 3px #000) }` | 价格徽章的方形黑底 |

**建议改法**（但**必须真机看**，因为文字会压在立绘上）：

```css
.scard { background: transparent; }
.scard__bg { background: linear-gradient(180deg, color-mix(in srgb, var(--tc) 14%, transparent), transparent 62%); }
.scard__body { background: none; text-shadow: 0 1px 3px rgba(0,0,0,.9), 0 0 8px rgba(0,0,0,.7); }
.scard__price { filter: drop-shadow(0 1px 2px rgba(0,0,0,.55)); }
```

**取舍**：删掉黑带后名字/职业文字直接压在卡面立绘上，浅色干员图可能看不清。若变糊，改回"很淡的从下往上渐变"（`rgba(8,11,10,.75) → transparent`）而不是全删。

### ② 大厅顶栏标题与按钮行重叠

**⚠️ 状态更新（2026-10-11）：标题页已用工具验证为安全** —— 在 568×320 / 640×360 / 667×375 / 740×360 / 812×375 / 844×390 六个手机视口下，中央列 `.title-main` 的左右留白最少 **175px**（远大于刘海需要的 ~44px），**不重叠**。本会话的三处修复（安全区排除、`zoom`、`title-conn` 的 `nowrap`）叠加已解决标题页的问题。

**大厅（`选择模拟协议` 那一屏）仍未验证** —— 它需要登录才能进入，无法用未登录的无头浏览器直接量。若用户仍在该屏看到重叠，按下面步骤量：

`.topbar` 是 3 列网格（`components.css:1015`，`grid-template-columns: minmax(0,1fr) auto minmax(0,1fr)`），标题在 `.topbar__center`，按钮在 `.topbar__right`。

**先用工具量，别猜**：`node scripts/cdp-measure.mjs <url> <宽> <高>`（用 Edge 的 DevTools 协议量真实矩形，不依赖 playwright）。量 `.topbar__center` 与 `.topbar__right` 是否水平重叠、右列是否超出视口。

### ③ 3D 门的三角符号在 web 端错位（PC 客户端正常）

- **不是回归**：`public/js/render/board3d/` 在本仓库里是干净的（未提交改动里没有它）。
- `board3d/scene.js:325 _buildGates`，摆位 `const at = { x: g.c, y: g.r, z: g.z + 0.5 + 0.003, rot: 2 }`。
- 预制数据 `public/assets/local/map/fx/prefab.json`：`Start_up`/`Start_down` 挂在 `Start` 下，`pos=[58.93, 0.33, 54.95]`（父节点 `Start` 再用 `[-58.93, 0, -54.95]` 抵消回原点）；**`Start_down1`/`Start_up1` 挂在 `[opt]end_box` 下，`pos=[0, 0.326, 0]`（原点、无旋转）**。
- 网格包围盒：`Start_up`/`Start_down`/`Start_down1` 顶点都是 `x[-50,50] y[-50,50] z[-50,50]`，三角符号在网格里是居中的。
- **怀疑**：`placeMesh` 的 `rot` 是 90° 的整数倍（`rot * Math.PI / 2`），而预制里的 45° 旋转与节点偏移都没有被应用。`endDown/endUp`（即 `Start_down1`/`Start_up1`）在原点无旋转，**可能是干净的最小修复**。
- ⚠️ **注意**：用户说 PC 客户端（WebView2）渲染**正常**，所以这可能只是 web 端的精度/能力差异，不一定是摆位代码错。**先对比两端实际渲染再动**。

### ③-b 华法林模型缺半个头（鱼梦对局中，2026-10-11）

**已排除的资源问题**（别重复查）：
- `char_171_bldsk`（华法林）front：`char_171_bldsk.png` **512×512** 与 atlas 声明 `size: 512,512` **一致**；44 个区域，最大 `xy` (484,485) **在界内**；skel 81690 字节、atlas 4331 字节。
- back：256×256 一致，27 个区域。
- **结论：不是贴图尺寸不符、不是文件截断。**

**下一步方向**（未验证）：
- 这是"局部缺失"而非"整体错位"，更像 **Spine 裁剪/mask 或 attachment 在某个姿势下越界**，或 web 与 WebView2 的渲染差异。
- 相关代码：`public/js/render/units.js`（Front/Back 模型切换、`die(true)` 的 held 姿势）、`public/js/render/spine.js`（clip 与 attachment）。
- **需要的信息**：这是只在**某个动作/朝向**下出现，还是持续？PC 客户端是否同样缺失？（若是，则与 ③ 的"门"可能是同一个渲染差异的两种表现。）

### ③-c 门的三角符号（补充：已排除项）

**⚠️ 状态（2026-10-11）：调查已到"静态对比的极限"，需要运行时数据才能继续。用户暂缓，未做任何未验证的改动。**

**已排除（别再重复查，每条都有证据）：**

| 假设 | 结论 | 证据 |
|---|---|---|
资源损坏/截断 | ❌ 排除 | 5 个门网格 OBJ 完整（`Start_up` 60 顶点/30 面，末尾面数据正常） |
网格顶点内含偏移 | ❌ 排除 | 用真实 OBJ 顶点套 `objToBoard`+`placeMesh`，5 个网格包围盒中心**精确落在门格中心** |
网格内含 45° 旋转 | ❌ 排除 | 顶点角度 45°/135°…、半径 70.7=50√2，即"角在轴上"；`objToBoard` 映射后**正好轴对齐** |
3D 门模型加载失败→降级 2D 线框 | ❌ 排除 | nginx 日志：门 obj 各 36~38 次请求、**`map/fx` 的 404 次数 = 0** |
**代码回归** | ❌ **排除（最关键）** | 客户端打包版 `stronghold-app/build/paper-release/game/public/js/render/tiles.js` 与 git HEAD **逐字节相同**，与网页版差异**只有本次会话我加的东西**；`projection.js` 两版也逐字节相同 |
画三角的代码 | 只有一处 | `tiles.js` 的 `drawWireBox()`（`public/assets` 里没有第二处）；`scene.js` 的 3D 门用预制网格，不画三角 |

**结论**：画三角的代码、相机代码、素材、加载路径**全部正常且两版一致**。所以"客户端正常、网页错位"**无法从静态代码解释**。

**下一步必须做的（instrument，不要继续推断）**：
在 `drawWireBox()` 里加 `?spgate=1` 探针，打印每个门的 `框投影矩形 / 三角锚点 / tri 尺寸 / 是否在框内`。判据：
- 探针说"在框内"而用户看到"在框外" → **渲染层问题**（PIXI 的 `BLEND_MODES.ADD`、Graphics zIndex、canvas 缩放）
- 探针说"锚点偏" → 摆位问题，继续调锚点

**参考实现**：`_drawBoxes()` 在 `tiles.js`，调用链 `drawWireBox(g, cam, c, r, 0.02, 0.96, 0.92, color, pulse, gate)`。
注意 `gate ? COLORS.gateRed : COLORS.objBlue`（`style.js:49-51`）。

**曾试过但已回滚的改动（不要重复走这条路）**：
把三角锚点从 `cam.project(cx, cy - size / 2, z0 + height * 0.5)` 改成"北面四角投影中点"、并把 `tri` 从 `s * 0.2` 改成按投影面高取比例。**回滚原因**：无法验证（我没有可视渲染），而且我写的测试用了**仿射投影**的假摄像机，导致旧写法也能通过 —— 是**假测试**，证明不了修复。要重做的话必须用**带深度除算的透视摄像机**（真实的 `cam.project` 是透视的，这正是"棋盘空间推半格 ≠ 屏幕半格"的来源）。

### ⑤ 客户端「服务器／正式服」按钮（**用户暂缓，勿擅自改**）

**用户在 2026-10-11 明确说「先不改了，我怕你改出问题」。没有用户明确要求，不要动这里。**

**它属于安卓端，不是 Windows 端 —— 两个端各有一份同名实现，容易认错：**

| 端 | 文件 | 说明 |
|---|---|---|
**安卓（用户要改的）** | `stronghold-app/android/src/fun/leio/stronghold/MainActivity.java` | `L44 serverButton`、`L55 setVisibility`、`L93 buildServerButton()`、`L180 buildServerButton()` 定义 |
Windows（**不要改**） | `stronghold-app/windows/Program.cs` | `L32 ToolStripButton serverButton`、`L127 "服务器：" + serverName` —— **与用户需求无关** |

**用户的原始要求**（等他改主意时用）：把左上角的服务器按钮**移到右侧、放在「检查更新」下面**，并且**当前按钮显示不全需要调整**。

**待用户先回答的问题**：① 文字要一行（`服务器：正式服 ▾`）还是两行（截图中是两行）；② 位置是否就指右上角、检查更新正下方、右边缘对齐；③「显示不全」是文字被截断还是按钮被屏幕边缘切掉。

**Windows 端排查记录**：本会话曾误改 `windows/Program.cs`（把两个 `ToolStripButton` 换成右侧竖排 `FlowLayoutPanel` 浮层），已**完整回滚**（残留校验 0、编译通过、`FormClosing`/`Shown`/`serverButton`/`notesButton` 全部恢复原样）。`stronghold-app` **不是 git 仓库**，回滚只能靠手工逐处还原 —— 改这个仓库前先手动备份文件。

## 2026-10-11 第二段会话（交接计划第 1~6 项）

### 已完成

| 计划步骤 | 内容 | 验证 |
|---|---|---|
1. 审 diff | 11 个文件改动都在位，未重复实现 | — |
2. 房间测试 | 新增 4 个测试覆盖计划列的全部 7 项验收 | `test/lobby.test.js` **70/70**（连跑 2 次稳定） |
3. 大厅三分辨率 | **修掉真实溢出**：1423×764 时 `.lobby-body` 溢出 131px、创建按钮在折叠线下 57px（且 `overflow:hidden` → 点不到）。照计划压缩优先级加了 `@media (max-height: 820px/740px)` | `room-directory.e2e` 三分辨率通过 |
4. 房间两个开关 | 接入用户新给的图片素材（`/assets/ui/room/{invite-only,recruit-wanted}.png`，单图 + CSS 状态；去掉了同义 SVG 图标）；grid 首列 `.28rem→.36rem` | 新增 `test/ui/room-access-switches.e2e.test.js` **2/2** |
5. FREE 徽标 | 新增静态测试锁住"只有一个 FREE" | `test/ui/shop-free-badge.test.js` **2/2** |
6-a. 冻结≠晕眩 | 见下 | 新增 `test/render/frozen-not-stun.test.js` **7/7**，动画全量 **116/116** |

### 6-a 冻结≠晕眩（根因与修法，勿重复排查）

**根因**：三种状态被表现层折叠成一个 `'stun'`。
- 服务端 `flags.stun` 是**逻辑上的"不能行动"聚合位**，设计上包含睡眠与冻结 ——
  `server/sim/content/enemies/special.js:117` 注释原文："`s.flags.stun` also holds while asleep / frozen (units.js)"。
  **不要动 sim**：插值靠 `ANIM.STUN` 停止外推位置（`test/render/attack-recovery-interp.test.js:293` 断言
  freeze/sleep/levitate 都发 `ANIM.STUN` 且位置不外推 —— 那个测试是对的）。
- 表现层却把它当成"播晕眩动作"的信号（BUG）：
  `units.js _baseFromAnim()` → `flags & (STUNNED|FROZEN|SLEEP)` 一律 `'stun'` → `spine.js _enterStun()` 播 `roles.stun.loop`。

**修法**：新增 `'frozen'` 基准状态，用**两套既有机制**：
1. `this.frozen = true` 跳过骨架更新 —— 骨刺的 A/B 附件事换依赖它（`forms.test.js` 断言 `update(0)` 且附件立刻应用）；
2. 当前轨道 `timeScale 0` —— 姿势真停住，解冻时从停住处继续（不会跳到时钟位置）。
另：`syncFormPose()` 必须加 `'frozen'` 分支，否则形态切换时新姿势不落地。
**不要在 `setBase` 里对已冻结直接 return** —— 那会挡住附件事换。

**同步的断言**：`forms.test.js` 的 `mode === 'stun'` 改为按控制类型判定（真晕眩→`'stun'`，冻结/沉睡→`'frozen'`）。
这是本次修复的预期契约变化，测试守的"骨架冻结+附件事换"依然成立。

### 6-b / 6-c 未做（下一步）

- **宴 S2 播 S1 坐姿**：按计划 §6 的 4 条分叉诊断（① skillIndex 传递 ② `setSkillIndex()` 时序/模型缓存复用
  ③ roles 正确但画面错（记每次 `setSkill(true)`/`attack()`/`setBase()` 的 clip）④ 仅旧客户端/Service Worker 缓存）。
  素材事实：`char_337_utage` 的 skill index 1 是 `via:'attack'`。
- **安洁莉娜泳装皮 S3 固定映射 `Attack`**：扫描所有 `skills[index].via === 'attack'` 的多技能角色，
  区分"确实共用平A"与"骨骼技能编号少、需要槽位重映射"。

### 顺手修掉的测试缺陷（与 6-a 无关，但影响 CI 可信度）

`test/lobby.test.js` 的 `protocol fuzz` 会**稳定失败**：断言 `fuzz never succeeded at g.infoReady`。
根因是 `g.infoReady` 只在 `PHASE.INFO_CHECK` 有效，而那是**真实 25 秒计时器** —— 500 条随机消息能否落进
窗口取决于墙上时钟，别的测试改动时序就会红。修法：让 fuzz 自己确定性地完成一次（进对局 → 等
`PHASE.INFO_CHECK` → 再发那条），上面 500 条随机仍然验证通用接受性。

### 本段会话引入并修复的三个自身回归（教训）

1. **删 `Icon` import 前只用一个正则数用法**，漏掉了 `<${Icon}` 写法（实际 13 处）→ 房间页 `ReferenceError: Icon is not defined` 崩溃。
   本项目 JSX 是 `<${Icon}` 形式，**删 import 前要用 `grep Icon` 而不是匹配 `<Icon `**。
2. **在 JSX 模板字面量里写 HTML 注释 `<!-- -->`** → 变成字面文本、撑坏 DOM → 房间页白屏。用 JS 注释。
3. **改登录页默认后没更新依赖它的 e2e**：我把默认从"注册"改成"登录"（用户要求），
   而 `room-directory`/`settings-entry`/`text-scale` 三个 e2e 都用新建账号直接点「开始」→ 全部超时。
   已在三处显式加一步点「注册账号」。**改默认行为后要 grep 谁依赖它。**

### 环境提示

- e2e 需要 `SP_E2E=1` 且 `CHROME_PATH` 指向浏览器。本机可用 Edge：
  `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`（无 Chrome 也能跑）。
- `puppeteer` 的 `setViewport` 对这个页面**不改变布局**（页面自行按 `100vw/100vh` 缩放），
  量分辨率要用 e2e 里真实的 `window.innerHeight` 与元素矩形，别只信 viewport 参数。

### 6-b 宴 S2：**已查证为"代码正确"**（结论 + 回归测试）

按计划 §6 的 4 条分叉逐段实算，**整条链都是对的**（不是推断，每段都跑过）：

```
素材 data/assets.json  char_337_utage.spine.front.anims:
      attack = Attack；skill = { loop:'Attack', via:'attack', index:1 }
      skills = { 0: Skill_Start/Loop/End（S1 分神，坐下）, 1: Attack via:'attack' }
数据 data/chess.json   chess_char_1_18_a/b: skills[1].isDefault === true, skill.index === 1
协议 loadoutOptions()  → defaultSkill = 1（实算：defaultSkill=1, skills=[0,1]）
     resolveLoadout()  → 未选技能时用 opt.defaultSkill
服务端 match/player/basics.js loadoutFor() → match/match/views.js:269 的 UnitInfo.skillIndex
客户端 render/app/info.js → spine.js _applyRoles() 按 anims.skills[index] 取
```

**实测三种取值**：未指定 → `Attack`；1 → `Attack`；**0 → `Skill_Loop`（坐姿）**。
所以默认 S2 走 `via:'attack'`、**按设计就是普通攻击**（`setSkill` 第三条分支播 `_baseName()`），
**"坐姿"只可能来自 `skillIndex === 0`**（玩家真的选了 S1）。

**回归测试**：`test/render/utage-skill-clip.test.js`（5 项）钉住数据侧默认技能=1、素材侧映射、三种 skillIndex 的表现。

**⚠️ 测试写法陷阱（我踩过，追查了一轮）**：`UnitView.sync` 用 `prevFlags ^ this.flags` 做**变化检测**
（units.js:887），而 `prevFlags` 取自 `this.flags`。**不要在 `sync()` 之前手动 `v.flags = UF.SKILL`** ——
那样两边同值、异或为 0，`setSkill` 一次都不会被调用，看起来像"技能动画没播"的游戏 bug（实际是探针写错）。
flags 只能通过 `sync(sample)` 传。

### 6-c 安洁莉娜泳装皮 S3：**证据已收齐，但需要"官方参照"才能定论**

**关键数据**（实算）：

```
char_291_aglina  front.anims.skills = {
  "0": Skill1_Begin/Loop/End        ← 专属动作
  "1": Skill2_Begin/Loop/End        ← 专属动作
  "2": loop:"Attack", via:"attack"  ← 没有专属动作，用普通攻击兜底
}
data/chess.json  chess_char_5_20_a/b: skill.index = 2, skills[2].isDefault === true
                 （S3 秘杖·反重力模式是**默认技能**）
她的 S2「秘杖·微粒模式」与 S3「秘杖·反重力模式」都叫"反重力模式"系。
```

**规则原文**（`docs/ASSETS.md:341`）：

> On a skill clip, `via: 'attack'` means the model has no skill animation, so the attack clip is reused.

**生成规则**（`tools/assets/anim-roles.mjs:189 resolveSkill`）：按 `Skill_${n}` → `Skill${n}` → `Skill_0${n}` → `Skill`
依次找前缀；`Skill_1_Loop` 这种**带数字**的只匹配 `Skill_${n}`/`Skill${n}`/`Skill_0${n}`，**不会**被裸 `Skill` 前缀匹配。

**为什么还不能定论**：她只有 `Skill1_*`、`Skill2_*` 两套动作但数据里有 3 个技能槽。slot 2 到底是
"官方也没给它专属动作（→ 现状正确）"还是"应重映射到 Skill1_* 或 Skill2_*（→ 现状是 bug）"，
**代码和本地素材都无法回答** —— 需要 PRTS / 官方客户端对照，或项目所有者拍板（ASSETS.md 的映射规则本来
就允许 `via:'attack'` 作为兜底）。**不要凭猜测改数据表。**

**已做过的全量扫描**（结论供参考）：`via:attack` 且同角色其他槽有专属动作的条目共 **80 条**
（含所有皮肤变体）；但这**不是** bug 清单 —— 多数是"该技能确实没有专属动作"，而且 `via:'attack'` 也用于
`loop` 就是 `Attack_*` 变体的情况。**这个启发式不足以判定，别再据此改表。**

## 2026-10-11 17:2x 事故：Windows 增量更新失败（Codex 14:19 改动导致）**已修复**

**症状**：1.2.7 用户更新报 `更新失败，已尝试恢复旧版。当前版本与补丁不匹配：StrongholdProtocol.dll`
（文案来自 `stronghold-app/windows/update-windows.ps1:38`）。

**判定机制**（`update-windows.ps1:35-39`）：补丁的 `manifest.json` 给每个文件声明 `oldSha256`
（"你本地应该是这个文件"）与 `newSha256`。**本地文件哈希 ≠ `oldSha256` 就抛错并整体回滚。**

**根因（有逐字节证据）**：

| | exe sha256 | 内含 dll sha256 |
|---|---|---|
**用户实际装的 1.2.7**（Codex 发布产物 `Documents\Codex\...\jie-z\outputs`，01:36/01:39） | `cd581b54…` | **`5a344616…`** |
本地 `dist` 里被**重建过但从未发布**的 1.2.7（05:57–06:09） | `ace9b925…` | `b1a944ae…` |

- 06:13 发布的 `windows-1.2.7-to-1.2.8.zip`：dll `oldSha256 = 5a344616…` —— **对**（匹配真实用户）。
- 14:17 Codex 用**本地重建的那批包**重做补丁 → `windows-1.2.7-to-1.2.8-r2.zip`，dll `oldSha256 = b1a944ae…`
  —— **这个哈希在真实用户机器上不存在**。
- 14:19 清单改指向 r2 + 重签 → 所有 1.2.7 Windows 用户更新失败。
- 客户端只用 `FirstOrDefault(item => item.From == ClientVersionCode)`（`Program.cs:282`），
  **同一 `from` 列多个补丁没用**（后面的永远不被尝试）。

**修复**：把 `release/latest.json` 的 windows `from:10` 改回
`windows-1.2.7-to-1.2.8.zip` + `sha256 6928efb27753abf0…`，用 `.signing/update-release-private.pem`
重签（`scripts/sign-release.ps1`），部署。**修复后 `latest.json` 的 sha256 = `efe977150b5487a4…`
—— 与 1.2.8 发布时记录的哈希完全一致**，即回到了 Codex 改坏之前的状态。

**端到端验证通过**：签名 RSA 校验 ✅、补丁 sha256 匹配 ✅、补丁内 dll `oldSha256 = 5a344616…` = 用户实际装的 ✅、
真实域名 200 ✅。**Android 链没被影响**（`1.2.7-to-1.2.8.patch.gz` 的 `baseSha256 = aa16afe33119…` = 用户的 APK）✅。

**给后来者的警告**：
1. **发布补丁前，`oldSha256` 必须从"用户实际装的那份安装包"里取**，不能从本地 `dist`（它被反复重建，与线上不是同一批）。
   `Documents\Codex\2026-10-11\jie-z\outputs\SHA256SUMS.txt` 是 1.2.7 的权威哈希来源。
2. `dist` 里的 `windows-1.2.7-to-1.2.8.zip` 与 `-r2.zip` **现在是同一个文件**（14:17 重建，都带错误哈希），
   别拿 `dist` 当发布源；线上那份正确的补丁在 `/opt/sp2/public/client/windows-1.2.7-to-1.2.8.zip`。
3. `-r2.zip` 仍留在线上（未被清单引用），可作参考，但它对真实用户是坏的。
4. 备份：`stronghold-app/release/latest.json.bak-before-revert-*`、
   服务器 `/opt/sp2/backups/manifest-fix-*/`。

## 2026-10-11 18:0x AstrBot 战绩插件：两个问题（已修复）

**① 命令参数被别的插件污染 → 一律回「暂无完整对局战绩」**

真因不是数据空、不是渲染空、不是网络不通（三层都验过：接口 401 条记录、卡片实渲 142 KB、容器内 HTTP 200）。
而是 **`astrbot_plugin_qq_tools` 开了「在消息末尾附加消息 ID」**，给每条消息末尾加 `[MSG_ID:702984718]`：

```
用户发: @黍 战绩 鱼梦 [MSG_ID:702984718]   ← qq_tools 加的尾巴
插件取到: "鱼梦 [MSG_ID:702984718]"        ← 整串当账号名去查
→ RECORD_NOT_FOUND → 回复「账号「鱼梦 [MSG_ID:702984718]」暂无完整对局战绩。」
```

**修法**：main.py 加 `INJECTED_MARKER` + `strip_markers()`，在 `group_record` / `private_password` 取到文本与参数后各剥一次
（覆盖 MSG_ID / REPLY / AT / IMAGE / FACE），不依赖对方插件的配置。7 条真实日志样本全过。

**② 改成合并转发**（用户要求）：一局 4 人 5~9 张图，直接连发刷屏。现在包成一条 QQ「聊天记录」卡片。

```python
nodes = [Node(content=[Image.fromBase64...], name="战绩总览", uin=self_id)]  # 每条一个 Node
yield event.chain_result([Nodes(nodes)])                                    # 整包一个 Nodes
```

- 适配器只对 `Node`/`Nodes` 走 `send_group_forward_msg`，且 `Nodes.to_dict()` **把图片转 base64**
  —— 合并转发不能传本地路径。已用真实数据验证（69541 字符的 base64 前缀）。
- 明细标题按 `P<座位>-<页>.png` 解析成「P1 名字」，多页加「(2/3)」，AI 加「（AI）」。
- 插件的取数顺序：**先按账号名查 → 404 再按房间号查**（房间号 = 4 位大写字母、不含 I/O）。

## 2026-10-11 18:1x 进行中：B站官号视频/动态推送（新功能）

**需求**：现有 `astrbot_plugin_arknights_news` 只抓官网公告，要**增加**抓 B站明日方舟官号
（`space.bilibili.com/161775300`）的**视频**与**动态**。

| 内容 | 形式 | 配文 |
|---|---|---|
| 新视频 | yt-dlp 下载 + ffmpeg 合并后发到群 | `@全体成员 明日方舟官方发布新视频啦！一起来看看吧~` |
| 新动态 | 卡片；带图则卡片+原图**合并转发** | `明日方舟官方B站上有新的动态发布，看看说了些什么吧~` |

**用户已拍板（不要改）**：① @全体**只用于视频**，动态不 @（官号每天好几条动态，全 @ 会被嫌吵）
② 视频上限 **10 分钟 / 200MB** ③ **超限的视频改发卡片+原链接**（不下载）。

**技术可行性全部实测确认**（2026-10-11，容器内）：

```
✅ yt-dlp 2026.08.19 列投稿：--flat-playlist --playlist-end 5 --dump-json "https://space.bilibili.com/161775300/video"
   → 拿到真实 BV 号（BV1NmpG6uEar / BV1Gmpu6rE4w / …）
✅ 动态 API：GET https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space
   ?host_mid=161775300&timezone_offset=-480&platform=web   → code=0，13 条
✅ 视频详情：GET https://api.bilibili.com/x/web-interface/view?bvid=<BV>  → code=0（标题/时长/UP）
✅ cookies 有登录态：/AstrBot/data/plugins/astrbot_plugin_yt_dlp/cookies.txt
   （SESSDATA 222 字符 / bili_jct / DedeUserID / buvid3）

❌ 裸 API 请求会 412 风控（必须 cookie jar + 浏览器头：UA/Referer/Origin/Accept）
❌ /x/space/arc/search 老接口 → -799 请求过于频繁
❌ /x/space/wbi/arc/search 即使正确 WBI 签名 → 412 request was banned
❌ rsshub.app → 服务器访问不了（30 秒超时）
```

**字段路径（实测）**：`item["id_str"]` 去重键；`item["type"]` = DYNAMIC_TYPE_DRAW / _AV；
`modules.module_author.pub_ts`（**字符串，要 int()**）与 `.name`；`modules.module_dynamic.desc.text`（官方号常为空）；
`major["type"]` = MAJOR_TYPE_DRAW / _ARCHIVE；配图 `major["draw"]["items"][i]["src"]`（**http:// 要换 https**）；
视频投稿 `major["archive"]["bvid"]/["cover"]/["title"]`。

**完整规格书**：`F:\DSH-workspace\_bili_probe\SPEC.md`（含配置项、集成方式、验收标准、已知坑）。
**执行中**：共享任务 `task-1`，负责人 teammate `bili-push-dev`。

### 2026-10-11 19:1x B站动态推送的关键加固：长图 payload（Lead 补做）

**问题**：AstrBot 的 `Node.to_dict()` 会把合并转发里的图片**整张转成 base64**，且**没有任何压缩/限流**
（`astrbot/core/message/components.py:676` 就是 `f"base64://{bs64}"`）。B站官号的「长图」动态
（实测一条 `1000x16383` 的公告长图，原图 16.9MB）base64 后约 **31MB**，单个 OneBot JSON 请求体
这么大很容易被协议端拒收/超时 —— 表现就是「日志说推送成功，但群里看不到」。

**实测对比**（同一条长图动态，加保护前后）：

```
加固前: 原图 1000x16383 PNG 16.9MB  → base64 约 31MB
加固后: 压到 500x8192   JPEG  1.05MB → base64 约 2MB（宽高比保持一致，长图内容仍可读）
普通动态（4 张 ~0.8MB 的图）: payload 3.4MB —— 本来就没问题，不触发压缩
```

**实现**：`main.py` 新增 `_bili_shrink_for_forward()`，在 `_bili_download_image` 返回前调用；
阈值 `BILI_FORWARD_MAX_HEIGHT = 8192` / `BILI_FORWARD_MAX_WIDTH = 1600`。
只压缩**确实超阈值**的图（小图原样返回，不重编码、不改格式）；
**任何压缩失败都退回原路径** —— 宁可发原图，也不要因为压缩把整条动态搞失败。

**注意**：这是 Lead 在 teammate 验收之后补的加固，建议下次动这块代码时一并回归。

### 2026-10-11 19:2x 用户确认：B站视频与动态推送全部成功

用户在群里亲自验证后回复「全都成功」—— 包含此前唯一未能由服务器侧验证的环节：
**动态的合并转发卡片在 QQ 里的真实渲染**（卡片 + 动态原图，不带 @全体）。

至此这条链路的每一段都有实测证据：

```
抓取      ✅ 动态 13 条（含图 9 条）/ 视频 15 个，登录态 isLogin=True uname=Sav_Rounds
视频推送  ✅ 用户真机测通：已推送视频 bvid=BV1NmpG6uEar 体积 35.2MB → 机器人回「视频测试推送成功」
动态推送  ✅ 用户真机确认群里可见（合并转发卡片 + 原图）
去重      ✅ 跨 5 次重启基线稳定 13/15，不重复推送
配置开关  ✅ 11 个 bili_* 全部落位且被代码真正读取
失败隔离  ✅ _check_loop 内 0 处 bili 引用；改坏 mid 后官网公告照常推送
长图加固  ✅ 16.9MB→1.05MB，payload 31MB→1.5MB；4 个边界用例全过
```

## 2026-10-11 22:xx 浏览器公告：网页版停止支持（已上线）

**需求**：服务器带宽 6 Mbps 常被打满（详见 `docs/briefing-2026-10-11-bandwidth.md`），
不再支持浏览器游玩，引导进群下载客户端。**绝不能影响客户端用户。**

**为什么不能「直接把 / 换成静态公告页」**（评估过，会出事故）：

```
windows/Program.cs:349   Navigate(GameUrl)        ← 客户端也向服务器要页面
bundle/ 里只有 index.json（6126 KB，资源索引），【没有 index.html】
android/BundledAssets    assets.open("index.json")  ← 同样只有资源
```

客户端靠「资源走本地 bundle」省流量，但 **index.html 与 JS 仍必须从服务器取**。
把 `/` 换成静态页会把客户端一起废掉。所以必须按 UA 区分 —— 这正是现方案做的事。

**实现**（都只作用于浏览器用户）：

| 文件 | 改动 |
|---|---|
`public/js/ui/notice.js`（新） | `noticeDecision()` / `installBrowserNotice()`：判断该不该弹，关闭后按版本记住 |
`public/js/main.js` | boot 里调用 `installBrowserNotice()` |
`public/index.html` | 公告文案改为「带宽限制不再支持网页游玩 + 进群 1124360673 + 实时了解更新」；关闭按钮加 `data-notice-dismiss` |

**客户端识别**复用已有的 `isNativeClient()`（`screens/title.js:89`）：
`/SPClient\/(?:Windows|Android)|; wv[);]/i` 或 `chrome.webview`。
UA 由 `windows/Program.cs:220`（` SPClient/Windows`）与 `android/MainActivity.java:111`（` SPClient/Android`）设置。

**安全取向是单向的**：客户端看到「浏览器版停用」= 严重误导（绝不允许）；浏览器漏看到只是少个提示（可接受）。
所以 `; wv` 这类 WebView 也算客户端 —— 宁可漏，不给错的。

**测试**：
- `test/ui/browser-notice.test.js`（15 项）：判断逻辑 + 接线静态检查（main.js 是否真的 import/调用、关闭标记、默认 hidden）
- `test/ui/browser-notice.e2e.test.js`（5 项，真浏览器）：浏览器看到、关掉刷新不再弹、
  **Windows/Android 客户端 UA 绝不弹**、关掉后标题页照常
- **线上实测**：浏览器 true / Windows 客户端 false / Android 客户端 false，客户端标题页正常

**踩过的坑（测试写法）**：
1. e2e 必须用 `waitUntil: networkidle0`；用 `domcontentloaded` 会在 app 渲染出标题页之前就往下走 → 假失败。
2. 同一 browser 实例的各测试**共享 localStorage**：前一个测试关掉公告留下的标记会让后一个测试等一个永远不弹的公告。
   `open()` 里加 `fresh: true` 先 `localStorage.clear()` + reload。
3. **`node --test` 会把多个文件跑在同一进程**：e2e 用 `process.exit` 会误杀别的文件，别加。

**连带影响**：全屏公告会盖住整屏拦截点击，既有 e2e 需要先关公告再操作标题页 ——
已给 `settings-entry.e2e.test.js`、`text-scale.e2e.test.js` 补上这一步。


## 2026-10-11 23:3x AstrBot「无法创建新的对话」：数据库隐私触发器（已修复）

**症状**：机器人对任何消息都回 `Error occurred while processing agent: 无法创建新的对话。`
（异常来自 `astr_main_agent.py:285` 抛的 `RuntimeError`）

**根因**：`/AstrBot/data/data_v4.db` 里有 **22 个人为加装的触发器**，用 `RAISE(IGNORE)` **静默丢弃写入**：

```sql
CREATE TRIGGER "privacy_no_conversation_insert"
  BEFORE INSERT ON "conversations" BEGIN SELECT RAISE(IGNORE); END
```

→ ORM 的 INSERT 被吞掉（**不报任何错**）→ `ConversationV2` 永远写不进库 →
`get_conversation` 读不到 → 抛「无法创建新的对话」。

**排查路径**（每一步都有证据，别重复走）

| 检查 | 结果 |
|---|---|
AstrBot 源码 / 全部 18 个插件里的 `CREATE TRIGGER`、`RAISE(`、`executescript` | **0 命中** —— 不是官方、也不是插件装的 |
文件系统可写性 / `integrity_check` / `journal_mode` / bind mount | 全部正常 |
另一张表（`_wtest`）写入 | 正常 —— 证明**只有带触发器的表**拒写 |
升级前备份 `upgrade-4.28.1/data-before-style-memory-20260927.db` | **同样 22 个触发器 → 升级不是元凶** |
11 张被拦的表里 10 张是 0 行 | 触发器唯一实际作用就是「让这些表永远是空的」 |

**为什么 9-27 就有了触发器、现在才坏**：AstrBot 把对话存储从 JSON（`shared_preferences`）
迁到了数据库（`preferences` 里能看到 `migration_done_webchat_session_1`、`migration_done_token_usage_1`）。
**升级是导火索，不是原因。**

**一个容易漏掉的二次伤害**：`preferences` 表也被拦，而它存的是 AstrBot 的系统数据 ——
`migration_done_*`、`abconf_mapping`、`umop_config_routing`、`plugin_install_sources`。
所以触发器不只在挡聊天记录，还在破坏 AstrBot 自己的状态。

**修复**：删除全部 22 个 `privacy_no_*` 触发器 + 重启 AstrBot。
实测走真实路径 `ConversationManager.new_conversation()` → **建会话 + 读回成功**，库中落 1 行。

**备份与回滚**：`/opt/astrbot/backups/db-privacy-issue-20261011_231956/`
（`data_v4.db` 完整备份 + `privacy_triggers.sql` 22 条原始 SQL）。
重建触发器：

```bash
docker exec astrbot python3 -c "import sqlite3; c=sqlite3.connect('/AstrBot/data/data_v4.db'); c.executescript(open('/tmp/privacy_triggers.sql').read()); c.commit()"
```

**如果以后真的需要「不记录对话」**：用正规开关，别用触发器 ——
`astrbot_plugin_emotionai_pro` 有 `PrivacyLevel` 与 `隐私级别` 命令；
`astrbot_plugin_simple_long_memory` 有 `purge`（按 `deprecated_at + N 天` 物理删除）。
触发器是从数据库底层把功能直接掐死，代价是机器人哑掉。


## 2026-10-12 02:5x 客户端 1.2.9 发布（已上线）

**结果**：清单 `latest.json` sha256 = `d8cc4223c0f92df6d367b4b1f9beb9440e99d3fb9b4fa097e1c082d02e4f8e02`，
两端 `versionCode = 12`、`version = 1.2.9`，独立端到端校验通过（公网取件 → 公钥验签 → 逐个补丁核哈希）。

### 一、修掉的 bug：Windows `ClientVersionCode` 没跟着升

`windows/Program.cs` 里：

```csharp
internal const string ClientVersion = "1.2.9";      // ← 改了
private const int ClientVersionCode = 11;           // ← 忘了改，应为 12
```

它有两处用途，都对不上：

```csharp
L246: if (releaseInfo?.VersionCode > ClientVersionCode) …   // 判断"有新版本"
L282: releaseInfo?.Patches.FirstOrDefault(item => item.From == ClientVersionCode)
```

后果：装完 1.2.9 的客户端内部仍是 11 → **反复提示更新**；且用 11 去找补丁，
而 1.2.9 的补丁 `from` 是 11 → 侥幸能匹配，但语义错位会随下个版本爆掉。

**修法**：`ClientVersionCode` 改 12 → 重建（`dotnet publish` + NSIS）→ 重新生成补丁。
证据：重建后 `StrongholdProtocol.dll` 哈希由 `69b1532b…` 变为 `cb490e32…`（即 versionCode 已编入）。
（`.exe` 哈希不变是正常的 —— 它是宿主，不含该常量。）

### 二、关键概念：`from` 是"补丁期望的客户端版本号"，不是目标版本号

```json
{ "from": 11, "url": "…/windows-1.2.8-to-1.2.9.zip" }
```

`1.2.8-to-1.2.9` 的补丁 `from` 必须是 **11**（1.2.8 的 code），因为客户端是拿
**自己当前的 code** 去 `FirstOrDefault(item => item.From == ClientVersionCode)`。
所以清单里 `versionCode: 12` 与补丁 `from: 11` 并存是**正确的**，不是笔误。

Android 不同：用 `baseSha256` 匹配**当前 APK 的 sha256**（`ReleaseInfo.patchFor()`）。

### 三、发布流程（实测可用）

1. 版本号：`windows/StrongholdProtocol.csproj`、`windows/Program.cs`（**两个常量**）、
   `windows/installer.nsi`（OutFile + VIProductVersion）、`android/AndroidManifest.xml`（versionCode + versionName）
2. 构建：`pwsh -File scripts/build-windows.ps1`（内含 `verify-bundle.cjs` 资源校验）
3. 补丁：
   - Windows `node scripts/make-windows-patch.mjs <旧版完整树> <dist/windows-client> <out.zip>`
     —— 两个目录都必须是**完整客户端树**，否则会把已存在的文件记成"新增"
   - Android `node scripts/make-apk-patch.mjs <旧APK> <新APK> <out.patch.gz>`（自定义 `SPPATCH1` 格式，头部含基准二进制 sha256）
4. 写 `release/latest.json` → `pwsh -File scripts/sign-release.ps1` → **每改一次清单都要重签**
5. 上传顺序（README 要求）：补丁先落位并逐个核对哈希 + HTTPS 200，**最后**上传 `latest.sig` 和 `latest.json`
6. 部署前备份：`/opt/sp2/backups/client-129-<timestamp>/`

### 四、踩过的两个坑（都别再踩）

**坑 1：清单里的哈希必须用【线上实测值】，不能用本地 `dist` 的。**
`windows-1.2.7-to-1.2.8.zip` 本地是 `a0269c19…`（Codex 重建过的坏版本），
线上可用的是 `6928efb2…`。用本地哈希写清单 = 用户更新失败（2026-10-11 那次事故的同款）。

**坑 2：CDN 的 `index.json` 会滞后，不能当"文件是否存在"的依据。**
用它对账算出 1197 个素材"缺失"，逐条 `HEAD` 实测后发现 **100% 都在**。
判定一律用 HEAD 实测（对方文档《素材 CDN 对账》也是这么写的）。

### 五、本次发布的用户侧约定

- **只发增量补丁，不发完整包**（用户明示）。完整包走 QQ 群分发。
- 下载页/完整包保持关闭：`/client`、`/client/`、`/client/index.html` 及所有完整安装包 → **HTTP 410**。
- 仍可达的只有：`latest.json`、`latest.sig`、`*.patch.gz`、`windows-*.zip`。
- 清单里已移除 `apkSha256` 字段（`ReleaseInfo.java` 只读取不使用，无下载回退逻辑，故可省）。

**补丁矩阵（当前线上）**

| 平台 | 路径 | 基准 |
|---|---|---|
Android | `1.2.8-to-1.2.9.patch.gz` | APK `645de666…` |
Android | `1.2.7-to-1.2.8.patch.gz` | APK `aa16afe3…` |
Android | `1.2.6-to-1.2.8.patch.gz` | APK `1cd2595a…` |
Windows | `windows-1.2.8-to-1.2.9.zip` | code 11 |
Windows | `windows-1.2.7-to-1.2.9.zip` | code 10 |
Windows | `windows-1.2.6-to-1.2.8.zip` | code 9 |

**注意**：Android 1.2.6/1.2.7 用户只能走到 1.2.8（没有直达 1.2.9 的 APK 补丁）；
Windows 1.2.6 用户走 `1.2.6→1.2.8→1.2.9` 两跳。需要直达补丁时再生成。

**未做**：完整安装包未上传到服务器（用户要求）；因此 `latest.json` 不能声明完整包哈希。

### ④ 已知遗留的 3 个测试失败（**非本次会话引入**）

`test/render/unitview.test.js`：
- `operators show level and equipment only during preparation`
- `tier chips`

来自**另一个会话未提交的** `public/js/render/units.js` 改动：`clamp(s * 0.34, 27, 32)` → `_sizeTierChip()`（徽章按格子大小自适应）。**线上已跑这个新逻辑**。收尾需要先判断新行为是否是想要的，再把断言同步过去 —— 这是产品决策，不要替用户拍板。

**验证方法**：`git stash push -- public/js/render/units.js` 后重跑，若失败依旧，就证明与我的改动无关（本次会话已这样证明过）。

## 关键工具与约定

| 工具 | 用途 |
|---|---|
`scripts/cdp-measure.mjs` | 用 Edge DevTools 协议量元素矩形（不依赖 playwright） |
`scripts/verify-local-api.mjs` | 用真实数据副本起本地服务器，验证 HTTP 接口（不碰线上） |
`test/render/deploy-landing.test.js` | 休整期落格动作（Start clip） |
`test/render/highlight-dispose.test.js` | 高亮层生命周期（锁住那次崩溃） |

**部署流程（本次会话一直用的、可靠的那套）**：
1. 备份到 `/opt/sp2/backups/<名字>-<时间戳>/`
2. `scp` 上传到 `/tmp/<临时名>`（**不要用 base64 当命令行参数** —— 超 Windows 命令行长度上限会静默失败）
3. 远端 `sha256sum` 与本地比对，**不一致就中止不落位**
4. `mv` 落位 + `chown sp2:sp2` + `chmod 644`
5. `nginx -t && systemctl reload nginx`
6. **经 HTTP 取回再算一次哈希**（最终判据）

**教训**：本会话我因为"根据代码推断就下结论"错了两次（`deployRoles` 假根因、`zoom` 用 `getBoundingClientRect` 测不出）。**涉及视觉效果或运行时行为的判断，必须测量或真机验证。**

## 服务器速查

| 项 | 值 |
|---|---|
| 正式服 | `https://sp.bs.leio.fun`（jing `101.34.203.126`，`/opt/sp2`，`:3810`）|
| 兼容别名 | `https://sp2.bs.leio.fun`（与正式服**同一后端进程**）|
| SSH | `ssh -F F:/DSH-workspace/ssh-leio-config jing`（必须带 `-F`）|
| 战绩/账号数据 | `/var/lib/sp2/match-records.jsonl`、`/var/lib/sp2/accounts.json` |
| nginx 静态规则 | `/etc/nginx/snippets/stronghold-static.conf`（`/client/*.apk|exe` 返回 410，走 QQ 群分发）|
| AstrBot | leioserver（`10.0.0.2`），容器 `astrbot`，插件 `astrbot_plugin_sp_records` |
| AstrBot 启用群 | `1124360673`、`907380765`（白名单）|

**查询战绩接口**：`GET /api/records/account/<账号名>`（账号名 → playerId → 最近一局）
**改密码接口**：`POST /api/account/password`（需 `X-SP-Admin-Token` + 旧密码；令牌在 `sp2.service` 的 `SP_ADMIN_TOKEN`）
