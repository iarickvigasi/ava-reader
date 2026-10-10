"""Bind PDF link rectangles to observed native glyphs and source-page targets."""

from collections.abc import Sequence
from pathlib import Path

from pypdf import PdfReader

from ..contracts.source import Box
from ..pdf_navigation import NavigationTarget, pdf_navigation
from .annotation_regions import upright_box
from .annotation_word_ocr import recognize_annotation_words
from .annotation_words import AnnotationWord, exact_word_offsets
from .assembly_state import AssemblyState
from .findings import Finding
from .geometry import area, overlap
from .native_ink import ink_envelope_matches
from .observations import PageObservation
from .prepared import PreparedPage
from .segments import ObservedSpan, Segment
from .source_literal_link import source_literal_link


def _corroborates(text: str, line: str) -> bool:
    at = text.find(line)
    if not line or at < 0 or text.find(line, at + 1) >= 0:
        return False
    tail = at + len(line)
    return not (
        (line[0].isalnum() and at > 0 and (text[at - 1].isalnum() or text[at - 1] == "_"))
        or (line[-1].isalnum() and tail < len(text) and (text[tail].isalnum() or text[tail] == "_"))
    )


def glyph_ranges(
    page: PageObservation, segments: list[Segment], box: Box, *, corroborate_ocr: bool = False
) -> list[tuple[str, int, int]]:
    ranges: list[tuple[str, int, int]] = []
    for line in page.lines:
        if not overlap(line.box, box):
            continue
        cursor = 0
        selected = []
        for glyph in line.glyphs:
            at = line.text.find(glyph.text, cursor)
            if at < cursor:
                raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
            cursor = at + len(glyph.text)
            fraction = overlap(glyph.box, box) / area(glyph.box)
            if fraction <= 0.05 or not glyph.text.strip():
                continue
            if fraction < 0.9 or not glyph.visible:
                raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
            selected.append((at, cursor))
        if not selected:
            continue
        owners = [s for s in segments if s.method == "native" and line.id in s.native_line_ids]
        source_text, source_start = line.text, 0
        if not owners and corroborate_ocr:
            source_text = line.text.strip()
            source_start = len(line.text) - len(line.text.lstrip())
            # Geometry is not transcription authority: accepted visual text must agree
            # exactly and uniquely inside the same source line envelope.
            if set(page.risks) & {
                "unreliable_glyph_mapping",
                "clipped_glyph",
                "optional_content",
                "complex_graphics_state",
            } or any(not g.visible for g in line.glyphs if g.text.strip()):
                raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
            owners = [
                s
                for s in segments
                if s.method == "ocr"
                and s.kind not in {"table", "figure", "furniture", "unsupported"}
                and ink_envelope_matches(page, line, s)
                and _corroborates(s.text, source_text)
            ]
        if len(owners) != 1:
            raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
        owner = owners[0]
        at = owner.text.find(source_text)
        if at < 0 or owner.text.find(source_text, at + 1) >= 0:
            raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
        for start, end in selected:
            start, end = start + at - source_start, end + at - source_start
            if ranges and ranges[-1][0] == owner.id:
                ident, previous, tail = ranges[-1]
                if tail == start or owner.text[tail:start].isspace():
                    ranges[-1] = (ident, previous, end)
                    continue
            ranges.append((owner.id, start, end))
    if not ranges:
        raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
    return ranges


def scanned_ranges(
    segments: list[Segment], box: Box, words: list[AnnotationWord]
) -> list[tuple[str, int, int]]:
    """Locate link text without allowing local OCR to rewrite accepted transcription."""
    lines: dict[tuple[int, int, int], list[AnnotationWord]] = {}
    for word in words:
        lines.setdefault(word.line, []).append(word)
    result: list[tuple[str, int, int]] = []
    for line in lines.values():
        selected = []
        for ordinal, word in enumerate(line):
            fraction = overlap(word.box, box) / area(word.box)
            if fraction <= 0.05:
                continue
            if fraction < 0.9 or word.confidence < 85 or not word.visible:
                raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
            selected.append(ordinal)
        if not selected:
            continue
        candidates = []
        for item in segments:
            if item.method != "ocr" or item.kind in {"table", "figure", "furniture", "unsupported"}:
                continue
            if any(overlap(word.box, item.box) / area(word.box) < 0.9 for word in line):
                continue
            try:
                offsets = exact_word_offsets(item.text, line)
            except ValueError:
                continue
            candidates.append((item, offsets))
        if len(candidates) != 1:
            raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
        item, offsets = candidates[0]
        for ordinal in selected:
            start, end = offsets[ordinal]
            if result and result[-1][0] == item.id:
                ident, previous, tail = result[-1]
                if tail == start or item.text[tail:start].isspace():
                    result[-1] = (ident, previous, end)
                    continue
            result.append((item.id, start, end))
    if not result:
        raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
    return result


def page_target(
    target: NavigationTarget,
    segments: list[Segment],
    reader: PdfReader,
    observation: PageObservation,
) -> tuple[str, int]:
    local = [s for s in segments if s.page == target.page and s.text]
    if not local or target.page is None:
        raise ValueError("PDF_LINK_TARGET_REQUIRES_REVIEW")
    if target.top is not None or target.left is not None:
        page = reader.pages[target.page - 1]
        if page.rotation % 360 or float(page.cropbox.left) or float(page.cropbox.bottom):
            raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
        top = float(page.cropbox.top) - target.top if target.top is not None else 0
        left = target.left if target.left is not None else 0
        if not 0 <= top <= observation.height_pt or not 0 <= left <= observation.width_pt:
            raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
        lines = [line for line in observation.lines if line.box.y1 >= top and line.box.x1 >= left]
        for line in lines:
            owners = [s for s in local if line.id in s.native_line_ids]
            if not owners:
                continue
            if len(owners) != 1:
                raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
            owner = owners[0]
            at = owner.text.find(line.text)
            if at < 0 or owner.text.find(line.text, at + 1) >= 0:
                raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
            return owner.id, at
        raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
    return local[0].id, 0


def apply_pdf_links(
    source: Path,
    prepared: Sequence[PreparedPage],
    segments: list[Segment],
    state: AssemblyState,
    scratch: Path | None = None,
) -> list[Segment]:
    reader = PdfReader(source, strict=True)
    result = list(segments)
    indexes = {s.id: i for i, s in enumerate(result)}
    for checkpoint in prepared:
        number = checkpoint.observation.number
        page = reader.pages[number - 1]
        local = [s for s in result if s.page == number]
        words: list[AnnotationWord] | None = None
        for reference in page.get("/Annots", []):
            annotation = reference.get_object()
            if annotation.get("/Subtype") != "/Link":
                continue
            target = pdf_navigation(reader, annotation)
            rect = upright_box(page, [float(v) for v in annotation["/Rect"]])
            native = any(
                overlap(line.box, rect) and any(line.id in s.native_line_ids for s in local)
                for line in checkpoint.observation.lines
            )
            if native and any(s.method == "ocr" and s.text and overlap(s.box, rect) for s in local):
                # A native subset cannot stand in for the rest of a mixed-source link.
                raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
            if native:
                ranges = glyph_ranges(checkpoint.observation, local, rect)
            else:
                try:
                    ranges = glyph_ranges(checkpoint.observation, local, rect, corroborate_ocr=True)
                except ValueError:
                    if scratch is None:
                        raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW") from None
                    if words is None:
                        words = recognize_annotation_words(
                            checkpoint.observation, scratch, source, checkpoint.profile_id
                        )
                    ranges = scanned_ranges(local, rect, words)
                else:
                    state.structure_findings.append(
                        Finding(
                            code="PDF_LINK_NATIVE_GEOMETRY_CORROBORATED",
                            severity="information",
                            page=number,
                            message=(
                                "Accepted visual text exactly matches a unique visible "
                                "native line; source glyphs locate the link without rewriting text."
                            ),
                        )
                    )
            if target.derived_scheme:
                state.structure_findings.append(
                    Finding(
                        code="PDF_LINK_SCHEME_DERIVED",
                        severity="information",
                        page=number,
                        message=(
                            "A bare www host uses the HTTPS export policy; "
                            "source bytes remain unchanged."
                        ),
                    )
                )
            for ident, start, end in ranges:
                if target.url:
                    item = result[indexes[ident]]
                    mark = ObservedSpan(start=start, end=end, url=target.url)
                    existing = [s for s in item.spans if s.url and s.start < end and s.end > start]
                    if existing and (
                        len(existing) != 1
                        or existing[0].start != start
                        or existing[0].end != end
                        or existing[0].url != target.url
                    ):
                        resolved = source_literal_link(item, start, end, target.url, existing)
                        if resolved is None:
                            raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
                        result[indexes[ident]] = item.model_copy(update={"spans": resolved})
                        state.structure_findings.append(
                            Finding(
                                code="PDF_LINK_LITERAL_RANGE_FROM_SOURCE",
                                severity="information",
                                page=number,
                                message=(
                                    "Source link geometry owns the literal URL range; "
                                    "style is unchanged."
                                ),
                            )
                        )
                    if not existing:
                        result[indexes[ident]] = item.model_copy(
                            update={"spans": [*item.spans, mark]}
                        )
                else:
                    destination, offset = page_target(
                        target, result, reader, prepared[(target.page or 0) - 1].observation
                    )
                    intent = (ident, start, end, destination, offset)
                    if intent not in state.internal_targets:
                        state.internal_targets.append(intent)
    return result
