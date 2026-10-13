"""Qualify isolated literal ornament rows from source geometry, retaining exact glyph styles."""

import re

from .geometry import union
from .native_layout_qualification import qualified_layout, qualified_line
from .observations import PageObservation
from .paragraphs import _join
from .segments import Segment

ORNAMENT = re.compile(r"[*·•—–-]")


def native_layout_rows(
    page: PageObservation, segments: list[Segment]
) -> tuple[list[Segment], set[str]]:
    # This is worker-private layout qualification. The complete preparation
    # binds immutable source/render/paint observations before enabling its policy.
    if not qualified_layout(page):
        return segments, set()
    lines = {line.id: line for line in page.lines}
    candidates = [
        segment
        for segment in segments
        if segment.kind == "paragraph"
        and segment.method == "native"
        and len(segment.native_line_ids) == 1
        and segment.native_line_ids[0] in lines
        and qualified_line(lines[segment.native_line_ids[0]])
        and segment.text == lines[segment.native_line_ids[0]].text
        and segment.box == lines[segment.native_line_ids[0]].box
        and ORNAMENT.fullmatch(segment.text)
        and segment.style is not None
        and segment.style.family is not None
        and segment.style.relative_size is not None
        and 0.95 <= segment.style.relative_size <= 1.05
        and all(g.visible for g in lines[segment.native_line_ids[0]].glyphs)
    ]
    changed: set[str] = set()
    protected: set[str] = set()
    replacements: list[Segment] = []
    for first in sorted(candidates, key=lambda s: (s.box.y0, s.box.x0)):
        if first.id in changed or first.style is None:
            continue
        row = sorted(
            [
                s
                for s in candidates
                if abs(s.box.y0 - first.box.y0) <= 0.05 and abs(s.box.y1 - first.box.y1) <= 0.05
            ],
            key=lambda s: s.box.x0,
        )
        if not 3 <= len(row) <= 9 or any(s.text != first.text for s in row):
            continue
        if any(
            s.style is None
            or s.style.model_dump(exclude={"id"}) != first.style.model_dump(exclude={"id"})
            for s in row
        ):
            continue
        height = max(1.0, first.box.y1 - first.box.y0)
        gaps = [b.box.x0 - a.box.x1 for a, b in zip(row, row[1:], strict=False)]
        if min(gaps) <= 0 or max(gaps) - min(gaps) > height * 0.15:
            continue
        box = union([s.box for s in row])
        if abs((box.x0 + box.x1) / 2 - page.width_pt / 2) > height:
            continue
        members = {s.id for s in row}
        if any(s.id not in members and s.box.y0 < box.y1 and s.box.y1 > box.y0 for s in segments):
            continue
        literal = row[0].model_copy(update={"preserve_line_breaks": True})
        for following in row[1:]:
            literal = _join(literal, following, " ")
        # Keep the actual printed characters: canonical separator would replace
        # them with a rule. The literal paragraph also bypasses bullet parsing.
        assert literal.style is not None  # All row members carry the checked source style.
        literal = literal.model_copy(
            update={"style": literal.style.model_copy(update={"align": "center"})}
        )
        replacements.append(literal)
        changed.update(members)
        protected.add(literal.id)
    return [s for s in segments if s.id not in changed] + replacements, protected
