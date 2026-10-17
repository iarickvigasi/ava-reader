"""Actual PDF annotations may corroborate an already-linked printed contents row."""

import hashlib
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfWriter
from pypdf.annotations import Link

from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.protocol import ReconstructionInput
from ava_pdf_epub.reconstruction_v2.reconstruct_source import reconstruct_source

FIXTURE = Path(__file__).parent / "fixtures" / "unnumbered-chapters.pdf"


class ContentsAnnotationOverlapTests(unittest.TestCase):
    def convert(self, directory, destination):
        source = directory / "source.pdf"
        writer = PdfWriter(clone_from=str(FIXTURE))
        writer.add_annotation(0, Link(rect=(47, 526, 246, 540), target_page_index=destination))
        writer.write(source)
        request = ReconstructionInput(
            schema_version="ava-reconstruct-input-1",
            source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
            responses=[],
        )
        return reconstruct_source(source, directory / "scratch", request)[0]

    def test_pdf_annotation_and_printed_contents_preserve_one_exact_target(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self.convert(Path(directory), 1)
        row = next(
            b
            for b in result.book.blocks
            if hasattr(b, "content") and b.content.text.startswith("The Harbour .")
        )
        links = [s for s in row.content.spans if s.link]
        self.assertEqual(len(links), 1)
        self.assertEqual(row.content.text[links[0].start : links[0].end], row.content.text)
        target = next(b for b in result.book.blocks if b.id == links[0].link.block_id)
        self.assertEqual(target.content.text, "The Harbour")
        self.assertEqual(links[0].link.offset, 0)
        self.assertTrue(
            any(
                f.code == "SOURCE_INTERNAL_LINK_CLAIMS_COALESCED" for f in result.structure_findings
            )
        )
        self.assertEqual(portable_epub(result.epub)[0], result.book)

    def test_conflicting_pdf_annotation_and_printed_contents_still_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "Conflicting overlapping"):
                self.convert(Path(directory), 2)
