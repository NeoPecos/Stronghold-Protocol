# 卫戍协议 · AstrBot 机器人集成

给群里加两条命令：

| 场景 | 命令 | 说明 |
|---|---|---|
| 群聊 | `@黍 战绩 <账号名>` | 发该账号最近一局的战绩卡片（总览 + 每人明细）。也支持 4 位房间号 |
| 私聊 | `改密码 <账号名> <旧密码> <新密码>` | 改游戏账号密码。**必须提供旧密码**；因涉及密码，只在私聊响应 |

插件本体在 `astrbot_sp_records/`（`main.py` 事件与网络、`card.py` 用 PIL 画图、`_conf_schema.json` 配置面板）。

## 依赖

* 游戏服要跑**带这两个接口的版本**（见下）。接口在 `server/http/routes.js`：
  * `GET  /api/records/account/<账号名>` —— 账号名 → `playerId` → 该账号最近一局
  * `POST /api/account/password` —— 改密码，需要管理员令牌 **且** 提供旧密码
* AstrBot 侧：`Pillow`（画图）与一个中文字体。容器已自带 `Pillow 12.3.0` 与 `wqy-zenhei.ttc`。

## 一、游戏服：开启改密码接口

改密码接口**默认不存在**（未配置令牌时返回 404），这是有意的：不配置就一点都不多暴露。

在 `sp2.service` 的 `Environment=` 段加一行（令牌**至少 16 字符**，短于 16 会在启动时被拒绝并保持关闭）：

```ini
Environment=SP_ADMIN_TOKEN=<你的长随机令牌>
```

```sh
systemctl daemon-reload && systemctl restart sp2.service
```

> **重启会断开正在进行的对局。** 请在没有对局时操作；`ops/deploy-production.sh --check-only` 会返回
> `Production idle; build …`，有对局时它会拒绝并说明原因。

只读战绩不需要令牌，也不用改任何配置。

## 二、AstrBot：装插件

把 `astrbot_sp_records/` 整个目录放到 AstrBot 的插件目录（Docker 部署通常是
`/opt/astrbot/data/plugins/`，容器内为 `/AstrBot/data/plugins/`），然后在面板里重载插件。

不要拷贝 `__pycache__/`（本地 Python 版本编出来的字节码，与容器无关）。

## 三、插件设置（面板里改，不用动代码）

| 配置项 | 默认 | 说明 |
|---|---|---|
| `enabled_groups` | 空 | **启用战绩的群号**，一行一个或逗号分隔。**留空 = 所有群启用** |
| `group_mode` | 白名单 | 白名单：只有名单里的群能用；黑名单：名单里的群不能用 |
| `require_at` | 开 | 必须 @机器人 才触发，避免群里闲聊误触发 |
| `cooldown_seconds` | 5 | 单群冷却，防刷屏 |
| `record_base_url` | `https://sp.bs.leio.fun` | 游戏服地址 |
| `allow_code_lookup` | 开 | 同时支持按 4 位房间号查 |
| `password_change_enabled` | 开 | 私聊改密码开关 |
| `admin_token` | 空 | **必须与游戏服 `SP_ADMIN_TOKEN` 完全一致**，否则改密码失败。等同于管理员权限，不要截图外发 |
| `verbose` | 关 | 排查问题时打开，日志里会打印群号与结果（不打印密码） |

## 四、自测

```sh
# 纯逻辑（正则解析、群启用判断）——不需要 astrbot 运行时
python3 astrbot_sp_records/check_logic.py

# 端到端（在 AstrBot 容器里跑）：真实取战绩 + 真实出图 + 接口防护
docker cp astrbot_sp_records/check_e2e.py astrbot:/tmp/check_e2e.py
docker exec -i astrbot python3 /tmp/check_e2e.py
```

服务端接口的验证脚本在 `../../scripts/verify-local-api.mjs`，用**真实数据副本**起一个本地服务器打真实 HTTP 请求，
不会碰线上：

```sh
node scripts/verify-local-api.mjs <含 accounts.json 与 records.jsonl 的目录> 3931
```

## 五、安全说明（为什么这样设计）

* **改密码必须给旧密码**：这是账号归属的唯一证明。只凭账号名就能改的话，任何知道昵称的人都能顶掉别人的账号。
* **只在私聊**：群里出现的 `改密码 …` 文本一律忽略，避免密码在群里可见。
* **令牌双重校验**：游戏服要求 `X-SP-Admin-Token` 匹配，插件侧也要配同一个值；两边任一没配就不可用。
* **不泄露身份**：未知账号与密码错误返回同一个 `BAD_CREDENTIALS`，避免被用来枚举账号是否存在。
* **不记录密码**：插件与服务端都不把密码写进日志或响应；响应只有 `{ok, name}`。
