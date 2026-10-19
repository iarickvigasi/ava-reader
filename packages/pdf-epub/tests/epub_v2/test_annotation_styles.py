"""Finite style transport conserves old books and generated EPUB reimport."""

import hashlib
import io
import unittest
import zipfile

from pydantic import ValidationError

from ava_pdf_epub.contracts.reader import ReaderPackageV3
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.epub_v2.export import export_epub
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.epub_v2.reader import prepare_reader
from ava_pdf_epub.epub_v2.styles import declarations

from .helpers import fixture


class AnnotationStyles(unittest.TestCase):
    def test_frozen_pre_extension_epub_bytes_remain_unchanged(self):
        book, assets, _ = fixture()
        data = export_epub(book, assets)
        self.assertEqual(
            hashlib.sha256(data).hexdigest(),
            "32c450bd0a5e125b6e3977ff955a674add36dcf2af7b7a05be4b46d986e9cd19",
        )
        self.assertEqual(portable_epub(data)[0], book)

    def test_unknown_extension_keeps_old_wire_and_false_is_not_unknown(self):
        old = Style(id="legacy").model_dump()
        for key in ("color", "background_color", "decoration_color", "underline", "strike_through"):
            self.assertNotIn(key, old)
        style = Style(id="reset", underline=False, strike_through=False)
        self.assertFalse(style.model_dump()["underline"])
        self.assertEqual("text-decoration-line:none", declarations(style))

    def test_colors_do_not_accept_css_or_resource_injection(self):
        for value in [
            "red",
            "#FFF",
            "#FFFF00",
            "url(https://example.invalid)",
            "#ffff00;color:red",
            "#ffff00\n",
        ]:
            with self.subTest(value=value), self.assertRaises(ValidationError):
                Style(id="bad", background_color=value)

    def test_styled_book_survives_exact_export_reimport(self):
        book, assets, _ = fixture()
        styles = list(book.styles)
        original = styles[0]
        styles[0] = original.model_copy(
            update={
                "color": "#000000",
                "background_color": "#ffff00",
                "decoration_color": "#0000ff",
                "underline": True,
                "strike_through": True,
            }
        )
        styled = book.model_copy(update={"styles": styles})
        reader = prepare_reader(styled, "annotation-style-fixture")
        self.assertIn("annotation-styles", reader.required_capabilities)
        raw = reader.model_dump()
        raw["required_capabilities"].remove("annotation-styles")
        with self.assertRaises(ValidationError):
            ReaderPackageV3.model_validate(raw)
        data = export_epub(styled, assets)
        imported, imported_assets = portable_epub(data)
        self.assertEqual(styled.model_dump(), imported.model_dump())
        self.assertEqual(assets, imported_assets)
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            css = b"".join(archive.read(n) for n in archive.namelist() if n.endswith(".css"))
        self.assertIn(b"background-color:#ffff00", css)
        self.assertIn(b"color:#000000", css)
        self.assertIn(b"text-decoration-color:#0000ff", css)
        self.assertIn(b"text-decoration-line:underline line-through", css)
