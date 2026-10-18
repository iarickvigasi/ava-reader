"""Geometry receipts do not turn bundled subentries or explanatory prose into one entry."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.index_context import record_index_context
from ava_pdf_epub.reconstruction_v2.index_indents import recover_index_indents
from ava_pdf_epub.reconstruction_v2.index_page_projection import index_page_projection
from ava_pdf_epub.reconstruction_v2.projected_index_maps import projected_index_maps

from .index_projection_fixture import projection_case
from .test_ocr_link_context import line


class IndexProjectionRoleTests(unittest.TestCase):
    def test_parent_and_subentry_bundle_maps_but_does_not_gain_an_independent_role(self):
        with tempfile.TemporaryDirectory() as d:
            cp, owners, _ = projection_case(Path(d), fused=True)
            bundle = owners[0].model_copy(update={"text": owners[0].text + "\n  " + owners[1].text})
            values = [bundle, *owners[2:]]
            projected, receipt = index_page_projection(cp, values, POLICY)
            state = AssemblyState(source_continuation_policy=POLICY)
            state.source_index_projections[1] = receipt
            record_index_context([cp], projected, state)
            self.assertIn(bundle.id, projected_index_maps(cp, projected, state))
            self.assertNotIn(bundle.id, state.source_index_entries)
            self.assertEqual(bundle.text, projected[0].text)

    def test_literal_numeric_hanging_wrap_can_recover_source_indentation(self):
        with tempfile.TemporaryDirectory() as d:
            cp, owners, _ = projection_case(Path(d))
            original = next(r for r in cp.observation.lines if r.id == "left1")
            numeric = line("left1", "17, 19", 52, original.box.y0)
            cp = cp.model_copy(
                update={
                    "observation": cp.observation.model_copy(
                        update={
                            "lines": [
                                numeric if r.id == "left1" else r for r in cp.observation.lines
                            ]
                        }
                    )
                }
            )
            bundle = owners[0].model_copy(update={"text": owners[0].text + "\n  17, 19"})
            projected, receipt = index_page_projection(cp, [bundle, *owners[2:]], POLICY)
            state = AssemblyState(source_continuation_policy=POLICY)
            state.source_index_projections[1] = receipt
            record_index_context([cp], projected, state)
            self.assertIn(bundle.id, state.source_index_entries)
            updated = recover_index_indents([cp], projected, state)
            self.assertLess(updated[0].style.indent_em, 0)
            self.assertGreater(updated[0].style.block_indent_em, 0)
            self.assertEqual(bundle.text, updated[0].text)

    def test_unknown_furniture_cannot_join_a_receipted_page(self):
        with tempfile.TemporaryDirectory() as d:
            cp, owners, _ = projection_case(Path(d))
            projected, receipt = index_page_projection(cp, owners, POLICY)
            state = AssemblyState(source_continuation_policy=POLICY)
            state.source_index_projections[1] = receipt
            foreign = projected[0].model_copy(update={"id": "foreign", "kind": "furniture"})
            self.assertEqual({}, projected_index_maps(cp, [*projected, foreign], state))
