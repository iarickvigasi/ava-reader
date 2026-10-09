"""Reobserve immutable source instead of trusting persisted host-supplied glyph/content objects."""

from pathlib import Path

from ..worker_observation import phase
from .prepare_source import prepare_source
from .protocol import ReconstructionInput
from .reconstruct import ReconstructedBook, reconstruct
from .report import ReconstructionReport, reconstruction_report


def reconstruct_source(
    source: Path, scratch: Path, request: ReconstructionInput
) -> tuple[ReconstructedBook, ReconstructionReport]:
    prepared = prepare_source(source, scratch, request.source_sha256, request.profile_id)
    with phase("reconstruct"):
        result = reconstruct(
            source,
            scratch,
            prepared,
            request.responses,
            request.refinements,
            source_feature_policy=request.source_feature_policy,
        )
        return result, reconstruction_report(result, sum(len(p.tasks) for p in prepared))
