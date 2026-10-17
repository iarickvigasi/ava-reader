"""Raw native references and page starts survive explicit lexical-wrap normalization."""

import unittest

from ava_pdf_epub.contracts.layout_hyphen import LayoutHyphenDisposition, candidate_digest
from ava_pdf_epub.contracts.normalization import NormalizationMap
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.canonical_text import canonical_text
from ava_pdf_epub.reconstruction_v2.native_hyphen_decisions import retained_hyphen_decisions
from ava_pdf_epub.reconstruction_v2.native_structure_assembly import (
    assemble_native_structure_source,
)
from ava_pdf_epub.reconstruction_v2.native_structure_source import prepare_native_structure
from ava_pdf_epub.reconstruction_v2.normalize_native_hyphens import normalize_native_hyphens
from ava_pdf_epub.reconstruction_v2.source_page_starts import capture_page_starts
from ava_pdf_epub.reconstruction_v2.stream_joins import stream_joins

from .native_structure_decision_fixture import SOURCE, line, page, region, response, wrap_candidate


def case(disposition="layout"):
    lines = [line("p1-left", "We are possess-"), line("p1-right", "ing details.", y=60)]
    observation, image = page(lines)
    candidate = wrap_candidate(*lines)
    task = prepare_native_structure(
        observation, SOURCE, image, [region("body", lines)], candidates=[candidate]
    )
    decision = LayoutHyphenDisposition(
        candidate_id=candidate.id,
        candidate_sha256=candidate_digest(candidate),
        disposition=disposition,
    )
    answer = response(
        task,
        [dict(id="body", region_id="body", line_ids=[item.id for item in lines], kind="paragraph")],
        [decision],
    )
    assembled = assemble_native_structure_source(task, answer, observation)
    segment = assembled.segments[0]
    state = AssemblyState()
    state.native_hyphen_decisions = retained_hyphen_decisions(task, answer, [candidate])
    state.native_source_lines = {item.id: item.text for item in lines}
    state.evidence[segment.id] = [
        dict(page=1, region_id="body", method="native", box=segment.box.model_dump())
    ]
    return segment, state


class NativeHyphenAssemblyTests(unittest.TestCase):
    def test_source_map_styles_links_and_page_start_use_normalized_coordinates(self):
        segment, state = case()
        at = segment.text.index("details")
        state.internal_targets = [(segment.id, at, at + 7, segment.id, at)]
        state.aliases["original-detail"] = (segment.id, at)
        result = normalize_native_hyphens([segment], state)[0]
        self.assertEqual(result.text, "We are possessing details.")
        self.assertEqual(result.source_text, "We are possess-\ning details.")
        expected_at = "We are possessing details.".index("details")
        self.assertEqual(
            state.internal_targets,
            [(segment.id, expected_at, expected_at + 7, segment.id, expected_at)],
        )
        self.assertEqual(state.aliases["original-detail"], (segment.id, expected_at))
        starts = capture_page_starts([result], state)
        self.assertEqual(starts[1].text, "We are possessing details.")
        content = canonical_text(result.text, result.spans, result.source_text, result.id, state)
        self.assertEqual(content["normalization"]["schema_version"], "ava-source-normalization-2")
        self.assertEqual(
            content["normalization"]["derivations"][0]["source_disposition"]["disposition"],
            "layout",
        )
        with self.assertRaises(ValueError):
            NormalizationMap.model_validate(content["normalization"])

    def test_literal_decision_keeps_the_printed_hyphen(self):
        segment, state = case("literal")
        result = normalize_native_hyphens([segment], state)[0]
        self.assertEqual(result.text, "We are possess-ing details.")

    def test_final_nonprose_role_and_collapsed_source_caller_refuse(self):
        segment, state = case()
        with self.assertRaisesRegex(ValueError, "grouping"):
            normalize_native_hyphens([segment.model_copy(update={"kind": "quote"})], state)
        segment, state = case()
        at = segment.text.index("-")
        state.internal_targets = [(segment.id, at, at + 1, segment.id, 0)]
        with self.assertRaisesRegex(ValueError, "referenced"):
            normalize_native_hyphens([segment], state)

    def test_cross_page_join_composes_without_changing_captured_page_text(self):
        segment, state = case()
        first = normalize_native_hyphens([segment], state)[0].model_copy(
            update={"continues_to_next": True}
        )
        second = first.model_copy(
            update={
                "id": "p2-body",
                "page": 2,
                "text": "Further prose.",
                "source_text": "Further prose.",
                "spans": [],
                "native_line_ids": ["p2-line"],
                "continues_to_next": False,
                "continues_from_previous": True,
            }
        )
        state.evidence[second.id] = [
            dict(page=2, region_id="p2-region", method="native", box=second.box.model_dump())
        ]
        state.placements = {first.id: (1, 0, 0), second.id: (2, 0, 0)}
        starts = capture_page_starts([first, second], state)
        joined = stream_joins([first, second], state)[0]
        self.assertEqual(joined.text, "We are possessing details. Further prose.")
        target, offset = state.aliases[second.id]
        self.assertEqual(target, first.id)
        self.assertEqual(joined.text[offset : offset + len(starts[2].text)], starts[2].text)
        self.assertTrue(joined.text.startswith(starts[1].text))
        state.normalization_maps[first.id].validate_canonical(joined.text)
