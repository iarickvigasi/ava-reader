"""Only exact measured native superscript runs can be identified as note callers."""

import re
from collections.abc import Sequence

from .geometry import union
from .native_structure_fields import (
    NativeStructureCallout,
    NativeStructureLine,
    NativeStructureRegion,
)
from .observations import PageObservation


def eligible_native_callouts(
    page: PageObservation,
    lines: Sequence[NativeStructureLine],
    regions: Sequence[NativeStructureRegion],
) -> list[NativeStructureCallout]:
    editable = {
        ident
        for region in regions
        if region.artifact_id is None and region.source.role == "content"
        for ident in region.line_ids
    }
    observed = {line.id: line for line in page.lines}
    callouts = []
    for line in lines:
        if line.id not in editable:
            continue
        ranges, cursor = [], 0
        for glyph in observed[line.id].glyphs:
            start = line.text.find(glyph.text, cursor)
            end = start + len(glyph.text)
            ranges.append((start, end, glyph.box))
            cursor = end
        for span in line.spans:
            label = line.text[span.start : span.end]
            if (
                span.style is None
                or span.style.vertical_align != "super"
                or re.fullmatch(r"(?:\d{1,20}|[A-Za-z]{1,3}|[*†‡])", label) is None
            ):
                continue
            selected = [
                (start, end, box)
                for start, end, box in ranges
                if span.start <= start < end <= span.end
            ]
            if not selected or selected[0][0] != span.start or selected[-1][1] != span.end:
                continue
            callouts.append(
                NativeStructureCallout(
                    span_id=span.id,
                    line_id=line.id,
                    exact_text=label,
                    box=union([box for _, _, box in selected]),
                )
            )
    return callouts
