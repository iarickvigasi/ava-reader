"""Preserve complete native font roles without promoting a dominant face to the whole aside."""

from ..contracts.source import Box
from ..contracts.styles import Style
from .font_traits import FontTraits
from .native_font_coverage import native_font_coverage
from .observations import NativeLine, PageObservation
from .segments import ObservedSpan

MAX_ASIDE_FONT_RUNS = 20000  # Segment.spans contract; exceeding optional typography stays unknown.


def native_aside_fonts(
    page: PageObservation, lines: list[NativeLine], box: Box, other_owners: set[str], ident: str
) -> tuple[Style | None, list[ObservedSpan]]:
    covered = native_font_coverage(page, lines, box, other_owners)
    if not covered:
        return None, []
    faces = [face for _, _, face in covered]
    first = faces[0]
    style = Style(
        id=ident + "-font",
        family=first.family if all(f.family == first.family for f in faces) else None,
        bold=first.bold if all(f.bold == first.bold for f in faces) else None,
        italic=first.italic if all(f.italic == first.italic for f in faces) else None,
        small_caps=first.small_caps
        if all(f.small_caps == first.small_caps for f in faces)
        else None,
    )
    if all(face == first for face in faces):
        return style, []
    runs: list[tuple[int, int, FontTraits]] = []
    for start, end, face in covered:
        if runs and runs[-1][1] == start and runs[-1][2] == face:
            runs[-1] = (runs[-1][0], end, face)
        else:
            runs.append((start, end, face))
            if len(runs) > MAX_ASIDE_FONT_RUNS:
                return None, []
    return style, [
        ObservedSpan(
            start=start,
            end=end,
            style=Style(
                id=f"{ident}-font{i}",
                family=face.family,
                bold=face.bold,
                italic=face.italic,
                small_caps=face.small_caps,
            ),
        )
        for i, (start, end, face) in enumerate(runs)
    ]
