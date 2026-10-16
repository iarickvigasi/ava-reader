"""Consume accepted Native2 boundary hints only with independent native layout evidence."""

from dataclasses import dataclass
from math import isclose
from typing import TYPE_CHECKING

from ..contracts.styles import Style
from .continuation_presentation_contract import POLICY
from .segments import Segment

if TYPE_CHECKING:
    from .assembly_state import AssemblyState


@dataclass(frozen=True)
class NativeContinuation:
    owner_id: str
    page: int
    line_ids: tuple[str, ...]
    incoming: bool
    outgoing: bool
    source_sha256: str
    task_sha256: str
    response_sha256: str
    first_line_flush: bool | None = None
    alignment_origin: str = "unproved"

    def owns(self, segment: Segment) -> bool:
        return (
            self.owner_id == segment.id
            and self.page == segment.page
            and self.line_ids == tuple(segment.native_line_ids)
            and bool(self.line_ids)
        )


def hinted_native_continuation(
    previous: Segment, current: Segment, state: "AssemblyState"
) -> bool | None:
    if (
        state.source_continuation_policy != POLICY
        or previous.method != "native"
        or current.method != "native"
        or not (previous.continues_to_next or current.continues_from_previous)
    ):
        return None  # No opted-in native hint; retain historical inference.
    if any(
        s.method != "native"
        or s.kind != "paragraph"
        or s.structure_candidate
        or s.preserve_line_breaks
        or not s.native_line_ids
        or not s.text
        for s in (previous, current)
    ):
        return False
    a, b = state.placements.get(previous.id), state.placements.get(current.id)
    if a is None or b is None or a[0] != previous.page or b[0] != current.page:
        return False
    if not (b[0] == a[0] + 1 or (a[:2] == b[:2] and a[2] == 1 and b[2] == 2)):
        return False
    left = state.native_continuations.get(previous.id)
    right = state.native_continuations.get(current.id)
    if left is not None and (not left.owns(previous) or not left.outgoing):
        return False  # An explicit negative is different from an unclassified native default.
    if right is not None and (not right.owns(current) or not right.incoming):
        return False
    if not (
        (left is not None and previous.continues_to_next is True)
        or (right is not None and current.continues_from_previous is True)
    ):
        return False
    if left is not None and right is not None and left.source_sha256 != right.source_sha256:
        return False
    if set(previous.native_line_ids).intersection(current.native_line_ids):
        return False
    first, last = previous.style, current.style
    flush = (
        last is not None
        and last.indent_em is not None
        and abs(last.indent_em) <= 0.15
        and (right is None or right.first_line_flush is not False)
    )
    if first is None or last is None or not flush:
        return False  # Unknown indentation is never a physical flush observation.
    if last.align not in {"start", "left", "justify"} or last.block_indent_em not in {None, 0}:
        return False
    if any(getattr(first, key) is None for key in ("family", "bold", "relative_size")):
        return False
    return native_hint_style(first, last) is not None


def native_hint_style(first: Style, last: Style) -> Style | None:
    """Keep source values; tolerate only binary floating noise below 1e-9 em."""
    from .continuation_boundary import JOIN_STYLE

    values: dict[str, object] = {}
    for key in JOIN_STYLE - {"space_after_em"}:
        left, right = getattr(first, key), getattr(last, key)
        if left is not None and right is not None and left != right:
            if not (
                type(left) is float
                and type(right) is float
                and isclose(left, right, rel_tol=0, abs_tol=1e-9)
            ):
                return None
        values[key] = left if left is not None else right
    if values.get("underline") is True or values.get("strike_through") is True:
        return None  # Ancestor text decorations cannot be cancelled by inline resets.
    values["space_after_em"] = last.space_after_em
    return first.model_copy(update=values)
