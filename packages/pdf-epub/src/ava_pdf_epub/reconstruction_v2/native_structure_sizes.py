"""Keep each source glyph's effective size when native lines share a block base."""

from ..contracts.styles import Style
from .native_structure_fields import NativeStructureLine, NativeStructureSpan


def validate_grouped_sizes(lines: list[NativeStructureLine]) -> None:
    for line in lines:
        for span in line.spans:
            _relative_size(line, span, lines[0].style)


def grouped_span_style(
    line: NativeStructureLine, span: NativeStructureSpan, base: Style
) -> Style | None:
    relative = _relative_size(line, span, base)
    if span.style is None or relative == span.style.relative_size:
        return span.style
    return Style.model_validate({**span.style.model_dump(), "relative_size": relative})


def _relative_size(
    line: NativeStructureLine, span: NativeStructureSpan, base: Style
) -> float | None:
    source_size, base_size = line.style.relative_size, base.relative_size
    if source_size == base_size:
        return span.style.relative_size if span.style is not None else None
    if (
        source_size is None
        or base_size is None
        or span.style is None
        or span.style.relative_size is None
    ):
        raise ValueError("Native structure grouped size has no measured source ratio")
    relative = span.style.relative_size * source_size / base_size
    if not 0.5 <= relative <= 3:
        raise ValueError(
            "Native structure grouped source size exceeds the representable span ratio"
        )
    return relative
