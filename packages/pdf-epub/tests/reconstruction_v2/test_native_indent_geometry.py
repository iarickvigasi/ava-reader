"""Signed first-line and whole-block geometry are separate observable source coordinates."""

import unittest

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.native_spacing import native_spacing
from ava_pdf_epub.reconstruction_v2.paragraphs import join_paragraphs
from ava_pdf_epub.reconstruction_v2.reading_order import Placement

from .source_indent_fixture import line, page, segment


class NativeIndentGeometry(unittest.TestCase):
    def measure(self, starts, **fields):
        body = [line("body1", 40, 130), line("body2", 40, 145)]
        rows = [line(f"s{i}", x, 30 + i * 15) for i, x in enumerate(starts)]
        value = segment("target", rows, Style(id="target", **fields))
        return native_spacing(page(rows + body), [value, segment("body", body)])[0]

    def test_positive_first_line_and_aligned_block_inset_are_distinct(self):
        first = self.measure([60, 40, 40])
        inset = self.measure([70, 70, 70])
        self.assertEqual(2, first.style.indent_em)
        self.assertIsNone(first.style.block_indent_em)
        self.assertEqual(0, inset.style.indent_em)
        self.assertEqual(3, inset.style.block_indent_em)

    def test_hanging_first_line_has_compensating_outer_inset(self):
        value = self.measure([40, 60, 60])
        self.assertEqual(-2, value.style.indent_em)
        self.assertEqual(2, value.style.block_indent_em)

    def test_explicit_zero_false_and_negative_survive(self):
        value = self.measure([60, 40, 40], indent_em=0, block_indent_em=0, bold=False)
        self.assertEqual(0, value.style.indent_em)
        self.assertEqual(0, value.style.block_indent_em)
        self.assertFalse(value.style.bold)
        self.assertEqual(-1, self.measure([60, 40, 40], indent_em=-1).style.indent_em)

    def test_inconsistent_continuation_margin_and_isolated_single_stay_unknown(self):
        self.assertIsNone(self.measure([40, 60, 80]).style.indent_em)
        lone = segment("lone", [line("one", 40, 40)])
        self.assertIsNone(native_spacing(page([line("one", 40, 40)]), [lone])[0].style.indent_em)

    def test_hanging_wrap_requires_matching_following_body_line(self):
        rows = [line("a", 40, 30), line("b", 54, 45), line("c", 54, 60)]
        values = [
            segment(r.id, [r]).model_copy(update={"text": t})
            for r, t in zip(
                rows,
                ["A hanging sentence begins", "then continues with its body", "and ends here."],
                strict=True,
            )
        ]
        joined = join_paragraphs([Placement(s, i, 0) for i, s in enumerate(values)])
        self.assertEqual(1, len(joined))
        self.assertEqual(
            -1.4, native_spacing(page(rows), [p.segment for p in joined])[0].style.indent_em
        )
        self.assertEqual(
            2, len(join_paragraphs([Placement(s, i, 0) for i, s in enumerate(values[:2])]))
        )
