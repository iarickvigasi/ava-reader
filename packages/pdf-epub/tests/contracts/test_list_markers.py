import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts import ReaderPackageV3
from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.contracts.structure import ListGroup

from .helpers import fixture


class ListMarkerTests(unittest.TestCase):
    def test_omitted_extension_preserves_historical_reader_digest(self):
        raw = fixture("ava-reader-3")
        reader = ReaderPackageV3.model_validate(raw)
        self.assertEqual(document_digest(reader.book), raw["canonical_sha256"])
        for group in reader.book.lists:
            self.assertNotIn("marker_style", group.model_dump())

    def test_marker_semantics_are_explicit_and_bounded(self):
        raw = dict(id="list", ordered=True, start=1, depth=1, item_ids=["item"])
        for marker in ["decimal", "lower-alpha", "upper-alpha", "lower-roman", "upper-roman"]:
            group = ListGroup.model_validate({**raw, "marker_style": marker})
            self.assertEqual(group.model_dump()["marker_style"], marker)
        for mutation in [
            dict(marker_style="bullet"),
            dict(marker_style="url(evil)"),
            dict(ordered=False, marker_style="lower-alpha"),
        ]:
            with self.subTest(mutation=mutation), self.assertRaises(ValidationError):
                ListGroup.model_validate({**raw, **mutation})
        ListGroup.model_validate({**raw, "ordered": False, "start": None, "marker_style": "bullet"})
