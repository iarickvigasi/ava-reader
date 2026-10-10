"""Recover observed flush OCR starts from complete pixels and independent column context."""

from collections.abc import Sequence
from pathlib import Path
from statistics import median

from PIL import Image

from ..contracts.styles import Style
from .assembly_state import AssemblyState
from .pixel_line_margins import pixel_line_margins
from .prepared import PreparedPage
from .segments import Segment


def recover_ocr_indents(
    segments: list[Segment], prepared: Sequence[PreparedPage], scratch: Path, state: AssemblyState
) -> list[Segment]:
    updates: dict[str, Segment] = {}
    for checkpoint in prepared:
        page = checkpoint.observation
        selected = [s for s in segments if s.page == page.number and s.kind == "paragraph"]
        if not any(
            s.method == "ocr" and (s.style is None or s.style.indent_em is None) for s in selected
        ):
            continue
        observed: dict[str, list[float]] = {}
        with Image.open(scratch / page.render_path) as raw:
            image = raw.convert("L")
            sx, sy = image.width / page.width_pt, image.height / page.height_pt
            for segment in selected:
                box = segment.box
                left, top = max(0, int((box.x0 - 3) * sx)), max(0, int((box.y0 - 3) * sy))
                crop = image.crop(
                    (
                        left,
                        top,
                        min(image.width, int((box.x1 + 3) * sx)),
                        min(image.height, int((box.y1 + 3) * sy)),
                    )
                )
                observed[segment.id] = [left / sx + x for x in pixel_line_margins(crop, sx)]
        for segment in selected:
            if segment.method != "ocr" or (segment.style and segment.style.indent_em is not None):
                continue
            margins = observed[segment.id]
            if not margins:
                continue
            if len(margins) >= 2:
                body = median(margins[1:])
                qualified = all(abs(x - body) <= 1 for x in margins)
            else:
                qualified = _matches_neighbour(segment, selected, observed, state)
            if qualified:
                style = segment.style or Style(id="source-flush")
                updates[segment.id] = segment.model_copy(
                    update={"style": style.model_copy(update={"indent_em": 0.0})}
                )
    return [updates.get(s.id, s) for s in segments]


def _matches_neighbour(
    segment: Segment,
    selected: list[Segment],
    observed: dict[str, list[float]],
    state: AssemblyState,
) -> bool:
    position = state.placements.get(segment.id)
    if position is None:
        return False
    two_columns = any(state.placements.get(s.id, (0, 0, 0))[2] for s in selected)
    for other in selected:
        target = state.placements.get(other.id)
        margins = observed[other.id]
        if other.id == segment.id or target is None or len(margins) < 2:
            continue
        if position[0] != target[0] or position[2] != target[2]:
            continue
        if two_columns and position[1] != target[1]:
            continue
        body = median(margins[1:])
        if all(abs(x - body) <= 1 for x in margins[1:]):
            if abs(observed[segment.id][0] - body) <= 1:
                return True
    return False
