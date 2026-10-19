"""Irrelevant kind fields may be absent; meaningful observations cannot disappear."""

import unittest

from ava_pdf_epub.reconstruction_v2.recognition_segment import RecognitionSegment

from .response_fixtures import wire_segment

OPTIONAL = [
    "heading_level",
    "chapter_start",
    "chapter_role",
    "note_label",
    "note_role",
    "list_ordered",
    "list_start",
    "list_depth",
    "cells",
    "related_to",
    "alt",
]


class RecognitionSparse(unittest.TestCase):
    def test_plain_prose_omits_irrelevant_metadata_without_losing_core_decisions(self):
        raw = {k: v for k, v in wire_segment().items() if k not in OPTIONAL}
        value = RecognitionSegment.model_validate(raw)
        self.assertEqual("paragraph", value.kind)
        self.assertIsNone(value.style)
        self.assertEqual([], value.spans)
        self.assertFalse(value.continues_to_next)
        for field in ["style", "spans", "continues_from_previous", "continues_to_next"]:
            changed = dict(raw)
            del changed[field]
            with self.assertRaises(ValueError):
                RecognitionSegment.model_validate(changed)

    def test_malformed_kind_fails_with_validation_error(self):
        for kind in [None, [], 5]:
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                RecognitionSegment.model_validate(wire_segment(kind=kind))

    def test_kind_fields_must_be_present_even_when_null_is_an_allowed_observation(self):
        cases = [
            dict(kind="heading", heading_level=2),
            dict(kind="note", note_label="1", note_role="footnote"),
            dict(kind="list_item", list_ordered=False, list_depth=1),
            dict(kind="caption"),
            dict(kind="credit"),
            dict(kind="figure"),
        ]
        fields = ["chapter_start", "note_role", "list_depth", "related_to", "related_to", "alt"]
        for change, field in zip(cases, fields, strict=True):
            raw = wire_segment(**change)
            del raw[field]
            with self.subTest(field=field), self.assertRaises(ValueError):
                RecognitionSegment.model_validate(raw)
