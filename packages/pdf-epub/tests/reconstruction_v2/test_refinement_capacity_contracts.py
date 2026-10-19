"""Report and protocol capacity is gated by tagged current authority."""

import unittest

from pydantic import ValidationError

from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.continuation_report import ContinuationReconstructionReport
from ava_pdf_epub.reconstruction_v2.report import ReconstructionReport


def report(count=64):
    return dict(
        schema_version="ava-reconstruction-report-3",
        source_continuation_policy=POLICY,
        source_sha256="a" * 64,
        canonical_sha256="b" * 64,
        epub_sha256="c" * 64,
        resource_hashes={},
        profile_id="ava-pdf-prose-en-v2",
        outcome="candidate",
        page_count=1,
        recognition_task_count=0,
        checks={"finite_source_feature_dispositions_complete": "pass"},
        findings=[],
        refinement_evidence=[
            dict(
                task_id=f"refine-{i}",
                task_sha256="d" * 64,
                response_sha256="e" * 64,
                observation_sha256="f" * 64,
                node_ids=[f"owner-{i}"],
            )
            for i in range(count)
        ],
        source_feature_coverage=dict(
            policy_id="ava-ocr-source-features-1",
            requested_features=0,
            inspected_features=0,
            uninspected_features=0,
            unrequested_optional_candidates=0,
            evidence=[],
        ),
    )


class RefinementCapacityContractTests(unittest.TestCase):
    def test_tag3_retains64_receipts_and_requires_coverage_and_captured_policy(self):
        current = ContinuationReconstructionReport.model_validate(report())
        self.assertEqual(64, len(current.refinement_evidence))
        for changes in [
            dict(refinement_evidence=report(65)["refinement_evidence"]),
            dict(source_continuation_policy=None),
            dict(source_feature_coverage=None),
            dict(checks={}),
            dict(schema_version="ava-reconstruction-report-2"),
        ]:
            with self.subTest(changes=changes.keys()), self.assertRaises(ValidationError):
                ContinuationReconstructionReport.model_validate({**report(), **changes})

    def test_old_report_tags_still_reject_the33rd_receipt_and_new_policy(self):
        for tag in ["ava-reconstruction-report-1", "ava-reconstruction-report-2"]:
            value = {**report(32), "schema_version": tag}
            value.pop("source_continuation_policy")
            if tag.endswith("-1"):
                value.pop("source_feature_coverage")
                value["checks"] = {}
            self.assertEqual(
                32, len(ReconstructionReport.model_validate(value).refinement_evidence)
            )
            for changes in [
                dict(refinement_evidence=report(33)["refinement_evidence"]),
                dict(source_continuation_policy=POLICY),
            ]:
                with self.subTest(tag=tag), self.assertRaises(ValidationError):
                    ReconstructionReport.model_validate({**value, **changes})
