"""Single-row and split-fragment source columns, not semantic guesses from First."""

import unittest

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.literal_label_geometry import literal_label_geometry
from ava_pdf_epub.reconstruction_v2.native_indent_rows import indent_rows
from ava_pdf_epub.reconstruction_v2.observations import Glyph, NativeLine

from .source_indent_fixture import page, segment


def row(ident, text, chunks, top=20):
    def box(left, right):
        return dict(coordinate_space="page_points_top_left", x0=left, x1=right, y0=top, y1=top + 10)

    glyphs = [
        Glyph(text=t, box=box(x, x + w), font="Times-Roman", size=10, visible=True)
        for t, x, w in chunks
    ]
    return NativeLine(
        id=ident,
        text=text,
        glyphs=glyphs,
        style=Style(id=ident),
        box=box(min(g.box.x0 for g in glyphs), max(g.box.x1 for g in glyphs)),
    )


def authored(split=False):
    rows = [row("first", "First Body", [("First", 40, 20), ("Body", 82, 20)])]
    if split:
        rows = [row("label", "First", [("First", 40, 20)]), row("body", "Body", [("Body", 82, 20)])]
    rows.append(row("tail", "Tail", [("Tail", 82, 20)], top=35))
    s = segment("item", rows).model_copy(
        update=dict(
            kind="list_item",
            list_ordered=True,
            list_start=1,
            list_depth=1,
            text=" ".join(r.text for r in rows),
        )
    )
    return page(rows), s


class LiteralLabelGeometryTests(unittest.TestCase):
    def test_source_columns_in_one_row_or_split_same_baseline(self):
        for split in (False, True):
            p, s = authored(split)
            self.assertEqual(("First ", 4.2), literal_label_geometry(s, p, indent_rows(p, [s])))
            before = s.model_dump()
            literal_label_geometry(s, p, indent_rows(p, [s]))
            self.assertEqual(before, s.model_dump())

    def test_ambiguous_or_unsafe_source_does_not_invent_a_column(self):
        for fault in (
            "invisible",
            "duplicate",
            "overlap",
            "tail",
            "size",
            "baseline",
            "prose",
            "glyph",
        ):
            p, s = authored(True)
            if fault == "invisible":
                p.lines[0].glyphs[0] = p.lines[0].glyphs[0].model_copy(update={"visible": False})
            elif fault == "duplicate":
                p.lines.append(p.lines[0])
            elif fault == "overlap":
                p.lines[0].glyphs[0] = (
                    p.lines[0]
                    .glyphs[0]
                    .model_copy(
                        update={"box": p.lines[0].glyphs[0].box.model_copy(update={"x1": 85})}
                    )
                )
            elif fault == "tail":
                p.lines[-1].glyphs[0] = (
                    p.lines[-1]
                    .glyphs[0]
                    .model_copy(
                        update={"box": p.lines[-1].glyphs[0].box.model_copy(update={"x0": 90})}
                    )
                )
            elif fault == "size":
                p.lines[1].glyphs[0] = p.lines[1].glyphs[0].model_copy(update={"size": 12})
            elif fault == "baseline":
                p.lines[1].glyphs[0] = (
                    p.lines[1]
                    .glyphs[0]
                    .model_copy(
                        update={"box": p.lines[1].glyphs[0].box.model_copy(update={"y0": 22})}
                    )
                )
            elif fault == "prose":
                s = s.model_copy(update={"kind": "paragraph"})
            else:
                p, s = authored()
                p.lines[0].glyphs[:] = [
                    Glyph(
                        text="First Body",
                        font="Times-Roman",
                        size=10,
                        visible=True,
                        box=p.lines[0].box,
                    )
                ]
            with self.subTest(fault=fault):
                self.assertIsNone(literal_label_geometry(s, p, indent_rows(p, [s])))
