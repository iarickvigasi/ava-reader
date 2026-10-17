"""A real compound-assembly seam projected into an authored valid canonical graph."""

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.canonical_text import canonical_text
from ava_pdf_epub.reconstruction_v2.compound_heading_join import join_heading
from ava_pdf_epub.reconstruction_v2.segments import Segment
from ava_pdf_epub.reconstruction_v2.source_feature_binding import bind_source_features
from tests.epub_v2.helpers import fixture


def compound_case(*, inspected=True, before_binding=None):
    book, _, _ = fixture()
    raw = book.model_dump(mode="json")
    block = next(b for b in raw["blocks"] if b["id"] == "heading-two")
    original = block["evidence"][0]
    box = Box.model_validate(original["box"])
    middle = (box.y0 + box.y1) / 2
    gap = (box.y1 - box.y0) / 10
    boxes = [box.model_copy(update={"y1": middle - gap}), box.model_copy(update={"y0": middle})]
    parts = [
        Segment(
            id=ident,
            page=original["page"],
            kind="heading",
            heading_level=1,
            method="ocr",
            text=text,
            source_text=text,
            box=area,
            style=Style(id="observed", family="serif", bold=True, italic=bool(index)),
        )
        for index, (ident, text, area) in enumerate(
            zip(
                ["heading-two", "title-component"],
                ["Appendix 3", "Paradoxes 😀 purveyed"],
                boxes,
                strict=True,
            )
        )
    ]
    state = AssemblyState(
        source_feature_policy="ava-ocr-source-features-1", requested_source_features=1
    )
    for part in parts:
        state.evidence[part.id] = [
            {**original, "method": "ocr", "box": part.box.model_dump(mode="json")}
        ]
    joined = join_heading(parts, state)
    block.update(
        style_id=state.style_id(joined.style),
        content=canonical_text(joined.text, joined.spans, None, joined.id, state),
        evidence=state.evidence[joined.id],
    )
    raw["styles"].extend(
        s for s in state.styles.values() if s["id"] not in {x["id"] for x in raw["styles"]}
    )
    for page in raw["pages"]:
        if page["number"] == original["page"]:
            next(q for q in page["regions"] if q["id"] == original["region_id"])["route"] = "ocr"
    state.source_feature_evidence.append(
        dict(
            node_id=joined.id,
            page=joined.page,
            box=joined.box.model_dump(mode="json"),
            text_sha256=text_digest(joined.text),
            text_length=len(joined.text),
            feature="weight",
            disposition="observed" if inspected else "unknown",
            value=True if inspected else None,
            reason=None if inspected else "source_context_unavailable",
            task_id="task" if inspected else None,
            task_sha256="a" * 64 if inspected else None,
            response_sha256="b" * 64 if inspected else None,
            observation_sha256="c" * 64,
            source_sha256=book.source.sha256,
            crop_ids=["target", "reference"] if inspected else [],
            crop_sha256="d" * 64 if inspected else None,
        )
    )
    address = next(a for a in raw["addresses"] if a["fragment"] == joined.id)
    for span in block["content"]["spans"]:
        raw["addresses"].append(
            {
                **address,
                "fragment": span["id"],
                "target": {**address["target"], "offset": span["start"]},
            }
        )
    if before_binding is not None:
        before_binding(state)
    bind_source_features(state)
    state.release_observations()
    return CanonicalBookV2.model_validate(raw), state
