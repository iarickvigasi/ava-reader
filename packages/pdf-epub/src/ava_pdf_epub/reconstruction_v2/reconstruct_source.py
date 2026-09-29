"""Reobserve immutable source instead of trusting persisted host-supplied glyph/content objects."""

from pathlib import Path

from .prepare_source import prepare_source
from .protocol import ReconstructionInput
from .reconstruct import ReconstructedBook, reconstruct
from .report import ReconstructionReport, reconstruction_report


def reconstruct_source(
    source: Path, scratch: Path, request: ReconstructionInput
) -> tuple[ReconstructedBook, ReconstructionReport]:
    prepared = prepare_source(source, scratch, request.source_sha256)
    result = reconstruct(source, scratch, prepared, request.responses, request.refinements)
    return result, reconstruction_report(result, sum(len(p.tasks) for p in prepared))
