"""Qualified finite values project through the unchanged canonical EPUB profile."""

import io
import tempfile
import unittest
import zipfile
from pathlib import Path

from epub_v2.helpers import fixture

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.epub_v2.export import export_epub
from ava_pdf_epub.reconstruction_v2.apply_refinement import apply_refinement

from .source_feature_answers import decisions
from .source_feature_fixtures import case


class FeatureProjection(unittest.TestCase):
    def test_quote_family_regular_reset_first_line_and_block_inset_project_separately(self):
        with tempfile.TemporaryDirectory() as d:
            _, _, segments, state, tasks = case(Path(d))
            updated = apply_refinement(
                segments,
                tasks,
                [
                    decisions(
                        t,
                        {
                            ("quoted", "block_inset"): dict(value=2.0),
                            ("quoted", "first_line_indent"): dict(value=1.0),
                        },
                    )
                    for t in tasks
                ],
                state,
            )
            quote = next(s for s in updated if s.id == "quoted")
            book, assets, _ = fixture()
            raw = book.model_dump(mode="json")
            block = next(b for b in raw["blocks"] if b["id"] == "body-one")
            original = block["content"]
            block.update(kind=quote.kind, style_id="source-qualified")
            raw["styles"].append({**quote.style.model_dump(mode="json"), "id": "source-qualified"})
            candidate = CanonicalBookV2.model_validate(raw)
            epub = export_epub(candidate, assets)
            with zipfile.ZipFile(io.BytesIO(epub)) as archive:
                css = archive.read("EPUB/styles/book.css").decode()
                html = b"".join(
                    archive.read(n)
                    for n in archive.namelist()
                    if n.startswith("EPUB/text/") and n.endswith(".xhtml")
                ).decode()
            self.assertEqual(original, candidate.blocks[1].content.model_dump(mode="json"))
            self.assertIn("blockquote", html)
            self.assertIn("margin-inline-start:2em", css)
            self.assertIn("text-indent:1em", css)
            self.assertIn("font-weight:400", css)
            self.assertIn("sans-serif", css)
            self.assertEqual(book.toc, candidate.toc)
            self.assertEqual(book.chapters, candidate.chapters)
