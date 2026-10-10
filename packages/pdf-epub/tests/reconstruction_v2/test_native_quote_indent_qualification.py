"""The bounded inherited quote cue is not a single-line first-indent observation."""

import unittest

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.native_spacing import native_spacing

from .source_indent_fixture import line, page, segment


class NativeQuoteIndentQualification(unittest.TestCase):
    def measure(self, left=60, kind="paragraph", literal=False, body=True, **fields):
        rows = [line("one", left, 30)]
        neighbours = [line("body1", 40, 130), line("body2", 40, 145)] if body else []
        value = segment("one", rows, Style(id="source", **fields)).model_copy(
            update={"kind": kind, "preserve_line_breaks": literal}
        )
        values = [value, segment("body", neighbours)] if neighbours else [value]
        return native_spacing(page(rows + neighbours), values)[0]

    def test_existing_single_italic_quote_keeps_role_and_outer_inset_only(self):
        for italic, expected in ((True, "quote"), (False, "paragraph")):
            result = self.measure(italic=italic)
            self.assertEqual(expected, result.kind)
            self.assertIsNone(result.style.indent_em)
            self.assertEqual(2 if italic else None, result.style.block_indent_em)
        for fields in ({"body": False}, {"left": 110}):
            result = self.measure(italic=True, **fields)
            self.assertEqual("paragraph", result.kind)
            self.assertIsNone(result.style.indent_em)
            self.assertIsNone(result.style.block_indent_em)

    def test_single_literal_keeps_unknown_and_explicit_zero_false_stays_fixed(self):
        for kind, literal in (("code", False), ("verse", False), ("paragraph", True)):
            result = self.measure(kind=kind, literal=literal, italic=True)
            self.assertEqual(kind, result.kind)
            self.assertIsNone(result.style.indent_em)
            self.assertIsNone(result.style.block_indent_em)
        result = self.measure(italic=False, indent_em=0, block_indent_em=0)
        self.assertEqual(0, result.style.indent_em)
        self.assertEqual(0, result.style.block_indent_em)
        self.assertFalse(result.style.italic)
