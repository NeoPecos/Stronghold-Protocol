from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from .fetcher import ArknightsNewsItem
from .card import render_dossier
from .reminder import CN_TZ


FONT_PRESETS = {
    "sans": [
        "/AstrBot/data/plugins/astrbot_plugin_anti_revoke/resources/fonts/NotoSansSC-Regular.ttf",
        "/opt/astrbot/data/plugins/astrbot_plugin_anti_revoke/resources/fonts/NotoSansSC-Regular.ttf",
    ],
    "sans_bold": [
        "/AstrBot/data/plugins/astrbot_plugin_anti_revoke/resources/fonts/NotoSansSC-Bold.ttf",
        "/AstrBot/data/plugins/astrbot_plugin_help/DouyinSansBold.otf",
    ],
    "serif": [
        "/AstrBot/data/plugins/astrbot_plugin_blacklist_tools/font/NotoSerifCJKsc-Regular.otf",
        "/opt/astrbot/data/plugins/astrbot_plugin_blacklist_tools/font/NotoSerifCJKsc-Regular.otf",
    ],
    "source_han": [
        "/AstrBot/data/plugins/astrbot_plugin_mrfz/SourceHanSerifCN-Medium-6.otf",
    ],
    "douyin": [
        "/AstrBot/data/plugins/astrbot_plugin_help/DouyinSansBold.otf",
    ],
}

FONT_FALLBACKS = [
    "/AstrBot/data/plugins/astrbot_plugin_anti_revoke/resources/fonts/NotoSansSC-Regular.ttf",
    "/AstrBot/data/plugins/astrbot_plugin_blacklist_tools/font/NotoSerifCJKsc-Regular.otf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


DEFAULT_STYLE: dict[str, Any] = {
    "header_title": "ARKNIGHTS",
    "header_subtitle": "OFFICIAL NEWS",
    "continue_title": "公告正文续页",
    "fallback_body": "点击链接查看公告详情。",
    "page_mode": "vertical_pages",
    "width": 1080,
    "height": 1560,
    "horizontal_width": 1560,
    "horizontal_height": 1080,
    "long_max_height": 4200,
    "margin_x": 74,
    "header_height": 92,
    "font_header_title": 38,
    "font_header_subtitle": 26,
    "font_label": 24,
    "font_meta": 28,
    "font_title": 44,
    "font_body": 31,
    "font_url": 22,
    "font_body_min": 19,
    "font_family": "sans",
    "line_spacing": 1.42,
    "bg_color": "#10151c",
    "panel_opacity": 0.82,
    "header_bg_color": "#d8dde4",
    "panel_color": "#111821",
    "border_color": "#3a4654",
    "accent_color": "#e7edf4",
    "header_text_color": "#111821",
    "subtitle_color": "#313943",
    "title_color": "#f2f5f8",
    "body_color": "#cad3dc",
    "meta_color": "#b9c4d0",
    "muted_color": "#778390",
    "url_color": "#9db4ce",
    "background_image": "",
    "background_opacity": 0.35,
    "bg_crop_x": 0.0,
    "bg_crop_y": 0.0,
    "bg_crop_w": 1.0,
    "bg_crop_h": 1.0,
}


class NewsCardRenderer:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def render(self, item: ArknightsNewsItem, style: dict[str, Any] | None = None) -> list[str]:
        return render_dossier(item, self.output_dir)

    def render_legacy(self, item: ArknightsNewsItem, style: dict[str, Any] | None = None) -> list[str]:
        style = self.normalize_style(style)
        self._font_family = str(style["font_family"])
        mode = str(style["page_mode"])
        if mode == "long_image":
            return self._render_long(item, style)
        if mode == "horizontal_pages":
            return self._render_pages(item, style, horizontal=True)
        if mode == "fit_text":
            return self._render_fit(item, style)
        return self._render_pages(item, style, horizontal=False)

    @classmethod
    def normalize_style(cls, style: dict[str, Any] | None = None) -> dict[str, Any]:
        merged = dict(DEFAULT_STYLE)
        if isinstance(style, dict):
            merged.update({k: v for k, v in style.items() if v is not None})

        ints = [
            "width",
            "height",
            "horizontal_width",
            "horizontal_height",
            "long_max_height",
            "margin_x",
            "header_height",
            "font_header_title",
            "font_header_subtitle",
            "font_label",
            "font_meta",
            "font_title",
            "font_body",
            "font_url",
            "font_body_min",
        ]
        for key in ints:
            merged[key] = cls._clamp_int(merged[key], DEFAULT_STYLE[key], 12, 8000)

        merged["width"] = cls._clamp_int(merged["width"], 1080, 640, 2400)
        merged["height"] = cls._clamp_int(merged["height"], 1560, 640, 6000)
        merged["horizontal_width"] = cls._clamp_int(merged["horizontal_width"], 1560, 900, 3000)
        merged["horizontal_height"] = cls._clamp_int(merged["horizontal_height"], 1080, 640, 2000)
        merged["long_max_height"] = cls._clamp_int(merged["long_max_height"], 4200, 1200, 12000)
        merged["background_opacity"] = cls._clamp_float(merged["background_opacity"], 0.35, 0.0, 1.0)
        merged["panel_opacity"] = cls._clamp_float(merged.get("panel_opacity"), 0.82, 0.0, 1.0)
        merged["line_spacing"] = cls._clamp_float(merged.get("line_spacing"), 1.42, 0.8, 2.8)
        if merged.get("font_family") not in FONT_PRESETS:
            merged["font_family"] = "sans"
        merged["bg_crop_x"] = cls._clamp_float(merged.get("bg_crop_x"), 0.0, 0.0, 0.98)
        merged["bg_crop_y"] = cls._clamp_float(merged.get("bg_crop_y"), 0.0, 0.0, 0.98)
        merged["bg_crop_w"] = cls._clamp_float(merged.get("bg_crop_w"), 1.0, 0.02, 1.0)
        merged["bg_crop_h"] = cls._clamp_float(merged.get("bg_crop_h"), 1.0, 0.02, 1.0)
        if merged["bg_crop_x"] + merged["bg_crop_w"] > 1:
            merged["bg_crop_x"] = 1 - merged["bg_crop_w"]
        if merged["bg_crop_y"] + merged["bg_crop_h"] > 1:
            merged["bg_crop_y"] = 1 - merged["bg_crop_h"]
        if merged["page_mode"] not in {"vertical_pages", "long_image", "horizontal_pages", "fit_text"}:
            merged["page_mode"] = "vertical_pages"
        for key in [
            "bg_color",
            "header_bg_color",
            "panel_color",
            "border_color",
            "accent_color",
            "header_text_color",
            "subtitle_color",
            "title_color",
            "body_color",
            "meta_color",
            "muted_color",
            "url_color",
        ]:
            merged[key] = cls._color(merged.get(key), str(DEFAULT_STYLE[key]))
        return merged

    @staticmethod
    def _clamp_int(value: Any, default: int, min_value: int, max_value: int) -> int:
        try:
            number = int(value)
        except (TypeError, ValueError):
            number = int(default)
        return max(min_value, min(max_value, number))

    @staticmethod
    def _clamp_float(value: Any, default: float, min_value: float, max_value: float) -> float:
        try:
            number = float(value)
        except (TypeError, ValueError):
            number = float(default)
        return max(min_value, min(max_value, number))

    @staticmethod
    def _color(value: Any, default: str) -> str:
        text = str(value or "").strip()
        if len(text) == 7 and text.startswith("#"):
            try:
                int(text[1:], 16)
                return text
            except ValueError:
                pass
        return default

    def _render_pages(self, item: ArknightsNewsItem, style: dict[str, Any], horizontal: bool) -> list[str]:
        width = int(style["horizontal_width"] if horizontal else style["width"])
        height = int(style["horizontal_height"] if horizontal else style["height"])
        metrics = self._metrics(style, width, height)
        font_body = self._font(int(style["font_body"]))
        body_lines = self._body_lines(item, style, font_body, metrics["content_width"])

        first_capacity = max((height - metrics["first_body_y"] - metrics["footer_space"]) // metrics["line_height"], 4)
        next_top = metrics["next_body_y"]
        next_capacity = max((height - next_top - metrics["footer_space"]) // metrics["line_height"], 6)

        chunks = [body_lines[:first_capacity]]
        rest = body_lines[first_capacity:]
        while rest:
            chunks.append(rest[:next_capacity])
            rest = rest[next_capacity:]
        return self._draw_chunks(item, style, width, height, chunks, font_body, metrics, "h" if horizontal else "v")

    def _render_long(self, item: ArknightsNewsItem, style: dict[str, Any]) -> list[str]:
        width = int(style["width"])
        metrics = self._metrics(style, width, int(style["height"]))
        font_body = self._font(int(style["font_body"]))
        body_lines = self._body_lines(item, style, font_body, metrics["content_width"])
        content_height = metrics["first_body_y"] + len(body_lines) * metrics["line_height"] + metrics["footer_space"]
        height = min(max(content_height, int(style["height"])), int(style["long_max_height"]))
        capacity = max((height - metrics["first_body_y"] - metrics["footer_space"]) // metrics["line_height"], 4)
        lines = body_lines[:capacity]
        if len(lines) < len(body_lines):
            lines[-1] = lines[-1].rstrip("，。；、") + "..."
        return self._draw_chunks(item, style, width, height, [lines], font_body, metrics, "long")

    def _render_fit(self, item: ArknightsNewsItem, style: dict[str, Any]) -> list[str]:
        width = int(style["width"])
        height = int(style["height"])
        body_size = int(style["font_body"])
        min_size = min(int(style["font_body_min"]), body_size)
        best_font = self._font(body_size)
        best_lines: list[str] = []
        metrics = self._metrics(style, width, height, body_size=body_size)
        for size in range(body_size, min_size - 1, -1):
            font = self._font(size)
            metrics = self._metrics(style, width, height, body_size=size)
            lines = self._body_lines(item, style, font, metrics["content_width"])
            capacity = max((height - metrics["first_body_y"] - metrics["footer_space"]) // metrics["line_height"], 4)
            best_font = font
            best_lines = lines[:capacity]
            if len(lines) <= capacity:
                break
        if len(best_lines) < len(self._body_lines(item, style, best_font, metrics["content_width"])):
            best_lines[-1] = best_lines[-1].rstrip("，。；、") + "..."
        return self._draw_chunks(item, style, width, height, [best_lines], best_font, metrics, "fit")

    def _draw_chunks(
        self,
        item: ArknightsNewsItem,
        style: dict[str, Any],
        width: int,
        height: int,
        chunks: list[list[str]],
        font_body: ImageFont.FreeTypeFont,
        metrics: dict[str, int],
        suffix: str,
    ) -> list[str]:
        output_paths: list[str] = []
        total_pages = len(chunks)
        for page_index, lines in enumerate(chunks, start=1):
            img = self._base_image(width, height, style)
            draw = ImageDraw.Draw(img)
            self._draw_header(draw, style)
            if page_index == 1:
                self._draw_first_page(draw, item, style, lines, font_body, metrics, width, height, total_pages)
            else:
                self._draw_continue_page(draw, item, style, lines, page_index, total_pages, font_body, metrics, width, height)
            out = self.output_dir / f"ak_news_{item.cid}_{suffix}_{page_index}.jpg"
            img.save(out, quality=92)
            output_paths.append(str(out))
        return output_paths

    def _metrics(self, style: dict[str, Any], width: int, height: int, body_size: int | None = None) -> dict[str, int]:
        margin_x = int(style["margin_x"])
        title_lines = 2
        line_height = max(int((body_size or int(style["font_body"])) * float(style["line_spacing"])), 18)
        return {
            "margin_x": margin_x,
            "content_width": width - margin_x * 2,
            "line_height": line_height,
            "footer_space": 150,
            "first_body_y": 352 + title_lines * max(int(style["font_title"] * 1.22), 44),
            "next_body_y": 270,
        }

    def _base_image(self, width: int, height: int, style: dict[str, Any]) -> Image.Image:
        img = Image.new("RGB", (width, height), style["bg_color"])
        bg_path = str(style.get("background_image") or "")
        if bg_path and os.path.exists(bg_path):
            bg = Image.open(bg_path).convert("RGB")
            crop_left = int(bg.width * float(style["bg_crop_x"]))
            crop_top = int(bg.height * float(style["bg_crop_y"]))
            crop_right = int(bg.width * min(1.0, float(style["bg_crop_x"]) + float(style["bg_crop_w"])))
            crop_bottom = int(bg.height * min(1.0, float(style["bg_crop_y"]) + float(style["bg_crop_h"])))
            if crop_right - crop_left >= 8 and crop_bottom - crop_top >= 8:
                bg = bg.crop((crop_left, crop_top, crop_right, crop_bottom))
            bg_ratio = bg.width / bg.height
            target_ratio = width / height
            if bg_ratio > target_ratio:
                new_h = height
                new_w = int(height * bg_ratio)
            else:
                new_w = width
                new_h = int(width / bg_ratio)
            bg = bg.resize((new_w, new_h), Image.LANCZOS)
            left = (new_w - width) // 2
            top = (new_h - height) // 2
            bg = bg.crop((left, top, left + width, top + height))
            img = Image.blend(img, bg, float(style["background_opacity"]))
        draw = ImageDraw.Draw(img)
        header_height = int(style["header_height"])
        draw.rectangle([0, 0, width, header_height], fill=style["header_bg_color"])
        panel = Image.new("RGB", (width, height - header_height), style["panel_color"])
        panel_alpha = float(style.get("panel_opacity", 0.82))
        img.paste(Image.blend(img.crop((0, header_height, width, height)), panel, panel_alpha), (0, header_height))
        draw = ImageDraw.Draw(img)
        draw.rectangle([32, header_height + 32, width - 32, height - 34], outline=style["border_color"], width=2)
        draw.rectangle([32, header_height + 32, 40, height - 34], fill=style["accent_color"])
        return img

    def _draw_header(self, draw: ImageDraw.ImageDraw, style: dict[str, Any]):
        draw.text((34, 24), str(style["header_title"]), font=self._font(int(style["font_header_title"])), fill=style["header_text_color"])
        draw.text((300, 32), str(style["header_subtitle"]), font=self._font(int(style["font_header_subtitle"])), fill=style["subtitle_color"])

    def _draw_first_page(
        self,
        draw: ImageDraw.ImageDraw,
        item: ArknightsNewsItem,
        style: dict[str, Any],
        body_lines: list[str],
        font_body: ImageFont.FreeTypeFont,
        metrics: dict[str, int],
        width: int,
        height: int,
        total_pages: int,
    ):
        font_label = self._font(int(style["font_label"]))
        font_meta = self._font(int(style["font_meta"]))
        font_title = self._font(int(style["font_title"]))
        header_height = int(style["header_height"])
        draw.rectangle([72, header_height + 62, 170, header_height + 96], fill=style["header_bg_color"])
        draw.text((88, header_height + 65), self._tab_name(item.tab), font=font_label, fill=style["header_text_color"])
        date_text = datetime.fromtimestamp(item.display_time, CN_TZ).strftime("%Y-%m-%d %H:%M")
        draw.text((190, header_height + 62), date_text, font=font_meta, fill=style["meta_color"])
        if item.author:
            draw.text((190, header_height + 100), item.author, font=font_label, fill=style["muted_color"])

        title_lines = self._wrap_text(item.title, font_title, width - metrics["margin_x"] * 2)[:3]
        y = header_height + 156
        for line in title_lines:
            draw.text((88, y), line, font=font_title, fill=style["title_color"])
            y += max(int(style["font_title"] * 1.22), 44)
        draw.line([88, metrics["first_body_y"] - 22, width - 88, metrics["first_body_y"] - 22], fill=style["border_color"], width=2)
        self._draw_body(draw, body_lines, 90, metrics["first_body_y"], font_body, style["body_color"], metrics["line_height"])
        self._draw_footer(draw, item, style, width, height, 1, total_pages)

    def _draw_continue_page(
        self,
        draw: ImageDraw.ImageDraw,
        item: ArknightsNewsItem,
        style: dict[str, Any],
        body_lines: list[str],
        page_index: int,
        total_pages: int,
        font_body: ImageFont.FreeTypeFont,
        metrics: dict[str, int],
        width: int,
        height: int,
    ):
        font_label = self._font(int(style["font_label"]))
        draw.text((88, 154), str(style["continue_title"]), font=font_label, fill=style["header_bg_color"])
        draw.text((88, 190), item.title, font=self._font(24), fill=style["muted_color"])
        draw.line([88, 238, width - 88, 238], fill=style["border_color"], width=2)
        self._draw_body(draw, body_lines, 90, metrics["next_body_y"], font_body, style["body_color"], metrics["line_height"])
        self._draw_footer(draw, item, style, width, height, page_index, total_pages)

    def _draw_body(
        self,
        draw: ImageDraw.ImageDraw,
        lines: list[str],
        x: int,
        y: int,
        font: ImageFont.FreeTypeFont,
        fill: str,
        line_height: int,
    ):
        for line in lines:
            if line == "":
                y += max(line_height // 2, 12)
                continue
            draw.text((x, y), line, font=font, fill=fill)
            y += line_height

    def _draw_footer(self, draw: ImageDraw.ImageDraw, item: ArknightsNewsItem, style: dict[str, Any], width: int, height: int, page_index: int, total_pages: int):
        font_url = self._font(int(style["font_url"]))
        draw.line([88, height - 102, width - 88, height - 102], fill=style["border_color"], width=2)
        draw.text((88, height - 78), item.url, font=font_url, fill=style["url_color"])
        draw.text((width - 170, height - 78), f"{page_index}/{total_pages}", font=font_url, fill=style["muted_color"])

    def _body_lines(self, item: ArknightsNewsItem, style: dict[str, Any], font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
        text = item.content.strip() or item.brief.strip() or str(style["fallback_body"])
        return self._wrap_paragraphs(text, font, max_width)

    def _font(self, size: int) -> ImageFont.FreeTypeFont:
        family = getattr(self, "_font_family", "sans")
        candidates = [*FONT_PRESETS.get(family, []), *FONT_FALLBACKS]
        for path in candidates:
            if os.path.exists(path):
                return ImageFont.truetype(path, size=size)
        return ImageFont.load_default()

    def _wrap_paragraphs(self, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
        lines: list[str] = []
        for paragraph in text.splitlines():
            paragraph = paragraph.strip()
            if not paragraph:
                if lines and lines[-1] != "":
                    lines.append("")
                continue
            lines.extend(self._wrap_text(paragraph, font, max_width))
        return lines or [""]

    def _wrap_text(self, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
        lines: list[str] = []
        current = ""
        for ch in text:
            candidate = current + ch
            bbox = font.getbbox(candidate)
            if bbox[2] - bbox[0] <= max_width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = ch
        if current:
            lines.append(current)
        return lines

    @staticmethod
    def _tab_name(tab: str) -> str:
        return {
            "0": "公告",
            "1": "活动",
            "2": "新闻",
            "3": "维护",
        }.get(str(tab), "情报")
