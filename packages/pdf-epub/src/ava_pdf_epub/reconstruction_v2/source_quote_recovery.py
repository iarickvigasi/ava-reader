"""Restore witnessed apostrophes only after an unchanged strict whole-owner glyph proof."""

from .continuation_presentation_contract import POLICY
from .observations import PageObservation
from .ocr_glyph_fragments import source_fragments
from .ocr_glyph_map import prove_glyph_map
from .segments import Segment


def source_quote_recovery(
    page: PageObservation, owner: Segment, owners: list[Segment], policy: str | None
) -> tuple[Segment, list[tuple[int, int, int, str, str]]] | None:
    if (
        policy != POLICY
        or owner.method != "ocr"
        or owner.kind
        not in {"paragraph", "quote", "heading", "aside", "caption", "credit", "note", "list_item"}
        or owner.source_text is not None
        or "'" not in owner.text
    ):
        return None
    fragments = source_fragments(page, owner)
    if fragments is None:
        return None
    line_ordinals = {line.id: index for index, line in enumerate(page.lines)}
    source = [
        (line_ordinals[line.id], ordinal, glyph, char)
        for line, values in fragments
        for ordinal, glyph in values
        for char in glyph.text
        if not char.isspace()
    ]
    accepted = [(index, char) for index, char in enumerate(owner.text) if not char.isspace()]
    if len(source) != len(accepted):
        return None
    text, changes = list(owner.text), []
    for (line, ordinal, glyph, expected), (index, observed) in zip(source, accepted, strict=True):
        if expected == observed:
            continue
        if (observed, expected) != ("'", "’") or glyph.text != expected:
            return None
        if any(
            span.start <= index < span.end
            and any(value is not None for value in (span.url, span.note_label, span.target_text))
            for span in owner.spans
        ):
            return None
        text[index] = expected
        changes.append((index, line, ordinal, observed, expected))
    if not changes:
        return None
    candidate = Segment.model_validate({**owner.model_dump(), "text": "".join(text)})
    current = [candidate if item is owner else item for item in owners]
    if prove_glyph_map(page, candidate, current, policy) is None:
        return None
    return candidate, changes
