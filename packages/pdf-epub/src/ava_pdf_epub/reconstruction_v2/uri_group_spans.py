"""The complete source URI group owns URL extent; observed typography keeps its exact range."""

from .segments import ObservedSpan, Segment
from .uri_group_types import PendingUriLink


def uri_group_spans(item: Segment, proof: PendingUriLink) -> list[ObservedSpan]:
    start, end = proof.full_range
    overlapping = [s for s in item.spans if s.start < end and s.end > start]
    if any(s.note_label or s.target_text for s in overlapping):
        raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
    existing = [s for s in overlapping if s.url]
    allowed = {proof.group.raw_uri, proof.target.url}
    if proof.target.derived_scheme and proof.group.raw_uri.startswith("www."):
        allowed.add("http://" + proof.group.raw_uri)
    if existing:
        if (
            len(existing) != 1
            or (existing[0].start, existing[0].end) != (start, end)
            or (existing[0].url not in allowed)
        ):
            raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
        if existing[0].url == proof.target.url:
            return item.spans
    spans = [
        s.model_copy(update={"url": None}) if s in existing else s
        for s in item.spans
        if s not in existing or s.style is not None
    ]
    return [*spans, ObservedSpan(start=start, end=end, url=proof.target.url)]
