"""Missing local references remain explicit unknowns; an essential quote cannot be skipped."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.source_feature_tasks import source_feature_tasks
from ava_pdf_epub.reconstruction_v2.source_refusal import SourceContentRefusal

from .source_feature_fixtures import case


class FeatureContext(unittest.TestCase):
    def test_no_local_body_reference_records_uninspected_optional_features(self):
        with tempfile.TemporaryDirectory() as d:
            source, page, segments, _, _ = case(Path(d), include_quote=False)
            state = AssemblyState()
            isolated = [s for s in segments if s.id == "heading"]
            tasks = source_feature_tasks(source, Path(d), [page], isolated, state, 0)
            self.assertEqual([], tasks)
            self.assertEqual(4, state.requested_source_features)
            self.assertEqual(4, len(state.source_feature_evidence))
            self.assertTrue(
                all(
                    e["reason"] == "source_context_unavailable"
                    and e["crop_ids"] == []
                    and e["task_id"] is None
                    for e in state.source_feature_evidence
                )
            )

    def test_declared_quote_without_source_local_context_refuses_with_geometry(self):
        with tempfile.TemporaryDirectory() as d:
            source, page, segments, _, _ = case(Path(d))
            quoted = next(s for s in segments if s.id == "quoted").model_copy(
                update={"kind": "quote"}
            )
            with self.assertRaises(SourceContentRefusal) as caught:
                source_feature_tasks(source, Path(d), [page], [quoted], AssemblyState(), 0)
            self.assertEqual(page.source_sha256, caught.exception.diagnostic.source_sha256)
            self.assertEqual(quoted.box, caught.exception.diagnostic.findings[0].box)
