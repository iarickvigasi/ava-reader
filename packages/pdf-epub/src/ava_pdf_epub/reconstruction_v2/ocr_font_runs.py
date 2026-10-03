"""Exact Unicode alignment supplies mixed font runs without rewriting OCR text or links."""

from collections import Counter
from typing import Any

from ..contracts.styles import Style
from .font_traits import FontTraits, font_traits
from .observations import Glyph
from .segments import ObservedSpan, Segment

FONT_FIELDS = {"family", "bold", "italic"}


def qualified_font_runs(segment: Segment, glyphs: list[Glyph]) -> Segment | None:
    native: list[tuple[str, FontTraits]] = []
    for glyph in glyphs:
        traits = font_traits(glyph.font)
        if traits.family is None or not glyph.visible:
            return None
        native.extend((c, traits) for c in glyph.text if not c.isspace())
    observed = [(i, c) for i, c in enumerate(segment.text) if not c.isspace()]
    if not native or [c for c, _ in native] != [c for _, c in observed]:
        return None
    faces: list[FontTraits | None] = [None] * len(segment.text)
    for (index, _), (_, source_face) in zip(observed, native, strict=True):
        faces[index] = source_face
    neutral = FontTraits(
        Counter(f.family for _, f in native).most_common(1)[0][0], False, False, False
    )
    # Whitespace only bridges equal faces; a connector's surrounding spaces stay plain.
    left: FontTraits | None = None
    for index, face in enumerate(faces):
        if face is not None:
            left = face
        else:
            faces[index] = left
    right: FontTraits | None = None
    for index in range(len(faces) - 1, -1, -1):
        if not segment.text[index].isspace():
            right = faces[index]
        elif faces[index] != right or right is None:
            faces[index] = neutral
    runs: list[ObservedSpan] = []
    start = 0
    for index in range(1, len(faces) + 1):
        if index < len(faces) and faces[index] == faces[start]:
            continue
        face = faces[start] or neutral
        runs.append(
            ObservedSpan(
                start=start,
                end=index,
                style=Style(
                    id="declared-run", family=face.family, bold=face.bold, italic=face.italic
                ),
            )
        )
        start = index
    if len(runs) + len(segment.spans) > 20000:
        return None
    # Keep each existing destination/range and every non-font style property. Qualified
    # runs follow them and own only three font fields, including explicit plain resets.
    spans = [
        span.model_copy(
            update={"style": span.style.model_copy(update={field: None for field in FONT_FIELDS})}
        )
        if span.style
        else span
        for span in segment.spans
    ]
    base: dict[str, Any] = segment.style.model_dump() if segment.style else {"id": "declared-face"}
    base.update(family=neutral.family, bold=False, italic=False)
    return segment.model_copy(
        update={
            "style": Style.model_validate(base),
            "spans": [*spans, *runs],
        }
    )
