"""Freeze surviving source starts before joining; no text search or second reading-order sort."""

from dataclasses import dataclass

from .assembly_state import AssemblyState
from .segments import Segment


@dataclass(frozen=True)
class SourcePageStart:
    segment_id: str
    text: str | None
    region_id: str


def capture_page_starts(
    segments: list[Segment], state: AssemblyState
) -> dict[int, SourcePageStart]:
    starts = {}
    for segment in segments:
        if segment.kind == "furniture":
            raise ValueError("Removed furniture cannot be a source-page destination")
        if segment.page in starts:
            continue
        evidence = state.evidence.get(segment.id, [])
        if len(evidence) != 1 or evidence[0]["page"] != segment.page:
            raise ValueError("Source-page start requires one prejoin page-owned observation")
        text = None if segment.kind in {"figure", "table", "separator"} else segment.text
        starts[segment.page] = SourcePageStart(segment.id, text, evidence[0]["region_id"])
    return starts
