"""Only adjacent prose at a real column/page boundary can receive a join decision."""

import hashlib
import re

from .assembly_state import AssemblyState
from .continuation_boundary import inferred_continuation
from .refinement_contract import RefinementEdge
from .segments import Segment


def refinement_edges(segments: list[Segment], state: AssemblyState) -> list[RefinementEdge]:
    edges = []
    for previous, current in zip(segments, segments[1:], strict=False):
        a, b = state.placements[previous.id], state.placements[current.id]
        boundary = (a[:2] == b[:2] and a[2:] == (1,) and b[2:] == (2,)) or b[0] == a[0] + 1
        if (
            boundary
            and previous.kind == current.kind == "paragraph"
            and (previous.method == "ocr" or current.method == "ocr")
            and ambiguous_boundary(previous, current, state)
        ):
            ident = (
                "edge-" + hashlib.sha256((previous.id + ":" + current.id).encode()).hexdigest()[:24]
            )
            edges.append(RefinementEdge(id=ident, previous_id=previous.id, next_id=current.id))
    return edges


def ambiguous_boundary(previous: Segment, current: Segment, state: AssemblyState) -> bool:
    if previous.continues_to_next and current.continues_from_previous:
        return False
    if previous.continues_to_next != current.continues_from_previous:
        return True
    if inferred_continuation(previous, current, state):
        return False  # Already source-qualified; no model tokens needed.
    if current.style and (
        current.style.indent_em not in {None, 0}
        or current.style.block_indent_em not in {None, 0}
        or current.style.align not in {None, "start", "left", "justify"}
    ):
        return False
    return not re.search(r"[.!?:;][\"'’”)]*$", previous.text.rstrip()) and bool(
        current.text[:1].islower()
    )
