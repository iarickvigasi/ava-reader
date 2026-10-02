"""Native text is untrusted when display operations can conceal or replace its glyphs."""

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


def display_risks(
    page: Any,
    reader: PdfReader,
    *,
    glyph_bounds: tuple[float, float, float, float] | None = None,
    allow_transformed_rectangles: bool = False,
) -> list[str]:
    contents = page.get_contents()
    if contents is None:
        return []
    risks: set[str] = set()
    _inspect(
        contents,
        page.get("/Resources", {}),
        reader,
        risks,
        set(),
        0,
        glyph_bounds,
        allow_transformed_rectangles,
    )
    return sorted(risks)


def _inspect(
    stream: Any,
    resources: Any,
    reader: PdfReader,
    risks: set[str],
    seen: set[int],
    depth: int,
    glyph_bounds: tuple[float, float, float, float] | None,
    allow_transformed_rectangles: bool,
) -> None:
    stream = stream.get_object() if hasattr(stream, "get_object") else stream
    resources = resources.get_object() if hasattr(resources, "get_object") else resources
    if depth > 12 or id(stream) in seen:
        risks.add("complex_graphics_state")
        return
    seen = seen | {id(stream)}
    content = ContentStream(stream, reader)
    if len(content.operations) > 1000000:
        raise ValueError("PDF content operation limit exceeded")
    matrix: AxisMatrix | None = (1, 1, 0, 0)
    stack: list[AxisMatrix | None] = []
    path_rectangles = 0
    path_encloses = False
    path_other = False
    for values, operator in content.operations:
        if operator == b"q":
            stack.append(matrix)
        elif operator == b"Q":
            if not stack:
                risks.add("complex_graphics_state")
                matrix = None
            else:
                matrix = stack.pop()
        elif operator == b"cm":
            matrix = axis_matrix(values, matrix)
        elif operator == b"re":
            path_rectangles += 1
            path_encloses = (
                enclosing_rectangle(transformed_rectangle(values, matrix), glyph_bounds)
                if allow_transformed_rectangles
                else matrix == (1, 1, 0, 0) and enclosing_rectangle(values, glyph_bounds)
            )
        elif operator in {b"m", b"l", b"c", b"v", b"y", b"h"}:
            path_other = True

        if operator == b"Tr" and values and int(values[0]) != 0:
            risks.add("nonstandard_text_rendering")
        if operator in {b"W", b"W*"}:
            if path_rectangles != 1 or path_other or not path_encloses:
                risks.add("conditional_visibility")
        if operator == b"gs" and (
            len(values) != 1 or not inert_graphics_state(resources, values[0])
        ):
            risks.add("conditional_visibility")
        if operator in {b"n", b"S", b"s", b"f", b"F", b"f*", b"B", b"B*", b"b", b"b*"}:
            path_rectangles, path_encloses, path_other = 0, False, False
        if operator == b"BDC" and values and str(values[0]) == "/OC":
            risks.add("optional_content")
        if operator == b"Do" and values:
            obj = resources.get("/XObject", {}).get(values[0])
            if obj is not None:
                obj = obj.get_object()
                if obj.get("/Subtype") == "/Form":
                    _inspect(
                        obj,
                        obj.get("/Resources", resources),
                        reader,
                        risks,
                        seen,
                        depth + 1,
                        None,
                        allow_transformed_rectangles,
                    )
