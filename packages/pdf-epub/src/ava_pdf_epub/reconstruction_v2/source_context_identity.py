"""A source role receipt survives style/link recovery, never content or ownership changes."""

import hashlib
import json

from .segments import Segment


def source_context_identity(segment: Segment) -> str:
    value = segment.model_dump(
        mode="json",
        include={
            "id",
            "page",
            "box",
            "text",
            "source_text",
            "kind",
            "continues_from_previous",
            "continues_to_next",
            "related_to",
        },
    )
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()
