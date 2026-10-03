"""Rank native section headings against source chapter typography, not page-local body medians."""

from collections.abc import Sequence
from statistics import median

from .font_style import glyph_size
from .prepared import PreparedPage
from .segments import Segment


def heading_hierarchy(
    segments: list[Segment], prepared: Sequence[PreparedPage], corroborated_sections: set[str]
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
    sizes = {
        segment.id: median(lines[key] for key in segment.native_line_ids)
        for segment in segments
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
    first_on_page: dict[int, str] = {}
    for item in segments:
        first_on_page.setdefault(item.page, item.id)
    result = []
    for index, segment in enumerate(segments):
        if segment.chapter_start:
            ranks.clear()
        if (
            index >= first_chapter
            and segment.kind == "heading"
            and not segment.chapter_start
            and segment.id not in sizes
        ):
            section_level(None, ranks, segment.heading_level)
        if index >= first_chapter and segment.id in sizes and not segment.chapter_start:
            if (
                segment.page > segments[first_chapter].page
                and first_on_page[segment.page] == segment.id
                and sizes[segment.id] >= min(chapter_sizes) * 0.95
                and segment.id not in corroborated_sections
            ):
                raise ValueError("Chapter-sized opening needs whole-book source corroboration")
            declared = segment.heading_level if segment.id in corroborated_sections else None
            level = section_level(sizes[segment.id], ranks, declared)
            segment = segment.model_copy(update={"heading_level": level})
        result.append(segment)
    return result


def section_level(
    size: float | None, ancestors: list[float | None], declared: int | None = None
) -> int:
    """Infer only observed chapter-local ancestry; later large siblings cannot skip an H2."""
    if declared is not None:
        if declared < 2 or declared > len(ancestors) + 2:
            raise ValueError("Declared heading skips an unobserved parent")
        del ancestors[declared - 2 :]
    else:
        if size is None:
            raise ValueError("A heading without source size requires a declared level")
        while ancestors:
            previous = ancestors[-1]
            if previous is None:
                raise ValueError("Mixed heading hierarchy requires source corroboration")
            if size < previous - 0.5:
                break
            ancestors.pop()
    level = len(ancestors) + 2
    if level > 6:
        raise ValueError("Native heading hierarchy exceeds the supported depth")
    ancestors.append(size)
    return level
