"""Replay complete sparse receipts against a freshly assembled immutable source."""

from collections.abc import Sequence
from pathlib import Path

from .native_layout_policy import NativeLayoutPolicy
from .native_structure_versions import AnyNativeStructureResponse
from .native_word_wrap_policy import NativeWordWrapPolicy
from .prepared_native_structure_v2 import NativeStructure2PreparedPage
from .prepared_types import AnyPreparedPage
from .printed_title_v2_contract import FrontmatterTitleResponse
from .protocol_frontmatter_title import FrontmatterTitleReconstructionInput
from .protocol_native_structure_v2 import NativeStructure2ReconstructionInput
from .protocol_native_word_wrap import NativeWordWrapReconstructionInput
from .recognition_contract import RecognitionResponse
from .refinement_contract import AnyRefinementResponse
from .word_wrap_apply import apply_word_wrap
from .word_wrap_assembly import WordWrapAssembly
from .word_wrap_contract import WordWrapResponse
from .word_wrap_prepare import prepare_word_wrap_from_pages
from .word_wrap_projections import project_word_wrap_positions


def reconstruct_word_wrap_assembly(
    source: Path,
    scratch: Path,
    prepared: Sequence[AnyPreparedPage],
    responses: list[RecognitionResponse],
    refinements: list[AnyRefinementResponse | FrontmatterTitleResponse] | None,
    native_structure_responses: Sequence[AnyNativeStructureResponse] | None,
    source_layout_policy: NativeLayoutPolicy | None,
    source_normalization_policy: NativeWordWrapPolicy,
    word_wrap_responses: list[WordWrapResponse] | None,
    *,
    source_title_policy: str | None = None,
    source_continuation_policy: str | None = None,
) -> WordWrapAssembly:
    if refinements is None or native_structure_responses is None or word_wrap_responses is None:
        raise ValueError("Sparse lexical reconstruction requires all complete receipt arrays")
    if source_layout_policy is None:
        raise ValueError("Sparse lexical reconstruction requires captured native layout")
    native2 = isinstance(prepared[0], NativeStructure2PreparedPage)
    if native2 and source_title_policy is None:
        raise ValueError("Native2 reconstruction requires captured complete-title authority")
    raw = dict(
        schema_version="ava-reconstruct-input-5",
        source_sha256=prepared[0].source_sha256,
        profile_id=prepared[0].profile_id,
        source_feature_policy="ava-ocr-source-features-1",
        source_layout_policy=source_layout_policy,
        source_structure_policy="ava-native-structure-2" if native2 else "ava-native-structure-1",
        source_normalization_policy=source_normalization_policy,
        responses=responses,
        native_structure_responses=native_structure_responses,
        refinements=refinements,
        word_wrap_responses=[],
    )
    request: NativeWordWrapReconstructionInput
    if source_title_policy is not None:
        raw.update(
            schema_version="ava-reconstruct-input-8" if native2 else "ava-reconstruct-input-7",
            source_title_policy=source_title_policy,
            recognition_repair_policy="ava-recognition-geometry-repair-1",
            geometry_corrections=[],
        )
    if source_continuation_policy is not None:
        from .protocol_continuation import ContinuationReconstructionInput

        raw.update(
            schema_version="ava-reconstruct-input-10",
            source_continuation_policy=source_continuation_policy,
            recognition_repair_policy="ava-recognition-geometry-repair-2",
        )
        request = ContinuationReconstructionInput.model_validate(raw)
    elif source_title_policy is not None:
        request = (
            NativeStructure2ReconstructionInput.model_validate(raw)
            if native2
            else FrontmatterTitleReconstructionInput.model_validate(raw)
        )
    else:
        request = NativeWordWrapReconstructionInput.model_validate(raw)
    batch, assembly, owners = prepare_word_wrap_from_pages(source, scratch, prepared, request)
    changes = apply_word_wrap(assembly, owners, batch, word_wrap_responses)
    project_word_wrap_positions(assembly, changes)
    return assembly
