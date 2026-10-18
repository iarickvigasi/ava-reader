"""Original caller rectangles still select whole, uniquely mapped source glyphs."""

from ..contracts.source import Box
from .assembly_state import AssemblyState
from .geometry import area, overlap
from .glyph_caller_ranges import glyph_caller_ranges
from .prepared_types import AnyPreparedPage
from .projected_index_maps import projected_index_maps
from .segments import Segment


def projected_index_ranges(
    checkpoint: AnyPreparedPage, owners: list[Segment], caller: Box, state: AssemblyState
) -> list[tuple[str, int, int]] | None:
    page = checkpoint.observation
    maps = projected_index_maps(checkpoint, owners, state)
    if not maps:
        return None
    touched = [
        (line.id, i, g)
        for line in page.lines
        for i, g in enumerate(line.glyphs)
        if g.text.strip() and (area(g.box) <= 0 or overlap(g.box, caller) / area(g.box) > 0.05)
    ]
    if not touched or len(touched) > 20000:
        return None
    return glyph_caller_ranges(touched, list(maps.values()), caller)
