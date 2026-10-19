"""Collection permutations preserve source assembly; membership and semantics stay strict."""

import unittest

from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.contracts.layout_hyphen import (
    LayoutHyphenCandidate,
    LayoutHyphenDisposition,
    candidate_digest,
)
from ava_pdf_epub.reconstruction_v2.native_hyphen_decisions import retained_hyphen_decisions
from ava_pdf_epub.reconstruction_v2.native_structure_assembly import (
    assemble_native_structure_source,
)
from ava_pdf_epub.reconstruction_v2.native_structure_contract import NativeStructureResponse
from ava_pdf_epub.reconstruction_v2.native_structure_response import (
    accept_native_structure,
    canonical_native_structure_response,
)
from ava_pdf_epub.reconstruction_v2.native_structure_source import prepare_native_structure

from .native_structure_decision_fixture import SOURCE, line, page, region, response, wrap_candidate


class NativeStructureGroupOrder(unittest.TestCase):
    def setUp(self):
        self.lines = [
            line(
                "p1-line0",
                "Bold plain.",
                faces=[("Bold", "Times-Bold"), (" plain.", "Times-Roman")],
            ),
            line("p1-line1", "Next printed line.", y=60),
            line("p1-line2", "Second source paragraph.", y=100),
            line("p1-line3", "Its final line.", y=120),
            line("p1-header", "Running title", y=700),
            line("p1-footer", "17", y=760),
        ]
        self.page, image = page(self.lines)
        self.furniture = {self.lines[4].id, self.lines[5].id}
        self.task = prepare_native_structure(
            self.page,
            SOURCE,
            image,
            [
                region("body", self.lines[:4]),
                region("header", self.lines[4:5], role="furniture"),
                region("footer", self.lines[5:], role="furniture"),
            ],
            furniture=self.furniture,
        )
        self.answer = response(
            self.task,
            [
                dict(
                    id="body-one",
                    region_id="body",
                    kind="paragraph",
                    line_ids=[s.id for s in self.lines[:2]],
                ),
                dict(
                    id="body-two",
                    region_id="body",
                    kind="paragraph",
                    line_ids=[s.id for s in self.lines[2:4]],
                ),
                dict(
                    id="header-one",
                    region_id="header",
                    kind="furniture",
                    line_ids=[self.lines[4].id],
                ),
                dict(
                    id="footer-one",
                    region_id="footer",
                    kind="furniture",
                    line_ids=[self.lines[5].id],
                ),
            ],
        )

    def test_furniture_first_is_byte_identical_to_source_order_without_mutating_receipt(self):
        raw = self.answer.model_dump()
        raw["groups"] = [raw["groups"][i] for i in [2, 3, 1, 0]]
        shuffled = NativeStructureResponse.model_validate(raw)
        original = shuffled.model_dump_json()
        canonical = canonical_native_structure_response(self.task, shuffled)
        self.assertEqual(canonical.model_dump(), self.answer.model_dump())
        self.assertIsNone(accept_native_structure(self.task, shuffled))
        expected = assemble_native_structure_source(
            self.task, self.answer, self.page, furniture=self.furniture
        )
        actual = assemble_native_structure_source(
            self.task, shuffled, self.page, furniture=self.furniture
        )
        self.assertEqual(
            [s.model_dump_json() for s in actual.segments],
            [s.model_dump_json() for s in expected.segments],
        )
        self.assertEqual(actual.line_maps, expected.line_maps)
        self.assertEqual(shuffled.model_dump_json(), original)

    def test_missing_foreign_duplicate_reversed_discontiguous_and_cross_region_ids_refuse(self):
        cases = [
            (["p1-line0"], ["p1-line2", "p1-line3"]),
            (["p1-foreign", "p1-line1"], ["p1-line2", "p1-line3"]),
            (["p1-line0", "p1-line0"], ["p1-line2", "p1-line3"]),
            (["p1-line1", "p1-line0"], ["p1-line2", "p1-line3"]),
            (["p1-line0", "p1-line2"], ["p1-line1", "p1-line3"]),
            (["p1-line0", "p1-header"], ["p1-line2", "p1-line3"]),
        ]
        for first, second in cases:
            with self.subTest(first=first), self.assertRaisesRegex(ValueError, "order/coverage"):
                raw = self.answer.model_dump()
                raw["groups"][0]["line_ids"], raw["groups"][1]["line_ids"] = first, second
                raw["groups"].reverse()
                accept_native_structure(self.task, NativeStructureResponse.model_validate(raw))

    def test_identity_group_ids_furniture_boundaries_and_references_are_not_repaired(self):
        changes = [
            lambda raw: raw.update(task_id="native-foreign"),
            lambda raw: raw.update(source_sha256="b" * 64),
            lambda raw: raw.update(observation_sha256="b" * 64),
            lambda raw: raw.update(render_sha256="b" * 64),
            lambda raw: raw["groups"][0].update(id=raw["groups"][1]["id"]),
            lambda raw: raw["groups"][0].update(region_id="foreign"),
            lambda raw: raw["groups"][0].update(kind="furniture"),
            lambda raw: raw["groups"][2].update(kind="paragraph"),
            lambda raw: raw.update(references=[dict(span_id="foreign", role="note_callout")]),
            lambda raw: raw.update(
                boundary_dispositions=[
                    dict(candidate_id="foreign", candidate_sha256="b" * 64, disposition="literal")
                ]
            ),
        ]
        for index, change in enumerate(changes):
            with self.subTest(index=index), self.assertRaises(ValueError):
                raw = self.answer.model_dump()
                change(raw)
                raw["groups"].reverse()
                accept_native_structure(self.task, NativeStructureResponse.model_validate(raw))

    def test_roman_list_lookahead_uses_canonical_source_order(self):
        sources = [line("p1-list0", "i. First item."), line("p1-list1", "ii. Second item.", y=60)]
        observation, image = page(sources)
        task = prepare_native_structure(observation, SOURCE, image, [region("body", sources)])
        groups = [
            dict(
                id=f"item{i}",
                region_id="body",
                kind="list_item",
                line_ids=[s.id],
                list_ordered=True,
                list_start=i + 1,
                list_depth=1,
            )
            for i, s in enumerate(sources)
        ]
        actual = assemble_native_structure_source(
            task, response(task, list(reversed(groups))), observation
        )
        self.assertEqual(
            [(s.text, s.list_start) for s in actual.segments],
            [(sources[0].text, 1), (sources[1].text, 2)],
        )

    def test_cross_region_layout_proof_and_raw_classification_authority_survive_permutation(self):
        sources = [line("p1-left", "trans-"), line("p1-right", "cription.", x=330)]
        observation, image = page(sources)
        candidate = wrap_candidate(
            sources[0], line("p1-right", "cription.", y=60), region_id="left"
        )
        candidate = LayoutHyphenCandidate.model_validate(
            {
                **candidate.model_dump(),
                "right": {
                    **candidate.right.model_dump(),
                    "region_id": "right",
                    "box": sources[1].box.model_dump(),
                },
                "boundary": "column",
            }
        )
        task = prepare_native_structure(
            observation,
            SOURCE,
            image,
            [region("left", sources[:1], column=1), region("right", sources[1:], column=2)],
            candidates=[candidate],
        )
        groups = [
            dict(
                id="left-one",
                region_id="left",
                kind="paragraph",
                line_ids=[sources[0].id],
                continues_to_next=True,
            ),
            dict(
                id="right-one",
                region_id="right",
                kind="paragraph",
                line_ids=[sources[1].id],
                continues_from_previous=True,
            ),
        ]
        decision = LayoutHyphenDisposition(
            candidate_id=candidate.id,
            candidate_sha256=candidate_digest(candidate),
            disposition="layout",
        )
        ordered = response(task, groups, [decision])
        shuffled = response(task, list(reversed(groups)), [decision])
        original = shuffled.model_dump_json()
        actual = assemble_native_structure_source(task, shuffled, observation)
        expected = assemble_native_structure_source(task, ordered, observation)
        self.assertEqual(actual, expected)
        classification = retained_hyphen_decisions(task, shuffled, [candidate])[0].classification
        self.assertEqual(classification.response_sha256, document_digest(shuffled))
        self.assertNotEqual(classification.response_sha256, document_digest(ordered))
        self.assertEqual(shuffled.model_dump_json(), original)
        raw = shuffled.model_dump()
        raw["groups"][1]["continues_to_next"] = False
        with self.assertRaisesRegex(ValueError, "confirmed continuation"):
            accept_native_structure(task, NativeStructureResponse.model_validate(raw))
