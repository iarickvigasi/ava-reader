"""Require localized text or a source-pixel asset; overlap alone proves no preservation."""

from typing import Any

from ..contracts.source import Box
from .geometry import area, overlap
from .segments import Segment


def annotation_coverage(evidence: Any, segments: list[Segment]) -> None:
    for region in evidence.get("required_regions", []):
        box = Box.model_validate(region["box"])
        nearby = [s for s in segments if overlap(s.box, box) > 0]
        if region["kind"] == "inline_style":
            # Final source reconstruction maps exact words; this only checks text presence.
            accounted = any(
                s.text.strip()
                or any(c.text.strip() and overlap(c.box, box) for row in s.cells for c in row)
                for s in nearby
                if s.kind not in {"figure", "furniture", "unsupported"}
            )
        elif region["kind"] == "text":
            # A page-sized body paragraph cannot stand in for missing editorial text.
            accounted = any(
                overlap(s.box, box) / area(s.box) >= 0.5
                and (s.text.strip() or any(c.text.strip() for row in s.cells for c in row))
                for s in nearby
                if s.kind not in {"figure", "furniture", "separator"}
            )
        else:
            # Non-inline appearances such as Ink require actual source-pixel
            # preservation, not an unrelated ordinary paragraph or table cell.
            accounted = any(
                s.kind == "figure"
                and overlap(s.box, box) / area(box) >= 0.9
                and area(s.box) <= 4 * area(box)
                for s in nearby
            )
        if not accounted:
            raise ValueError("Recognition omitted a required visible annotation region")
