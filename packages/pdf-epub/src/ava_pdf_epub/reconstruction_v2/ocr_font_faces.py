"""Corroborate uniform declared font roles without making native text transcription authority."""

from collections.abc import Sequence
from pathlib import Path

from pypdf import PdfReader

from ..contracts.styles import Style
from .assembly_state import AssemblyState
from .findings import Finding
from .font_region_safety import font_region_safe
from .font_source_safety import font_source_safe
from .font_style import font_style
from .geometry import overlap
from .native_ink import ink_envelope_matches
from .ocr_font_runs import qualified_font_runs
from .prepared import PreparedPage
from .segments import Segment

FONT_FIELDS = {"family", "bold", "italic"}
BLOCKERS = {
    "unreliable_glyph_mapping",
    "clipped_glyph",
    "optional_content",
    "complex_graphics_state",
}


def corroborate_ocr_font_faces(
    source: Path, prepared: Sequence[PreparedPage], segments: list[Segment], state: AssemblyState
) -> list[Segment]:
    reader = PdfReader(source, strict=True)
    updates = {}
    for checkpoint in prepared:
        page = checkpoint.observation
        if set(page.risks) & BLOCKERS or not font_source_safe(
            reader.pages[page.number - 1], reader, allow_outline_type3=True
        ):
            continue
        source_page = reader.pages[page.number - 1]
        outline_fonts = any(
            f.get_object().get("/Subtype") == "/Type3"
            for f in source_page.get("/Resources", {}).get("/Font", {}).values()
        )
        for segment in segments:
            if segment.page != page.number or segment.method != "ocr" or not segment.text:
                continue
            if any(g.kind == "image" and overlap(g.box, segment.box) for g in page.graphics):
                continue  # Scan pixels cannot certify the font of a hidden/aligned OCR layer.
            lines = [line for line in page.lines if ink_envelope_matches(page, line, segment)]
            native = "".join(c for line in lines for c in line.text if not c.isspace())
            observed = "".join(c for c in segment.text if not c.isspace())
            if not native or native != observed:
                continue
            owners = [
                s
                for s in segments
                if s.page == page.number
                and s.method == "ocr"
                and s.text
                and any(ink_envelope_matches(page, line, s) for line in lines)
            ]
            if len(owners) != 1:
                continue
            if outline_fonts and not font_region_safe(source_page, reader, page, lines):
                continue
            glyphs = [g for line in lines for g in line.glyphs if g.text.strip()]
            if not glyphs or any(not g.visible for g in glyphs):
                continue
            faces = [
                font_style([g], "declared-face").model_dump(include=FONT_FIELDS) for g in glyphs
            ]
            face = faces[0]
            if face["family"] is None:
                continue
            if any(f != face for f in faces):
                if not font_region_safe(reader.pages[page.number - 1], reader, page, lines):
                    continue
                qualified = qualified_font_runs(segment, [g for line in lines for g in line.glyphs])
                if qualified is not None:
                    updates[segment.id] = qualified
                    state.structure_findings.append(
                        Finding(
                            code="OCR_DECLARED_FONT_RUNS_CORROBORATED",
                            severity="information",
                            page=page.number,
                            message=(
                                "Fully visible source glyphs corroborate exact mixed font runs; "
                                "OCR text, geometry and link ranges stay unchanged."
                            ),
                        )
                    )
                continue
            style = segment.style.model_dump() if segment.style else {"id": "declared-face"}
            style.update(face)
            spans = [
                span.model_copy(update={"style": span.style.model_copy(update=face)})
                if span.style is not None
                else span
                for span in segment.spans
            ]
            updates[segment.id] = segment.model_copy(
                update={"style": Style.model_validate(style), "spans": spans}
            )
            state.structure_findings.append(
                Finding(
                    code="OCR_DECLARED_FONT_FACE_CORROBORATED",
                    severity="information",
                    page=page.number,
                    message=(
                        "Uniform visible source font roles corroborate OCR typography; "
                        "text and geometry stay unchanged."
                    ),
                )
            )
    return [updates.get(s.id, s) for s in segments]
