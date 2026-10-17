"""Provider grammar must express the typography invariants accepted by reconstruction."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.refinement_contract import (
    OcrRefinementDecision,
    RefinementDecision,
    RefinementStyle,
)


class RefinementStyleTest(unittest.TestCase):
    def decision(self, style):
        return dict(
            node_id="heading",
            text_sha256="a" * 64,
            evidence_ids=["crop-heading"],
            heading_level=2,
            parent_id="chapter",
            chapter_start=False,
            chapter_role=None,
            style=style,
        )

    def test_wire_rejects_invented_ids_and_missing_or_null_required_observations(self):
        valid = dict(id="observed", relative_size=1, bold=False)
        invalid = [
            {**valid, "id": "style-ch1"},
            {**valid, "relative_size": None},
            {**valid, "bold": None},
            {key: value for key, value in valid.items() if key != "relative_size"},
            {key: value for key, value in valid.items() if key != "bold"},
            {key: value for key, value in valid.items() if key != "id"},
        ]
        for style in invalid:
            with self.subTest(style=style), self.assertRaises(ValueError):
                RefinementDecision.model_validate(self.decision(style))

    def test_regular_baseline_and_sparse_unknowns_survive_without_defaults(self):
        value = RefinementDecision.model_validate(
            self.decision(dict(id="observed", relative_size=1, bold=False))
        )
        self.assertFalse(value.style.bold)
        self.assertEqual(1, value.style.relative_size)
        self.assertIsNone(value.style.italic)
        self.assertIsNone(value.style.line_height)


class OcrWireStyle(unittest.TestCase):
    def test_ocr_style_is_required_and_null_is_rejected_by_wire_model(self):
        value = RefinementStyleTest().decision(None)
        with self.assertRaises(ValueError):
            OcrRefinementDecision.model_validate(value)


class BodyReferenceBaseline(unittest.TestCase):
    def test_source_body_reference_must_stay_at_baseline_one(self):
        from ava_pdf_epub.reconstruction_v2.refinement_response import accept_refinement

        from .observed_refinement import observed_case, observed_decisions

        with tempfile.TemporaryDirectory() as directory:
            _, _, tasks = observed_case(Path(directory))
            receipts = observed_decisions(tasks)
            checked = 0
            for task, response in zip(tasks, receipts, strict=True):
                body_ids = {n.body_reference_id for n in task.nodes if n.body_reference_id}
                for index, decision in enumerate(response.decisions):
                    if decision.node_id not in body_ids:
                        continue
                    changed = list(response.decisions)
                    changed[index] = decision.model_copy(
                        update={
                            "style": RefinementStyle(id="observed", relative_size=1.2, bold=False)
                        }
                    )
                    with self.assertRaisesRegex(ValueError, "size baseline"):
                        accept_refinement(task, response.model_copy(update={"decisions": changed}))
                    checked += 1
            self.assertGreater(checked, 0)
