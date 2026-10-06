"""Corroborate Info authors only in a bounded, visibly printed opening credit group."""

from typing import Any

from .assembly_state import AssemblyState
from .opening_credit_value import opening_credit_value
from .printed_claim import printed_claim

MAX_OPENING_BLOCKS = 16
MAX_CREDIT_GAP_PT = 35
MAX_CREDIT_RELATIVE_SIZE = 1


def opening_author_credits(
    state: AssemblyState, title: dict[str, Any] | None, source_author: str | None
) -> list[dict[str, Any]]:
    if title is None or not source_author or not source_author.strip():
        return []
    previous = state.segments[title["id"]]
    if previous.page != 1 or previous.method != "native":
        return []
    start = state.blocks.index(title) + 1
    chapter_seen = False
    found: tuple[dict[str, Any], str] | None = None
    for block in state.blocks[start : start + MAX_OPENING_BLOCKS]:
        segment = state.segments[block["id"]]
        if segment.page != 1:
            break
        if segment.method != "native" or block["id"] in state.bibliographic_roles:
            return []
        if block["kind"] == "heading":
            if found:
                break
            if (
                chapter_seen
                or segment.heading_level != 1
                or not segment.chapter_start
                or segment.chapter_role != "bodymatter"
            ):
                return []
            chapter_seen = True
            previous = segment
            continue
        style = segment.style
        if (
            block["kind"] not in {"paragraph", "credit"}
            or style is None
            or style.align != "center"
            or style.relative_size is None
            or style.relative_size > MAX_CREDIT_RELATIVE_SIZE
        ):
            break
        gap = segment.box.y0 - previous.box.y1
        value = opening_credit_value(block.get("content", {}).get("text", ""), source_author)
        if not 0 < gap < MAX_CREDIT_GAP_PT or value is None or found is not None:
            return []
        found = (block, value)
        previous = segment
    if found is None:
        return []
    block, value = found
    return [{**printed_claim("contributor", value, block), "contributor_role": "author"}]
