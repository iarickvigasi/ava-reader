"""Only kind-relevant metadata is mandatory; core observations remain explicit fields."""

from typing import Any

KIND_REQUIRED = {
    "heading": ["heading_level", "chapter_start"],
    "note": ["note_label", "note_role"],
    "list_item": ["list_ordered", "list_depth"],
    "table": ["cells"],
    "figure": ["alt"],
    "caption": ["related_to"],
    "credit": ["related_to"],
}


def require_kind_fields(value: Any) -> Any:
    if isinstance(value, dict):
        kind = value.get("kind")
        if not isinstance(kind, str):
            raise ValueError("Recognition kind must be a string")
        required = list(KIND_REQUIRED.get(kind, []))
        if value.get("chapter_start") is True:
            required.append("chapter_role")
        if value.get("list_ordered") is True:
            required.append("list_start")
        if any(field not in value for field in required):
            raise ValueError("Missing explicit observation required for segment kind")
    return value
