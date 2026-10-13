"""Authored physical wraps preserve existing graph text and all its destinations."""

import re

from ava_pdf_epub.contracts.layout_hyphen import candidate_digest
from ava_pdf_epub.reconstruction_v2.layout_hyphen_normalization import normalize_layout_hyphens

from ..reconstruction_v2.layout_hyphen_fixtures import authored_hyphens
from .helpers import block


def normalized_content(content, source_pdf_sha256):
    text = content["text"]
    word = re.search(r"[^\W\d_]{2,}", text)
    cut = word.start() + 1
    source = text[:cut] + "-\n" + text[cut:]
    candidates, dispositions = authored_hyphens(source, [(0, "layout")])
    candidate = candidates[0].model_copy(update={"source_sha256": source_pdf_sha256})
    disposition = dispositions[0].model_copy(
        update={"candidate_sha256": candidate_digest(candidate)}
    )
    result = normalize_layout_hyphens(source, source_pdf_sha256, [candidate], [disposition])
    assert result.text == text
    return {**content, "normalization": result.normalization.model_dump(mode="json")}


def holder(book, identity):
    if identity.startswith("cell-"):
        return next(cell for cell in block(book, "table-one")["cells"] if cell["id"] == identity)
    return block(book, identity)
