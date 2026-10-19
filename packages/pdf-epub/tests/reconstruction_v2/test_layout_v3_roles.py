"""New supported roles use new authority while legacy role and map schemas stay closed."""

import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts.layout_hyphen import LayoutHyphenCandidate
from ava_pdf_epub.contracts.layout_hyphen_v3 import LayoutHyphenCandidateV2
from ava_pdf_epub.contracts.layout_normalization import LayoutNormalizationMap
from ava_pdf_epub.contracts.layout_normalization_v3 import LayoutNormalizationMapV3

from .layout_v3_fixtures import fixture_v3


class LayoutV3RoleTests(unittest.TestCase):
    def test_all_declared_reflow_roles_preserve_original_task_and_response_hashes(self):
        for role in ("paragraph", "note", "list_item", "heading", "caption", "credit", "quote"):
            with self.subTest(role=role):
                result = fixture_v3(role=role)
                self.assertEqual("possessing", result.text)
                receipt = result.normalization.authorities[0].classification
                self.assertEqual("b" * 64, receipt.task_sha256)
                self.assertEqual("c" * 64, receipt.response_sha256)
                self.assertEqual("d" * 64, receipt.catalogue_sha256)
                again = LayoutNormalizationMapV3.model_validate_json(
                    result.normalization.model_dump_json()
                )
                self.assertEqual(result.normalization, again)
                again.validate_canonical(result.text)

    def test_literal_compound_and_unicode_scalar_identity_remain_source_exact(self):
        result = fixture_v3("well-", "known gym-lovers Lottery-Playing", decision="literal")
        self.assertEqual("well-known gym-lovers Lottery-Playing", result.text)
        result = fixture_v3("café-", "teria 😀")
        self.assertEqual("caféteria 😀", result.text)
        self.assertNotIn("é", result.text)

    def test_old_markers_cannot_acquire_new_roles_or_authority(self):
        result = fixture_v3(role="caption")
        candidate = result.normalization.authorities[0].candidate.model_dump()
        candidate["schema_version"] = "ava-layout-hyphen-candidate-1"
        with self.assertRaises(ValidationError):
            LayoutHyphenCandidate.model_validate(candidate)
        with self.assertRaises(ValidationError):
            LayoutNormalizationMap.model_validate(result.normalization.model_dump())
        for role in ("code", "verse"):
            with self.assertRaises(ValidationError):
                LayoutHyphenCandidateV2.model_validate(
                    {**candidate, "schema_version": "ava-layout-hyphen-candidate-2", "role": role}
                )

    def test_unresolved_source_reading_does_not_produce_a_map(self):
        with self.assertRaisesRegex(ValidationError, "unresolved"):
            fixture_v3("re-", "cover", decision="unresolved")
