"""Bibliographic authority is contextual; a word appearing in body prose is not metadata."""

import re
from typing import Any

from .assembly_state import AssemblyState

BIBLIOGRAPHIC_HEADINGS = {"copyright", "publication details", "colophon"}
NON_TITLE_HEADINGS = BIBLIOGRAPHIC_HEADINGS | {
    "contents",
    "table of contents",
    "preface",
    "foreword",
    "introduction",
    "prologue",
    "acknowledgments",
    "acknowledgements",
    "dedication",
    "передмова",
    "вступ",
    "зміст",
    "подяки",
    "присвята",
    "пролог",
    "післямова",
}


def metadata_scope(state: AssemblyState) -> tuple[dict[str, Any] | None, set[str]]:
    blocks = state.blocks
    if state.source_title_policy == "ava-frontmatter-title-1":
        from .printed_title_v2_candidates import frontmatter_bibliographic_ids

        selected = state.frontmatter_title
        title = next((b for b in blocks if selected and b["id"] == selected[0]), None)
        if selected and title is None:
            raise ValueError("Selected frontmatter title owner is absent")
        if title is None:
            return None, set()
        front_eligible = frontmatter_bibliographic_ids(
            list(state.segments.values()),
            state.segments[title["id"]].page,
            cover=bool(state.frontmatter_cover),
        )
        return title, front_eligible
    first_body = next(
        (
            i
            for i, b in enumerate(blocks)
            if state.segments[b["id"]].chapter_start
            and state.segments[b["id"]].chapter_role != "frontmatter"
        ),
        len(blocks),
    )
    title = None
    if blocks and first_body > 0:
        first = blocks[0]
        segment = state.segments[first["id"]]
        prominent_cover = bool(
            segment.chapter_start
            and segment.chapter_role == "frontmatter"
            and segment.style
            and segment.style.relative_size is not None
            and segment.style.relative_size >= 1.5
            and segment.style.align in {"left", "center", "right"}
            and not re.match(r"^\d+[.):]\s", segment.text.strip())
        )
        if (
            first["kind"] == "heading"
            and segment.heading_level == 1
            and segment.text.strip().casefold() not in NON_TITLE_HEADINGS
            and segment.page == 1
            and segment.style
            and ((not segment.chapter_start and segment.style.align == "center") or prominent_cover)
            and first_body < len(blocks)
        ):
            title = first
    eligible: set[str] = set()
    bibliographic = False
    for i, block in enumerate(blocks):
        segment = state.segments[block["id"]]
        if segment.kind == "heading":
            bibliographic = segment.text.strip().casefold() in BIBLIOGRAPHIC_HEADINGS and (
                i < first_body or segment.chapter_role == "backmatter"
            )
        front = i < first_body and (title is not None or segment.chapter_role == "frontmatter")
        if (front or bibliographic) and block["kind"] in {"heading", "paragraph", "credit"}:
            eligible.add(block["id"])
    return title, eligible
