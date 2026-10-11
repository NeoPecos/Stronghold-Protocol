"""B 站官号（明日方舟）动态 / 投稿数据层。

设计要点：
- 纯数据层：所有函数都是同步的，返回 dataclass，便于在容器里单独脚本化验证。
- 任何异常都用 BiliError 抛出（带中文 hint），由上层 main.py 统一吞掉并记日志。
- 不引入新依赖：只用标准库 urllib + http.cookiejar；列投稿只用容器里已有的 yt-dlp CLI。

接口结论来自 `_bili_probe/SPEC.md`（2026-10-11 线上实测）：
- 动态列表：GET https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space
- 视频详情：GET https://api.bilibili.com/x/web-interface/view?bvid=<BV>
- 列投稿：yt-dlp --flat-playlist --dump-json
"""

from __future__ import annotations

import http.cookiejar
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

CN_TZ = timezone(timedelta(hours=8))

DYNAMIC_FEED_URL = "https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space"
VIDEO_VIEW_URL = "https://api.bilibili.com/x/web-interface/view"
NAV_URL = "https://api.bilibili.com/x/web-interface/nav"
BILI_SPACE_VIDEO_URL = "https://space.bilibili.com/{mid}/video"
BILI_VIDEO_PAGE_URL = "https://www.bilibili.com/video/{bvid}"

# SPEC §1.2：这些头缺了会 412
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

_MID = "161775300"
DEFAULT_REFERER = f"https://space.bilibili.com/{_MID}/dynamic"

# B 站错误码 -> 给运维看的可诊断提示（SPEC §6：不要静默成「没有新动态」）
_CODE_HINTS = {
    -101: "账号未登录：cookies 大概率已过期，请更新 cookies.txt",
    -111: "csrf 校验失败：cookies 里的 bili_jct 可能无效",
    -352: "风控校验失败：cookies 可能过期或接口被风控",
    -799: "请求过于频繁：被 B 站限流，稍后重试",
    -509: "请求被拦截（-509）：触发风控",
}


class BiliError(RuntimeError):
    """B 站数据层统一异常。hint 是给日志的可诊断说明。"""

    def __init__(self, message: str, hint: str = "", code: Any = None):
        super().__init__(message)
        self.hint = hint
        self.code = code

    def __str__(self) -> str:
        base = super().__str__()
        return f"{base} | {self.hint}" if self.hint else base


def cookie_candidates(configured: str | None = None) -> list[str]:
    """cookies 路径候选（SPEC §1.2：文件已存在，不要新建）。"""
    paths: list[str] = []
    if configured:
        paths.append(str(configured))
    paths.append("/AstrBot/data/plugins/astrbot_plugin_yt_dlp/cookies.txt")
    paths.append("/opt/astrbot/data/plugins/astrbot_plugin_yt_dlp/cookies.txt")
    return paths


def resolve_cookies_path(configured: str | None = None) -> str:
    """挑一个能用的 cookies 文件路径。

    - 配置了路径且文件存在 -> 就用它（**不再往后回退**，否则文件被写坏时会静默改用
      另一份 cookies，日志里就看不到真正的原因）；
    - 配置的路径不存在 / 为空 -> 回退到 yt-dlp 插件那份（只读借用）。
    """
    configured = str(configured or "").strip()
    if configured:
        if os.path.isfile(configured):
            return configured
    for path in cookie_candidates(None):
        if path and os.path.isfile(path):
            return path
    raise BiliError(
        "找不到 B 站 cookies 文件",
        hint="candidates=" + ", ".join(cookie_candidates(configured)),
    )


def _https(url: str) -> str:
    """SPEC §6：动态配图 URL 是 http://，QQ 端可能加载失败，统一换 https。"""
    value = str(url or "").strip()
    if not value:
        return ""
    if value.startswith("//"):
        return "https:" + value
    if value.startswith("http://"):
        return "https://" + value[len("http://") :]
    return value


def _duration_from_text(text: str) -> int | None:
    """'02:24' -> 144；'1:02:24' -> 3744。"""
    parts = str(text or "").strip().split(":")
    if not parts or len(parts) > 3:
        return None
    try:
        numbers = [int(p) for p in parts]
    except ValueError:
        return None
    seconds = 0
    for number in numbers:
        seconds = seconds * 60 + number
    return seconds


def _format_duration(seconds: int | None) -> str:
    if not seconds or seconds < 0:
        return ""
    hours, rest = divmod(int(seconds), 3600)
    minutes, secs = divmod(rest, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


# --------------------------------------------------------------------------- #
# dataclass
# --------------------------------------------------------------------------- #
@dataclass
class BiliDynamic:
    """一条 B 站动态。"""

    dynamic_id: str
    dynamic_type: str
    author: str
    pub_ts: int
    text: str = ""
    images: list[str] = field(default_factory=list)
    archive_bvid: str = ""
    archive_title: str = ""
    archive_cover: str = ""
    archive_desc: str = ""

    @property
    def url(self) -> str:
        return f"https://t.bilibili.com/{self.dynamic_id}"

    @property
    def cover(self) -> str:
        """卡片/配图用的主图：投稿动态用视频封面，否则用第一张配图。"""
        return self.archive_cover or (self.images[0] if self.images else "")

    @property
    def media_kind(self) -> str:
        """draw / archive / article / other —— 卡片标题用。"""
        major = self.dynamic_type
        if self.archive_bvid or major in {"DYNAMIC_TYPE_AV", "DYNAMIC_TYPE_PGC"}:
            return "archive"
        if major in {"DYNAMIC_TYPE_DRAW", "DYNAMIC_TYPE_WORD"}:
            return "draw" if self.images else "word"
        if major in {"DYNAMIC_TYPE_ARTICLE"}:
            return "article"
        return "other"

    @property
    def is_video_post(self) -> bool:
        """投稿类动态（MAJOR_TYPE_ARCHIVE）——由视频链路处理，不走动态卡片。"""
        return bool(self.archive_bvid)

    @property
    def pub_time_text(self) -> str:
        try:
            return datetime.fromtimestamp(int(self.pub_ts), CN_TZ).strftime("%Y.%m.%d  %H:%M")
        except (TypeError, ValueError, OSError):
            return "未知时间"

    @property
    def body_text(self) -> str:
        """正文；正文为空时退化到配图说明（SPEC §1.3 正文为空的处理）。"""
        text = (self.text or "").strip()
        if text:
            return text
        if self.media_kind == "archive":
            detail = (self.archive_desc or "").strip()
            if detail:
                return detail
            return "（本条动态是视频投稿，点开原链接可以观看）"
        if self.images:
            return "（本条动态没有文字，请看配图）"
        return "（本条动态没有文字内容）"


@dataclass
class BiliVideo:
    """一个投稿视频。"""

    bvid: str
    title: str = ""
    duration: int | None = None
    pub_ts: int = 0
    cover: str = ""
    desc: str = ""
    owner: str = ""
    uploader_mid: str = ""

    @property
    def url(self) -> str:
        return BILI_VIDEO_PAGE_URL.format(bvid=self.bvid)

    @property
    def duration_text(self) -> str:
        return _format_duration(self.duration)

    @property
    def pub_time_text(self) -> str:
        if not self.pub_ts:
            return ""
        try:
            return datetime.fromtimestamp(int(self.pub_ts), CN_TZ).strftime("%Y.%m.%d  %H:%M")
        except (TypeError, ValueError, OSError):
            return ""

    def oversize_reason(self, max_minutes: int, max_mb: int, size_bytes: int | None = None) -> str:
        """超过上限时返回原因文本，未超限返回空串（SPEC §0.1 决定 2/3）。"""
        reasons: list[str] = []
        if self.duration and max_minutes > 0 and self.duration > max_minutes * 60:
            reasons.append(f"时长 {self.duration_text} 超过 {max_minutes} 分钟")
        if size_bytes and max_mb > 0 and size_bytes > max_mb * 1024 * 1024:
            reasons.append(f"体积 {size_bytes / 1024 / 1024:.1f}MB 超过 {max_mb}MB")
        return "，".join(reasons)


@dataclass
class BiliVideoDetail:
    """视频详情（/x/web-interface/view 归一化结果）。"""

    bvid: str
    title: str = ""
    duration: int | None = None
    pub_ts: int = 0
    cover: str = ""
    desc: str = ""
    owner: str = ""

    def to_video(self) -> BiliVideo:
        return BiliVideo(
            bvid=self.bvid,
            title=self.title,
            duration=self.duration,
            pub_ts=self.pub_ts,
            cover=self.cover,
            desc=self.desc,
            owner=self.owner,
        )


@dataclass
class BiliLogin:
    is_login: bool
    uname: str = ""
    mid: str = ""


# --------------------------------------------------------------------------- #
# HTTP
# --------------------------------------------------------------------------- #
class BiliClient:
    """带 cookie jar 的 B 站 API 客户端。"""

    def __init__(self, cookies_path: str | None = None, timeout: int = 20):
        self.cookies_path = resolve_cookies_path(cookies_path)
        self.timeout = timeout
        self._opener: urllib.request.OpenerDirector | None = None

    def _build_opener(self) -> urllib.request.OpenerDirector:
        if self._opener is not None:
            return self._opener
        jar = http.cookiejar.MozillaCookieJar(self.cookies_path)
        try:
            jar.load(ignore_discard=True, ignore_expires=True)
        except Exception as exc:  # noqa: BLE001 - 统一转成可诊断的 BiliError
            raise BiliError(
                f"cookies 文件解析失败: {self.cookies_path}: {exc}",
                hint="确认是 Netscape 格式（含 SESSDATA/bili_jct）",
            ) from exc
        names = {cookie.name for cookie in jar}
        if not names:
            # 常见坑：配置文件里写了路径，但文件内容是坏的（MozillaCookieJar 会静默解析出 0 条）
            raise BiliError(
                f"cookies 文件里没有解析出任何条目: {self.cookies_path}",
                hint="文件可能被写坏/不是 Netscape 格式；检查该文件内容与换行",
            )
        if "SESSDATA" not in names:
            raise BiliError(
                f"cookies 里没有 SESSDATA: {self.cookies_path}（解析到 {len(names)} 条）",
                hint="cookies 大概率已失效/内容不完整",
            )
        self._opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        return self._opener

    def get_json(self, url: str, referer: str | None = None) -> dict[str, Any]:
        headers = dict(HEADERS)
        headers["Referer"] = referer or DEFAULT_REFERER
        if "space.bilibili.com" in headers["Referer"]:
            headers["Origin"] = "https://space.bilibili.com"
        else:
            headers["Origin"] = "https://www.bilibili.com"
        request = urllib.request.Request(url, headers=headers)
        try:
            with self._build_opener().open(request, timeout=self.timeout) as response:
                raw = response.read()
        except urllib.error.HTTPError as exc:
            if exc.code == 412:
                raise BiliError(
                    f"HTTP 412 请求被拦截: {url}",
                    hint="B 站风控/请求头不合规，cookies 可能已过期",
                ) from exc
            raise BiliError(
                f"HTTP {exc.code} 请求失败: {url}",
                hint="检查网络连通性与 cookies",
            ) from exc
        except urllib.error.URLError as exc:
            raise BiliError(f"网络不可达: {url}: {exc.reason}", hint="检查容器出网") from exc
        try:
            payload = json.loads(raw.decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            raise BiliError(
                f"响应不是合法 JSON: {url}",
                hint=f"前 120 字节: {raw[:120]!r}",
            ) from exc
        code = payload.get("code")
        if code not in (0, None):
            hint = _CODE_HINTS.get(code, "见 B 站开放接口文档")
            raise BiliError(
                f"接口返回 code={code} message={payload.get('message')!r}: {url}",
                hint=hint,
                code=code,
            )
        return payload

    # ---- 高层接口 ----
    def check_login(self) -> BiliLogin:
        data = (self.get_json(NAV_URL, referer="https://www.bilibili.com/") or {}).get("data") or {}
        return BiliLogin(
            is_login=bool(data.get("isLogin")),
            uname=str(data.get("uname") or ""),
            mid=str(data.get("mid") or ""),
        )

    def fetch_dynamics(self, mid: str, limit: int = 13, raw_items: bool = False):
        url = (
            f"{DYNAMIC_FEED_URL}?host_mid={urllib.parse.quote(str(mid))}"
            "&timezone_offset=-480&platform=web"
        )
        payload = self.get_json(url)
        items = ((payload.get("data") or {}).get("items")) or []
        if raw_items:
            return items
        if not items:
            # SPEC §6：不要静默成「没有新动态」
            raise BiliError(
                f"动态列表为空 (host_mid={mid})",
                hint="mid 是否写错？或 cookies 已过期被降级为游客",
            )
        return [parse_dynamic(item) for item in items][: max(int(limit), 1)]

    def fetch_video_detail(self, bvid: str) -> BiliVideoDetail:
        url = f"{VIDEO_VIEW_URL}?bvid={urllib.parse.quote(str(bvid))}"
        payload = self.get_json(url, referer=f"https://www.bilibili.com/video/{bvid}")
        data = payload.get("data") or {}
        if not data:
            raise BiliError(f"视频详情为空: {bvid}", hint="视频可能已删除或仅粉丝可见")
        return BiliVideoDetail(
            bvid=str(data.get("bvid") or bvid),
            title=str(data.get("title") or "").strip(),
            duration=int(data["duration"]) if data.get("duration") is not None else None,
            pub_ts=int(data.get("pubdate") or 0),
            cover=_https(data.get("pic") or ""),
            desc=str(data.get("desc") or ""),
            owner=str((data.get("owner") or {}).get("name") or ""),
        )


# --------------------------------------------------------------------------- #
# 解析
# --------------------------------------------------------------------------- #
def parse_dynamic(item: dict[str, Any]) -> BiliDynamic:
    """把 feed/space 的一条 item 归一化成 BiliDynamic。

    字段路径全部是 SPEC §1.3 实测结果；任何一层缺失都不抛异常，退化为空值。
    """
    modules = item.get("modules") or {}
    author_module = modules.get("module_author") or {}
    dynamic_module = modules.get("module_dynamic") or {}
    major = dynamic_module.get("major") or {}

    desc = dynamic_module.get("desc") or {}
    text = str(desc.get("text") or "").strip() if isinstance(desc, dict) else str(desc or "").strip()

    # ⚠️ SPEC §6：pub_ts 是字符串，必须 int()
    pub_ts = 0
    raw_pub = author_module.get("pub_ts")
    try:
        pub_ts = int(raw_pub) if raw_pub is not None else 0
    except (TypeError, ValueError):
        pub_ts = 0

    images: list[str] = []
    major_type = str(major.get("type") or "")
    if major_type == "MAJOR_TYPE_DRAW":
        draw = major.get("draw") or {}
        for entry in draw.get("items") or []:
            src = _https((entry or {}).get("src") or "")
            if src:
                images.append(src)

    archive = major.get("archive") or {}
    archive_bvid = str(archive.get("bvid") or "") if isinstance(archive, dict) else ""

    return BiliDynamic(
        dynamic_id=str(item.get("id_str") or item.get("id") or ""),
        dynamic_type=str(item.get("type") or ""),
        author=str(author_module.get("name") or ""),
        pub_ts=pub_ts,
        text=text,
        images=images,
        archive_bvid=archive_bvid,
        archive_title=str(archive.get("title") or "") if isinstance(archive, dict) else "",
        archive_cover=_https(archive.get("cover") or "") if isinstance(archive, dict) else "",
        archive_desc=str(archive.get("desc") or "") if isinstance(archive, dict) else "",
    )


def list_space_videos(
    mid: str,
    cookies_path: str | None = None,
    limit: int = 5,
    timeout: int = 300,
    proxy: str | None = None,
) -> list[BiliVideo]:
    """用 yt-dlp CLI 列投稿（SPEC §1.2：这是唯一可靠的视频来源）。

    只拿 `id`(BV 号) / `url`；标题与时长由 fetch_video_detail 补齐。
    """
    resolved = resolve_cookies_path(cookies_path)
    command = [
        sys.executable,
        "-m",
        "yt_dlp",
        "--cookies",
        resolved,
        "--flat-playlist",
        "--playlist-end",
        str(max(int(limit), 1)),
        "--dump-json",
        "--no-warnings",
        "--ignore-config",
    ]
    if proxy:
        command += ["--proxy", str(proxy)]
    command.append(BILI_SPACE_VIDEO_URL.format(mid=str(mid)))

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise BiliError(
            f"yt-dlp 列投稿超时（>{timeout}s）",
            hint="B 站空间页可能被限流，稍后重试",
        ) from exc
    except FileNotFoundError as exc:
        raise BiliError("无法执行 yt-dlp（python -m yt_dlp）", hint="容器里缺少 yt-dlp") from exc

    videos: list[BiliVideo] = []
    for line in (completed.stdout or "").splitlines():
        line = line.strip()
        if not line.startswith("{") or not line.endswith("}"):
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        bvid = str(payload.get("id") or "").strip()
        if not bvid:
            webpage = str(payload.get("webpage_url") or payload.get("url") or "")
            match = re.search(r"(BV[0-9A-Za-z]+)", webpage)
            bvid = match.group(1) if match else ""
        if not bvid:
            continue
        videos.append(
            BiliVideo(
                bvid=bvid,
                title=str(payload.get("title") or "").strip(),
                duration=int(payload["duration"]) if isinstance(payload.get("duration"), (int, float)) else None,
                pub_ts=int(payload.get("timestamp") or payload.get("epoch") or 0) or 0,
            )
        )

    if not videos:
        stderr_tail = (completed.stderr or "").strip().splitlines()[-3:]
        raise BiliError(
            f"yt-dlp 没有列出任何投稿 (mid={mid}, returncode={completed.returncode})",
            hint="stderr: " + " / ".join(stderr_tail) if stderr_tail else "stderr 为空，可能是空间页结构变化或被限流",
        )
    return videos[: max(int(limit), 1)]


def build_targets(
    mid: str,
    cookies_path: str | None = None,
    limit: int = 15,
    detail_limit: int = 8,
) -> tuple[list[BiliDynamic], list[BiliVideo]]:
    """一次抓取：动态列表 + 投稿列表。

    投稿列表用 yt-dlp（唯一可靠来源）；标题/时长用 /x/web-interface/view 补齐，
    只为「最新的 detail_limit 个」补详情，避免每次检查打太多接口。
    """
    client = BiliClient(cookies_path)
    dynamics = client.fetch_dynamics(mid)
    videos = list_space_videos(mid, cookies_path=cookies_path, limit=limit)
    for index, video in enumerate(videos[: max(int(detail_limit), 0)]):
        try:
            detail = client.fetch_video_detail(video.bvid)
        except BiliError:
            continue  # 单条详情拿不到不影响其它视频，交给上层用列表里的信息
        videos[index] = detail.to_video()
    return dynamics, videos
