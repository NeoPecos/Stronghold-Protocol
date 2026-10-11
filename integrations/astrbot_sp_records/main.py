"""astrbot_plugin_sp_records — 卫戍协议战绩卡片 + 私聊改密码。

两条命令，一条只走群、一条只走私聊：

* 群聊 `@黍 战绩 <账号名>` → 取该账号最近一局，发总览图 + 每人明细图。只在配置里启用的群生效。
* 私聊 `改密码 <账号名> <旧密码> <新密码>` → 调游戏服的改密码接口。**必须提供旧密码**：这是唯一的持有证明，
  否则任何知道昵称的人都能顶掉别人的账号；也正因为要打密码，这条命令只在私聊响应，群里的同类文本一律忽略。

战绩来自游戏服的 `GET /api/records/account/<名字>`（账号名 → playerId → 记录），改密码走
`POST /api/account/password`，两者都在 `server/http/routes.js` 里；改密码还需要游戏服配置了 `SP_ADMIN_TOKEN` 且
与本插件 `admin_token` 一致，否则接口返回 404/401，这里会翻译成人话。

渲染见 card.py（PIL 画图，不依赖浏览器）。
"""

import asyncio
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from uuid import uuid4

from astrbot.api import logger
from astrbot.api.event import AstrMessageEvent, filter
from astrbot.api.message_components import At, Image, Node, Nodes, Plain
from astrbot.api.star import Context, Star, register

from .card import render_card, render_detail_cards

# 战绩：把账号名或房间号放在「战绩/结算」前后都认。账号名可能含空格以外的任意字符，所以只取到行尾/分隔符。
RECORD_REQUEST = re.compile(r"(?:战绩|结算)\s*[:：]?\s*(.+?)\s*$|^\s*(.+?)\s*(?:的战绩|战绩|结算)\s*$")
CODE_ONLY = re.compile(r"^[A-HJ-NP-Za-hj-np-z]{4}$")
# 改密码：账号名与两个密码都用空白分隔，账号名不含空格（注册时就允许空格的话这里要改成引号形式）
PASSWORD_REQUEST = re.compile(r"^\s*(?:改密码|修改密码|重置密码)\s+(\S+)\s+(\S+)\s+(\S+)\s*$")

# 别的插件会往消息文本里塞标记，最典型的是 astrbot_plugin_qq_tools 的「在消息末尾附加消息 ID」
# （配置 context_enhance.show_message_id）：每条消息末尾自动加 [MSG_ID:702984718]。
# 那串东西会跟着命令参数一起被当成账号名 —— 线上就是这样：查「战绩 鱼梦」变成查
# 账号「鱼梦 [MSG_ID:702984718]」，必然 RECORD_NOT_FOUND，用户看到的是"暂无完整对局战绩"
# （2026-10-11 排查确认）。所以取到参数后先把这类注入标记剥掉，不依赖对方插件的配置。
INJECTED_MARKER = re.compile(r"\s*\[(?:MSG_ID|REPLY|AT|IMAGE|FACE)\s*:[^\]]*\]", re.IGNORECASE)


def strip_markers(text: str) -> str:
    """去掉其它插件注入到消息文本里的 [MSG_ID:…] 之类标记，再交给后面的解析。"""
    return INJECTED_MARKER.sub("", str(text or "")).strip()

CARD_DIR = Path("/tmp/astrbot-sp-records")
DEFAULT_BASE_URL = "https://sp.bs.leio.fun"
MAX_BODY = 65536
ERROR_TEXT = {
    "BAD_CREDENTIALS": "账号名或旧密码不对。",
    "WEAK_PASSWORD": "新密码太短：至少 8 位，不能含控制字符。",
    "SAME_PASSWORD": "新密码和旧密码一样，没有改动。",
    "UNAUTHORIZED": "改密码接口拒绝了这次请求（令牌不匹配），请联系维护者。",
    "NOT_ENABLED": "游戏服没有开启改密码功能，请联系维护者。",
    "BAD_REQUEST": "请求格式不对，请检查账号名与密码里有没有奇怪字符。",
    "TOO_LARGE": "请求内容过大。",
}


def _http_json(url, *, method="GET", payload=None, token=None, timeout=8):
    """一次 JSON 请求。非 2xx 抛 HTTPError 交给调用方翻译，响应过大抛 ValueError。"""
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["X-SP-Admin-Token"] = token
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read(MAX_BODY + 1)
    if len(body) > MAX_BODY:
        raise ValueError("响应过大")
    return json.loads(body)


def fetch_record_by_account(base_url, name):
    url = f"{base_url.rstrip('/')}/api/records/account/{urllib.parse.quote(name)}"
    return _http_json(url)


def fetch_record_by_code(base_url, code):
    url = f"{base_url.rstrip('/')}/api/records/{code}"
    record = _http_json(url)
    if record.get("code") != code.upper() or not isinstance(record.get("players"), list):
        raise ValueError("战绩数据无效")
    return record


def change_password(base_url, token, name, old_password, new_password):
    url = f"{base_url.rstrip('/')}/api/account/password"
    return _http_json(url, method="POST", token=token, payload={
        "name": name, "oldPassword": old_password, "newPassword": new_password,
    })


def _as_lines(value):
    """配置里的多行文本/列表 → 字符串集合。群号既支持一行一个，也支持逗号、顿号、空格分隔。"""
    if value is None:
        return set()
    if isinstance(value, (list, tuple, set)):
        items = value
    else:
        items = re.split(r"[\s,，、;；]+", str(value))
    return {str(item).strip() for item in items if str(item).strip()}


@register("astrbot_plugin_sp_records", "Leiothrix", "卫戍协议：战绩卡片（群，合并转发）与改密码（私聊）", "1.2.0")
class StrongholdRecords(Star):
    def __init__(self, context: Context, config: dict | None = None):
        super().__init__(context)
        config = config or {}
        self.config = config

        self.enabled = bool(config.get("enabled", True))
        self.groups = _as_lines(config.get("enabled_groups"))
        self.group_mode = str(config.get("group_mode", "白名单") or "白名单").strip()
        self.require_at = bool(config.get("require_at", True))
        self.cooldown = max(0, int(config.get("cooldown_seconds", 5) or 0))
        self.base_url = str(config.get("record_base_url", DEFAULT_BASE_URL) or DEFAULT_BASE_URL).strip() or DEFAULT_BASE_URL
        self.allow_code = bool(config.get("allow_code_lookup", True))
        self.password_enabled = bool(config.get("password_change_enabled", True))
        self.admin_token = str(config.get("admin_token", "") or "").strip()
        self.password_cooldown = max(0, int(config.get("password_cooldown_seconds", 30) or 0))
        self.verbose = bool(config.get("verbose", False))

        self._last_group_use = {}   # 群号 → 时间戳
        self._last_user_use = {}    # 用户 id → 时间戳

    # ---------- 群启用判断 ----------

    def group_allowed(self, group_id):
        """按配置决定这个群能不能用。名单为空时：白名单=不过滤（全部启用），黑名单=也全部启用。"""
        if not self.groups:
            return True
        listed = group_id in self.groups
        return listed if self.group_mode == "白名单" else not listed

    def _cooling(self, table, key, seconds):
        if seconds <= 0:
            return False
        now = time.time()
        last = table.get(key, 0)
        if now - last < seconds:
            return True
        table[key] = now
        # 顺手清理，避免长期运行后字典无限增长
        if len(table) > 4096:
            for stale in [k for k, t in table.items() if now - t > 3600]:
                table.pop(stale, None)
        return False

    # ---------- 群聊：战绩 ----------

    @filter.event_message_type(filter.EventMessageType.GROUP_MESSAGE)
    async def group_record(self, event: AstrMessageEvent):
        if not self.enabled:
            return
        text = strip_markers(event.get_message_str())
        match = RECORD_REQUEST.search(text)
        if not match:
            return
        target = strip_markers(match.group(1) or match.group(2)).strip("@")
        if not target:
            return
        group_id = str(event.get_group_id() or "")
        if not self.group_allowed(group_id):
            if self.verbose:
                logger.info(f"[卫戍战绩] 群 {group_id} 未启用，忽略")
            return
        if self.require_at and not self._mentions_bot(event):
            return
        if self._cooling(self._last_group_use, group_id, self.cooldown):
            return
        event.stop_event()
        try:
            record = await self._lookup(target)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                hint = f"房间 {target.upper()} " if CODE_ONLY.match(target) else f"账号「{target}」"
                yield event.plain_result(f"{hint}暂无完整对局战绩。")
            else:
                logger.warning(f"[卫戍战绩] 请求失败 {error.code}: {target}")
                yield event.plain_result("暂时无法读取战绩，请稍后重试。")
            return
        except Exception as error:  # noqa: BLE001 — 任何异常都只回一句人话，细节进日志
            logger.error(f"[卫戍战绩] {type(error).__name__}: {error}")
            yield event.plain_result("暂时无法读取战绩，请稍后重试。")
            return

        try:
            request_dir = CARD_DIR / f"{record['id']}-{uuid4().hex[:8]}"
            overview = await asyncio.to_thread(render_card, record, request_dir / "overview.png")
            details = await asyncio.to_thread(render_detail_cards, record, request_dir)
            self._cleanup_cards()
            label = f"账号「{target}」" if record.get("code") else target
            suffix = f"房间 {record.get('code', '----')} · 第 {record.get('matchNo', '?')} 局"
            players = record.get("players") or []
            yield self._forward_result(event, overview, details, players,
                                       f"{label} 最近一局 · {suffix}")
            if self.verbose:
                logger.info(f"[卫戍战绩] 群 {group_id} 查询 {target} → {record.get('code')}")
        except Exception as error:  # noqa: BLE001
            logger.error(f"[卫戍战绩] 出图失败 {type(error).__name__}: {error}")
            yield event.plain_result("战绩卡片生成失败，请稍后重试。")

    def _forward_result(self, event, overview, details, players, summary):
        """把总览 + 各人明细包成一条**合并转发**（QQ 的"聊天记录"卡片）。

        为什么用合并转发：一局 4 人会有 5~9 张图，直接连发会刷屏，而且手机端会缩得很小。
        合并转发把它们收进一张卡片，群里只占一条消息（用户 2026-10-11 的要求）。

        实现要点（照 AstrBot 适配器与参考插件的用法）：
        * 组件是 `Node`（一条）与 `Nodes`（整包）；`Nodes.to_dict()` 会把图片转成 base64，
          所以合并转发只能走 base64，不能传本地路径 —— 这也是适配器只对 Node/Nodes 走
          `send_group_forward_msg` 而不是普通发送的原因。
        * `name` 是每条消息显示的昵称（这里用「战绩总览」「P1 名字」），`uin` 用机器人自己的 QQ。
        """
        uin = str(event.get_self_id() or "0")
        nodes = [Node(content=[Image.fromFileSystem(overview), Plain(summary)], name="战绩总览", uin=uin)]
        # 一个座位可能有多页明细（purchases 每 20 条一页）：先数出每个座位几页，标题带上 (页/总页)
        pages = {}
        parsed = []
        for path in details:
            match = re.match(r"P(\d+)-(\d+)\.png$", Path(path).name)
            seat, page = (int(match.group(1)) - 1, int(match.group(2))) if match else (0, 1)
            parsed.append((path, seat, page))
            pages[seat] = max(pages.get(seat, 0), page)
        for path, seat, page in parsed:
            player = players[seat] if 0 <= seat < len(players) else None
            name = str((player or {}).get("name") or "博士")[:12]
            title = f"P{seat + 1} {name}"
            if (player or {}).get("isBot"):
                title += "（AI）"
            if pages.get(seat, 1) > 1:
                title += f"（{page}/{pages[seat]}）"
            nodes.append(Node(content=[Image.fromFileSystem(path), Plain(title)], name=title, uin=uin))
        return event.chain_result([Nodes(nodes)])

    def _mentions_bot(self, event):
        bot_id = str(event.get_self_id() or "")
        if not bot_id:
            return False
        for component in getattr(event.message_obj, "message", []) or []:
            if isinstance(component, At) and str(getattr(component, "qq", "")) == bot_id:
                return True
        return False

    async def _lookup(self, target):
        """账号名优先；4 个字母且开启了房间号查询时，也支持房间码。"""
        try:
            return await asyncio.to_thread(fetch_record_by_account, self.base_url, target)
        except urllib.error.HTTPError as error:
            if error.code != 404 or not (self.allow_code and CODE_ONLY.match(target)):
                raise
        return await asyncio.to_thread(fetch_record_by_code, self.base_url, target.upper())

    @staticmethod
    def _cleanup_cards():
        """删掉一天前的卡片，避免 /tmp 越攒越多。"""
        cutoff = time.time() - 86400
        for old in CARD_DIR.glob("*/*.png"):
            try:
                if old.stat().st_mtime < cutoff:
                    old.unlink(missing_ok=True)
            except OSError:
                pass

    # ---------- 私聊：改密码 ----------

    @filter.event_message_type(filter.EventMessageType.PRIVATE_MESSAGE)
    async def private_password(self, event: AstrMessageEvent):
        if not self.enabled:
            return
        text = strip_markers(event.get_message_str())
        match = PASSWORD_REQUEST.match(text)
        if not match:
            return
        # 只走私聊：群里出现的同款文本一律不处理（也不提示，避免把用户的密码暴露给群里）
        if str(event.get_group_id() or ""):
            return
        event.stop_event()
        sender = str(event.get_sender_id() or "")
        if not self.password_enabled:
            yield event.plain_result("改密码功能当前未启用。")
            return
        if not self.admin_token:
            yield event.plain_result("机器人还没配置改密码令牌，请联系维护者。")
            return
        if self._cooling(self._last_user_use, sender, self.password_cooldown):
            yield event.plain_result("操作太频繁，请稍后再试。")
            return

        name, old_password, new_password = match.group(1), match.group(2), match.group(3)
        if len(new_password) < 8 or len(new_password) > 128:
            yield event.plain_result("新密码至少 8 位、最多 128 位。")
            return
        try:
            await asyncio.to_thread(change_password, self.base_url, self.admin_token, name, old_password, new_password)
        except urllib.error.HTTPError as error:
            try:
                code = (json.loads(error.read().decode("utf-8")) or {}).get("error", "")
            except Exception:  # noqa: BLE001
                code = ""
            yield event.plain_result(ERROR_TEXT.get(code, f"改密码失败（HTTP {error.code}），请联系维护者。"))
            if self.verbose:
                logger.info(f"[卫戍改密] 用户 {sender} 改 {name} 失败: {error.code} {code}")
            return
        except Exception as error:  # noqa: BLE001
            logger.error(f"[卫戍改密] {type(error).__name__}: {error}")
            yield event.plain_result("改密码失败，请稍后重试。")
            return
        yield event.plain_result(f"账号「{name}」的密码已更新，请用新密码登录。")
        if self.verbose:
            logger.info(f"[卫戍改密] 用户 {sender} 成功修改 {name}")
