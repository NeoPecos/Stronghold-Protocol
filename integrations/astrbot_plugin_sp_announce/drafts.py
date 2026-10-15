"""公告草稿仓（TASK-049）。

草稿**只存在于机器人进程内存**：重启即清空，磁盘上不会留下任何未发布的正文。
这样最省事也最安全 —— 不用给插件申请数据目录，也不会把维护者写了一半的公告留在文件系统里。

一条草稿的生命周期：
    create() → set_body()（可多次，每次 revision 变化）→ mark_previewed() → take()（一次性消费）
    take() 要求「当前 revision == 上次预览过的 revision」，否则拒绝：
    预览之后又改过正文，必须重新预览 + 重新批准，避免"看的是 A、发出去的是 B"。
"""

import hashlib
import time
from uuid import uuid4

DEFAULT_TTL_SECONDS = 30 * 60
DEFAULT_MAX_DRAFTS = 20


class DraftError(Exception):
    """草稿操作被拒绝；message 是直接能回给维护者的人话。"""


def revision_of(title: str, body: str) -> str:
    """一次（标题 + 正文）的指纹：只有它和上次预览的指纹一致时才允许发布。"""
    return hashlib.sha256(f"{title}\x00{body}".encode("utf-8")).hexdigest()[:16]


class Draft:
    def __init__(self, draft_id: str, title: str, sender: str, ttl: int):
        self.id = draft_id
        self.title = title
        self.body = ""
        self.sender = sender
        self.created_at = time.time()
        self.updated_at = self.created_at
        self.expires_at = self.created_at + ttl
        self.previewed_revision = None   # 最近一次「公告预览」时的指纹
        self.published_id = None         # 发布成功后写入公告 ID（草稿随即作废）
        self.published_at = None

    @property
    def revision(self) -> str:
        return revision_of(self.title, self.body)

    @property
    def expired(self) -> bool:
        return time.time() > self.expires_at

    @property
    def consumed(self) -> bool:
        return self.published_id is not None

    def summary_line(self) -> str:
        state = "已发布" if self.consumed else ("已预览" if self.previewed_revision == self.revision else "未预览")
        return f"{self.id} · {self.title} · {len(self.body)} 字 · {state}"

    def preview_text(self) -> str:
        """完整回显：标题 + 正文（不做截断）+ 指纹与下一步提示。"""
        body = self.body if self.body.strip() else "（还没有正文，用「公告正文 <ID> <正文>」填写）"
        return (
            f"【公告草稿 {self.id}】\n"
            f"标题：{self.title}\n"
            f"正文字数：{len(self.body)} · 指纹：{self.revision}\n"
            f"----- 正文开始 -----\n{body}\n----- 正文结束 -----\n"
            f"确认无误后发送：公告发布 {self.id}\n"
            f"（发布前若再改正文，需要重新预览确认；草稿 {int((self.expires_at - time.time()) // 60)} 分钟后过期）"
        )


class DraftStore:
    def __init__(self, ttl: int = DEFAULT_TTL_SECONDS, limit: int = DEFAULT_MAX_DRAFTS):
        self.ttl = max(60, int(ttl))
        self.limit = max(1, int(limit))
        self._drafts: dict[str, Draft] = {}

    # ---------- 内部 ----------

    def _sweep(self):
        for draft_id in [k for k, d in self._drafts.items() if d.expired or d.consumed]:
            self._drafts.pop(draft_id, None)

    def _require(self, draft_id: str) -> Draft:
        self._sweep()
        draft = self._drafts.get(str(draft_id or "").strip())
        if not draft:
            raise DraftError("找不到这条草稿（可能已过期、已发布或机器人重启过），请重新用「公告草稿 <标题>」开一条。")
        return draft

    # ---------- 对外 ----------

    def create(self, title: str, sender: str) -> Draft:
        self._sweep()
        if len(self._drafts) >= self.limit:
            oldest = min(self._drafts.values(), key=lambda d: d.created_at)
            self._drafts.pop(oldest.id, None)
        draft = Draft(uuid4().hex[:6], title, sender, self.ttl)
        self._drafts[draft.id] = draft
        return draft

    def get(self, draft_id: str) -> Draft:
        return self._require(draft_id)

    def set_body(self, draft_id: str, body: str) -> Draft:
        draft = self._require(draft_id)
        draft.body = body
        draft.updated_at = time.time()
        draft.expires_at = draft.updated_at + self.ttl
        return draft

    def mark_previewed(self, draft_id: str) -> Draft:
        draft = self._require(draft_id)
        if not draft.body.strip():
            raise DraftError("正文还是空的，先用「公告正文 <ID> <正文>」填写。")
        draft.previewed_revision = draft.revision
        return draft

    def take_for_publish(self, draft_id: str) -> Draft:
        """一次性取用：指纹必须与上次预览一致；成功后这条草稿立刻作废，第二次发布会被拒。"""
        draft = self._require(draft_id)
        if draft.previewed_revision is None:
            raise DraftError("这条草稿还没预览过，先发「公告预览 <ID>」确认内容。")
        if draft.previewed_revision != draft.revision:
            raise DraftError("草稿在上次预览之后又被改过，请重新「公告预览 <ID>」确认。")
        return draft

    def mark_published(self, draft_id: str, announcement_id: str):
        draft = self._drafts.get(draft_id)
        if draft:
            draft.published_id = announcement_id
            draft.published_at = time.time()

    def drop(self, draft_id: str) -> Draft:
        draft = self._require(draft_id)
        self._drafts.pop(draft.id, None)
        return draft

    def pending_for(self, sender: str) -> list[Draft]:
        self._sweep()
        return sorted((d for d in self._drafts.values() if d.sender == sender), key=lambda d: d.updated_at, reverse=True)

    def count(self) -> int:
        self._sweep()
        return len(self._drafts)
