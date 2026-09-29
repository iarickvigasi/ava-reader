"""Reobserve immutable source instead of trusting persisted host-supplied glyph/content objects."""

import hashlib
from pathlib import Path

from pypdf import PdfReader

from .prepare_page import prepare_page
from .protocol import ReconstructionInput
from .reconstruct import ReconstructedBook, reconstruct
from .report import ReconstructionReport, reconstruction_report


def reconstruct_source(
    source: Path, scratch: Path, request: ReconstructionInput
) -> tuple[ReconstructedBook, ReconstructionReport]:
    if (
        source.stat().st_size > 52428800
        or hashlib.sha256(source.read_bytes()).hexdigest() != request.source_sha256
    ):
        raise ValueError("Reconstruction source identity differs")
    count = len(PdfReader(source).pages)
    if not 1 <= count <= 500:
        raise ValueError("Source page bound exceeded")
    prepared = [prepare_page(source, scratch, number) for number in range(1, count + 1)]
    result = reconstruct(source, scratch, prepared, request.responses)
    return result, reconstruction_report(result, sum(len(p.tasks) for p in prepared))
