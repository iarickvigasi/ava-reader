"""Authored complete observations and conditionals; no OCR-quality claim."""

import unittest

from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.recognition_segment import RecognitionSegment

from .recognition_task_fixture import task_fixture
from .response_fixtures import wire_segment
from .test_recognition_coordinates import response_for


class RecognitionShapes(unittest.TestCase):
    def test_kind_specific_requirements_and_explicit_fields(self):
        cases = [
            dict(kind="heading"),
            dict(kind="note", note_label="1"),
            dict(kind="note", note_role="footnote"),
            dict(kind="list_item", list_ordered=False),
            dict(kind="list_item", list_ordered=True, list_depth=1),
            dict(kind="table"),
            dict(kind="paragraph", chapter_start=True, chapter_role="bodymatter"),
            dict(kind="heading", heading_level=2, chapter_start=True, chapter_role="bodymatter"),
        ]
        for change in cases:
            with self.subTest(change=change), self.assertRaises(ValueError):
                RecognitionSegment.model_validate(wire_segment(**change))
        for field in ["style", "spans", "continues_to_next"]:
            raw = wire_segment()
            del raw[field]
            with self.subTest(field=field), self.assertRaises(ValueError):
                RecognitionSegment.model_validate(raw)

    def test_heading_note_list_furniture_and_sparse_style(self):
        values = [
            wire_segment(
                id="s0001",
                kind="heading",
                text="One",
                heading_level=1,
                chapter_start=True,
                chapter_role="bodymatter",
                style={"id": "title", "bold": True},
            ),
            wire_segment(
                id="s0002", kind="note", text="1 Note", note_label="1", note_role="footnote"
            ),
            wire_segment(
                id="s0003",
                kind="list_item",
                text="3. Item",
                list_ordered=True,
                list_start=3,
                list_depth=1,
            ),
            wire_segment(id="s0004", kind="furniture", text="Page 1"),
        ]
        result = accept_response(task_fixture(), response_for(task_fixture(), values))
        self.assertTrue(result[0].style.bold)
        self.assertIsNone(result[0].style.italic)
        self.assertEqual("furniture", result[3].kind)

    def test_codepoint_spans_resets_and_continuation_are_conserved(self):
        span = dict(
            start=1,
            end=2,
            style={"id": "reset", "bold": False, "indent_em": 0},
            note_label="1",
            target_text=None,
            url=None,
        )
        result = accept_response(
            task_fixture(),
            response_for(task_fixture(), [wire_segment(spans=[span], continues_to_next=True)]),
        )[0]
        self.assertEqual("😀", result.text[result.spans[0].start : result.spans[0].end])
        self.assertFalse(result.spans[0].style.bold)
        self.assertEqual(0, result.spans[0].style.indent_em)
        self.assertTrue(result.continues_to_next)
        span["end"] = 4
        with self.assertRaises(ValueError):
            RecognitionSegment.model_validate(wire_segment(spans=[span]))

    def test_duplicate_ids_relationships_and_wrong_page_refuse(self):
        task = task_fixture()
        for values in [
            [wire_segment(), wire_segment()],
            [wire_segment(related_to="missing")],
            [wire_segment(page=2)],
        ]:
            with self.subTest(values=values), self.assertRaises(ValueError):
                accept_response(task, response_for(task, values))
