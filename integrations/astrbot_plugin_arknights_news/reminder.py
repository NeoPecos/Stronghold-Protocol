"""维护时间解析与提醒文案。

从公告正文里抠出停服维护的时间段，供定时提醒使用。
公告里的时间都是北京时间，而机器时区不一定是 UTC+8，因此统一按 CN_TZ 处理。
"""

import re
from datetime import datetime, timedelta, timezone

CN_TZ = timezone(timedelta(hours=8))

_SEP = r"\s*(?:[~～\-—－–﹣至到])\s*"
_TRANS = str.maketrans("０１２３４５６７８９：～－—", "0123456789:~--")


def now_cn() -> datetime:
    """当前的北京时间，naive 形式，便于和公告里解析出的时间直接比较。"""
    return datetime.now(CN_TZ).replace(tzinfo=None)


def _date(n: int) -> str:
    return rf"(?P<y{n}>\d{{4}})\s*[-/年.]\s*(?P<m{n}>\d{{1,2}})\s*[-/月.]\s*(?P<d{n}>\d{{1,2}})\s*[日号]?"


def _date_short(n: int) -> str:
    return rf"(?P<m{n}>\d{{1,2}})\s*月\s*(?P<d{n}>\d{{1,2}})\s*[日号]"


def _time(n: int) -> str:
    return rf"(?P<h{n}>\d{{1,2}})\s*[:：]\s*(?P<mi{n}>\d{{2}})"


# 顺序即优先级：越精确的写法越先尝试。
_RANGE_PATTERNS: list[re.Pattern] = [
    # 2026年10月09日 10:00 ~ 2026年10月09日 16:00
    re.compile(_date(1) + r"[^0-9]{0,8}" + _time(1) + _SEP + _date(2) + r"[^0-9]{0,8}" + _time(2)),
    # 2026年10月09日 10:00 ~ 16:00
    re.compile(_date(1) + r"[^0-9]{0,8}" + _time(1) + _SEP + _time(2)),
    # 10月09日 10:00 ~ 10月09日 16:00
    re.compile(_date_short(1) + r"[^0-9]{0,8}" + _time(1) + _SEP + _date_short(2) + r"[^0-9]{0,8}" + _time(2)),
    # 10月09日 10:00 ~ 16:00
    re.compile(_date_short(1) + r"[^0-9]{0,8}" + _time(1) + _SEP + _time(2)),
]


def _safe_datetime(year: int, month: int, day: int, hour: int, minute: int) -> datetime | None:
    try:
        return datetime(year, month, day, hour, minute)
    except ValueError:
        return None


def _pick(groups: dict, name: str) -> int | None:
    value = groups.get(name)
    return int(value) if value is not None else None


def _interpret(groups: dict, now: datetime) -> tuple[datetime, datetime] | None:
    month, day = _pick(groups, "m1"), _pick(groups, "d1")
    hour, minute = _pick(groups, "h1"), _pick(groups, "mi1")
    if None in (month, day, hour, minute):
        return None
    year = _pick(groups, "y1") or now.year
    start = _safe_datetime(year, month, day, hour, minute)
    if start is None:
        return None
    if groups.get("y1") is None and start < now - timedelta(days=30):
        start = _safe_datetime(year + 1, month, day, hour, minute) or start

    end_hour, end_minute = _pick(groups, "h2"), _pick(groups, "mi2")
    if end_hour is None or end_minute is None:
        return None
    end_month = _pick(groups, "m2") or start.month
    end_day = _pick(groups, "d2") or start.day
    end_year = _pick(groups, "y2")
    if end_year is None:
        end_year = start.year
        if (end_month, end_day) < (start.month, start.day):
            end_year += 1
    end = _safe_datetime(end_year, end_month, end_day, end_hour, end_minute)
    if end is None:
        return None
    if end <= start:
        end += timedelta(days=1)
    return start, end


def parse_maintenance_window(text: str, now: datetime | None = None) -> tuple[datetime, datetime] | None:
    """返回公告里的 (维护开始, 维护结束)，解析不到时为 None。"""
    if not text:
        return None
    now = now or now_cn()
    flat = text.translate(_TRANS)
    for pattern in _RANGE_PATTERNS:
        for match in pattern.finditer(flat):
            window = _interpret(match.groupdict(), now)
            if window:
                return window
    return None


_CN_DIGITS = {1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六", 7: "七", 8: "八", 9: "九", 10: "十"}


def pre_reminder_text(advance_minutes: int) -> str:
    minutes = _CN_DIGITS.get(advance_minutes, str(advance_minutes))
    return f"还有{minutes}分钟罗德岛要关门维护啦，还在指挥作战的博士注意一下哦～"


def open_reminder_text() -> str:
    return "罗德岛维护完成，又有什么新变化呢，有点好奇耶～"
