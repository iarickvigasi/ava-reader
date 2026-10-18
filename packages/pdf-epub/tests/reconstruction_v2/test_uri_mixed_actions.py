"""URI source authority cannot coexist with a competing original page destination."""

import tempfile
import unittest
from pathlib import Path

from pypdf.generic import ArrayObject, NameObject

from ava_pdf_epub.pdf_navigation import pdf_navigation
from ava_pdf_epub.reconstruction_v2.source_uri_caller import source_uri_caller

from .uri_caller_fixture import fixture


class UriMixedActionTests(unittest.TestCase):
    def test_competing_dest_on_current_or_peer_member_refuses_the_whole_group(self):
        for index in (0, 1):
            with self.subTest(member=index), tempfile.TemporaryDirectory() as d:
                f = fixture(Path(d))
                self.addCleanup(f.reader.close)
                annotation, caller = f.annotation(0)
                target = pdf_navigation(f.reader, annotation)
                member, _ = f.annotation(index)
                member[NameObject("/Dest")] = ArrayObject(
                    [f.reader.pages[0].indirect_reference, NameObject("/Fit")]
                )
                self.assertIsNone(
                    source_uri_caller(f.reader, target, annotation, caller, f.context, f.state)
                )
                self.assertIsNone(f.state.pending_uri_link)
