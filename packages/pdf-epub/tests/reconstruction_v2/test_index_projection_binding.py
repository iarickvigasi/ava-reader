"""A retained page receipt cannot outlive its qualifying source task or route."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.index_page_projection import index_page_projection
from ava_pdf_epub.reconstruction_v2.projected_index_maps import projected_index_maps

from .index_projection_fixture import projection_case


class IndexProjectionBindingTests(unittest.TestCase):
    def test_changed_task_source_or_route_refuses_receipt_reuse(self):
        with tempfile.TemporaryDirectory() as d:
            checkpoint, owners, _ = projection_case(Path(d))
            projected, receipt = index_page_projection(checkpoint, owners, POLICY)
            state = AssemblyState(source_continuation_policy=POLICY)
            state.source_index_projections[1] = receipt
            for changes in [
                {"source_sha256": "b" * 64},
                {"tasks": []},
                {"tasks": [checkpoint.tasks[0].model_copy(update={"native_evidence": "changed"})]},
                {"source_layout_policy": None},
                {"native_segments": [projected[0]]},
            ]:
                with self.subTest(changes=list(changes)):
                    changed = checkpoint.model_copy(update=changes)
                    self.assertEqual({}, projected_index_maps(changed, projected, state))
