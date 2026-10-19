"""Actual native source reading order is retained across page and column joins."""

import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.page_starts import page_addresses
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct

FIXTURES = Path(__file__).parent / "fixtures"


def converted(name, count):
    source = FIXTURES / f"{name}.pdf"
    with tempfile.TemporaryDirectory() as directory:
        scratch = Path(directory)
        pages = [prepare_page(source, scratch, number) for number in range(1, count + 1)]
        if any(page.tasks for page in pages):
            raise AssertionError("The authored native fixture must need no recognition provider")
        return reconstruct(source, scratch, pages, [])


class NativeSourcePageTests(unittest.TestCase):
    def test_two_column_page_start_uses_exact_postjoin_offset_from_authored_source(self):
        oracle = json.loads((FIXTURES / "two-column-oracle.json").read_bytes())
        joined = next(n for n in oracle["nodes"] if n["id"] == "tc-page-join")
        expected_text = joined["text"]
        second_fragment = joined["fragments"][1]["text"]
        expected_offset = len(joined["fragments"][0]["text"]) + 1
        result = converted("two-column", 3)
        addresses = page_addresses(result.book)
        self.assertEqual({1, 2, 3}, set(addresses))
        blocks = {block.id: block for block in result.book.blocks}
        second = addresses[2].target
        node = blocks[second.block_id]
        self.assertEqual(expected_text, node.content.text)
        self.assertEqual(expected_offset, second.offset)
        self.assertEqual(second_fragment, node.content.text[second.offset :])
        self.assertEqual([1, 2], sorted({e.page for e in node.evidence}))
        for number, title in [
            (1, oracle["metadata"]["title"]),
            (3, oracle["chapters"][1]["title"]),
        ]:
            target = addresses[number].target
            self.assertEqual(0, target.offset)
            self.assertEqual(title, blocks[target.block_id].content.text)
        self.assertEqual(result.book, portable_epub(result.epub)[0])

    def test_native_book_page_three_begins_at_workshop_heading_and_all_pages_are_mapped(self):
        oracle = json.loads((FIXTURES / "native-oracle.json").read_bytes())
        result = converted("native", 8)
        addresses = page_addresses(result.book)
        self.assertEqual(set(range(1, 9)), set(addresses))
        target = addresses[3].target
        block = next(b for b in result.book.blocks if b.id == target.block_id)
        self.assertEqual(0, target.offset)
        self.assertEqual("heading", block.kind)
        self.assertEqual(oracle["chapters"][1]["title"], block.content.text)
        self.assertEqual("2. The Workshop", block.content.text)
        self.assertEqual(result.book, portable_epub(result.epub)[0])
