"""Corroborate only three font roles inside one completely source-proved OCR owner."""

from typing import Any

from pypdf import PdfReader

from ..contracts.styles import Style
from .font_local_mapping import local_font_mapping
from .font_region_safety import font_region_safe
from .font_style import font_style
from .geometry import overlap
from .native_ink import ink_envelope_matches
from .observations import PageObservation
from .ocr_font_runs import FONT_FIELDS, qualified_font_runs
from .segments import Segment


def corroborated_font_region(
    source_page: Any,
    reader: PdfReader,
    page: PageObservation,
    segment: Segment,
    segments: list[Segment],
    *,
    outline_fonts: bool,
    raster: bool,
    mapping: bool,
) -> tuple[Segment, str] | None:
    if any(g.kind == "image" and overlap(g.box, segment.box) for g in page.graphics):
        return None
    lines = [line for line in page.lines if ink_envelope_matches(page, line, segment)]
    native = "".join(c for line in lines for c in line.text if not c.isspace())
    observed = "".join(c for c in segment.text if not c.isspace())
    if not native or native != observed:
        return None
    owners = [
        s
        for s in segments
        if s.page == page.number
        and s.method == "ocr"
        and s.text
        and any(ink_envelope_matches(page, line, s) for line in lines)
    ]
    if len(owners) != 1:
        return None
    if mapping and not local_font_mapping(source_page, reader, page, lines, segment, segments):
        return None
    if (outline_fonts or mapping or raster) and not font_region_safe(
        source_page, reader, page, lines, allow_raster_settings=raster
    ):
        return None
    glyphs = [g for line in lines for g in line.glyphs if g.text.strip()]
    if not glyphs or any(not g.visible for g in glyphs):
        return None
    faces = [font_style([g], "declared-face").model_dump(include=FONT_FIELDS) for g in glyphs]
    face = faces[0]
    if face["family"] is None:
        return None
    if any(f != face for f in faces):
        if not font_region_safe(source_page, reader, page, lines, allow_raster_settings=raster):
            return None
        qualified = qualified_font_runs(segment, [g for line in lines for g in line.glyphs])
        return (qualified, "OCR_DECLARED_FONT_RUNS_CORROBORATED") if qualified else None
    style = segment.style.model_dump() if segment.style else {"id": "declared-face"}
    style.update(face)
    spans = [
        span.model_copy(update={"style": span.style.model_copy(update=face)})
        if span.style is not None
        else span
        for span in segment.spans
    ]
    qualified = segment.model_copy(update={"style": Style.model_validate(style), "spans": spans})
    return qualified, "OCR_DECLARED_FONT_FACE_CORROBORATED"
