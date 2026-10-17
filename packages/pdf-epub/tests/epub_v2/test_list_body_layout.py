"""Semantic markers own their gutter; body geometry remains independently preserved."""

import hashlib
import unittest
import xml.etree.ElementTree as ET

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.epub_v2.export import export_entries, export_epub
from ava_pdf_epub.epub_v2.portable import portable_epub

from .helpers import fixture
from .test_section_files import section_book


class ListBodyLayout(unittest.TestCase):
    def test_neutral_or_unknown_list_geometry_does_not_change_implicit_profile_bytes(self):
        original, assets, _ = fixture()
        expected = export_epub(original, assets, profile="ava-epub-canonical-2.1")
        self.assertEqual(expected, export_epub(original, assets))
        for indent, inset in [(None, None), (0, 0)]:
            raw = original.model_dump()
            item = next(b for b in raw["blocks"] if b["kind"] == "list_item")
            raw["styles"].append(dict(id="neutral", indent_em=indent, block_indent_em=inset))
            item["style_id"] = "neutral"
            book = CanonicalBookV2.model_validate(raw)
            with self.subTest(indent=indent, inset=inset):
                self.assertEqual(
                    export_epub(book, assets, profile="ava-epub-canonical-2.1"),
                    export_epub(book, assets),
                )
                # Explicit new projection remains available without relabelling old bytes.
                data = export_epub(book, assets, profile="ava-epub-canonical-2.5")
                self.assertEqual((book, assets), portable_epub(data))

    def test_body_only_clearance_preserves_real_signed_displacement(self):
        original, assets, _ = fixture()
        for indent, inset, padding in [
            (-2, 0, "2"),
            (-2, 0.5, "1.5"),
            (-2, 2, None),
            (1, 0, None),
            (0, 2, None),
        ]:
            raw = original.model_dump()
            item = next(b for b in raw["blocks"] if b["kind"] == "list_item")
            raw["styles"].append(dict(id="body", indent_em=indent, block_indent_em=inset))
            item["style_id"] = "body"
            book = CanonicalBookV2.model_validate(raw)
            entries = export_entries(book, assets)
            body = next(
                n
                for p, v in entries.items()
                if p.startswith("EPUB/text/")
                for n in ET.fromstring(v).iter()
                if n.get("data-ava-list-body") == item["id"]
            )
            with self.subTest(indent=indent, inset=inset):
                self.assertIn(f"text-indent:{indent:g}em", body.get("style"))
                self.assertIn(f"margin-inline-start:{inset:g}em", body.get("style"))
                if padding is None:
                    self.assertNotIn("padding-inline-start", body.get("style"))
                else:
                    self.assertIn(f"padding-inline-start:{padding}em", body.get("style"))
                self.assertEqual((book, assets), portable_epub(export_epub(book, assets)))

    def test_marker_only_and_unreferenced_geometry_do_not_select_body_projection(self):
        original, assets, _ = fixture()
        raw = original.model_dump()
        item = next(b for b in raw["blocks"] if b["kind"] == "list_item")
        raw["styles"].extend(
            [dict(id="unused-inset", indent_em=2), dict(id="marker", color="#1f3763", bold=True)]
        )
        item["marker_style_id"] = "marker"
        book = CanonicalBookV2.model_validate(raw)
        self.assertEqual(
            export_epub(book, assets, profile="ava-epub-canonical-2.1"), export_epub(book, assets)
        )

    def test_all_four_explicit_historical_exports_are_byte_exact(self):
        # Captured on clean 0ecb before this correction, from this authored source graph.
        historical = {
            "2.1": "d898fa4252ace0b0f149a2ebb924670bd24cccc97124c63162649acca9ffc180",
            "2.2": "a12fd1a818cab8c4eb86d2db4b820aa2de775e2785ba91af9acdd41d08f9aad7",
            "2.3": "9c0dfa5b66241fff31bf789ac488b3bf1bd3591a4e73b4d63a095f2a34a5085b",
            "2.4": "5a4989143b9f3307058c629a03b7d140d112392deeaf32ce1c6f61f1e90d4cda",
        }
        for version, expected in historical.items():
            book, assets = section_book(source_pages=version in {"2.3", "2.4"})
            data = export_epub(book, assets, profile="ava-epub-canonical-" + version)
            with self.subTest(version=version):
                self.assertEqual(expected, hashlib.sha256(data).hexdigest())
                self.assertEqual((book, assets), portable_epub(data))

    def test_default_projection_separates_body_geometry_and_keeps_sidecar(self):
        original, assets, _ = fixture()
        raw = original.model_dump()
        item = next(b for b in raw["blocks"] if b["kind"] == "list_item")
        raw["styles"].append(dict(id="hanging-body", indent_em=-1.384, block_indent_em=2.766))
        item["style_id"] = "hanging-body"
        book = CanonicalBookV2.model_validate(raw)
        entries = export_entries(book, assets)
        self.assertEqual(b"ava-epub-canonical-2.5", entries["META-INF/ava-profile"])
        node = next(
            n
            for p, v in entries.items()
            if p.startswith("EPUB/text/")
            for n in ET.fromstring(v).iter()
            if n.get("data-ava-block") == item["id"]
        )
        body = next(n for n in node if n.get("data-ava-list-body") == item["id"])
        self.assertEqual("text-indent:-1.384em;margin-inline-start:2.766em", body.get("style"))
        self.assertIn(
            b"li[data-ava-block]{text-indent:0;margin-inline-start:0}",
            entries["EPUB/styles/book.css"],
        )
        self.assertEqual((book, assets), portable_epub(export_epub(book, assets)))
        self.assertEqual(
            book.model_dump(),
            CanonicalBookV2.model_validate_json(entries["EPUB/ava-canonical.json"]).model_dump(),
        )
