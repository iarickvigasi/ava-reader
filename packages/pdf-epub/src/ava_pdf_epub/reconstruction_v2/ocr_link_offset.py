"""Corroborate an OCR-owned line with unchanged visible native text and geometry."""

from .native_ink import ink_envelope_matches
from .observations import NativeLine, PageObservation
from .ocr_link_context import complete_visible_line, context_line_offset, repeated_source_context
from .segments import Segment


def visual_line_offset(page: PageObservation, line: NativeLine, owner: Segment) -> int | None:
    text = line.text.strip()
    if (
        owner.method != "ocr"
        or owner.kind in {"table", "figure", "furniture", "unsupported"}
        or owner.source_marginal_furniture
        or owner.page != page.number
        or not text
        or not ink_envelope_matches(page, line, owner)
        or set(page.risks)
        & {
            "unreliable_glyph_mapping",
            "clipped_glyph",
            "optional_content",
            "complex_graphics_state",
        }
        or not complete_visible_line(line)
    ):
        return None
    at = owner.text.find(text)
    tail = at + len(text)
    unique = (
        at >= 0
        and owner.text.find(text, at + 1) < 0
        and not (
            text[0].isalnum()
            and at > 0
            and (owner.text[at - 1].isalnum() or owner.text[at - 1] == "_")
        )
        and not (
            text[-1].isalnum()
            and tail < len(owner.text)
            and (owner.text[tail].isalnum() or owner.text[tail] == "_")
        )
    )
    if unique and not repeated_source_context(page, line, owner):
        return at
    return context_line_offset(page, line, owner)
