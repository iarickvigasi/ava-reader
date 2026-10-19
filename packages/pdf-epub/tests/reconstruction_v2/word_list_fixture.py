"""Authored word list with a provisional paragraph wrap and final semantic role."""

from ava_pdf_epub.contracts.layout_hyphen import LayoutHyphenDisposition, candidate_digest
from ava_pdf_epub.reconstruction_v2.native_structure_source import prepare_native_structure

from .native_structure_decision_fixture import SOURCE, line, page, region, response, wrap_candidate
from .native_structure_v2_fixture import response2


def source_case(policy="ava-native-structure-2", kind="list_item", label="Fourth"):
    lines = [line("one", label + " Authored trans-"), line("two", "formation.", y=60)]
    observation, image = page(lines)
    candidate = wrap_candidate(*lines)
    task = prepare_native_structure(
        observation,
        SOURCE,
        image,
        [region("body", lines)],
        candidates=[candidate],
        structure_policy=policy,
    )
    group = dict(id="item", region_id="body", kind=kind, line_ids=[s.id for s in lines])
    if kind == "list_item":
        group.update(list_start=4 if label == "Fourth" else 1, list_depth=1)
        group.update({"list_role": "ordered"} if policy.endswith("2") else {"list_ordered": True})
    elif kind == "note":
        group.update(note_label="1", note_role="footnote")
    disposition = LayoutHyphenDisposition(
        candidate_id=candidate.id,
        candidate_sha256=candidate_digest(candidate),
        disposition="layout",
    )
    make = response2 if policy.endswith("2") else response
    return observation, task, make(task, [group], [disposition]), candidate
