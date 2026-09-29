"""Map unchanged runs separately so source positions remain addressable around line wraps."""

import re
from typing import Any

from ..contracts.common import text_digest


def line_wrap_map(source: str, text: str) -> dict[str, Any]:
    matches = list(re.finditer(r"[ \t]*(?:\r\n|\r|\n)[ \t]*", source))
    segments = []
    source_at = canonical_at = 0
    for match in matches:
        if match.start() > source_at:
            size = match.start() - source_at
            segments.append(
                dict(
                    source_start=source_at,
                    source_end=match.start(),
                    canonical_start=canonical_at,
                    canonical_end=canonical_at + size,
                    kind="identity",
                )
            )
            canonical_at += size
        segments.append(
            dict(
                source_start=match.start(),
                source_end=match.end(),
                canonical_start=canonical_at,
                canonical_end=canonical_at + 1,
                kind="line_wrap",
            )
        )
        source_at = match.end()
        canonical_at += 1
    if source_at < len(source):
        segments.append(
            dict(
                source_start=source_at,
                source_end=len(source),
                canonical_start=canonical_at,
                canonical_end=len(text),
                kind="identity",
            )
        )
    return dict(source_text=source, source_sha256=text_digest(source), segments=segments)
