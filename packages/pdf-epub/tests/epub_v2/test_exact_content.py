import unittest
import xml.etree.ElementTree as ET

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.contracts.offsets import codepoint_to_utf16
from ava_pdf_epub.epub_v2.context import ident
from ava_pdf_epub.epub_v2.export import export_entries

from .helpers import fixture


class ExactContentTests(unittest.TestCase):
    def test_carriage_returns_and_table_cell_offset_targets_remain_exact(self):
        book, assets, _ = fixture()
        raw = book.model_dump()
        code = next(b for b in raw["blocks"] if b["id"] == "code-one")
        text = "  literal\r\n\tline\r end"
        code["content"].update(
            text=text, sha256=text_digest(text), codepoint_utf16=codepoint_to_utf16(text)
        )
        raw["toc"].append(
            {
                "id": "cell-toc",
                "label": "A table passage",
                "parent_id": None,
                "target": {
                    "kind": "internal",
                    "chapter_id": "chapter-one",
                    "block_id": "cell-11",
                    "offset": 1,
                },
            }
        )
        book = CanonicalBookV2.model_validate(raw)
        entries = export_entries(book, assets)
        chapter = ET.fromstring(entries["EPUB/text/" + ident("ch", "chapter-one") + ".xhtml"])
        actual = next(n for n in chapter.iter() if n.get("data-ava-text") == "code-one")
        self.assertEqual("".join(actual.itertext()), text)
        cell = next(n for n in chapter.iter() if n.get("data-ava-cell") == "cell-11")
        target = next(n for n in cell.iter() if n.get("id") == ident("loc", "cell-11") + "-1")
        self.assertEqual(target.tail, "our")

    def test_ambiguous_accepted_metadata_refuses_export(self):
        book, assets, _ = fixture()
        raw = book.model_dump()
        title = next(m.copy() for m in raw["metadata"] if m["field"] == "title")
        title.update(id="competing-title", value="Different title")
        raw["metadata"].append(title)
        with self.assertRaisesRegex(ValueError, "Ambiguous accepted title"):
            export_entries(CanonicalBookV2.model_validate(raw), assets)
