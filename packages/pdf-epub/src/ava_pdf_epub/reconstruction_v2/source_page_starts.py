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
        components = state.compound_heading_sources.get(segment.id)
        if components:
            first = components[0]
            if (
                first.id != segment.id
                or first.page != segment.page
                or not segment.text.startswith(first.text + "\n")
                or len(evidence) != len(components)
                or evidence[0]["box"] != first.box.model_dump()
            ):
                raise ValueError("Compound source-page start lost its first component")
            segment, evidence = first, evidence[:1]
        if len(evidence) != 1 or evidence[0]["page"] != segment.page:
            raise ValueError("Source-page start requires one prejoin page-owned observation")
        text = None if segment.kind in {"figure", "table", "separator"} else segment.text
        starts[segment.page] = SourcePageStart(segment.id, text, evidence[0]["region_id"])
    return starts
