"""A source suffix uses whole glyphs, a token boundary and normal digit geometry."""

import unittest

from ava_pdf_epub.reconstruction_v2.toc_folio_tail import toc_folio_tail

from .test_ocr_link_context import line
from .test_pdf_links import box


class TocFolioSliceTests(unittest.TestCase):
    def test_whole_multi_codepoint_glyph_and_trailing_source_space(self):
        source = line("source", "Title 147 ", 0, 20)
        glyphs = source.glyphs
        merged = glyphs[6].model_copy(update={"text": "147", "box": box(24, 20, 36, 30)})
        source = source.model_copy(update={"glyphs": [*glyphs[:6], merged, glyphs[-1]]})
        proof = toc_folio_tail(source, "147")
        self.assertIs(proof.line, source)
        self.assertEqual([6], [i for i, _ in proof.glyphs])
        self.assertIsNone(toc_folio_tail(source, "47"))
        self.assertIsNone(toc_folio_tail(source, "7"))

    def test_nonterminal_undelimited_separated_or_reversed_digits_refuse(self):
        for text, label in (("Title147", "147"), ("Title 147 next", "147"), ("Title 147", "47")):
            self.assertIsNone(toc_folio_tail(line("source", text, 0, 20), label))
        for mode in ("gap", "reversed"):
            source = line("source", "Title 147", 0, 20)
            if mode == "gap":
                for i in (7, 8):
                    glyph = source.glyphs[i]
                    source.glyphs[i] = glyph.model_copy(
                        update={
                            "box": glyph.box.model_copy(
                                update={"x0": glyph.box.x0 + 10, "x1": glyph.box.x1 + 10}
                            )
                        }
                    )
            else:
                a, b = source.glyphs[7:9]
                source.glyphs[7] = a.model_copy(update={"box": b.box})
                source.glyphs[8] = b.model_copy(update={"box": a.box})
            self.assertIsNone(toc_folio_tail(source, "147"))
