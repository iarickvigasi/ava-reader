"""Apply proved caller ranges and exact destinations without changing source text."""

from collections.abc import Sequence

from pypdf import PdfReader

from ..pdf_navigation import NavigationTarget
from .assembly_state import AssemblyState
from .findings import Finding
from .pdf_link_target import page_target
from .prepared_types import AnyPreparedPage
from .segments import ObservedSpan, Segment
from .source_literal_link import source_literal_link


def apply_link_marks(
    ranges: list[tuple[str, int, int]],
    target: NavigationTarget,
    result: list[Segment],
    indexes: dict[str, int],
    reader: PdfReader,
    prepared: Sequence[AnyPreparedPage],
    state: AssemblyState,
) -> None:
    for ident, start, end in ranges:
        if target.url:
            item = result[indexes[ident]]
            mark = ObservedSpan(start=start, end=end, url=target.url)
            existing = [s for s in item.spans if s.url and s.start < end and s.end > start]
            if existing and (
                len(existing) != 1
                or existing[0].start != start
                or existing[0].end != end
                or existing[0].url != target.url
            ):
                resolved = source_literal_link(item, start, end, target.url, existing)
                if resolved is None:
                    raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
                result[indexes[ident]] = item.model_copy(update={"spans": resolved})
                state.structure_findings.append(
                    Finding(
                        code="PDF_LINK_LITERAL_RANGE_FROM_SOURCE",
                        severity="information",
                        page=item.page,
                        message=(
                            "Source link geometry owns the literal URL range; style is unchanged."
                        ),
                    )
                )
            if not existing:
                result[indexes[ident]] = item.model_copy(update={"spans": [*item.spans, mark]})
        else:
            destination, offset = page_target(
                target,
                result,
                reader,
                prepared[(target.page or 0) - 1].observation,
                source_line_maps=state.native_line_maps,
                source_continuation_policy=state.source_continuation_policy,
            )
            intent = (ident, start, end, destination, offset)
            if intent not in state.internal_targets:
                state.internal_targets.append(intent)
