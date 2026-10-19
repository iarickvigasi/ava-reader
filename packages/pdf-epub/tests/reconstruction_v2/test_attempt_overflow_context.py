"""Only current repair authority can emit the one bound raw-context correction."""

import io
import struct
import unittest

from ava_pdf_epub.reconstruction_v2.attempt_exchange import ExchangeWriter, json_bytes
from ava_pdf_epub.reconstruction_v2.attempt_recognition_geometry import accept_geometry_attempt
from ava_pdf_epub.reconstruction_v2.overflow_context_prepare import prepare_overflow_context
from ava_pdf_epub.reconstruction_v2.recognition_anchor_context import validate_anchor_context
from ava_pdf_epub.reconstruction_v2.recognition_anchor_exchange import (
    AnchorContextExchange,
    emit_context,
)
from ava_pdf_epub.reconstruction_v2.recognition_geometry_identity import geometry_digest

from .overflow_context_fixture import overflow_fixture
from .test_recognition_anchor_context import correction


class AttemptOverflowContextTests(unittest.TestCase):
    def test_normal_current_attempt_selects_one_bound_context_and_old_authority_refuses(self):
        task, raw = overflow_fixture()
        original = json_bytes(raw).decode()
        candidate = prepare_overflow_context(task, original)
        reply = correction(candidate)
        packet = AnchorContextExchange(
            schema_version="ava-recognition-anchor-context-exchange-1",
            sequence=1,
            source_sha256=task.source_sha256,
            profile_id=task.profile_id,
            kind="anchor_context",
            payload=[reply.model_dump(mode="json")],
        )
        data = json_bytes(packet.model_dump(mode="json"))
        incoming = io.BytesIO(struct.pack(">I", len(data)) + data)
        outgoing = io.BytesIO()
        writer = ExchangeWriter(outgoing, task.source_sha256, task.profile_id, version=2)
        raw_reply = dict(
            schema_version="ava-recognition-attempt-reply-1",
            response=raw,
            original_response_json=original,
            original_response_sha256=geometry_digest(original.encode()),
        )
        patched, proof = accept_geometry_attempt(
            task, raw_reply, writer, incoming, allow_cells=True, allow_overflow=True
        )
        self.assertIsNone(proof)
        self.assertEqual(" Alpha", patched["segments"][0]["spans"][0]["anchor"]["after"])
        emitted = AnchorContextExchange.model_validate_json(outgoing.getvalue()[4:])
        self.assertEqual(candidate.model_dump(mode="json"), emitted.payload)
        self.assertEqual(b"", incoming.read())
        with self.assertRaisesRegex(ValueError, "SECOND_PASS_REFUSED"):
            emit_context(writer, candidate)
        for cells in (False, True):
            historical = io.BytesIO()
            with self.assertRaises(ValueError):
                accept_geometry_attempt(
                    task,
                    raw_reply,
                    ExchangeWriter(historical, task.source_sha256, task.profile_id, version=2),
                    io.BytesIO(),
                    allow_cells=cells,
                )
            self.assertEqual(b"", historical.getvalue())
        receipt = validate_anchor_context(
            json_bytes(
                dict(
                    mode="validate_anchor_context",
                    task=task.model_dump(mode="json"),
                    correction=candidate.model_dump(mode="json"),
                )
            )
        )
        self.assertEqual("ava-anchor-context-checked-2", receipt["schema_version"])
