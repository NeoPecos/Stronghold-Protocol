#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成自托管 Web 字体（替代运行时的 fonts.googleapis.com / fonts.gstatic.com 依赖）。

为什么：页面以前每次打开都要去 Google 拉 Noto Sans SC（实测 7 个请求 / 24.3 MiB），
既慢又依赖外网。界面能显示到的字符是有限的（本工具统计），子集化后体积降一个数量级。

用法:
    python tools/build-webfonts.py            # 用 .cache/fonts/ 里的源字体生成（离线可跑）
    python tools/build-webfonts.py --fetch    # 源字体缺失时先下载（走 gh-proxy 镜像）

产物:
    public/fonts/notosanssc-var.woff2     Noto Sans SC 可变字体（wght 100-900）子集
    public/fonts/oxanium-var.woff2        Oxanium 可变字体子集（数字/拉丁）
    public/fonts/rajdhani-{500,600,700}.woff2
    public/fonts/webfonts.css             对应 @font-face（由本工具生成，勿手改）

字符表来源（界面真正可能显示的文字）:
    public/index.html, public/i18n/*.json, data/*.json, public/js/**

依赖: fontTools（含 brotli 支持 woff2）。谚文（韩文）不在 Noto Sans SC 覆盖范围，
与改动前的 Google 版本一致走系统字体回退，故不计入缺失。
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / '.cache' / 'fonts'
OUT = ROOT / 'public' / 'fonts'

# 源字体：直接地址 + 镜像地址（本机直连 raw.githubusercontent.com 会被重置，故用 gh-proxy）
SOURCES = {
    'notosanssc-var.otf': (
        'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/Variable/OTF/Subset/NotoSansSC-VF.otf',
        'https://gh-proxy.com/raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/Variable/OTF/Subset/NotoSansSC-VF.otf',
    ),
    'oxanium-var.ttf': (
        'https://raw.githubusercontent.com/google/fonts/main/ofl/oxanium/Oxanium%5Bwght%5D.ttf',
        'https://gh-proxy.com/raw.githubusercontent.com/google/fonts/main/ofl/oxanium/Oxanium%5Bwght%5D.ttf',
    ),
    'rajdhani-500.ttf': (
        'https://raw.githubusercontent.com/google/fonts/main/ofl/rajdhani/Rajdhani-Medium.ttf',
        'https://gh-proxy.com/raw.githubusercontent.com/google/fonts/main/ofl/rajdhani/Rajdhani-Medium.ttf',
    ),
    'rajdhani-600.ttf': (
        'https://raw.githubusercontent.com/google/fonts/main/ofl/rajdhani/Rajdhani-SemiBold.ttf',
        'https://gh-proxy.com/raw.githubusercontent.com/google/fonts/main/ofl/rajdhani/Rajdhani-SemiBold.ttf',
    ),
    'rajdhani-700.ttf': (
        'https://raw.githubusercontent.com/google/fonts/main/ofl/rajdhani/Rajdhani-Bold.ttf',
        'https://gh-proxy.com/raw.githubusercontent.com/google/fonts/main/ofl/rajdhani/Rajdhani-Bold.ttf',
    ),
}

# 需要生成的面：源文件 → (产物名, css font-family, 显示的 font-weight)
FACES = [
    ('notosanssc-var.otf', 'notosanssc-var.woff2', "'Noto Sans SC'", '100 900'),
    ('oxanium-var.ttf', 'oxanium-var.woff2', "'Oxanium'", '100 900'),
    ('rajdhani-500.ttf', 'rajdhani-500.woff2', "'Rajdhani'", '500'),
    ('rajdhani-600.ttf', 'rajdhani-600.woff2', "'Rajdhani'", '600'),
    ('rajdhani-700.ttf', 'rajdhani-700.woff2', "'Rajdhani'", '700'),
]

HANGUL = range(0xAC00, 0xD7A4)


def collect_chars() -> dict[str, int]:
    """统计界面可能显示到的字符（键 = 字符，值 = 出现次数）。"""
    files: list[Path] = []
    for pat, exts in (('public/i18n', ('.json',)), ('data', ('.json',)), ('public/js', ('.js',))):
        for p in (ROOT / pat).rglob('*'):
            if p.is_file() and p.suffix in exts:
                files.append(p)
    files.append(ROOT / 'public' / 'index.html')

    counts: dict[str, int] = {}
    for f in files:
        try:
            text = f.read_text(encoding='utf-8')
        except (OSError, UnicodeDecodeError):
            continue
        for ch in text:
            if ord(ch) < 0x20 or ord(ch) == 0x7F:
                continue
            counts[ch] = counts.get(ch, 0) + 1
    return counts


def fetch(name: str, url: str) -> Path:
    """下载源字体；直连被重置时退回镜像。本机 HTTP(S)_PROXY 指向未监听端口，故显式不使用代理。"""
    dest = CACHE / name
    if dest.exists() and dest.stat().st_size > 4096:
        return dest
    CACHE.mkdir(parents=True, exist_ok=True)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    direct, mirror = url
    for u in (direct, mirror):
        try:
            print(f'  下载 {u}')
            with opener.open(u, timeout=300) as r:
                data = r.read()
            if len(data) > 4096:
                dest.write_bytes(data)
                return dest
        except Exception as exc:  # noqa: BLE001 - 换镜像重试
            print(f'    失败：{type(exc).__name__}: {exc}')
    raise SystemExit(f'无法获取源字体 {name}（可手动放到 {CACHE}）')


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--fetch', action='store_true', help='源字体缺失时下载')
    args = ap.parse_args()

    from fontTools import subset
    from fontTools.ttLib import TTFont

    counts = collect_chars()
    text = ''.join(sorted(counts))
    print(f'字符表：{len(counts)} 个不同字符（{len(text.encode("utf-8"))} 字节 UTF-8）')
    if not text:
        raise SystemExit('字符表为空，检查路径')

    OUT.mkdir(parents=True, exist_ok=True)
    rules: list[str] = []
    report = {}
    for src_name, out_name, family, weight in FACES:
        src = CACHE / src_name
        if not src.exists():
            if not args.fetch:
                raise SystemExit(f'缺少源字体 {src}（先跑 --fetch）')
            fetch(src_name, SOURCES[src_name])
        options = subset.Options()
        options.flavor = 'woff2'
        options.layout_features = ['*']
        options.drop_tables += ['DSIG']
        options.name_IDs = ['*']
        options.notdef_outline = True
        font = subset.load_font(str(src), options)
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(text=text)
        subsetter.subset(font)
        dest = OUT / out_name
        subset.save_font(font, str(dest), options)
        size = dest.stat().st_size
        # 覆盖率：请求了但字体本身没有的字符（谚文除外，历来走系统回退）
        cmap = set(TTFont(str(dest), lazy=True).getBestCmap())
        missing = sorted({c for c in counts if ord(c) not in cmap and ord(c) not in HANGUL})
        report[out_name] = {'bytes': size, 'missingOutsideHangul': missing}
        print(f'  {out_name}: {size / 1024:.1f} KiB，缺字形（非谚文）{len(missing)}')
        rules.append(
            "@font-face {\n"
            f"  font-family: {family};\n"
            "  font-style: normal;\n"
            f"  font-weight: {weight};\n"
            "  font-display: swap;\n"
            f"  src: url('/fonts/{out_name}') format('woff2');\n"
            "}"
        )

    css = (
        '/* Generated by tools/build-webfonts.py — do not edit.\n'
        ' * 自托管 Web 字体子集（替代 fonts.googleapis.com / fonts.gstatic.com 的运行时依赖）。\n'
        f' * 子集字符 = 界面可能显示的文字：public/index.html + public/i18n/*.json + data/*.json + public/js/**\n'
        f' * （本次 {len(counts)} 个字符；谚文不在 Noto Sans SC 覆盖内，与改动前一致走系统回退）。\n'
        ' * 重新生成：python tools/build-webfonts.py --fetch */\n\n' + '\n\n'.join(rules) + '\n'
    )
    (OUT / 'webfonts.css').write_text(css, encoding='utf-8')
    print(f'已写入 {OUT / "webfonts.css"}（{len(css)} 字节）')
    print(json.dumps(report, ensure_ascii=True, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
