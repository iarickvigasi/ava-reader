"""Version boundaries and shared exchange budgets survive native source decisions."""

import unittest

from pydantic import ValidationError

from ava_pdf_epub.reconstruction_v2.attempt_exchange import Exchange, ExchangeWriter, json_bytes
from ava_pdf_epub.reconstruction_v2.attempt_stream import initial_input
from ava_pdf_epub.reconstruction_v2.native_structure_exchange import emit_native, reply_native
from ava_pdf_epub.reconstruction_v2.protocol import reconstruction_input
from ava_pdf_epub.reconstruction_v2.protocol_native_layout import NativeLayoutPrepareResult
from ava_pdf_epub.reconstruction_v2.protocol_native_structure import NativeStructurePrepareResult
from ava_pdf_epub.reconstruction_v2.validate_tasks import validate_tasks

from .attempt_peer import PeerOutput
from .native_structure_decision_fixture import native_structure_wire_fixture


def initial():
    return dict(
        schema_version="ava-reconstruct-input-4",
        source_sha256="a" * 64,
        profile_id="ava-pdf-prose-en-uk-v3",
        source_layout_policy="ava-native-layout-1",
        source_structure_policy="ava-native-structure-1",
        source_feature_policy="ava-ocr-source-features-1",
        responses=[],
        native_structure_responses=[],
        refinements=[],
    )


class NativeStructureProtocolTests(unittest.TestCase):
    def test_new_initial_input_and_historical_marker_boundary(self):
        raw = initial()
        self.assertEqual(
            initial_input(json_bytes(dict(mode="attempt_stream", input=raw))),
            reconstruction_input(raw),
        )
        for marker in (
            "ava-reconstruct-input-1",
            "ava-reconstruct-input-2",
            "ava-reconstruct-input-3",
        ):
            with self.subTest(marker=marker), self.assertRaises(ValueError):
                initial_input(
                    json_bytes(dict(mode="attempt_stream", input={**raw, "schema_version": marker}))
                )

    def test_missing_policy_and_prior_native_receipt_refuse(self):
        for field, value in (
            ("source_structure_policy", None),
            ("native_structure_responses", [{}]),
        ):
            with self.subTest(field=field), self.assertRaises(ValueError):
                initial_input(
                    json_bytes(dict(mode="attempt_stream", input={**initial(), field: value}))
                )

    def test_old_prepare_and_validation_reject_native_task(self):
        task, _ = native_structure_wire_fixture()
        raw = dict(
            schema_version="ava-prepare-result-3",
            source_structure_policy="ava-native-structure-1",
            source_layout_policy="ava-native-layout-1",
            profile_id=task.profile_id,
            source_sha256=task.source_sha256,
            source_page_count=1,
            page_number=1,
            observation_sha256=task.observation_sha256,
            native_segment_count=0,
            tasks=[task.model_dump()],
        )
        NativeStructurePrepareResult.model_validate(raw)
        old = {k: v for k, v in raw.items() if k != "source_structure_policy"}
        with self.assertRaises(ValidationError):
            NativeLayoutPrepareResult.model_validate(
                {**old, "schema_version": "ava-prepare-result-2"}
            )
        with self.assertRaises(ValueError):
            validate_tasks(
                json_bytes(dict(mode="validate_tasks", tasks=[task.model_dump(mode="json")]))
            )

    def test_native_reply_uses_own_marker_and_shared_sequence(self):
        peer = PeerOutput(lambda _: [{"candidate": "source-owned"}])
        writer = ExchangeWriter(peer, "a" * 64, "ava-pdf-prose-en-v2")
        page = writer.emit("page", {})
        self.assertEqual(writer.reply(peer.incoming, page), [{"candidate": "source-owned"}])
        packet = emit_native(writer, "source-task")
        self.assertEqual(packet.sequence, 2)
        self.assertEqual(reply_native(writer, peer.incoming, packet), {"candidate": "source-owned"})
        self.assertGreater(writer._reply_bytes, 0)
        with self.assertRaises(ValidationError):
            Exchange.model_validate(packet.model_dump())
        writer.emit("refusal", {})
        with self.assertRaises(ValueError):
            emit_native(writer, "another-task")

    def test_old_reply_marker_cannot_answer_native_control(self):
        peer = PeerOutput(
            lambda packet: json_bytes(
                {**packet, "schema_version": "ava-reconstruction-exchange-1", "payload": [{}]}
            )
        )
        writer = ExchangeWriter(peer, "a" * 64, "ava-pdf-prose-en-v2")
        request = emit_native(writer, "source-task")
        with self.assertRaises(ValidationError):
            reply_native(writer, peer.incoming, request)
        self.assertEqual(writer.sequence, 1)
        self.assertEqual(len(peer.controls), 1)
