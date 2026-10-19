"""An all-OCR model rank is not a successful whole-book source check."""

import json
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfWriter

from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.report import reconstruction_report

FIXTURES = Path(__file__).parent / "fixtures"


def candidate(source, responses, scratch):
    pages = [prepare_page(source, scratch, number) for number in (1, 2, 3)]
    # These are independently authored responses, not edited live model receipts.
    values = []
    for raw, page in zip(responses, pages, strict=True):
        task = page.tasks[0]
        values.append(
            RecognitionResponse.model_validate(
                {
                    **raw,
                    "task_id": task.task_id,
                    "source_sha256": task.source_sha256,
                    "render_sha256": task.image.sha256,
                }
            )
        )
    result = reconstruct(source, scratch, pages, values)
    return result, reconstruction_report(result, 3)


class StructureEvidenceTest(unittest.TestCase):
    def test_correct_and_faulted_unverified_ranks_are_never_silently_certified(self):
        source = FIXTURES / "ocr-hierarchy.pdf"
        for variant in ("correct", "fault"):
            responses = json.loads((FIXTURES / f"ocr-hierarchy-{variant}.json").read_text())
            with tempfile.TemporaryDirectory() as directory:
                result, report = candidate(source, responses, Path(directory))
            self.assertEqual("not_run", report.checks["source_structure_signals_consistent"])
            self.assertEqual(8, len(report.findings))
            self.assertTrue(all(f.severity == "blocking" for f in report.findings))
            self.assertTrue(all(f.code == "OCR_HIERARCHY_UNCORROBORATED" for f in report.findings))
            headings = {b.content.text: b.level for b in result.book.blocks if b.kind == "heading"}
            self.assertEqual(
                3 if variant == "correct" else 2, headings["The eastern narrow channel"]
            )
            self.assertEqual(
                set(f.block_id for f in report.findings),
                {b.id for b in result.book.blocks if b.kind == "heading"},
            )

    def test_complete_source_outline_corroborates_ocr_without_blanket_refusal(self):
        oracle = json.loads((FIXTURES / "ocr-hierarchy-oracle.json").read_text())
        responses = json.loads((FIXTURES / "ocr-hierarchy-correct.json").read_text())
        writer = PdfWriter(clone_from=str(FIXTURES / "ocr-hierarchy.pdf"))
        ancestors = {}
        for page in oracle["pages"]:
            for block in page["blocks"]:
                if block["kind"] != "heading":
                    continue
                level = block["level"]
                ancestors[level] = writer.add_outline_item(
                    block["text"], page["number"] - 1, parent=ancestors.get(level - 1)
                )
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "outlined.pdf"
            writer.write(source)
            _, report = candidate(source, responses, Path(directory) / "scratch")
        self.assertEqual("pass", report.checks["source_structure_signals_consistent"])
        self.assertEqual([], report.findings)
