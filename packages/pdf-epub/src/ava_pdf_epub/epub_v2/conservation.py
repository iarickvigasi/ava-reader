"""Source coordinates and distinct evidence levels for export qualification."""

from ..contracts.book import CanonicalBookV2
from ..contracts.common import document_digest
from ..contracts.graph_links import TEXT_NODES
from .context import Context, ident
from .profiles import SECTION_FILE_PROFILE, export_profile, validate_profile


def conservation_report(book: CanonicalBookV2, *, profile: str | None = None) -> dict[str, object]:
    book = CanonicalBookV2.model_validate(book.model_dump())
    profile = export_profile(book) if profile is None else profile
    ctx = Context(
        book,
        exact_source_pages=validate_profile(book, profile),
        split_sections=profile == SECTION_FILE_PROFILE,
    )
    mapping = []
    for address in book.addresses:
        fragment = address.fragment
        kind = "s" if fragment in ctx.inline_owners else "b"
        if fragment in ctx.paths:
            kind = "chapter"
        mapping.append(
            {
                "source_resource": address.resource_path,
                "source_fragment": fragment,
                "epub_resource": "EPUB/" + ctx.block_paths[address.target.block_id],
                "epub_fragment": f"page-{address.source_page}"
                if address.source_page is not None
                else ident(kind, fragment),
                "target": address.target.model_dump(),
            }
        )
    return {
        "adapter": "ava-canonical-reader-1",
        "epub_profile": profile,
        "canonical_sha256": document_digest(book),
        "source_addresses": mapping,
        "text_segments": [n.id for n in ctx.nodes.values() if isinstance(n, TEXT_NODES)],
        "resource_ids": [r.id for r in book.resources],
        "note_policy": "one body at canonical position; generated label and return links separate",
        "source_accuracy": "not_run",
        "epubcheck": "not_run",
        "actual_reader": "not_run",
        "publication_eligible": False,
    }
