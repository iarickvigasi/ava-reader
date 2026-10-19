"""Observed title/credit thresholds deliberately differ from the document prose-size base."""

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState

from .native_size_fixture import document, segment


def printed(ident, size, text, y, kind="heading", **updates):
    source, lines = segment(ident, 1, size, kind, 1, y=y, **updates)
    source = source.model_copy(update={"text": text, "source_text": text, "spans": []})
    line = lines[0].model_copy(
        update={"text": text, "glyphs": [lines[0].glyphs[0].model_copy(update={"text": text})]}
    )
    return source, [line]


def threshold_document(title_size, credit_size):
    title, rows = printed(
        "title", title_size, "Measured Book", 20, chapter_start=True, chapter_role="frontmatter"
    )
    title = title.model_copy(
        update={"style": title.style.model_copy(update={"align": "left", "relative_size": 1.7})}
    )
    credit, lines = printed("credit", credit_size, "A. Example / First edition", 100, "credit")
    credit = credit.model_copy(
        update={"style": credit.style.model_copy(update={"align": "center", "relative_size": 0.9})}
    )
    return document(
        [
            (title, rows),
            printed("chapter", 18, "1. Start", 60, chapter_start=True, chapter_role="bodymatter"),
            (credit, lines),
            segment("body2", 2),
            segment("body3", 3),
        ]
    )


def state_for(values):
    state = AssemblyState(segments={s.id: s for s in values})
    for i, s in enumerate(values):
        state.blocks.append(
            dict(
                id=s.id,
                kind=s.kind,
                style_id=state.style_id(s.style),
                content={"text": s.text},
                evidence=[
                    dict(
                        page=s.page,
                        region_id=s.id,
                        box=s.box.model_dump(),
                        reading_order=i,
                        method="native",
                    )
                ],
            )
        )
    return state
