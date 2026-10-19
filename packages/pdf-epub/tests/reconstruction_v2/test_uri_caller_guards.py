"""A literal-source subspan never becomes a guessed substring or action permission."""

import tempfile
import unittest
from pathlib import Path

from pypdf.generic import DictionaryObject, NameObject

from ava_pdf_epub.pdf_navigation import NavigationTarget, pdf_navigation
from ava_pdf_epub.reconstruction_v2.pdf_link_page import LinkPage
from ava_pdf_epub.reconstruction_v2.source_uri_caller import source_uri_caller

from .uri_caller_fixture import fixture


class UriCallerGuardTests(unittest.TestCase):
    def test_nonmember_wrong_target_changed_caller_and_unsafe_action_decline(self):
        with tempfile.TemporaryDirectory() as d:
            f = fixture(Path(d))
            self.addCleanup(f.reader.close)
            a, b = f.annotation(0)
            target = pdf_navigation(f.reader, a)
            self.assertIsNone(source_uri_caller(f.reader, target, dict(a), b, f.context, f.state))
            self.assertIsNone(
                source_uri_caller(
                    f.reader, NavigationTarget(url="https://other.test"), a, b, f.context, f.state
                )
            )
            self.assertIsNone(
                source_uri_caller(
                    f.reader, target, a, b.model_copy(update={"x0": b.x0 + 1}), f.context, f.state
                )
            )
            a[NameObject("/AA")] = DictionaryObject()
            self.assertIsNone(source_uri_caller(f.reader, target, a, b, f.context, f.state))
            del a[NameObject("/AA")]
            a["/A"][NameObject("/Next")] = DictionaryObject()
            self.assertIsNone(source_uri_caller(f.reader, target, a, b, f.context, f.state))
            del a["/A"][NameObject("/Next")]
            f.reader.pages[0]["/Annots"].pop(1)
            self.assertIsNone(source_uri_caller(f.reader, target, a, b, f.context, f.state))

    def test_extra_or_changed_text_and_competing_ownership_remain_unproved(self):
        with tempfile.TemporaryDirectory() as d:
            f = fixture(Path(d))
            self.addCleanup(f.reader.close)
            a, b = f.annotation(0)
            target = pdf_navigation(f.reader, a)
            owner = f.owners[0]
            for owners in [
                [owner.model_copy(update={"text": owner.text.replace("Visit www", "Visit xwww")})],
                [
                    owner.model_copy(
                        update={"text": owner.text.replace("chapter.htm.", "chapter.htm/x.")}
                    )
                ],
                [owner.model_copy(update={"text": owner.text + " www.example.test/\nchapter.htm"})],
                [owner, owner.model_copy(update={"id": "competitor"})],
                [owner.model_copy(update={"native_line_ids": ["fake"]})],
            ]:
                self.assertIsNone(
                    source_uri_caller(
                        f.reader, target, a, b, LinkPage(f.checkpoint, owners), f.state
                    )
                )
            page = f.checkpoint.observation.model_copy(update={"risks": ["unknown"]})
            self.assertIsNone(
                source_uri_caller(
                    f.reader,
                    target,
                    a,
                    b,
                    LinkPage(f.checkpoint.model_copy(update={"observation": page}), f.owners),
                    f.state,
                )
            )
