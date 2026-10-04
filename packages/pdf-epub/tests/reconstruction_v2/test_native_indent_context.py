"""Columns, literal flow and explicit finite tokens bound source-margin recovery."""

import unittest

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.native_spacing import native_spacing
from ava_pdf_epub.reconstruction_v2.paragraphs import join_paragraphs
from ava_pdf_epub.reconstruction_v2.reading_order import Placement

from .source_indent_fixture import line, page, segment


class NativeIndentContext(unittest.TestCase):
    def test_column_margins_are_local_and_full_width_breaks_neighbour_context(self):
        groups = [
            ("left-inset", [line("l1", 50, 20), line("l2", 50, 35)]),
            ("right-inset", [line("r1", 270, 20), line("r2", 270, 35)]),
            ("left-body", [line("lb1", 30, 60), line("lb2", 30, 75)]),
            ("right-body", [line("rb1", 250, 60), line("rb2", 250, 75)]),
            ("below-left", [line("bl", 50, 140)]),
            ("below-right", [line("br", 270, 140)]),
        ]
        heading = line("heading", 130, 110)
        heading = heading.model_copy(update={"box": heading.box.model_copy(update={"x1": 280})})
        values = [segment(ident, rows) for ident, rows in groups]
        values.append(segment("heading", [heading]).model_copy(update={"kind": "heading"}))
        observed = page([row for _, rows in groups for row in rows] + [heading])
        result = {s.id: s for s in native_spacing(observed, values)}
        for ident in ("left-inset", "right-inset"):
            self.assertEqual(0, result[ident].style.indent_em)
            self.assertEqual(2, result[ident].style.block_indent_em)
        for ident in ("below-left", "below-right"):
            self.assertIsNone(result[ident].style.indent_em)
            self.assertIsNone(result[ident].style.block_indent_em)

    def test_literal_independent_margins_do_not_become_first_line_displacements(self):
        body = [line("b1", 40, 130), line("b2", 40, 145)]
        for kind in ("code", "verse"):
            for starts, expected in (([60, 60, 60], 0), ([40, 60, 60], None)):
                with self.subTest(kind=kind, starts=starts):
                    rows = [line(f"l{i}", x, 30 + i * 15) for i, x in enumerate(starts)]
                    literal = segment("literal", rows).model_copy(update={"kind": kind})
                    result = native_spacing(page(rows + body), [literal, segment("body", body)])[0]
                    self.assertEqual(expected, result.style.indent_em)
                    self.assertEqual(2 if expected == 0 else None, result.style.block_indent_em)

    def test_explicit_spacing_and_alignment_survive_zero_and_nonzero_tokens(self):
        rows = [line("a", 60, 30), line("b", 40, 45), line("c", 40, 60)]
        style = Style(
            id="source",
            indent_em=0,
            block_indent_em=0,
            align="right",
            space_before_em=0,
            space_after_em=0,
            line_height=1.8,
            bold=False,
        )
        result = native_spacing(page(rows), [segment("source", rows, style)])[0]
        self.assertEqual(style, result.style)

    def test_out_of_profile_measurements_are_unknown_instead_of_clamped_claims(self):
        for starts in ([120, 40, 40], [40, 80, 80]):
            rows = [line(f"s{i}", x, 30 + i * 15) for i, x in enumerate(starts)]
            result = native_spacing(page(rows), [segment("source", rows)])[0]
            self.assertIsNone(result.style.indent_em)
        rows = [line("a", 110, 30), line("b", 110, 45)]
        body = [line("c", 40, 130), line("d", 40, 145)]
        result = native_spacing(
            page(rows + body), [segment("source", rows), segment("body", body)]
        )[0]
        self.assertIsNone(result.style.block_indent_em)

    def test_hanging_join_refuses_an_independent_third_font(self):
        rows = [line("a", 40, 30), line("b", 54, 45), line("c", 54, 60)]
        values = [
            segment(r.id, [r]).model_copy(update={"text": text})
            for r, text in zip(
                rows, ["A sentence continues", "then follows", "and ends."], strict=True
            )
        ]
        values[2] = values[2].model_copy(update={"style": Style(id="third", family="monospace")})
        self.assertEqual(
            3, len(join_paragraphs([Placement(s, i, 0) for i, s in enumerate(values)]))
        )
