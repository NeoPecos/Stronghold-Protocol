"""AstrBot 插件：卫戍协议公告编辑与发布（TASK-049）。

维护者在 QQ 里**私下**跟机器人对话，用草稿流程写一条全服公告并发布：

    公告草稿 服务器今晚维护          → 建一条草稿，回一个 6 位草稿 ID
    公告正文 <ID> ## 标题文字        → 填/改 Markdown 正文（支持多行，一次发完）
    公告预览 <ID>                    → 完整回显标题 + 正文（不截断）+ 指纹
    公告发布 <ID>                    → 只有「预览过的指纹 == 当前指纹」才发
    公告取消 <ID> / 公告列表 / 公告帮助

安全约定（全部默认最保守）：
  * 只认 AstrBot 的 `admins_id` 名单里的发送者；名单为空 ⇒ 谁都不能用（不靠"未配置=所有人"）。
  * 默认只在**私聊**生效；群里必须白名单 + @机器人。
  * 草稿只在内存里，30 分钟过期；预览后改过正文必须重新预览。
  * 发布走游戏服务器的**窄令牌**接口（只能新增公告，拿不到踢人/改密码），令牌只存在插件配置里。
"""

import asyncio
import re
import time
from typing import Optional

import aiohttp
from astrbot.api import logger
from astrbot.api.event import AstrMessageEvent, filter
from astrbot.api.message_components import At
from astrbot.api.star import Context, Star, register

from .drafts import DraftError, DraftStore

DEFAULT_BASE_URL = "https://sp.bs.leio.fun"
PUBLISH_PATH = "/api/admin/announcements/publish"
ANNOUNCEMENTS_PATH = "/api/announcements/"
TOKEN_HEADER = "X-SP-Announce-Token"

TITLE_MAX = 120
BODY_MAX = 50_000
REPLY_CHUNK = 1200          # QQ 单条消息别太长：正文分片回显
COOLDOWN_SECONDS = 4        # 同一发送者的写操作节流，防手抖连发
DRAFT_TTL_SECONDS = 30 * 60

HELP_TEXT = """卫戍协议 · 公告发布（仅维护者私聊）

公告草稿 <标题>            新建草稿，返回草稿 ID
公告正文 <ID> <正文>       填写/覆盖 Markdown 正文（可多行）
公告预览 <ID>              完整回显标题 + 正文 + 指纹
公告发布 <ID>              发布（仅当预览后未改动）
公告取消 <ID>              丢弃草稿
公告列表                   列出我的未发草稿
公告帮助                   这条帮助

标题最多 120 字；正文最多 50000 字，支持 Markdown。"""


def _chunks(text: str, size: int = REPLY_CHUNK) -> list[str]:
    """按行边界切片，避免把 Markdown 语法劈成两半。"""
    if len(text) <= size:
        return [text]
    out, buf = [], ""
    for line in text.splitlines(keepends=True):
        if len(buf) + len(line) > size and buf:
            out.append(buf)
            buf = ""
        buf += line
    if buf:
        out.append(buf)
    return out


@register("astrbot_plugin_sp_announce", "Leiothrix", "在 QQ 里编辑并发布卫戍协议的全服公告（草稿 → 预览 → 发布）。", "0.1.0")
class StrongholdAnnouncements(Star):
    def __init__(self, context: Context, config: dict | None = None):
        super().__init__(context)
        self.config = config if isinstance(config, dict) else {}
        self.store = DraftStore(ttl=int(self.config.get("draft_ttl_seconds") or DRAFT_TTL_SECONDS))
        self._last_action: dict[str, float] = {}
        logger.info("[sp-announce] 插件已加载（公告草稿→预览→发布）")

    # ------------------------------------------------------------------ 配置与鉴权

    @property
    def base_url(self) -> str:
        url = str(self.config.get("base_url") or DEFAULT_BASE_URL).strip().rstrip("/")
        return url or DEFAULT_BASE_URL

    @property
    def token(self) -> str:
        return str(self.config.get("announce_token") or "").strip()

    @property
    def admins(self) -> set[str]:
        raw = self.config.get("allowed_senders") or self.config.get("admins_id") or []
        if isinstance(raw, str):
            raw = re.split(r"[,\s]+", raw)
        return {str(x).strip() for x in raw if str(x).strip()}

    @property
    def groups(self) -> set[str]:
        raw = self.config.get("allowed_groups") or []
        if isinstance(raw, str):
            raw = re.split(r"[,\s]+", raw)
        return {str(x).strip() for x in raw if str(x).strip()}

    @property
    def verbose(self) -> bool:
        return bool(self.config.get("verbose", False))

    def _log(self, message: str):
        if self.verbose:
            logger.info(f"[sp-announce] {message}")

    def _sender_allowed(self, event: AstrMessageEvent) -> tuple[bool, str]:
        admins = self.admins
        if not admins:
            return False, "插件还没配置维护者名单（allowed_senders / admins_id），出于安全我什么都不会做。"
        if str(event.get_sender_id()) not in admins:
            logger.info(f"[sp-announce] 拒绝非维护者 {event.get_sender_id()}")
            return False, "这个功能只对维护者开放。"
        if not self.token:
            return False, "游戏服务器的公告令牌还没配置（announce_token），现在发布不了。"
        return True, ""

    def _in_group(self, event: AstrMessageEvent) -> bool:
        return bool(event.get_group_id())

    def _mentions_bot(self, event: AstrMessageEvent) -> bool:
        """群聊里必须真的 @ 了机器人（用可信的事件元数据，不看消息文本）。"""
        bot_id = str(event.get_self_id() or "")
        if not bot_id:
            return False
        for component in getattr(event.message_obj, "message", []) or []:
            if isinstance(component, At) and str(getattr(component, "qq", "")) == bot_id:
                return True
        return False

    async def _guard(self, event: AstrMessageEvent) -> Optional[str]:
        """返回错误文本表示拒绝（调用方直接 yield 并 stop），None 表示放行。"""
        ok, why = self._sender_allowed(event)
        if not ok:
            return why
        if self._in_group(event):
            if not self.config.get("allow_group", False):
                return "公告发布只在私聊里用（要开群聊请先打开 allow_group 并配置群白名单）。"
            if str(event.get_group_id()) not in self.groups:
                return "这个群不在白名单里。"
        now = time.time()
        sender = str(event.get_sender_id())
        if now - self._last_action.get(sender, 0) < COOLDOWN_SECONDS:
            return "慢一点，上一条还没处理完。"
        self._last_action[sender] = now
        return None

    # ------------------------------------------------------------------ HTTP

    def _headers(self) -> dict:
        return {TOKEN_HEADER: self.token, "Content-Type": "application/json"}

    async def _publish(self, title: str, markdown: str) -> dict:
        body = {"title": title, "markdown": markdown}
        self._log(f"发布请求 {self.base_url}{PUBLISH_PATH} · {title!r} · {len(markdown)} 字")
        timeout = aiohttp.ClientTimeout(total=20)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(f"{self.base_url}{PUBLISH_PATH}", json=body, headers=self._headers()) as resp:
                text = await resp.text()
                if resp.status != 200:
                    raise DraftError(f"服务器拒绝了发布（HTTP {resp.status}）：{text[:300]}")
                data = await resp.json()
                self._log(f"服务器已写入公告 {data.get('id')}")
                return data

    async def _read_back(self, announcement_id: str) -> Optional[dict]:
        """发布后回读一次，确认线上真的存在这条公告。"""
        timeout = aiohttp.ClientTimeout(total=15)
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(f"{self.base_url}{ANNOUNCEMENTS_PATH}{announcement_id}") as resp:
                    if resp.status != 200:
                        return None
                    return await resp.json()
        except Exception as exc:  # noqa: BLE001 - 回读失败不影响"已发布"的事实
            logger.warning(f"[sp-announce] 回读公告失败：{exc}")
            return None

    # ------------------------------------------------------------------ 命令

    def _is_command(self, text: str) -> bool:
        return text.startswith("公告")

    @filter.event_message_type(filter.EventMessageType.PRIVATE_MESSAGE)
    async def on_private(self, event: AstrMessageEvent):
        if not self.config.get("enabled", True):
            return
        raw = event.get_message_str().strip()
        if not self._is_command(raw):
            return
        guard = await self._guard(event)
        if guard:
            event.stop_event()
            yield event.plain_result(guard)
            return
        async for result in self._dispatch(event, raw):
            yield result
        event.stop_event()

    @filter.event_message_type(filter.EventMessageType.GROUP_MESSAGE)
    async def on_group(self, event: AstrMessageEvent):
        if not self.config.get("enabled", True):
            return
        if not self.config.get("allow_group", False):
            return
        raw = event.get_message_str().strip()
        if not self._is_command(raw):
            return
        if not self._mentions_bot(event):
            return
        guard = await self._guard(event)
        if guard:
            event.stop_event()
            yield event.plain_result(guard)
            return
        async for result in self._dispatch(event, raw):
            yield result
        event.stop_event()

    async def _dispatch(self, event: AstrMessageEvent, raw: str):
        sender = str(event.get_sender_id())
        parts = raw.split(maxsplit=2)
        command = parts[0]
        arg1 = parts[1] if len(parts) > 1 else ""
        arg2 = parts[2] if len(parts) > 2 else ""
        self._log(f"命令 {command} · 来自 {sender} · 草稿数 {self.store.count()}")

        try:
            if command in ("公告帮助", "公告"):
                yield event.plain_result(HELP_TEXT)
                return

            if command == "公告草稿":
                title = arg1.strip()
                if not title:
                    yield event.plain_result("用法：公告草稿 <标题>")
                    return
                if len(title) > TITLE_MAX:
                    yield event.plain_result(f"标题太长（{len(title)} 字，上限 {TITLE_MAX}）。")
                    return
                draft = self.store.create(title, sender)
                yield event.plain_result(
                    f"草稿 {draft.id} 已建：{title}\n"
                    f"下一步：公告正文 {draft.id} <正文>（可多行）\n"
                    f"草稿 {int(self.store.ttl // 60)} 分钟后过期。"
                )
                return

            if command == "公告正文":
                draft_id, body = arg1.strip(), arg2
                if not draft_id or not body.strip():
                    yield event.plain_result("用法：公告正文 <ID> <正文>（正文可以多行）")
                    return
                if len(body) > BODY_MAX:
                    yield event.plain_result(f"正文太长（{len(body)} 字，上限 {BODY_MAX}）。")
                    return
                draft = self.store.set_body(draft_id, body)
                yield event.plain_result(
                    f"草稿 {draft.id} 正文已更新：{len(body)} 字，指纹 {draft.revision}。\n"
                    f"下一步：公告预览 {draft.id}"
                )
                return

            if command == "公告预览":
                draft = self.store.mark_previewed(arg1.strip())
                for i, chunk in enumerate(_chunks(draft.preview_text()), 1):
                    suffix = f"（第 {i} 段）" if i > 1 else ""
                    yield event.plain_result(chunk + suffix)
                return

            if command == "公告发布":
                draft = self.store.take_for_publish(arg1.strip())
                yield event.plain_result(f"正在发布「{draft.title}」…")
                data = await self._publish(draft.title, draft.body)
                announcement_id = str(data.get("id") or "")
                self.store.mark_published(draft.id, announcement_id)
                line = f"✅ 已发布：{draft.title}\nID：{announcement_id}\n地址：{self.base_url}/news/{announcement_id}"
                back = await self._read_back(announcement_id) if announcement_id else None
                if back is not None:
                    line += f"\n线上回读：{back.get('title', '')}（{back.get('kind', 'announcement')}）"
                else:
                    line += "\n（线上回读没成功，但服务器已确认写入，可稍后自己刷新看看）"
                yield event.plain_result(line)
                return

            if command == "公告取消":
                draft = self.store.drop(arg1.strip())
                yield event.plain_result(f"草稿 {draft.id}（{draft.title}）已丢弃。")
                return

            if command == "公告列表":
                pending = self.store.pending_for(sender)
                if not pending:
                    yield event.plain_result("你现在没有未发布的草稿。")
                    return
                yield event.plain_result("未发布草稿：\n" + "\n".join("· " + d.summary_line() for d in pending))
                return

            yield event.plain_result("不认识的命令。\n" + HELP_TEXT)

        except DraftError as exc:
            yield event.plain_result(str(exc))
        except asyncio.TimeoutError:
            yield event.plain_result("跟服务器通信超时了，公告**没有**发布，稍后再试。")
        except aiohttp.ClientError as exc:
            yield event.plain_result(f"连不上游戏服务器（{exc}），公告**没有**发布。")
        except Exception as exc:  # noqa: BLE001 - 兜底：任何异常都不能让机器人静默吞掉
            logger.exception("[sp-announce] 处理公告命令时出错")
            yield event.plain_result(f"出错了：{exc}")
