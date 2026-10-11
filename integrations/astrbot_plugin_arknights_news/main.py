import asyncio
import hashlib
import io
import os
import shutil
import subprocess
import threading
import time
import urllib.request
from datetime import datetime, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image as PillowImage

from astrbot.api import AstrBotConfig, logger
from astrbot.api.event import AstrMessageEvent, filter
from astrbot.api.message_components import At, Image, Node, Nodes, Plain, Video
from astrbot.api.star import Context, Star, register
from astrbot.core.message.message_event_result import MessageEventResult

from .bili import (
    BiliDynamic,
    BiliError,
    BiliVideo,
    BiliVideoDetail,
    build_targets,
    list_space_videos,
)
from .bili_card import render_dynamic_card, render_video_card
from .delivery import announcement_text, build_message, download_image
from .fetcher import ArknightsNewsItem, fetch_latest_news, fetch_news_detail
from .reminder import now_cn, open_reminder_text, parse_maintenance_window, pre_reminder_text
from .renderer import NewsCardRenderer
from .state import NewsState
from .web_admin import ArknightsNewsWebAdminServer


# --------------------------------------------------------------------------- #
# B 站官号推送（SPEC：_bili_probe/SPEC.md）
# --------------------------------------------------------------------------- #
BILI_VIDEO_TEXT = "@全体成员 明日方舟官方发布新视频啦！一起来看看吧~"
BILI_DYNAMIC_TEXT = "明日方舟官方B站上有新的动态发布，看看说了些什么吧~"

BILI_VIDEO_DIR = "/tmp/arknights-news-bili"
BILI_VIDEO_FORMAT = "bestvideo[height<=1080][vcodec^=avc1]/bestvideo[ext=mp4]/bestvideo"
BILI_AUDIO_FORMAT = "bestaudio[ext=m4a]/bestaudio"
BILI_MERGE_TIMEOUT = 180
BILI_STALE_TEMP_SECONDS = 6 * 3600
BILI_MAX_FORWARD_IMAGES = 30
BILI_VIDEO_CONCURRENCY = 2

# 用「schema 里有没有 bili_enabled 这个键」判断配置是否已经被 AstrBot 刷新过。
# 新增配置项但 AstrBot 还没把键合进配置文件时，退回 schema 默认值，
# 避免灯下黑地认为「没配 = 关」而静默不推送。
BILI_CONFIG_DEFAULTS = {
    "bili_enabled": True,
    "bili_mid": "161775300",
    "bili_push_video": True,
    "bili_push_dynamic": True,
    "bili_check_interval_minutes": 10,
    "bili_max_push_per_check": 3,
    "bili_video_max_duration_minutes": 10,
    "bili_video_max_size_mb": 200,
    "bili_cookies_path": "/AstrBot/data/plugins/astrbot_plugin_yt_dlp/cookies.txt",
    "bili_at_all_video": True,
    "bili_at_all_dynamic": False,
}


def bili_is_group_target(target: str) -> bool:
    parts = str(target or "").split(":", 2)
    return len(parts) > 1 and parts[1] == "GroupMessage"


def _bili_download_image(url: str, directory) -> str:
    """下载 B 站配图。带上 B 站 Referer，失败时退回 delivery.download_image 的默认 UA 路径。"""
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "Referer": "https://www.bilibili.com/",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = response.read(12 * 1024 * 1024 + 1)
        if len(data) > 12 * 1024 * 1024:
            raise ValueError("B 站配图超过 12MB")
        path = Path(directory) / (hashlib.sha256(url.encode()).hexdigest()[:24] + ".png")
        if path.exists():
            return _bili_shrink_for_forward(path)
        with PillowImage.open(io.BytesIO(data)) as picture:
            picture.load()
            picture.convert("RGB").save(path)
        return _bili_shrink_for_forward(path)
    except Exception:
        return download_image(url, directory)


# 合并转发里的图片在 OneBot 侧会被整张转成 base64 塞进一个 JSON。B 站官号的「长图」
# 动态（例如 1000x16383 的公告长图）原图能到 17MB，base64 后约 31MB —— 单个 JSON
# 请求体这么大，QQ 协议端很容易拒收或超时，动态就会「推送成功但群里看不到」。
# 所以放进合并转发前先按尺寸压一道：只在确实过大时才动，缩完仍能看清长图内容。
BILI_FORWARD_MAX_HEIGHT = 8192
BILI_FORWARD_MAX_WIDTH = 1600


def _bili_shrink_for_forward(path: str) -> str:
    """把过大的配图缩到适合合并转发的大小（只用标准 Pillow，不引入新依赖）。

    小图原样返回（不重编码、不变格式），保持通知与公告卡片的观感一致。
    任何失败都退回原路径：宁可发原图，也不要因为压缩把整条动态搞失败。
    """
    try:
        with PillowImage.open(path) as picture:
            width, height = picture.size
            if height <= BILI_FORWARD_MAX_HEIGHT and width <= BILI_FORWARD_MAX_WIDTH:
                return path
            scale = min(
                BILI_FORWARD_MAX_HEIGHT / height,
                BILI_FORWARD_MAX_WIDTH / width,
            )
            size = (max(1, int(width * scale)), max(1, int(height * scale)))
            shrunk = Path(path).with_suffix(".small.jpg")
            if not shrunk.exists():
                picture.convert("RGB").resize(size, PillowImage.LANCZOS).save(
                    shrunk, "JPEG", quality=88, optimize=True
                )
            # 缓存命中时也要读回真实尺寸：一是日志别报错，二是别把半截/损坏的缓存发出去
            with PillowImage.open(shrunk) as check:
                check.load()
                final = check.size
        logger.info(
            "[方舟B站] 配图过大已压缩用于合并转发: %sx%s -> %sx%s (%.1fMB -> %.1fMB)",
            width, height, final[0], final[1],
            os.path.getsize(path) / 1048576, os.path.getsize(shrunk) / 1048576,
        )
        return str(shrunk)
    except Exception as error:  # noqa: BLE001 - 压缩失败不该影响推送
        logger.warning("[方舟B站] 配图压缩失败，改用原图: %s", error)
        return path


# --------------------------------------------------------------------------- #
# 临时 HTTP 文件服务（照 astrbot_plugin_yt_dlp._start_http_server 的方式）
# --------------------------------------------------------------------------- #
class BiliVideoFileServer:
    """把下载好的视频用 http://127.0.0.1:<port>/<file> 暴露给 QQ 协议端。

    yt-dlp 插件就是这么发的（`Video(file=furl, url=furl)`）；这里照做，
    但用自己的临时目录和端口，不碰那个插件的任何文件。
    """

    def __init__(self, directory: str):
        self.directory = directory
        os.makedirs(directory, exist_ok=True)
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None
        self.port = 0

    def start(self) -> None:
        directory = self.directory

        class _Handler(SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=directory, **kwargs)

            def log_message(self, fmt, *args):  # noqa: A002 - 保持标准库签名
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        self._server = server
        self.port = server.server_port
        self._thread = threading.Thread(target=server.serve_forever, daemon=True)
        self._thread.start()

    def url_for(self, filename: str) -> str:
        return f"http://127.0.0.1:{self.port}/{filename}"

    def stop(self) -> None:
        if self._server is not None:
            try:
                self._server.shutdown()
                self._server.server_close()
            except Exception:
                pass
            self._server = None


def cleanup_bili_temp(directory: str, max_age: int = BILI_STALE_TEMP_SECONDS) -> None:
    """清理自己临时目录里的过期残留（只动 /tmp/arknights-news-bili）。"""
    now = time.time()
    if not os.path.isdir(directory):
        return
    for name in os.listdir(directory):
        path = os.path.join(directory, name)
        try:
            if now - os.path.getmtime(path) < max_age:
                continue
            if os.path.isdir(path):
                shutil.rmtree(path)
            else:
                os.remove(path)
        except OSError:
            continue


@register(
    "astrbot_plugin_arknights_news",
    "Leiothrix/Codex",
    "自动监控明日方舟官网情报中心新公告，并以卡片形式推送到指定群聊",
    "2.0.0",
)
class ArknightsNewsPlugin(Star):
    def __init__(self, context: Context, config: AstrBotConfig):
        super().__init__(context)
        self.context = context
        self.config = config
        self.state = NewsState("astrbot_plugin_arknights_news")
        self.renderer = NewsCardRenderer(self.state.card_dir)
        self.web_admin: ArknightsNewsWebAdminServer | None = None
        self._task: asyncio.Task | None = None
        self._reminder_task: asyncio.Task | None = None
        self._last_status = "尚未检查"
        self._check_lock = asyncio.Lock()
        # ---- B 站这一路（与官网公告完全隔离）----
        self._bili_task: asyncio.Task | None = None
        self._bili_status = "尚未检查"
        self._bili_check_lock = asyncio.Lock()
        self._bili_file_server: BiliVideoFileServer | None = None
        self._bili_video_lock = asyncio.Lock()
        self._bili_video_semaphore = asyncio.Semaphore(BILI_VIDEO_CONCURRENCY)
        self._bili_json5_warned = False

    async def initialize(self):
        self._task = asyncio.create_task(self._check_loop())
        if bool(self.config.get("reminder_enabled", True)):
            self._reminder_task = asyncio.create_task(self._reminder_loop())
        if bool(self.config.get("webui_enabled", False)):
            port = int(self.config.get("webui_port", 6192) or 6192)
            self.web_admin = ArknightsNewsWebAdminServer(self, port=port)
            await self.web_admin.start()
        self._bili_start()
        logger.info(
            "[方舟公告] 后台检查循环已启动。提醒调度: %s, B站官号: %s",
            "开启" if self._reminder_task else "关闭",
            "开启" if self._bili_task else "关闭",
        )

    async def _check_loop(self):
        await self._wait_for_target_platforms()
        first_run = True
        while True:
            try:
                await self._check_once(
                    push_existing=bool(self.config.get("send_existing_on_first_run", False)) and first_run
                )
                first_run = False
                interval = max(int(self.config.get("check_interval_minutes", 10) or 10), 1)
                await asyncio.sleep(interval * 60)
            except asyncio.CancelledError:
                break
            except Exception as e:
                self._last_status = f"检查异常: {e}"
                logger.error(f"[方舟公告] 检查循环异常: {e}")
                await asyncio.sleep(60)

    async def _check_once(self, push_existing: bool = False) -> list[ArknightsNewsItem]:
        async with self._check_lock:
            return await self._check_locked(push_existing)

    async def _check_locked(self, push_existing: bool = False) -> list[ArknightsNewsItem]:
        items = await asyncio.to_thread(fetch_latest_news, 30)
        if not items:
            self._last_status = "没有抓到公告"
            return []

        seen = self.state.seen_cids
        if not seen and not push_existing:
            self.state.mark_seen([item.cid for item in items])
            self._last_status = f"首次建立基线: {items[0].title}"
            return []

        new_items = [item for item in items if item.cid not in seen]
        new_items.sort(key=lambda x: (x.display_time, x.cid))
        max_push = max(int(self.config.get("max_push_per_check", 3) or 3), 1)
        new_items = new_items[-max_push:]

        if not new_items:
            self._last_status = f"无新公告，最新: {items[0].title}"
            return []

        targets = self._targets()
        if not targets:
            self._last_status = f"发现 {len(new_items)} 条新公告，但没有推送目标，保留未读等待重试"
            return new_items

        success_count = 0
        for item in new_items:
            if await self._push_item(item, targets):
                success_count += 1
                self.state.mark_seen([item.cid])
        if success_count:
            self._last_status = f"已推送 {success_count} 条新公告"
        else:
            self._last_status = f"发现 {len(new_items)} 条新公告，但全部推送失败，保留未读等待重试"
        return new_items

    # ================= B 站官号：视频 / 动态 =================
    # 硬性隔离：这些方法里的任何异常都在 _bili_loop 里被吞掉并记日志，
    # 绝不会冒泡到 _check_loop，官网公告推送不受影响。

    def _bili_start(self):
        if getattr(self, "_bili_task", None) is not None:
            return
        if not self._bili_cfg("bili_enabled"):
            logger.info("[方舟B站] 未启用（bili_enabled=false），跳过 B 站检查循环")
            return
        try:
            cleanup_bili_temp(BILI_VIDEO_DIR)
        except Exception as error:  # noqa: BLE001
            logger.warning("[方舟B站] 清理临时目录失败: %s", error)
        try:
            self._bili_file_server = BiliVideoFileServer(BILI_VIDEO_DIR)
            self._bili_file_server.start()
        except Exception as error:  # noqa: BLE001
            self._bili_file_server = None
            logger.error("[方舟B站] 视频临时文件服务启动失败（视频将无法发送）: %s", error)
        self._bili_task = asyncio.create_task(self._bili_loop())
        logger.info(
            "[方舟B站] 检查循环已启动。mid=%s 间隔=%s分钟 文件服务端口=%s",
            self._bili_cfg("bili_mid"),
            self._bili_cfg("bili_check_interval_minutes"),
            self._bili_file_server.port if self._bili_file_server else "不可用",
        )

    def _bili_cfg(self, key: str):
        """读 B 站配置；schema 还没被 AstrBot 刷进配置文件时退回 schema 默认值。"""
        available = True
        try:
            if "bili_enabled" not in self.config:
                available = False
        except Exception:  # noqa: BLE001 - 配置对象形状不确定时保守处理
            available = False
        if not available:
            if not self._bili_json5_warned:
                self._bili_json5_warned = True
                logger.warning(
                    "[方舟B站] 配置文件里还没有 bili_* 键，本次运行使用 schema 默认值；"
                    "在插件配置页保存一次即可写入配置文件。"
                )
            return BILI_CONFIG_DEFAULTS.get(key)
        value = self.config.get(key)
        return BILI_CONFIG_DEFAULTS.get(key) if value is None else value

    def _bili_int(self, key: str, minimum: int = 1) -> int:
        try:
            return max(int(self._bili_cfg(key)), minimum)
        except (TypeError, ValueError):
            return max(int(BILI_CONFIG_DEFAULTS.get(key) or minimum), minimum)

    async def _bili_loop(self):
        """独立循环：与官网公告的 _check_loop 互不影响。"""
        await self._wait_for_target_platforms()
        first_run = True
        while True:
            try:
                await self._bili_check_once(push_existing=False, first_run=first_run)
            except asyncio.CancelledError:
                raise
            except BiliError as error:
                self._bili_status = f"B站检查失败: {error}"
                logger.error("[方舟B站] 检查失败（官网公告不受影响）: %s", error)
            except Exception as error:  # noqa: BLE001 - 兜底，绝不让循环挂掉
                self._bili_status = f"B站检查异常: {error}"
                logger.error("[方舟B站] 检查异常（官网公告不受影响）: %s", error, exc_info=True)
            first_run = False
            await asyncio.sleep(self._bili_int("bili_check_interval_minutes") * 60)

    async def _bili_check_once(self, push_existing: bool = False, first_run: bool = False) -> dict:
        """抓一次 B 站数据并按需推送。返回统计字典（测试脚本也用它）。

        加了一把非阻塞锁：定时循环和手动命令同时触发时，后者直接跳过，
        避免同一批新内容被查两遍。
        """
        if self._bili_check_lock.locked():
            logger.info("[方舟B站] 上一次检查还在进行，本次跳过")
            return {"skipped": True, "dynamics": 0, "videos": 0, "pushed": 0, "first_run": False}
        async with self._bili_check_lock:
            return await self._bili_check_locked(push_existing, first_run)

    async def _bili_check_locked(self, push_existing: bool = False, first_run: bool = False) -> dict:
        def _fetch():
            dynamics, videos = build_targets(
                str(self._bili_cfg("bili_mid")),
                cookies_path=str(self._bili_cfg("bili_cookies_path") or "") or None,
                limit=15,
                detail_limit=8,
            )
            return dynamics, videos

        dynamics, videos = await asyncio.to_thread(_fetch)
        stats = {"dynamics": len(dynamics), "videos": len(videos), "pushed": 0, "first_run": False}

        if first_run and not push_existing:
            # SPEC §4-2：首次运行只建立基线、不刷屏
            self.state.mark_dynamic_seen([item.dynamic_id for item in dynamics])
            self.state.mark_bvid_seen([video.bvid for video in videos])
            stats["first_run"] = True
            self._bili_status = f"首次建立基线: 动态{len(dynamics)}条 / 视频{len(videos)}条"
            logger.info(
                "[方舟B站] 首次运行只建立基线，不推送。动态 %s 条，视频 %s 条",
                len(dynamics),
                len(videos),
            )
            return stats

        pushed = 0
        if self._bili_cfg("bili_push_video"):
            pushed += await self._bili_push_new_videos(videos, stats)
        if self._bili_cfg("bili_push_dynamic"):
            pushed += await self._bili_push_new_dynamics(dynamics, stats)
        stats["pushed"] = pushed
        self._bili_status = (
            f"动态 {stats['dynamics']} 条(新 {stats.get('new_dynamics', 0)}) / "
            f"视频 {stats['videos']} 个(新 {stats.get('new_videos', 0)})，已推送 {pushed}"
        )
        logger.info(
            "[方舟B站] 本轮检查完成: 动态 %s 条(新 %s) / 视频 %s 个(新 %s)，已推送 %s",
            stats["dynamics"],
            stats.get("new_dynamics", 0),
            stats["videos"],
            stats.get("new_videos", 0),
            pushed,
        )
        return stats

    async def _bili_push_new_videos(self, videos: list[BiliVideo], stats: dict) -> int:
        seen = self.state.seen_bvids
        fresh = [video for video in videos if video.bvid and video.bvid not in seen]
        fresh.sort(key=lambda item: item.pub_ts)
        limit = self._bili_int("bili_max_push_per_check")
        stats["new_videos"] = len(fresh)
        if not fresh:
            return 0
        targets = self._targets()
        if not targets:
            logger.warning("[方舟B站] 发现 %s 个新视频但没有推送目标，保留未读等待重试", len(fresh))
            return 0
        pushed = 0
        for video in fresh[-limit:]:
            try:
                if await self._bili_handle_video(video, targets):
                    pushed += 1
                    self.state.mark_bvid_seen([video.bvid])
            except Exception as error:  # noqa: BLE001 - 单个视频失败不影响其它
                logger.error("[方舟B站] 视频处理失败 bvid=%s: %s", video.bvid, error, exc_info=True)
        return pushed

    async def _bili_push_new_dynamics(self, dynamics: list[BiliDynamic], stats: dict) -> int:
        seen = self.state.seen_dynamic_ids
        fresh = [
            item
            for item in dynamics
            if item.dynamic_id and item.dynamic_id not in seen and not item.is_video_post
        ]
        fresh.sort(key=lambda item: item.pub_ts)
        limit = self._bili_int("bili_max_push_per_check")
        stats["new_dynamics"] = len(fresh)
        if not fresh:
            return 0
        targets = self._targets()
        if not targets:
            logger.warning("[方舟B站] 发现 %s 条新动态但没有推送目标，保留未读等待重试", len(fresh))
            return 0
        pushed = 0
        for dynamic in fresh[-limit:]:
            try:
                if await self._bili_push_dynamic(dynamic, targets):
                    pushed += 1
                    self.state.mark_dynamic_seen([dynamic.dynamic_id])
            except Exception as error:  # noqa: BLE001 - 单条动态失败不影响其它
                logger.error(
                    "[方舟B站] 动态推送失败 dynamic_id=%s: %s", dynamic.dynamic_id, error, exc_info=True
                )
        return pushed

    async def _bili_push_dynamic(self, dynamic: BiliDynamic, targets: list[str]) -> bool:
        """一条动态：卡片；带图则卡片 + 原图合并转发（不 @全体，SPEC 决定 1）。"""
        cards = await asyncio.to_thread(
            render_dynamic_card, dynamic, self.state.card_dir, 1
        )
        if not cards:
            logger.error("[方舟B站] 动态卡片渲染为空 dynamic_id=%s", dynamic.dynamic_id)
            return False

        node_title = (
            f"{dynamic.author or '明日方舟'} · {dynamic.pub_time_text}\n"
            f"来源：B站动态\n{dynamic.url}"
        )
        max_images = max(0, BILI_MAX_FORWARD_IMAGES - len(cards))
        use_forward = bool(dynamic.images) and max_images > 0
        at_all = bool(self._bili_cfg("bili_at_all_dynamic"))

        pushed = False
        for target in targets:
            try:
                if not await self._bili_platform_ready(target):
                    raise ValueError("B站推送需要 QQ OneBot 平台")
                bot_id = await self._bili_bot_id(target)
                if use_forward:
                    nodes = [
                        Node(
                            name="黍 · 方舟B站",
                            uin=str(bot_id),
                            content=[Plain(node_title)],
                        )
                    ]
                    nodes.extend(
                        Node(name="动态卡片", uin=str(bot_id), content=[Image.fromFileSystem(path)])
                        for path in cards
                    )
                    downloaded = await self._bili_dynamic_images(dynamic.images[:max_images], bot_id)
                    nodes.extend(downloaded)
                    if not downloaded and len(dynamic.images) > 0:
                        nodes.append(
                            Node(
                                name="B站动态",
                                uin=str(bot_id),
                                content=[Plain(f"配图加载失败，请查看原动态：\n{dynamic.url}")],
                            )
                        )
                    chain = [Nodes(nodes), Plain(BILI_DYNAMIC_TEXT)]
                else:
                    chain = [Image.fromFileSystem(cards[0]), Plain(f"\n{BILI_DYNAMIC_TEXT}\n{dynamic.url}")]
                if at_all and bili_is_group_target(target):
                    chain.insert(0, At(qq="all"))
                sent = await self.context.send_message(
                    target, MessageEventResult(chain=chain).use_t2i(False)
                )
                if sent:
                    pushed = True
                    logger.info(
                        "[方舟B站] 已推送动态 dynamic_id=%s target=%s 合并转发=%s 配图=%s",
                        dynamic.dynamic_id,
                        target,
                        use_forward,
                        len(dynamic.images),
                    )
                else:
                    logger.warning(
                        "[方舟B站] 动态未发送 dynamic_id=%s target=%s: 平台未就绪", dynamic.dynamic_id, target
                    )
            except Exception as error:  # noqa: BLE001 - 单个目标失败继续其它目标
                logger.error(
                    "[方舟B站] 动态推送失败 dynamic_id=%s target=%s: %s",
                    dynamic.dynamic_id,
                    target,
                    error,
                    exc_info=True,
                )
        return pushed

    async def _bili_dynamic_images(self, urls: list[str], bot_id: str = "0") -> list[Node]:
        semaphore = asyncio.Semaphore(3)

        async def one(url: str) -> Node | None:
            async with semaphore:
                try:
                    path = await asyncio.to_thread(_bili_download_image, url, self.state.card_dir)
                    return Node(name="动态原图", uin=str(bot_id), content=[Image.fromFileSystem(path)])
                except Exception as error:  # noqa: BLE001
                    logger.warning("[方舟B站] 配图下载失败 url=%s: %s", url, error)
                    return None

        results = await asyncio.gather(*(one(url) for url in urls)) if urls else []
        return [node for node in results if node is not None]

    async def _bili_handle_video(self, video: BiliVideo, targets: list[str]) -> bool:
        """一个投稿：超限 -> 卡片 + 原链接；正常 -> 下载合并后发视频（@全体）。"""
        max_minutes = self._bili_int("bili_video_max_duration_minutes")
        max_mb = self._bili_int("bili_video_max_size_mb")

        if not video.duration or video.duration <= 0:
            # 时长拿不到就不下载（对齐 yt-dlp 插件「没查到时长就不下载」的保守策略）
            try:
                detail = await asyncio.to_thread(self._bili_video_detail, video.bvid)
                video = detail.to_video()
            except Exception as error:  # noqa: BLE001
                logger.warning("[方舟B站] 拉取视频详情失败 bvid=%s: %s", video.bvid, error)

        reason = video.oversize_reason(max_minutes, max_mb)
        if reason or not video.duration:
            if not reason:
                reason = "没有解析到视频时长，为避免下载超大文件先不下载"
            logger.info("[方舟B站] 视频超限/不可下载，改发卡片+原链接 bvid=%s 原因=%s", video.bvid, reason)
            return await self._bili_push_video_card(video, targets, reason)

        try:
            merged, size = await self._bili_download_and_merge(video)
        except Exception as error:  # noqa: BLE001 - 下载失败降级为卡片，仍然通知有新视频
            logger.error("[方舟B站] 视频下载/合并失败 bvid=%s: %s", video.bvid, error, exc_info=True)
            return await self._bili_push_video_card(video, targets, f"下载失败：{error}")

        try:
            size_reason = video.oversize_reason(max_minutes, max_mb, size_bytes=size)
            if size_reason:
                logger.info(
                    "[方舟B站] 合并后体积超限，改发卡片+原链接 bvid=%s 原因=%s", video.bvid, size_reason
                )
                return await self._bili_push_video_card(video, targets, size_reason)
            return await self._bili_send_video(video, merged, size, targets)
        finally:
            try:
                os.remove(merged)
            except OSError:
                pass

    async def _bili_download_and_merge(self, video: BiliVideo) -> tuple[str, int]:
        """照 astrbot_plugin_yt_dlp 的方式：yt-dlp 分别拉视频/音频流，ffmpeg 合并。"""
        async with self._bili_video_semaphore:
            in_flight = self._bili_video_lock.locked()
            if in_flight:
                logger.info("[方舟B站] 有视频正在下载，bvid=%s 排队等待", video.bvid)
            async with self._bili_video_lock:
                return await asyncio.to_thread(self._bili_download_blocking, video)

    def _bili_download_blocking(self, video: BiliVideo) -> tuple[str, int]:
        import imageio_ffmpeg
        import yt_dlp

        try:
            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:  # noqa: BLE001
            ffmpeg_exe = "ffmpeg"

        cookies_path = str(self._bili_cfg("bili_cookies_path") or "")
        os.makedirs(BILI_VIDEO_DIR, exist_ok=True)
        stamp = time.time_ns()
        v_tmpl = os.path.join(BILI_VIDEO_DIR, f"v_{stamp}_%(id)s.%(ext)s")
        a_tmpl = os.path.join(BILI_VIDEO_DIR, f"a_{stamp}_%(id)s.%(ext)s")
        merged = os.path.join(BILI_VIDEO_DIR, f"final_{stamp}_{video.bvid}.mp4")

        net_opts: dict = {
            "retries": 10,
            "fragment_retries": 10,
            "file_access_retries": 3,
            "socket_timeout": 20,
            "continuedl": True,
        }
        if cookies_path and os.path.isfile(cookies_path):
            net_opts["cookiefile"] = cookies_path

        headers = {
            "Origin": "https://www.bilibili.com",
            "Referer": "https://www.bilibili.com",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
        }

        def _stream(fmt: str, tmpl: str) -> str:
            opts = {
                "outtmpl": tmpl,
                **net_opts,
                "format": fmt,
                "noplaylist": True,
                "quiet": True,
                "no_warnings": True,
                "http_headers": headers,
            }
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(video.url, download=True)
                return ydl.prepare_filename(info)

        logger.info("[方舟B站] 开始下载视频 bvid=%s 标题=%s", video.bvid, video.title[:40])
        v_path = _stream(BILI_VIDEO_FORMAT, v_tmpl)
        a_path = _stream(BILI_AUDIO_FORMAT, a_tmpl)

        command = [ffmpeg_exe, "-i", v_path, "-i", a_path, "-c:v", "copy", "-c:a", "copy", "-y", merged]
        completed = subprocess.run(command, capture_output=True, timeout=BILI_MERGE_TIMEOUT, check=False)
        if completed.returncode != 0:
            retry = [ffmpeg_exe, "-i", v_path, "-i", a_path, "-c:v", "copy", "-c:a", "aac", "-y", merged]
            completed = subprocess.run(retry, capture_output=True, timeout=BILI_MERGE_TIMEOUT, check=False)
        for path in (v_path, a_path):
            try:
                os.remove(path)
            except OSError:
                pass
        if completed.returncode != 0 or not os.path.exists(merged):
            detail = (completed.stderr or b"").decode("utf-8", errors="ignore")[:300]
            raise RuntimeError(f"ffmpeg 合并失败: {detail}".strip())
        size = os.path.getsize(merged)
        logger.info(
            "[方舟B站] 下载合并完成 bvid=%s 体积=%.1fMB 路径=%s", video.bvid, size / 1024 / 1024, merged
        )
        return merged, size

    async def _bili_send_video(
        self, video: BiliVideo, merged_path: str, size: int, targets: list[str]
    ) -> bool:
        """照 yt-dlp 插件的方式发：临时 HTTP 服务暴露 URL，再用 Video 组件发出去。"""
        server = self._bili_file_server
        if server is None or not server.port:
            logger.error("[方舟B站] 视频文件服务未启动，无法发送 bvid=%s", video.bvid)
            return await self._bili_push_video_card(video, targets, "视频文件服务未启动")
        url = server.url_for(os.path.basename(merged_path))
        at_all = bool(self._bili_cfg("bili_at_all_video"))

        pushed = False
        for target in targets:
            try:
                if not await self._bili_platform_ready(target):
                    raise ValueError("B站视频推送需要 QQ OneBot 平台")
                chain = [Plain(BILI_VIDEO_TEXT)]
                if at_all and bili_is_group_target(target):
                    chain.insert(0, At(qq="all"))
                chain.append(Video(file=url, url=url))
                sent = await self.context.send_message(
                    target, MessageEventResult(chain=chain).use_t2i(False)
                )
                if sent:
                    pushed = True
                    logger.info(
                        "[方舟B站] 已推送视频 bvid=%s target=%s 体积=%.1fMB url=%s",
                        video.bvid,
                        target,
                        size / 1024 / 1024,
                        url,
                    )
                else:
                    logger.warning(
                        "[方舟B站] 视频未发送 bvid=%s target=%s: 平台未就绪", video.bvid, target
                    )
            except Exception as error:  # noqa: BLE001
                logger.error(
                    "[方舟B站] 视频发送失败 bvid=%s target=%s: %s", video.bvid, target, error, exc_info=True
                )
        return pushed

    async def _bili_push_video_card(self, video: BiliVideo, targets: list[str], reason: str) -> bool:
        """超限/下载失败时的落点：卡片 + 原链接（SPEC §0.1 决定 3）。"""
        cards = await asyncio.to_thread(render_video_card, video, self.state.card_dir, 1)
        if not cards:
            logger.error("[方舟B站] 视频卡片渲染为空 bvid=%s", video.bvid)
            return False
        at_all = bool(self._bili_cfg("bili_at_all_video"))
        text = f"{BILI_VIDEO_TEXT}\n{video.title}\n{video.url}"
        if reason:
            text += f"\n（未直接发送视频：{reason}）"

        pushed = False
        for target in targets:
            try:
                if not await self._bili_platform_ready(target):
                    raise ValueError("B站推送需要 QQ OneBot 平台")
                chain = [Image.fromFileSystem(cards[0]), Plain("\n" + text)]
                if at_all and bili_is_group_target(target):
                    chain.insert(0, At(qq="all"))
                sent = await self.context.send_message(
                    target, MessageEventResult(chain=chain).use_t2i(False)
                )
                if sent:
                    pushed = True
                    logger.info(
                        "[方舟B站] 已推送视频卡片 bvid=%s target=%s 原因=%s", video.bvid, target, reason
                    )
                else:
                    logger.warning(
                        "[方舟B站] 视频卡片未发送 bvid=%s target=%s: 平台未就绪", video.bvid, target
                    )
            except Exception as error:  # noqa: BLE001
                logger.error(
                    "[方舟B站] 视频卡片发送失败 bvid=%s target=%s: %s",
                    video.bvid,
                    target,
                    error,
                    exc_info=True,
                )
        return pushed

    async def _bili_platform_ready(self, target: str) -> bool:
        """沿用官网公告的口径：必须是有 bot 句柄的 aiocqhttp 平台。

        合并转发 / 本地图片都需要 bot 句柄，所以这里比官网那条路多要求 `bot`。
        """
        platform_id = str(target).split(":", 1)[0]
        platform = next(
            (
                entry
                for entry in self.context.platform_manager.platform_insts
                if entry.meta().id == platform_id
            ),
            None,
        )
        if not platform or platform.meta().name != "aiocqhttp" or getattr(platform, "bot", None) is None:
            return False
        return True

    async def _bili_bot_id(self, target: str) -> str:
        """合并转发节点的 uin —— 用机器人自己的 QQ 号，和官网公告一致。"""
        platform_id = str(target).split(":", 1)[0]
        platform = next(
            (
                entry
                for entry in self.context.platform_manager.platform_insts
                if entry.meta().id == platform_id
            ),
            None,
        )
        if platform is None:
            return "0"
        try:
            login = await platform.bot.call_action("get_login_info")
            return str(login.get("user_id") or "0")
        except Exception as error:  # noqa: BLE001
            logger.warning("[方舟B站] 取机器人 QQ 号失败，合并转发 uin 退化为 0: %s", error)
            return "0"

    def _bili_video_detail(self, bvid: str) -> BiliVideoDetail:
        from .bili import BiliClient

        client = BiliClient(str(self._bili_cfg("bili_cookies_path") or "") or None)
        return client.fetch_video_detail(bvid)

    async def _push_item(self, item: ArknightsNewsItem, targets: list[str]) -> bool:
        item = await asyncio.to_thread(fetch_news_detail, item)
        img_paths = await asyncio.to_thread(self.renderer.render, item, self.state.card_style)
        pushed = True
        for target in targets:
            if self.state.was_delivered(item.cid, target):
                continue
            try:
                chain = await self._make_message(item, img_paths, target, include_notice=False)
                sent = await self.context.send_message(target, chain)
                if sent:
                    logger.info(f"[方舟公告] 已推送 cid={item.cid} target={target}")
                    self.state.mark_delivered(item.cid, target)
                    await self._send_notice(item, target)
                else:
                    pushed = False
                    logger.warning(f"[方舟公告] 推送未发送 cid={item.cid} target={target}: platform not ready")
            except Exception as e:
                pushed = False
                logger.error(f"[方舟公告] 推送失败 cid={item.cid} target={target}: {e}")
        return pushed

    def _register_reminder(self, item: ArknightsNewsItem):
        """公告正文里能解析到停服维护时间时，登记两条待发提醒。"""
        if not bool(self.config.get("reminder_enabled", True)):
            return
        if self.state.has_reminder(item.cid):
            return
        window = parse_maintenance_window(item.content)
        if not window:
            return
        start, end = window
        now = now_cn()
        if end <= now:
            return
        advance = max(int(self.config.get("reminder_advance_minutes", 5) or 5), 1)
        self.state.add_reminder(
            {
                "cid": item.cid,
                "title": item.title,
                "start_ts": start.timestamp(),
                "end_ts": end.timestamp(),
                "sent_pre": start <= now,
                "sent_open": False,
            }
        )
        logger.info("[方舟公告] 已登记维护提醒 cid=%s %s ~ %s", item.cid, start, end)

    async def _reminder_loop(self):
        await self._wait_for_target_platforms()
        while True:
            try:
                await self._dispatch_reminders()
            except asyncio.CancelledError:
                break
            except Exception as error:
                logger.error(f"[方舟公告] 提醒调度异常: {error}")
            await asyncio.sleep(30)

    async def _dispatch_reminders(self):
        targets = self._targets()
        if not targets:
            return
        now = now_cn()
        advance = max(int(self.config.get("reminder_advance_minutes", 5) or 5), 1)
        for record in list(self.state.reminders):
            cid = str(record.get("cid") or "")
            start = datetime.fromtimestamp(float(record.get("start_ts") or 0))
            end = datetime.fromtimestamp(float(record.get("end_ts") or 0))
            if not record.get("sent_pre") and start - timedelta(minutes=advance) <= now <= start:
                await self._send_reminder(pre_reminder_text(advance), targets)
                self.state.patch_reminder(cid, sent_pre=True)
                logger.info("[方舟公告] 已发送维护前提醒 cid=%s", cid)
            if not record.get("sent_open") and end <= now <= end + timedelta(minutes=30):
                await self._send_reminder(open_reminder_text(), targets)
                self.state.patch_reminder(cid, sent_open=True)
                logger.info("[方舟公告] 已发送开服提醒 cid=%s", cid)
        self.state.drop_expired_reminders(now.timestamp() - 86400)

    async def _send_reminder(self, text: str, targets: list[str]):
        for target in targets:
            parts = target.split(":", 2)
            is_group = len(parts) > 1 and parts[1] == "GroupMessage"
            chain = [At(qq="all"), Plain(" " + text)] if is_group else [Plain(text)]
            try:
                await self.context.send_message(
                    target, MessageEventResult(chain=chain).use_t2i(False)
                )
            except Exception as error:
                logger.warning("[方舟公告] 提醒发送失败 target=%s: %s", target, error)
                if is_group:
                    try:
                        await self.context.send_message(
                            target, MessageEventResult(chain=[Plain(text)]).use_t2i(False)
                        )
                    except Exception as fallback_error:
                        logger.warning("[方舟公告] 普通提醒也发送失败 target=%s: %s", target, fallback_error)

    async def _send_notice(self, item, target):
        text = announcement_text(item)
        is_group = target.split(":", 2)[1] == "GroupMessage"
        parts = [At(qq="all"), Plain(" " + text)] if is_group else [Plain(text)]
        try:
            await self.context.send_message(target, MessageEventResult(chain=parts).use_t2i(False))
        except Exception as error:
            logger.warning("[方舟公告] 提醒发送失败 cid=%s target=%s: %s", item.cid, target, error)
            if is_group:
                try:
                    await self.context.send_message(target, MessageEventResult(chain=[Plain(text)]).use_t2i(False))
                except Exception as fallback_error:
                    logger.warning("[方舟公告] 普通提示也发送失败 cid=%s: %s", item.cid, fallback_error)

    async def _make_message(self, item, cards, target, include_notice=True):
        platform_id = target.split(":", 1)[0]
        platform = next((entry for entry in self.context.platform_manager.platform_insts if entry.meta().id == platform_id), None)
        if not platform or platform.meta().name != "aiocqhttp":
            raise ValueError("公告推送需要 QQ OneBot 平台，不降级为散图发送")
        login = await platform.bot.call_action("get_login_info")
        return await build_message(item, cards, self.state.card_dir, login["user_id"], include_notice=include_notice)

    async def _wait_for_target_platforms(self, timeout_seconds: int = 180):
        deadline = asyncio.get_running_loop().time() + timeout_seconds
        while True:
            missing = self._missing_target_platforms()
            if not missing:
                return
            if asyncio.get_running_loop().time() >= deadline:
                logger.warning(f"[方舟公告] 等待目标平台超时，继续检查: missing={sorted(missing)}")
                return
            logger.info(f"[方舟公告] 等待目标平台加载: {sorted(missing)}")
            await asyncio.sleep(5)

    def _missing_target_platforms(self) -> set[str]:
        target_platforms = {target.split(":", 1)[0] for target in self._targets() if ":" in target}
        if not target_platforms:
            return set()
        available = {
            platform.meta().id
            for platform in getattr(self.context.platform_manager, "platform_insts", [])
        }
        return target_platforms - available

    def _targets(self) -> list[str]:
        configured = self.config.get("target_umos", []) or []
        if isinstance(configured, str):
            configured = [configured]
        return [self._normalize_target(target) for target in self.state.get_targets(configured)]

    def _normalize_target(self, target: str) -> str:
        value = str(target or "").strip()
        if not value:
            return value
        if ":" in value:
            platform_name, rest = value.split(":", 1)
            mapped = self._map_platform_name(platform_name)
            if mapped != platform_name:
                return f"{mapped}:{rest}"
            return value
        if value.isdigit():
            return f"{self._default_group_platform_id()}:GroupMessage:{value}"
        return value

    def _map_platform_name(self, platform_name: str) -> str:
        for platform in getattr(self.context.platform_manager, "platforms_config", []):
            if not platform.get("enable", False):
                continue
            if platform.get("id") == platform_name:
                return platform_name
            if platform.get("type") == platform_name:
                return str(platform.get("id") or platform_name)
        return platform_name

    def _default_group_platform_id(self) -> str:
        for platform in getattr(self.context.platform_manager, "platforms_config", []):
            if platform.get("enable", False) and platform.get("type") == "aiocqhttp":
                return str(platform.get("id") or "aiocqhttp")
        return "aiocqhttp"

    @filter.command("方舟公告绑定")
    @filter.permission_type(filter.PermissionType.ADMIN)
    async def bind_current_group(self, event: AstrMessageEvent):
        group_id = event.get_group_id()
        if not group_id:
            yield event.plain_result("请在要接收公告的群聊里使用这个指令。")
            return
        self.state.add_target(event.unified_msg_origin)
        yield event.plain_result("已绑定本群为明日方舟公告推送目标。")

    @filter.command("方舟公告解绑")
    @filter.permission_type(filter.PermissionType.ADMIN)
    async def unbind_current_group(self, event: AstrMessageEvent):
        group_id = event.get_group_id()
        if not group_id:
            yield event.plain_result("请在群聊里使用这个指令。")
            return
        self.state.remove_target(event.unified_msg_origin)
        yield event.plain_result("已取消本群的明日方舟公告推送。")

    @filter.command("方舟公告状态")
    async def status(self, event: AstrMessageEvent):
        targets = self._targets()
        yield event.plain_result(
            f"明日方舟公告监控运行中。\n"
            f"推送目标数: {len(targets)}\n"
            f"已记录公告数: {len(self.state.seen_cids)}\n"
            f"待发维护提醒: {len([r for r in self.state.reminders if not (r.get('sent_pre') and r.get('sent_open'))])}\n"
            f"WebUI: {'开启' if self.web_admin else '关闭'}\n"
            f"最近状态: {self._last_status}\n"
            f"—— B站官号 ——\n"
            f"状态: {'开启' if (self._bili_task and not self._bili_task.done()) else '关闭'}\n"
            f"已记录动态数: {len(self.state.seen_dynamic_ids)}\n"
            f"已记录视频数: {len(self.state.seen_bvids)}\n"
            f"视频文件服务: {'端口 ' + str(self._bili_file_server.port) if self._bili_file_server else '不可用'}\n"
            f"最近状态: {self._bili_status}"
        )

    @filter.command("方舟提醒测试")
    @filter.permission_type(filter.PermissionType.ADMIN)
    async def test_reminder(self, event: AstrMessageEvent):
        advance = max(int(self.config.get("reminder_advance_minutes", 5) or 5), 1)
        await self._send_reminder(pre_reminder_text(advance), [event.unified_msg_origin])
        yield event.plain_result("维护提醒格式已按测试样例发送。")

    @filter.command("方舟公告检查")
    @filter.permission_type(filter.PermissionType.ADMIN)
    async def manual_check(self, event: AstrMessageEvent):
        items = await self._check_once(push_existing=True)
        if items:
            yield event.plain_result(f"检查完成，发现 {len(items)} 条新公告。\n{self._last_status}")
        else:
            yield event.plain_result(f"检查完成，没有新公告。\n{self._last_status}")

    @filter.command("方舟公告测试")
    @filter.permission_type(filter.PermissionType.ADMIN)
    async def test_latest(self, event: AstrMessageEvent):
        items = await asyncio.to_thread(fetch_latest_news, 1)
        if not items:
            yield event.plain_result("没有抓到公告。")
            return
        item = await asyncio.to_thread(fetch_news_detail, items[0])
        img_paths = await asyncio.to_thread(self.renderer.render, item, self.state.card_style)
        event.set_extra("_leio_output_purpose", "function_output")
        yield await self._make_message(item, img_paths, event.unified_msg_origin)

    @filter.command("方舟B站检查")
    @filter.permission_type(filter.PermissionType.ADMIN)
    async def bili_manual_check(self, event: AstrMessageEvent):
        """手动触发一次 B 站检查（与官网公告检查互不影响）。"""
        if not self._bili_cfg("bili_enabled"):
            yield event.plain_result("B 站官号推送未启用（bili_enabled=false）。")
            return
        try:
            stats = await self._bili_check_once()
        except BiliError as error:
            yield event.plain_result(f"B 站检查失败: {error}")
            return
        except Exception as error:  # noqa: BLE001
            logger.error("[方舟B站] 手动检查异常: %s", error, exc_info=True)
            yield event.plain_result(f"B 站检查异常: {error}")
            return
        if stats.get("skipped"):
            yield event.plain_result("上一次 B 站检查还在进行，本次已跳过。")
            return
        yield event.plain_result(
            f"B 站检查完成。动态 {stats['dynamics']} 条 / 视频 {stats['videos']} 个，"
            f"新推送 {stats['pushed']} 条。\n{self._bili_status}"
        )

    @filter.command("方舟B站测试动态")
    @filter.permission_type(filter.PermissionType.ADMIN)
    async def bili_test_dynamic(self, event: AstrMessageEvent, index: int = 0):
        """把第 N 条动态（0 = 最新）强制当成新动态推一次，用来验证卡片/合并转发。"""
        try:
            dynamics, _ = await asyncio.to_thread(
                build_targets,
                str(self._bili_cfg("bili_mid")),
                str(self._bili_cfg("bili_cookies_path") or "") or None,
                1,
            )
        except BiliError as error:
            yield event.plain_result(f"抓取 B 站动态失败: {error}")
            return
        if not dynamics:
            yield event.plain_result("没有抓到 B 站动态。")
            return
        dynamic = dynamics[max(0, min(int(index or 0), len(dynamics) - 1))]
        if dynamic.is_video_post:
            yield event.plain_result(
                f"第 {index} 条是投稿动态（{dynamic.archive_bvid}），由视频那一路处理，请用 方舟B站测试视频。"
            )
            return
        ok = await self._bili_push_dynamic(dynamic, [event.unified_msg_origin])
        yield event.plain_result(
            f"动态测试推送{'成功' if ok else '失败'}: dynamic_id={dynamic.dynamic_id} "
            f"配图 {len(dynamic.images)} 张"
        )

    @filter.command("方舟B站测试视频")
    @filter.permission_type(filter.PermissionType.ADMIN)
    async def bili_test_video(self, event: AstrMessageEvent, index: int = 0):
        """把第 N 个投稿（0 = 最新）强制当成新视频走一次完整链路。"""
        try:
            videos = await asyncio.to_thread(
                list_space_videos,
                str(self._bili_cfg("bili_mid")),
                str(self._bili_cfg("bili_cookies_path") or "") or None,
                5,
            )
        except BiliError as error:
            yield event.plain_result(f"列 B 站投稿失败: {error}")
            return
        if not videos:
            yield event.plain_result("没有列出 B 站投稿。")
            return
        video = videos[max(0, min(int(index or 0), len(videos) - 1))]
        try:
            detail = await asyncio.to_thread(self._bili_video_detail, video.bvid)
            video = detail.to_video()
        except Exception as error:  # noqa: BLE001
            logger.warning("[方舟B站] 测试视频取详情失败 bvid=%s: %s", video.bvid, error)
        yield event.plain_result(
            f"开始处理视频 {video.bvid}（时长 {video.duration_text or '未知'}），"
            f"超限会改发卡片+原链接。"
        )
        ok = await self._bili_handle_video(video, [event.unified_msg_origin])
        yield event.plain_result(f"视频测试推送{'成功' if ok else '失败'}: bvid={video.bvid}")

    async def terminate(self):
        if self.web_admin:
            await self.web_admin.stop()
            self.web_admin = None
        for task in (self._task, self._reminder_task, getattr(self, "_bili_task", None)):
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        if getattr(self, "_bili_file_server", None) is not None:
            self._bili_file_server.stop()
            self._bili_file_server = None
        logger.info("[方舟公告] 插件已停止。")
