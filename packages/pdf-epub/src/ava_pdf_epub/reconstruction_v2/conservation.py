"""Conserve every native character at the extraction boundary before marker interpretation."""

import re
from collections import Counter

from ..contracts.source import Box
from .geometry import overlap
from .observations import PageObservation
from .segments import Segment


def native_conservation(
    page: PageObservation, segments: list[Segment], excluded: list[Box]
) -> None:
    source = "".join(
        line.text for line in page.lines if not any(overlap(line.box, box) > 0 for box in excluded)
    )
    actual = "".join(
        s.text
        + (s.alt if s.kind == "figure" else "")
        + "".join(c.text for row in s.cells for c in row)
        for s in segments
    )
    if Counter(re.sub(r"\s+", "", source)) != Counter(re.sub(r"\s+", "", actual)):
        raise ValueError("Native extraction omitted, duplicated or changed source characters")
