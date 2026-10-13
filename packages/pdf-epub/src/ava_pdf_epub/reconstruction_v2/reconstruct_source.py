"""Reobserve immutable source instead of trusting persisted host-supplied glyph/content objects."""

from collections.abc import Sequence
from pathlib import Path

from ..worker_observation import phase
from .prepare_source import prepare_source
from .prepared_types import AnyPreparedPage
from .protocol import AnyReconstructionInput
from .protocol_native_layout import NativeLayoutReconstructionInput
from .protocol_native_structure import NativeStructureReconstructionInput
from .protocol_native_word_wrap import NativeWordWrapReconstructionInput
from .protocol_recognition_geometry import RecognitionGeometryReconstructionInput
from .reconstruct import ReconstructedBook, reconstruct
from .report import ReconstructionReport, reconstruction_report
from .validate_geometry_proofs import validate_geometry_proofs


def reconstruct_source(
    source: Path, scratch: Path, request: AnyReconstructionInput
) -> tuple[ReconstructedBook, ReconstructionReport]:
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
    return reconstruct_from_pages(source, scratch, prepared, request)


def reconstruct_from_pages(
    source: Path,
    scratch: Path,
    prepared: Sequence[AnyPreparedPage],
    request: AnyReconstructionInput,
) -> tuple[ReconstructedBook, ReconstructionReport]:
    """Create final assembly state afresh from unchanged private source checkpoints."""
    with phase("reconstruct"):
        if isinstance(request, RecognitionGeometryReconstructionInput):
            validate_geometry_proofs(prepared, request)
        result = reconstruct(
            source,
            scratch,
            prepared,
            request.responses,
            list(request.refinements),
            source_feature_policy=request.source_feature_policy,
            native_structure_responses=(
                request.native_structure_responses
                if isinstance(
                    request, (NativeStructureReconstructionInput, NativeWordWrapReconstructionInput)
                )
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
            source_normalization_policy=(
                request.source_normalization_policy
                if isinstance(request, NativeWordWrapReconstructionInput)
                else None
            ),
            word_wrap_responses=(
                request.word_wrap_responses
                if isinstance(request, NativeWordWrapReconstructionInput)
                else None
            ),
        )
        return result, reconstruction_report(result, sum(len(p.tasks) for p in prepared))
