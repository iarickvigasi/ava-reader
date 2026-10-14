"""Generate a comparison batch from source bytes and unchanged accepted page receipts."""

from collections.abc import Sequence
from pathlib import Path

from ..worker_observation import phase
from .prepare_refinement import prepare_refinement
from .prepare_source import prepare_source
from .prepared_types import AnyPreparedPage
from .protocol import AnyReconstructionInput
from .protocol_frontmatter_title import (
    FrontmatterTitleReconstructionInput,
    FrontmatterTitleRefinementBatch,
)
from .protocol_native_layout import NativeLayoutReconstructionInput
from .protocol_native_structure import NativeStructureReconstructionInput
from .protocol_native_word_wrap import NativeWordWrapReconstructionInput
from .refinement_contract import PrintedTitleRefinementBatch, PrintedTitleTask, RefinementBatch
from .source_segments import source_segments


def prepare_refinement_source(
    source: Path, scratch: Path, request: AnyReconstructionInput
) -> RefinementBatch | PrintedTitleRefinementBatch | FrontmatterTitleRefinementBatch:
    if request.refinements:
        raise ValueError("Comparison preparation cannot consume previous refinement decisions")
    prepared = prepare_source(
        source,
        scratch,
        request.source_sha256,
        request.profile_id,
        source_feature_policy=request.source_feature_policy,
        source_layout_policy=(
            request.source_layout_policy
            if isinstance(
                request,
                (
                    NativeLayoutReconstructionInput,
                    NativeStructureReconstructionInput,
                    NativeWordWrapReconstructionInput,
                ),
            )
            else None
        ),
        source_structure_policy=(
            request.source_structure_policy
            if isinstance(
                request, (NativeStructureReconstructionInput, NativeWordWrapReconstructionInput)
            )
            else None
        ),
        source_normalization_policy=(
            request.source_normalization_policy
            if isinstance(request, NativeWordWrapReconstructionInput)
            else None
        ),
    )
    return prepare_refinement_from_pages(source, scratch, prepared, request)


def prepare_refinement_from_pages(
    source: Path,
    scratch: Path,
    prepared: Sequence[AnyPreparedPage],
    request: AnyReconstructionInput,
) -> RefinementBatch | PrintedTitleRefinementBatch | FrontmatterTitleRefinementBatch:
    """Use private source checkpoints with a newly created refinement assembly state."""
    if request.refinements:
        raise ValueError("Comparison preparation cannot consume previous refinement decisions")
    if isinstance(
        request, (NativeStructureReconstructionInput, NativeWordWrapReconstructionInput)
    ) and any(
        getattr(page, "source_structure_policy", None) != request.source_structure_policy
        for page in prepared
    ):
        raise ValueError("Source checkpoint structure policy differs from captured input")
    with phase("prepare_refinement"):
        _, segments, state = source_segments(
            source,
            scratch,
            prepared,
            request.responses,
            native_structure_responses=(
                request.native_structure_responses
                if isinstance(
                    request, (NativeStructureReconstructionInput, NativeWordWrapReconstructionInput)
                )
                else None
            ),
            source_title_policy=(
                request.source_title_policy
                if isinstance(request, FrontmatterTitleReconstructionInput)
                else None
            ),
            source_layout_policy=(
                request.source_layout_policy
                if isinstance(
                    request,
                    (
                        NativeLayoutReconstructionInput,
                        NativeStructureReconstructionInput,
                        NativeWordWrapReconstructionInput,
                    ),
                )
                else None
            ),
        )
        tasks = prepare_refinement(
            source,
            scratch,
            prepared,
            segments,
            state,
            source_feature_policy=request.source_feature_policy,
            source_title_policy=(
                request.source_title_policy
                if isinstance(request, FrontmatterTitleReconstructionInput)
                else None
            ),
        )
        raw = dict(
            source_sha256=request.source_sha256, tasks=[t.model_dump(mode="json") for t in tasks]
        )
        if isinstance(request, FrontmatterTitleReconstructionInput):
            return FrontmatterTitleRefinementBatch.model_validate(
                dict(
                    schema_version="ava-book-refinement-batch-3",
                    source_title_policy=request.source_title_policy,
                    **raw,
                )
            )
        if any(isinstance(t, PrintedTitleTask) for t in tasks):
            return PrintedTitleRefinementBatch.model_validate(
                dict(schema_version="ava-book-refinement-batch-2", **raw)
            )
        return RefinementBatch.model_validate(
            dict(schema_version="ava-book-refinement-batch-1", **raw)
        )
