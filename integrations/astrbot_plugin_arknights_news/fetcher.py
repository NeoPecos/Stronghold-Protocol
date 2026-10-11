import json
import re
import time
import urllib.request
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse
from html import unescape
from html.parser import HTMLParser
from typing import List


NEWS_URL = "https://ak.hypergryph.com/news"
DETAIL_URL = "https://ak.hypergryph.com/news/{cid}"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
)


@dataclass
class ArknightsNewsItem:
    cid: str
    tab: str
    sticky: bool
    title: str
    author: str
    display_time: int
    cover: str
    extra_cover: str
    brief: str
    content: str = ""
    images: list[str] = field(default_factory=list)

    @property
    def url(self) -> str:
        return DETAIL_URL.format(cid=self.cid)


def _fetch_text(url: str, timeout: int = 20, retries: int = 3) -> str:
    headers = {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Connection": "close",
    }
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except Exception as exc:
            last_error = exc
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
    if last_error:
        raise last_error
    raise RuntimeError(f"Failed to fetch {url}")


class _ArticleTextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self.images: list[str] = []

    def handle_starttag(self, tag: str, attrs):
        if tag == "img":
            attributes = dict(attrs)
            source = attributes.get("src") or attributes.get("data-src") or ""
            source = urljoin(NEWS_URL, unescape(source))
            host = urlparse(source).hostname or ""
            if urlparse(source).scheme == "https" and (host == "hycdn.cn" or host.endswith(".hycdn.cn") or host == "ak.hypergryph.com"):
                if source not in self.images:
                    self.images.append(source)
            self._newline()
        if tag in {"p", "div", "li", "br", "h1", "h2", "h3"}:
            self._newline()

    def handle_endtag(self, tag: str):
        if tag in {"p", "div", "li", "h1", "h2", "h3"}:
            self._newline()

    def handle_data(self, data: str):
        text = data.strip()
        if text:
            self.parts.append(text)

    def _newline(self):
        if self.parts and self.parts[-1] != "\n":
            self.parts.append("\n")

    def text(self) -> str:
        raw = "".join(self.parts)
        lines = [line.strip() for line in raw.splitlines()]
        compact: list[str] = []
        for line in lines:
            if line:
                compact.append(line)
            elif compact and compact[-1] != "":
                compact.append("")
        return "\n".join(compact).strip()


def html_to_text(fragment: str) -> str:
    parser = _ArticleTextParser()
    parser.feed(unescape(fragment))
    return parser.text()


def fetch_news_detail(item: ArknightsNewsItem) -> ArknightsNewsItem:
    html = _fetch_text(item.url)
    chunks = []
    for match in re.finditer(r'self\.__next_f\.push\((.*?)\)</script>', html, re.S):
        try:
            payload = json.loads(match.group(1))
        except (ValueError, TypeError):
            continue
        if len(payload) > 1 and isinstance(payload[1], str):
            chunks.append(payload[1])
    stream = "".join(chunks)
    fragment = ""
    data_match = re.search(r'"data"\s*:\s*', stream)
    if data_match:
        value, _ = json.JSONDecoder().raw_decode(stream[data_match.end():])
        if isinstance(value, str) and value.startswith("$"):
            record = re.search(r'(?:^|\n)' + re.escape(value[1:]) + r':T([0-9a-fA-F]+),', stream)
            if record:
                payload_bytes = stream[record.end():].encode("utf-8")
                fragment = payload_bytes[:int(record.group(1), 16)].decode("utf-8")
        elif isinstance(value, str):
            fragment = value
    if fragment:
        parser = _ArticleTextParser()
        parser.feed(fragment)
        item.content = parser.text()
        item.images = parser.images
        return item
    marker = '\\"data\\":\\"'
    start = html.find(marker)
    if start == -1:
        raise ValueError("官网正文数据未识别，保留公告等待重试")
    start += len(marker)
    end = html.find('\\"}}]', start)
    if end == -1:
        end = html.find('\\"}', start)
    if end == -1:
        return item
    escaped_fragment = html[start:end]
    try:
        fragment = json.loads(f'"{escaped_fragment}"')
    except json.JSONDecodeError:
        fragment = escaped_fragment.encode("utf-8").decode("unicode_escape", errors="ignore")
    parser = _ArticleTextParser()
    parser.feed(fragment)
    item.content = parser.text()
    item.images = parser.images
    return item


def fetch_latest_news(limit: int = 20) -> List[ArknightsNewsItem]:
    html = _fetch_text(NEWS_URL)
    # The official Next.js page embeds article list data in self.__next_f scripts.
    # The payload is inside JavaScript strings, so JSON quotes are escaped once.
    # Normalizing the escaped quotes keeps the parser independent from DOM classes.
    normalized = html.replace('\\"', '"')
    pattern = re.compile(
        r'\{"cid":"(?P<cid>[^"]+)","tab":"(?P<tab>[^"]+)",'
        r'"sticky":(?P<sticky>true|false),"title":"(?P<title>(?:\\"|[^"])*)",'
        r'"author":"(?P<author>(?:\\"|[^"])*)","displayTime":(?P<display_time>\d+),'
        r'"cover":"(?P<cover>(?:\\"|[^"])*)","extraCover":"(?P<extra_cover>(?:\\"|[^"])*)",'
        r'"brief":"(?P<brief>(?:\\"|[^"])*)"\}'
    )
    items = []
    seen = set()
    for match in pattern.finditer(normalized):
        raw = match.group(0)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        cid = str(data.get("cid") or "").strip()
        if not cid or cid in seen:
            continue
        seen.add(cid)
        items.append(
            ArknightsNewsItem(
                cid=cid,
                tab=str(data.get("tab") or ""),
                sticky=bool(data.get("sticky")),
                title=unescape(str(data.get("title") or "")),
                author=unescape(str(data.get("author") or "")),
                display_time=int(data.get("displayTime") or 0),
                cover=str(data.get("cover") or ""),
                extra_cover=str(data.get("extraCover") or ""),
                brief=unescape(str(data.get("brief") or "")),
            )
        )
    items.sort(key=lambda x: (x.display_time, x.cid), reverse=True)
    return items[:limit]
