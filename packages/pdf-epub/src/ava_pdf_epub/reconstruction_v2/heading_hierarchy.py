"""Rank native section headings against source chapter typography, not page-local body medians."""

from collections.abc import Mapping, Sequence
from statistics import median

from .font_style import glyph_size
from .heading_ancestry import MixedHeadingReviewRequired
from .heading_ancestry import section_level as section_level
from .prepared_types import AnyPreparedPage
from .segments import Segment


def heading_hierarchy(
    segments: list[Segment],
    prepared: Sequence[AnyPreparedPage],
    corroborated_sections: set[str],
    deferred_native: set[str] | None = None,
    compound_sources: Mapping[str, tuple[Segment, ...]] | None = None,
) -> list[Segment]:
    wanted = {
        key for segment in segments if segment.kind == "heading" for key in segment.native_line_ids
    }
    lines = {
        line.id: glyph_size(line.glyphs)
        for page in prepared
        for line in page.observation.lines
        if line.id in wanted
    }
    size_sources = [
        s.model_copy(update={"native_line_ids": compound_sources[s.id][0].native_line_ids})
        if compound_sources and s.id in compound_sources
        else s
        for s in segments
    ]
    sizes = {
        segment.id: median(lines[key] for key in segment.native_line_ids)
        for segment in size_sources
        if segment.kind == "heading"
        and segment.method == "native"
        and segment.native_line_ids
        and all(key in lines for key in segment.native_line_ids)
    }
    chapter_sizes = [sizes[s.id] for s in segments if s.chapter_start and s.id in sizes]
    if not chapter_sizes:
        return segments
    first_chapter = min(i for i, s in enumerate(segments) if s.chapter_start)
    ranks: list[float | None] = []
    opaque_ocr = False
    first_on_page = {item.page: item.id for item in reversed(segments)}
    result = []
    for index, segment in enumerate(segments):
        if segment.chapter_start:
            ranks.clear()
            opaque_ocr = False
        if (
            index >= first_chapter
            and segment.kind == "heading"
            and not segment.chapter_start
            and segment.id not in sizes
        ):
            try:
                section_level(None, ranks, segment.heading_level)
            except ValueError:
                if (
                    deferred_native is None
                    or segment.method != "ocr"
                    or segment.id in corroborated_sections
                    or segment.heading_level is None
                ):
                    raise
                # Pending OCR cannot create a missing parent or reset ancestry.
                opaque_ocr = True
            else:
                if segment.id in corroborated_sections and segment.heading_level == 2:
                    opaque_ocr = False
        if index >= first_chapter and segment.id in sizes and not segment.chapter_start:
            if (
                segment.page > segments[first_chapter].page
                and first_on_page[segment.page] == segment.id
                and sizes[segment.id] >= min(chapter_sizes) * 0.95
                and segment.id not in corroborated_sections
            ):
                raise ValueError("Chapter-sized opening needs whole-book source corroboration")
            declared = segment.heading_level if segment.id in corroborated_sections else None
            try:
                if opaque_ocr and declared is None:
                    raise MixedHeadingReviewRequired("Unranked OCR ancestry requires review")
                level = section_level(sizes[segment.id], ranks, declared)
                if declared == 2:
                    opaque_ocr = False
            except MixedHeadingReviewRequired:
                if deferred_native is None:
                    raise
                # Source review must resolve unknown ancestry before any rank is accepted.
                deferred_native.add(segment.id)
                segment = segment.model_copy(update={"structure_candidate": True})
            else:
                segment = segment.model_copy(update={"heading_level": level})
        result.append(segment)
    return result
