"""A finite uncolored outline subset, not arbitrary Type 3 paint, can corroborate font roles."""

import math
from typing import Any

from pypdf import PdfReader
from pypdf.generic import ContentStream

from .font_traits import font_traits

COUNTS = {b"m": 2, b"l": 2, b"c": 6, b"v": 4, b"y": 4, b"h": 0, b"f": 0, b"f*": 0}


def numbers(values: Any, count: int) -> list[float] | None:
    if not isinstance(values, (list, tuple)) or len(values) != count:
        return None
    try:
        result = [float(v) for v in values]
    except (ValueError, TypeError, OverflowError):
        return None
    return result if all(math.isfinite(v) and abs(v) <= 1000000 for v in result) else None


def outline_type3_safe(font: Any, reader: PdfReader) -> bool:
    descriptor = font.get("/FontDescriptor")
    descriptor = descriptor.get_object() if descriptor is not None else {}
    if not isinstance(descriptor, dict):
        return False
    name = str(descriptor.get("/FontName", "")).removeprefix("/")
    traits = font_traits(name)
    try:
        flags = int(descriptor.get("/Flags", -1))
        first, last = int(font.get("/FirstChar", -1)), int(font.get("/LastChar", -1))
    except (ValueError, TypeError, OverflowError):
        return False
    if traits.family is None or not 0 <= flags <= 65535 or bool(flags & 64) != traits.italic:
        return False
    matrix = numbers(font.get("/FontMatrix", []), 6)
    if (
        matrix is None
        or matrix[1]
        or matrix[2]
        or matrix[4]
        or matrix[5]
        or not 0 < matrix[0] <= 1
        or not 0 < abs(matrix[3]) <= 1
    ):
        return False
    if not 0 <= first <= last <= 255 or numbers(font.get("/Widths", []), last - first + 1) is None:
        return False
    unicode_map = font.get("/ToUnicode")
    unicode_map = unicode_map.get_object() if unicode_map is not None else None
    if not hasattr(unicode_map, "get_data") or font.get("/Resources", {}):
        return False
    procedures = font.get("/CharProcs", {})
    procedures = procedures.get_object() if hasattr(procedures, "get_object") else procedures
    if not isinstance(procedures, dict) or not 1 <= len(procedures) <= 256:
        return False
    size = total_operations = 0
    for ref in procedures.values():
        stream = ref.get_object()
        if not hasattr(stream, "get_data"):
            return False
        data = stream.get_data()
        size += len(data)
        if len(data) > 262144 or size > 8388608:
            return False
        operations = ContentStream(stream, reader).operations
        total_operations += len(operations)
        if not operations or len(operations) > 10000 or total_operations > 100000:
            return False
        metrics, operator = operations[0]
        values = numbers(metrics, 6)
        if operator != b"d1" or values is None or values[1] != 0:
            return False
        # d1 supplies an uncolored glyph. No images, forms, nested text, colors,
        # graphics states, clipping, transforms or arbitrary operators are allowed.
        for operands, operator in operations[1:]:
            if operator not in COUNTS or numbers(operands, COUNTS[operator]) is None:
                return False
    return True
