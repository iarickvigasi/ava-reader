"""Observed mismatch shape stays rejected; source characters and placement stay independent."""

import copy
import hashlib
import json
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionTask
from ava_pdf_epub.reconstruction_v2.task_identity import task_identifier

from .response_fixtures import wire_segment
from .test_recognition_coordinates import response_for
from .test_unicode_style_prompt import style_span, versioned_task


def reliable_task(text):
    raw = versioned_task("ava-prose-region-15").model_dump()
    evidence = json.dumps(dict(reliable=True, lines=[dict(text=text, box=raw["region_box"])]))
    raw.update(
        native_evidence=evidence,
        native_evidence_sha256=hashlib.sha256(evidence.encode()).hexdigest(),
    )
    raw["task_id"] = task_identifier(raw)
    return RecognitionTask.model_validate(raw)


class TextStyleConsistency(unittest.TestCase):
    def test_sanitized_actual_failure_is_not_reinterpreted_by_new_instructions(self):
        fixture = Path(__file__).parent / "fixtures/rejected-text-style-mismatch.json"
        retained = fixture.read_bytes()
        segment = wire_segment(**json.loads(retained))
        before = copy.deepcopy(segment)
        for version in [13, 15, 16]:
            with (
                self.subTest(version=version),
                self.assertRaisesRegex(ValueError, "absent from exact text"),
            ):
                response_for(versioned_task(f"ava-prose-region-{version}"), [segment])
        self.assertEqual(before, segment)
        self.assertEqual(retained, fixture.read_bytes())

    def test_ordinary_digits_and_complete_emphasis_preserve_exact_text_and_positions(self):
        text = "😀 Be gentle and strong. x2 + y2."
        spans = [
            style_span("gentle"),
            style_span("strong"),
            style_span("2", "sub", before="x", after=" +"),
            style_span("2", "super", before="y", after="."),
        ]
        spans[0]["style"]["italic"] = True
        spans[1]["style"]["bold"] = True
        task = versioned_task("ava-prose-region-15")
        observed = accept_response(
            task, response_for(task, [wire_segment(text=text, spans=spans)])
        )[0]
        self.assertEqual(text, observed.text)
        self.assertEqual(
            ["gentle", "strong", "2", "2"], [text[s.start : s.end] for s in observed.spans]
        )
        self.assertTrue(observed.spans[0].style.italic)
        self.assertTrue(observed.spans[1].style.bold)
        self.assertEqual(["sub", "super"], [s.style.vertical_align for s in observed.spans[-2:]])

    def test_reliable_source_encoding_cannot_be_folded_or_replaced_in_either_direction(self):
        for source, replacement, quote in [("x2", "x₂", "₂"), ("x₂", "x2", "2")]:
            task = reliable_task(source)
            original = wire_segment(text=source, spans=[style_span(source[-1])])
            self.assertEqual(source, accept_response(task, response_for(task, [original]))[0].text)
            changed = wire_segment(text=replacement, spans=[style_span(quote)])
            with (
                self.subTest(source=source),
                self.assertRaisesRegex(ValueError, "reliable native text"),
            ):
                accept_response(task, response_for(task, [changed]))

    def test_intrinsic_unicode_keeps_exact_text_with_independent_placement(self):
        text = "x₂ + y²"
        task = reliable_task(text)
        spans = [style_span("₂"), style_span("²")]
        observed = accept_response(
            task, response_for(task, [wire_segment(text=text, spans=spans)])
        )[0]
        self.assertTrue(all(s.style.vertical_align is None for s in observed.spans))
        extra = wire_segment(text=text, spans=[style_span("₂", "super"), style_span("²")])
        placed = accept_response(task, response_for(task, [extra]))[0]
        self.assertEqual(text, placed.text)
        self.assertEqual("super", placed.spans[0].style.vertical_align)
