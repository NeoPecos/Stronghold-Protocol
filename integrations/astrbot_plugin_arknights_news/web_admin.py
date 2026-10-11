from __future__ import annotations

import asyncio
import base64
import errno
import json
import mimetypes
import re
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from astrbot.api import logger

from .fetcher import ArknightsNewsItem, fetch_latest_news, fetch_news_detail
from .renderer import NewsCardRenderer


IMAGE_EXTS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


class ArknightsNewsWebAdminServer:
    def __init__(self, plugin: Any, host: str = "0.0.0.0", port: int = 6192):
        self.plugin = plugin
        self.host = host
        self.port = int(port)
        self.httpd: ThreadingHTTPServer | None = None
        self.thread: threading.Thread | None = None

    async def start(self) -> None:
        if self.thread and self.thread.is_alive():
            return
        handler = self._handler_class()
        self.httpd = ThreadingHTTPServer((self.host, self.port), handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        await asyncio.sleep(0.05)
        logger.info(f"[方舟公告] 样式 WebUI 已启动: http://{self.host}:{self.port}")

    async def stop(self) -> None:
        if self.httpd:
            self.httpd.shutdown()
            self.httpd.server_close()
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=3)
        self.httpd = None
        self.thread = None
        logger.info("[方舟公告] 样式 WebUI 已停止")

    def _handler_class(self):
        server = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, fmt, *args):
                return

            def do_OPTIONS(self):
                server._send_json(self, {"ok": True})

            def do_GET(self):
                server._handle_get(self)

            def do_POST(self):
                server._handle_post(self)

        return Handler

    def _handle_get(self, request: BaseHTTPRequestHandler) -> None:
        parsed = urlparse(request.path)
        if parsed.path == "/api/config":
            self._send_json(request, self._config_payload())
            return
        if parsed.path == "/api/preview":
            self._send_preview(request)
            return
        if parsed.path == "/api/background":
            self._send_background(request)
            return
        self._send_static(request, parsed.path)

    def _handle_post(self, request: BaseHTTPRequestHandler) -> None:
        parsed = urlparse(request.path)
        if parsed.path == "/api/config":
            payload = self._read_json(request)
            if not isinstance(payload, dict):
                self._send_json(request, {"error": "invalid json"}, HTTPStatus.BAD_REQUEST)
                return
            style = payload.get("style", payload)
            if not isinstance(style, dict):
                self._send_json(request, {"error": "invalid style"}, HTTPStatus.BAD_REQUEST)
                return
            normalized = NewsCardRenderer.normalize_style(self.plugin.state.update_card_style(style))
            self.plugin.renderer_style = normalized
            self._send_json(request, {"ok": True, "style": normalized})
            return
        if parsed.path == "/api/upload-background":
            payload = self._read_json(request)
            if not isinstance(payload, dict):
                self._send_json(request, {"error": "invalid json"}, HTTPStatus.BAD_REQUEST)
                return
            saved = self._save_background(payload)
            if not saved:
                self._send_json(request, {"error": "invalid image data"}, HTTPStatus.BAD_REQUEST)
                return
            style = self.plugin.state.update_card_style({"background_image": saved})
            self.plugin.renderer_style = NewsCardRenderer.normalize_style(style)
            logger.info(f"[方舟公告] WebUI 上传背景图: {saved}")
            self._send_json(request, {"ok": True, "background_image": saved, "style": self.plugin.renderer_style})
            return
        self._send_json(request, {"error": "not found"}, HTTPStatus.NOT_FOUND)

    def _config_payload(self) -> dict[str, Any]:
        return {
            "ok": True,
            "style": NewsCardRenderer.normalize_style(self.plugin.state.card_style),
            "runtime": {
                "port": self.port,
                "webui_enabled": bool(self.plugin.config.get("webui_enabled", False)),
            },
        }

    def _send_preview(self, request: BaseHTTPRequestHandler) -> None:
        try:
            items = fetch_latest_news(1)
            item = fetch_news_detail(items[0]) if items else self._sample_item()
            paths = self.plugin.renderer.render(item, NewsCardRenderer.normalize_style(self.plugin.state.card_style))
            first = Path(paths[0])
            request.send_response(HTTPStatus.OK)
            request.send_header("Content-Type", "image/jpeg")
            request.send_header("Cache-Control", "no-store")
            request.send_header("Access-Control-Allow-Origin", "*")
            data = first.read_bytes()
            request.send_header("Content-Length", str(len(data)))
            request.end_headers()
            request.wfile.write(data)
        except Exception as e:
            if isinstance(e, BrokenPipeError) or getattr(e, "errno", None) == errno.EPIPE:
                return
            logger.error(f"[方舟公告] WebUI 生成预览失败: {e}")
            try:
                self._send_json(request, {"error": str(e)}, HTTPStatus.INTERNAL_SERVER_ERROR)
            except BrokenPipeError:
                pass

    def _send_background(self, request: BaseHTTPRequestHandler) -> None:
        style = NewsCardRenderer.normalize_style(self.plugin.state.card_style)
        bg = Path(str(style.get("background_image") or ""))
        if not bg.exists() or not bg.is_file():
            self._send_json(request, {"error": "background not found"}, HTTPStatus.NOT_FOUND)
            return
        self._send_file(request, bg)

    def _send_static(self, request: BaseHTTPRequestHandler, path: str) -> None:
        admin_dir = Path(__file__).resolve().parent / "admin"
        target = admin_dir / "index.html" if path in {"", "/"} else (admin_dir / path.lstrip("/")).resolve()
        try:
            target.relative_to(admin_dir.resolve())
        except ValueError:
            self._send_json(request, {"error": "not found"}, HTTPStatus.NOT_FOUND)
            return
        if not target.exists() or not target.is_file():
            self._send_json(request, {"error": "not found"}, HTTPStatus.NOT_FOUND)
            return
        self._send_file(request, target)

    def _send_file(self, request: BaseHTTPRequestHandler, path: Path) -> None:
        data = path.read_bytes()
        mime = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        request.send_response(HTTPStatus.OK)
        request.send_header("Content-Type", mime)
        request.send_header("Content-Length", str(len(data)))
        request.send_header("Cache-Control", "no-store")
        request.send_header("Access-Control-Allow-Origin", "*")
        request.end_headers()
        request.wfile.write(data)

    def _read_json(self, request: BaseHTTPRequestHandler) -> Any:
        length = int(request.headers.get("Content-Length", "0") or "0")
        if length > 8 * 1024 * 1024:
            return None
        raw = request.rfile.read(length).decode("utf-8", errors="replace")
        try:
            return json.loads(raw or "{}")
        except json.JSONDecodeError:
            return None

    def _save_background(self, payload: dict[str, Any]) -> str | None:
        data_url = str(payload.get("data_url", ""))
        match = re.match(r"^data:(image/(?:png|jpeg|webp));base64,(.+)$", data_url)
        if not match:
            return None
        mime, encoded = match.groups()
        try:
            content = base64.b64decode(encoded, validate=True)
        except Exception:
            return None
        if not content or len(content) > 8 * 1024 * 1024:
            return None
        ext = IMAGE_EXTS.get(mime)
        if not ext:
            return None
        target_dir = self.plugin.state.data_dir / "backgrounds"
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / f"background{ext}"
        target.write_bytes(content)
        return str(target)

    def _send_json(self, request: BaseHTTPRequestHandler, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request.send_response(status)
        request.send_header("Content-Type", "application/json; charset=utf-8")
        request.send_header("Content-Length", str(len(body)))
        request.send_header("Access-Control-Allow-Origin", "*")
        request.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        request.send_header("Access-Control-Allow-Headers", "Content-Type")
        request.end_headers()
        request.wfile.write(body)

    @staticmethod
    def _sample_item() -> ArknightsNewsItem:
        return ArknightsNewsItem(
            cid="preview",
            tab="0",
            sticky=False,
            title="[明日方舟]公告卡片预览",
            author="【明日方舟】运营组",
            display_time=1778209200,
            cover="",
            extra_cover="",
            brief="",
            content="这里会展示公告正文。你可以在左侧调整标题文字、背景图片、颜色、画布尺寸、字体大小和分页模式，右侧预览会实时刷新。",
        )
