"""Compare genuine source reconstruction against independently authored source oracles."""

import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct

FIXTURES = Path(__file__).parent / "fixtures"


class NativeCorpus(unittest.TestCase):
    def test_baseline_exact_text_structure_and_styles(self) -> None:
        source = FIXTURES / "native.pdf"
        oracle = json.loads((FIXTURES / "native-oracle.json").read_text())
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            pages = [prepare_page(source, scratch, i) for i in range(1, 9)]
            self.assertTrue(all(not p.tasks for p in pages))
            result = reconstruct(source, scratch, pages, [])
        book = result.book
        text = {b.content.text: b for b in book.blocks if hasattr(b, "content")}
        for expected in oracle["paragraphs"]:
            if expected["kind"] not in {"list", "table"}:
                self.assertTrue(expected["text"] in text, expected["id"])
        self.assertEqual(4, len(book.chapters))
        self.assertEqual(1, len(book.resources))
        self.assertEqual([1, 2], [group.depth for group in book.lists])
        self.assertEqual([2, 2], [len(group.item_ids) for group in book.lists])
        note = next(b for b in book.blocks if b.kind == "note")
        self.assertEqual(2, len(note.callout_ids))
        table = next(b for b in book.blocks if b.kind == "table")
        self.assertEqual(
            ["Place", "Lamps", "Harbour", "4", "Workshop", "2"],
            [cell.content.text for cell in table.cells],
        )
        for ident, kind in [
            ("p-code", "code"),
            ("p-verse", "verse"),
            ("p-aside", "aside"),
            ("p-quote", "quote"),
        ]:
            expected = next(p for p in oracle["paragraphs"] if p["id"] == ident)
            self.assertEqual(kind, text[expected["text"]].kind)
        styles = {style.id: style for style in book.styles}
        styled = text[next(p["text"] for p in oracle["paragraphs"] if p["id"] == "p-style")]
        for word, attribute, value in [("gentle", "italic", True), ("strong", "bold", True)]:
            at = styled.content.text.index(word)
            self.assertTrue(
                any(
                    s.start <= at < s.end and getattr(styles[s.style_id], attribute) == value
                    for s in styled.content.spans
                    if s.style_id
                )
            )
        vertical = [styles[s.style_id].vertical_align for s in styled.content.spans if s.style_id]
        self.assertIn("sub", vertical)
        self.assertIn("super", vertical)

    def test_two_column_exact_stream_joins_and_restarted_notes(self) -> None:
        source = FIXTURES / "two-column.pdf"
        oracle = json.loads((FIXTURES / "two-column-oracle.json").read_text())
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            pages = [prepare_page(source, scratch, i) for i in range(1, 4)]
            result = reconstruct(source, scratch, pages, [])
        text = [b.content.text for b in result.book.blocks if hasattr(b, "content")]
        expected = [node["text"] for node in oracle["nodes"] if "text" in node]
        for value in expected:
            self.assertIn(value, text)
        self.assertEqual(
            sorted(text.index(value) for value in expected),
            [text.index(value) for value in expected],
        )
        self.assertEqual(2, len(result.book.chapters))
        for title in [
            "Across the full-width heading",
            "A map between the columns",
            "The return journey",
        ]:
            node = next(
                b for b in result.book.blocks if b.kind == "heading" and b.content.text == title
            )
            self.assertEqual(2, node.level)
            self.assertTrue(any(t.label == title and t.parent_id for t in result.book.toc))
        notes = [b for b in result.book.blocks if b.kind == "note"]
        self.assertEqual([2, 1], [len(note.callout_ids) for note in notes])
        self.assertEqual(["1", "1"], [note.label for note in notes])


if __name__ == "__main__":
    unittest.main()
