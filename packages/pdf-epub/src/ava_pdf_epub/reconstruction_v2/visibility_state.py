"""Only provably inert state and enclosing single rectangles preserve native trust."""

import math
from typing import Any


def inert_graphics_state(resources: Any, name: Any) -> bool:
    states = resources.get("/ExtGState", {})
    states = states.get_object() if hasattr(states, "get_object") else states
    state = states.get(name)
    state = state.get_object() if hasattr(state, "get_object") else state
    if not isinstance(state, dict) or set(state) - {"/Type", "/BM", "/ca", "/CA"}:
        return False
    if state.get("/Type", "/ExtGState") != "/ExtGState" or state.get("/BM", "/Normal") != "/Normal":
        return False
    try:
        return all(float(state.get(key, 1)) == 1 for key in ("/ca", "/CA"))
    except (ValueError, TypeError, OverflowError):
        return False


def enclosing_rectangle(
    operands: list[Any], bounds: tuple[float, float, float, float] | None
) -> bool:
    if len(operands) != 4 or bounds is None:
        return False
    try:
        x, y, width, height = [float(v) for v in operands]
    except (ValueError, TypeError, OverflowError):
        return False
    if not all(math.isfinite(v) for v in (x, y, width, height)) or not width or not height:
        return False
    left, right = sorted((x, x + width))
    bottom, top = sorted((y, y + height))
    return left <= bounds[0] < bounds[2] <= right and bottom <= bounds[1] < bounds[3] <= top


AxisMatrix = tuple[float, float, float, float]


def axis_matrix(values: list[Any], previous: AxisMatrix | None) -> AxisMatrix | None:
    """Only diagonal finite CTMs: scale, translation and axis reflection, no skew/rotation."""
    if previous is None or len(values) != 6:
        return None
    try:
        a, b, c, d, e, f = [float(v) for v in values]
    except (ValueError, TypeError, OverflowError):
        return None
    if not all(math.isfinite(v) for v in (a, b, c, d, e, f)) or b or c or not a or not d:
        return None
    sx, sy, tx, ty = previous
    result = (sx * a, sy * d, sx * e + tx, sy * f + ty)
    return result if all(math.isfinite(v) for v in result) else None


def transformed_rectangle(values: list[Any], matrix: AxisMatrix | None) -> list[float]:
    if matrix is None or len(values) != 4:
        return []
    try:
        x, y, width, height = [float(v) for v in values]
    except (ValueError, TypeError, OverflowError):
        return []
    sx, sy, tx, ty = matrix
    return [sx * x + tx, sy * y + ty, sx * width, sy * height]
