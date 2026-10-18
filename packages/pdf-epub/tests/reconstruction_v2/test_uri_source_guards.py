"""URI targets cannot make a hidden or partially selected source glyph readable."""

import tempfile
import unittest
from pathlib import Path

from pypdf.generic import FloatObject

from ava_pdf_epub.pdf_navigation import pdf_navigation
from ava_pdf_epub.reconstruction_v2.pdf_link_page import LinkPage
from ava_pdf_epub.reconstruction_v2.source_uri_caller import source_uri_caller

from .uri_caller_fixture import fixture


class UriSourceGuardTests(unittest.TestCase):
    def test_partial_glyph_and_invisible_source_decline_the_literal_witness(self):
        with tempfile.TemporaryDirectory() as d:
            f = fixture(Path(d))
            self.addCleanup(f.reader.close)
            a, b = f.annotation(0)
            target = pdf_navigation(f.reader, a)
            old = a["/Rect"][0]
            a["/Rect"][0] = FloatObject(float(old) + 1.2)
            a, cut = f.annotation(0)
            self.assertIsNone(source_uri_caller(f.reader, target, a, cut, f.context, f.state))
            a["/Rect"][0] = old
            page = f.checkpoint.observation
            row = next(line for line in page.lines if line.text.startswith("chapter.htm"))
            hidden = row.model_copy(
                update={
                    "glyphs": [row.glyphs[0].model_copy(update={"visible": False}), *row.glyphs[1:]]
                }
            )
            changed = page.model_copy(
                update={"lines": [hidden if line.id == row.id else line for line in page.lines]}
            )
            context = LinkPage(f.checkpoint.model_copy(update={"observation": changed}), f.owners)
            self.assertIsNone(source_uri_caller(f.reader, target, a, b, context, f.state))
