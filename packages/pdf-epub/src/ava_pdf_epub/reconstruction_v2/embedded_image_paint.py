"""Prove only top-level positive-axis opaque image paint with complete rectangular clipping."""

from collections import Counter
from typing import Any

from pypdf import PdfReader
from pypdf.generic import ContentStream

from .visibility_state import (
    AxisMatrix,
    axis_matrix,
    enclosing_rectangle,
    inert_graphics_state,
    transformed_rectangle,
)


def image_paint_boxes(page: Any, reader: PdfReader) -> dict[str, tuple[float, float, float, float]]:
    crop = page.cropbox
    if (
        page.rotation % 360
        or float(crop.left) != 0
        or float(crop.bottom) != 0
        or list(crop) != list(page.mediabox)
    ):
        return {}
    content = page.get_contents()
    if content is None:
        return {}
    operations = ContentStream(content, reader).operations
    if len(operations) > 1000000:
        raise ValueError("PDF content operation limit exceeded")
    resources = page.get("/Resources", {})
    matrix: AxisMatrix | None = (1, 1, 0, 0)
    clips: tuple[tuple[float, ...], ...] | None = ()
    opaque = True
    stack: list[tuple[AxisMatrix | None, tuple[tuple[float, ...], ...] | None, bool]] = []
    rectangles: list[list[float]] = []
    other = False
    counts: Counter[str] = Counter()
    boxes = {}
    for values, op in operations:
        if op == b"q":
            stack.append((matrix, clips, opaque))
        elif op == b"Q":
            if not stack:
                return {}
            matrix, clips, opaque = stack.pop()
        elif op == b"cm":
            matrix = axis_matrix(values, matrix)
        elif op == b"re":
            rectangles.append(transformed_rectangle(values, matrix))
        elif op in {b"m", b"l", b"c", b"v", b"y", b"h"}:
            other = True
        elif op in {b"W", b"W*"}:
            clips = (
                (*clips, tuple(rectangles[0]))
                if clips is not None
                and len(rectangles) == 1
                and len(rectangles[0]) == 4
                and not other
                else None
            )
        elif op == b"gs":
            opaque = opaque and len(values) == 1 and inert_graphics_state(resources, values[0])
        elif op == b"BDC" and values and str(values[0]) == "/OC":
            opaque = False
        elif op == b"Do" and len(values) == 1:
            name = str(values[0])
            counts[name] += 1
            if matrix is None or clips is None or not opaque:
                continue
            sx, sy, x, y = matrix
            if sx <= 0 or sy <= 0:
                continue
            bounds = (x, y, x + sx, y + sy)
            if not (0 <= x < x + sx <= float(crop.width) and 0 <= y < y + sy <= float(crop.height)):
                continue
            if all(enclosing_rectangle(list(c), bounds) for c in clips):
                boxes[name] = bounds
        if op in {b"n", b"S", b"s", b"f", b"F", b"f*", b"B", b"B*", b"b", b"b*"}:
            rectangles, other = [], False
    if stack:
        return {}
    return {name: box for name, box in boxes.items() if counts[name] == 1}
