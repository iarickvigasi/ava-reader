"""The public text union preserves explicit authority and refuses malformed maps."""

import copy
import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts.inline_text import TextValue
from ava_pdf_epub.contracts.layout_normalization import LayoutNormalizationMap
from ava_pdf_epub.contracts.selection_mapping import source_range_to_utf16

from .helpers import block, fixture
from .layout_normalization_helpers import normalized_content


class LayoutNormalizationTextTests(unittest.TestCase):
    def authored_text(self):
        raw = fixture()
        return normalized_content(block(raw, "body-one")["content"], raw["source"]["sha256"])

    def test_public_union_resolves_new_marker_and_source_utf16_without_repair(self):
        content = TextValue.model_validate(self.authored_text())
        self.assertIsInstance(content.normalization, LayoutNormalizationMap)
        source = content.normalization.source_text
        first, last = source.index("😀"), source.index("😀") + 1
        self.assertEqual((1, 2, 1, 3), source_range_to_utf16(content, first, last))
        changed = content.normalization.candidates[0].source_start
        with self.assertRaisesRegex(ValueError, "ambiguous"):
            source_range_to_utf16(content, changed, changed + 1)
        again = TextValue.model_validate_json(content.model_dump_json())
        self.assertEqual(content, again)

    def test_raw_canonical_and_pdf_receipt_hash_malformations_refuse(self):
        original = self.authored_text()
        for path in (
            ("sha256",),
            ("normalization", "source_sha256"),
            ("normalization", "source_pdf_sha256"),
        ):
            with self.subTest(path=path):
                raw = copy.deepcopy(original)
                node = raw
                for key in path[:-1]:
                    node = node[key]
                node[path[-1]] = "b" * 64
                with self.assertRaises(ValidationError):
                    TextValue.model_validate(raw)
        raw = copy.deepcopy(original)
        raw["normalization"]["source_text"] += "!"
        with self.assertRaises(ValidationError):
            TextValue.model_validate(raw)

    def test_new_authority_cannot_hide_under_missing_or_historical_marker(self):
        original = self.authored_text()
        for version in (None, "ava-source-normalization-1", "ava-source-normalization-999"):
            with self.subTest(version=version):
                raw = copy.deepcopy(original)
                if version is None:
                    raw["normalization"].pop("schema_version")
                else:
                    raw["normalization"]["schema_version"] = version
                with self.assertRaises(ValidationError):
                    TextValue.model_validate(raw)

    def test_new_map_cannot_launder_a_changed_letter_through_the_public_union(self):
        raw = self.authored_text()
        raw["text"] = raw["text"].replace("office", "offixe")
        from ava_pdf_epub.contracts.common import text_digest

        raw["sha256"] = text_digest(raw["text"])
        with self.assertRaisesRegex(ValidationError, "does not produce canonical"):
            TextValue.model_validate(raw)
