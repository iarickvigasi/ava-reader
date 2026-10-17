import unittest
import xml.etree.ElementTree as ET

from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.epub_v2.conservation import conservation_report
from ava_pdf_epub.epub_v2.reader import prepare_reader
from ava_pdf_epub.epub_v2.reimport import reimport_epub

from .helpers import exported, fixture


class ConservationTests(unittest.TestCase):
    def test_visible_text_order_and_readable_spine_match_independent_oracle(self):
        book, data, entries, oracle = exported()
        chapters = [
            ET.fromstring(entries[path]) for path in entries if path.startswith("EPUB/text/")
        ]
        actual = [
            (n.get("data-ava-text"), "".join(n.itertext()))
            for root in chapters
            for n in root.iter()
            if n.get("data-ava-text")
        ]
        self.assertEqual(actual, list(oracle["text_by_id"].items()))
        self.assertEqual(len(chapters), len(oracle["spine"]))
        self.assertEqual(reimport_epub(data, document_digest(book)), book)
        reader = prepare_reader(book, "final-fixture")
        self.assertEqual(reader.book, book)
        self.assertEqual(reader.book.blocks[1].content.codepoint_utf16[2], 3)
        self.assertEqual(
            reader.required_capabilities,
            ["figures", "links", "lists", "literal-text", "notes", "styles", "tables", "text"],
        )

    def test_addresses_all_resolve_to_exact_exported_fragments(self):
        book, _, entries, _ = exported()
        report = conservation_report(book)
        for address in report["source_addresses"]:
            root = ET.fromstring(entries[address["epub_resource"]])
            found = [n for n in root.iter() if n.get("id") == address["epub_fragment"]]
            self.assertEqual(len(found), 1)
        self.assertFalse(report["publication_eligible"])
        self.assertEqual(report["actual_reader"], "not_run")

    def test_reproducible_export_and_input_is_not_mutated(self):
        from ava_pdf_epub.epub_v2.export import export_epub

        book, assets, _ = fixture()
        snapshot = book.model_dump()
        self.assertEqual(export_epub(book, assets), export_epub(book, assets))
        self.assertEqual(book.model_dump(), snapshot)
