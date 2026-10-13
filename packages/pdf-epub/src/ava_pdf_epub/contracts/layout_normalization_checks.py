"""Every version2 transformation consumes exactly its source-bound declaration."""

import re
import unicodedata
from typing import TYPE_CHECKING

from .layout_wrap import compound_wrap

if TYPE_CHECKING:
    from .layout_normalization import LayoutNormalizationMap


def validate_layout_normalization(mapping: "LayoutNormalizationMap", text: str) -> None:
    from .normalization import LIGATURES

    candidates = {c.id: c for c in mapping.candidates}
    decisions = {d.candidate_id: d.disposition for d in mapping.dispositions}
    used: set[str] = set()
    source_end = canonical_end = 0
    for item in mapping.segments:
        if item.source_start != source_end or item.canonical_start != canonical_end:
            raise ValueError("Normalization segments must cover contiguous ranges")
        if not item.source_start < item.source_end <= len(mapping.source_text):
            raise ValueError("Normalization source range outside text")
        if not 0 <= item.canonical_start <= item.canonical_end <= len(text):
            raise ValueError("Normalization canonical range outside text")
        source = mapping.source_text[item.source_start : item.source_end]
        deleted = item.canonical_start == item.canonical_end
        if item.candidate_id is not None:
            candidate = candidates.get(item.candidate_id)
            if candidate is None or candidate.id in used:
                raise ValueError("Unknown or repeated normalization candidate")
            disposition = decisions[candidate.id]
            start = candidate.source_start + (disposition == "literal")
            kind = "line_wrap" if disposition == "literal" else "layout_hyphen"
            if (
                not deleted
                or item.kind != kind
                or (item.source_start, item.source_end) != (start, candidate.source_end)
            ):
                raise ValueError("Normalization differs from its exact layout-hyphen decision")
            used.add(candidate.id)
        elif item.kind == "layout_hyphen":
            raise ValueError("Layout-hyphen normalization requires its source-bound decision")
        if item.kind == "layout_hyphen":
            source = ""
        elif item.kind == "line_wrap":
            if deleted:
                if item.candidate_id is None and not compound_wrap(
                    mapping.source_text, item.source_start, item.source_end
                ):
                    raise ValueError("Deleted line wrap is not retained compound layout whitespace")
                source = ""
            else:
                source = re.sub(r"[ \t]*(?:\r\n|\r|\n)[ \t]*", " ", source)
        elif item.kind == "nfc":
            source = unicodedata.normalize("NFC", source)
        elif item.kind == "ligature":
            source = source.translate(LIGATURES)
        if not source and not deleted:
            raise ValueError("Normalization canonical range outside text")
        if source != text[item.canonical_start : item.canonical_end]:
            raise ValueError("Declared normalization does not produce canonical text")
        source_end, canonical_end = item.source_end, item.canonical_end
    if source_end != len(mapping.source_text) or canonical_end != len(text):
        raise ValueError("Normalization does not account for all text")
    if used != set(candidates):
        raise ValueError("Normalization does not consume every layout-hyphen decision")
