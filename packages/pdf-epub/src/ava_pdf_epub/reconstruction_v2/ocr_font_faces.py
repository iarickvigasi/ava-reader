"""Corroborate declared font roles without making native text transcription authority."""

from collections.abc import Iterable
from pathlib import Path

from pypdf import PdfReader

from .assembly_state import AssemblyState
from .continuation_presentation_contract import POLICY
from .findings import Finding
from .font_source_safety import font_source_safe
from .ocr_font_region import corroborated_font_region
from .prepared_types import AnyPreparedPage
from .segments import Segment

BLOCKERS = {
    "unreliable_glyph_mapping",
    "clipped_glyph",
    "optional_content",
    "complex_graphics_state",
}


def corroborate_ocr_font_faces(
    source: Path,
    prepared: Iterable[AnyPreparedPage],
    segments: list[Segment],
    state: AssemblyState,
    *,
    uniform_owner_ids: frozenset[str] | None = None,
) -> list[Segment]:
    reader = PdfReader(source, strict=True)
    updates = {}
    current = state.source_continuation_policy == POLICY
    for checkpoint in prepared:
        page = checkpoint.observation
        source_page = reader.pages[page.number - 1]
        blocked = set(page.risks) & BLOCKERS
        mapping = bool(current and blocked == {"unreliable_glyph_mapping"})
        if (blocked and not mapping) or not font_source_safe(
            source_page, reader, allow_outline_type3=True, allow_raster_settings=current
        ):
            continue
        outline_fonts = any(
            f.get_object().get("/Subtype") == "/Type3"
            for f in source_page.get("/Resources", {}).get("/Font", {}).values()
        )
        for segment in segments:
            if uniform_owner_ids is not None and segment.id not in uniform_owner_ids:
                continue
            if segment.page != page.number or segment.method != "ocr" or not segment.text:
                continue
            proof = corroborated_font_region(
                source_page,
                reader,
                page,
                segment,
                segments,
                outline_fonts=outline_fonts,
                raster=current,
                mapping=mapping,
            )
            if proof is None:
                continue
            qualified, code = proof
            if uniform_owner_ids is not None and code != "OCR_DECLARED_FONT_FACE_CORROBORATED":
                continue
            updates[segment.id] = qualified
            message = (
                "Fully visible source glyphs corroborate exact mixed font runs; "
                "OCR text, geometry and link ranges stay unchanged."
                if code == "OCR_DECLARED_FONT_RUNS_CORROBORATED"
                else "Uniform visible source font roles corroborate OCR typography; "
                "text and geometry stay unchanged."
            )
            state.structure_findings.append(
                Finding(
                    code=code,
                    severity="information",
                    page=page.number,
                    message=message
                    + (
                        " Complete regional mapping is proved separately from "
                        "external unmapped source glyphs."
                        if mapping
                        else ""
                    ),
                    block_id=segment.id if mapping or uniform_owner_ids is not None else None,
                    box=segment.box if mapping else None,
                )
            )

    return [updates.get(s.id, s) for s in segments]
