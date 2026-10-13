"""Native echo hashes and compact decision catalogue bindings retain distinct authority."""

import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts.layout_hyphen import LayoutHyphenCandidate, candidate_digest
from ava_pdf_epub.contracts.layout_hyphen_authority_v3 import LayoutHyphenAuthorityV3
from ava_pdf_epub.contracts.layout_hyphen_classification_v3 import (
    NativeStructureHyphenClassificationReceipt,
)
from ava_pdf_epub.contracts.layout_normalization_v3 import LayoutNormalizationMapV3

from .layout_v3_fixtures import fixture_v3


class LayoutV3AuthorityTests(unittest.TestCase):
    def test_native_reuse_keeps_original_provider_candidate_digest(self):
        result = fixture_v3()
        authority = result.normalization.authorities[0]
        old = LayoutHyphenCandidate.model_validate(
            {**authority.candidate.model_dump(), "schema_version": "ava-layout-hyphen-candidate-1"}
        )
        receipt = NativeStructureHyphenClassificationReceipt(
            authority="native_structure",
            task_id="native-task",
            task_sha256="b" * 64,
            response_sha256="c" * 64,
            candidate_id=old.id,
            source_candidate_sha256=candidate_digest(old),
            decision="layout",
            original_candidate=old,
        )
        raw = authority.model_dump()
        raw["classification"] = receipt.model_dump()
        reused = LayoutHyphenAuthorityV3.model_validate(raw)
        self.assertEqual(candidate_digest(old), reused.classification.source_candidate_sha256)
        self.assertNotEqual(
            authority.classification.source_candidate_sha256,
            reused.classification.source_candidate_sha256,
        )
        raw["classification"]["source_candidate_sha256"] = (
            authority.classification.source_candidate_sha256
        )
        with self.assertRaisesRegex(ValidationError, "digest differs"):
            LayoutHyphenAuthorityV3.model_validate(raw)

    def test_foreign_owner_source_role_pair_and_offset_do_not_rebind_authority(self):
        result = fixture_v3()
        for path, value in (
            ("source_pdf_sha256", "e" * 64),
            ("owner_role", "caption"),
            ("source_text", "wrong"),
            ("input_text_sha256", "e" * 64),
        ):
            raw = result.normalization.model_dump()
            raw[path] = value
            with self.subTest(path=path), self.assertRaises(ValidationError):
                LayoutNormalizationMapV3.model_validate(raw)
        for key, value in (
            ("original_source_offset", 1),
            ("source_offset", 1),
            ("retained_left_line_start", 1),
        ):
            raw = result.normalization.model_dump()
            raw["authorities"][0][key] = value
            with self.subTest(key=key), self.assertRaises(ValidationError):
                LayoutNormalizationMapV3.model_validate(raw)

    def test_compact_receipt_cannot_advertise_another_candidate_digest(self):
        result = fixture_v3()
        raw = result.normalization.model_dump()
        raw["authorities"][0]["classification"]["source_candidate_sha256"] = "e" * 64
        with self.assertRaisesRegex(ValidationError, "digest differs"):
            LayoutNormalizationMapV3.model_validate(raw)
