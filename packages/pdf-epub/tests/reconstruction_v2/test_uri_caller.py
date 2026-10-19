"""Original URI groups preserve exact caller parts, full link extent and styled typography."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.pdf_navigation import pdf_navigation
from ava_pdf_epub.reconstruction_v2.pdf_link_marks import apply_link_marks
from ava_pdf_epub.reconstruction_v2.pdf_ocr_caller import ocr_pdf_caller

from .uri_caller_fixture import fixture


class UriCallerTests(unittest.TestCase):
    def test_public_caller_to_mark_handoff_is_idempotent_in_both_annotation_orders(self):
        for order in [(0, 1), (1, 0)]:
            with self.subTest(order=order), tempfile.TemporaryDirectory() as d:
                f = fixture(Path(d))
                self.addCleanup(f.reader.close)
                result = list(f.owners)
                original = f.owners[0].model_dump()
                source = f.source.read_bytes()
                observation = f.checkpoint.model_dump_json()
                for index in order:
                    annotation, caller = f.annotation(index)
                    target = pdf_navigation(f.reader, annotation)
                    ranges = ocr_pdf_caller(
                        f.reader, target, annotation, caller, f.context, f.state, None, f.source
                    )
                    self.assertIsNotNone(f.state.pending_uri_link)
                    self.assertTrue(
                        all((start, end) != (f.start, f.end) for _, start, end in ranges)
                    )
                    apply_link_marks(
                        ranges, target, result, {"visual": 0}, f.reader, [f.checkpoint], f.state
                    )
                    self.assertIsNone(f.state.pending_uri_link)
                owner = result[0]
                urls = [s for s in owner.spans if s.url]
                self.assertEqual(
                    [(f.start, f.end, "https://www.example.test/chapter.htm")],
                    [(s.start, s.end, s.url) for s in urls],
                )
                self.assertIsNone(urls[0].style)
                styles = [s for s in owner.spans if s.style]
                self.assertEqual(1, len(styles))
                self.assertEqual(
                    f.owners[0].spans[0].model_dump(exclude={"url"}),
                    styles[0].model_dump(exclude={"url"}),
                )
                self.assertEqual(
                    f.owners[0].model_dump(exclude={"spans"}), owner.model_dump(exclude={"spans"})
                )
                self.assertEqual(original, f.owners[0].model_dump())
                self.assertEqual(source, f.source.read_bytes())
                self.assertEqual(observation, f.checkpoint.model_dump_json())
                self.assertTrue(
                    any(
                        x.code == "PDF_LINK_LITERAL_URI_SOURCE_CORROBORATED"
                        for x in f.state.structure_findings
                    )
                )
