"""Generate a comparison batch from source bytes and unchanged accepted page receipts."""

from pathlib import Path

from .prepare_refinement import prepare_refinement
from .prepare_source import prepare_source
from .protocol import ReconstructionInput
from .refinement_contract import RefinementBatch
from .source_segments import source_segments


def prepare_refinement_source(
    source: Path, scratch: Path, request: ReconstructionInput
) -> RefinementBatch:
    if request.refinements:
        raise ValueError("Comparison preparation cannot consume previous refinement decisions")
    prepared = prepare_source(source, scratch, request.source_sha256, request.profile_id)
    _, segments, state = source_segments(source, scratch, prepared, request.responses)
    return RefinementBatch(
        schema_version="ava-book-refinement-batch-1",
        source_sha256=request.source_sha256,
        tasks=prepare_refinement(source, scratch, prepared, segments, state),
    )
