"""Small independently authored printed-note graphs without provider or book fixtures."""

from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.reconstruction_v2.assemble_links import assemble_links
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.printed_markers import printed_markers
from ava_pdf_epub.reconstruction_v2.segments import Segment


def note(ident, text, label, role="endnote"):
    return Segment(
        id=ident,
        page=1,
        method="ocr",
        kind="note",
        text=text,
        note_label=label,
        note_role=role,
        box=Box(coordinate_space="page_points_top_left", x0=10, y0=10, x1=100, y1=30),
    )


def link_graph(callers, notes, chapters):
    state = AssemblyState()
    segments = [
        Segment(
            id=ident,
            page=1,
            method="ocr",
            kind="paragraph",
            text=text,
            box=Box(coordinate_space="page_points_top_left", x0=10, y0=10, x1=100, y1=30),
        )
        for ident, text in callers
    ] + printed_markers(notes, state)
    state.segments = {s.id: s for s in segments}
    for segment in segments:
        block = dict(id=segment.id, kind=segment.kind, content=dict(text=segment.text, spans=[]))
        if segment.kind == "note":
            block.update(label=segment.note_label, note_role=segment.note_role, callout_ids=[])
        state.blocks.append(block)
    assemble_links(state, [dict(id=ident, block_ids=blocks) for ident, blocks in chapters])
    return state
