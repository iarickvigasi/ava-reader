"""Quoted source spans bind exactly; ambiguity never guesses a word position."""

import unittest

from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.recognition_anchors import (
    RecognitionTextAnchor,
    anchored_offsets,
)
from ava_pdf_epub.reconstruction_v2.recognition_fields import RecognitionSpan
from ava_pdf_epub.reconstruction_v2.recognition_prompt import (
    ANCHORED_STYLE_PROMPT,
    EXPLICIT_STYLE_PROMPT,
    PINNED_ANCHORED_PROMPT,
)
from ava_pdf_epub.reconstruction_v2.recognition_spans import source_spans
from ava_pdf_epub.reconstruction_v2.task_identity import task_identifier

from .recognition_task_fixture import task_fixture
from .response_fixtures import wire_segment
from .test_pinned_table_cells import fixture as table_fixture
from .test_recognition_coordinates import response_for


def span(**values):
    return RecognitionSpan.model_validate(
        {
            "anchor": {"exact_text": "тривожність"},
            "style": {"id": "emphasis", "italic": True},
            "note_label": None,
            "target_text": None,
            "url": None,
            **values,
        }
    )


def versioned_task(version):
    raw = task_fixture().model_dump()
    raw["prompt_version"] = version
    raw["task_id"] = task_identifier(raw)
    return type(task_fixture()).model_validate(raw)


class RecognitionAnchors(unittest.TestCase):
    def test_unicode_code_points_and_metadata_survive_binding(self):
        text = "A😀B тривожність — стан."
        observed = span(note_label="1", target_text="note", url="https://example.org")
        bound = source_spans([observed], text)[0]
        self.assertEqual((4, 15), (bound["start"], bound["end"]))
        self.assertEqual("тривожність", text[bound["start"] : bound["end"]])
        self.assertTrue(bound["style"]["italic"])
        self.assertEqual(
            ("1", "note", "https://example.org"),
            (bound["note_label"], bound["target_text"], bound["url"]),
        )
        self.assertNotIn("anchor", bound)
        self.assertIsNotNone(observed.anchor)

    def test_repeated_phrase_requires_exact_adjacent_context(self):
        text = "first word; second word."
        with self.assertRaisesRegex(ValueError, "Ambiguous"):
            anchored_offsets(text, RecognitionTextAnchor(exact_text="word"))
        self.assertEqual(
            (19, 23),
            anchored_offsets(
                text, RecognitionTextAnchor(exact_text="word", before="second ", after=".")
            ),
        )
        with self.assertRaisesRegex(ValueError, "absent"):
            anchored_offsets(text, RecognitionTextAnchor(exact_text="word", before="Second "))

    def test_no_normalization_or_nearest_match(self):
        for original, quotation in [("a  b", "a b"), ("café", "cafe"), ("Я", "я")]:
            with self.subTest(original=original), self.assertRaisesRegex(ValueError, "absent"):
                anchored_offsets(original, RecognitionTextAnchor(exact_text=quotation))

    def test_mixed_missing_or_reversed_authority_refused(self):
        for changes in [
            {"start": 0, "end": 1},
            {"anchor": None},
            {"anchor": None, "start": 3, "end": 2},
        ]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                span(**changes)

    def test_task_version_pins_offset_authority(self):
        for version in range(2, 11):
            task = versioned_task(f"ava-prose-region-{version}")
            quote = span().model_dump()
            numeric = span(anchor=None, start=0, end=11).model_dump()
            for anchored, wire in [(True, quote), (False, numeric)]:
                response = response_for(task, [wire_segment(text="тривожність", spans=[wire])])
                if anchored == (version >= 7):
                    accepted = accept_response(task, response)[0]
                    self.assertEqual("тривожність", accepted.text)
                    self.assertEqual((0, 11), (accepted.spans[0].start, accepted.spans[0].end))
                else:
                    with self.assertRaisesRegex(ValueError, "task version"):
                        accept_response(task, response)

    def test_new_prompts_replace_numeric_instruction_only(self):
        self.assertIn("Span start/end are half-open", EXPLICIT_STYLE_PROMPT)
        for prompt in [ANCHORED_STYLE_PROMPT, PINNED_ANCHORED_PROMPT]:
            self.assertNotIn("Span start/end are half-open", prompt)
            self.assertIn("anchor.before", prompt)
            self.assertIn("style value is an object or null", prompt)

    def test_pinned_table_cell_anchor_retains_measured_geometry(self):
        task, raw, source = table_fixture("ava-prose-region-8")
        cell = raw["segments"][0]["cells"][0][0]
        self.assertTrue(cell["text"])
        cell["spans"] = [span(anchor={"exact_text": cell["text"]}).model_dump()]
        result = accept_response(task, response_for(task, raw["segments"]))[0]
        bound = result.cells[0][0]
        self.assertEqual(source.cells[0][0].box, bound.box)
        self.assertEqual(source.cells[0][0].column_span, bound.column_span)
        self.assertEqual(cell["text"], bound.text)
        self.assertEqual((0, len(bound.text)), (bound.spans[0].start, bound.spans[0].end))
        cell["spans"][0]["anchor"]["exact_text"] = "absent quotation"
        with self.assertRaisesRegex(ValueError, "absent"):
            response_for(task, raw["segments"])
