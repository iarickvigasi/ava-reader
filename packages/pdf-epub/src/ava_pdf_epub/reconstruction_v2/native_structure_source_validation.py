"""Recheck source ownership independently of a structurally valid provider response."""

from collections.abc import Sequence

from ..contracts.common import document_digest
from .geometry import overlap
from .native_structure_contract import NativeStructureTask
from .observations import PageObservation
from .segments import Segment


def validate_source_ownership(
    task: NativeStructureTask,
    page: PageObservation,
    preserved_segments: Sequence[Segment],
    *,
    furniture: set[str],
) -> None:
    from .native_structure_source import qualified_native_lines

    if (
        task.observation_sha256 != document_digest(page)
        or task.page_number != page.number
        or task.page_width_pt != page.width_pt
        or task.page_height_pt != page.height_pt
        or task.image.sha256 != page.render_sha256
        or task.image.width != page.render_width
        or task.image.height != page.render_height
    ):
        raise ValueError("Native structure task differs from source observation/render")
    lines = qualified_native_lines(page, task.profile_id)
    if lines is None or lines != task.lines:
        raise ValueError("Native structure source glyph/span qualification changed")
    from .native_structure_callouts import eligible_native_callouts

    if eligible_native_callouts(page, lines, task.regions) != task.eligible_callouts:
        raise ValueError("Native structure eligible callout source geometry differs")
    preserved = {s.id: s for s in preserved_segments}
    if len(preserved) != len(preserved_segments) or set(preserved) != {
        a.id for a in task.artifacts
    }:
        raise ValueError("Native structure preserved artifact coverage differs")
    for artifact in task.artifacts:
        segment = preserved[artifact.id]
        region = next(r for r in task.regions if r.artifact_id == artifact.id)
        if (
            document_digest(segment) != artifact.segment_sha256
            or segment.kind != artifact.kind
            or segment.page != page.number
            or segment.box != region.source.box
            or segment.native_line_ids != region.line_ids
            or segment.method not in {"native", "render"}
            or segment.method != region.source.route
        ):
            raise ValueError("Native structure preserved artifact identity differs")
        if region.source.role == "furniture" and not segment.source_marginal_furniture:
            raise ValueError("Native structure artifact furniture has no qualified source proof")
    for region in task.regions:
        if region.artifact_id is None and region.source.role == "furniture":
            if not set(region.line_ids).issubset(furniture):
                raise ValueError("Native structure furniture has no qualified source proof")
    # Raster/vector regions cannot quietly become editable native prose. Existing
    # qualified underline ink and separately preserved artifacts keep their authority.
    if not graphics_are_preserved(page, preserved_segments):
        raise ValueError("Native structure graphic text requires the existing recognition route")


def graphics_are_preserved(page: PageObservation, preserved_segments: Sequence[Segment]) -> bool:
    for graphic in page.graphics:
        if graphic.underline_line_id is not None:
            continue
        touched = [line.id for line in page.lines if overlap(line.box, graphic.box) > 0]
        if not any(
            set(touched).issubset(s.native_line_ids)
            and s.box.x0 <= graphic.box.x0 < graphic.box.x1 <= s.box.x1
            and s.box.y0 <= graphic.box.y0 < graphic.box.y1 <= s.box.y1
            for s in preserved_segments
        ):
            return False
    return True
