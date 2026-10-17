"""Small valid source observations for table-caption geometry and ownership controls."""

import hashlib

from PIL import Image

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.reconstruction_v2.assemble_blocks import assemble_blocks
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.prepared import PreparedPage
from ava_pdf_epub.reconstruction_v2.segments import Segment


def observed(ident, kind, top, *, page=1, x=10, related_to=None):
    height = 20 if kind == "table" else 10
    box = dict(coordinate_space="page_points_top_left", x0=x, y0=top, x1=x + 40, y1=top + height)
    values = dict(id=ident, page=page, box=box, kind=kind, method="native", related_to=related_to)
    if kind == "table":
        values["cells"] = [[dict(text="cell", box=box)]]
    elif kind != "figure":
        values["text"] = ident
    return Segment.model_validate(values)


def workspace(rows):
    state = AssemblyState(segments={s.id: s for s in rows})
    for s in rows:
        node = dict(id=s.id, kind=s.kind)
        if s.kind in {"table", "figure"}:
            node["caption_id"] = None
        if s.kind == "figure":
            node.update(alt="", credit_id=None)
        else:
            node["content"] = dict(text=s.text, spans=[])
        state.blocks.append(node)
    return state


def associations(state):
    return {b["id"]: b["caption_id"] for b in state.blocks if b["kind"] == "table"}


def assembled(rows, scratch):
    image = scratch / "page.png"
    Image.new("RGB", (200, 200), "blue").save(image)
    page = PreparedPage.model_validate(
        dict(
            schema_version="ava-prepared-page-1",
            profile_id=BILINGUAL_PROFILE,
            source_sha256="b" * 64,
            source_byte_length=1,
            source_page_count=1,
            observation=dict(
                number=1,
                width_pt=200,
                height_pt=200,
                rotation=0,
                render_path="page.png",
                render_sha256=hashlib.sha256(image.read_bytes()).hexdigest(),
                render_width=200,
                render_height=200,
                lines=[],
                graphics=[],
                risks=[],
            ),
            tables=[],
            native_segments=rows,
            tasks=[],
        )
    )
    state = AssemblyState(segments={s.id: s for s in rows})
    state.evidence = {
        s.id: [dict(page=s.page, region_id=s.id, method=s.method, box=s.box.model_dump())]
        for s in rows
    }
    assemble_blocks(rows, [page], scratch, state)
    return state
