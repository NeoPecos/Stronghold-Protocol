import json
from pathlib import Path
from typing import Any

from astrbot.api.star import StarTools


class NewsState:
    def __init__(self, plugin_name: str):
        self.data_dir = StarTools.get_data_dir(plugin_name)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.card_dir = self.data_dir / "cards"
        self.card_dir.mkdir(exist_ok=True)
        self.path = self.data_dir / "state.json"
        self.data = self._load()

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"seen_cids": [], "target_umos": [], "card_style": {}}
        try:
            return json.loads(self.path.read_text(encoding="utf-8"))
        except Exception:
            return {"seen_cids": [], "target_umos": [], "card_style": {}}

    def save(self):
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(self.path)

    def was_delivered(self, cid: str, target: str) -> bool:
        return target in self.data.get("delivered", {}).get(cid, [])

    def mark_delivered(self, cid: str, target: str):
        records = self.data.setdefault("delivered", {})
        targets = records.setdefault(cid, [])
        if target not in targets:
            targets.append(target)
        self.data["delivered"] = dict(list(records.items())[-300:])
        self.save()

    @property
    def seen_cids(self) -> set[str]:
        return set(str(x) for x in self.data.get("seen_cids", []))

    def mark_seen(self, cids: list[str]):
        merged = list(dict.fromkeys([*cids, *self.data.get("seen_cids", [])]))
        self.data["seen_cids"] = merged[:300]
        self.save()

    # ---- B 站官号（动态 / 投稿）去重，裁剪风格与 mark_seen 保持一致 ----
    @property
    def seen_dynamic_ids(self) -> set[str]:
        return set(str(x) for x in self.data.get("seen_dynamic_ids", []))

    def mark_dynamic_seen(self, dynamic_ids: list[str]):
        merged = list(dict.fromkeys([*dynamic_ids, *self.data.get("seen_dynamic_ids", [])]))
        self.data["seen_dynamic_ids"] = merged[:300]
        self.save()

    @property
    def seen_bvids(self) -> set[str]:
        return set(str(x) for x in self.data.get("seen_bvids", []))

    def mark_bvid_seen(self, bvids: list[str]):
        merged = list(dict.fromkeys([*bvids, *self.data.get("seen_bvids", [])]))
        self.data["seen_bvids"] = merged[:300]
        self.save()

    def get_targets(self, config_targets: list[str] | None = None) -> list[str]:
        targets = []
        for value in config_targets or []:
            if value and value not in targets:
                targets.append(value)
        for value in self.data.get("target_umos", []):
            if value and value not in targets:
                targets.append(value)
        return targets

    def add_target(self, umo: str):
        targets = self.data.setdefault("target_umos", [])
        if umo not in targets:
            targets.append(umo)
            self.save()

    def remove_target(self, umo: str):
        targets = self.data.setdefault("target_umos", [])
        if umo in targets:
            targets.remove(umo)
            self.save()

    @property
    def reminders(self) -> list[dict[str, Any]]:
        items = self.data.get("reminders")
        if not isinstance(items, list):
            items = []
            self.data["reminders"] = items
        return items

    def has_reminder(self, cid: str) -> bool:
        return any(str(item.get("cid") or "") == str(cid) for item in self.reminders)

    def add_reminder(self, record: dict[str, Any]):
        key = str(record.get("cid") or "")
        for existing in self.reminders:
            if str(existing.get("cid") or "") == key:
                existing.update(record)
                break
        else:
            self.reminders.append(record)
        self.data["reminders"] = self.reminders[-100:]
        self.save()

    def patch_reminder(self, cid: str, **patch: Any):
        for existing in self.reminders:
            if str(existing.get("cid") or "") == str(cid):
                existing.update(patch)
                self.save()
                return

    def drop_expired_reminders(self, before_ts: float, keep: int = 50):
        kept = [item for item in self.reminders if float(item.get("end_ts") or 0) >= before_ts]
        self.data["reminders"] = kept[-keep:]
        self.save()

    @property
    def card_style(self) -> dict[str, Any]:
        style = self.data.setdefault("card_style", {})
        return dict(style) if isinstance(style, dict) else {}

    def update_card_style(self, patch: dict[str, Any]) -> dict[str, Any]:
        style = self.data.setdefault("card_style", {})
        if not isinstance(style, dict):
            style = {}
            self.data["card_style"] = style
        style.update(patch)
        self.save()
        return dict(style)
