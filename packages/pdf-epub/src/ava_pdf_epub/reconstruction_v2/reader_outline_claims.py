"""Read original outline claims from an already-open source reader with the existing bounds."""

from typing import Any

from pypdf import PdfReader

from .structure_claims import StructureClaim


def reader_outline_claims(reader: PdfReader) -> list[StructureClaim]:
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
