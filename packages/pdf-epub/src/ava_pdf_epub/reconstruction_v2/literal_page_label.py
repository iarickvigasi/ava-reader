"""Author-declared page labels corroborate a native reference, never its text."""

from collections.abc import Mapping
from typing import Any

from pypdf import PdfReader

from ..contracts.source import Box
from ..pdf_navigation import NavigationTarget
from .geometry import overlap
from .native_line_offsets import NativeLineOffset, mapped_line_offset
from .observations import PageObservation
from .page_label_context import page_label_context
from .page_label_digits import page_label_digits
from .page_label_semantics import explicit_decimal_label as explicit_decimal_label
from .segments import Segment


def literal_page_label_range(
    reader: PdfReader,
    target: NavigationTarget,
    page: PageObservation,
    segments: list[Segment],
    caller: Box,
    mappings: Mapping[str, NativeLineOffset] | None,
    *,
    annotation: Any,
) -> list[tuple[str, int, int]] | None:
    context = page_label_context(
        reader, target, page, segments, caller, annotation, frozenset({"language_uncertain"})
    )
    if context is None:
        return None
    line, label = context
    owners = [s for s in segments if line.id in s.native_line_ids]
    if len(owners) != 1:
        return None
    owner = owners[0]
    if (
        owner.method != "native"
        or owner.page != page.number
        or owner.kind in {"table", "figure", "furniture", "unsupported"}
        or owner.source_marginal_furniture
        or any(s is not owner and s.text and overlap(s.box, caller) for s in segments)
    ):
        return None
    at = mapped_line_offset(line, owner, mappings)
    if at is None:
        return None
    digits = page_label_digits(page, line, owner.box, caller, label)
    return [(owner.id, at + digits[0], at + digits[1])] if digits else None
