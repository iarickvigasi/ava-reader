"""Checksummed printed identifiers; ambiguous edition records remain source candidates."""

import re
from typing import Any

from .printed_claim import printed_claim

SEPARATORS = str.maketrans(
    {
        "\u00a0": " ",
        "\u202f": " ",
        "\u2010": "-",
        "\u2011": "-",
        "\u2012": "-",
        "\u2013": "-",
        "\u2212": "-",
    }
)
# Short edition/format descriptors preserve existing labels without scanning narrative sentences.
LABEL = re.compile(
    r"\b(?:printed\s+)?ISBN(?:-1[03])?"
    r"(?:\s*\([A-Za-z][A-Za-z -]{0,28}\)|"
    r"(?-i:(?:[ \t]+[A-Za-z][A-Za-z-]{0,13}){1,2}))?\s*:?\s*",
    re.I,
)
# Whitespace and one optional group hyphen may wrap in the printed source.
GROUP_SEPARATOR = r"[ \t\r\n]*(?:-[ \t\r\n]*)?"
NUMBER = re.compile(
    rf"(?=(?<!\w)(?P<number>97[89](?:{GROUP_SEPARATOR}[0-9]){{10}}|"
    rf"[0-9](?:{GROUP_SEPARATOR}[0-9]){{8}}{GROUP_SEPARATOR}[0-9Xx])(?!\w))"
)

YEAR = re.compile(r"(?<!\w)(?:1[5-9][0-9]{2}|20[0-9]{2}|21[0-9]{2})$")


def valid_isbn(raw: str) -> str | None:
    value = re.sub(r"[ \t\r\n-]", "", raw.translate(SEPARATORS)).upper()
    if len(value) == 10 and re.fullmatch(r"[0-9]{9}[0-9X]", value):
        total = sum((10 - index) * (10 if ch == "X" else int(ch)) for index, ch in enumerate(value))
        return value if total % 11 == 0 else None
    if len(value) == 13 and re.fullmatch(r"97[89][0-9]{10}", value):
        total = sum(int(ch) * (1 if index % 2 == 0 else 3) for index, ch in enumerate(value))
        return value if total % 10 == 0 else None
    return None


def _tail_valid(text: str, end: int) -> bool:
    tail = text[end:]
    if re.match(r"-[ \t\r\n]*[0-9Xx]", tail):
        return False
    numeric = re.match(r"[ \t\r\n]+([0-9Xx-]+)", tail)
    if numeric:
        if not YEAR.fullmatch(numeric[1]):
            return False
        if re.match(r"[ \t\r\n-]+[0-9Xx]", tail[numeric.end() :]):
            return False
    return True


def explicit_isbns(text: str) -> list[str]:
    normalized = text.translate(SEPARATORS)
    result = []
    for label in LABEL.finditer(normalized):
        remaining = normalized[label.end() :]
        match = NUMBER.match(remaining)
        if match and _tail_valid(remaining, match.end("number")):
            value = valid_isbn(match["number"])
            if value and value not in result:
                result.append(value)
    return result


def identifier_claims(
    block: dict[str, Any], labelled_status: str, bare_eligible: bool
) -> list[dict[str, Any]]:
    text = block["content"]["text"]
    normalized = text.translate(SEPARATORS)
    explicit = explicit_isbns(text)
    if LABEL.search(normalized):
        return [
            dict(
                printed_claim("identifier", value, block, labelled_status), identifier_scheme="isbn"
            )
            for value in explicit
        ]
    if not bare_eligible or len(text) > 200 or len(text.split()) > 24 or ":" in text:
        return []
    matches = [
        m
        for m in NUMBER.finditer(normalized)
        if valid_isbn(m["number"]) and _tail_valid(normalized, m.end("number"))
    ]
    # A hyphenated ISBN13 can contain a checksummed ISBN10 suffix; it is one maximal token.
    matches = [
        m
        for m in matches
        if not any(
            other.start("number") < m.start("number") and m.end("number") <= other.end("number")
            for other in matches
        )
    ]
    # A terminal standalone number or adjacent year makes a bounded record, not edition authority.
    if len(matches) != 1:
        return []
    match = matches[0]
    if normalized[match.end("number") :].strip(" ;/."):
        return []
    prefix = normalized[: match.start("number")].rstrip()
    year = YEAR.search(prefix)
    if prefix and year is None:
        return []
    value = valid_isbn(match["number"])
    assert value is not None
    claims = [
        dict(printed_claim("identifier", value, block, "candidate"), identifier_scheme="isbn")
    ]
    if year is not None and prefix[: year.start()].strip():
        claims.append(printed_claim("date", year[0], block, "candidate"))
    return claims
