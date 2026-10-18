"""Untrusted physical rows assist image transcription without granting native authority."""

import json
from typing import Any

from ..contracts.profiles import ProfileId
from .index_layout import INDEX_LAYOUT_RISK, TITLE
from .index_source_rows import index_source_rows
from .native_line_visibility import complete_visible_line
from .observations import PageObservation

MAX_CANDIDATE_CHARACTERS = 100000
_ALLOWED_RISKS = {INDEX_LAYOUT_RISK, "native_spacing_unresolved", "language_uncertain"}


def index_transcription_candidates(page: PageObservation, profile: ProfileId) -> dict[str, Any]:
    if (
        INDEX_LAYOUT_RISK not in page.risks
        or set(page.risks) - _ALLOWED_RISKS
        or page.rotation
        or page.graphics
        or page.required_regions
        or any(
            not line.glyphs
            or not complete_visible_line(line)
            or any(g.source_artifact for g in line.glyphs)
            for line in page.lines
        )
    ):
        return {}
    rows = index_source_rows(page, profile)
    if rows is None:
        return {}
    headers = [
        line
        for line in page.lines
        if line.box.y0 < page.height_pt / 4 and TITLE.fullmatch(" ".join(line.text.split()))
    ]
    if len(headers) != 1:
        return {}
    claimed = [(r.line.id, i) for r in rows for i, _ in r.values]
    claimed += [(headers[0].id, i) for i, g in enumerate(headers[0].glyphs) if g.text.strip()]
    original = {
        (line.id, i) for line in page.lines for i, g in enumerate(line.glyphs) if g.text.strip()
    }
    if len(claimed) != len(set(claimed)) or set(claimed) != original:
        return {}  # Even furniture cannot disappear from this optional candidate view.
    candidate = {
        "basis": "unverified_pdf_text",
        "scope": "physical_rows_not_logical_entries",
        "header": headers[0].text,
        "columns": [[r.text for r in rows if r.column == column] for column in (0, 1)],
    }
    if len(json.dumps(candidate, ensure_ascii=False)) > MAX_CANDIDATE_CHARACTERS:
        return {}
    return {"untrusted_index_candidates": candidate}
