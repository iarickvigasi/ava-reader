"""Require a literal printed chapter label and positive same-book caller context."""

import re

from .segments import ObservedSpan, Segment

LABEL = re.compile(r"(?:Chapter|Розділ)\s+([1-9][0-9]{0,2})", re.I)
POSITIVE = re.compile(
    r"\b(?:see(?: also)?|turn to|return to|as in|as discussed in|дивіться|як у|як в)\s*$",
    re.I,
)
RANGE = re.compile(r"\s*(?:[/–—&-]|[.,]\s*[0-9]|(?:and|or|to)\b)", re.I)
FOREIGN = re.compile(r"\s+(?:in|of|from|by)\s+(?!this\s+(?:book|volume|chapter)\b)", re.I)


def chapter_reference_number(owner: Segment, span: ObservedSpan) -> str | None:
    label = span.target_text or ""
    match = LABEL.fullmatch(label)
    if (
        match is None
        or owner.kind != "paragraph"
        or not 0 <= span.start < span.end <= len(owner.text)
        or owner.text[span.start : span.end] != label
        or any(
            (s.url or s.note_label or (s.target_text and s != span))
            and s.start < span.end
            and span.start < s.end
            for s in owner.spans
        )
    ):
        return None
    prefix = owner.text[max(0, span.start - 160) : span.start]
    suffix = owner.text[span.end : span.end + 80]
    if (
        (suffix and (suffix[0].isalnum() or suffix[0] == "_"))
        or RANGE.match(suffix)
        or FOREIGN.match(suffix)
        or not POSITIVE.search(prefix)
    ):
        return None
    return match[1]
