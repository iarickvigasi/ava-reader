"""Block indentation is bounded, explicit and legacy digest compatible."""

import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.epub_v2.styles import declarations


class BlockIndent(unittest.TestCase):
    def test_unknown_does_not_change_legacy_wire(self):
        old = Style(id="legacy", indent_em=2)
        self.assertNotIn("block_indent_em", old.model_dump())
        self.assertEqual(declarations(old), "text-indent:2em")

    def test_both_indent_dimensions_export_independently(self):
        style = Style(id="pair", indent_em=0, block_indent_em=3.6)
        self.assertEqual(style.model_dump()["block_indent_em"], 3.6)
        self.assertEqual(declarations(style), "text-indent:0em;margin-inline-start:3.6em")
        self.assertEqual(Style(id="flush", block_indent_em=0).model_dump()["block_indent_em"], 0)

    def test_rejects_unbounded_or_nonfinite_indentation(self):
        for value in (-0.1, 6.1, float("inf"), float("nan")):
            with self.subTest(value=value), self.assertRaises(ValidationError):
                Style(id="bad", block_indent_em=value)
