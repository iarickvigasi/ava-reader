"""Recognize a complete author component followed only by finite bibliographic parts."""

import re
from datetime import date

EDITION = re.compile(
    r"(?P<prefix>(?:\w+(?:[-'’]\w+)?\s+){0,3})(?:edition|видання)"
    r"(?:\s+(?P<number>[1-9]\d{0,3}))?",
    re.I,
)
EDITION_QUALIFIERS = {
    "revised",
    "updated",
    "expanded",
    "corrected",
    "new",
    "abridged",
    "unabridged",
    "test",
    "synthetic",
    "оновлене",
    "розширене",
    "перероблене",
    "виправлене",
    "нове",
}
EDITION_ORDINALS = {
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
    "tenth",
    "перше",
    "друге",
    "третє",
    "четверте",
    "п'яте",
    "п’яте",
    "шосте",
    "сьоме",
    "восьме",
}
EDITION_ARABIC_ORDINAL = re.compile(r"(?P<number>[1-9]\d{0,3})(?P<suffix>st|nd|rd|th)", re.I)
EDITION_ROMAN_ORDINAL = re.compile(
    r"(?=[ivxlcdm]+$)m{0,3}(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})",
    re.I,
)
ISO_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


def opening_credit_value(text: str, source_author: str) -> str | None:
    parts = opening_credit_parts(text, source_author)
    return parts["contributor"] if parts is not None else None


def opening_credit_parts(text: str, source_author: str) -> dict[str, str] | None:
    """Retain every validated printed component with its own bibliographic field."""
    parts = [part.strip() for part in text.split("/")]
    if not 1 <= len(parts) <= 3 or any(not part for part in parts):
        return None
    if " ".join(parts[0].split()) != " ".join(source_author.split()):
        return None
    values = {"contributor": parts[0]}
    for part in parts[1:]:
        if printed_edition(part):
            kind = "edition"
        elif ISO_DATE.fullmatch(part):
            try:
                date.fromisoformat(part)
            except ValueError:
                return None
            kind = "date"
        else:
            return None
        if kind in values:
            return None
        values[kind] = part
    return values


def printed_edition(value: str) -> bool:
    """Accept affirmative edition forms; arbitrary prose does not establish an edition."""
    match = EDITION.fullmatch(value)
    if match is None:
        return False
    words = match["prefix"].casefold().split()
    ordinals = [word for word in words if word in EDITION_ORDINALS or numbered_ordinal(word)]
    return (
        len(ordinals) <= 1
        and not (ordinals and match["number"])
        and all(word in EDITION_QUALIFIERS or word in ordinals for word in words)
    )


def numbered_ordinal(word: str) -> bool:
    """Require a valid Arabic suffix or a complete canonical Roman numeral."""
    match = EDITION_ARABIC_ORDINAL.fullmatch(word)
    if match is None:
        return EDITION_ROMAN_ORDINAL.fullmatch(word) is not None
    number = int(match["number"])
    suffix = (
        "th" if 11 <= number % 100 <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(number % 10, "th")
    )
    return match["suffix"].casefold() == suffix
