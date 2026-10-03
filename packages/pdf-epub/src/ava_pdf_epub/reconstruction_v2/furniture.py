"""Only repeated marginal text and explicit folios are omitted from the reading stream."""

import re
from collections import Counter
from collections.abc import Iterable
from statistics import median

from ..contracts.profiles import BILINGUAL_PROFILE, LEGACY_PROFILE, ProfileId
from .font_style import glyph_size
from .observations import PageObservation


def furniture_ids(
    pages: Iterable[PageObservation], profile_id: ProfileId = LEGACY_PROFILE
) -> set[str]:
    sightings: Counter[str] = Counter()
    eligible: list[tuple[str, str]] = []
    count = 0
    for page in pages:
        count += 1
        body_sizes = [
            glyph_size(line.glyphs)
            for line in page.lines
            if line.box.y1 > page.height_pt * 0.08 and line.box.y0 < page.height_pt * 0.92
        ]
        body = median(body_sizes) if body_sizes else None
        for line in page.lines:
            if (
                profile_id == BILINGUAL_PROFILE
                and body is not None
                and glyph_size(line.glyphs) >= body * 1.35
            ):
                continue  # Large chapter/title ink is content even near a repeated margin.
            if line.box.y1 > page.height_pt * 0.08 and line.box.y0 < page.height_pt * 0.92:
                continue
            key = re.sub(r"\d+", "#", line.text.strip())
            sightings[key] += 1
            eligible.append((line.id, key))
    repeated = {key for key, count in sightings.items() if count >= max(2, count // 2)}
    folio = re.compile(r"(?:(?:Print\s+)?page\s+)?(?:#|[ivxlcdm]+)", re.IGNORECASE)
    return {ident for ident, key in eligible if key in repeated or folio.fullmatch(key)}
