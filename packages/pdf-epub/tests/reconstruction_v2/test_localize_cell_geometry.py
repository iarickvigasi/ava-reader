"""Authored command controls; genuine installed engine qualification is separate."""

import base64
import json
import unittest
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.localize_cell_geometry import localize_cell_geometry
from ava_pdf_epub.reconstruction_v2.recognition_cell_geometry_contract import (
    RecognitionCellGeometryResponse,
)
from ava_pdf_epub.reconstruction_v2.recognition_cell_geometry_repair import (
    apply_cell_geometry_repair,
)

from .cell_ocr_fixture import ocr_fixture, pinned_neighbor_fixture, target, tsv

MODULE = "ava_pdf_epub.reconstruction_v2.localize_cell_geometry."


class LocalizeCellGeometryTests(unittest.TestCase):
    def setUp(self):
        self.parent, self.task = ocr_fixture()
        self.request = dict(
            mode="localize_cell_geometry",
            method="ava-cell-exact-line-ocr-1",
            original=self.parent.model_dump(mode="json"),
            task=self.task.model_dump(mode="json"),
        )

    def run_local(self, payload):
        with (
            patch(MODULE + "_file_digest", return_value="e" * 64),
            patch(MODULE + "_run_ocr", return_value=payload),
        ):
            return localize_cell_geometry(json_bytes(self.request))

    def test_proved_response_changes_only_one_box_with_complete_validation(self):
        payload = tsv([target()])
        result = self.run_local(payload)
        self.assertEqual(
            ("LOCAL_OCR", "PROVED", None), (result["origin"], result["status"], result["reason"])
        )
        self.assertEqual(payload, base64.b64decode(result["tsv_base64"], validate=True))
        response = RecognitionCellGeometryResponse.model_validate_json(result["response_json"])
        corrected = apply_cell_geometry_repair(self.parent, self.task, response)
        expected = json.loads(self.task.original_response_json)
        expected["segments"][0]["cells"][0][0]["box"] = response.patches[0].box.model_dump(
            mode="json"
        )
        self.assertEqual(expected, corrected)

    def test_no_proof_is_not_a_public_unresolved_response(self):
        result = self.run_local(tsv([target(20)]))
        self.assertEqual("NO_PROOF", result["status"])
        self.assertIsNone(result["response_json"])
        self.assertIsNone(result["response_sha256"])

    def test_ocr_unavailable_has_explicit_nonproof_disposition(self):
        with (
            patch(MODULE + "_file_digest", return_value="e" * 64),
            patch(MODULE + "_run_ocr", side_effect=ValueError("private")),
        ):
            result = localize_cell_geometry(json_bytes(self.request))
        self.assertEqual(("NO_PROOF", "OCR_UNAVAILABLE"), (result["status"], result["reason"]))

    def test_bounded_unsupported_evidence_is_clean_nonproof(self):
        result = self.run_local(b"x" * 262145)
        self.assertEqual(("NO_PROOF", "OCR_EVIDENCE_BOUND"), (result["status"], result["reason"]))
        self.assertIsNone(result["response_json"])

    def test_corrupt_task_method_or_original_never_reaches_ocr(self):
        for key in ("method", "task", "original", "extra"):
            request = json.loads(json.dumps(self.request))
            if key == "method":
                request[key] = "unknown"
            elif key == "extra":
                request[key] = True
            else:
                request[key]["source_sha256"] = "f" * 64
            with self.subTest(key=key), patch(MODULE + "_run_ocr") as run:
                with self.assertRaises(ValueError):
                    localize_cell_geometry(json_bytes(request))
                run.assert_not_called()

    def test_physical_line_order_and_vertical_overlap_are_required(self):
        parent, task = ocr_fixture("Left Right")
        self.request.update(
            original=parent.model_dump(mode="json"), task=task.model_dump(mode="json")
        )
        for label, rows in (
            (
                "reversed",
                [(1, 1, 1, 60, 20, 20, 20, 97, "Left"), (1, 1, 2, 20, 20, 20, 20, 97, "Right")],
            ),
            (
                "horizontal-overlap",
                [(1, 1, 1, 20, 20, 30, 20, 97, "Left"), (1, 1, 2, 40, 20, 30, 20, 97, "Right")],
            ),
            (
                "disjoint",
                [(1, 1, 1, 20, 20, 20, 20, 97, "Left"), (1, 1, 2, 50, 60, 20, 20, 97, "Right")],
            ),
            (
                "touching-vertical",
                [(1, 1, 1, 20, 20, 20, 20, 97, "Left"), (1, 1, 2, 50, 40, 20, 20, 97, "Right")],
            ),
        ):
            with self.subTest(label=label):
                result = self.run_local(tsv(rows))
                self.assertEqual("NO_PROOF", result["status"])
                self.assertIsNone(result["response_json"])
        result = self.run_local(
            tsv([(1, 1, 1, 20, 20, 20, 20, 97, "Left"), (1, 1, 2, 50, 21, 20, 20, 97, "Right")])
        )
        self.assertEqual("PROVED", result["status"])

    def test_pinned_neighbor_with_unresolved_box_cannot_be_silently_skipped(self):
        parent, task = pinned_neighbor_fixture()
        self.request.update(
            original=parent.model_dump(mode="json"), task=task.model_dump(mode="json")
        )
        result = self.run_local(tsv([(1, 1, 1, 0, 0, 901, 1000, 97, "Target")]))
        self.assertEqual("NO_PROOF", result["status"])
        self.assertIsNone(result["response_json"])

    def test_bilingual_profile_records_exact_installed_languages_and_assets(self):
        parent, task = ocr_fixture(profile_id="ava-pdf-prose-en-uk-v3")
        self.request.update(
            original=parent.model_dump(mode="json"), task=task.model_dump(mode="json")
        )
        with (
            patch(MODULE + "_file_digest", return_value="e" * 64) as digest,
            patch(MODULE + "_run_ocr", return_value=tsv([target()])) as run,
        ):
            result = localize_cell_geometry(json_bytes(self.request))
        self.assertEqual("PROVED", result["status"])
        self.assertEqual("eng+ukr", result["languages"])
        self.assertEqual(2, len(result["traineddata_sha256"]))
        self.assertEqual("eng+ukr", run.call_args.args[1])
        self.assertEqual(
            ["tesseract", "eng.traineddata", "ukr.traineddata"],
            [call.args[0].name for call in digest.call_args_list],
        )

    def test_mutated_temporary_source_is_terminal_even_when_ocr_fails(self):
        for failure in (False, True):

            def mutate(path, languages, failure=failure):
                path.chmod(0o600)
                path.write_bytes(b"changed")
                if failure:
                    raise ValueError("OCR process failed")
                return tsv([target()])

            with (
                self.subTest(ocr_failure=failure),
                patch(MODULE + "_file_digest", return_value="e" * 64),
                patch(MODULE + "_run_ocr", side_effect=mutate),
            ):
                with self.assertRaisesRegex(RuntimeError, "CELL_OCR_SOURCE_IMAGE_CHANGED"):
                    localize_cell_geometry(json_bytes(self.request))
