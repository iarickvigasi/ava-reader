"""Source-bound wrap classification remains separate from applying deletions/remapping."""

import unittest

from ava_pdf_epub.contracts.layout_hyphen import LayoutHyphenDisposition, candidate_digest
from ava_pdf_epub.reconstruction_v2.native_structure_assembly import (
    assemble_native_structure_source,
)
from ava_pdf_epub.reconstruction_v2.native_structure_response import accept_native_structure
from ava_pdf_epub.reconstruction_v2.native_structure_source import prepare_native_structure

from .native_structure_decision_fixture import SOURCE, line, page, region, response, wrap_candidate


class NativeStructureBoundaries(unittest.TestCase):
    def setUp(self):
        self.lines = [line("p1-line0", "trans-"), line("p1-line1", "cription.", y=60)]
        self.page, self.image = page(self.lines)
        self.candidate = wrap_candidate(*self.lines)
        self.task = prepare_native_structure(
            self.page, SOURCE, self.image, [region("body", self.lines)], candidates=[self.candidate]
        )

    def answer(self, disposition="layout", kind="paragraph", digest=None):
        decisions = [
            LayoutHyphenDisposition(
                candidate_id=self.candidate.id,
                candidate_sha256=digest or candidate_digest(self.candidate),
                disposition=disposition,
            )
        ]
        return response(
            self.task,
            [
                dict(
                    id="body-one",
                    region_id="body",
                    kind=kind,
                    line_ids=[source.id for source in self.lines],
                )
            ],
            decisions,
        )

    def test_layout_classification_is_explicitly_pending_and_keeps_literal_source(self):
        result = assemble_native_structure_source(self.task, self.answer(), self.page)
        self.assertEqual(result.segments[0].text, "trans- cription.")
        self.assertEqual(result.segments[0].source_text, "trans-\ncription.")
        self.assertEqual(result.pending_normalization, ("wrap-one",))
        self.assertEqual(result.line_maps[1].start, 7)
        self.assertNotIn("transcription.", [s.text for s in result.segments])

    def test_literal_disposition_requires_no_normalization(self):
        result = assemble_native_structure_source(self.task, self.answer("literal"), self.page)
        self.assertEqual(result.pending_normalization, ())
        self.assertEqual(result.segments[0].text, "trans- cription.")

    def test_unresolved_changed_digest_and_missing_disposition_refuse(self):
        for answer in [
            self.answer("unresolved"),
            self.answer(digest="b" * 64),
            self.answer().model_copy(update={"boundary_dispositions": []}),
        ]:
            with self.subTest(answer=answer), self.assertRaises(ValueError):
                accept_native_structure(self.task, answer)

    def test_layout_cannot_rewrite_quote_or_independent_paragraphs(self):
        with self.assertRaisesRegex(ValueError, "literal/source role"):
            accept_native_structure(self.task, self.answer(kind="quote"))
        answer = self.answer().model_dump()
        answer["groups"] = [
            dict(id=f"body{i}", region_id="body", kind="paragraph", line_ids=[source.id])
            for i, source in enumerate(self.lines)
        ]
        with self.assertRaisesRegex(ValueError, "confirmed continuation"):
            accept_native_structure(self.task, type(self.answer()).model_validate(answer))

    def test_foreign_source_boundary_witness_refuses_before_dispatch(self):
        bad = self.candidate.model_copy(update={"source_sha256": "b" * 64})
        with self.assertRaisesRegex(ValueError, "boundary source digest"):
            prepare_native_structure(
                self.page, SOURCE, self.image, [region("body", self.lines)], candidates=[bad]
            )
