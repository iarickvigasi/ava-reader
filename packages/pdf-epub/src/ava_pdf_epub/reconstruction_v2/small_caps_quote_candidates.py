"""Current-only literal ASCII small-cap quotation choices; no case-folded text matching."""

import re
import unicodedata
from typing import Any

from .recognition_anchor_candidates import allowed_quotations


def small_caps_quotations(text: str, span: dict[str, Any]) -> list[str]:
    original = allowed_quotations(text, span)
    if original:
        return original
    quote = span["anchor"]["exact_text"]
    if (span.get("style") or {}).get("small_caps") is not True or not re.fullmatch(
        r"[a-z]{1,16}", quote
    ):
        return []
    alternative = quote.upper()
    at = text.find(alternative)
    while at >= 0:
        end = at + len(alternative)
        if whole_token_range(text, at, end):
            return [alternative]
        at = text.find(alternative, at + 1)
    return []


def whole_token_range(text: str, start: int, end: int) -> bool:
    return (start == 0 or not _word_char(text[start - 1])) and (
        end == len(text) or not _word_char(text[end])
    )


def _word_char(char: str) -> bool:
    return (
        char.isalnum()
        or unicodedata.category(char).startswith("M")
        or unicodedata.category(char) in {"Pc", "Cf"}
    )
