"""Literal source assembly is provisional until any named normalization is applied."""

from collections.abc import Sequence
from dataclasses import dataclass

from ..contracts.layout_hyphen import LayoutHyphenDisposition
from .conservation import native_conservation
from .geometry import union
from .native_line_offsets import NativeLineOffset, mapped_native_ids, native_line_offsets
from .native_structure_contract import NativeStructureResponse, NativeStructureTask
from .native_structure_fields import NativeStructureGroup, NativeStructureLine
from .native_structure_response import accept_native_structure
from .native_structure_sizes import grouped_span_style
from .native_structure_source_validation import validate_source_ownership
from .observations import PageObservation
from .segments import ObservedSpan, Segment


@dataclass(frozen=True)
class NativeStructureSource:
    segments: tuple[Segment, ...]
    line_maps: tuple[NativeLineOffset, ...]
    boundary_dispositions: tuple[LayoutHyphenDisposition, ...]
    pending_normalization: tuple[str, ...]


def assemble_native_structure_source(
    task: NativeStructureTask,
    response: NativeStructureResponse,
    page: PageObservation,
    *,
    preserved_segments: Sequence[Segment] = (),
    furniture: set[str] | None = None,
) -> NativeStructureSource:
    accept_native_structure(task, response)
    validate_source_ownership(task, page, preserved_segments, furniture=furniture or set())
    lines = {line.id: line for line in task.lines}
    preserved = {s.id: s for s in preserved_segments}
    references = {reference.span_id for reference in response.references}
    grouped: dict[str, list[Segment]] = {}
    for index, group in enumerate(response.groups):
        segment = _assemble_group(
            task, group, [lines[i] for i in group.line_ids], index, references
        )
        grouped.setdefault(group.region_id, []).append(segment)
    segments = []
    for region in task.regions:
        if region.artifact_id is not None:
            original = preserved[region.artifact_id]
            segments.append(Segment.model_validate(original.model_dump()))
        else:
            segments.extend(grouped[region.source.id])
    native_conservation(page, segments, [])
    mappings = native_line_offsets(page, segments, mapped_native_ids(segments))
    return NativeStructureSource(
        segments=tuple(segments),
        line_maps=tuple(mappings),
        boundary_dispositions=tuple(response.boundary_dispositions),
        pending_normalization=tuple(
            d.candidate_id for d in response.boundary_dispositions if d.disposition == "layout"
        ),
    )


def _assemble_group(
    task: NativeStructureTask,
    group: NativeStructureGroup,
    lines: list[NativeStructureLine],
    index: int,
    references: set[str],
) -> Segment:
    separator = "\n" if group.kind in {"verse", "code", "quote"} else " "
    text = ""
    spans: list[ObservedSpan] = []
    for line in lines:
        if text:
            text += separator
        offset = len(text)
        text += line.text
        spans.extend(
            ObservedSpan.model_validate(
                {
                    **span.model_dump(exclude={"id"}),
                    "start": span.start + offset,
                    "end": span.end + offset,
                    "style": grouped_span_style(line, span, lines[0].style),
                    "note_label": line.text[span.start : span.end]
                    if span.id in references
                    else span.note_label,
                }
            )
            for span in line.spans
        )
    values = group.model_dump(exclude={"id", "region_id", "line_ids"})
    return Segment.model_validate(
        {
            **values,
            "id": f"p{task.page_number}-native-{task.task_id[-12:]}-{index}",
            "page": task.page_number,
            "box": union([line.box for line in lines]).model_dump(),
            "method": "native",
            "text": text,
            "source_text": "\n".join(line.text for line in lines),
            "style": lines[0].style.model_dump(),
            "spans": [s.model_dump() for s in spans],
            "native_line_ids": group.line_ids,
        }
    )
