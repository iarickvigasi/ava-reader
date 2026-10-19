"""Shared declared transformation checks; each version supplies its own closed authority."""

import re
import unicodedata

from .layout_normalization import LayoutNormalizationSegment
from .layout_wrap import compound_wrap


def validate_layout_segments(
    source_text: str,
    text: str,
    segments: list[LayoutNormalizationSegment],
    decisions: dict[str, tuple[int, int, str]],
) -> None:
    from .normalization import LIGATURES

    used: set[str] = set()
    source_end = canonical_end = 0
    for item in segments:
        if item.source_start != source_end or item.canonical_start != canonical_end:
            raise ValueError("Normalization segments must cover contiguous ranges")
        if not item.source_start < item.source_end <= len(source_text):
            raise ValueError("Normalization source range outside text")
        if not 0 <= item.canonical_start <= item.canonical_end <= len(text):
            raise ValueError("Normalization canonical range outside text")
        source = source_text[item.source_start : item.source_end]
        deleted = item.canonical_start == item.canonical_end
        if item.candidate_id is not None:
            expected = decisions.get(item.candidate_id)
            if expected is None or item.candidate_id in used:
                raise ValueError("Unknown or repeated normalization candidate")
            start, end, kind = expected
            if (
                not deleted
                or item.kind != kind
                or (item.source_start, item.source_end) != (start, end)
            ):
                raise ValueError("Normalization differs from its exact layout-hyphen decision")
            used.add(item.candidate_id)
        elif item.kind == "layout_hyphen":
            raise ValueError("Layout-hyphen normalization requires its source-bound decision")
        if item.kind == "layout_hyphen":
            source = ""
        elif item.kind == "line_wrap":
            if deleted:
                if item.candidate_id is None and not compound_wrap(
                    source_text, item.source_start, item.source_end
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
    if source_end != len(source_text) or canonical_end != len(text):
        raise ValueError("Normalization does not account for all text")
    if used != set(decisions):
        raise ValueError("Normalization does not consume every layout-hyphen decision")
