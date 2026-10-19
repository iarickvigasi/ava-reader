"""First invalid/unresolved lexical reply stops before the next finite task dispatch."""

import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from ava_pdf_epub.reconstruction_v2.attempt_exchange import ExchangeWriter, json_bytes
from ava_pdf_epub.reconstruction_v2.attempt_word_wrap import attempt_word_wrap
from ava_pdf_epub.reconstruction_v2.protocol_native_word_wrap import (
    NativeWordWrapReconstructionInput,
)

from .attempt_peer import PeerOutput
from .word_wrap_fixture import word_wrap_batch
from .word_wrap_stream_fixture import answer, initial


def phase(batch, callback, limit=60 * 1024 * 1024):
    peer = PeerOutput(callback)
    writer = ExchangeWriter(peer, batch.source_sha256, batch.profile_id, version=2)
    preparation = SimpleNamespace(source=None, scratch=None, check_unchanged=Mock())
    with patch(
        "ava_pdf_epub.reconstruction_v2.word_wrap_prepare.prepare_word_wrap_from_pages",
        return_value=(batch, None, []),
    ):
        result = attempt_word_wrap(
            preparation,
            [],
            NativeWordWrapReconstructionInput.model_validate(initial()),
            writer,
            peer.incoming,
            6,
            limit,
        )
    return result, peer


class WordWrapAttemptPhaseTests(unittest.TestCase):
    def test_two_tasks_return_complete_ordered_receipts(self):
        batch = word_wrap_batch(130)
        tasks = {task.task_id: task.model_dump(mode="json") for task in batch.tasks}
        returned, peer = phase(
            batch,
            lambda packet: (
                []
                if packet["kind"] == "word_wrap_batch"
                else [answer(tasks[packet["payload"]["task_id"]], "literal")]
            ),
        )
        self.assertEqual([receipt["task_id"] for receipt in returned], list(tasks))
        self.assertEqual(
            [control["kind"] for control in peer.controls],
            ["word_wrap_batch", "word_wrap", "word_wrap"],
        )

    def test_first_unresolved_or_wrong_catalogue_stops_before_second_task(self):
        batch = word_wrap_batch(130)
        for invalid in ("unresolved", "foreign_catalogue"):
            controls = []

            def callback(packet, controls=controls, invalid=invalid):
                controls.append(packet["kind"])
                if packet["kind"] == "word_wrap_batch":
                    return []
                receipt = answer(
                    batch.tasks[0].model_dump(mode="json"),
                    "unresolved" if invalid == "unresolved" else "literal",
                )
                if invalid == "foreign_catalogue":
                    receipt["catalogue_sha256"] = "f" * 64
                return [receipt]

            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                phase(batch, callback)
            self.assertEqual(controls, ["word_wrap_batch", "word_wrap"])

    def test_reordered_tasks_refuse_before_batch_announcement(self):
        batch = word_wrap_batch(130)
        controls = []
        with self.assertRaises(ValueError):
            phase(
                batch.model_copy(update={"tasks": list(reversed(batch.tasks))}),
                lambda packet: controls.append(packet) or [],
            )
        self.assertEqual(controls, [])

    def test_three_array_reservation_counts_towards_existing_aggregate_limit(self):
        batch = word_wrap_batch()
        receipt = answer(batch.tasks[0].model_dump(mode="json"), "literal")

        def callback(packet):
            return [] if packet["kind"] == "word_wrap_batch" else [receipt]

        with self.assertRaisesRegex(ValueError, "aggregate|response byte bound"):
            phase(batch, callback, len(json_bytes(receipt)) + 5)
        returned, _ = phase(batch, callback, len(json_bytes(receipt)) + 6)
        self.assertEqual(returned, [receipt])
