# astrbot_plugin_sp_announce — 卫戍协议公告发布

维护者在 QQ 里**私聊**机器人，用「草稿 → 预览 → 发布」三步发一条全服公告。发布走游戏服的**窄令牌**接口：
这个令牌只能新增公告，拿不到踢人、改密码、删公告的权限（那是 `SP_ADMIN_TOKEN` 的事，本插件不碰）。

## 命令（仅维护者私聊）

| 命令 | 作用 |
| --- | --- |
| `公告草稿 <标题>` | 新建草稿，回一个 6 位草稿 ID |
| `公告正文 <ID> <正文>` | 填写/覆盖 Markdown 正文（可多行，一条消息发完） |
| `公告预览 <ID>` | **完整**回显标题 + 正文（不截断）+ 指纹 |
| `公告发布 <ID>` | 发布；只有「预览后没再改过」才允许 |
| `公告取消 <ID>` | 丢弃草稿 |
| `公告列表` | 我的未发布草稿 |
| `公告帮助` | 命令说明 |

发布成功后插件会回读一次线上公告（`GET /api/announcements/<id>`）并把标题贴回来，确认真的写进去了。

## 安全设计

- **只认白名单**：`allowed_senders` 里的 QQ 号才能用；留空 = 谁都不能用（不是「未配置就所有人可用」）。
- **默认只私聊**：群聊要同时满足 `allow_group`、群号在 `allowed_groups`、并且 @ 了机器人。
- **窄令牌**：`announce_token` 与游戏服 `SP_ANNOUNCE_TOKEN` 一致；它只能发公告。
- **草稿只在内存**：不落盘（重启即清空），30 分钟过期，最多 20 条，超出淘汰最旧。
- **预览即批准**：发布时比对指纹，预览之后又改过正文必须重新预览 —— 避免"看的是 A、发出去的是 B"。
- **一次性消费**：一条草稿发布成功后立即作废，重复发布会报「找不到草稿」。
- **节流**：同一发送者 4 秒内只能有一个写操作。

## 安装（leioserver 上的 AstrBot）

宿主路径 `/opt/astrbot/data/plugins/`（容器内是 `/AstrBot/data/plugins/`）：

```bash
# 1) 拷插件（本仓库 integrations/ 下的目录名必须与 metadata.yaml 的 name 一致）
docker cp astrbot_plugin_sp_announce astrbot:/AstrBot/data/plugins/
# 2) 在 AstrBot WebUI → 插件管理 → 配置里填 allowed_senders 与 announce_token
# 3) 重载插件（WebUI「重载插件」或重启容器）
docker restart astrbot
```

游戏服一侧需要（0.2.7 起，见 `docs/tasks/TASK-049-astrbot-announcement-publisher.md`）：

```
# /etc/systemd/system/sp2.service.d/announce.conf
[Service]
Environment=SP_ANNOUNCE_TOKEN=<一串至少 16 位的随机字符串>
```

改完 `systemctl daemon-reload && systemctl restart sp2`。没配这个变量时，`POST /api/admin/announcements/publish`
一律 404（接口等于不存在），插件也会明确告诉你"令牌还没配置"。

## 依赖

只用 AstrBot 自带的 `aiohttp`（以及 `astrbot.api`）；无需额外安装包。

## 文件

- `main.py` — 命令、鉴权、HTTP 调用
- `drafts.py` — 内存草稿仓（含指纹与一次性消费逻辑）
- `metadata.yaml` / `_conf_schema.json` — AstrBot 插件元数据与配置项
