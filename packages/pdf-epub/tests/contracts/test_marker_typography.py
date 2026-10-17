"""Marker extension is optional, source bounded and independently capability qualified."""

import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.contracts.reader import ReaderPackageV3
from ava_pdf_epub.epub_v2.reader import prepare_reader

from .helpers import fixture


class MarkerContractTests(unittest.TestCase):
    def test_absent_or_null_marker_extension_keeps_frozen_content_identity(self):
        raw = fixture("ava-reader-3")
        expected = raw["canonical_sha256"]
        for block in raw["book"]["blocks"]:
            if block["kind"] == "list_item":
                block["marker_style_id"] = None
        reader = ReaderPackageV3.model_validate(raw)
        self.assertEqual(expected, document_digest(reader.book))
        for block in reader.book.blocks:
            if block.kind == "list_item":
                self.assertNotIn("marker_style_id", block.model_dump())

    def test_marker_reference_is_strict_and_finite(self):
        for marker, style in [
            ("missing", None),
            ("bad", {"id": "bad", "color": "url(evil)"}),
            ("bad", {"id": "bad", "align": "center"}),
            ("bad", {"id": "bad", "vertical_align": "super"}),
            ("bad", {"id": "bad", "background_color": "#ffff00"}),
            ("bad", {"id": "bad", "bold": 1}),
        ]:
            raw = fixture()
            item = next(b for b in raw["blocks"] if b["kind"] == "list_item")
            item["marker_style_id"] = marker
            if style:
                raw["styles"].append(style)
            with self.subTest(style=style), self.assertRaises(ValidationError):
                CanonicalBookV2.model_validate(raw)

    def test_capability_includes_marker_only_font_and_color_and_refuses_omission(self):
        for style in [{"id": "marker", "bold": False}, {"id": "marker", "color": "#1f3763"}]:
            raw = fixture()
            raw["styles"].append(style)
            next(b for b in raw["blocks"] if b["kind"] == "list_item")["marker_style_id"] = "marker"
            book = CanonicalBookV2.model_validate(raw)
            reader = prepare_reader(book, "marker-content")
            self.assertIn("list-marker-styles", reader.required_capabilities)
            self.assertIn("styles", reader.required_capabilities)
            self.assertEqual("color" in style, "annotation-styles" in reader.required_capabilities)
            invalid = reader.model_dump()
            invalid["required_capabilities"].remove("list-marker-styles")
            with self.assertRaises(ValidationError):
                ReaderPackageV3.model_validate(invalid)
