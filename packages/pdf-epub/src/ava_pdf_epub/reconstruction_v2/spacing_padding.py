"""Ignore only raw-index-bound, generated zero-ink boundary padding of an otherwise exact line."""

import math
from typing import Any

from .native_line_visibility import complete_visible_line
from .observations import Glyph, NativeLine, PageObservation
from .spacing_raw_run import generated_padding, source_owned_run


def _owns_point(glyph: Glyph, x: float, y: float) -> bool:
    return glyph.box.x0 <= x <= glyph.box.x1 and glyph.box.y0 <= y <= glyph.box.y1


def _padding(
    text: Any, raw: Any, index: int, glyph: Glyph, line: NativeLine, observation: PageObservation
) -> bool:
    if (
        not glyph.visible
        or glyph.source_artifact
        or not glyph.text.strip()
        or raw.FPDFText_GetUnicode(text, index) != 32
        or raw.FPDFText_IsGenerated(text, index) != 1
        or raw.FPDFText_IsHyphen(text, index) != 0
    ):
        return False
    left, bottom, right, top = text.get_charbox(index)
    if not all(math.isfinite(v) for v in (left, bottom, right, top)) or not (
        left == right and bottom == top
    ):
        return False
    x, y = left, observation.height_pt - top
    return (
        _owns_point(glyph, x, y)
        and sum(_owns_point(g, x, y) for g in line.glyphs) == 1
        and not any(
            other.id != line.id
            and other.box.x0 <= x <= other.box.x1
            and other.box.y0 <= y <= other.box.y1
            for other in observation.lines
        )
    )


def qualify_decoder_padding(
    proposals: list[str], observation: PageObservation, text: Any, raw: Any
) -> list[str]:
    candidates = [
        i
        for i, (line, value) in enumerate(zip(observation.lines, proposals, strict=True))
        if value != line.text
        and value.strip(" ") == line.text
        and not line.text.startswith(" ")
        and not line.text.endswith(" ")
        and line.glyphs
        and complete_visible_line(line)
        and not any(g.source_artifact for g in line.glyphs)
        and sum(other.id == line.id for other in observation.lines) == 1
    ]
    if not candidates:
        return proposals
    count = text.count_chars()
    if type(count) is not int or not 0 <= count <= 200000:
        raise RuntimeError("Second-decoder character bound exceeded")
    scalars = [raw.FPDFText_GetUnicode(text, index) for index in range(count)]
    # Every Python string position is exactly one raw character index; unknown
    # mappings cannot shift the index stream or match a validated source string.
    stream = "".join(
        chr(code) if 0 < code <= 0x10FFFF and not 0xD800 <= code <= 0xDFFF else "\x00"
        for code in scalars
    )
    result = list(proposals)
    for i in candidates:
        line, value = observation.lines[i], proposals[i]
        leading = len(value) - len(value.lstrip(" "))
        trailing = len(value) - len(value.rstrip(" "))
        positions = [(j, line.glyphs[0]) for j in range(leading)] + [
            (j, line.glyphs[-1]) for j in range(len(value) - trailing, len(value))
        ]
        matches: list[int] = []
        cursor, seen = 0, 0
        while (start := stream.find(value, cursor)) >= 0:
            seen += 1
            if seen > 64:
                matches = []
                break
            old_owner = all(
                _padding(text, raw, start + j, glyph, line, observation) for j, glyph in positions
            )
            run_owner = not old_owner and source_owned_run(
                text, raw, start + leading, line, observation
            )
            if old_owner or (
                run_owner
                and all(generated_padding(text, raw, start + j, observation) for j, _ in positions)
            ):
                matches.append(start)
                if len(matches) > 1:
                    break  # Additional occurrences cannot restore unique ownership.
            cursor = start + 1
        if len(matches) == 1:
            result[i] = line.text
    return result
