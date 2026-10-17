"""Independently measured native multiline prose supplies local indentation references."""

from dataclasses import dataclass

from .native_indent import paragraph_margin
from .native_indent_rows import indent_rows, native_typeface, proven_indent_rows
from .observations import PageObservation
from .reading_order import reading_order
from .segments import Segment

GEOMETRY_TOLERANCE_PT = 0.25


@dataclass(frozen=True)
class IndentPeer:
    id: str
    page: int
    column: int
    band: int
    size: float
    typeface: str
    first: float
    body: float


def indent_peers(page: PageObservation, segments: list[Segment]) -> list[IndentPeer]:
    proof = indent_rows(page, segments)
    output = []
    for placement in reading_order(segments, page.width_pt):
        segment = placement.segment
        style = segment.style
        if (
            segment.method != "native"
            or segment.kind != "paragraph"
            or segment.preserve_line_breaks
            or segment.structure_candidate
            or style is None
            or style.italic is not False
            or style.bold is not False
            or style.align not in {"start", "left"}
            or (style.block_indent_em is not None and style.block_indent_em > 0)
        ):
            continue
        rows = proven_indent_rows(segment, proof)
        if rows is None:
            continue
        signature = native_typeface(rows)
        if len(rows) < 2 or signature is None:
            continue
        typeface, size = signature
        body = paragraph_margin(rows, size)
        if body is None or any(abs(row.box.x0 - body) > GEOMETRY_TOLERANCE_PT for row in rows[1:]):
            continue
        first = rows[0].box.x0
        if not -3 <= (first - body) / size <= 6:
            continue
        output.append(
            IndentPeer(
                segment.id,
                page.number,
                placement.column,
                placement.band,
                size,
                typeface,
                first,
                body,
            )
        )
    return output
