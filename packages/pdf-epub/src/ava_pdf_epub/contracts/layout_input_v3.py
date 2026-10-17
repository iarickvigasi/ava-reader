"""Reconstruct an exact pre-normalization input using the unchanged Map1 transforms."""

import re
import unicodedata

from .common import text_digest
from .normalization import LIGATURES, NormalizationMap, NormalizationSegment


def layout_input_text(source: str, segments: list[NormalizationSegment]) -> str:
    pieces = []
    for item in segments:
        value = source[item.source_start : item.source_end]
        if item.kind == "nfc":
            value = unicodedata.normalize("NFC", value)
        elif item.kind == "ligature":
            value = value.translate(LIGATURES)
        elif item.kind == "line_wrap":
            value = (
                ""
                if item.canonical_start == item.canonical_end
                else re.sub(r"[ \t]*(?:\r\n|\r|\n)[ \t]*", " ", value)
            )
        pieces.append(value)
    text = "".join(pieces)
    mapping = NormalizationMap(
        source_text=source, source_sha256=text_digest(source), segments=segments
    )
    mapping.validate_canonical(text)
    return text
