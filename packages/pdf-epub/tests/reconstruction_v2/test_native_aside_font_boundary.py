"""Genuine PDF typography survives native extraction, canonical assembly and visible EPUB import."""

import io
import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.epub_v2.context import ident
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct

FIXTURES = Path(__file__).parent / "fixtures"


class NativeAsideFontBoundary(unittest.TestCase):
    def test_source_sans_aside_survives_export_without_text_or_geometry_changes(self):
        source = FIXTURES / "native.pdf"
        oracle = json.loads((FIXTURES / "native-oracle.json").read_text())
        expected = next(p["text"] for p in oracle["paragraphs"] if p["id"] == "p-aside")
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            pages = [prepare_page(source, scratch, number) for number in range(1, 9)]
            self.assertFalse(any(page.tasks for page in pages))
            result = reconstruct(source, scratch, pages, [])
            with patch(
                "ava_pdf_epub.reconstruction_v2.native_graphics.native_aside_fonts",
                return_value=(None, []),
            ):
                previous = reconstruct(source, scratch, pages, [])
        aside = next(block for block in result.book.blocks if block.kind == "aside")
        old = next(block for block in previous.book.blocks if block.id == aside.id)
        self.assertEqual(expected, aside.content.text)
        self.assertEqual(
            old.model_dump(exclude={"style_id"}), aside.model_dump(exclude={"style_id"})
        )
        self.assertEqual(
            [b for b in previous.book.blocks if b.id != aside.id],
            [b for b in result.book.blocks if b.id != aside.id],
        )
        self.assertEqual(
            previous.book.model_dump(exclude={"blocks", "styles"}),
            result.book.model_dump(exclude={"blocks", "styles"}),
        )
        page = pages[aside.evidence[0].page - 1]
        region = next(s for s in page.native_segments if s.id == aside.id)
        glyphs = [
            g
            for row in page.observation.lines
            if row.id in region.native_line_ids
            for g in row.glyphs
        ]
        self.assertTrue(glyphs)
        self.assertTrue(all(g.font.split("+")[-1] == "ArialMT" and g.size == 11 for g in glyphs))
        style = next(s for s in result.book.styles if s.id == aside.style_id)
        self.assertEqual("sans-serif", style.family)
        self.assertIs(style.bold, False)
        self.assertIs(style.italic, False)
        self.assertIsNone(style.relative_size)
        self.assertIsNone(style.background_color)
        imported, assets = portable_epub(result.epub)
        self.assertEqual(result.book, imported)
        self.assertEqual(result.assets, assets)
        with zipfile.ZipFile(io.BytesIO(result.epub)) as archive:
            contents = {name: archive.read(name) for name in archive.namelist()}
        nodes = [
            node
            for name, data in contents.items()
            if name.endswith(".xhtml")
            for node in ET.fromstring(data).iter()
            if node.get("data-ava-block") == aside.id
        ]
        self.assertEqual(1, len(nodes))
        self.assertEqual("aside", nodes[0].tag.split("}")[-1])
        self.assertEqual(expected, "".join(nodes[0].itertext()))
        self.assertEqual(ident("style", style.id), nodes[0].get("class"))
        css = b"\n".join(data for name, data in contents.items() if name.endswith(".css")).decode()
        self.assertIn("." + ident("style", style.id) + "{font-family:sans-serif;", css)
