"""Refused original actions retain location and finite cause, never source data."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.pdf_link_application import apply_pdf_links
from ava_pdf_epub.reconstruction_v2.source_link_refusal import SourceLinkRefusal
from ava_pdf_epub.worker_observation_packet import failure

from .source_link_fixture import fixture


class SourceLinkRefusalTests(unittest.TestCase):
    def test_original_annotation_ordinal_is_not_filtered_link_ordinal(self):
        with tempfile.TemporaryDirectory() as directory:
            source, checkpoint, owner = fixture(Path(directory))
            before = owner.model_dump_json(), checkpoint.model_dump_json()
            with patch(
                "ava_pdf_epub.reconstruction_v2.pdf_link_caller.ocr_pdf_caller",
                side_effect=[
                    [(owner.id, 0, len(owner.text))],
                    ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW"),
                ],
            ):
                with self.assertRaises(SourceLinkRefusal) as caught:
                    apply_pdf_links(source, [checkpoint], [owner], AssemblyState(), source.parent)
            error = caught.exception
            self.assertEqual("caller", error.finding.link_step)
            self.assertEqual(3, error.finding.annotation_number)
            self.assertEqual("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW", error.finding.code)
            self.assertEqual(
                document_digest(checkpoint.observation), error.finding.observation_sha256
            )
            self.assertEqual(before, (owner.model_dump_json(), checkpoint.model_dump_json()))
            self.assertIsInstance(error.__cause__, ValueError)
            code, findings, complete = failure(error, checkpoint.source_sha256)
            self.assertEqual("RECONSTRUCTION_REVIEW_REQUIRED", code)
            self.assertTrue(complete)
            self.assertEqual(3, findings[0]["annotation_number"])
            self.assertEqual((code, [], False), failure(error, "b" * 64))

    def test_navigation_and_application_failures_remain_terminal_with_distinct_steps(self):
        for target, step, cause in (
            ("pdf_navigation", "navigation", "PDF_LINK_ACTION_REQUIRES_REVIEW"),
            ("apply_link_marks", "application", "PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW"),
        ):
            with self.subTest(step=step), tempfile.TemporaryDirectory() as directory:
                source, checkpoint, owner = fixture(Path(directory))
                with (
                    patch(
                        "ava_pdf_epub.reconstruction_v2.pdf_link_application.pdf_link_caller",
                        return_value=[(owner.id, 0, len(owner.text))],
                    ),
                    patch(
                        "ava_pdf_epub.reconstruction_v2.pdf_link_application." + target,
                        side_effect=ValueError(cause),
                    ),
                    self.assertRaises(SourceLinkRefusal) as caught,
                ):
                    apply_pdf_links(source, [checkpoint], [owner], AssemblyState(), source.parent)
                self.assertEqual(step, caught.exception.finding.link_step)
                self.assertEqual(cause, caught.exception.finding.code)
                self.assertEqual(2, caught.exception.finding.annotation_number)

    def test_unknown_errors_and_forged_diagnostics_never_export_raw_values(self):
        with tempfile.TemporaryDirectory() as directory:
            source, checkpoint, owner = fixture(Path(directory))
            for original in (
                ValueError("PRIVATE_BOOK sk-secret https://private.example"),
                RuntimeError("PRIVATE_BOOK sk-secret"),
            ):
                with (
                    patch(
                        "ava_pdf_epub.reconstruction_v2.pdf_link_application.pdf_link_caller",
                        side_effect=original,
                    ),
                    self.assertRaises(SourceLinkRefusal) as caught,
                ):
                    apply_pdf_links(source, [checkpoint], [owner], AssemblyState(), source.parent)
                error = caught.exception
                self.assertEqual("SOURCE_LINK_UNEXPECTED_FAILURE", error.finding.code)
                self.assertIs(error.__cause__, original)
                projected = str(failure(error, checkpoint.source_sha256))
                for secret in (owner.text, "sk-secret", "https://", str(source)):
                    self.assertNotIn(secret, projected)
                error.finding = error.finding.model_copy(update={"link_step": "PRIVATE_BOOK"})
                with self.assertRaises(ValueError):
                    failure(error, checkpoint.source_sha256)
