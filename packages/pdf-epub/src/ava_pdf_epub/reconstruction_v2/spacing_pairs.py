"""Match exact native glyph boundaries to their physical resource/state witnesses."""

from dataclasses import dataclass

from .observations import NativeLine
from .spacing_capture import MetricKey, glyph_metric_key
from .spacing_metric import SpacingMetric


@dataclass(frozen=True)
class SpacingPair:
    offset: int
    separator: str
    gap: float
    raw_gap: float
    metric: SpacingMetric
    size: float


def spacing_pairs(
    line: NativeLine, metrics: dict[MetricKey, SpacingMetric | None]
) -> list[SpacingPair]:
    ranges = []
    cursor = 0
    for glyph in line.glyphs:
        start = line.text.find(glyph.text, cursor)
        if start < cursor or line.text[cursor:start].strip():
            return []
        ranges.append((start, start + len(glyph.text)))
        cursor = start + len(glyph.text)
    if line.text[cursor:].strip():
        return []
    pairs = []
    for index, (left, right) in enumerate(zip(line.glyphs, line.glyphs[1:], strict=False)):
        metric = metrics.get(glyph_metric_key(left))
        if (
            metric is None
            or metric != metrics.get(glyph_metric_key(right))
            or left.size != right.size
            or left.text.isspace()
            or right.text.isspace()
            or left.source_artifact
            or right.source_artifact
            or not left.visible
            or not right.visible
            or abs(left.box.y1 - right.box.y1) > min(left.size, right.size) * 0.05
        ):
            continue
        raw = right.box.x0 - left.box.x1
        pairs.append(
            SpacingPair(
                ranges[index][1],
                line.text[ranges[index][1] : ranges[index + 1][0]],
                raw - metric.character_spacing,
                raw,
                metric,
                left.size,
            )
        )
    return pairs
