"""Complete the canonical-v2 graph before serializing any EPUB candidate."""

import hashlib
from dataclasses import dataclass
from pathlib import Path

from ..contracts.book import CanonicalBookV2
from ..epub_v2.export import export_epub
from .assemble_addresses import assemble_addresses
from .assemble_blocks import assemble_blocks
from .assemble_chapters import assemble_chapters
from .assemble_links import assemble_links
from .assemble_lists import assemble_lists
from .assemble_metadata import assemble_metadata
from .assemble_pages import assemble_pages
from .assembly_state import AssemblyState
from .continuation_margins import continuation_margins
from .findings import Finding
from .prepared import PreparedPage
from .printed_markers import printed_markers
from .qualify_pages import qualify_pages
from .recognition_contract import RecognitionResponse
from .source_structure import source_structure
from .stream_joins import stream_joins


@dataclass
class ReconstructedBook:
    book: CanonicalBookV2
    epub: bytes
    assets: dict[str, bytes]
    structure_findings: list[Finding]


def reconstruct(
    source: Path, scratch: Path, prepared: list[PreparedPage], responses: list[RecognitionResponse]
) -> ReconstructedBook:
    qualified = qualify_pages(source, scratch, prepared, responses)
    state = AssemblyState()
    pages, segments = assemble_pages(prepared, qualified, state)
    segments = source_structure(source, prepared, qualified, segments, state)
    for page in pages:
        page["label"] = state.page_labels.get(page["number"])
    segments = printed_markers(segments, state)
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
    book = CanonicalBookV2.model_validate(
        dict(
            schema_version="ava-book-2",
            profile_id="ava-pdf-prose-en-v2",
            document_id=document_id,
            source=dict(sha256=digest, byte_length=source.stat().st_size, page_count=len(prepared)),
            pages=pages,
            chapters=chapters,
            spine=[c["id"] for c in chapters],
            blocks=state.blocks,
            toc=toc,
            styles=list(state.styles.values()),
            resources=state.resources,
            lists=state.lists,
            addresses=assemble_addresses(state, chapters),
            metadata=assemble_metadata(source, state, document_id),
        )
    )
    return ReconstructedBook(
        book=book,
        epub=export_epub(book, state.assets),
        assets=state.assets,
        structure_findings=state.structure_findings,
    )
