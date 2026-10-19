"""Allocate the same deterministic style identity in the owning assembly workspace."""

import hashlib
import json
from typing import Any

from ..contracts.styles import Style


def observed_style_id(styles: dict[str, dict[str, Any]], style: Style | None) -> str | None:
    if style is None:
        return None
    value = style.model_dump(exclude={"id"})
    digest = hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()[:24]
    ident = "style-" + digest
    styles[ident] = {"id": ident, **value}
    return ident
