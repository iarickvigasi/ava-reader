"""Source action and exact PageLabels guards shared without changing native ownership."""

from typing import Any

from pypdf import PdfReader

from ..contracts.source import Box
from ..pdf_navigation import NavigationTarget
from .geometry import overlap
from .native_line_visibility import complete_visible_line
from .observations import NativeLine, PageObservation
from .page_label_semantics import explicit_decimal_label, source_destination
from .segments import Segment


def page_label_context(
    reader: PdfReader,
    target: NavigationTarget,
    page: PageObservation,
    owners: list[Segment],
    caller: Box,
    annotation: Any,
    allowed_risks: frozenset[str],
) -> tuple[NativeLine, str] | None:
    if not source_destination(reader, annotation, target):
        return None
    label = explicit_decimal_label(reader, target)
    if (
        label is None
        or set(page.risks) - allowed_risks
        or page.rotation
        or page.required_regions
        or not caller.within(page.width_pt, page.height_pt)
        or any(overlap(g.box, caller) for g in page.graphics)
        or len({line.id for line in page.lines}) != len(page.lines)
        or len({s.id for s in owners}) != len(owners)
    ):
        return None
    lines = [
        line
        for line in page.lines
        if any(g.text.strip() and overlap(g.box, caller) for g in line.glyphs)
    ]
    if len(lines) != 1:
        return None
    line = lines[0]
    if not complete_visible_line(line) or any(g.source_artifact for g in line.glyphs):
        return None
    return line, label
