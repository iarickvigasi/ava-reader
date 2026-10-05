"""Visible raster text routes to recognition; unrelated native prose remains deterministic."""

from pathlib import Path

from PIL import Image

from ..contracts.profiles import BILINGUAL_PROFILE, LEGACY_PROFILE, ProfileId
from ..contracts.source import Box
from .geometry import overlap, rectangle, union
from .observations import PageObservation
from .raster_text import raster_text


def raster_regions(
    page: PageObservation, scratch: Path, profile_id: ProfileId = LEGACY_PROFILE
) -> list[Box]:
    full = rectangle((0, 0, page.width_pt, page.height_pt), page.width_pt, page.height_pt)
    blocking = set(page.risks)
    if profile_id == BILINGUAL_PROFILE:
        # Uncertain language is not unreadable text. Whole-book primary_language still
        # requires source-supported language; foreign/unknown passages retain und tags.
        blocking.discard("language_uncertain")
    if blocking or not page.lines:
        return [full]
    regions = []
    with Image.open(scratch / page.render_path) as source:
        image = source.convert("L")
        for graphic in page.graphics:
            if graphic.kind != "image":
                continue
            if any(overlap(graphic.box, line.box) > 0 for line in page.lines):
                return [full]
            if _textlike(image, graphic.box, page):
                regions.append(graphic.box)
    return [union(regions)] if len(regions) > 20 else regions


def _textlike(image: Image.Image, box: Box, page: PageObservation) -> bool:
    sx, sy = image.width / page.width_pt, image.height / page.height_pt
    crop = image.crop((int(box.x0 * sx), int(box.y0 * sy), int(box.x1 * sx), int(box.y1 * sy)))
    return raster_text(crop)
