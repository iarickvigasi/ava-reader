"""Mirror only the existing host's six-digit style-color case normalization."""

import re
from typing import Any, cast

from .attempt_exchange import strict_json
from .recognition_geometry_prompt import GEOMETRY_RESPONSE_BYTES

_COLOR = re.compile(r"#[0-9a-fA-F]{6}\Z")
_COLOR_FIELDS = ("color", "background_color", "decoration_color")


def canonical_geometry_parent(original_response_json: str) -> dict[str, Any]:
    raw = original_response_json.encode()
    if not 0 < len(raw) <= GEOMETRY_RESPONSE_BYTES:
        raise ValueError("GEOMETRY_RESPONSE_BOUND")
    parent = strict_json(raw)
    if not isinstance(parent, dict):
        raise ValueError("GEOMETRY_PARENT_DIFFERS")
    _style_colors(parent)
    return cast(dict[str, Any], parent)


def _style_colors(value: Any) -> None:
    if isinstance(value, list):
        for item in value:
            _style_colors(item)
    elif isinstance(value, dict):
        style = value.get("style")
        if isinstance(style, dict):
            for field in _COLOR_FIELDS:
                color = style.get(field)
                if isinstance(color, str) and _COLOR.fullmatch(color):
                    style[field] = color.lower()
        for item in value.values():
            _style_colors(item)
