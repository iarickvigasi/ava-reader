"""Conservative inferred joins require observed layout and paragraph compatibility."""

import re

from .assembly_state import AssemblyState
from .segments import Segment

JOIN_STYLE = {
    "family",
    "bold",
    "italic",
    "small_caps",
    "relative_size",
    "vertical_align",
    "align",
    "line_height",
    "space_after_em",
}


def inferred_continuation(previous: Segment, current: Segment, state: AssemblyState) -> bool:
    if re.search(r"[.!?:;][\"'’”)]*$", previous.text.rstrip()) or not re.match(
        r"[a-z]", current.text
    ):
        return False
    if previous.method == current.method == "native":
        return previous.page != current.page or (
            current.box.y0 < previous.box.y0 and current.box.x0 > previous.box.x0
        )
    if previous.kind != "paragraph" or current.kind != "paragraph":
        return False
    a, b = state.placements.get(previous.id), state.placements.get(current.id)
    column = a is not None and b is not None and a[:2] == b[:2] and a[2] == 1 and b[2] == 2
    if not column:
        return False
    if not previous.style or not current.style:
        return False
    if previous.style.model_dump(include=JOIN_STYLE) != current.style.model_dump(
        include=JOIN_STYLE
    ):
        return False
    if current.style.align not in {None, "left", "start", "justify"}:
        return False
    if current.style.indent_em not in {None, 0}:
        return False
    return current.method == "native" or state.flush_starts.get(current.id) is True
