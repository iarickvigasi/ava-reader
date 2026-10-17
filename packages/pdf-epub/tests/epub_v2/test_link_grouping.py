"""Focus targets follow semantic links, not the number of intersecting style runs."""

import unittest

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.contracts.inline_text import TextValue
from ava_pdf_epub.contracts.offsets import codepoint_to_utf16
from ava_pdf_epub.epub_v2.context import Context, ident
from ava_pdf_epub.epub_v2.inline import render_text
from ava_pdf_epub.epub_v2.xml import XHTML

from .helpers import fixture


class LinkGroupingTests(unittest.TestCase):
    def test_styles_offsets_and_separate_occurrences_keep_exact_focus_targets(self):
        book, _, _ = fixture()
        node = next(b for b in book.blocks if b.kind == "paragraph")
        text = "See page 2; page 2."
        link = {"kind": "external", "url": "https://example.invalid/reference"}
        spans = [
            {"id": "first", "start": 4, "end": 10, "link": link},
            {"id": "second", "start": 12, "end": 18, "link": link},
            {"id": "word-style", "start": 4, "end": 8, "style_id": book.styles[0].id},
            {"id": "number-style", "start": 9, "end": 10, "style_id": book.styles[-1].id},
        ]
        node = node.model_copy(
            update={
                "content": TextValue(
                    text=text,
                    sha256=text_digest(text),
                    codepoint_utf16=codepoint_to_utf16(text),
                    spans=spans,
                )
            }
        )
        context = Context(book)
        context.offsets[node.id] = {6, 9}
        rendered = render_text(node, context)
        anchors = list(rendered.iter(f"{{{XHTML}}}a"))
        self.assertEqual(["page 2", "page 2"], ["".join(a.itertext()) for a in anchors])
        self.assertEqual(text, "".join(rendered.itertext()))
        self.assertEqual(0, sum(len(list(a.iter(f"{{{XHTML}}}a"))) - 1 for a in anchors))
        classes = {n.get("class") for n in anchors[0].iter() if n.get("class")}
        self.assertEqual({ident("style", s["style_id"]) for s in spans if "style_id" in s}, classes)
        ids = {n.get("id") for n in rendered.iter() if n.get("id")}
        self.assertTrue({ident("s", s["id"]) for s in spans} <= ids)
        self.assertTrue({ident("loc", node.id) + "-6", ident("loc", node.id) + "-9"} <= ids)
