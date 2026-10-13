"""Native note callers bind measured superscript spans without replacement label text."""

import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.reconstruction_v2.native_structure_assembly import (
    assemble_native_structure_source,
)
from ava_pdf_epub.reconstruction_v2.native_structure_contract import (
    NativeStructureResponse,
    NativeStructureTask,
)
from ava_pdf_epub.reconstruction_v2.native_structure_identity import native_structure_identifier
from ava_pdf_epub.reconstruction_v2.native_structure_response import accept_native_structure
from ava_pdf_epub.reconstruction_v2.native_structure_source import prepare_native_structure

from .native_structure_decision_fixture import (
    SOURCE,
    line,
    native_structure_wire_fixture,
    page,
    region,
    response,
    superscript_line,
)


class NativeStructureCallouts(unittest.TestCase):
    def setUp(self):
        self.lines = [
            superscript_line(text="Caller1 ends."),
            line("p1-note", "1. A source note.", y=100),
        ]
        self.page, image = page(self.lines)
        self.task = prepare_native_structure(
            self.page,
            SOURCE,
            image,
            [region("body", self.lines[:1]), region("notes", self.lines[1:], band=1)],
        )
        self.span_id = self.task.eligible_callouts[0].span_id
        self.answer = response(
            self.task,
            [
                dict(
                    id="body-one", region_id="body", kind="paragraph", line_ids=[self.lines[0].id]
                ),
                dict(
                    id="note-one",
                    region_id="notes",
                    kind="note",
                    line_ids=[self.lines[1].id],
                    note_label="1",
                    note_role="footnote",
                ),
            ],
            references=[dict(span_id=self.span_id, role="note_callout")],
        )

    def test_measured_superscript_callout_derives_label_and_keeps_text_styles_offsets(self):
        result = assemble_native_structure_source(self.task, self.answer, self.page)
        segment = result.segments[0]
        callout = next(span for span in segment.spans if span.note_label)
        self.assertEqual(segment.text, "Caller1 ends.")
        self.assertEqual((callout.start, callout.end, callout.note_label), (6, 7, "1"))
        source_span = next(span for span in self.task.lines[0].spans if span.id == self.span_id)
        self.assertEqual(callout.style.model_dump(), source_span.style.model_dump())
        self.assertEqual(callout.style.vertical_align, "super")
        self.assertIsNone(callout.url)
        self.assertIsNone(callout.target_text)
        self.assertEqual(result.line_maps[0].text_sha256, text_digest("Caller1 ends."))

    def test_body_number_is_not_an_eligible_note_callout(self):
        source = line("p1-line0", "Caller1 ends.")
        observation, image = page([source])
        task = prepare_native_structure(observation, SOURCE, image, [region("body", [source])])
        self.assertEqual(task.eligible_callouts, [])
        answer = response(
            task,
            [dict(id="body-one", region_id="body", kind="paragraph", line_ids=[source.id])],
            references=[dict(span_id=task.lines[0].spans[0].id, role="note_callout")],
        )
        with self.assertRaisesRegex(ValueError, "no eligible native superscript"):
            accept_native_structure(task, answer)

    def test_duplicate_and_foreign_source_span_ids_refuse(self):
        for refs in [
            [dict(span_id="foreign-span", role="note_callout")],
            [dict(span_id=self.span_id, role="note_callout")] * 2,
        ]:
            with self.subTest(refs=refs), self.assertRaises(ValueError):
                raw = self.answer.model_dump()
                raw["references"] = refs
                accept_native_structure(self.task, NativeStructureResponse.model_validate(raw))

    def test_reference_cannot_supply_text_label_destination_or_style(self):
        for field, value in [
            ("text", "2"),
            ("note_label", "2"),
            ("destination", "other-note"),
            ("style", {"id": "invented", "vertical_align": "super"}),
        ]:
            with self.subTest(field=field), self.assertRaises(ValidationError):
                raw = self.answer.model_dump()
                raw["references"][0][field] = value
                NativeStructureResponse.model_validate(raw)

    def test_rehashed_callout_label_and_measured_geometry_are_still_source_bound(self):
        raw = self.task.model_dump()
        raw["eligible_callouts"][0]["exact_text"] = "2"
        raw["task_id"] = native_structure_identifier(raw)
        with self.assertRaisesRegex(ValueError, "measured source span"):
            NativeStructureTask.model_validate(raw)
        raw = self.task.model_dump()
        raw["eligible_callouts"][0]["box"]["x1"] += 1
        raw["task_id"] = native_structure_identifier(raw)
        changed = NativeStructureTask.model_validate(raw)
        answer = response(
            changed,
            self.answer.model_dump()["groups"],
            references=self.answer.model_dump()["references"],
        )
        with self.assertRaisesRegex(ValueError, "source geometry"):
            assemble_native_structure_source(changed, answer, self.page)

    def test_rehashed_source_label_and_style_do_not_replace_observation(self):
        raw = self.task.model_dump()
        raw["lines"][0]["text"] = "Caller2 ends."
        raw["lines"][0]["text_sha256"] = text_digest("Caller2 ends.")
        raw["eligible_callouts"][0]["exact_text"] = "2"
        raw["task_id"] = native_structure_identifier(raw)
        changed = NativeStructureTask.model_validate(raw)
        answer = response(
            changed,
            self.answer.model_dump()["groups"],
            references=self.answer.model_dump()["references"],
        )
        with self.assertRaisesRegex(ValueError, "qualification"):
            assemble_native_structure_source(changed, answer, self.page)
        raw = self.task.model_dump()
        marked = next(span for span in raw["lines"][0]["spans"] if span["id"] == self.span_id)
        marked["style"]["vertical_align"] = "baseline"
        raw["task_id"] = native_structure_identifier(raw)
        with self.assertRaisesRegex(ValueError, "measured source span"):
            NativeStructureTask.model_validate(raw)

    def test_api_fixture_is_python_accepted_with_source_callout_and_boundary(self):
        task, answer = native_structure_wire_fixture()
        accept_native_structure(task, answer)
        self.assertEqual(len(task.eligible_callouts), 1)
        self.assertEqual(task.eligible_callouts[0].exact_text, "1")
        self.assertEqual(len(task.boundaries), 1)
        self.assertEqual(answer.boundary_dispositions[0].disposition, "literal")
