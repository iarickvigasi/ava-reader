"""Optional catalogue appearances cannot consume the new essential role's slot."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.page_checkpoints import PreparedPageMap
from ava_pdf_epub.reconstruction_v2.source_feature_selection import source_feature_selection
from ava_pdf_epub.reconstruction_v2.source_feature_tasks import source_feature_tasks
from ava_pdf_epub.reconstruction_v2.source_refusal import SourceContentRefusal

from .source_feature_fixtures import case
from .source_role_fixture import role_case


class SourceRolePriorityTests(unittest.TestCase):
    def test_late_essential_owner_displaces_optional_inside_same_256_bound(self):
        with tempfile.TemporaryDirectory() as directory:
            _, page, owner, state, _ = role_case(Path(directory))
            optional = [
                owner.model_copy(
                    update={"id": f"optional-{i}", "kind": "paragraph", "text": "entry"}
                )
                for i in range(256)
            ]
            pending = []
            requests, _, missing = source_feature_selection(
                [*optional, owner], PreparedPageMap([page]), state, pending_roles=pending
            )
            self.assertEqual([owner], pending)
            self.assertEqual(256, len(requests) + len(missing))
            self.assertIn(owner, missing)
            self.assertEqual(1, state.unrequested_optional_features)
            with self.assertRaises(SourceContentRefusal):
                source_feature_selection(
                    [*optional, owner], PreparedPageMap([page]), AssemblyState()
                )

    def test_no_new_missing_reference_owner_keeps_old_task_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            source, page, owners, _, old = case(Path(directory))
            state = AssemblyState(
                source_continuation_policy="ava-source-continuation-presentation-1"
            )
            current = source_feature_tasks(
                source, Path(directory), [page], owners, state, 0, include_unreferenced_roles=True
            )
            self.assertEqual(
                [t.model_dump(mode="json") for t in old],
                [t.model_dump(mode="json") for t in current],
            )
