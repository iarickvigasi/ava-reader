"""Selectable source targets, including independently bounded table cells."""

from dataclasses import dataclass

from ..contracts.source import Box
from .segments import Segment


@dataclass(frozen=True)
class AnnotationTarget:
    index: int
    cell: tuple[int, int] | None
    text: str
    box: Box


def scanned_targets(segments: list[Segment]) -> list[AnnotationTarget]:
    result = []
    for index, segment in enumerate(segments):
        if segment.method != "ocr" or segment.kind in {"figure", "furniture", "unsupported"}:
            continue
        if segment.kind == "table":
            for row, cells in enumerate(segment.cells):
                for column, cell in enumerate(cells):
                    result.append(AnnotationTarget(index, (row, column), cell.text, cell.box))
        else:
            result.append(AnnotationTarget(index, None, segment.text, segment.box))
    return result
