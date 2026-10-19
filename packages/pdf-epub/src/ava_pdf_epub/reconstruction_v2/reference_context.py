"""An observed folio is not proof that a citation refers to this book."""

import re

from .segments import Segment
from .structure_claims import title_key


def same_book_reference(
    segment: Segment, start: int, end: int, page: int, segments: list[Segment]
) -> bool:
    if any(span.url and span.start <= start and end <= span.end for span in segment.spans):
        return False
    prefix = segment.text[max(0, start - 160) : start]
    suffix = segment.text[end : end + 80]
    if re.match(r"\s+(?:in|of|from)\s+(?!this\s+(?:book|volume|chapter)\b)", suffix, re.I):
        raise ValueError("Printed reference may cite another work and requires review")
    names = [title_key(s.text) for s in segments if s.page == page and s.kind == "heading"]
    matched = any(name and name in title_key(prefix) for name in names)
    positive = bool(
        re.search(r"\b(?:see|turn to|return to|continued on|continues on)\s*$", prefix, re.I)
    )
    explicit = bool(re.search(r"\bthis\s+(?:book|volume|chapter)\b", prefix + suffix, re.I))
    if not (matched or positive or explicit):
        raise ValueError("Printed reference has no positive same-book context")
    return True
