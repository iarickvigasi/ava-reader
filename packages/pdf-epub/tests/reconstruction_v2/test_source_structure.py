"""Actual authored contents/openings and damaged source variants must agree before candidacy."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader, PdfWriter

from ava_pdf_epub.epub_v2.context import Context, ident
from ava_pdf_epub.epub_v2.inline import render_text
from ava_pdf_epub.epub_v2.xml import XHTML
from ava_pdf_epub.reconstruction_v2.protocol import ReconstructionInput
from ava_pdf_epub.reconstruction_v2.reconstruct_source import reconstruct_source

FIXTURES = Path(__file__).parent / "fixtures"


def convert(source, scratch):
    return reconstruct_source(
        source,
        scratch,
        ReconstructionInput(
            schema_version="ava-reconstruct-input-1",
            source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
            responses=[],
        ),
    )


class SourceStructureTests(unittest.TestCase):
    def test_named_chapters_contents_and_observed_print_reference_are_preserved(self):
        source = FIXTURES / "unnumbered-chapters.pdf"
        oracle = json.loads((FIXTURES / "unnumbered-chapters-oracle.json").read_text())
        with tempfile.TemporaryDirectory() as directory:
            result, report = convert(source, Path(directory))
        book = result.book
        self.assertEqual(
            oracle["chapters"], [c.title for c in book.chapters if c.role == "bodymatter"]
        )
        self.assertEqual("frontmatter", book.chapters[0].role)
        self.assertEqual([None, "2", "3"], [p.label for p in book.pages])
        self.assertEqual(3, len({c.resource_paths[0] for c in book.chapters}))
        ref = next(
            b
            for b in book.blocks
            if hasattr(b, "content")
            and b.content.text == oracle["printed_reference"]["source_text"]
        )
        link = next(s.link for s in ref.content.spans if s.link)
        target = next(b for b in book.blocks if b.id == link.block_id)
        self.assertEqual("The Harbour", target.content.text)
        self.assertEqual(2, target.evidence[0].page)
        rendered = render_text(ref, Context(book))
        anchors = list(rendered.iter(f"{{{XHTML}}}a"))
        self.assertEqual(["page 2"], ["".join(a.itertext()) for a in anchors])
        self.assertEqual(ref.content.text, "".join(rendered.itertext()))
        self.assertTrue(all(list(a) for a in anchors))
        self.assertEqual(
            {ident("s", s.id) for s in ref.content.spans},
            {n.get("id") for n in rendered.iter() if n.get("id")},
        )
        self.assertEqual("pass", report.checks["source_structure_signals_consistent"])
        self.assertEqual("pass", report.checks["explicit_source_references_resolved"])
        front = book.chapters[0]
        contents = [
            b
            for b in book.blocks
            if b.id in front.block_ids and hasattr(b, "content") and "...." in b.content.text
        ]
        self.assertEqual(2, len(contents))
        self.assertTrue(all(any(s.link for s in b.content.spans) for b in contents))

    def test_uncorroborated_unnumbered_chapters_and_unresolved_page_refuse(self):
        reader = PdfReader(FIXTURES / "unnumbered-chapters.pdf")
        for indices, error in [([1, 2], "Unnumbered chapter"), ([2], "Printed page reference")]:
            with tempfile.TemporaryDirectory() as directory:
                source = Path(directory) / "source.pdf"
                writer = PdfWriter()
                for index in indices:
                    writer.add_page(reader.pages[index])
                writer.write(source)
                with self.assertRaisesRegex(ValueError, error):
                    convert(source, Path(directory) / "scratch")

    def test_bookmark_disagreement_refuses_instead_of_overriding_printed_contents(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.pdf"
            writer = PdfWriter(clone_from=str(FIXTURES / "unnumbered-chapters.pdf"))
            writer.add_outline_item("A different chapter name", 1)
            writer.write(source)
            with self.assertRaisesRegex(ValueError, "disagrees"):
                convert(source, Path(directory) / "scratch")


if __name__ == "__main__":
    unittest.main()
