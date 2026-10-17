"""Translate independently source-qualified decimal digits through a complete OCR proof."""

from typing import Any

from pypdf import PdfReader

from ..contracts.source import Box
from ..pdf_navigation import NavigationTarget
from .continuation_presentation_contract import POLICY
from .observations import PageObservation
from .ocr_glyph_frame import glyph_frame_safe
from .ocr_glyph_map import ALLOWED_RISKS, prove_glyph_map
from .page_label_context import page_label_context
from .page_label_digits import page_label_digits
from .segments import Segment


def ocr_page_label_range(
    reader: PdfReader,
    target: NavigationTarget,
    page: PageObservation,
    owners: list[Segment],
    caller: Box,
    annotation: Any,
    policy: str | None,
) -> list[tuple[str, int, int]] | None:
    if policy != POLICY or not glyph_frame_safe(reader.pages[page.number - 1], page):
        return None
    context = page_label_context(reader, target, page, owners, caller, annotation, ALLOWED_RISKS)
    if context is None:
        return None
    line, label = context
    candidates = []
    for owner in owners:
        proof = prove_glyph_map(page, owner, owners, policy)
        digits = page_label_digits(page, line, owner.box, caller, label) if proof else None
        if proof is None or digits is None:
            continue
        selected, cursor = [], 0
        for ordinal, glyph in enumerate(line.glyphs):
            at = line.text.find(glyph.text, cursor)
            cursor = at + len(glyph.text)
            if digits[0] <= at < digits[1]:
                matches = [g for g in proof.glyphs if g.line_id == line.id and g.ordinal == ordinal]
                if len(matches) != 1:
                    break
                selected.extend(matches)
        else:
            if selected:
                start, end = selected[0].start, selected[-1].end
                if owner.text[start:end] == label:
                    candidates.append((owner.id, start, end))
    return candidates if len(candidates) == 1 else None
