"""Only whole unmodified physical native subtitle lines can supply composition geometry."""

from typing import Any

from ..contracts.common import text_digest
from .assembly_state import AssemblyState
from .metadata_equivalence import metadata_key
from .segments import Segment


def subtitle_parts(
    claims: list[dict[str, Any]], state: AssemblyState
) -> dict[int, tuple[int, Segment]]:
    output = {}
    for index, block in enumerate(state.blocks):
        ident = block["id"]
        segment = state.segments.get(ident)
        raw = state.bibliographic_roles.get(ident)
        receipt = state.bibliographic_source_ranges.get(ident)
        if (
            segment is None
            or raw is None
            or raw[0] != "subtitle"
            or receipt is None
            or state.bibliographic_claim_owners.get(ident, ident) != ident
            or ident in state.aliases
            or segment.method != "native"
            or len(segment.native_line_ids) != 1
            or "\n" in segment.text
            or segment.style is None
            or segment.style.family is None
            or segment.style.relative_size is None
            or raw[1] != segment.text
            or block.get("content", {}).get("text") != segment.text
            or receipt[:4] != (0, len(segment.text), len(segment.text), text_digest(segment.text))
        ):
            continue
        line = state.native_line_maps.get(segment.native_line_ids[0])
        if (
            line is None
            or line.segment_id != ident
            or line.start != 0
            or line.end != len(segment.text)
            or line.text_sha256 != text_digest(segment.text)
        ):
            continue
        matches = [
            i
            for i, c in enumerate(claims)
            if c["field"] == "subtitle"
            and metadata_key(c) is not None
            and c["value"] == segment.text
            and c.get("evidence") == block["evidence"]
        ]
        if len(matches) == 1:
            output[index] = matches[0], segment
    return output


def adjacent_subtitle(left: Segment, right: Segment) -> bool:
    assert left.style is not None and right.style is not None
    height = min(left.box.y1 - left.box.y0, right.box.y1 - right.box.y0)
    return (
        left.page == right.page
        and abs(left.box.x0 - right.box.x0) <= 1
        and 0 < right.box.y0 - left.box.y1 <= height
        and left.style.model_dump(exclude={"id"}) == right.style.model_dump(exclude={"id"})
    )
