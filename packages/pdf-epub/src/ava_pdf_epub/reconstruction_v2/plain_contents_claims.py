"""Plain OCR contents rows need independent exact outline, folio and opening authority."""

import re

from .navigation_alias_key import navigation_alias_key
from .segments import Segment
from .source_outline_aliases import known_frontmatter_bookmark
from .structure_claims import StructureClaim, title_key

_ROW = re.compile(r"(?P<title>.+?)\s+(?P<folio>\d{1,4}|[ivxlcdmIVXLCDM]{1,10})\s*$", re.S)
_HEADERS = {"contents", "table of contents", "зміст"}


def plain_contents_claims(
    segments: list[Segment], outline: list[StructureClaim], folios: dict[str, int]
) -> list[StructureClaim]:
    starts = [s.page for s in segments if title_key(s.text) in _HEADERS]
    claims = []
    identities: set[tuple[str, int]] = set()
    for segment in segments:
        if (
            segment.method != "ocr"
            or segment.kind != "paragraph"
            or re.search(r"\.{2,}", segment.text)
        ):
            continue
        start = next((n for n in starts if n <= segment.page <= n + 4), None)
        if start is None or any(
            s.chapter_start and s.page > start and s.page <= segment.page for s in segments
        ):
            continue
        first_body = min(
            (
                claim.pdf_page
                for claim in outline
                if claim.pdf_page is not None
                and claim.pdf_page > start
                and not known_frontmatter_bookmark(claim.title)
            ),
            default=start + 5,
        )
        if segment.page >= first_body:
            continue
        row = _ROW.fullmatch(segment.text)
        if row is None:
            continue
        label = row["title"].rstrip()
        matches = [
            c for c in outline if navigation_alias_key(c.title) == navigation_alias_key(label)
        ]
        page = folios.get(row["folio"].casefold())
        if len(matches) != 1 or page is None or matches[0].pdf_page != page:
            raise ValueError("Plain contents row lacks unique exact outline/printed-page agreement")
        key = (title_key(label), page)
        if key in identities:
            raise ValueError("Repeated plain contents source row")
        identities.add(key)
        claims.append(
            StructureClaim(
                label, segment.id, printed_page=row["folio"], source_offset=row.start("title")
            )
        )
    return claims
