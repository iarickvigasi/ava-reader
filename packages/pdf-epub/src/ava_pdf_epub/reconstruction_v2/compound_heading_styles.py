"""Flatten source heading runs without nested relative-size multiplication."""

from math import isclose, prod

from ..contracts.styles import Style
from .segments import ObservedSpan, Segment

INLINE_FIELDS = (
    "family",
    "bold",
    "italic",
    "small_caps",
    "vertical_align",
    "color",
    "background_color",
    "decoration_color",
    "underline",
    "strike_through",
)
LAYOUT_FIELDS = (
    "align",
    "indent_em",
    "block_indent_em",
    "space_before_em",
    "space_after_em",
    "line_height",
)


def heading_spans(piece: Segment, base: Style | None, offset: int) -> list[ObservedSpan]:
    # CSS decorations on a heading propagate through descendants: an explicit
    # false on a component cannot cancel them. Refuse rather than silently extend
    # a source underline/strike across the title, including after base correction.
    if base and (base.underline is True or base.strike_through is True):
        raise ValueError("Compound heading block decoration requires source review")
    style = piece.style
    base_size = base.relative_size if base else None
    size = style.relative_size if style else None
    if size != base_size and (size is None or base_size is None):
        raise ValueError("Compound heading lacks a measured component size")
    boundaries = sorted({0, len(piece.text), *(p for s in piece.spans for p in (s.start, s.end))})
    output = []
    for start, end in zip(boundaries, boundaries[1:], strict=False):
        active = [s for s in piece.spans if s.start <= start and end <= s.end]
        values: dict[str, object] = {"id": "compound-heading-run"}
        for field in INLINE_FIELDS:
            value = getattr(style, field) if style else None
            for span in active:
                override = getattr(span.style, field) if span.style else None
                if override is not None:
                    value = override
            if value is None and base is not None and getattr(base, field) is not None:
                raise ValueError("Compound heading cannot inherit an unknown component style")
            if value is not None:
                values[field] = value
        inline_sizes = [
            s.style.relative_size
            for s in active
            if s.style is not None and s.style.relative_size is not None
        ]
        ratio = (size / base_size if size is not None and base_size is not None else 1) * prod(
            inline_sizes
        )
        if size != base_size or inline_sizes:
            if isclose(ratio, 1, abs_tol=1e-12):
                ratio = 1.0
            if not 0.5 <= ratio <= 3:
                raise ValueError("Compound heading source size exceeds the representable ratio")
            values["relative_size"] = ratio
        destinations = {
            (s.url, s.note_label, s.target_text)
            for s in active
            if s.url or s.note_label or s.target_text
        }
        if len(destinations) > 1:
            raise ValueError("Compound heading has ambiguous inline destinations")
        url, note, target = next(iter(destinations), (None, None, None))
        output.append(
            ObservedSpan(
                start=start + offset,
                end=end + offset,
                style=Style.model_validate(values) if len(values) > 1 else None,
                url=url,
                note_label=note,
                target_text=target,
            )
        )
    return output
