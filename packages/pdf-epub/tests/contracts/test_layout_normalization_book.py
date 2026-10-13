"""Whole-book PDF identity covers prose, list/note/caption and nested table text."""

import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.contracts.graph_index import index_book
from ava_pdf_epub.contracts.layout_normalization import LayoutNormalizationMap

from .helpers import fixture
from .layout_normalization_helpers import holder, normalized_content

HOLDERS = ("body-one", "heading-one", "list-child", "note-one", "caption-one", "cell-11")


class LayoutNormalizationBookTests(unittest.TestCase):
    def test_every_text_path_accepts_the_owned_pdf_without_changing_graph_text(self):
        original = CanonicalBookV2.model_validate(fixture())
        raw = fixture()
        for identity in HOLDERS:
            node = holder(raw, identity)
            node["content"] = normalized_content(node["content"], raw["source"]["sha256"])
        book = CanonicalBookV2.model_validate(raw)
        before, _ = index_book(original)
        after, _ = index_book(book)
        for identity in HOLDERS:
            with self.subTest(identity=identity):
                self.assertIsInstance(after[identity].content.normalization, LayoutNormalizationMap)
                self.assertEqual(before[identity].content.text, after[identity].content.text)
                self.assertEqual(before[identity].content.spans, after[identity].content.spans)
        self.assertEqual(original.addresses, book.addresses)
        self.assertEqual(original.toc, book.toc)
        again = CanonicalBookV2.model_validate_json(book.model_dump_json())
        self.assertEqual(book, again)
        self.assertEqual(document_digest(book), document_digest(again))

    def test_self_consistent_foreign_receipt_refuses_in_each_text_path(self):
        for identity in HOLDERS:
            with self.subTest(identity=identity):
                raw = fixture()
                node = holder(raw, identity)
                node["content"] = normalized_content(node["content"], "b" * 64)
                # The local map is valid; only the owning book establishes PDF authority.
                LayoutNormalizationMap.model_validate(node["content"]["normalization"])
                with self.assertRaisesRegex(ValidationError, "another source PDF"):
                    CanonicalBookV2.model_validate(raw)

    def test_historical_map_serialization_and_graph_digest_stay_identical(self):
        raw = fixture()
        book = CanonicalBookV2.model_validate(raw)
        first = book.model_dump_json()
        again = CanonicalBookV2.model_validate_json(first)
        self.assertEqual(first, again.model_dump_json())
        self.assertEqual(document_digest(book), document_digest(again))
        self.assertEqual(
            raw["blocks"][1]["content"]["normalization"],
            book.blocks[1].content.normalization.model_dump(mode="json"),
        )
        self.assertNotIn("schema_version", book.blocks[1].content.normalization.model_dump())
