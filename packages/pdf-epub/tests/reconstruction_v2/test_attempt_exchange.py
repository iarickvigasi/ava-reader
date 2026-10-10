"""Bounded exact framing, identity and legal typed refusal preservation."""

import io
import struct
import unittest
from unittest.mock import patch

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE, LEGACY_PROFILE
from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.reconstruction_v2.attempt_exchange import (
    REPLY_BYTES,
    ExchangeWriter,
    json_bytes,
    read_exchange,
)
from ava_pdf_epub.reconstruction_v2.attempt_stream import initial_input
from ava_pdf_epub.reconstruction_v2.source_refusal import (
    SourceBlockingFinding,
    SourceRefusalDiagnostic,
)


def wire(value):
    data = json_bytes(value) if not isinstance(value, bytes) else value
    return struct.pack(">I", len(data)) + data


def envelope(**changes):
    return dict(
        schema_version="ava-reconstruction-exchange-1",
        sequence=1,
        source_sha256="a" * 64,
        profile_id=LEGACY_PROFILE,
        kind="page",
        payload=[],
        **changes,
    )


class AttemptExchangeTests(unittest.TestCase):
    def test_exact_fragmented_read_and_same_exchange_binding(self):
        class ShortReader(io.BytesIO):
            def read(self, size=-1):
                return super().read(min(size, 3))

        output = io.BytesIO()
        writer = ExchangeWriter(output, "a" * 64, LEGACY_PROFILE)
        request = writer.emit("page", {"tasks": []})
        self.assertEqual([], writer.reply(ShortReader(wire(envelope())), request))
        self.assertEqual(request, read_exchange(io.BytesIO(output.getvalue())))

    def test_eof_truncation_zero_oversize_and_utf8_fail_before_reply(self):
        cases = [
            b"",
            b"\x00\x00",
            struct.pack(">I", 4) + b"{}",
            struct.pack(">I", 0),
            struct.pack(">I", REPLY_BYTES + 1),
            wire(b"\xff"),
        ]
        for data in cases:
            with self.subTest(data=data[:8]), self.assertRaises(ValueError):
                read_exchange(io.BytesIO(data))

    def test_duplicate_nested_keys_unknowns_nonfinite_and_wrong_literal_types(self):
        valid = json_bytes(envelope())
        cases = [
            valid.replace(b'"sequence":1', b'"sequence":1,"sequence":1'),
            valid.replace(b'"payload":[]', b'"payload":[{"id":1,"id":2}]'),
            valid.replace(b'"payload":[]', b'"payload":[NaN]'),
            json_bytes({**envelope(), "unknown": True}),
            json_bytes({**envelope(), "sequence": True}),
            json_bytes({**envelope(), "sequence": 25535}),
            json_bytes({**envelope(), "kind": "unknown"}),
        ]
        for data in cases:
            with self.subTest(data=data[:90]), self.assertRaises(ValueError):
                read_exchange(io.BytesIO(wire(data)))

    def test_wrong_sequence_source_profile_kind_or_payload_never_accepts(self):
        for change in [
            {"sequence": 2},
            {"source_sha256": "b" * 64},
            {"profile_id": BILINGUAL_PROFILE},
            {"kind": "recognition"},
            {"payload": {}},
        ]:
            writer = ExchangeWriter(io.BytesIO(), "a" * 64, LEGACY_PROFILE)
            request = writer.emit("page", {})
            with (
                self.subTest(change=change),
                self.assertRaisesRegex(ValueError, "another exchange"),
            ):
                writer.reply(io.BytesIO(wire({**envelope(), **change})), request)

    def test_total_reply_limit_and_task_control_limit_are_bounded(self):
        writer = ExchangeWriter(io.BytesIO(), "a" * 64, LEGACY_PROFILE)
        request = writer.emit("page", {})
        with patch("ava_pdf_epub.reconstruction_v2.attempt_exchange.TOTAL_REPLY_BYTES", 8):
            with self.assertRaisesRegex(ValueError, "byte bound"):
                writer.reply(io.BytesIO(wire(envelope())), request)
        with self.assertRaisesRegex(ValueError, "control byte bound"):
            writer.emit("recognition", {"task_id": "x" * 2048})

    def test_max_legal_typed_diagnostic_exceeds_old64k_and_is_preserved(self):
        box = Box(
            coordinate_space="page_points_top_left",
            x0=1234.123456789012,
            y0=1234.123456789012,
            x1=19345.12345678901,
            y1=19345.12345678901,
        )
        finding = SourceBlockingFinding(
            code="ESSENTIAL_STRUCTURE_UNSUPPORTED",
            page=500,
            box=box,
            region_box=box,
            block_id="A" + "a" * 119,
            task_id="B" + "b" * 119,
            segment_id_sha256="a" * 64,
            render_sha256="b" * 64,
        )
        diagnostic = SourceRefusalDiagnostic(
            source_sha256="a" * 64, stage="assembly", findings=[finding] * 100
        )
        self.assertGreater(len(diagnostic.model_dump_json().encode()), 64 * 1024)
        output = io.BytesIO()
        writer = ExchangeWriter(output, "a" * 64, LEGACY_PROFILE)
        writer.emit("refusal", diagnostic.model_dump(mode="json"))
        returned = read_exchange(io.BytesIO(output.getvalue()))
        self.assertEqual(diagnostic.model_dump(mode="json"), returned.payload)
        with self.assertRaisesRegex(ValueError, "terminal"):
            writer.emit("artifacts", None)

    def test_initial_input_rejects_prior_responses_missing_profile_duplicates_unknowns(self):
        raw = dict(
            mode="attempt_stream",
            input=dict(
                schema_version="ava-reconstruct-input-1",
                profile_id=LEGACY_PROFILE,
                source_sha256="a" * 64,
                responses=[],
                refinements=[],
            ),
        )
        self.assertEqual("a" * 64, initial_input(json_bytes(raw)).source_sha256)
        for data in [
            json_bytes({**raw, "unknown": 1}),
            json_bytes(
                {**raw, "input": {k: v for k, v in raw["input"].items() if k != "profile_id"}}
            ),
            json_bytes({**raw, "input": {**raw["input"], "responses": [{}]}}),
            json_bytes(raw).replace(
                b'"mode":"attempt_stream"', b'"mode":"attempt_stream","mode":"attempt_stream"'
            ),
        ]:
            with self.subTest(data=data[:80]), self.assertRaises(ValueError):
                initial_input(data)


if __name__ == "__main__":
    unittest.main()
