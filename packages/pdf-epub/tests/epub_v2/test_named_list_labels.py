"""Named labels survive portable export with scripts, exact offsets and nesting."""

import io
import unittest
import zipfile
from xml.etree import ElementTree as ET

from pydantic import ValidationError

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.contracts.capabilities import required_capabilities
from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.contracts.offsets import codepoint_to_utf16
from ava_pdf_epub.epub_v2.export import export_epub
from ava_pdf_epub.epub_v2.portable import portable_epub

from .helpers import archive_bytes, fixture


class NamedListExportTests(unittest.TestCase):
    def authored_book(self):
        original, assets, _ = fixture()
        raw = original.model_dump()
        raw["lists"][0].update(ordered=False, start=None, marker_style="none")
        raw["styles"].append(dict(id="suffix", vertical_align="super"))
        for identity, label in [("list-parent", "Q2"), ("list-next", "Q11")]:
            block = next(b for b in raw["blocks"] if b["id"] == identity)
            text = label + " Authored café 😀."
            block["content"] = dict(
                text=text,
                sha256=text_digest(text),
                codepoint_utf16=codepoint_to_utf16(text),
                spans=[dict(id="raised", start=2, end=3, style_id="suffix")]
                if identity == "list-next"
                else [],
            )
        raw["addresses"].append(
            dict(
                resource_path="text/chapter-one.xhtml",
                fragment="raised",
                target=dict(
                    kind="internal", chapter_id="chapter-one", block_id="list-next", offset=2
                ),
            )
        )
        book = CanonicalBookV2.model_validate(raw)
        return book, assets

    def test_markerless_unordered_labels_export_reimport_and_reject_visible_tampering(self):
        book, assets = self.authored_book()
        data = export_epub(book, assets)
        self.assertEqual(portable_epub(data)[0], book)
        self.assertIn("literal-list-markers", required_capabilities(book))
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = {n: archive.read(n) for n in archive.namelist()}
        namespace = "{http://www.w3.org/1999/xhtml}"
        path = next(n for n, v in entries.items() if n.endswith(".xhtml") and b"Q2" in v)
        document = ET.fromstring(entries[path])
        literal = next(
            n for n in document.iter(namespace + "ul") if n.get("style") == "list-style-type:none"
        )
        self.assertNotIn("start", literal.attrib)
        self.assertEqual(len(literal.findall(namespace + "li")), 2)
        self.assertTrue(any(n.tag == namespace + "ul" for n in literal.iter() if n is not literal))
        self.assertEqual([n.get("value") for n in literal.iter(namespace + "li")], [None] * 3)
        self.assertIn("Q11 Authored café 😀.", "".join(literal.itertext()))
        for old, new in [(b"list-style-type:none", b"list-style-type:disc"), (b"Q2", b"Q9")]:
            corrupted = {**entries, path: entries[path].replace(old, new)}
            with self.assertRaisesRegex(ValueError, "conservation"):
                portable_epub(archive_bytes(corrupted))
        raw = book.model_dump()
        raw["lists"][0]["start"] = 1
        with self.assertRaisesRegex(ValidationError, "unordered lists have none"):
            CanonicalBookV2.model_validate(raw)
