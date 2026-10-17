"""Exchange2 carries the finite lexical phase; older framing remains closed and bounded."""

import io
import unittest
from unittest.mock import patch

from pydantic import ValidationError

from ava_pdf_epub.reconstruction_v2.attempt_exchange import ExchangeWriter, json_bytes
from ava_pdf_epub.reconstruction_v2.native_structure_exchange import emit_native, reply_native

from .attempt_peer import PeerOutput


class WordWrapExchangeTests(unittest.TestCase):
    def test_exchange2_keeps_native_marker_and_shared_sequence_reply_budget(self):
        peer = PeerOutput(lambda packet: [{}] if packet["kind"] == "native_structure" else [])
        writer = ExchangeWriter(peer, "a" * 64, "ava-pdf-prose-en-v2", version=2)
        page = writer.emit("page", {})
        writer.reply(peer.incoming, page)
        native = emit_native(writer, "native-task")
        self.assertEqual(reply_native(writer, peer.incoming, native), {})
        word = writer.emit("word_wrap", {"task_id": "word-task"})
        writer.reply(peer.incoming, word)
        self.assertEqual([control["sequence"] for control in peer.controls], [1, 2, 3])
        self.assertEqual(native.schema_version, "ava-native-structure-exchange-1")
        self.assertEqual(word.schema_version, "ava-reconstruction-exchange-2")
        self.assertGreater(writer._reply_bytes, 0)

    def test_historical_writer_rejects_lexical_kind_and_old_reply_cannot_answer_version2(self):
        with self.assertRaises(ValidationError):
            ExchangeWriter(io.BytesIO(), "a" * 64, "ava-pdf-prose-en-v2").emit("word_wrap", {})
        peer = PeerOutput(
            lambda packet: json_bytes(
                {
                    **packet,
                    "schema_version": "ava-reconstruction-exchange-1",
                    "payload": [],
                }
            )
        )
        writer = ExchangeWriter(peer, "a" * 64, "ava-pdf-prose-en-v2", version=2)
        packet = writer.emit("word_wrap_batch", {})
        with self.assertRaises(ValidationError):
            writer.reply(peer.incoming, packet)

    def test_exchange2_preserves_original_total_reply_limit_and_batch_control_limit(self):
        peer = PeerOutput(lambda _: [])
        writer = ExchangeWriter(peer, "a" * 64, "ava-pdf-prose-en-v2", version=2)
        packet = writer.emit("word_wrap_batch", {})
        with patch("ava_pdf_epub.reconstruction_v2.attempt_exchange.TOTAL_REPLY_BYTES", 8):
            with self.assertRaisesRegex(ValueError, "byte bound"):
                writer.reply(peer.incoming, packet)
        with self.assertRaisesRegex(ValueError, "control byte bound"):
            writer.emit("word_wrap_batch", "x" * (8 * 1024 * 1024 + 2048))
