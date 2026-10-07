"""Complete native marginal printer labels are folio evidence, not prose references."""

import re
from collections import Counter
from statistics import median

from .font_style import glyph_size
from .observations import NativeLine, PageObservation

PRINTER_FOLIO = re.compile(
    r"(?:(?P<prefix>[^\W\d_]+(?:[- ]+[^\W\d_]+){0,3})\s+)?"
    r"print\s+page\s+(?P<label>\d{1,5}|[ivxlcdm]{1,12})",
    re.I,
)
REFERENCE_PREFIX = re.compile(
    r"\b(?:see|turn|return|continued|continues|read|please|how|to|on)\b", re.I
)


def printer_folio_labels(page: PageObservation) -> dict[str, str]:
    """Qualify only source-complete small printer ink outside the retained body band."""
    if page.risks:
        return {}
    body_sizes = [
        glyph_size(line.glyphs)
        for line in page.lines
        if line.glyphs
        and line.box.y1 > page.height_pt * 0.08
        and line.box.y0 < page.height_pt * 0.92
    ]
    if not body_sizes:
        return {}
    body_size = median(body_sizes)
    counts = Counter(line.id for line in page.lines)
    labels: dict[str, str] = {}
    for line in page.lines:
        match = PRINTER_FOLIO.fullmatch(line.text.strip())
        if (
            not match
            or REFERENCE_PREFIX.search(match["prefix"] or "")
            or counts[line.id] != 1
            or not (line.box.y1 <= page.height_pt * 0.08 or line.box.y0 >= page.height_pt * 0.92)
            or not complete_printer_ink(line, page, body_size)
        ):
            continue
        labels[line.id] = match["label"]
    return labels


def complete_printer_ink(line: NativeLine, page: PageObservation, body_size: float) -> bool:
    meaningful = [glyph for glyph in line.glyphs if glyph.text.strip()]
    if (
        not meaningful
        or "".join(glyph.text for glyph in line.glyphs) != line.text
        or not line.box.within(page.width_pt, page.height_pt)
        or len({glyph.font for glyph in meaningful}) != 1
        or any(not glyph.font.strip() or not glyph.visible for glyph in meaningful)
        or max(glyph.size for glyph in meaningful) > body_size * 1.1
    ):
        return False
    return all(
        glyph.box.coordinate_space == line.box.coordinate_space == "page_points_top_left"
        and line.box.x0 <= glyph.box.x0 < glyph.box.x1 <= line.box.x1
        and line.box.y0 <= glyph.box.y0 < glyph.box.y1 <= line.box.y1
        for glyph in meaningful
    )
