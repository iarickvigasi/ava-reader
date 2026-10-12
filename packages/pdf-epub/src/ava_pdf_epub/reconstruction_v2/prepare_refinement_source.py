"""Generate a comparison batch from source bytes and unchanged accepted page receipts."""

from collections.abc import Sequence
from pathlib import Path

from ..worker_observation import phase
from .prepare_refinement import prepare_refinement
from .prepare_source import prepare_source
from .prepared import PreparedPage
from .protocol import PrintedTitleReconstructionInput, ReconstructionInput
from .refinement_contract import PrintedTitleRefinementBatch, PrintedTitleTask, RefinementBatch
from .source_segments import source_segments


def prepare_refinement_source(
    source: Path, scratch: Path, request: ReconstructionInput | PrintedTitleReconstructionInput
) -> RefinementBatch | PrintedTitleRefinementBatch:
    if request.refinements:
        raise ValueError("Comparison preparation cannot consume previous refinement decisions")
    prepared = prepare_source(
        source,
        scratch,
        request.source_sha256,
        request.profile_id,
        source_feature_policy=request.source_feature_policy,
    )
    return prepare_refinement_from_pages(source, scratch, prepared, request)


def prepare_refinement_from_pages(
    source: Path,
    scratch: Path,
    prepared: Sequence[PreparedPage],
    request: ReconstructionInput | PrintedTitleReconstructionInput,
) -> RefinementBatch | PrintedTitleRefinementBatch:
    """Use private source checkpoints with a newly created refinement assembly state."""
    if request.refinements:
        raise ValueError("Comparison preparation cannot consume previous refinement decisions")
    with phase("prepare_refinement"):
        _, segments, state = source_segments(source, scratch, prepared, request.responses)
        tasks = prepare_refinement(
            source,
            scratch,
            prepared,
            segments,
            state,
            source_feature_policy=request.source_feature_policy,
        )
        raw = dict(
            source_sha256=request.source_sha256, tasks=[t.model_dump(mode="json") for t in tasks]
        )
        if any(isinstance(t, PrintedTitleTask) for t in tasks):
            return PrintedTitleRefinementBatch.model_validate(
                dict(schema_version="ava-book-refinement-batch-2", **raw)
            )
        return RefinementBatch.model_validate(
            dict(schema_version="ava-book-refinement-batch-1", **raw)
        )
