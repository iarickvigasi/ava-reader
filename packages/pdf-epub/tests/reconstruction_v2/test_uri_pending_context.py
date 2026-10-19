"""An immediate URI handoff must retain its reader, complete source group and policy."""

import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader

from ava_pdf_epub.pdf_navigation import pdf_navigation
from ava_pdf_epub.reconstruction_v2.pdf_link_marks import apply_link_marks
from ava_pdf_epub.reconstruction_v2.source_uri_caller import source_uri_caller

from .uri_caller_fixture import fixture


class UriPendingContextTests(unittest.TestCase):
    def test_changed_reader_group_or_policy_cannot_consume_old_authority(self):
        for change in ("reader", "group", "policy"):
            with self.subTest(change=change), tempfile.TemporaryDirectory() as d:
                f = fixture(Path(d))
                self.addCleanup(f.reader.close)
                a, b = f.annotation(0)
                target = pdf_navigation(f.reader, a)
                ranges = source_uri_caller(f.reader, target, a, b, f.context, f.state)
                self.assertIsNotNone(ranges)
                reader = f.reader
                if change == "reader":
                    reader = PdfReader(f.source)
                    self.addCleanup(reader.close)
                if change == "group":
                    f.reader.pages[0]["/Annots"].pop(1)
                if change == "policy":
                    f.state.source_continuation_policy = None
                with self.assertRaisesRegex(ValueError, "TEXT_MAPPING"):
                    apply_link_marks(
                        ranges,
                        target,
                        list(f.owners),
                        {"visual": 0},
                        reader,
                        [f.checkpoint],
                        f.state,
                    )
                self.assertIsNone(f.state.pending_uri_link)
