"""Regional visible-ink source proof can serve callers without granting target authority."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from .ink_caller_fixture import fixture
from .test_pdf_links import box


class InkCallerTests(unittest.TestCase):
    def test_original_backlink_preserves_all_evidence_and_requires_source_witness(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            self.addCleanup(f.visible.reader.close)
            before = (
                f.visible.page.model_dump_json(),
                [o.model_dump_json() for o in f.visible.owners],
            )
            self.assertEqual([("left", 0, 10)], f.prove())
            self.assertEqual(2, f.target.page)
            self.assertEqual(
                before,
                (f.visible.page.model_dump_json(), [o.model_dump_json() for o in f.visible.owners]),
            )
            with patch(
                "ava_pdf_epub.reconstruction_v2.ocr_layout_caller.source_visible_glyph_map",
                return_value=None,
            ):
                with self.assertRaisesRegex(ValueError, "TEXT_MAPPING"):
                    f.prove()

    def test_partial_hidden_competing_unknown_risk_and_wrong_action_still_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            self.addCleanup(f.visible.reader.close)
            first = f.visible.page.lines[0]
            hidden = first.model_copy(
                update={
                    "glyphs": [
                        first.glyphs[0].model_copy(update={"visible": False}),
                        *first.glyphs[1:],
                    ]
                }
            )
            cases = [
                {"caller": box(2, 20, 28, 30)},
                {"policy": None},
                {"target": f.target.__class__(page=1, left=0, top=80)},
                {
                    "page": f.visible.page.model_copy(
                        update={"risks": ["glyph_without_visible_ink", "clipped_glyph"]}
                    )
                },
                {"page": f.visible.page.model_copy(update={"lines": [first]})},
                {
                    "page": f.visible.page.model_copy(
                        update={"lines": [hidden, *f.visible.page.lines[1:]]}
                    )
                },
                {
                    "owners": [
                        *f.visible.owners,
                        f.visible.owners[0].model_copy(update={"id": "competitor"}),
                    ]
                },
            ]
            for change in cases:
                with (
                    self.subTest(change=list(change)),
                    self.assertRaisesRegex(ValueError, "TEXT_MAPPING"),
                ):
                    f.prove(**change)
