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
from .annotation_findings import annotation_findings
from .apply_refinement import apply_refinement
from .assemble_addresses import assemble_addresses
from .assemble_blocks import assemble_blocks
from .assemble_chapters import assemble_chapters
from .assemble_links import assemble_links
from .assemble_lists import assemble_lists
from .assemble_metadata import assemble_metadata
from .book_language import language_metadata
from .compound_wraps import compact_native_compounds
from .continuation_margins import continuation_margins
from .findings import Finding
from .ocr_font_faces import corroborate_ocr_font_faces
from .prepare_refinement import prepare_refinement
from .prepared import PreparedPage
from .printed_markers import printed_markers
from .recognition_contract import RecognitionResponse
from .refinement_contract import BookRefinementResponse
from .source_cover import preserve_source_cover
from .source_segments import source_segments
from .stream_joins import stream_joins


@dataclass
class ReconstructedBook:
    book: CanonicalBookV2
    epub: bytes
    assets: dict[str, bytes]
    structure_findings: list[Finding]
    refinement_evidence: list[dict[str, Any]]


def reconstruct(
    source: Path,
    scratch: Path,
    prepared: Sequence[PreparedPage],
    responses: list[RecognitionResponse],
    refinements: list[BookRefinementResponse] | None = None,
) -> ReconstructedBook:
    pages, segments, state = source_segments(source, scratch, prepared, responses)
    if refinements is not None:
        tasks = prepare_refinement(source, scratch, prepared, segments, state)
        if tasks or refinements:
            segments = apply_refinement(segments, tasks, refinements, state)
        del tasks
    segments = corroborate_ocr_font_faces(source, prepared, segments, state)
    for page in pages:
        page["label"] = state.page_labels.get(page["number"])
    segments = compact_native_compounds(printed_markers(segments, state), state)
    for segment in segments:
        state.segments[segment.id] = segment
    continuation_margins(segments, prepared, scratch, state)
    segments = stream_joins(segments, state)
    assemble_blocks(segments, prepared, scratch, state)
    chapters, toc = assemble_chapters(state)
    assemble_lists(state, chapters)
    assemble_links(state, chapters)
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    document_id = "pdf-" + digest[:32]
    metadata = assemble_metadata(source, state, document_id)
    if prepared[0].profile_id == BILINGUAL_PROFILE:
        metadata.extend(language_metadata(source, state, prepared, responses))
    cover = preserve_source_cover(prepared, pages, chapters, metadata, scratch, state)
    addresses = assemble_addresses(state, chapters)
    # All relationships are now compiled into the graph; drop source-only objects
    # before validating the owned canonical representation.
    del segments
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
    state.release_source_workspace()
    gc.collect()
    return ReconstructedBook(
        book=book,
        epub=export_epub(book, state.assets),
        assets=state.assets,
        structure_findings=[*state.structure_findings, *annotation_findings(source)],
        refinement_evidence=state.refinement_evidence,
    )
