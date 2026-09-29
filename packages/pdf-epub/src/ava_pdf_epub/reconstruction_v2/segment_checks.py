"""Reject ambiguous or lossy provider/native intermediate structures before reconstruction."""

from typing import TYPE_CHECKING

from ..contracts.links import ExternalTarget

if TYPE_CHECKING:
    from .segments import ObservedSpan, Segment


def validate_spans(text: str, spans: list["ObservedSpan"]) -> None:
    for span in spans:
        if not 0 <= span.start < span.end <= len(text):
            raise ValueError("Observation span outside exact text")
        if span.url:
            ExternalTarget(kind="external", url=span.url)
        if sum(bool(v) for v in [span.url, span.note_label, span.target_text]) > 1:
            raise ValueError("Observation span has ambiguous link destinations")


def validate_segment(segment: "Segment") -> None:
    validate_spans(segment.text, segment.spans)
    if segment.box.coordinate_space != "page_points_top_left":
        raise ValueError("Observation coordinates must be page points")
    if segment.kind == "table":
        rows = segment.cells
        if not rows or not 1 <= len(rows[0]) <= 8:
            raise ValueError("Table must contain bounded rectangular cells")
        for row in rows:
            if len(row) != len(rows[0]):
                raise ValueError("Irregular table is unsupported")
            for cell in row:
                validate_spans(cell.text, cell.spans)
                a, b = segment.box, cell.box
                if not (a.x0 <= b.x0 < b.x1 <= a.x1 and a.y0 <= b.y0 < b.y1 <= a.y1):
                    raise ValueError("Table cell outside table")
    elif segment.cells:
        raise ValueError("Cells belong only to table segments")
    if segment.kind in {"verse", "code"} and len(segment.text.splitlines()) > 80:
        raise ValueError("Literal block exceeds supported line bound")
    if segment.kind == "note" and not segment.note_label:
        raise ValueError("Note requires its printed label")
    if segment.kind == "list_item" and segment.list_ordered is None:
        raise ValueError("List item requires an observed marker family")
    if segment.kind == "heading" and segment.heading_level is None:
        raise ValueError("Heading requires an observed level")
    if segment.chapter_start and segment.kind != "heading":
        raise ValueError("Chapter start requires a heading")
