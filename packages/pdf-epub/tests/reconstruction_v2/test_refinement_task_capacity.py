"""Current capacity expands without changing task identity or historical limits."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.source_feature_tasks import source_feature_tasks
from ava_pdf_epub.reconstruction_v2.source_refusal import SourceContentRefusal

from .source_feature_fixtures import case
from .source_role_fixture import role_case


class RefinementTaskCapacityTests(unittest.TestCase):
    def test_current_required_features_can_follow_32_prior_tasks_without_changing_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source, page, owners, _, old = case(scratch)
            original = [owner.model_dump() for owner in owners]
            tasks = source_feature_tasks(
                source,
                scratch,
                [page],
                owners,
                AssemblyState(source_continuation_policy=POLICY),
                32,
            )
            self.assertEqual([t.model_dump() for t in old], [t.model_dump() for t in tasks])
            self.assertEqual(original, [owner.model_dump() for owner in owners])

    def test_legacy32_and_current64_still_refuse_essential_work_after_capacity(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source, page, owners, _, _ = case(scratch)
            for policy, prior in [(None, 32), (POLICY, 64)]:
                with self.subTest(policy=policy), self.assertRaises(SourceContentRefusal):
                    source_feature_tasks(
                        source,
                        scratch,
                        [page],
                        owners,
                        AssemblyState(source_continuation_policy=policy),
                        prior,
                    )

    def test_role_task_can_take_current_slot64_but_not_slot65(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source, page, owner, state, original = role_case(scratch)
            tasks = source_feature_tasks(
                source,
                scratch,
                [page],
                [owner],
                state,
                63,
                include_unreferenced_roles=True,
            )
            self.assertEqual([original.model_dump()], [t.model_dump() for t in tasks])
            with self.assertRaises(SourceContentRefusal):
                source_feature_tasks(
                    source,
                    scratch,
                    [page],
                    [owner],
                    state,
                    64,
                    include_unreferenced_roles=True,
                )
