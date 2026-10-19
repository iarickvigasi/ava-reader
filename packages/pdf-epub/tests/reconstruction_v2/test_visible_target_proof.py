"""An unrelated ink risk may not block a complete literal destination or mutate evidence."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.ocr_glyph_map import prove_glyph_map
from ava_pdf_epub.reconstruction_v2.ocr_glyph_target import ocr_glyph_target
from ava_pdf_epub.reconstruction_v2.visible_target_glyph_map import visible_target_glyph_map

from .visible_target_fixture import fixture


class VisibleTargetProofTests(unittest.TestCase):
    def test_target_only_proof_preserves_original_owner_observation_and_generic_refusal(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            self.addCleanup(f.reader.close)
            before = f.page.model_dump_json(), [o.model_dump_json() for o in f.owners]
            self.assertEqual(("left", 0), f.prove())
            self.assertEqual(
                before, (f.page.model_dump_json(), [o.model_dump_json() for o in f.owners])
            )
            self.assertIsNone(prove_glyph_map(f.page, f.owners[0], f.owners, POLICY))
            self.assertIsNone(
                visible_target_glyph_map(f.reader, f.target, f.page, f.owners[0], f.owners, None)
            )
            with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                ocr_glyph_target(f.page, f.page.lines[0], f.owners, 0, 20, POLICY)

    def test_unknown_risk_and_orphan_ink_risk_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            self.addCleanup(f.reader.close)
            for update in (
                {"risks": ["glyph_without_visible_ink", "clipped_glyph"]},
                {"risks": ["glyph_without_visible_ink", "unreliable_glyph_mapping"]},
                {"lines": f.page.lines[:1]},
            ):
                with (
                    self.subTest(update=list(update)),
                    self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"),
                ):
                    f.prove(page=f.page.model_copy(update=update))
