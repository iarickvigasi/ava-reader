"""Read bounded printed contents and PDF outline claims without treating them as instructions."""

import re
from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader

from .segments import Segment


@dataclass(frozen=True)
class StructureClaim:
    title: str
    source_id: str | None
    printed_page: str | None = None
    pdf_page: int | None = None
    depth: int | None = None
    source_offset: int | None = None


def title_key(text: str) -> str:
    return " ".join(text.split()).casefold()


def printed_contents(
    segments: list[Segment], qualified_rows: list[StructureClaim] | None = None
) -> list[StructureClaim]:
    starts = [s.page for s in segments if title_key(s.text) in {"contents", "table of contents"}]
    claims: list[StructureClaim] = []
    for segment in segments:
        if not any(start <= segment.page <= start + 4 for start in starts):
            continue
        for line in (segment.source_text or segment.text).splitlines():
            match = re.fullmatch(r"\s*(.+?)\s*\.{2,}\s*(\d+|[ivxlcdmIVXLCDM]+)\s*", line)
            if match:
                claims.append(StructureClaim(match[1], segment.id, printed_page=match[2]))
    claims.extend(qualified_rows or [])
    if starts and not claims:
        raise ValueError("Printed contents cannot be resolved from source structure")
    return claims


def outline_claims(source: Path) -> list[StructureClaim]:
    from .reader_outline_claims import reader_outline_claims

    return reader_outline_claims(PdfReader(source))
