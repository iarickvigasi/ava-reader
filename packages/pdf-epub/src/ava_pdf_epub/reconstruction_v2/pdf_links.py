"""Bind PDF link rectangles to observed native glyphs and source-page targets."""

import math
from collections.abc import Mapping, Sequence
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
from .literal_page_label import literal_page_label_range
from .native_caller_context import ContextCache, NativeCallerLowConfidence, native_caller_ranges
from .native_line_offsets import NativeLineOffset, mapped_line_offset
from .native_link_resolution import NativeLinkResolution
from .native_literal_uri import raw_literal_uri
from .observations import PageObservation
from .ocr_link_offset import visual_line_offset
from .prepared_types import AnyPreparedPage
from .segments import ObservedSpan, Segment
from .source_literal_link import source_literal_link


def glyph_ranges(
    page: PageObservation,
    segments: list[Segment],
    box: Box,
    *,
    corroborate_ocr: bool = False,
    source_line_maps: Mapping[str, NativeLineOffset] | None = None,
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
        visual_offsets: dict[str, int] = {}
        if not owners and corroborate_ocr:
            source_text = line.text.strip()
            source_start = len(line.text) - len(line.text.lstrip())
            # Shared caller/destination proof preserves OCR text authority.
            owners = []
            for candidate in segments:
                visual_at = visual_line_offset(page, line, candidate)
                if visual_at is not None:
                    owners.append(candidate)
                    visual_offsets[candidate.id] = visual_at
        if len(owners) != 1:
            raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
        owner = owners[0]
        mapped = (
            mapped_line_offset(line, owner, source_line_maps)
            if owner.method == "native"
            else visual_offsets.get(owner.id)
        )
        at = mapped if mapped is not None else owner.text.find(source_text)
        if mapped is None:
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
    *,
    source_line_maps: Mapping[str, NativeLineOffset] | None = None,
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
            # PDF32000-1 12.3.2.2/Table151: XYZ positions a viewport, whose
            # origin can precede the visible page. Keep the exact coordinates;
            # only known frames can project that view onto retained source text.
            unit = page.get("/UserUnit", 1)
            if not (
                target.fit == "/XYZ"
                and target.top is not None
                and target.left is not None
                and math.isfinite(top)
                and math.isfinite(left)
                and (top < 0 or left < 0)
                and top <= observation.height_pt
                and left <= observation.width_pt
                and observation.number == target.page
                and observation.rotation == 0
                and observation.width_pt == float(page.cropbox.width)
                and observation.height_pt == float(page.cropbox.height)
                and list(page.cropbox) == list(page.mediabox)
                and isinstance(unit, (int, float))
                and not isinstance(unit, bool)
                and unit == 1
            ):
                raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
            # Mirror assemble_pages: omitted furniture cannot own a published
            # target even when its raw glyphs precede the first retained line.
            local = [s for s in local if s.kind != "furniture" and not s.source_marginal_furniture]
        lines = [line for line in observation.lines if line.box.y1 >= top and line.box.x1 >= left]
        for line in lines:
            owners = [s for s in local if line.id in s.native_line_ids]
            if not owners:
                visual = [
                    s
                    for s in local
                    if s.method == "ocr"
                    and s.kind not in {"table", "figure", "furniture", "unsupported"}
                    and not s.source_marginal_furniture
                    and any(g.text.strip() and overlap(g.box, s.box) for g in line.glyphs)
                ]
                if not visual:
                    continue
                # A covered but unprovable line must not redirect to later text.
                if len(visual) != 1:
                    raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
                visual_at = visual_line_offset(observation, line, visual[0])
                if visual_at is None:
                    raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
                return visual[0].id, visual_at
            if len(owners) != 1:
                raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
            owner = owners[0]
            at = mapped_line_offset(line, owner, source_line_maps)
            if at is None:
                at = owner.text.find(line.text)
                if at < 0 or owner.text.find(line.text, at + 1) >= 0:
                    raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
            return owner.id, at
        raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
    return local[0].id, 0


def apply_pdf_links(
    source: Path,
    prepared: Sequence[AnyPreparedPage],
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
        native_words: ContextCache = {}
        with NativeLinkResolution(source, checkpoint) as resolution:
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
                if native and any(
                    s.method == "ocr" and s.text and overlap(s.box, rect) for s in local
                ):
                    # A native subset cannot stand in for the rest of a mixed-source link.
                    raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
                if native:
                    try:
                        ranges = glyph_ranges(
                            checkpoint.observation,
                            local,
                            rect,
                            source_line_maps=state.native_line_maps,
                        )
                    except ValueError as error:
                        if str(error) != "PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW" or scratch is None:
                            raise
                        label_ranges = literal_page_label_range(
                            reader,
                            target,
                            checkpoint.observation,
                            local,
                            rect,
                            state.native_line_maps,
                            annotation=annotation,
                        )
                        if label_ranges is not None:
                            ranges = label_ranges
                            state.structure_findings.append(
                                Finding(
                                    code="PDF_LINK_PAGE_LABEL_CORROBORATED",
                                    severity="information",
                                    page=number,
                                    message=(
                                        "An explicit unique PDF page label and qualified native "
                                        "digits identify the reference; its comma stays unlinked."
                                    ),
                                )
                            )
                        else:
                            try:
                                ranges = native_caller_ranges(
                                    checkpoint.observation,
                                    local,
                                    rect,
                                    scratch,
                                    checkpoint.profile_id,
                                    state.native_line_maps,
                                    native_words,
                                    literal_uri=raw_literal_uri(annotation, target),
                                    findings=state.structure_findings,
                                )
                            except NativeCallerLowConfidence:
                                # A fresh cache prevents reuse of lower-resolution word boxes.
                                ranges = native_caller_ranges(
                                    resolution.observation(),
                                    local,
                                    rect,
                                    resolution.directory,
                                    checkpoint.profile_id,
                                    state.native_line_maps,
                                    resolution.words,
                                    literal_uri=raw_literal_uri(annotation, target),
                                    findings=state.structure_findings,
                                )
                                state.structure_findings.append(
                                    Finding(
                                        code="PDF_LINK_HIGH_RESOLUTION_CORROBORATED",
                                        severity="information",
                                        page=number,
                                        message=(
                                            "One higher-resolution source render passed unchanged "
                                            "text, confidence and geometry checks for this link."
                                        ),
                                    )
                                )
                else:
                    try:
                        ranges = glyph_ranges(
                            checkpoint.observation,
                            local,
                            rect,
                            corroborate_ocr=True,
                            source_line_maps=state.native_line_maps,
                        )
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
                                    "native line; source glyphs locate the link "
                                    "without rewriting text."
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
                        existing = [
                            s for s in item.spans if s.url and s.start < end and s.end > start
                        ]
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
                            target,
                            result,
                            reader,
                            prepared[(target.page or 0) - 1].observation,
                            source_line_maps=state.native_line_maps,
                        )
                        intent = (ident, start, end, destination, offset)
                        if intent not in state.internal_targets:
                            state.internal_targets.append(intent)
    return result
