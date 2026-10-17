"""Complete the canonical-v2 graph before serializing any EPUB candidate."""

import gc
import hashlib
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..contracts.book import CanonicalBookV2
from ..contracts.profiles import BILINGUAL_PROFILE
from ..epub_v2.export import export_epub
from ..epub_v2.profiles import export_profile
from .annotation_findings import annotation_findings
from .assemble_addresses import assemble_addresses
from .assemble_blocks import assemble_blocks
from .assemble_chapters import assemble_chapters
from .assemble_lists import assemble_lists
from .assemble_metadata import assemble_metadata
from .assemble_page_addresses import assemble_page_addresses
from .bind_literal_labels import assemble_links_with_labels
from .book_language import language_metadata
from .findings import Finding
from .legacy_reconstruction_assembly import legacy_reconstruction_assembly
from .native_layout_policy import NativeLayoutPolicy
from .native_size_presentation import apply_native_sizes
from .native_structure_versions import AnyNativeStructureResponse
from .native_word_wrap_policy import NativeWordWrapPolicy
from .normalize_list_bodies import normalize_list_bodies
from .prepared_types import AnyPreparedPage
from .printed_title_v2_contract import FrontmatterTitleResponse
from .recognition_contract import RecognitionResponse
from .refinement_contract import AnyRefinementResponse
from .source_cover import preserve_source_cover
from .source_feature_contract import FEATURE_POLICY
from .word_wrap_contract import WordWrapResponse
from .word_wrap_reconstruct import reconstruct_word_wrap_assembly


@dataclass
class ReconstructedBook:
    book: CanonicalBookV2
    epub: bytes
    assets: dict[str, bytes]
    structure_findings: list[Finding]
    refinement_evidence: list[dict[str, Any]]
    source_feature_coverage: dict[str, Any] | None = None


def reconstruct(
    source: Path,
    scratch: Path,
    prepared: Sequence[AnyPreparedPage],
    responses: list[RecognitionResponse],
    refinements: list[AnyRefinementResponse | FrontmatterTitleResponse] | None = None,
    *,
    source_feature_policy: str | None = None,
    source_layout_policy: NativeLayoutPolicy | None = None,
    native_structure_responses: Sequence[AnyNativeStructureResponse] | None = None,
    source_normalization_policy: NativeWordWrapPolicy | None = None,
    word_wrap_responses: list[WordWrapResponse] | None = None,
    source_title_policy: str | None = None,
    source_continuation_policy: str | None = None,
) -> ReconstructedBook:
    if source_normalization_policy is not None:
        if source_feature_policy != FEATURE_POLICY:
            raise ValueError("Sparse lexical reconstruction requires captured source features")
        assembly = reconstruct_word_wrap_assembly(
            source,
            scratch,
            prepared,
            responses,
            refinements,
            native_structure_responses,
            source_layout_policy,
            source_normalization_policy,
            word_wrap_responses,
            source_title_policy=source_title_policy,
            source_continuation_policy=source_continuation_policy,
        )
    else:
        if source_continuation_policy is not None:
            raise ValueError(
                "Continuation presentation requires lexical/current source reconstruction"
            )
        if word_wrap_responses is not None:
            raise ValueError("Sparse lexical receipts require their captured policy")
        assembly = legacy_reconstruction_assembly(
            source,
            scratch,
            prepared,
            responses,
            refinements,
            source_feature_policy,
            source_layout_policy,
            native_structure_responses,
            source_title_policy=source_title_policy,
        )
    pages, segments, state = assembly.pages, assembly.segments, assembly.state
    size_sources, page_starts = assembly.size_sources, assembly.page_starts
    del assembly
    from .source_feature_report import source_feature_coverage

    assemble_blocks(segments, prepared, scratch, state)
    chapters, toc = assemble_chapters(state)
    from .source_outline_aliases import add_outline_navigation

    assemble_lists(state, chapters)
    if source_feature_policy == FEATURE_POLICY:
        normalize_list_bodies(state)
    assemble_links_with_labels(state, chapters)
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    document_id = "pdf-" + digest[:32]
    metadata = assemble_metadata(source, state, document_id)
    if prepared[0].profile_id == BILINGUAL_PROFILE:
        metadata.extend(
            language_metadata(source, state, prepared, responses, native_structure_responses)
        )
    cover = preserve_source_cover(prepared, pages, chapters, metadata, scratch, state)
    addresses = assemble_addresses(state, chapters)
    assemble_page_addresses(page_starts, state, chapters, addresses)
    from .frontmatter_navigation import frontmatter_navigation

    frontmatter_navigation(state, chapters, toc, addresses)
    add_outline_navigation(state, chapters, toc, addresses)
    apply_native_sizes(size_sources, prepared, state)
    # All relationships are now compiled into the graph; drop source-only objects
    # before validating the owned canonical representation.
    del segments, size_sources
    from .source_feature_binding import bind_source_features

    bind_source_features(state)
    state.release_observations()
    gc.collect()
    book = CanonicalBookV2.model_validate(
        dict(
            schema_version="ava-book-2",
            profile_id=prepared[0].profile_id,
            document_id=document_id,
            source=dict(sha256=digest, byte_length=source.stat().st_size, page_count=len(prepared)),
            pages=pages,
            chapters=chapters,
            spine=[c["id"] for c in chapters],
            blocks=state.blocks,
            toc=toc,
            styles=list(state.styles.values()),
            resources=state.resources,
            cover_resource_id=cover,
            lists=state.lists,
            addresses=addresses,
            metadata=metadata,
        )
    )
    # The validated model now owns text, mappings, styles and relationships. Do not
    # retain the source observations and raw graph alongside export's validation copy.
    del pages, chapters, toc, metadata, addresses
    feature_coverage = source_feature_coverage(state, book)
    state.release_source_workspace()
    gc.collect()
    return ReconstructedBook(
        book=book,
        epub=export_epub(
            book,
            state.assets,
            profile=export_profile(book, split_sections=source_feature_policy is not None),
        ),
        assets=state.assets,
        structure_findings=[*state.structure_findings, *annotation_findings(source)],
        refinement_evidence=state.refinement_evidence,
        source_feature_coverage=feature_coverage,
    )
