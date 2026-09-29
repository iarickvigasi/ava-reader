"""Bound and reobserve an immutable complete source for comparison or final reconstruction."""

import hashlib
from pathlib import Path

from pypdf import PdfReader

from .prepare_page import prepare_page
from .prepared import PreparedPage


def prepare_source(source: Path, scratch: Path, source_sha256: str) -> list[PreparedPage]:
    if (
        source.stat().st_size > 52428800
        or hashlib.sha256(source.read_bytes()).hexdigest() != source_sha256
    ):
        raise ValueError("Reconstruction source identity differs")
    count = len(PdfReader(source).pages)
    if not 1 <= count <= 500:
        raise ValueError("Source page bound exceeded")
    return [prepare_page(source, scratch, number) for number in range(1, count + 1)]
