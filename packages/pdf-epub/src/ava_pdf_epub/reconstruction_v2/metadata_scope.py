"""Bibliographic authority is contextual; a word appearing in body prose is not metadata."""

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
}


def metadata_scope(state: AssemblyState) -> tuple[dict[str, Any] | None, set[str]]:
    blocks = state.blocks
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
        if (
            first["kind"] == "heading"
            and segment.heading_level == 1
            and segment.text.strip().casefold() not in NON_TITLE_HEADINGS
            and not segment.chapter_start
            and segment.page == 1
            and segment.style
            and segment.style.align == "center"
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
        if (front or bibliographic) and block["kind"] in {"heading", "paragraph"}:
            eligible.add(block["id"])
    return title, eligible
