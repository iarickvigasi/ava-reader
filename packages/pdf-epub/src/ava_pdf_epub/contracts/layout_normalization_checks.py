"""Version2 keeps its closed authority while sharing exact transformation arithmetic."""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .layout_normalization import LayoutNormalizationMap


def validate_layout_normalization(mapping: "LayoutNormalizationMap", text: str) -> None:
    from .layout_segments import validate_layout_segments

    actions = {d.candidate_id: d.disposition for d in mapping.dispositions}
    decisions = {
        c.id: (
            c.source_start + (actions[c.id] == "literal"),
            c.source_end,
            "line_wrap" if actions[c.id] == "literal" else "layout_hyphen",
        )
        for c in mapping.candidates
    }
    validate_layout_segments(mapping.source_text, text, mapping.segments, decisions)
