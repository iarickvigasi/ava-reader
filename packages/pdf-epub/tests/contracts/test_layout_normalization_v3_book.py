"""Public Map3 validates the owned PDF on every indexed canonical text path."""

import re
import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.contracts.inline_text import TextValue
from ava_pdf_epub.contracts.layout_normalization_v3 import LayoutNormalizationMapV3

from ..reconstruction_v2.layout_v3_fixtures import fixture_v3
from .helpers import fixture
from .layout_normalization_helpers import holder


def mapped_content(node, role):
    content = node["content"]
    text = content["text"]
    match = re.search(r"[^\W\d_]{2,}", text)
    at = match.start() + 1
    result = fixture_v3(text[:at] + "-", text[at:], role=role)
    assert result.text == text
    return {**content, "normalization": result.normalization.model_dump(mode="json")}


class LayoutV3BookTests(unittest.TestCase):
    def test_public_union_preserves_graph_spans_and_all_supported_owner_paths(self):
        raw = fixture()
        roles = {
            "body-one": "paragraph",
            "heading-one": "heading",
            "caption-one": "caption",
            "list-child": "list_item",
            "note-one": "note",
            "cell-11": "paragraph",
        }
        before = CanonicalBookV2.model_validate(raw)
        for identity, role in roles.items():
            node = holder(raw, identity)
            node["content"] = mapped_content(node, role)
        book = CanonicalBookV2.model_validate(raw)
        self.assertEqual(before.addresses, book.addresses)
        self.assertEqual(before.toc, book.toc)
        self.assertEqual(book, CanonicalBookV2.model_validate_json(book.model_dump_json()))
        for identity in roles:
            self.assertIsInstance(
                TextValue.model_validate(holder(raw, identity)["content"]).normalization,
                LayoutNormalizationMapV3,
            )

    def test_self_consistent_foreign_pdf_map_refuses_even_in_nested_cell(self):
        for identity in ("body-one", "caption-one", "note-one", "list-child", "cell-11"):
            with self.subTest(identity=identity):
                raw = fixture()
                node = holder(raw, identity)
                role = "paragraph" if identity == "cell-11" else node["kind"]
                node["content"] = mapped_content(node, role)
                mapping = node["content"]["normalization"]
                mapping["source_pdf_sha256"] = "e" * 64
                authority = mapping["authorities"][0]
                authority["candidate"]["source_sha256"] = "e" * 64
                from ava_pdf_epub.contracts.layout_hyphen_v3 import (
                    LayoutHyphenCandidateV2,
                    candidate_digest_v2,
                )

                authority["classification"]["source_candidate_sha256"] = candidate_digest_v2(
                    LayoutHyphenCandidateV2.model_validate(authority["candidate"])
                )
                LayoutNormalizationMapV3.model_validate(mapping)
                with self.assertRaisesRegex(ValidationError, "another source PDF"):
                    CanonicalBookV2.model_validate(raw)

    def test_map3_cannot_change_canonical_characters_through_public_union(self):
        raw = fixture()
        content = mapped_content(holder(raw, "caption-one"), "caption")
        content["text"] = content["text"].replace("window", "widnow")
        content["sha256"] = text_digest(content["text"])
        with self.assertRaisesRegex(ValidationError, "does not produce canonical"):
            TextValue.model_validate(content)
