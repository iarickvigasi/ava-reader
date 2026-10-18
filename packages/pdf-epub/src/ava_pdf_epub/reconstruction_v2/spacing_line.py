"""A second decoder and independent local physical contrast must agree on every addition."""

from .native_line_visibility import complete_visible_line
from .observations import NativeLine
from .spacing_capture import MetricKey
from .spacing_insertions import space_insertions
from .spacing_metric import SpacingMetric
from .spacing_pairs import spacing_pairs

LOCAL_PAIR_MINIMUM = 12
SPACE_ADVANCE_FRACTION = 0.6
LOCAL_GAP_CONTRAST = 3
VISIBLE_GAP_FRACTION = 0.05
MINIMUM_CANDIDATE_SEPARATION = 3


def qualify_line_spaces(
    line: NativeLine, proposed: str, metrics: dict[MetricKey, SpacingMetric | None]
) -> tuple[NativeLine, bool]:
    additions = space_insertions(line.text, proposed)
    if additions is None:
        return line, True  # Decoder disagreement is uncertainty, not proof of correct spacing.
    if not additions:
        return line, False
    if (
        any(
            b - a < MINIMUM_CANDIDATE_SEPARATION
            for a, b in zip(additions, additions[1:], strict=False)
        )
        or not complete_visible_line(line)
        or any(g.source_artifact for g in line.glyphs)
        or line.style.family in {None, "monospace"}
    ):
        return line, True
    pairs = spacing_pairs(line, metrics)
    for offset in additions:
        pair = next((p for p in pairs if p.offset == offset and not p.separator), None)
        if pair is None:
            return line, True
        within = [
            max(0, p.gap)
            for p in pairs
            if p.metric == pair.metric
            and p.size == pair.size
            and not p.separator
            and p.offset not in additions
        ]
        if (
            len(within) < LOCAL_PAIR_MINIMUM
            or pair.raw_gap < VISIBLE_GAP_FRACTION * pair.metric.em
            or pair.gap < SPACE_ADVANCE_FRACTION * pair.metric.space
            or pair.gap < LOCAL_GAP_CONTRAST * max(within)
        ):
            return line, True
    return line.model_copy(
        update={
            "text": proposed,
            "inserted_space_offsets": additions,
        }
    ), False
