"""Private bounded UTF8 serialization preserves exact existing framing bytes."""

import io
import struct
import unittest

from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes, write_bytes
from ava_pdf_epub.reconstruction_v2.refinement_transport import write_json_frame


class RefinementFrameSpoolTests(unittest.TestCase):
    def test_utf8_exact_boundary_and_partial_output_writes(self):
        class ShortWriter(io.BytesIO):
            def write(self, data):
                return super().write(data[:3])

        packet = {"quote": "A😀B café", "values": [1, None, True]}
        data = json_bytes(packet)
        output = ShortWriter()
        write_json_frame(output, packet, len(data), write_bytes)
        self.assertEqual(struct.pack(">I", len(data)) + data, output.getvalue())
        refused = io.BytesIO()
        with self.assertRaisesRegex(ValueError, "byte bound"):
            write_json_frame(refused, packet, len(data) - 1, write_bytes)
        self.assertEqual(b"", refused.getvalue())

    def test_invalid_raw_json_is_refused_before_framing(self):
        for value in (float("nan"), "\ud800"):
            output = io.BytesIO()
            with self.subTest(value=repr(value)), self.assertRaises((ValueError, UnicodeError)):
                write_json_frame(output, {"value": value}, 1024, write_bytes)
            self.assertEqual(b"", output.getvalue())

    def test_payload_and_envelope_limits_are_separate_and_exact(self):
        packet = {"kind": "refinement_batch", "payload": {"text": "😀 café"}}
        size = len(json_bytes(packet["payload"]))
        output = io.BytesIO()
        write_json_frame(output, packet, 1024, write_bytes, payload_bound=size)
        data = json_bytes(packet)
        self.assertEqual(struct.pack(">I", len(data)) + data, output.getvalue())
        for frame_limit, payload_limit in ((1024, size - 1), (len(data) - 1, size)):
            refused = io.BytesIO()
            with self.subTest(limits=(frame_limit, payload_limit)), self.assertRaises(ValueError):
                write_json_frame(
                    refused, packet, frame_limit, write_bytes, payload_bound=payload_limit
                )
            self.assertEqual(b"", refused.getvalue())

    def test_output_failure_cannot_be_reported_as_complete(self):
        class ClosedWriter(io.BytesIO):
            def write(self, data):
                return 0

        with self.assertRaisesRegex(ValueError, "ended before complete"):
            write_json_frame(ClosedWriter(), {"a": 1}, 1024, write_bytes)
