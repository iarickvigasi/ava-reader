"""Visible raster text routes to recognition; unrelated native prose remains deterministic."""

from pathlib import Path

from PIL import Image

from ..contracts.profiles import BILINGUAL_PROFILE, LEGACY_PROFILE, ProfileId
from ..contracts.source import Box
from .geometry import overlap, rectangle, union
from .observations import PageObservation


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
    if crop.width < 40 or crop.height < 20:
        return False
    small = crop.resize((min(crop.width, 600), min(crop.height, 900)))
    pixels = list(small.tobytes())
    active = [
        sum(v < 150 for v in pixels[y * small.width : (y + 1) * small.width]) / small.width > 0.015
        for y in range(small.height)
    ]
    lengths: list[int] = []
    for is_ink in active:
        if is_ink:
            if not lengths or lengths[-1] < 0:
                lengths.append(1)
            else:
                lengths[-1] += 1
        elif not lengths or lengths[-1] > 0:
            lengths.append(-1)
    stripes = [n for n in lengths if 0 < n < max(12, small.height * 0.09)]
    return len(stripes) >= 3
