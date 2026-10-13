"""Recreate the final-owner catalogue from unchanged source and validated prior receipts."""

from collections.abc import Sequence
from pathlib import Path

from ..contracts.normalization import NormalizationMap
from ..contracts.source import SourcePage
from .book_language import primary_language
from .normalization_map import line_wrap_map
from .prepared_native_word_wrap import NativeWordWrapPreparedPage
from .prepared_types import AnyPreparedPage
from .protocol_native_word_wrap import NativeWordWrapReconstructionInput
from .refinement_digest import observation_digest
from .word_wrap_assembly import WordWrapAssembly, word_wrap_assembly
from .word_wrap_catalogue import prepare_word_wrap_catalogue
from .word_wrap_contract import WordWrapBatch
from .word_wrap_owners import catalogue_owners
from .word_wrap_source_contract import WordWrapOwner


def prepare_word_wrap_source(
    source: Path,
    scratch: Path,
    request: NativeWordWrapReconstructionInput,
) -> WordWrapBatch:
    from .prepare_source import prepare_source

    pages = prepare_source(
        source,
        scratch,
        request.source_sha256,
        request.profile_id,
        source_feature_policy=request.source_feature_policy,
        source_layout_policy=request.source_layout_policy,
        source_structure_policy=request.source_structure_policy,
        source_normalization_policy=request.source_normalization_policy,
    )
    batch, _, _ = prepare_word_wrap_from_pages(source, scratch, pages, request)
    return batch


def prepare_word_wrap_from_pages(
    source: Path,
    scratch: Path,
    pages: Sequence[AnyPreparedPage],
    request: NativeWordWrapReconstructionInput,
) -> tuple[WordWrapBatch, WordWrapAssembly, list[WordWrapOwner]]:
    if request.word_wrap_responses:
        raise ValueError("Sparse comparison preparation cannot consume prior sparse decisions")
    if not pages or any(
        not isinstance(page, NativeWordWrapPreparedPage)
        or page.source_sha256 != request.source_sha256
        or page.profile_id != request.profile_id
        or page.source_normalization_policy != request.source_normalization_policy
        for page in pages
    ):
        raise ValueError("Sparse comparison requires captured source checkpoints")
    assembly = word_wrap_assembly(
        source,
        scratch,
        pages,
        request.responses,
        list(request.refinements),
        request.native_structure_responses,
        request.source_layout_policy,
    )
    language, _ = primary_language(pages, request.responses, request.native_structure_responses)
    owners = catalogue_owners(
        assembly.segments,
        [p.observation for p in pages],
        [SourcePage.model_validate(p) for p in assembly.pages],
        assembly.state.source_prefix_cuts,
        language,
        components=assembly.size_sources,
        aliases=assembly.state.aliases,
    )
    segment_by_id = {segment.id: segment for segment in assembly.segments}
    for owner in owners:
        segment = segment_by_id[owner.id]
        base = NormalizationMap.model_validate(line_wrap_map(owner.source_text, segment.text))
        base.validate_canonical(segment.text)
    batch = prepare_word_wrap_catalogue(
        owners,
        [p.observation for p in pages],
        source_sha256=request.source_sha256,
        profile_id=request.profile_id,
        observation_sha256=observation_digest(assembly.segments),
        prior_authorities=[
            d.classification
            for d in assembly.state.native_hyphen_decisions
            if d.classification is not None
        ],
    )
    return batch, assembly, owners
