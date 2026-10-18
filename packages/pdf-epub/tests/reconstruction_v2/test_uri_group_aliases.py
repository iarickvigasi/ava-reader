"""A bare-www source may derive a scheme; explicit HTTP and HTTPS never become aliases."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.pdf_navigation import pdf_navigation
from ava_pdf_epub.reconstruction_v2.pdf_link_marks import apply_link_marks
from ava_pdf_epub.reconstruction_v2.source_uri_caller import source_uri_caller

from .uri_caller_fixture import fixture


class UriGroupAliasTests(unittest.TestCase):
    def test_explicit_https_source_does_not_allow_a_different_http_model_url(self):
        with tempfile.TemporaryDirectory() as d:
            f = fixture(
                Path(d),
                raw="https://example.test/chapter.htm",
                url="http://example.test/chapter.htm",
            )
            self.addCleanup(f.reader.close)
            a, b = f.annotation(0)
            target = pdf_navigation(f.reader, a)
            self.assertFalse(target.derived_scheme)
            ranges = source_uri_caller(f.reader, target, a, b, f.context, f.state)
            self.assertIsNotNone(ranges)
            with self.assertRaisesRegex(ValueError, "TEXT_MAPPING"):
                apply_link_marks(
                    ranges, target, list(f.owners), {"visual": 0}, f.reader, [f.checkpoint], f.state
                )
            self.assertIsNone(f.state.pending_uri_link)

    def test_absent_model_link_gets_one_complete_source_group_link(self):
        with tempfile.TemporaryDirectory() as d:
            f = fixture(Path(d))
            self.addCleanup(f.reader.close)
            f.owners[0] = f.owners[0].model_copy(update={"spans": []})
            f.context.owners = list(f.owners)
            a, b = f.annotation(0)
            target = pdf_navigation(f.reader, a)
            ranges = source_uri_caller(f.reader, target, a, b, f.context, f.state)
            result = list(f.owners)
            apply_link_marks(
                ranges, target, result, {"visual": 0}, f.reader, [f.checkpoint], f.state
            )
            self.assertEqual(
                [(f.start, f.end, target.url)], [(s.start, s.end, s.url) for s in result[0].spans]
            )

    def test_already_exact_canonical_styled_link_is_unchanged(self):
        with tempfile.TemporaryDirectory() as d:
            f = fixture(Path(d), url="https://www.example.test/chapter.htm")
            self.addCleanup(f.reader.close)
            before = f.owners[0].model_dump_json()
            a, b = f.annotation(0)
            target = pdf_navigation(f.reader, a)
            ranges = source_uri_caller(f.reader, target, a, b, f.context, f.state)
            result = list(f.owners)
            apply_link_marks(
                ranges, target, result, {"visual": 0}, f.reader, [f.checkpoint], f.state
            )
            self.assertEqual(before, result[0].model_dump_json())
