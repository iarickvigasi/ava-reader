"""Complete conservation and ambiguity checks prevent source-row omissions or guesses."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.index_page_projection import index_page_projection

from .index_projection_fixture import projection_case
from .test_ocr_link_context import line


class IndexProjectionGuardTests(unittest.TestCase):
    def test_wrong_missing_duplicate_or_reordered_owner_refuses_projection(self):
        with tempfile.TemporaryDirectory() as d:
            checkpoint, owners, _ = projection_case(Path(d))
            for values in [
                owners[:-1],
                list(reversed(owners)),
                [owners[0].model_copy(update={"text": "аlpha0 10"}), *owners[1:]],
                [*owners, owners[0].model_copy(update={"id": owners[-1].id})],
            ]:
                self.assertIsNone(index_page_projection(checkpoint, values, POLICY))
            self.assertIsNone(index_page_projection(checkpoint, owners, None))

    def test_unclaimed_body_ink_or_hidden_or_full_width_band_cannot_disappear(self):
        with tempfile.TemporaryDirectory() as d:
            checkpoint, owners, _ = projection_case(Path(d))
            page = checkpoint.observation
            hidden = page.lines[-1].model_copy(
                update={
                    "glyphs": [
                        g.model_copy(update={"visible": False}) for g in page.lines[-1].glyphs
                    ]
                }
            )
            for lines in [
                [*page.lines, line("orphan", "extra 18", 36, 190)],
                [*page.lines, line("band", "An introduction remains content", 36, 70)],
                [*page.lines[:-1], hidden],
            ]:
                changed = checkpoint.model_copy(
                    update={"observation": page.model_copy(update={"lines": lines})}
                )
                self.assertIsNone(index_page_projection(changed, owners, POLICY))

    def test_unknown_risk_and_changed_route_cannot_gain_source_authority(self):
        with tempfile.TemporaryDirectory() as d:
            checkpoint, owners, _ = projection_case(Path(d))
            changed = checkpoint.model_copy(
                update={
                    "observation": checkpoint.observation.model_copy(
                        update={"risks": [*checkpoint.observation.risks, "unknown"]}
                    )
                }
            )
            self.assertIsNone(index_page_projection(changed, owners, POLICY))
            changed = checkpoint.model_copy(update={"tasks": []})
            self.assertIsNone(index_page_projection(changed, owners, POLICY))
