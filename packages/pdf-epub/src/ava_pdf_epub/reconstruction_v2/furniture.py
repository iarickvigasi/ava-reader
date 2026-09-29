"""Only repeated marginal text and explicit folios are omitted from the reading stream."""

import re
from collections import Counter

from .observations import PageObservation


def furniture_ids(pages: list[PageObservation]) -> set[str]:
    sightings: Counter[str] = Counter()
    eligible: list[tuple[str, str]] = []
    for page in pages:
        for line in page.lines:
            if line.box.y1 > page.height_pt * 0.08 and line.box.y0 < page.height_pt * 0.92:
                continue
            key = re.sub(r"\d+", "#", line.text.strip())
            sightings[key] += 1
            eligible.append((line.id, key))
    repeated = {key for key, count in sightings.items() if count >= max(2, len(pages) // 2)}
    folio = re.compile(r"(?:(?:Print\s+)?page\s+)?(?:#|[ivxlcdm]+)", re.IGNORECASE)
    return {ident for ident, key in eligible if key in repeated or folio.fullmatch(key)}
