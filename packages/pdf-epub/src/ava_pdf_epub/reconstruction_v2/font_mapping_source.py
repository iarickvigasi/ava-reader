"""A narrow direct-Type1 axis proof excludes unrecorded vertical or rotated text mapping."""

import math
from typing import Any

from pypdf import PdfReader
from pypdf.generic import ContentStream


def direct_type1_mapping(page: Any, reader: PdfReader) -> bool:
    fonts = page.get("/Resources", {}).get("/Font", {})
    if not fonts or any(
        f.get_object().get("/Subtype") != "/Type1" or "/FontMatrix" in f.get_object()
        for f in fonts.values()
    ):
        return False
    contents = page.get_contents()
    if contents is None:
        return False
    operations = ContentStream(contents, reader).operations
    if len(operations) > 1000000:
        return False
    try:
        if float(page.get("/UserUnit", 1)) != 1:
            return False
        for values, operator in operations:
            if operator in {b"Tm", b"cm"}:
                if len(values) != 6:
                    return False
                a, b, c, d, e, f = [float(v) for v in values]
                if (
                    not all(math.isfinite(v) for v in (a, b, c, d, e, f))
                    or a <= 0
                    or d <= 0
                    or b
                    or c
                ):
                    return False
            if operator in {b"Tz", b"Tf"}:
                if len(values) != (1 if operator == b"Tz" else 2):
                    return False
                value = float(values[-1])
                if not math.isfinite(value) or value <= 0:
                    return False
    except (TypeError, ValueError, OverflowError):
        return False
    return True
