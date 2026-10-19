"""Corroborate Info authors only in a bounded, visibly printed opening credit group."""

from typing import Any

from .assembly_state import AssemblyState
from .opening_credit_value import EDITION, opening_credit_parts
from .printed_claim import printed_claim

MAX_OPENING_BLOCKS = 16
MAX_CREDIT_GAP_PT = 35
MAX_CREDIT_RELATIVE_SIZE = 1


def separate_title_label(text: str, title_text: str, source_author: str) -> bool:
    """Recognize a repeated-title edition label, without granting it metadata authority."""
    text, title_text = " ".join(text.split()), " ".join(title_text.split())
    if not title_text or title_text == " ".join(source_author.split()):
        return False
    for separator in (" — ", " – "):
        repeated, found, label = text.partition(separator)
        if found and repeated == title_text:
            match = EDITION.fullmatch(label)
            # A role-bearing phrase may be another credit, not an ordinary title label.
            return match is not None and not {"by", "author", "автор", "автором"}.intersection(
                match["prefix"].casefold().split()
            )
    return False


def opening_author_credits(
    state: AssemblyState, title: dict[str, Any] | None, source_author: str | None
) -> list[dict[str, Any]]:
    found = opening_credit_group(state, title, source_author)
    if found is None:
        return []
    block, values = found
    return [
        {
            # Primary language still requires the independent complete-source language pass.
            **printed_claim(
                field, value, block, "candidate" if field == "language" else "accepted"
            ),
            **({"contributor_role": "author"} if field == "contributor" else {}),
        }
        for field, value in values.items()
    ]


def opening_credit_group(
    state: AssemblyState, title: dict[str, Any] | None, source_author: str | None
) -> tuple[dict[str, Any], dict[str, str]] | None:
    """Share the exact native-author/geometry gate before spending on a metadata comparison."""
    if title is None or not isinstance(source_author, str) or not source_author.strip():
        return None
    previous = state.segments[title["id"]]
    if previous.page != 1 or previous.method != "native":
        return None
    start = state.blocks.index(title) + 1
    chapter_seen = False
    found: tuple[dict[str, Any], dict[str, str]] | None = None
    for block in state.blocks[start : start + MAX_OPENING_BLOCKS]:
        segment = state.segments[block["id"]]
        if segment.page != 1:
            break
        if segment.method != "native" or block["id"] in state.bibliographic_roles:
            return None
        if block["kind"] == "heading":
            if found:
                break
            if (
                chapter_seen
                or segment.heading_level != 1
                or not segment.chapter_start
                or segment.chapter_role != "bodymatter"
            ):
                return None
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
        text = block.get("content", {}).get("text", "")
        value = opening_credit_parts(text, source_author)
        if (
            found is not None
            and 0 < gap < MAX_CREDIT_GAP_PT
            and block["kind"] == "paragraph"
            and separate_title_label(text, title.get("content", {}).get("text", ""), source_author)
        ):
            break
        if not 0 < gap < MAX_CREDIT_GAP_PT or value is None or found is not None:
            return None
        found = (block, value)
        previous = segment
    return found
