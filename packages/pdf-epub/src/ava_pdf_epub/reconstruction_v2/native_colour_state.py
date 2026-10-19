"""A finite source paint state; unknown/mixed/indirect content never earns new ink."""

import math
from dataclasses import dataclass
from typing import Any

from pypdf.generic import ContentStream

from .native_colour_value import ExpectedColour, NativeColourUnavailable, resolve_source_colour
from .visibility_state import inert_graphics_state


@dataclass(frozen=True)
class SourceColourState:
    expected: ExpectedColour
    operands: tuple[float, ...]
    shows: int


def operands(values: Any) -> tuple[float, ...]:
    if not isinstance(values, (list, tuple)) or not 1 <= len(values) <= 4:
        raise ValueError("Native colour operands unavailable")
    if any(
        isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v)
        for v in values
    ):
        raise ValueError("Native colour operands unavailable")
    return tuple(float(v) for v in values)


def source_colour_state(page: Any, reader: Any) -> SourceColourState | None:
    """Inspect every original text-show state; no resource-name/profile-name shortcut."""
    resources = page.get("/Resources", {})
    resources = resources.get_object() if hasattr(resources, "get_object") else resources
    contents = page.get_contents()
    if contents is None or reader.trailer["/Root"].get("/OutputIntents"):
        return None
    operations = ContentStream(contents, reader).operations
    if len(operations) > 1000000:
        return None
    # Definition, raw operands, intent and text rendering mode follow q/Q.
    state: tuple[Any, tuple[float, ...], str, int] = (
        "/DeviceGray",
        (0.0,),
        "/RelativeColorimetric",
        0,
    )
    stack: list[tuple[Any, tuple[float, ...], str, int]] = []
    selected: SourceColourState | None = None
    shows = 0
    try:
        for values, operator in operations:
            definition, raw, intent, mode = state
            if operator == b"q":
                if len(stack) >= 100:
                    return None
                stack.append(state)
            elif operator == b"Q":
                if not stack:
                    return None
                state = stack.pop()
            elif operator in {b"Do", b"W", b"W*", b"BI", b"INLINE IMAGE"}:
                return None  # Forms/images/clips require a different paint envelope.
            elif operator == b"cs":
                if len(values) != 1:
                    return None
                spaces = resources.get("/ColorSpace", {})
                spaces = spaces.get_object() if hasattr(spaces, "get_object") else spaces
                definition = spaces.get(values[0], values[0])
                state = (definition, (), intent, mode)
            elif operator in {b"sc", b"scn"}:
                state = (definition, operands(values), intent, mode)
            elif operator in {b"g", b"rg", b"k"}:
                state = (
                    {b"g": "/DeviceGray", b"rg": "/DeviceRGB", b"k": "/DeviceCMYK"}[operator],
                    operands(values),
                    intent,
                    mode,
                )
            elif operator == b"ri":
                if len(values) != 1 or str(values[0]) != "/RelativeColorimetric":
                    return None
                state = (definition, raw, str(values[0]), mode)
            elif operator == b"Tr":
                if len(values) != 1 or type(values[0]) is bool or not isinstance(values[0], int):
                    return None
                state = (definition, raw, intent, int(values[0]))
            elif operator == b"gs":
                if len(values) != 1 or not inert_graphics_state(
                    resources, values[0], allow_raster_settings=True
                ):
                    return None
            elif operator in {b"Tj", b"TJ", b"'", b'"'}:
                if mode != 0:
                    return None
                expected = resolve_source_colour(definition, raw, intent)
                current = SourceColourState(expected, raw, 0)
                if selected is not None and selected != current:
                    return None
                selected = current
                shows += 1
        if stack or selected is None or not shows:
            return None
        return SourceColourState(selected.expected, selected.operands, shows)
    except (KeyError, TypeError, ValueError, OverflowError, NativeColourUnavailable):
        return None
