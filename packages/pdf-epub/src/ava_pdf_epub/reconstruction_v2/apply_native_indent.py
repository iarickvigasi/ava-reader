"""First-line and whole-block coordinates must compose with existing source authority."""

from .assembly_state import AssemblyState
from .findings import Finding
from .native_indent import qualified_native_indent
from .observations import NativeLine
from .segments import Segment


def indent_unknown(state: AssemblyState, segment: Segment, code: str, message: str) -> None:
    state.structure_findings.append(
        Finding(
            code=code,
            severity="information",
            message=message,
            page=segment.page,
            box=segment.box,
            block_id=segment.id,
        )
    )


def apply_native_indent(
    segment: Segment,
    rows: list[NativeLine],
    size: float,
    literal: bool,
    reference: tuple[float, float | None],
    state: AssemblyState,
) -> Segment:
    style = segment.style
    assert style is not None
    first, block = qualified_native_indent(rows, size, literal, reference)
    if (
        literal
        and style.indent_em is not None
        and abs(style.indent_em) > 1e-6
        or not literal
        and first is not None
        and (
            (style.indent_em is not None and abs(style.indent_em - first) > 1e-6)
            or (
                style.block_indent_em is not None
                and abs(style.block_indent_em - (block or 0)) > 1e-6
            )
        )
    ):
        indent_unknown(
            state,
            segment,
            "NATIVE_INDENT_KNOWN_STYLE_CONFLICT",
            (
                "Known first-line/block coordinates conflict with local source context; "
                "style is preserved."
            ),
        )
        return segment
    updates = {}
    if style.indent_em is None and first is not None:
        updates["indent_em"] = first
    if style.block_indent_em is None and block is not None:
        updates["block_indent_em"] = block
    return segment.model_copy(update={"style": style.model_copy(update=updates)})
