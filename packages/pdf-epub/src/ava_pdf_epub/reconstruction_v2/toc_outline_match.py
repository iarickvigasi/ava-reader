"""The complete source row title must agree with one original outline and exact target page."""

from collections.abc import Sequence
from pathlib import Path

from .navigation_alias_key import navigation_alias_key
from .structure_claims import StructureClaim, outline_claims


def toc_outline_match(source: Path, title: str, page: int, ordinal: str = "") -> bool:
    try:
        return toc_claims_match(outline_claims(source), title, page, ordinal)
    except (ValueError, TypeError, KeyError, IndexError):
        return False


def toc_claims_match(
    claims: Sequence[StructureClaim], title: str, page: int, ordinal: str = ""
) -> bool:
    keys = {navigation_alias_key(title)}
    if ordinal and title.startswith(ordinal):
        keys.add(navigation_alias_key(title[len(ordinal) :].lstrip()))
    matches = [claim for claim in claims if navigation_alias_key(claim.title) in keys]
    return len(matches) == 1 and matches[0].pdf_page == page
