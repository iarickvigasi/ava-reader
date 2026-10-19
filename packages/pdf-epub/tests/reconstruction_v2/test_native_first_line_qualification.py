"""A native first-line style needs its own paragraph continuation, not another block's margin."""

import unittest

from ava_pdf_epub.reconstruction_v2.native_spacing import native_spacing
from ava_pdf_epub.reconstruction_v2.paragraphs import join_paragraphs
from ava_pdf_epub.reconstruction_v2.reading_order import Placement

from .source_indent_fixture import line, page, segment


class NativeFirstLineQualification(unittest.TestCase):
    def test_shifted_single_paragraph_code_and_verse_stay_unknown(self):
        body = [line("body1", 40, 130), line("body2", 40, 145)]
        for kind in ("paragraph", "code", "verse"):
            lone = segment("lone", [line("one", 60, 30)]).model_copy(update={"kind": kind})
            result = native_spacing(
                page(body + [line("one", 60, 30)]), [lone, segment("body", body)]
            )[0]
            self.assertIsNone(result.style.indent_em)
            self.assertIsNone(result.style.block_indent_em)

    def test_matching_single_literal_has_no_invented_paragraph_indent(self):
        body = [line("body1", 40, 130), line("body2", 40, 145)]
        for kind in ("code", "verse"):
            lone = segment("lone", [line("one", 40, 30)]).model_copy(update={"kind": kind})
            result = native_spacing(
                page(body + [line("one", 40, 30)]), [lone, segment("body", body)]
            )[0]
            self.assertIsNone(result.style.indent_em)

    def test_positive_first_line_joins_only_its_two_adjacent_continuation_lines(self):
        rows = [line("a", 60, 30), line("b", 40, 45), line("c", 40, 60)]
        values = [
            segment(row.id, [row]).model_copy(update={"text": text})
            for row, text in zip(
                rows,
                ["The first sentence ends.", "The body continues.", "The final sentence ends."],
                strict=True,
            )
        ]
        joined = join_paragraphs([Placement(s, i, 0) for i, s in enumerate(values)])
        self.assertEqual(1, len(joined))
        self.assertEqual(" ".join(s.text for s in values), joined[0].segment.text)
        self.assertEqual(2, native_spacing(page(rows), [joined[0].segment])[0].style.indent_em)
        self.assertEqual(
            2, len(join_paragraphs([Placement(s, i, 0) for i, s in enumerate(values[:2])]))
        )

    def test_symmetric_union_box_does_not_override_observed_first_line_shift(self):
        rows = [line("a", 60, 30), line("b", 40, 45), line("c", 40, 60)]
        rows = [
            row.model_copy(update={"box": row.box.model_copy(update={"x1": right})})
            for row, right in zip(rows, [320, 360, 330], strict=True)
        ]
        result = native_spacing(page(rows), [segment("paragraph", rows)])[0]
        self.assertEqual("start", result.style.align)
        self.assertEqual(2, result.style.indent_em)

    def test_hanging_two_em_join_keeps_compensating_outer_inset(self):
        rows = [line("a", 40, 30), line("b", 60, 45), line("c", 60, 60)]
        values = [
            segment(row.id, [row]).model_copy(update={"text": text})
            for row, text in zip(
                rows,
                ["The first sentence continues", "then follows its body", "and ends here."],
                strict=True,
            )
        ]
        joined = join_paragraphs([Placement(s, i, 0) for i, s in enumerate(values)])
        self.assertEqual(1, len(joined))
        result = native_spacing(page(rows), [joined[0].segment])[0]
        self.assertEqual(-2, result.style.indent_em)
        self.assertEqual(2, result.style.block_indent_em)
