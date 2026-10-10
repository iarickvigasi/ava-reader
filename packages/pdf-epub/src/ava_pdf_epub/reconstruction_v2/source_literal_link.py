"""Keep observed typography separate from a source-proven literal address link."""

from ..pdf_navigation import navigation_uri
from .segments import ObservedSpan, Segment


def source_literal_link(
    item: Segment, start: int, end: int, url: str, existing: list[ObservedSpan]
) -> list[ObservedSpan] | None:
    label = item.text.strip()
    at = len(item.text) - len(item.text.lstrip())
    if (start, end) != (at, at + len(label)) or len(existing) != 1:
        return None
    if not label.startswith(("www.", "https://", "http://")):
        return None
    try:
        printed = navigation_uri(label).url
    except ValueError:
        return None
    span = existing[0]
    allowed = {label, printed}
    if label.startswith("www."):
        allowed.add("http://" + label)
    if (
        printed != url
        or span.url not in allowed
        or not start <= span.start < span.end <= end
        or span.note_label is not None
        or span.target_text is not None
    ):
        return None
    # Source glyph/word geometry has already proven the annotation range. Do not
    # extend a model's style range to fix its URL range: preserve it independently.
    spans = []
    for observed in item.spans:
        if observed is span:
            if observed.style is not None:
                spans.append(observed.model_copy(update={"url": None}))
        else:
            spans.append(observed)
    return [*spans, ObservedSpan(start=start, end=end, url=url)]
