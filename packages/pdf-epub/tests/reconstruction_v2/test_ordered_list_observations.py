"""Sanitized observed failure and valid marker families; no provider output is repaired."""

import copy
import json
import unittest

from pydantic import ValidationError

from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.assemble_lists import assemble_lists
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse
from ava_pdf_epub.reconstruction_v2.source_refusal import SourceContentRefusal

from .response_fixtures import wire_segment
from .test_recognition_coordinates import response_for
from .test_unicode_style_prompt import versioned_task


def item(identity, text, ordinal, depth=1, **values):
    return wire_segment(
        id=identity,
        kind="list_item",
        text=text,
        list_ordered=True,
        list_start=ordinal,
        list_depth=depth,
        **values,
    )


def assemble(task, wire):
    segments = accept_response(task, response_for(task, wire))
    state = AssemblyState(
        segments={s.id: s for s in segments},
        blocks=[dict(id=s.id, kind=s.kind) for s in segments],
    )
    assemble_lists(state, [dict(block_ids=[s.id for s in segments])])
    return state


class OrderedListObservations(unittest.TestCase):
    def test_exact_nested_null_ordinal_failure_is_retained(self):
        task = versioned_task("ava-prose-region-13")
        wire = [
            item("s1", "1. Prepare the telescope.", 1),
            item("s2", "a. Check the lens.", None, 2),
            item("s3", "b. Keep the cloth dry.", None, 2),
            item("s4", "2. Open the notebook.", 2),
        ]
        raw = response_for(task, []).model_dump()
        raw["segments"] = wire
        before = copy.deepcopy(raw)
        with self.assertRaises(ValidationError) as failure:
            RecognitionResponse.model_validate_json(json.dumps(raw))
        errors = failure.exception.errors(include_url=False)
        self.assertEqual([("segments", 1), ("segments", 2)], [e["loc"] for e in errors])
        self.assertTrue(all("Ordered list requires its observed start" in e["msg"] for e in errors))
        self.assertEqual(before, raw)

    def test_decimal_outer_and_alpha_nested_lists_preserve_text_and_parents(self):
        wire = [
            item("s1", "1. Prepare the telescope.", 1),
            item("s2", "a. Check the lens.", 1, 2),
            item("s3", "b. Keep the cloth dry.", 2, 2),
            item("s4", "2. Open the notebook.", 2),
        ]
        for version in ["ava-prose-region-13", "ava-prose-region-14"]:
            state = assemble(versioned_task(version), wire)
            self.assertEqual([s["text"] for s in wire], [s.text for s in state.segments.values()])
            self.assertEqual([1, 1], [group["start"] for group in state.lists])
            self.assertEqual([None, "s1"], [group["parent_item_id"] for group in state.lists])
            self.assertEqual([["s1", "s4"], ["s2", "s3"]], [g["item_ids"] for g in state.lists])

    def test_roman_continuation_preserves_current_ordinal_not_initial_start(self):
        for markers, ordinals in [(["iv)", "v)"], [4, 5]), (["C.", "D."], [3, 4])]:
            wire = [
                item(f"s{i}", f"{marker} Continue.", ordinal, continues_from_previous=True)
                for i, (marker, ordinal) in enumerate(zip(markers, ordinals, strict=True))
            ]
            state = assemble(versioned_task("ava-prose-region-13"), wire)
            self.assertEqual(ordinals[0], state.lists[0]["start"])
            self.assertEqual([s["text"] for s in wire], [s.text for s in state.segments.values()])
            wrong = copy.deepcopy(wire)
            wrong[1]["list_start"] = ordinals[0]
            with self.assertRaisesRegex(ValueError, "numbering discontinuity"):
                assemble(versioned_task("ava-prose-region-13"), wrong)

    def test_unreadable_essential_marker_is_not_publishable(self):
        task = versioned_task("ava-prose-region-13")
        uncertain = wire_segment(kind="unsupported", text="Check the lens.")
        raw = response_for(task, [uncertain]).model_dump()
        raw["unresolved"] = ["The essential nested ordered marker is unreadable."]
        with self.assertRaises(SourceContentRefusal) as failure:
            accept_response(task, RecognitionResponse.model_validate(raw))
        self.assertEqual("RECOGNITION_UNRESOLVED", failure.exception.diagnostic.findings[0].code)
        self.assertEqual(task.task_id, failure.exception.diagnostic.findings[0].task_id)
