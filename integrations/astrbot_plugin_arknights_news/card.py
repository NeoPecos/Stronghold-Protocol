from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ASSETS = Path(__file__).parent / "resources"
INK = "#171b1e"
PAPER = "#f1f2eb"
YELLOW = "#f2d447"

# 画布宽度固定；高度随内容增长
WIDTH = 1600
PAD = 72
CONTENT_WIDTH = WIDTH - PAD * 2          # 1456
TITLE_SIZE = 44
BODY_SIZE = 32
TITLE_LINE_H = 56
BODY_LINE_H = 44

# 插件内部保守保护值（不是 QQ 官方限制）：超过该高度才按固定字号拆分兜底
MAX_CANVAS_HEIGHT = 16000


def font(size):
    return ImageFont.truetype(str(ASSETS / "NotoSansCJKsc-Regular.otf"), size)


def wrap(text, face, width):
    lines = []
    for paragraph in text.splitlines():
        current = ""
        for character in paragraph.strip():
            if current and face.getlength(current + character) > width:
                lines.append(current)
                current = ""
            current += character
        lines.append(current)
    return lines or [""]


def _body_top(title_line_count):
    """根据实际标题行数计算正文起始 y。"""
    separator_y = 230 + title_line_count * TITLE_LINE_H + 12
    return separator_y + 21


def _canvas_height(title_line_count, body_line_count):
    """先算尺寸再建画布，避免分配无限高画布。"""
    body_end = _body_top(title_line_count) + body_line_count * BODY_LINE_H
    footer_y = body_end + 30
    return footer_y + 102


def _body_capacity(title_line_count):
    """保护值内单页可容纳的正文行数。"""
    overhead = _body_top(title_line_count) + 30 + 102
    return max(1, (MAX_CANVAS_HEIGHT - overhead) // BODY_LINE_H)


def _paginate(title_lines, body_lines):
    """正常情况返回单页；只有超过保护值的极长正文才按固定字号拆分。

    拆分不截字、不丢段落：正文按行切片，行内容本身不变。
    """
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


def render_dossier(item, output_dir):
    title_lines = wrap(item.title, font(TITLE_SIZE), CONTENT_WIDTH)
    body_lines = wrap(item.content or item.brief or "正文请查看官网原文", font(BODY_SIZE), CONTENT_WIDTH)
    pages = _paginate(title_lines, body_lines)
    total_pages = len(pages)
    date = datetime.fromtimestamp(item.display_time, timezone(timedelta(hours=8))).strftime("%Y.%m.%d  %H:%M")
    category = {"0": "公告", "1": "活动", "2": "新闻", "3": "维护"}.get(item.tab, "情报")

    results = []
    for index, (heading, lines) in enumerate(pages):
        height = _canvas_height(len(heading), len(lines))
        canvas = Image.new("RGB", (WIDTH, height), PAPER)
        draw = ImageDraw.Draw(canvas)

        # 页眉
        draw.rectangle((0, 0, WIDTH, 144), fill=INK)
        for position in range(660, 1700, 32):
            draw.line((position, 0, position - 110, 144), fill="#2b3033", width=1)
        for asset, box in [("arknights", (72, 20, 260, 100)), ("rhodes", (1400, 15, 120, 112))]:
            logo = Image.open(ASSETS / f"{asset}.png").convert("RGBA")
            logo.thumbnail((box[2], box[3]), Image.Resampling.LANCZOS)
            canvas.paste(logo, (box[0], box[1]), logo)
        draw.text((400, 34), "情报中心", font=font(36), fill=PAPER)
        draw.text((403, 86), "INFORMATION / OFFICIAL NEWS", font=font(16), fill="#aeb5b8")
        draw.rectangle((0, 144, WIDTH, 152), fill=YELLOW)

        # 分类与日期（单图不显示页码）
        draw.rectangle((72, 174, 188, 216), fill=INK)
        draw.text((96, 175), category, font=font(26), fill=PAPER)
        draw.text((216, 180), date + "  UTC+8", font=font(22), fill="#4d565b")
        if total_pages > 1:
            draw.text((1400, 178), f"{index + 1:02}/{total_pages:02}", font=font(24), fill=INK)

        # 完整标题（不另拆标题页）
        for number, line in enumerate(heading):
            draw.text((72, 230 + number * TITLE_LINE_H), line, font=font(TITLE_SIZE), fill=INK)

        # 标题与正文之间的分隔
        separator_y = 230 + len(heading) * TITLE_LINE_H + 12
        draw.rectangle((72, separator_y, 122, separator_y + 6), fill=YELLOW)
        draw.line((138, separator_y + 3, 1528, separator_y + 3), fill="#b5babb", width=1)

        # 完整正文
        body_top = separator_y + 21
        for number, line in enumerate(lines):
            draw.text((72, body_top + number * BODY_LINE_H), line, font=font(BODY_SIZE), fill=INK)

        # 页脚（按实际内容定位）
        footer_y = body_top + len(lines) * BODY_LINE_H + 30
        draw.line((72, footer_y, 1528, footer_y), fill=INK, width=2)
        draw.text((72, footer_y + 20), "SOURCE / 明日方舟官网", font=font(21), fill="#465056")
        draw.text((480, footer_y + 22), item.url, font=font(19), fill="#465056")
        draw.rectangle((1390, footer_y + 17, 1528, footer_y + 78), fill=YELLOW)
        draw.text((1407, footer_y + 28), "情报档案", font=font(25), fill=INK)

        target = Path(output_dir) / f"ak_news_{item.cid}_dossier_{index + 1}.png"
        canvas.save(target)
        results.append(str(target))
    return results
