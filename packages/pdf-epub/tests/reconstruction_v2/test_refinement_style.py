"""Provider grammar must express the typography invariants accepted by reconstruction."""

import unittest

from ava_pdf_epub.reconstruction_v2.refinement_contract import RefinementDecision


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
