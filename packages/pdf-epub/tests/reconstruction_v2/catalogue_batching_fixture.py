"""Authored long-book node/edge context independent of rendered output."""

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.refinement_catalogue import refinement_catalogue
from ava_pdf_epub.reconstruction_v2.refinement_contract import RefinementNode

from .test_refinement_grouping import segment


def long_book(*, current=True):
    values = [
        segment(f"h{i}", f"Heading {i}", 1 if i == 0 else 2).model_copy(update={"method": "native"})
        for i in range(137)
    ]
    for i in range(80):
        values.extend(
            [
                segment(f"native{i}", "An unfinished source paragraph", page=i * 2 + 2).model_copy(
                    update={"method": "native"}
                ),
                segment(f"ocr{i}", "continuing the source paragraph.", page=i * 2 + 3),
            ]
        )
    state = AssemblyState(placements={s.id: (s.page, 0, 0) for s in values})
    if current:
        state.source_title_policy = "ava-frontmatter-title-1"
        state.source_continuation_policy = "ava-source-continuation-presentation-1"
    return values, state


def catalogue(current=True):
    values, state = long_book(current=current)
    return refinement_catalogue(values, state, source_title_policy=state.source_title_policy)


def node(ident, *, heading=False, reference=None, candidate=False):
    return RefinementNode(
        id=ident,
        page=1,
        kind="heading" if heading else "paragraph",
        text_sha256="a" * 64,
        text_excerpt=ident,
        structure_candidate=candidate,
        candidate_original_kind="paragraph" if candidate else None,
        observed_level=2 if heading else None,
        observed_chapter=False,
        observed_role=None,
        observed_style=None,
        ranked_source=False,
        body_reference_id=reference,
    )
