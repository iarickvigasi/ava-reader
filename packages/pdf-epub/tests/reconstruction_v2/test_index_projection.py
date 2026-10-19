"""Wrong OCR boxes cannot alter full source-row identity, offsets or downstream geometry."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assemble_pages import assemble_pages
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.index_page_projection import index_page_projection
from ava_pdf_epub.reconstruction_v2.projected_index_maps import projected_index_maps
from ava_pdf_epub.reconstruction_v2.projected_index_ranges import projected_index_ranges

from .index_projection_fixture import projection_case


class IndexProjectionTests(unittest.TestCase):
    def test_source_boxes_precede_assembly_and_raw_ocr_is_immutable(self):
        for fused in (False, True):
            with self.subTest(fused=fused), tempfile.TemporaryDirectory() as d:
                checkpoint, owners, expected = projection_case(Path(d), fused=fused)
                before = [s.model_dump_json() for s in owners]
                result = index_page_projection(checkpoint, owners, POLICY)
                self.assertIsNotNone(result)
                projected, receipt = result
                self.assertEqual(before, [s.model_dump_json() for s in owners])
                state = AssemblyState(source_continuation_policy=POLICY)
                state.source_index_projections[1] = receipt
                pages, assembled = assemble_pages([checkpoint], {1: projected}, state)
                proofs = projected_index_maps(checkpoint, assembled, state)
                self.assertEqual(12, len(proofs))
                for raw, owner in zip(owners, projected, strict=True):
                    self.assertEqual(expected[owner.id], owner.box)
                    self.assertEqual(
                        raw.model_dump(exclude={"box"}), owner.model_dump(exclude={"box"})
                    )
                    self.assertEqual(owner.box.model_dump(), state.evidence[owner.id][0]["box"])
                    self.assertIn(owner.box.model_dump(), [r["box"] for r in pages[0]["regions"]])
                    proof = proofs[owner.id]
                    glyph = proof.glyphs[-1]
                    self.assertEqual(
                        [(owner.id, glyph.start, glyph.end)],
                        projected_index_ranges(checkpoint, assembled, glyph.glyph.box, state),
                    )
                    self.assertEqual(glyph.glyph.text, owner.text[glyph.start : glyph.end])
                state.release_observations()
                self.assertEqual({}, state.source_index_projections)

    def test_page_or_any_body_owner_change_invalidates_all_maps(self):
        with tempfile.TemporaryDirectory() as d:
            checkpoint, owners, _ = projection_case(Path(d))
            projected, receipt = index_page_projection(checkpoint, owners, POLICY)
            state = AssemblyState(source_continuation_policy=POLICY)
            state.source_index_projections[1] = receipt
            for values in [
                projected[:-1],
                [*projected, projected[0]],
                [projected[0].model_copy(update={"text": "changed"}), *projected[1:]],
            ]:
                self.assertEqual({}, projected_index_maps(checkpoint, values, state))
            changed = checkpoint.observation.model_copy(update={"render_sha256": "b" * 64})
            self.assertEqual(
                {},
                projected_index_maps(
                    checkpoint.model_copy(update={"observation": changed}), projected, state
                ),
            )
            styled = [
                s.model_copy(update={"style": s.style.model_copy(update={"italic": True})})
                for s in projected
            ]
            self.assertEqual(12, len(projected_index_maps(checkpoint, styled, state)))
