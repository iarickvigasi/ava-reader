"""Authored statement labels; not a supplied-book excerpt or accepted provider response."""

from ava_pdf_epub.reconstruction_v2.assemble_lists import assemble_lists
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.printed_markers import printed_markers
from ava_pdf_epub.reconstruction_v2.segments import Segment


def item(identity, label, ordinal, **values):
    return Segment.model_validate(
        dict(
            id=identity,
            page=1,
            method="ocr",
            kind="list_item",
            text=label + " Authored café 😀 reference.",
            source_text=label + " Authored café 😀 reference.",
            box=dict(coordinate_space="page_points_top_left", x0=20, y0=40, x1=400, y1=80),
            list_ordered=True,
            list_start=ordinal,
            list_depth=1,
            **values,
        )
    )


def assemble(segments, marker_styles=None):
    state = AssemblyState(word_wrap_active=True)
    segments = printed_markers(segments, state)
    state.marker_styles.update(marker_styles or {})
    state.segments = {s.id: s for s in segments}
    state.blocks = [dict(id=s.id, kind=s.kind) for s in segments]
    assemble_lists(state, [dict(block_ids=[s.id for s in segments])])
    return state
