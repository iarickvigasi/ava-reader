"""Small authored inline graph for source link reconstruction controls."""

from ava_pdf_epub.contracts.inline_text import TextValue
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.canonical_text import canonical_text
from ava_pdf_epub.reconstruction_v2.internal_links import internal_links
from ava_pdf_epub.reconstruction_v2.segments import Segment


def source_state(ranges):
    segment = Segment.model_validate(
        dict(
            id="row",
            page=1,
            method="ocr",
            kind="paragraph",
            text="Authored café 😀 contents 7",
            box=dict(coordinate_space="page_points_top_left", x0=20, y0=40, x1=400, y1=80),
        )
    )
    state = AssemblyState(segments={"row": segment})
    state.blocks = [
        dict(
            id="row",
            kind="paragraph",
            content=canonical_text(segment.text, [], None, segment.id, state),
        )
    ]
    state.internal_targets = [("row", a, b, "heading", 0) for a, b in ranges]
    return state


def assemble(state):
    internal_links(state, {"row": "front", "heading": "chapter", "other": "chapter"})
    return TextValue.model_validate(state.blocks[0]["content"])
