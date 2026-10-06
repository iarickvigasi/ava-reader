"""Recognize a complete author component followed only by finite bibliographic parts."""

import re
from datetime import date

EDITION = re.compile(r"(?:\w+(?:[-'’]\w+)?\s+){0,3}(?:edition|видання)(?:\s+\d{1,4})?", re.I)
ISO_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


def opening_credit_value(text: str, source_author: str) -> str | None:
    parts = [part.strip() for part in text.split("/")]
    if not 1 <= len(parts) <= 3 or any(not part for part in parts):
        return None
    if " ".join(parts[0].split()) != " ".join(source_author.split()):
        return None
    kinds = []
    for part in parts[1:]:
        if EDITION.fullmatch(part):
            kinds.append("edition")
        elif ISO_DATE.fullmatch(part):
            try:
                date.fromisoformat(part)
            except ValueError:
                return None
            kinds.append("date")
        else:
            return None
    return parts[0] if len(kinds) == len(set(kinds)) else None
