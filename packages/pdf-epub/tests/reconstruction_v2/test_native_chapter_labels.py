"""A chapter name in notes does not override its measured secondary heading role."""

import tempfile
import unittest
from pathlib import Path

from pypdf import PdfWriter

from ava_pdf_epub.reconstruction_v2.classify_lines import classify_lines
from ava_pdf_epub.reconstruction_v2.source_structure import source_structure

from .native_size_fixture import document, segment
from .test_compound_headings import workspace


class NativeChapterLabels(unittest.TestCase):
    def test_small_chapter_label_is_section_and_large_label_is_chapter(self):
        items = [segment("body", 1, 12, count=4, y=120)]
        for ident, text, size, y in [
            ("notes", "Chapter 1: References", 12, 250),
            ("opening", "Chapter 1: Beginnings", 20, 20),
        ]:
            s, rows = segment(ident, 1, size, "heading", 1, y=y)
            row = rows[0]
            rows = [
                row.model_copy(
                    update={
                        "text": text,
                        "style": row.style.model_copy(update={"bold": True}),
                        "glyphs": [row.glyphs[0].model_copy(update={"text": text})],
                    }
                )
            ]
            items.append((s, rows))
        _, pages = document(items)
        classified = {s.id: s for s in classify_lines(pages[0].observation, set(), set())}
        section = classified["notes-line0"]
        opening = classified["opening-line0"]
        self.assertEqual(
            ("heading", 2, False, None),
            (section.kind, section.heading_level, section.chapter_start, section.chapter_role),
        )
        self.assertEqual(
            ("heading", 1, True, "bodymatter"),
            (opening.kind, opening.heading_level, opening.chapter_start, opening.chapter_role),
        )

    def test_source_outline_can_promote_a_genuine_same_size_chapter(self):
        s, rows = segment("title", 1, 12, "heading", 1)
        row = rows[0]
        rows = [
            row.model_copy(
                update={
                    "text": "Chapter 1: Beginnings",
                    "style": row.style.model_copy(update={"bold": True}),
                    "glyphs": [row.glyphs[0].model_copy(update={"text": "Chapter 1: Beginnings"})],
                }
            )
        ]
        _, pages = document([(s, rows), segment("body", 1, 12, count=4, y=100)])
        observed = classify_lines(pages[0].observation, set(), set())
        state = workspace(observed)
        self.assertFalse(observed[0].chapter_start)
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "outlined.pdf"
            writer = PdfWriter()
            writer.add_blank_page(width=600, height=800)
            writer.add_outline_item("Chapter 1: Beginnings", 0)
            writer.write(source)
            result = source_structure(source, pages, {1: observed}, observed, state)
        self.assertEqual((1, True), (result[0].heading_level, result[0].chapter_start))
