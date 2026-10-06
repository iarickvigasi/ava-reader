"""The genuine independent native corpus must export its visibly printed author."""

import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.epub_v2.metadata import metadata_element
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct

FIXTURES = Path(__file__).parent / "fixtures"


class NativeOpeningAuthorTests(unittest.TestCase):
    def test_genuine_author_keeps_printed_credit_evidence_and_epub_creator(self):
        source = FIXTURES / "native.pdf"
        oracle = json.loads((FIXTURES / "native-oracle.json").read_text())
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            pages = [prepare_page(source, scratch, i) for i in range(1, 9)]
            self.assertTrue(all(not page.tasks for page in pages))
            book = reconstruct(source, scratch, pages, []).book
        authors = [
            m for m in book.metadata if m.field == "contributor" and m.contributor_role == "author"
        ]
        self.assertEqual(
            [(oracle["metadata"]["author"], "accepted")],
            [(m.value, m.status) for m in authors],
        )
        credit = next(
            block
            for block in book.blocks
            if hasattr(block, "content")
            and block.content.text == "AVA Fixture Studio / Synthetic test edition 1 / 2026-09-28"
        )
        self.assertEqual(credit.evidence, authors[0].evidence)
        self.assertEqual(
            [oracle["metadata"]["author"]],
            [node.text for node in metadata_element(book) if node.tag == "dc:creator"],
        )
