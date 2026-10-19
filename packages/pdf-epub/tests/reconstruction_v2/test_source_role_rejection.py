"""Foreign source, extra response authority and owner mutations cannot pass role review."""

import tempfile
import unittest
from pathlib import Path

from pydantic import ValidationError

from ava_pdf_epub.reconstruction_v2.apply_refinement import apply_refinement
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.source_role_contract import SourceRoleResponse
from ava_pdf_epub.reconstruction_v2.source_role_response import accept_source_role

from .source_role_fixture import role_case, role_response


class SourceRoleRejectionTests(unittest.TestCase):
    def test_stale_incomplete_foreign_and_extra_authority_responses_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            _, _, _, _, task = role_case(Path(directory))
            good = role_response(task)
            for changes in [
                {"task_id": "other"},
                {"source_sha256": "b" * 64},
                {"image_sha256": "b" * 64},
                {"observation_sha256": "b" * 64},
                {"unresolved": ["not readable"]},
                {
                    "role_decisions": [
                        good.role_decisions[0].model_copy(
                            update={"evidence_ids": ["other", "role-page"]}
                        )
                    ]
                },
            ]:
                with self.assertRaises(ValueError):
                    accept_source_role(task, good.model_copy(update=changes))
            for extra in [
                {"text": "rewrite"},
                {"styles": []},
                {"joins": []},
                {"metadata_decisions": []},
            ]:
                with self.assertRaises(ValidationError):
                    SourceRoleResponse.model_validate({**good.model_dump(), **extra})

    def test_changed_owner_and_missing_receipt_or_current_policy_cannot_apply(self):
        with tempfile.TemporaryDirectory() as directory:
            _, _, owner, state, task = role_case(Path(directory))
            response = role_response(task)
            for changed in [
                owner.model_copy(update={"text": owner.text + "x"}),
                owner.model_copy(update={"style": owner.style.model_copy(update={"italic": True})}),
            ]:
                with self.assertRaises(ValueError):
                    apply_refinement([changed], [task], [response], state)
            with self.assertRaises(ValueError):
                apply_refinement([owner], [task], [response], AssemblyState())
            with self.assertRaises(ValueError):
                apply_refinement([owner], [task], [], state)
