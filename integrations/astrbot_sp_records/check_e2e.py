"""插件端到端自测（在 AstrBot 容器内跑）：真实数据取战绩 + 真实出图 + 账号名接口 + 改密码接口的令牌保护。

用法：docker exec -i astrbot python3 - < check_e2e.py
"""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://sp.bs.leio.fun"
OUT = Path("/tmp/sp-plugin-selftest")
failures = []


def check(label, ok, detail=""):
    if not ok:
        failures.append(label)
    print(f"  {'✅' if ok else '❌'} {label}" + (f"  {detail}" if detail else ""))


def get_json(url, timeout=15):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=timeout) as r:
        return json.loads(r.read(1 << 20))


print("=== 1. 按房间码取战绩（旧接口仍在）===")
try:
    code_record = get_json(f"{BASE}/api/records/YTSZ")
    check("GET /api/records/YTSZ", code_record.get("code") == "YTSZ", f"玩家数 {len(code_record.get('players', []))}")
except Exception as exc:  # noqa: BLE001
    check("GET /api/records/YTSZ", False, repr(exc))
    code_record = None

print("\n=== 2. 按账号名取战绩（新接口）===")
# 从一个真实的 playerId 反查不到名字，所以直接用记录里出现过的真人名字试
names = []
if code_record:
    names = [p.get("name") for p in code_record.get("players", []) if not p.get("isBot")]
print(f"  候选账号名（来自 YTSZ 一局）: {names}")
account_record = None
for name in names:
    try:
        payload = get_json(f"{BASE}/api/records/account/{urllib.parse.quote(name)}")
        account_record = payload
        check(f"GET /api/records/account/{name}", bool(payload.get("code")), f"房间 {payload.get('code')}")
        break
    except urllib.error.HTTPError as exc:
        print(f"    {name} → HTTP {exc.code}（这个账号可能没注册或还没打完）")
    except Exception as exc:  # noqa: BLE001
        print(f"    {name} → {repr(exc)}")
if not account_record:
    check("按账号名取战绩", False, "没能取到任何账号的战绩（可能都是 AI 名）")

print("\n=== 3. 未知账号必须 404 ===")
try:
    get_json(f"{BASE}/api/records/account/{urllib.parse.quote('绝对不存在的账号名')}")
    check("未知账号 → 404", False, "居然返回了 200")
except urllib.error.HTTPError as exc:
    check("未知账号 → 404", exc.code == 404, f"HTTP {exc.code}")

print("\n=== 4. 真实出图（card.py）===")
record = account_record or code_record
if record:
    try:
        sys.path.insert(0, "/opt/astrbot/data/plugins/astrbot_plugin_sp_records")
        from card import render_card, render_detail_cards  # noqa: PLC0415

        overview = render_card(record, OUT / "overview.png")
        details = render_detail_cards(record, OUT)
        size = Path(overview).stat().st_size
        check("总览图生成", size > 5000, f"{size} 字节")
        check("明细图生成", len(details) >= 1, f"{len(details)} 张")
        from PIL import Image  # noqa: PLC0415
        with Image.open(overview) as img:
            check("总览图可解码", img.width == 1100, f"{img.width}x{img.height}")
        for path in details:
            with Image.open(path) as img:
                assert img.width == 1100
        check("明细图可解码", True, f"{len(details)} 张均为 1100 宽")
    except Exception as exc:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        check("出图", False, repr(exc))
else:
    check("出图", False, "没有可用记录")

print("\n=== 5. 改密码接口的令牌保护 ===")
url = f"{BASE}/api/account/password"
body = json.dumps({"name": "x", "oldPassword": "aaaaaaaa", "newPassword": "bbbbbbbb"}).encode()


def post(token=None):
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["X-SP-Admin-Token"] = token
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, response.read(200).decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(200).decode("utf-8", "replace")


status, text = post()
print(f"  无令牌 → HTTP {status} {text}")
check("无令牌被拒（未配置时应为 404）", status in (401, 404), f"HTTP {status}")
status, text = post("wrong-token-but-long-enough")
print(f"  错令牌 → HTTP {status} {text}")
check("错令牌被拒", status in (401, 404), f"HTTP {status}")

print("\n=== 6. 插件包能否被 Python 正常导入（语法与相对导入）===")
try:
    import importlib.util  # noqa: PLC0415
    spec = importlib.util.spec_from_file_location(
        "sp_plugin_main", "/opt/astrbot/data/plugins/astrbot_plugin_sp_records/main.py",
        submodule_search_locations=["/opt/astrbot/data/plugins/astrbot_plugin_sp_records"])
    module = importlib.util.module_from_spec(spec)
    sys.modules["sp_plugin_main"] = module
    spec.loader.exec_module(module)
    check("main.py 导入成功", hasattr(module, "StrongholdRecords"))
    check("包含群聊战绩处理器", hasattr(module.StrongholdRecords, "group_record"))
    check("包含私聊改密码处理器", hasattr(module.StrongholdRecords, "private_password"))
except Exception as exc:  # noqa: BLE001
    import traceback
    traceback.print_exc()
    check("main.py 导入", False, repr(exc))

print("\n=== 结果 ===")
if failures:
    print(f"  ❌ {len(failures)} 项失败: {failures}")
    raise SystemExit(1)
print("  ✅ 全部通过")
