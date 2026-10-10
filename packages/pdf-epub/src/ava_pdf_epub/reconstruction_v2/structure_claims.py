"""Read bounded printed contents and PDF outline claims without treating them as instructions."""

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pypdf import PdfReader

from .segments import Segment


@dataclass(frozen=True)
class StructureClaim:
    title: str
    source_id: str | None
    printed_page: str | None = None
    pdf_page: int | None = None
    depth: int | None = None


def title_key(text: str) -> str:
    return " ".join(text.split()).casefold()


def printed_contents(segments: list[Segment]) -> list[StructureClaim]:
    starts = [s.page for s in segments if title_key(s.text) in {"contents", "table of contents"}]
    claims: list[StructureClaim] = []
    for segment in segments:
        if not any(start <= segment.page <= start + 4 for start in starts):
            continue
        for line in (segment.source_text or segment.text).splitlines():
            match = re.fullmatch(r"\s*(.+?)\s*\.{2,}\s*(\d+|[ivxlcdmIVXLCDM]+)\s*", line)
            if match:
                claims.append(StructureClaim(match[1], segment.id, printed_page=match[2]))
    if starts and not claims:
        raise ValueError("Printed contents cannot be resolved from source structure")
    return claims


def outline_claims(source: Path) -> list[StructureClaim]:
    reader = PdfReader(source)
    claims: list[StructureClaim] = []

    def visit(items: list[Any], depth: int) -> None:
        if depth > 5:
            raise ValueError("Source outline nesting requires review")
        for item in items:
            if isinstance(item, list):
                visit(item, depth + 1)
            else:
                if len(claims) >= 10000:
                    raise ValueError("Source outline item bound exceeded")
                page = reader.get_destination_page_number(item)
                if page is None or page < 0:
                    raise ValueError("Source outline has unresolved destination")
                claims.append(StructureClaim(str(item.title), None, pdf_page=page + 1, depth=depth))

    visit(reader.outline, 0)
    return claims
