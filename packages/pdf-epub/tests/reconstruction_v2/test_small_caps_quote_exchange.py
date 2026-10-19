"""Current-only selection happens before exchange and consumes the existing parent slot."""

import io
import struct
import unittest

from ava_pdf_epub.reconstruction_v2.attempt_exchange import ExchangeWriter, json_bytes
from ava_pdf_epub.reconstruction_v2.recognition_anchor_exchange import accept_attempt_recognition
from ava_pdf_epub.reconstruction_v2.recognition_anchor_quote import prepare_anchor_quote

from .small_caps_fixture import correction, fixture


class SmallCapsExchange(unittest.TestCase):
    def test_current_selects_task3_and_legacy_emits_nothing(self):
        parent, raw = fixture()
        task = prepare_anchor_quote(parent, json_bytes(raw).decode(), small_caps=True)
        packet = dict(
            schema_version="ava-recognition-anchor-quote-exchange-2",
            sequence=1,
            source_sha256=parent.source_sha256,
            profile_id=parent.profile_id,
            kind="anchor_quote",
            payload=[correction(task).model_dump(mode="json")],
        )
        wire = json_bytes(packet)
        for current in [False, True]:
            with self.subTest(current=current):
                outgoing = io.BytesIO()
                writer = ExchangeWriter(outgoing, parent.source_sha256, parent.profile_id)
                incoming = io.BytesIO(struct.pack(">I", len(wire)) + wire)
                if current:
                    result = accept_attempt_recognition(parent, raw, writer, incoming, True, True)
                    self.assertEqual(
                        "BC", result["segments"][0]["spans"][0]["anchor"]["exact_text"]
                    )
                    self.assertIn(b"ava-recognition-anchor-quote-task-3", outgoing.getvalue())
                else:
                    with self.assertRaises(ValueError):
                        accept_attempt_recognition(parent, raw, writer, incoming, True, False)
                    self.assertEqual(b"", outgoing.getvalue())
