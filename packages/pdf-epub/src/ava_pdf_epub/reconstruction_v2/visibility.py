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
    allow_filled_stroke: bool = False,
    allow_raster_settings: bool = False,
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
        allow_filled_stroke,
        allow_raster_settings,
        False,
        0,
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
    allow_filled_stroke: bool,
    allow_raster_settings: bool,
    clip_unsafe: bool,
    mode: int,
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
    stack: list[tuple[AxisMatrix | None, bool, int]] = []
    path_rectangles = 0
    path_encloses = False
    path_other = False
    for values, operator in content.operations:
        if operator == b"q":
            stack.append((matrix, clip_unsafe, mode))
        elif operator == b"Q":
            if not stack:
                risks.add("complex_graphics_state")
                matrix = None
            else:
                matrix, clip_unsafe, mode = stack.pop()
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

        if operator == b"Tr":
            mode = int(values[0]) if len(values) == 1 else -1
        if operator in {b"Tj", b"TJ", b"'", b'"'}:
            if clip_unsafe:
                risks.add("conditional_visibility")
            if mode != 0 and not (mode == 2 and allow_filled_stroke):
                risks.add("nonstandard_text_rendering")
            if mode >= 4:
                clip_unsafe = True
        if operator in {b"W", b"W*"}:
            clip_unsafe = clip_unsafe or path_rectangles != 1 or path_other or not path_encloses
        if operator == b"gs" and (
            len(values) != 1
            or not inert_graphics_state(
                resources, values[0], allow_raster_settings=allow_raster_settings
            )
        ):
            risks.add("conditional_visibility")
        if operator in {b"n", b"S", b"s", b"f", b"F", b"f*", b"B", b"B*", b"b", b"b*"}:
            path_rectangles, path_encloses, path_other = 0, False, False
        if operator == b"BDC" and values and str(values[0]) == "/OC":
            risks.add("optional_content")
        if operator == b"Do":
            obj = resources.get("/XObject", {}).get(values[0]) if len(values) == 1 else None
            if obj is None:
                risks.add("complex_graphics_state")
            else:
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
                        False,  # The glyph parser does not prove inherited Form paint state.
                        allow_raster_settings,
                        clip_unsafe,
                        mode,
                    )

                elif obj.get("/Subtype") != "/Image":
                    risks.add("complex_graphics_state")
