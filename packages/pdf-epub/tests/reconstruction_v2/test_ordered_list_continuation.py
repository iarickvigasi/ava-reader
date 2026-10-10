"""A new page contributes its own observed ordinal without restarting an ordered group."""

import unittest

from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.assemble_lists import assemble_lists
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionTask
from ava_pdf_epub.reconstruction_v2.task_identity import task_identifier

from .test_ordered_list_observations import item
from .test_recognition_coordinates import response_for
from .test_unicode_style_prompt import versioned_task


class OrderedListContinuation(unittest.TestCase):
    def test_cross_page_roman_continuation_does_not_reset_or_rewrite_markers(self):
        first = versioned_task("ava-prose-region-13")
        raw = first.model_dump()
        raw["page_number"] = 2
        raw["task_id"] = task_identifier(raw)
        second = RecognitionTask.model_validate(raw)
        self.assertNotEqual(first.task_id, second.task_id)
        observations = [
            item("p1s1", "IV) Inspect the compass.", 4, continues_to_next=True),
            item("p2s1", "V) Walk north.", 5, page=2, continues_from_previous=True),
        ]
        segments = [
            *accept_response(first, response_for(first, observations[:1])),
            *accept_response(second, response_for(second, observations[1:])),
        ]
        state = AssemblyState(
            segments={s.id: s for s in segments},
            blocks=[dict(id=s.id, kind=s.kind) for s in segments],
        )
        assemble_lists(state, [dict(block_ids=[s.id for s in segments])])
        self.assertEqual([1, 2], [s.page for s in segments])
        self.assertEqual([4, 5], [s.list_start for s in segments])
        self.assertEqual([s["text"] for s in observations], [s.text for s in segments])
        self.assertEqual(1, len(state.lists))
        self.assertEqual(4, state.lists[0]["start"])
        self.assertEqual(["p1s1", "p2s1"], state.lists[0]["item_ids"])
