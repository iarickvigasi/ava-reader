"""Map exact layout joins separately; never remove a printed hyphen or guess text offsets."""

import re
from typing import Any

from ..contracts.common import text_digest
from ..contracts.layout_wrap import compound_wrap


def _wraps(source: str, compact: bool, compounds: bool) -> list[tuple[int, int, str]]:
    pattern = r"[ \t]*(?:\r\n|\r|\n)[ \t]*" if compact else r"\r\n|\r|\n"
    events = []
    for match in re.finditer(pattern, source):
        start, end = match.span()
        if compounds:
            while start > 0 and source[start - 1] in " \t":
                start -= 1
            while end < len(source) and source[end] in " \t":
                end += 1
            if compound_wrap(source, start, end):
                events.append((start, end, ""))
                continue
        events.append((*match.span(), " "))
    return events


def line_wrap_map(source: str, text: str) -> dict[str, Any]:
    # Legacy identity whitespace and compact wrapping both remain exact modes.
    # Compound mode removes only proven layout whitespace between letter-hyphen/letter.
    for compact, compounds in ((False, False), (True, False), (False, True), (True, True)):
        events = _wraps(source, compact, compounds)
        parts: list[str] = []
        at = 0
        for start, end, replacement in events:
            parts.extend((source[at:start], replacement))
            at = end
        parts.append(source[at:])
        if "".join(parts) == text:
            break
    else:
        raise ValueError("Unaccounted source-to-canonical text transformation")
    segments = []
    source_at = canonical_at = 0
    for start, end, replacement in events:
        if start > source_at:
            size = start - source_at
            segments.append(
                dict(
                    source_start=source_at,
                    source_end=start,
                    canonical_start=canonical_at,
                    canonical_end=canonical_at + size,
                    kind="identity",
                )
            )
            canonical_at += size
        segments.append(
            dict(
                source_start=start,
                source_end=end,
                canonical_start=canonical_at,
                canonical_end=canonical_at + len(replacement),
                kind="line_wrap",
            )
        )
        source_at = end
        canonical_at += len(replacement)
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
