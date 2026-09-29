"""Observed zero-based numbering survives recognition and whole-book assembly."""

import unittest

from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.assemble_lists import assemble_lists
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState

from .recognition_task_fixture import task_fixture
from .response_fixtures import wire_segment
from .test_recognition_coordinates import response_for


class RecognitionLists(unittest.TestCase):
    def test_zero_start_is_not_replaced_by_default_one(self):
        task = task_fixture()
        wire = [
            wire_segment(
                id=f"s{i}",
                kind="list_item",
                text=f"{i}. Item",
                list_ordered=True,
                list_start=i,
                list_depth=1,
            )
            for i in range(2)
        ]
        segments = accept_response(task, response_for(task, wire))
        state = AssemblyState(
            segments={s.id: s for s in segments},
            blocks=[dict(id=s.id, kind="list_item") for s in segments],
        )
        assemble_lists(state, [dict(block_ids=[s.id for s in segments])])
        self.assertEqual(1, len(state.lists))
        self.assertEqual(0, state.lists[0]["start"])
        self.assertEqual(["s0", "s1"], state.lists[0]["item_ids"])
