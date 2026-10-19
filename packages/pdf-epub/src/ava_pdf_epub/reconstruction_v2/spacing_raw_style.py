"""Compare explicit raw font/state with the original Type1 state, without a decimal tolerance."""

import ctypes
import math
import re
from typing import Any

from .observations import Glyph
from .spacing_metric import SpacingMetric


def _base_font(value: str) -> str:
    return value[7:] if re.fullmatch(r"[A-Z]{6}\+.+", value) else value


def raw_style_matches(text: Any, raw: Any, index: int, glyph: Glyph, metric: SpacingMetric) -> bool:
    if len(metric.state) != 4 or metric.resource <= 0 or metric.source_origin is None:
        return False
    size, scaling, a, d = metric.state
    if not all(math.isfinite(v) for v in metric.state) or scaling != 100 or min(size, a, d) <= 0:
        return False
    try:
        if raw.FPDFText_GetFontSize(text, index) != size:
            return False
        matrix = raw.FS_MATRIX()
        if raw.FPDFText_GetMatrix(text, index, ctypes.byref(matrix)) != 1:
            return False
        values = tuple(getattr(matrix, key) for key in ("a", "b", "c", "d", "e", "f"))
        if not all(math.isfinite(v) for v in values) or matrix.b != 0 or matrix.c != 0:
            return False
        # FS_MATRIX exposes binary32 values. Exact source-to-API representation
        # equality is an encoding check, not proximity between decimal values.
        if matrix.a != ctypes.c_float(a).value or matrix.d != ctypes.c_float(d).value:
            return False
        flags = ctypes.c_int()
        length = raw.FPDFText_GetFontInfo(text, index, None, 0, ctypes.byref(flags))
        if type(length) is not int or not 0 < length <= 512:
            return False
        buffer = ctypes.create_string_buffer(length)
        if raw.FPDFText_GetFontInfo(text, index, buffer, length, ctypes.byref(flags)) != length:
            return False
        data = buffer.raw
        if data[-1] != 0 or 0 in data[:-1]:
            return False
        font = data[:-1].decode("utf-8", errors="strict")
        return bool(font) and _base_font(font) == _base_font(glyph.font)
    except (AttributeError, TypeError, ValueError, OverflowError):
        return False
