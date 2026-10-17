"""New authority cannot rewrite parents or borrow a historical correction opportunity."""

import io
import json
import struct
import unittest
from types import SimpleNamespace

from ava_pdf_epub.reconstruction_v2.attempt_exchange import ExchangeWriter, json_bytes
from ava_pdf_epub.reconstruction_v2.attempt_initial_input import initial_input
from ava_pdf_epub.reconstruction_v2.attempt_recognition_geometry import accept_geometry_attempt
from ava_pdf_epub.reconstruction_v2.protocol import reconstruction_input
from ava_pdf_epub.reconstruction_v2.recognition_cell_geometry_contract import (
    RecognitionCellGeometryProof,
)
from ava_pdf_epub.reconstruction_v2.recognition_cell_geometry_repair import (
    apply_cell_geometry_repair as apply_geometry_repair,
)
from ava_pdf_epub.reconstruction_v2.recognition_cell_geometry_repair import (
    prepare_cell_geometry_repair,
)
from ava_pdf_epub.reconstruction_v2.recognition_geometry_exchange import emit_geometry
from ava_pdf_epub.reconstruction_v2.recognition_geometry_identity import geometry_digest
from ava_pdf_epub.reconstruction_v2.validate_geometry import validate_geometry
from ava_pdf_epub.reconstruction_v2.validate_geometry_proofs import validate_geometry_proofs

from .test_cell_geometry_repair import answer, authored


def authored_fixture():
    parent, raw, good = authored()
    text = json_bytes(raw).decode()
    task = prepare_cell_geometry_repair(parent, text)
    return parent, text, task, answer(task, good)


def initial():
    task, _, _, _ = authored_fixture()
    return dict(
        schema_version="ava-reconstruct-input-9",
        profile_id=task.profile_id,
        source_sha256=task.source_sha256,
        source_feature_policy="ava-ocr-source-features-1",
        source_layout_policy="ava-native-layout-1",
        source_structure_policy="ava-native-structure-2",
        source_title_policy="ava-frontmatter-title-1",
        source_normalization_policy="ava-native-word-wrap-1",
        native_structure_responses=[],
        word_wrap_responses=[],
        responses=[],
        refinements=[],
        recognition_repair_policy="ava-recognition-geometry-repair-2",
        geometry_corrections=[],
    )


class CellGeometryAttemptTests(unittest.TestCase):
    def test_initial_is_opt_in_closed_and_empty(self):
        fields = initial()
        self.assertEqual(
            initial_input(json_bytes(dict(mode="attempt_stream", input=fields))).schema_version,
            "ava-reconstruct-input-9",
        )
        for field in ("recognition_repair_policy", "geometry_corrections"):
            missing = {k: v for k, v in fields.items() if k != field}
            with self.subTest(field=field), self.assertRaises(ValueError):
                initial_input(json_bytes(dict(mode="attempt_stream", input=missing)))
        for marker in (
            "ava-reconstruct-input-1",
            "ava-reconstruct-input-3",
            "ava-reconstruct-input-4",
            "ava-reconstruct-input-5",
            "ava-reconstruct-input-8",
        ):
            with self.subTest(marker=marker), self.assertRaises(ValueError):
                reconstruction_input({**fields, "schema_version": marker})

    def test_exact_raw_reply_returns_box_only_result_and_replay_proof(self):
        parent, raw, task, answer = authored_fixture()
        writer = ExchangeWriter(io.BytesIO(), parent.source_sha256, parent.profile_id, version=2)
        reply = dict(
            schema_version="ava-recognition-geometry-exchange-1",
            sequence=1,
            source_sha256=parent.source_sha256,
            profile_id=parent.profile_id,
            kind="geometry",
            payload=[answer.model_dump(mode="json")],
        )
        data = json_bytes(reply)
        result, proof = accept_geometry_attempt(
            parent,
            dict(
                schema_version="ava-recognition-attempt-reply-1",
                response=json.loads(raw),
                original_response_json=raw,
                original_response_sha256=geometry_digest(raw.encode()),
            ),
            writer,
            io.BytesIO(struct.pack(">I", len(data)) + data),
            allow_cells=True,
        )
        self.assertEqual(result, apply_geometry_repair(parent, task, answer))
        self.assertEqual(proof.original_response_json, raw)
        self.assertIn(parent.task_id, writer._anchor_context_parents)
        with self.assertRaises(ValueError):
            emit_geometry(writer, task)
        request = reconstruction_input(
            {
                **initial(),
                "responses": [result],
                "geometry_corrections": [proof.model_dump(mode="json")],
            }
        )
        pages = [SimpleNamespace(tasks=[parent])]
        validate_geometry_proofs(pages, request)
        changed = request.model_dump(mode="json")
        changed["responses"][0]["segments"][0]["text"] += " altered"
        with self.assertRaisesRegex(ValueError, "FINAL_RESPONSE"):
            validate_geometry_proofs(pages, reconstruction_input(changed))

    def test_original_byte_digest_and_nonbox_payload_cannot_change(self):
        parent, raw, _, _ = authored_fixture()
        response = json.loads(raw)
        response["segments"][0]["text"] += " altered"
        reply = dict(
            schema_version="ava-recognition-attempt-reply-1",
            response=response,
            original_response_json=raw,
            original_response_sha256=geometry_digest(raw.encode()),
        )
        writer = ExchangeWriter(io.BytesIO(), parent.source_sha256, parent.profile_id, version=2)
        with self.assertRaisesRegex(ValueError, "ORIGINAL_RECEIPT"):
            accept_geometry_attempt(parent, reply, writer, io.BytesIO())
        self.assertEqual(writer.sequence, 0)
        self.assertFalse(writer._anchor_context_parents)

    def test_independent_predispatch_gate_binds_exact_request_and_eligibility(self):
        parent, _, task, answer = authored_fixture()
        fields = dict(
            mode="validate_geometry",
            original=parent.model_dump(mode="json"),
            task=task.model_dump(mode="json"),
            response=None,
        )
        data = json_bytes(fields)
        self.assertEqual(
            validate_geometry(data),
            dict(
                schema_version="ava-recognition-geometry-validation-1",
                valid=True,
                request_sha256=geometry_digest(data),
            ),
        )
        validate_geometry(json_bytes({**fields, "response": answer.model_dump(mode="json")}))
        fields["task"]["image"]["width"] += 1
        with self.assertRaises(ValueError):
            validate_geometry(json_bytes(fields))

    def test_correction_unresolved_consumes_shared_opportunity(self):
        parent, raw, task, answer = authored_fixture()
        fields = answer.model_dump(mode="json")
        fields.update(outcome="unresolved", patches=[], unresolved_reason="IMAGE_UNCLEAR")
        wire = json_bytes(
            dict(
                schema_version="ava-recognition-geometry-exchange-1",
                sequence=1,
                source_sha256=parent.source_sha256,
                profile_id=parent.profile_id,
                kind="geometry",
                payload=[fields],
            )
        )
        writer = ExchangeWriter(io.BytesIO(), parent.source_sha256, parent.profile_id, version=2)
        with self.assertRaises(ValueError):
            accept_geometry_attempt(
                parent,
                dict(
                    schema_version="ava-recognition-attempt-reply-1",
                    response=json.loads(raw),
                    original_response_json=raw,
                    original_response_sha256=geometry_digest(raw.encode()),
                ),
                writer,
                io.BytesIO(struct.pack(">I", len(wire)) + wire),
                allow_cells=True,
            )
        self.assertIn(parent.task_id, writer._anchor_context_parents)
        with self.assertRaises(ValueError):
            emit_geometry(writer, task)

    def test_proof_duplicate_unresolved_foreign_parent_and_replay_refuse(self):
        parent, raw, task, answer = authored_fixture()
        patched = apply_geometry_repair(parent, task, answer)
        proof = RecognitionCellGeometryProof(
            original_response_json=raw,
            original_response_sha256=geometry_digest(raw.encode()),
            response=answer,
        ).model_dump(mode="json")
        for proofs in (
            [proof, proof],
            [{**proof, "original_response_sha256": "e" * 64}],
            [{**proof, "response": {**proof["response"], "original_task_id": "foreign"}}],
        ):
            with self.subTest(proofs=len(proofs)), self.assertRaises(ValueError):
                reconstruction_input(
                    {**initial(), "responses": [patched], "geometry_corrections": proofs}
                )
        old_writer = ExchangeWriter(io.BytesIO(), parent.source_sha256, parent.profile_id)
        with self.assertRaises(ValueError):
            emit_geometry(old_writer, task)

    def test_old_attempt_cannot_dispatch_cells_and_shared_parent_is_consumed(self):
        parent, raw, task, _ = authored_fixture()
        reply = dict(
            schema_version="ava-recognition-attempt-reply-1",
            response=json.loads(raw),
            original_response_json=raw,
            original_response_sha256=geometry_digest(raw.encode()),
        )
        writer = ExchangeWriter(io.BytesIO(), parent.source_sha256, parent.profile_id, version=2)
        with self.assertRaises(ValueError):
            accept_geometry_attempt(parent, reply, writer, io.BytesIO())
        self.assertEqual(writer.sequence, 0)
        writer._anchor_context_parents.add(parent.task_id)
        with self.assertRaises(ValueError):
            accept_geometry_attempt(parent, reply, writer, io.BytesIO(), allow_cells=True)
        self.assertEqual(writer.sequence, 0)
