"""Compact grammar preserves exact source roles, strict fences and original2 authority."""

import copy
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from pydantic import TypeAdapter, ValidationError

from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.reconstruction_v2.attempt_exchange import ExchangeWriter, json_bytes
from ava_pdf_epub.reconstruction_v2.attempt_initial_input import initial_input
from ava_pdf_epub.reconstruction_v2.native_hyphen_decisions import retained_hyphen_decisions
from ava_pdf_epub.reconstruction_v2.native_structure_assembly import (
    assemble_native_structure_source,
)
from ava_pdf_epub.reconstruction_v2.native_structure_contract import NativeStructureResponse
from ava_pdf_epub.reconstruction_v2.native_structure_exchange import emit_native, reply_native
from ava_pdf_epub.reconstruction_v2.native_structure_response import accept_native_structure
from ava_pdf_epub.reconstruction_v2.native_structure_v2_contract import NativeStructureResponse2
from ava_pdf_epub.reconstruction_v2.native_structure_v2_fields import NativeStructureGroup2
from ava_pdf_epub.reconstruction_v2.protocol import prepared_result, reconstruction_input
from ava_pdf_epub.reconstruction_v2.protocol_frontmatter_title import (
    FrontmatterTitleReconstructionInput,
)
from ava_pdf_epub.reconstruction_v2.protocol_native_word_wrap import NativeWordWrapPrepareResult
from ava_pdf_epub.reconstruction_v2.qualify_native_structure import qualify_native_structure

from .attempt_peer import PeerOutput
from .native_structure_decision_fixture import line, native_structure_wire_fixture
from .native_structure_routing_fixture import checkpoint, stored
from .native_structure_v2_fixture import initial2, native_structure2_source_fixture


class NativeStructure2Tests(unittest.TestCase):
    def test_role_variants_forbid_irrelevant_or_contradictory_attributes(self):
        base = dict(id="group", region_id="body", line_ids=["line"])
        roles = [
            dict(kind="heading", heading_role="chapter", chapter_role="bodymatter"),
            dict(kind="heading", heading_role="section", heading_level=2),
            dict(kind="paragraph", continues_from_previous=False, continues_to_next=False),
            dict(kind="note", note_label="1", note_role="footnote"),
            dict(kind="list_item", list_role="ordered", list_start=1, list_depth=1),
            dict(kind="list_item", list_role="unordered", list_depth=1),
            dict(kind="caption", related_to=None),
            dict(kind="furniture"),
        ]
        adapter = TypeAdapter(NativeStructureGroup2)
        for role in roles:
            adapter.validate_python({**base, **role})
        invalid = [
            (roles[2], "chapter_role", "bodymatter"),
            (roles[7], "chapter_role", "bodymatter"),
            (roles[0], "heading_level", 2),
            (roles[1], "chapter_role", "bodymatter"),
            (roles[4], "list_start", None),
            (roles[5], "list_start", 1),
            (roles[7], "note_label", None),
            (roles[6], "continues_to_next", False),
            (roles[2], "list_depth", 1),
            (roles[3], "related_to", None),
        ]
        for role, field, value in invalid:
            with self.subTest(role=role["kind"], field=field), self.assertRaises(ValidationError):
                adapter.validate_python({**base, **role, field: value})
        schema = NativeStructureResponse2.model_json_schema()
        self.assertEqual(len(schema["properties"]["groups"]["items"]["anyOf"]), 8)
        self.assertNotIn("oneOf", str(schema))
        self.assertNotIn("discriminator", str(schema))

    def test_source_assembly_and_original_response_provenance(self):
        observation, task, answer, candidate = native_structure2_source_fixture()
        before = copy.deepcopy(answer.model_dump())
        first = assemble_native_structure_source(task, answer, observation)
        self.assertEqual(first.segments[0].text, "Caller1 and trans- cription follows.")
        self.assertEqual(first.segments[0].source_text, "Caller1 and trans-\ncription follows.")
        self.assertEqual(first.segments[1].note_label, "1")
        self.assertEqual([m.line_id for m in first.line_maps], [s.id for s in observation.lines])
        reversed_answer = answer.model_copy(update={"groups": list(reversed(answer.groups))})
        second = assemble_native_structure_source(task, reversed_answer, observation)
        self.assertEqual(first, second)
        self.assertEqual(answer.model_dump(), before)
        decision = retained_hyphen_decisions(task, reversed_answer, [candidate])[0]
        self.assertEqual(decision.classification.response_sha256, document_digest(reversed_answer))
        self.assertNotEqual(decision.classification.response_sha256, document_digest(answer))
        self.assertEqual(reversed_answer.schema_version, "ava-native-structure-response-2")
        self.assertTrue(any(s.note_label == "1" for s in first.segments[0].spans))

    def test_old_and_new_receipts_are_mutually_closed(self):
        _, task2, answer2, _ = native_structure2_source_fixture()
        task1, answer1 = native_structure_wire_fixture()
        for task, answer in [(task1, answer2), (task2, answer1)]:
            with self.subTest(task=task.schema_version), self.assertRaises(ValueError):
                accept_native_structure(task, answer)
        raw = answer1.model_dump()
        raw["groups"][0]["chapter_role"] = "bodymatter"
        with self.assertRaises(ValidationError):
            NativeStructureResponse.model_validate(raw)
        with self.assertRaises(ValidationError):
            FrontmatterTitleReconstructionInput.model_validate(initial2())
        valid = {**initial2(), "native_structure_responses": [answer2.model_dump()]}
        reconstruction_input(valid)
        with self.assertRaises(ValidationError):
            reconstruction_input({**valid, "native_structure_responses": [answer1.model_dump()]})

    def test_source_identity_membership_and_boundary_reference_refusals(self):
        _, task, answer, _ = native_structure2_source_fixture()
        changes = [
            dict(task_id="foreign"),
            dict(source_sha256="b" * 64),
            dict(observation_sha256="b" * 64),
            dict(render_sha256="b" * 64),
            dict(unresolved=["essential uncertainty"]),
            dict(language="fr"),
        ]
        for change in changes:
            with self.subTest(change=list(change)), self.assertRaises(ValueError):
                accept_native_structure(task, answer.model_copy(update=change))
        for mutation in (
            "missing",
            "duplicate",
            "foreign",
            "reverse",
            "furniture",
            "boundary",
            "reference",
        ):
            raw = answer.model_dump()
            if mutation == "missing":
                raw["groups"].pop()
            elif mutation == "duplicate":
                raw["groups"][1]["id"] = raw["groups"][0]["id"]
            elif mutation == "foreign":
                raw["groups"][0]["line_ids"][0] = "foreign"
            elif mutation == "reverse":
                raw["groups"][0]["line_ids"].reverse()
            elif mutation == "furniture":
                raw["groups"][0] = dict(
                    id="body-one",
                    region_id="body",
                    line_ids=raw["groups"][0]["line_ids"],
                    kind="furniture",
                )
            elif mutation == "boundary":
                raw["boundary_dispositions"][0]["candidate_sha256"] = "b" * 64
            else:
                raw["references"][0]["span_id"] = "foreign"
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                accept_native_structure(task, NativeStructureResponse2.model_validate(raw))

    def test_input8_requires_all_dependencies_and_empty_initial_receipts(self):
        raw = initial2()
        parsed = initial_input(json_bytes(dict(mode="attempt_stream", input=raw)))
        self.assertEqual(parsed.schema_version, "ava-reconstruct-input-8")
        for field in [
            "source_title_policy",
            "source_normalization_policy",
            "source_layout_policy",
            "recognition_repair_policy",
            "source_feature_policy",
        ]:
            bad = dict(raw)
            bad.pop(field)
            with self.subTest(field=field), self.assertRaises(ValueError):
                initial_input(json_bytes(dict(mode="attempt_stream", input=bad)))
        _, _, answer, _ = native_structure2_source_fixture()
        with self.assertRaises(ValueError):
            initial_input(
                json_bytes(
                    dict(
                        mode="attempt_stream",
                        input={**raw, "native_structure_responses": [answer.model_dump()]},
                    )
                )
            )

    def test_explicit_qualification_keeps_task_count_and_closed_prepare5(self):
        with TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = checkpoint(scratch, [line("p1-line0", "Ordinary text.")])
            pages = stored(scratch, [source])
            with self.assertRaises(ValueError):
                qualify_native_structure(pages, scratch, "ava-native-structure-2")
            qualify_native_structure(
                pages,
                scratch,
                "ava-native-structure-2",
                source_normalization_policy="ava-native-word-wrap-1",
            )
            prepared = pages[0]
            self.assertEqual(prepared.observation, source.observation)
            self.assertEqual(len(prepared.tasks), len(source.tasks))
            self.assertEqual(prepared.schema_version, "ava-prepared-page-5")
            self.assertEqual(prepared.tasks[0].schema_version, "ava-native-structure-task-2")
            result = prepared_result(prepared)
            self.assertEqual(result.schema_version, "ava-prepare-result-5")
            raw = result.model_dump()
            raw.update(
                schema_version="ava-prepare-result-4",
                source_structure_policy="ava-native-structure-1",
            )
            with self.assertRaises(ValidationError):
                NativeWordWrapPrepareResult.model_validate(raw)
            pages.clear_cache()
            self.assertEqual(pages[0], prepared)
            self.assertEqual(prepared.tasks[0].image.sha256, source.observation.render_sha256)

    def test_native2_exchange_shared_sequence_strict_marker_and_terminal(self):
        peer = PeerOutput(lambda _: [{"decision": "source-owned"}])
        writer = ExchangeWriter(peer, "a" * 64, "ava-pdf-prose-en-v2", version=2)
        packet = emit_native(writer, "source-task", version=2)
        self.assertEqual(packet.schema_version, "ava-native-structure-exchange-2")
        self.assertEqual(reply_native(writer, peer.incoming, packet), {"decision": "source-owned"})
        writer.emit("refusal", {})
        with self.assertRaises(ValueError):
            emit_native(writer, "other", version=2)
        peer = PeerOutput(
            lambda packet: json_bytes(
                {**packet, "schema_version": "ava-native-structure-exchange-1", "payload": [{}]}
            )
        )
        writer = ExchangeWriter(peer, "a" * 64, "ava-pdf-prose-en-v2", version=2)
        packet = emit_native(writer, "source-task", version=2)
        with self.assertRaises(ValidationError):
            reply_native(writer, peer.incoming, packet)
