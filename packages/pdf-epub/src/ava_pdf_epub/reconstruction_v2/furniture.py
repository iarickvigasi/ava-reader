"""Only repeated marginal text and explicit folios are omitted from the reading stream."""

import re
from collections import Counter
from collections.abc import Iterable
from statistics import median

from ..contracts.profiles import BILINGUAL_PROFILE, LEGACY_PROFILE, ProfileId
from .font_style import glyph_size
from .observations import PageObservation
from .printer_folios import printer_folio_labels


def furniture_ids(
    pages: Iterable[PageObservation], profile_id: ProfileId = LEGACY_PROFILE
) -> set[str]:
    sightings: Counter[str] = Counter()
    eligible: list[tuple[str, str]] = []
    count = 0
    artifacts: dict[tuple[object, ...], list[tuple[int, str]]] = {}
    printer_ids: set[str] = set()
    for page in pages:
        count += 1
        if profile_id == BILINGUAL_PROFILE:
            printer_ids.update(printer_folio_labels(page))
        body_sizes = [
            glyph_size(line.glyphs)
            for line in page.lines
            if line.box.y1 > page.height_pt * 0.08 and line.box.y0 < page.height_pt * 0.92
        ]
        body = median(body_sizes) if body_sizes else None
        for line in page.lines:
            ink = [g for g in line.glyphs if g.text.strip()]
            if (
                ink
                and all(g.source_artifact and g.visible for g in ink)
                and (line.box.y1 <= page.height_pt * 0.08 or line.box.y0 >= page.height_pt * 0.92)
            ):
                artifact_key = (
                    line.text,
                    page.width_pt,
                    page.height_pt,
                    line.box.x0,
                    line.box.y0,
                    line.box.x1,
                    line.box.y1,
                )
                artifacts.setdefault(artifact_key, []).append((page.number, line.id))
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
    source_artifacts = {
        ident
        for sightings in artifacts.values()
        if len(sightings) == len({page for page, _ in sightings}) >= 3
        for _, ident in sightings
    }
    return (
        printer_ids
        | source_artifacts
        | {ident for ident, key in eligible if key in repeated or folio.fullmatch(key)}
    )
