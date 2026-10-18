"""Corroborate overhanging hyphen ink with the original font state and ordered origin cell."""

import ctypes
import math
from dataclasses import dataclass
from typing import Any

from ..contracts.source import Box
from .geometry import overlap
from .observations import NativeLine, PageObservation
from .spacing_capture import MetricKey, glyph_metric_key
from .spacing_metric import SpacingMetric
from .spacing_raw_style import raw_style_matches


@dataclass(frozen=True)
class HyphenSourceContext:
    text: Any
    raw: Any
    metrics: dict[MetricKey, SpacingMetric | None]
    raw_count: int
    marker_indices: dict[tuple[float, float, float, float], tuple[int, ...]]


def source_owned_marker(
    line: NativeLine, box: Box, observation: PageObservation, context: HyphenSourceContext
) -> bool:
    text, raw, metrics = context.text, context.raw, context.metrics
    glyph = line.glyphs[-1]
    states = [metrics.get(glyph_metric_key(g)) for g in line.glyphs]
    metric = states[-1]
    if metric is None or metric.source_origin is None or not overlap(box, glyph.box):
        return False
    if any(state is None or state.source_origin is None or state != metric for state in states):
        return False
    origins = [
        state.source_origin
        for state in states
        if state is not None and state.source_origin is not None
    ]
    if not all(math.isfinite(v) for origin in origins for v in origin):
        return False
    if any(a[0] >= b[0] or a[1] != b[1] for a, b in zip(origins, origins[1:], strict=False)):
        return False
    left, baseline = metric.source_origin
    if (
        not left < glyph.box.x1
        or not glyph.box.y0 <= observation.height_pt - baseline <= glyph.box.y1
    ):
        return False
    try:
        count = text.count_chars()
        if (
            type(count) is not int
            or type(context.raw_count) is not int
            or count != context.raw_count
            or not 0 <= count <= 200000
        ):
            return False
        key = (box.x0, box.y0, box.x1, box.y1)
        indices = context.marker_indices.get(key, ())
        if len(indices) != 1 or type(indices[0]) is not int or not 0 <= indices[0] < count:
            return False
        index = indices[0]
        # A page-local catalogue avoids a full raw scan per row. Current count,
        # flags and geometry must still match the one captured raw position.
        if raw.FPDFText_GetUnicode(text, index) != 2 or raw.FPDFText_IsHyphen(text, index) != 1:
            return False
        a, b, c, d = text.get_charbox(index)
        if (a, observation.height_pt - d, c, observation.height_pt - b) != key:
            return False
        x, y = ctypes.c_double(), ctypes.c_double()
        if raw.FPDFText_GetCharOrigin(text, index, ctypes.byref(x), ctypes.byref(y)) != 1:
            return False
        if not math.isfinite(x.value) or not math.isfinite(y.value):
            return False
        # Advance boxes may overlap under kerning. Ordered original origins
        # partition the row; the terminal cell's right endpoint is excluded.
        if not (
            left <= x.value < glyph.box.x1
            and glyph.box.y0 <= observation.height_pt - y.value <= glyph.box.y1
        ):
            return False
        return raw_style_matches(text, raw, index, glyph, metric)
    except (AttributeError, TypeError, ValueError, OverflowError):
        return False
