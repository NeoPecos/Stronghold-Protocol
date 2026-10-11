import asyncio
import hashlib
import io
import urllib.request
from pathlib import Path

from PIL import Image as PillowImage

from astrbot.api.message_components import Image, Node, Nodes, Plain
from astrbot.core.message.message_event_result import MessageEventResult

from .fetcher import UA


def announcement_text(item):
    if "制作组通讯" in item.title:
        return "发现新的制作组通讯，请查收~"
    if str(item.tab) == "1" or item.title.startswith(("[活动", "【活动")):
        return "博士，有新活动诶！一起来看看吧~~"
    return "叮叮~明日方舟有新公告出炉啦！"


def download_image(url, directory):
    path = Path(directory) / (hashlib.sha256(url.encode()).hexdigest()[:24] + ".png")
    if path.exists():
        return str(path)
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=20) as response:
        data = response.read(12 * 1024 * 1024 + 1)
    if len(data) > 12 * 1024 * 1024:
        raise ValueError("公告配图超过 12MB")
    with PillowImage.open(io.BytesIO(data)) as picture:
        picture.load()
        picture.convert("RGB").save(path)
    return str(path)


async def build_message(item, cards, directory, bot_id, include_notice=True):
    if not item.images and len(cards) == 1:
        notice = f"{announcement_text(item)}\n" if include_notice else ""
        return MessageEventResult(chain=[Image.fromFileSystem(cards[0]), Plain(f"\n{notice}{item.title}\n{item.url}")]).use_t2i(False)
    nodes = [Node(name="黍 · 方舟公告", uin=str(bot_id), content=[Plain(f"{item.title}\n来源：明日方舟官网\n{item.url}")])]
    nodes.extend(Node(name="公告正文", uin=str(bot_id), content=[Image.fromFileSystem(path)]) for path in cards)
    semaphore = asyncio.Semaphore(3)

    async def image_node(url):
        async with semaphore:
            try:
                path = await asyncio.to_thread(download_image, url, directory)
                content = [Image.fromFileSystem(path)]
            except Exception:
                content = [Plain(f"这张配图暂时加载失败，可查看原图：\n{url}")]
            return Node(name="公告原图", uin=str(bot_id), content=content)

    available = max(0, 90 - len(nodes))
    nodes.extend(await asyncio.gather(*(image_node(url) for url in item.images[:available])))
    if len(item.images) > available:
        nodes.append(Node(name="更多配图", uin=str(bot_id), content=[Plain(f"其余 {len(item.images)-available} 张配图请查看官网原文：{item.url}")]))
    chain = [Nodes(nodes)]
    if include_notice:
        chain.append(Plain(announcement_text(item)))
    return MessageEventResult(chain=chain).use_t2i(False)
