"""Missing reference does not bypass essential role checks or change historical tasks."""

import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.apply_refinement import apply_refinement
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.source_feature_tasks import source_feature_tasks
from ava_pdf_epub.reconstruction_v2.source_refusal import SourceContentRefusal
from ava_pdf_epub.reconstruction_v2.source_role_response import accept_source_role
from ava_pdf_epub.reconstruction_v2.validate_refinement import validate_refinement

from .source_role_fixture import role_case, role_response


class SourceRoleRouteTests(unittest.TestCase):
    def test_original_quote_and_catalogue_paragraph_choices_change_kind_only(self):
        with tempfile.TemporaryDirectory() as directory:
            _, _, owner, state, task = role_case(Path(directory))
            original = owner.model_dump()
            for role in ["quote", "paragraph"]:
                response = role_response(task, role)
                result = apply_refinement([owner], [task], [response], state)
                self.assertEqual(role, result[0].kind)
                self.assertEqual(
                    owner.model_dump(exclude={"kind"}), result[0].model_dump(exclude={"kind"})
                )
            self.assertEqual(original, owner.model_dump())
            self.assertEqual({}, state.source_index_entries)
            self.assertEqual(
                4, sum(e["disposition"] == "unknown" for e in state.source_feature_evidence)
            )
            packet = dict(
                mode="validate_refinement",
                task=task.model_dump(mode="json"),
                response=role_response(task).model_dump(mode="json"),
            )
            self.assertTrue(validate_refinement(json.dumps(packet).encode())["valid"])

    def test_unknown_role_remains_actionable_blocking_refusal(self):
        with tempfile.TemporaryDirectory() as directory:
            _, _, owner, _, task = role_case(Path(directory))
            with self.assertRaises(SourceContentRefusal) as caught:
                accept_source_role(task, role_response(task, None))
            finding = caught.exception.diagnostic.findings[0]
            self.assertEqual(owner.box, finding.box)
            self.assertEqual(task.task_id, finding.task_id)
            self.assertEqual(task.crops[0].render_sha256, finding.render_sha256)

    def test_old_generation_missing_policy_and_exhausted_budget_still_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            source, page, owner, state, _ = role_case(Path(directory))
            for active, current, prior in [
                (state, False, 0),
                (AssemblyState(), True, 0),
                (state, True, 64),
            ]:
                with self.assertRaises(SourceContentRefusal):
                    source_feature_tasks(
                        source,
                        Path(directory),
                        [page],
                        [owner],
                        active,
                        prior,
                        include_unreferenced_roles=current,
                    )
