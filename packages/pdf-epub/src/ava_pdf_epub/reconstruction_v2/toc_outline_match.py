"""The complete source row title must agree with one original outline and exact target page."""

from pathlib import Path

from .navigation_alias_key import navigation_alias_key
from .structure_claims import outline_claims


def toc_outline_match(source: Path, title: str, page: int, ordinal: str = "") -> bool:
    keys = {navigation_alias_key(title)}
    if ordinal and title.startswith(ordinal):
        keys.add(navigation_alias_key(title[len(ordinal) :].lstrip()))
    try:
        matches = [
            claim for claim in outline_claims(source) if navigation_alias_key(claim.title) in keys
        ]
    except (ValueError, TypeError, KeyError, IndexError):
        return False
    return len(matches) == 1 and matches[0].pdf_page == page
