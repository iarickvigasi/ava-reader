"""Current exchange keeps its shared parent fence for the newly eligible cell error."""

import io
import struct
import unittest

from ava_pdf_epub.reconstruction_v2.attempt_exchange import ExchangeWriter, json_bytes
from ava_pdf_epub.reconstruction_v2.attempt_recognition_geometry import accept_geometry_attempt
from ava_pdf_epub.reconstruction_v2.recognition_cell_geometry_repair import (
    prepare_cell_geometry_repair,
)
from ava_pdf_epub.reconstruction_v2.recognition_geometry_exchange import emit_geometry
from ava_pdf_epub.reconstruction_v2.recognition_geometry_identity import geometry_digest

from .test_cell_geometry_containment import containment
from .test_cell_geometry_repair import answer


class CellContainmentExchangeTests(unittest.TestCase):
    def exchange(self, *, unresolved=False):
        parent, raw, good = containment()
        original = json_bytes(raw).decode()
        task = prepare_cell_geometry_repair(parent, original)
        response = answer(task, good).model_dump(mode="json")
        if unresolved:
            response.update(
                outcome="unresolved", patches=[], unresolved_reason="NO_UNIQUE_SOURCE_BOX"
            )
        data = json_bytes(
            dict(
                schema_version="ava-recognition-geometry-exchange-1",
                sequence=1,
                source_sha256=parent.source_sha256,
                profile_id=parent.profile_id,
                kind="geometry",
                payload=[response],
            )
        )
        writer = ExchangeWriter(io.BytesIO(), parent.source_sha256, parent.profile_id, version=2)
        incoming = io.BytesIO(struct.pack(">I", len(data)) + data)
        packet = dict(
            schema_version="ava-recognition-attempt-reply-1",
            response=raw,
            original_response_json=original,
            original_response_sha256=geometry_digest(original.encode()),
        )
        return parent, task, writer, incoming, packet, good

    def test_source_bound_exchange_corrects_only_selected_box_and_consumes_parent_once(self):
        parent, task, writer, incoming, packet, good = self.exchange()
        result, proof = accept_geometry_attempt(parent, packet, writer, incoming, allow_cells=True)
        self.assertEqual(good, result)
        self.assertEqual(packet["original_response_json"], proof.original_response_json)
        self.assertIn(parent.task_id, writer._anchor_context_parents)
        with self.assertRaises(ValueError):
            emit_geometry(writer, task)

    def test_unresolved_or_missing_authority_never_gets_another_correction(self):
        for enabled in (False, True):
            parent, task, writer, incoming, packet, _ = self.exchange(unresolved=True)
            with self.subTest(enabled=enabled), self.assertRaises(ValueError):
                accept_geometry_attempt(parent, packet, writer, incoming, allow_cells=enabled)
            if enabled:
                self.assertIn(parent.task_id, writer._anchor_context_parents)
                with self.assertRaises(ValueError):
                    emit_geometry(writer, task)
            else:
                self.assertEqual(0, writer.sequence)
                self.assertFalse(writer._anchor_context_parents)
