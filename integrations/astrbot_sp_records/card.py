from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


FONT_PATHS = (
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "C:/Windows/Fonts/msyh.ttc",
)


def font(size):
    for candidate in FONT_PATHS:
        if Path(candidate).is_file():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def render_card(record, destination):
    players = record.get("players") or []
    width = 1100
    height = 214 + len(players) * 235
    canvas = Image.new("RGB", (width, height), "#0b1519")
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, width, 9), fill="#40d7b4")
    draw.text((48, 33), "卫戍协议 · 对局战绩", font=font(39), fill="#eaf9f5")
    draw.text((50, 91), f"房间 {record.get('code', '----')}  /  第 {record.get('matchNo', '?')} 局", font=font(26), fill="#48d3b5")
    outcome = "作战成功" if record.get("victory") else "作战结束"
    draw.text((50, 132), f"{outcome}   ·   通过 {record.get('roundsPassed', 0)} 回合", font=font(22), fill="#9bb9b3")
    draw.line((48, 180, width - 48, 180), fill="#27443f", width=2)
    for index, player in enumerate(players):
        top = 198 + index * 235
        draw.rounded_rectangle((48, top, width - 48, top + 219), radius=12, fill="#152a2c", outline="#315c57", width=2)
        name = str(player.get("name") or "博士")[:12]
        draw.text((72, top + 17), f"P{player.get('seat', index) + 1}  {name}", font=font(28), fill="#f0faf6")
        stats = player.get("stats") or {}
        share = max(0, min(100, float(player.get("damageSharePct") or 0)))
        draw.text((700, top + 22), f"输出占比  {share:g}%", font=font(26), fill="#f3c864")
        draw.rounded_rectangle((72, top + 69, width - 72, top + 82), radius=6, fill="#25413f")
        if share:
            draw.rounded_rectangle((72, top + 69, 72 + int((width - 144) * share / 100), top + 82), radius=6, fill="#47d2b0")
        labels = (
            ("输出", "dmgDealt"), ("盟约层数", "activatedLayers"),
            ("买卡", "buys"), ("刷新", "refreshes"), ("领袖伤害", "bossDamage"),
            ("击倒敌人", "kills"), ("晋升", "merges"), ("装备", "itemsEquipped"),
            ("消耗资金", "gold"), ("完美回合", "perfectRounds"),
        )
        for index_in_card, (label, key) in enumerate(labels):
            x_position = 72 + (index_in_card % 5) * 192
            row_offset = (index_in_card // 5) * 56
            draw.text((x_position, top + 99 + row_offset), label, font=font(19), fill="#91aaa5")
            draw.text((x_position, top + 125 + row_offset), f"{int(stats.get(key) or 0):,}", font=font(25), fill="#e5f3ef")
    output = Path(destination)
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, "PNG")
    return str(output)


def render_detail_cards(record, directory):
    output = Path(directory)
    output.mkdir(parents=True, exist_ok=True)
    paths = []
    for player in record.get("players") or []:
        purchases = player.get("purchases") or []
        bonds = [bond for bond in player.get("bonds") or [] if bond.get("active") or bond.get("layers")]
        page_count = max(1, (len(purchases) + 19) // 20)
        for page_index in range(page_count):
            page_purchases = purchases[page_index * 20:(page_index + 1) * 20]
            page_bonds = bonds if page_index == 0 else []
            bond_rows = (len(page_bonds) + 1) // 2
            purchase_rows = (len(page_purchases) + 1) // 2
            height = (285 if page_bonds else 234) + bond_rows * 45 + purchase_rows * 52
            canvas = Image.new("RGB", (1100, height), "#0b1519")
            draw = ImageDraw.Draw(canvas)
            draw.rectangle((0, 0, 1100, 8), fill="#40d7b4")
            header = f"{record.get('code', '----')} · P{int(player.get('seat', 0)) + 1} {str(player.get('name') or '博士')[:12]}"
            draw.text((48, 35), header, font=font(34), fill="#eaf9f5")
            draw.text((49, 89), f"购入卡牌与盟约明细  {page_index + 1}/{page_count}", font=font(21), fill="#8fb5ab")
            cursor = 150
            if page_bonds:
                draw.text((49, cursor), "盟约层数", font=font(26), fill="#48d3b5")
                cursor += 42
                for bond_index, bond in enumerate(page_bonds):
                    column = bond_index % 2
                    row = bond_index // 2
                    name = str(bond.get("name") or bond.get("bondId") or "盟约")[:16]
                    draw.text((50 + column * 510, cursor + row * 45), name, font=font(20), fill="#e3f0eb")
                    draw.text((395 + column * 510, cursor + row * 45), f"{int(bond.get('layers') or 0)} 层", font=font(20), fill="#f3c864")
                cursor += bond_rows * 45 + 20
            draw.text((49, cursor), "购入卡牌", font=font(26), fill="#48d3b5")
            cursor += 43
            if not page_purchases:
                draw.text((50, cursor), "本局没有购入卡牌", font=font(21), fill="#8fb5ab")
            for purchase_index, purchase in enumerate(page_purchases):
                column = purchase_index % 2
                row = purchase_index // 2
                x_position = 50 + column * 510
                y_position = cursor + row * 52
                label = "装" if purchase.get("kind") == "item" else "干"
                name = str(purchase.get("name") or purchase.get("id") or "未知")[:15]
                draw.text((x_position, y_position), f"[{label}] {name}", font=font(20), fill="#e3f0eb")
                draw.text((x_position + 360, y_position), f"×{int(purchase.get('count') or 0)}", font=font(21), fill="#f3c864")
                rounds = " ".join(f"{round_no}R×{count}" for round_no, count in (purchase.get("byRound") or {}).items())
                draw.text((x_position, y_position + 27), f"{rounds} · 花费 {int(purchase.get('spent') or 0)}", font=font(16), fill="#8fb5ab")
            destination = output / f"P{int(player.get('seat', 0)) + 1}-{page_index + 1}.png"
            canvas.save(destination, "PNG")
            paths.append(str(destination))
    return paths
