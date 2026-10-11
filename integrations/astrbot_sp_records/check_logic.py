"""插件纯逻辑自测：正则解析与群启用判断（不需要 astrbot 运行时）。

用法：python3 check_logic.py
"""
import re

RECORD_REQUEST = re.compile(r"(?:战绩|结算)\s*[:：]?\s*(.+?)\s*$|^\s*(.+?)\s*(?:的战绩|战绩|结算)\s*$")
CODE_ONLY = re.compile(r"^[A-HJ-NP-Za-hj-np-z]{4}$")
PASSWORD_REQUEST = re.compile(r"^\s*(?:改密码|修改密码|重置密码)\s+(\S+)\s+(\S+)\s+(\S+)\s*$")

failures = []


def check(label, got, want):
    ok = got == want
    if not ok:
        failures.append(label)
    print(f"  {'✅' if ok else '❌'} {label:34} → {got!r}   (期望 {want!r})")


print("=== 「战绩」解析 ===")
for text, want in [
    ("@黍 战绩 雨语", "雨语"),
    ("战绩 雨语", "雨语"),
    ("战绩：雨语", "雨语"),
    ("战绩 孙笑川", "孙笑川"),
    ("战绩 YTSZ", "YTSZ"),
    ("雨语的战绩", "雨语"),
    ("@黍 结算 电子龙无限", "电子龙无限"),
    ("今天天气不错", None),
    ("战绩", None),
]:
    match = RECORD_REQUEST.search(text)
    check(repr(text), (match.group(1) or match.group(2)).strip() if match else None, want)

print("\n=== 房间码判定（不含 I/O）===")
for text, want in [("YTSZ", True), ("ABCD", True), ("雨语", False), ("QIOP", False), ("AB1", False), ("abcd", True)]:
    check(repr(text), bool(CODE_ONLY.match(text)), want)

print("\n=== 「改密码」解析 ===")
check("完整命令", PASSWORD_REQUEST.match("改密码 雨语 oldpass123 newpass4568").groups() if PASSWORD_REQUEST.match("改密码 雨语 oldpass123 newpass4568") else None,
      ("雨语", "oldpass123", "newpass4568"))
check("带前后空格", PASSWORD_REQUEST.match("  改密码   雨语   aaa   bbb  ").groups() if PASSWORD_REQUEST.match("  改密码   雨语   aaa   bbb  ") else None,
      ("雨语", "aaa", "bbb"))
check("别名 修改密码", PASSWORD_REQUEST.match("修改密码 雨语 aaa bbb").groups() if PASSWORD_REQUEST.match("修改密码 雨语 aaa bbb") else None,
      ("雨语", "aaa", "bbb"))
check("缺参数不匹配", PASSWORD_REQUEST.match("改密码 雨语 aaa"), None)
check("闲聊不匹配", PASSWORD_REQUEST.match("我想改密码"), None)
check("密码含空格不匹配（已知限制）", PASSWORD_REQUEST.match("改密码 雨语 aa bb cc"), None)


def group_allowed(groups, mode, group_id):
    if not groups:
        return True
    return (group_id in groups) if mode == "白名单" else (group_id not in groups)


print("\n=== 群启用判断 ===")
check("白名单命中", group_allowed({"123", "456"}, "白名单", "123"), True)
check("白名单未命中", group_allowed({"123", "456"}, "白名单", "999"), False)
check("黑名单命中即拒绝", group_allowed({"123"}, "黑名单", "123"), False)
check("黑名单未命中即放行", group_allowed({"123"}, "黑名单", "999"), True)
check("空名单=全部启用", group_allowed(set(), "白名单", "999"), True)

print("\n=== 结果 ===")
if failures:
    print(f"  ❌ {len(failures)} 项失败: {failures}")
    raise SystemExit(1)
print("  ✅ 全部通过")
