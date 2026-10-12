"""Visible marker CSS and attributes are verified alongside the immutable sidecar."""

import base64
import hashlib
import io
import json
import unittest
import zipfile
from unittest.mock import Mock, patch

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.contracts.reader import ReaderPackageV3
from ava_pdf_epub.epub_v2.context import ident
from ava_pdf_epub.epub_v2.export import export_epub
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.runtime import import_epub

from .helpers import archive_bytes, fixture


class MarkerExportTests(unittest.TestCase):
    def authored_book(self, color="#1f3763"):
        original, assets, _ = fixture()
        raw = original.model_dump()
        item = next(b for b in raw["blocks"] if b["kind"] == "list_item")
        raw["styles"].append(
            dict(id="marker", color=color, bold=False, italic=False, relative_size=0.8)
        )
        item["marker_style_id"] = "marker"
        return CanonicalBookV2.model_validate(raw), assets, item["id"]

    def test_regular_font_resets_and_item_relative_size_are_marker_only(self):
        book, assets, item_id = self.authored_book()
        with zipfile.ZipFile(io.BytesIO(export_epub(book, assets))) as archive:
            css = archive.read("EPUB/styles/book.css").decode()
        self.assertIn(
            f"#{ident('b', item_id)}::marker{{"
            "font-weight:400;font-style:normal;font-size:0.8em;color:#1f3763}",
            css,
        )
        self.assertNotIn("::marker{", css.split(f"#{ident('b', item_id)}")[0])

    def test_mutating_visible_marker_css_or_reference_fails_portable_reimport(self):
        book, assets, _ = self.authored_book()
        with zipfile.ZipFile(io.BytesIO(export_epub(book, assets))) as archive:
            entries = {n: archive.read(n) for n in archive.namelist()}
        for change in ("css", "attribute"):
            corrupted = dict(entries)
            if change == "css":
                corrupted["EPUB/styles/book.css"] = entries["EPUB/styles/book.css"].replace(
                    b"::marker", b"::before"
                )
            else:
                path = next(
                    n
                    for n, data in entries.items()
                    if n.startswith("EPUB/text/") and b'data-ava-marker-style="marker"' in data
                )
                corrupted[path] = entries[path].replace(
                    b'data-ava-marker-style="marker"', b'data-ava-marker-style="missing"'
                )
            with self.subTest(change=change), self.assertRaisesRegex(ValueError, "conservation"):
                portable_epub(archive_bytes(corrupted))

    def test_neutral_marker_ink_uses_reader_text_inheritance(self):
        book, assets, item_id = self.authored_book("#000000")
        with zipfile.ZipFile(io.BytesIO(export_epub(book, assets))) as archive:
            css = archive.read("EPUB/styles/book.css").decode()
        marker_rule = css.split(f"#{ident('b', item_id)}::marker{{")[1].split("}")[0]
        self.assertNotIn("color:#000000", marker_rule)
        self.assertEqual(book, portable_epub(export_epub(book, assets))[0])

    def test_ordinary_import_preparation_retains_marker_content_and_capabilities(self):
        book, assets, _ = self.authored_book()
        data = export_epub(book, assets)
        request = json.dumps(
            dict(
                source_sha256=hashlib.sha256(data).hexdigest(),
                final_content_id="new-owned-import",
            )
        ).encode()
        stdout = Mock(buffer=io.BytesIO())
        # Only fixed sandbox paths and the external package validator are substituted.
        # Portable visible comparison, canonical validation, reader construction and
        # streamed artifacts execute normally; this is not actual EPUBCheck evidence.
        check = dict(
            status="pass",
            returncode=0,
            report=dict(
                messages=[],
                checker=dict(checkerVersion="5.4.0", nError=0, nFatal=0),
            ),
        )
        with (
            patch.object(import_epub, "snapshot", side_effect=[data, request]),
            patch.object(import_epub.Path, "mkdir"),
            patch.object(import_epub.Path, "write_bytes"),
            patch.object(import_epub, "epubcheck", return_value=check),
            patch.object(import_epub.sys, "stdout", stdout),
        ):
            import_epub.main()
        records = [json.loads(line) for line in stdout.buffer.getvalue().splitlines()]
        reader_bytes = b"".join(
            base64.b64decode(row["base64"]) for row in records if row.get("path") == "reader.json"
        )
        reader = ReaderPackageV3.model_validate_json(reader_bytes)
        self.assertEqual(book, reader.book)
        self.assertEqual(document_digest(book), reader.canonical_sha256)
        self.assertEqual("new-owned-import", reader.final_content_id)
        self.assertIn("list-marker-styles", reader.required_capabilities)
        self.assertIn("annotation-styles", reader.required_capabilities)
        self.assertEqual(
            reader.required_capabilities, records[0]["report"]["required_capabilities"]
        )
