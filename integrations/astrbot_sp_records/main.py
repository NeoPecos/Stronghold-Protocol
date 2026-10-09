import asyncio
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from uuid import uuid4

from astrbot.api import logger
from astrbot.api.event import AstrMessageEvent, filter
from astrbot.api.message_components import At, Image, Plain
from astrbot.api.star import Context, Star, register
from astrbot.core.message.message_event_result import MessageEventResult

from .card import render_card, render_detail_cards


RECORD_REQUEST = re.compile(r"(?:战绩|结算)\s*([A-Za-z]{4})\b|\b([A-Za-z]{4})\s*(?:战绩|结算)")
BASE_URL = "https://sp.bs.leio.fun/api/records"
CARD_DIR = Path("/tmp/astrbot-sp-records")


def fetch_record(code):
    request = urllib.request.Request(f"{BASE_URL}/{code}", headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=8) as response:
        payload = response.read(65537)
    if len(payload) > 65536:
        raise ValueError("战绩数据过大")
    record = json.loads(payload)
    if record.get("code") != code or not isinstance(record.get("players"), list):
        raise ValueError("战绩数据无效")
    return record


@register("astrbot_plugin_sp_records", "Leiothrix/Codex", "根据卫戍协议房间号发送最近一局战绩卡片", "1.0.0")
class StrongholdRecords(Star):
    def __init__(self, context: Context):
        super().__init__(context)

    @filter.event_message_type(filter.EventMessageType.GROUP_MESSAGE)
    async def group_record(self, event: AstrMessageEvent):
        text = event.get_message_str() or ""
        match = RECORD_REQUEST.search(text)
        if not match:
            return
        components = getattr(event.message_obj, "message", []) or []
        bot_id = str(event.get_self_id() or "")
        if not bot_id or not any(isinstance(component, At) and str(component.qq) == bot_id for component in components):
            return
        code = (match.group(1) or match.group(2)).upper()
        event.stop_event()
        try:
            record = await asyncio.to_thread(fetch_record, code)
            request_dir = CARD_DIR / f"{record['id']}-{uuid4().hex[:8]}"
            destination = request_dir / "overview.png"
            image_path = await asyncio.to_thread(render_card, record, destination)
            detail_paths = await asyncio.to_thread(render_detail_cards, record, request_dir)
            for old_file in CARD_DIR.glob("*/*.png"):
                if old_file.stat().st_mtime < time.time() - 86400:
                    old_file.unlink(missing_ok=True)
            images = [Image.fromFileSystem(image_path), *(Image.fromFileSystem(file) for file in detail_paths)]
            yield MessageEventResult(chain=[*images, Plain(f"房间 {code} 最近一局 · 第 {record.get('matchNo', '?')} 局")]).use_t2i(False)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                yield event.plain_result(f"房间 {code} 暂无完整对局战绩。")
            else:
                logger.warning(f"[卫戍战绩] 请求失败: {error}")
                yield event.plain_result("暂时无法读取战绩，请稍后重试。")
        except Exception as error:
            logger.error(f"[卫戍战绩] {error}")
            yield event.plain_result("战绩卡片生成失败，请稍后重试。")
