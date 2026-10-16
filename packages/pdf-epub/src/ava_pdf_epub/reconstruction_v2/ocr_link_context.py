"""Disambiguate repeated OCR link text using an exact complete source context."""

import re

from .geometry import overlap
from .native_ink import ink_envelope_matches
from .observations import NativeLine, PageObservation
from .segments import Segment


def complete_visible_line(line: NativeLine) -> bool:
    cursor = 0
    for glyph in line.glyphs:
        at = line.text.find(glyph.text, cursor)
        if (
            at < cursor
            or line.text[cursor:at].strip()
            or (glyph.text.strip() and not glyph.visible)
        ):
            return False
        cursor = at + len(glyph.text)
    return not line.text[cursor:].strip()


def repeated_source_context(page: PageObservation, target: NativeLine, owner: Segment) -> bool:
    text = target.text.strip()
    return bool(text) and any(
        other is not target
        and text in other.text
        and any(g.text.strip() and overlap(g.box, owner.box) for g in other.glyphs)
        for other in page.lines
    )


def context_line_offset(page: PageObservation, target: NativeLine, owner: Segment) -> int | None:
    # This fallback does not infer OCR ownership from native IDs. The accepted
    # visual string must reproduce every visible source line in its envelope.
    lines = [
        line
        for line in page.lines
        if any(g.text.strip() and overlap(g.box, owner.box) for g in line.glyphs)
    ]
    if (
        not 1 < len(lines) <= 64
        or len({line.id for line in lines}) != len(lines)
        or target.id not in {line.id for line in lines}
        or page.rotation
        or owner.page != page.number
        or any(overlap(region.box, owner.box) for region in page.required_regions)
    ):
        return None
    previous = None
    for line in lines:
        if not ink_envelope_matches(page, line, owner):
            return None
        if not complete_visible_line(line):
            return None
        if previous is not None:
            below = line.box.y0 >= previous.box.y1
            same_row = (
                abs((line.box.y0 + line.box.y1) - (previous.box.y0 + previous.box.y1)) / 2
                <= min(line.box.y1 - line.box.y0, previous.box.y1 - previous.box.y0) / 4
                and line.box.x0 >= previous.box.x1
            )
            if not (below or same_row):
                return None
        previous = line
    accepted = list(re.finditer(r"\S+", owner.text))
    observed = [re.findall(r"\S+", line.text) for line in lines]
    if [t.group() for t in accepted] != [token for tokens in observed for token in tokens]:
        return None
    cursor, target_offset = 0, None
    for line, tokens in zip(lines, observed, strict=True):
        if not tokens:
            return None
        start, end = accepted[cursor].start(), accepted[cursor + len(tokens) - 1].end()
        # The affine glyph mapping remains valid only with exact within-line
        # spacing. Joining whitespace may differ; source words never do.
        if owner.text[start:end] != line.text.strip():
            return None
        if line.id == target.id:
            target_offset = start
        cursor += len(tokens)
    return target_offset
