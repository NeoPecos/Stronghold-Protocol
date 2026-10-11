"""B 站动态 / 视频卡片渲染（PIL）。

风格对齐现有 `card.py`（同一套 INK / PAPER / YELLOW 配色、同一款 Noto Sans CJK 字体、
同宽的 1600px 画布、同样的页眉-分隔条-正文-页脚结构），让群友看不出是两套东西。
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ASSETS = Path(__file__).parent / "resources"

INK = "#171b1e"
PAPER = "#f1f2eb"
YELLOW = "#f2d447"

WIDTH = 1600
PAD = 72
CONTENT_WIDTH = WIDTH - PAD * 2  # 1456
TITLE_SIZE = 44
BODY_SIZE = 32
META_SIZE = 22
TITLE_LINE_H = 56
BODY_LINE_H = 44

# 插件内部保守保护值：超过该高度才按固定字号拆页
MAX_CANVAS_HEIGHT = 16000

FONT_CANDIDATES = [
    ASSETS / "NotoSansCJKsc-Regular.otf",
    Path("/AstrBot/data/plugins/astrbot_plugin_arknights_news/resources/NotoSansCJKsc-Regular.otf"),
    Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
]

_KIND_TITLES = {
    "draw": ("图文动态", "DYNAMIC / PICTURES"),
    "word": ("文字动态", "DYNAMIC / TEXT"),
    "archive": ("视频投稿", "DYNAMIC / VIDEO"),
    "article": ("专栏动态", "DYNAMIC / ARTICLE"),
    "other": ("B站动态", "DYNAMIC / BILIBILI"),
}


def _font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def wrap_text(text: str, face: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in str(text or "").splitlines():
        current = ""
        for character in paragraph.strip():
            if current and face.getlength(current + character) > width:
                lines.append(current)
                current = ""
            current += character
        lines.append(current)
    return lines or [""]


def _header(canvas: Image.Image, draw: ImageDraw.ImageDraw, kind: str, badge: str):
    """与 card.py 同样的深色页眉 + 斜线纹理 + 黄色分隔条。"""
    draw.rectangle((0, 0, WIDTH, 144), fill=INK)
    for position in range(660, 1700, 32):
        draw.line((position, 0, position - 110, 144), fill="#2b3033", width=1)
    for asset, box in (("arknights", (72, 20, 260, 100)), ("rhodes", (1400, 15, 120, 112))):
        path = ASSETS / f"{asset}.png"
        if not path.exists():
            continue
        logo = Image.open(path).convert("RGBA")
        logo.thumbnail((box[2], box[3]), Image.Resampling.LANCZOS)
        canvas.paste(logo, (box[0], box[1]), logo)
    draw.text((400, 34), f"B站 · {badge}", font=_font(36), fill=PAPER)
    draw.text((403, 86), f"BILIBILI / {kind}", font=_font(16), fill="#aeb5b8")
    draw.rectangle((0, 144, WIDTH, 152), fill=YELLOW)


def _body_top(title_line_count: int) -> int:
    separator_y = 230 + title_line_count * TITLE_LINE_H + 12
    return separator_y + 21


def _canvas_height(title_line_count: int, body_line_count: int) -> int:
    body_end = _body_top(title_line_count) + body_line_count * BODY_LINE_H
    return body_end + 30 + 102


def _body_capacity(title_line_count: int) -> int:
    overhead = _body_top(title_line_count) + 30 + 102
    return max(1, (MAX_CANVAS_HEIGHT - overhead) // BODY_LINE_H)


def _paginate(title_lines: list[str], body_lines: list[str]):
    if _canvas_height(len(title_lines), len(body_lines)) <= MAX_CANVAS_HEIGHT:
        return [(title_lines, body_lines)]
    pages = []
    remaining = list(body_lines)
    while True:
        capacity = _body_capacity(len(title_lines))
        chunk, remaining = remaining[:capacity], remaining[capacity:]
        pages.append((title_lines, chunk))
        if not remaining:
            break
    return pages


def render_dynamic_card(dynamic, output_dir, index: int = 1) -> list[str]:
    """把一条 BiliDynamic 渲染成卡片 PNG，返回文件路径列表。"""
    kind = dynamic.media_kind
    badge, kind_en = _KIND_TITLES.get(kind, _KIND_TITLES["other"])
    multi = bool(dynamic.images)

    title = (dynamic.archive_title or "").strip() or f"B站{('图文' if multi else '')}动态"
    title_lines = wrap_text(title, _font(TITLE_SIZE), CONTENT_WIDTH)[:3]
    body_lines = wrap_text(dynamic.body_text, _font(BODY_SIZE), CONTENT_WIDTH)
    pages = _paginate(title_lines, body_lines)

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    results: list[str] = []

    for page_index, (heading, lines) in enumerate(pages, start=1):
        height = _canvas_height(len(heading), len(lines))
        canvas = Image.new("RGB", (WIDTH, height), PAPER)
        draw = ImageDraw.Draw(canvas)
        _header(canvas, draw, kind_en, badge)

        draw.rectangle((72, 174, 236 if len(badge) > 2 else 188, 216), fill=INK)
        draw.text((96, 175), badge, font=_font(26), fill=PAPER)
        pub = dynamic.pub_time_text
        meta = f"{pub}  UTC+8"
        if dynamic.author:
            meta = f"{dynamic.author} · {meta}"
        draw.text((250, 180), meta, font=_font(META_SIZE), fill="#4d565b")
        if len(pages) > 1:
            draw.text((1400, 178), f"{page_index:02}/{len(pages):02}", font=_font(24), fill=INK)

        for number, line in enumerate(heading):
            draw.text((72, 230 + number * TITLE_LINE_H), line, font=_font(TITLE_SIZE), fill=INK)

        separator_y = 230 + len(heading) * TITLE_LINE_H + 12
        draw.rectangle((72, separator_y, 122, separator_y + 6), fill=YELLOW)
        draw.line((138, separator_y + 3, 1528, separator_y + 3), fill="#b5babb", width=1)

        body_top = separator_y + 21
        for number, line in enumerate(lines):
            draw.text((72, body_top + number * BODY_LINE_H), line, font=_font(BODY_SIZE), fill=INK)

        footer_y = body_top + len(lines) * BODY_LINE_H + 30
        draw.line((72, footer_y, 1528, footer_y), fill=INK, width=2)
        draw.text((72, footer_y + 20), "SOURCE / B站 · 明日方舟", font=_font(21), fill="#465056")
        draw.text((480, footer_y + 22), dynamic.url, font=_font(19), fill="#465056")
        draw.rectangle((1390, footer_y + 17, 1528, footer_y + 78), fill=YELLOW)
        draw.text((1407, footer_y + 28), f"配图 {len(dynamic.images)} 张" if multi else "动态", font=_font(25), fill=INK)

        target = output_dir / f"ak_bili_{dynamic.dynamic_id}_{index}_{page_index}.png"
        canvas.save(target)
        results.append(str(target))
    return results


def render_video_card(video, output_dir, index: int = 1) -> list[str]:
    """超限视频改发卡片（SPEC §0.1 决定 3）——不下载，只给标题 + 原链接。"""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    title = (video.title or "").strip() or f"B站视频 {video.bvid}"
    title_lines = wrap_text(title, _font(TITLE_SIZE), CONTENT_WIDTH)[:3]

    meta_lines = []
    if video.duration_text:
        meta_lines.append(f"时长：{video.duration_text}")
    if video.pub_time_text:
        meta_lines.append(f"发布：{video.pub_time_text}")
    meta_lines.append(f"BV号：{video.bvid}")
    body = "  |  ".join(meta_lines)
    body_lines = wrap_text(body, _font(BODY_SIZE), CONTENT_WIDTH)
    if video.desc:
        body_lines.append("")
        body_lines.extend(wrap_text("简介：" + video.desc.strip(), _font(BODY_SIZE), CONTENT_WIDTH)[:12])

    pages = _paginate(title_lines, body_lines)
    results: list[str] = []
    for page_index, (heading, lines) in enumerate(pages, start=1):
        height = _canvas_height(len(heading), len(lines))
        canvas = Image.new("RGB", (WIDTH, height), PAPER)
        draw = ImageDraw.Draw(canvas)
        _header(canvas, draw, "VIDEO / ARCHIVE", "视频投稿")

        draw.rectangle((72, 174, 208, 216), fill=INK)
        draw.text((96, 175), "新视频", font=_font(26), fill=PAPER)
        draw.text((230, 180), video.pub_time_text or "", font=_font(META_SIZE), fill="#4d565b")

        for number, line in enumerate(heading):
            draw.text((72, 230 + number * TITLE_LINE_H), line, font=_font(TITLE_SIZE), fill=INK)

        separator_y = 230 + len(heading) * TITLE_LINE_H + 12
        draw.rectangle((72, separator_y, 122, separator_y + 6), fill=YELLOW)
        draw.line((138, separator_y + 3, 1528, separator_y + 3), fill="#b5babb", width=1)

        body_top = separator_y + 21
        for number, line in enumerate(lines):
            draw.text((72, body_top + number * BODY_LINE_H), line, font=_font(BODY_SIZE), fill=INK)

        footer_y = body_top + len(lines) * BODY_LINE_H + 30
        draw.line((72, footer_y, 1528, footer_y), fill=INK, width=2)
        draw.text((72, footer_y + 20), "SOURCE / B站视频", font=_font(21), fill="#465056")
        draw.text((480, footer_y + 22), video.url, font=_font(19), fill="#465056")
        draw.rectangle((1390, footer_y + 17, 1528, footer_y + 78), fill=YELLOW)
        draw.text((1407, footer_y + 28), "原链接", font=_font(25), fill=INK)

        target = output_dir / f"ak_bili_video_{video.bvid}_{index}_{page_index}.png"
        canvas.save(target)
        results.append(str(target))
    return results
