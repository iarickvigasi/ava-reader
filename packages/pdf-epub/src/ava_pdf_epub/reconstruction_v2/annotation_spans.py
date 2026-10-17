"""Source glyph or independently corroborated OCR geometry determines annotation spans."""

from pathlib import Path

from PIL import Image

from ..contracts.profiles import LEGACY_PROFILE, ProfileId, checked_profile
from ..contracts.styles import Style
from .annotation_markup import glyph_color
from .annotation_scan_spans import scanned_marks
from .annotation_word_ocr import recognize_annotation_words
from .annotation_words import AnnotationWord
from .geometry import area, overlap
from .observations import PageObservation
from .segments import ObservedSpan, Segment


def apply_annotation_spans(
    page: PageObservation,
    segments: list[Segment],
    scratch: Path,
    source: Path | None = None,
    profile_id: ProfileId = LEGACY_PROFILE,
) -> list[Segment]:
    checked_profile(profile_id)
    result = list(segments)
    scanned_words: list[AnnotationWord] | None = None
    for region in page.required_regions:
        if region.kind != "inline_style":
            continue
        if region.style is None:
            raise ValueError("PDF_ANNOTATION_STYLE_REQUIRES_REVIEW")
        mapped = 0
        with Image.open(scratch / page.render_path) as rendered:
            image = rendered.convert("RGB")
            if any(
                segment.method == "ocr" and overlap(segment.box, region.box) for segment in result
            ):
                if scanned_words is None:
                    scanned_words = recognize_annotation_words(page, scratch, source, profile_id)
                for target, mark in scanned_marks(page, result, region, scanned_words, image):
                    segment = result[target.index]
                    update: dict[str, object]
                    if target.cell is None:
                        update = {"spans": merge_annotation_spans(segment.spans, mark)}
                    else:
                        row, column = target.cell
                        cells = [list(cells) for cells in segment.cells]
                        cell = cells[row][column]
                        cells[row][column] = cell.model_copy(
                            update={"spans": merge_annotation_spans(cell.spans, mark)}
                        )
                        update = {"cells": cells}
                    result[target.index] = segment.model_copy(update=update)
                continue
            for line in page.lines:
                if not overlap(line.box, region.box):
                    continue
                cursor = 0
                for glyph in line.glyphs:
                    start = line.text.find(glyph.text, cursor)
                    if start < cursor:
                        raise ValueError("PDF_ANNOTATION_TEXT_MAPPING_REQUIRES_REVIEW")
                    cursor = start + len(glyph.text)
                    fraction = overlap(glyph.box, region.box) / area(glyph.box)
                    if fraction <= 0.05 or (not glyph.text.strip() and fraction < 0.9):
                        continue
                    if fraction < 0.9 or not glyph.visible:
                        raise ValueError("PDF_ANNOTATION_TEXT_MAPPING_REQUIRES_REVIEW")
                    matches = []
                    for index, segment in enumerate(result):
                        if segment.kind in {"figure", "furniture", "unsupported"} or not overlap(
                            segment.box, line.box
                        ):
                            continue
                        at = segment.text.find(line.text)
                        if at >= 0 and segment.text.find(line.text, at + 1) < 0:
                            matches.append((index, at))
                    if len(matches) != 1:
                        raise ValueError("PDF_ANNOTATION_TEXT_MAPPING_REQUIRES_REVIEW")
                    index, at = matches[0]
                    properties = region.style.model_dump(exclude_none=True)
                    if region.style.background_color and glyph.text.strip():
                        properties["color"] = glyph_color(
                            image,
                            glyph.box,
                            page.width_pt,
                            page.height_pt,
                            region.style.background_color,
                        )
                    mark = ObservedSpan(
                        start=at + start, end=at + cursor, style=Style.model_validate(properties)
                    )
                    segment = result[index]
                    result[index] = segment.model_copy(
                        update={"spans": merge_annotation_spans(segment.spans, mark)}
                    )
                    mapped += 1
        if not mapped:
            # Scanned text needs separately qualified word localization, not guessed offsets.
            raise ValueError("PDF_ANNOTATION_TEXT_MAPPING_REQUIRES_REVIEW")
    return result


def merge_annotation_spans(spans: list[ObservedSpan], mark: ObservedSpan) -> list[ObservedSpan]:
    boundaries = sorted({mark.start, mark.end, *(p for s in spans for p in (s.start, s.end))})
    result = []
    for start, end in zip(boundaries, boundaries[1:], strict=False):
        active = [s for s in spans if s.start <= start and s.end >= end]
        selected = mark.start <= start and mark.end >= end
        if not active and not selected:
            continue
        style: dict[str, object] = {"id": "source-inline"}
        destinations = set()
        for span in active:
            if span.style:
                style.update(span.style.model_dump(exclude_none=True, exclude={"id"}))
            if span.url or span.note_label or span.target_text:
                destinations.add((span.url, span.note_label, span.target_text))
        if len(destinations) > 1:
            raise ValueError("PDF_ANNOTATION_TEXT_MAPPING_REQUIRES_REVIEW")
        if selected and mark.style:
            overlay = mark.style.model_dump(exclude_none=True, exclude={"id"})
            for key in ("background_color", "decoration_color"):
                if key in style and key in overlay and style[key] != overlay[key]:
                    # One finite span cannot represent two independent overlapping
                    # backgrounds or differently colored decoration strokes.
                    raise ValueError("PDF_ANNOTATION_TEXT_MAPPING_REQUIRES_REVIEW")
            style.update(overlay)
        url, label, target = next(iter(destinations), (None, None, None))
        result.append(
            ObservedSpan(
                start=start,
                end=end,
                style=Style.model_validate(style) if len(style) > 1 else None,
                url=url,
                note_label=label,
                target_text=target,
            )
        )
    merged: list[ObservedSpan] = []
    for span in result:
        previous = merged[-1] if merged else None
        if (
            previous
            and previous.end == span.start
            and previous.style == span.style
            and (previous.url, previous.note_label, previous.target_text)
            == (span.url, span.note_label, span.target_text)
        ):
            merged[-1] = previous.model_copy(update={"end": span.end})
        else:
            merged.append(span)
    return merged
