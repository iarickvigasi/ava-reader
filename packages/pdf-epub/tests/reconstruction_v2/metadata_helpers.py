"""Small authored observations; expected metadata roles are independent of extraction."""

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.segments import Segment


def metadata_state(rows):
    state = AssemblyState()
    for i, row in enumerate(rows):
        box = dict(
            x0=50, y0=40 + 30 * i, x1=400, y1=60 + 30 * i, coordinate_space="page_points_top_left"
        )
        values = dict(id=f"observed-{i}", page=1, box=box, method="native")
        values.update(row)
        segment = Segment.model_validate(values)
        evidence = [
            dict(
                page=segment.page,
                region_id=f"region-{i}",
                box=box,
                reading_order=i,
                method="native",
            )
        ]
        state.segments[segment.id] = segment
        state.blocks.append(
            dict(
                id=segment.id, kind=segment.kind, content=dict(text=segment.text), evidence=evidence
            )
        )
    return state


def heading(text, level=1, **extra):
    return dict(kind="heading", text=text, heading_level=level, **extra)


def paragraph(text, **extra):
    return dict(kind="paragraph", text=text, **extra)


def body(text="1. The Journey"):
    return heading(text, chapter_start=True, chapter_role="bodymatter")


def title(text="The Journey Book"):
    return heading(text, style=dict(id="title", align="center"))
