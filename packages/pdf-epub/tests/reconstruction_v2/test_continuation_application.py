"""Captured presentation reaches source joins without changing text, links or raw receipts."""

import json
import unittest

from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.reconstruction_v2.apply_refinement import apply_refinement
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_application import (
    finalize_continuation_presentation,
    prepare_continuation_application,
)
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import (
    POLICY,
    PresentationRefinementResponse,
    PresentationRefinementTask,
)
from ava_pdf_epub.reconstruction_v2.protocol import reconstruction_input
from ava_pdf_epub.reconstruction_v2.refinement_digest import observation_digest
from ava_pdf_epub.reconstruction_v2.refinement_identity import refinement_identifier
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan, Segment
from ava_pdf_epub.reconstruction_v2.stream_joins import stream_joins
from ava_pdf_epub.reconstruction_v2.validate_refinement import validate_refinement

from .test_continuation_presentation import fixture


def source_case(native_first=True):
    task, response = fixture(native_first)
    segments = [
        Segment(
            id=node.id,
            page=node.page,
            box=task.crops[i].source_box,
            kind="paragraph",
            text=node.text_excerpt,
            style=node.observed_style,
            method="native" if node.id in task.native_endpoints else "ocr",
            native_line_ids=["source-" + node.id] if node.id in task.native_endpoints else [],
            spans=[ObservedSpan(start=1, end=3, url="https://example.com/keep")],
        )
        for i, node in enumerate(task.nodes)
    ]
    raw = task.model_dump(mode="json")
    raw["observation_sha256"] = observation_digest(segments)
    raw["task_id"] = refinement_identifier(raw)
    task = PresentationRefinementTask.model_validate(raw)
    raw = response.model_dump(mode="json")
    raw.update(task_id=task.task_id, observation_sha256=task.observation_sha256)
    response = PresentationRefinementResponse.model_validate(raw)
    state = AssemblyState(source_continuation_policy=POLICY)
    state.evidence.update({segment.id: [] for segment in segments})
    return segments, task, response, state


class ContinuationApplicationTest(unittest.TestCase):
    def test_real_application_conserves_text_links_aliases_and_audit_authority(self):
        for direction in (True, False):
            segments, task, response, state = source_case(direction)
            before = [segment.model_dump(mode="json") for segment in segments]
            raw_hashes = document_digest(task), document_digest(response)
            result = apply_refinement(segments, [task], [response], state)
            joined = stream_joins(result, state)
            self.assertEqual(1, len(joined))
            self.assertEqual("left right", joined[0].text)
            self.assertEqual("left\nright", joined[0].source_text)
            self.assertEqual(("left", 5), state.aliases["right"])
            self.assertEqual([(1, 3), (6, 8)], [(span.start, span.end) for span in joined[0].spans])
            self.assertTrue(all(span.url == "https://example.com/keep" for span in joined[0].spans))
            self.assertEqual(before, [segment.model_dump(mode="json") for segment in segments])
            self.assertEqual(raw_hashes, (document_digest(task), document_digest(response)))
            self.assertEqual(task.task_id, state.refinement_evidence[0]["task_id"])
            self.assertEqual(raw_hashes[0], state.refinement_evidence[0]["task_sha256"])
            self.assertEqual(raw_hashes[1], state.refinement_evidence[0]["response_sha256"])
            self.assertEqual(
                task.nodes[1].observed_style.space_after_em, joined[0].style.space_after_em
            )
            self.assertEqual(task.nodes[0].observed_style.indent_em, joined[0].style.indent_em)
            self.assertEqual("justify", joined[0].style.align)
            self.assertIsNotNone(state.continuation_presentation)
            altered = result[1].model_copy(
                update={"style": result[1].style.model_copy(update={"bold": True})}
            )
            with self.assertRaisesRegex(ValueError, "contradicts"):
                finalize_continuation_presentation(
                    [result[0], altered], state.continuation_presentation
                )

    def test_selected_pair_cannot_absorb_an_unwitnessed_native_component(self):
        segments, task, response, state = source_case(False)
        result = apply_refinement(segments, [task], [response], state)
        third = result[1].model_copy(
            update={
                "id": "third",
                "page": 3,
                "text": "continues",
                "style": result[1].style.model_copy(update={"bold": True, "space_after_em": 2.1}),
            }
        )
        state.evidence[third.id] = []
        for declared in (False, True):
            if declared:
                state.refined_joins[("right", "third")] = True
            with self.assertRaisesRegex(ValueError, "Unwitnessed"):
                stream_joins([*result, third], state)

    def test_literal_source_lines_cannot_enter_this_presentation_policy(self):
        segments, task, response, _ = source_case()
        segments[1] = segments[1].model_copy(update={"preserve_line_breaks": True})
        with self.assertRaisesRegex(ValueError, "qualified prose"):
            prepare_continuation_application(segments, [task], [response], POLICY)

    def test_observed_fragment_feature_must_survive_the_final_head_owned_style(self):
        segments, task, response, state = source_case()
        result = apply_refinement(segments, [task], [response], state)
        observed = {
            "node_id": "right",
            "feature": "first_line_indent",
            "disposition": "observed",
            "value": 0,
        }
        with self.assertRaisesRegex(ValueError, "final joined"):
            finalize_continuation_presentation(result, state.continuation_presentation, [observed])
        unknown = {**observed, "disposition": "unknown", "value": None}
        self.assertEqual(
            result,
            finalize_continuation_presentation(result, state.continuation_presentation, [unknown]),
        )

    def test_old_or_wrong_policy_cannot_apply_new_authority(self):
        segments, task, response, state = source_case()
        for value in (None, "future"):
            state.source_continuation_policy = value
            with self.assertRaisesRegex(ValueError, "Input10"):
                apply_refinement(segments, [task], [response], state)

    def test_installed_semantic_entry_accepts_exact_new_pair(self):
        _, task, response, _ = source_case()
        for value in (None, response.model_dump(mode="json")):
            receipt = validate_refinement(
                json.dumps(
                    dict(
                        mode="validate_refinement",
                        task=task.model_dump(mode="json"),
                        response=value,
                    )
                ).encode()
            )
            self.assertTrue(receipt["valid"])

    def test_input10_is_explicit_and_historical_wire_stays_closed(self):
        _, task, response, _ = source_case()
        raw = dict(
            schema_version="ava-reconstruct-input-10",
            source_sha256=task.source_sha256,
            profile_id=task.profile_id,
            source_feature_policy="ava-ocr-source-features-1",
            source_layout_policy="ava-native-layout-1",
            source_structure_policy="ava-native-structure-2",
            source_normalization_policy="ava-native-word-wrap-1",
            recognition_repair_policy="ava-recognition-geometry-repair-2",
            source_title_policy="ava-frontmatter-title-1",
            source_continuation_policy=POLICY,
            responses=[],
            native_structure_responses=[],
            word_wrap_responses=[],
            geometry_corrections=[],
            refinements=[response.model_dump(mode="json")],
        )
        current = reconstruction_input(raw)
        self.assertEqual(POLICY, current.source_continuation_policy)
        self.assertEqual(raw, current.model_dump(mode="json"))
        for changed in [
            {**raw, "schema_version": "ava-reconstruct-input-9"},
            {key: value for key, value in raw.items() if key != "source_continuation_policy"},
            {**raw, "source_continuation_policy": "future"},
        ]:
            with self.assertRaises(ValueError):
                reconstruction_input(changed)
        legacy = {key: value for key, value in raw.items() if key != "source_continuation_policy"}
        legacy["schema_version"] = "ava-reconstruct-input-9"
        with self.assertRaises(ValueError):
            reconstruction_input(legacy)
