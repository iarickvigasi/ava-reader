"""Sparse table pages use an observed size, never an average of title and caption."""

from statistics import median, median_low

from .font_style import glyph_size
from .observations import NativeLine, PageObservation


def table_reference_size(
    page: PageObservation, content: list[NativeLine], furniture: set[str], table_ids: set[str]
) -> float | None:
    prose = [line for line in content if line.id not in furniture]
    tables = [line for line in page.lines if line.id in table_ids and line.id not in furniture]
    if not tables:
        return None
    if len(prose) >= 2:
        return median_low(glyph_size(line.glyphs) for line in prose)
    if prose:
        line = prose[0]
        # A lone ordinary line is not promoted using a smaller table-cell face.
        centered_top = (
            line.box.y1 < page.height_pt * 0.15
            and abs((line.box.x0 + line.box.x1) / 2 - page.width_pt / 2) < 3
            and not line.text.rstrip().endswith((".", "!", "?"))
        )
        if not centered_top:
            return glyph_size(line.glyphs)
    return median(glyph_size(line.glyphs) for line in tables)
