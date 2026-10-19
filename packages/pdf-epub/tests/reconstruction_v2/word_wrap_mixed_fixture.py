"""Independently authored native and protected recognized pieces share one final paragraph."""

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.stream_joins import stream_joins
from ava_pdf_epub.reconstruction_v2.word_wrap_assembly import WordWrapAssembly

from .word_wrap_fixture import authored_source


def mixed_case(native_first=True):
    native_page = 1 if native_first else 2
    _, observations, native, source_pages, cuts = authored_source(
        [(native_page, "The source trans-"), (native_page, "forming remains exact.")]
    )
    recognized = native.model_copy(
        update={
            "id": "recognized-piece",
            "page": 2 if native_first else 1,
            "method": "ocr",
            "native_line_ids": [],
            "text": "Protected recognized prose.",
            "source_text": "Protected recognized prose.",
        }
    )
    pieces = [native, recognized] if native_first else [recognized, native]
    pieces = [
        piece.model_copy(
            update={
                "continues_from_previous": index > 0,
                "continues_to_next": index + 1 < len(pieces),
            }
        )
        for index, piece in enumerate(pieces)
    ]
    state = AssemblyState()
    for piece in pieces:
        state.evidence[piece.id] = [dict(page=piece.page, region_id=f"page{piece.page}-region")]
        state.placements[piece.id] = (piece.page, 0, 0)
    joined = stream_joins(pieces, state)
    assembly = WordWrapAssembly(
        [page.model_dump(mode="json") for page in source_pages], joined, state, pieces, {}
    )
    return assembly, observations, source_pages, cuts, recognized
