"""A finite source prefix includes title pages without trusting typography as metadata."""

import re

from .metadata_scope import NON_TITLE_HEADINGS
from .segments import Segment

FRONTMATTER_PAGES = 16
TITLE_CANDIDATES = 24
_CHAPTER = re.compile(
    r"^(?:\d+[.):]\s|[IVXLCDM]+[.)]\s|(?:chapter|section|part|розділ|частина)\s+(?:\d+|[IVXLCDM]+|one|two|three|four|five|six|seven|eight|nine|ten)\b)",
    re.I,
)


def frontmatter_end(segments: list[Segment]) -> int:
    boundaries = [
        s.page
        for s in segments
        if s.page > 1
        and (
            s.text.strip().casefold() in {"contents", "table of contents", "зміст"}
            or (s.chapter_start and s.chapter_role in {"bodymatter", "backmatter"})
        )
    ]
    return min(FRONTMATTER_PAGES, min(boundaries, default=FRONTMATTER_PAGES + 1) - 1)


def frontmatter_title_candidates(segments: list[Segment]) -> list[tuple[Segment, bool]]:
    end = frontmatter_end(segments)
    eligible = [
        s
        for s in segments
        if s.page <= end
        and s.kind == "heading"
        and s.method in {"native", "ocr"}
        and 0 < len(s.text) <= 200
        and len(s.text.split()) <= 24
        and s.text.strip().casefold() not in NON_TITLE_HEADINGS
        and not _CHAPTER.match(s.text.strip())
    ]
    if len(eligible) > TITLE_CANDIDATES:
        raise ValueError("Frontmatter title catalogue exceeds candidate bound")
    # Source comparison, rather than the number of large headings, determines completeness.
    return [(s, True) for s in eligible]


def frontmatter_bibliographic_ids(
    segments: list[Segment], selected_page: int | None = None, cover: bool = False
) -> set[str]:
    end = frontmatter_end(segments)
    if selected_page is not None:
        end = min(end, selected_page + 2)
    return {
        s.id
        for s in segments
        if s.page <= end
        and (selected_page is None or s.page >= selected_page or (cover and s.page == 1))
        and s.kind in {"heading", "paragraph", "credit"}
    }
