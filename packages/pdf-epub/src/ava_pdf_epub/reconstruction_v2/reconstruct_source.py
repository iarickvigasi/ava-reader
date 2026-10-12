"""Reobserve immutable source instead of trusting persisted host-supplied glyph/content objects."""

from collections.abc import Sequence
from pathlib import Path

from ..worker_observation import phase
from .prepare_source import prepare_source
from .prepared import PreparedPage
from .protocol import AnyReconstructionInput
from .reconstruct import ReconstructedBook, reconstruct
from .report import ReconstructionReport, reconstruction_report


def reconstruct_source(
    source: Path, scratch: Path, request: AnyReconstructionInput
) -> tuple[ReconstructedBook, ReconstructionReport]:
    prepared = prepare_source(
        source,
        scratch,
        request.source_sha256,
        request.profile_id,
        source_feature_policy=request.source_feature_policy,
    )
    return reconstruct_from_pages(source, scratch, prepared, request)


def reconstruct_from_pages(
    source: Path, scratch: Path, prepared: Sequence[PreparedPage], request: AnyReconstructionInput
) -> tuple[ReconstructedBook, ReconstructionReport]:
    """Create final assembly state afresh from unchanged private source checkpoints."""
    with phase("reconstruct"):
        result = reconstruct(
            source,
            scratch,
            prepared,
            request.responses,
            list(request.refinements),
            source_feature_policy=request.source_feature_policy,
        )
        return result, reconstruction_report(result, sum(len(p.tasks) for p in prepared))
