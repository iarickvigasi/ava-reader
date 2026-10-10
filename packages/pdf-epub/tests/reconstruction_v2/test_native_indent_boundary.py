"""Actual native source geometry remains exact through canonical and portable EPUB output."""

import hashlib
import io
import tempfile
import unittest
import zipfile
from pathlib import Path

from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.prepare_refinement import prepare_refinement
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.source_segments import source_segments

from .native_indent_pdf_fixture import GROUPS, authored_pdf
from .test_native_literal import responses


class NativeIndentBoundary(unittest.TestCase):
    def test_authored_hanging_and_block_coordinates_survive_portable_boundary(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.pdf"
            authored_pdf(source)
            pages = prepare_source(
                source, source.parent, hashlib.sha256(source.read_bytes()).hexdigest()
            )
            self.assertFalse(any(page.tasks for page in pages))
            _, segments, state = source_segments(source, source.parent, pages, [])
            tasks = prepare_refinement(source, source.parent, pages, segments, state)
            result = reconstruct(source, source.parent, pages, [], responses(tasks, "paragraph"))
        expected = [" ".join(text for text, _ in group) for group in GROUPS]
        blocks = [b for b in result.book.blocks if b.content and b.content.text in expected]
        self.assertEqual(expected, [b.content.text for b in blocks])
        styles = {style.id: style for style in result.book.styles}
        measured = [styles[block.style_id] for block in blocks]
        self.assertEqual([0, -14 / 11, 0], [style.indent_em for style in measured])
        self.assertEqual([None, 14 / 11, 36 / 11], [style.block_indent_em for style in measured])
        for block, group in zip(blocks, GROUPS, strict=True):
            self.assertEqual(
                "\n".join(text for text, _ in group), block.content.normalization.source_text
            )
            self.assertTrue(all(e.page == 1 and e.method == "native" for e in block.evidence))
            self.assertEqual(min(x for _, x in group), min(e.box.x0 for e in block.evidence))
        imported, assets = portable_epub(result.epub)
        self.assertEqual(result.book, imported)
        self.assertEqual(result.assets, assets)
        with zipfile.ZipFile(io.BytesIO(result.epub)) as archive:
            css = archive.read("EPUB/styles/book.css").decode()
        self.assertIn("text-indent:-1.27273em", css)
        self.assertIn("margin-inline-start:1.27273em", css)
        self.assertIn("margin-inline-start:3.27273em", css)
