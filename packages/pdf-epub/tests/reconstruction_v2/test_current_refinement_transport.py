"""Current large batches fit without widening old or unrelated controls."""

import io
import struct
import unittest

from ava_pdf_epub.contracts.profiles import LEGACY_PROFILE
from ava_pdf_epub.reconstruction_v2.attempt_exchange import ExchangeWriter, json_bytes


def payload(size=0):
    return dict(
        schema_version="ava-book-refinement-batch-4",
        source_continuation_policy="ava-source-continuation-presentation-1",
        tasks=[],
        pixels="x" * size,
    )


def writer(stream, current=True, version=2):
    return ExchangeWriter(
        stream, "a" * 64, LEGACY_PROFILE, version=version, current_refinement=current
    )


class CurrentRefinementTransportTests(unittest.TestCase):
    def test_real_25mib_frame_only_fits_current_version2_and_exact_batch(self):
        batch = payload(25 * 1024 * 1024)
        output = io.BytesIO()
        current = writer(output)
        packet = current.emit("refinement_batch", batch)
        raw = output.getvalue()
        self.assertEqual(len(raw) - 4, struct.unpack(">I", raw[:4])[0])
        self.assertEqual(json_bytes(packet.model_dump(mode="json")), raw[4:])
        for changed in (
            batch,
            {**batch, "schema_version": "ava-book-refinement-batch-3"},
            {**batch, "source_continuation_policy": "wrong"},
        ):
            stream = io.BytesIO()
            current_mode = changed is not batch
            candidate = writer(stream, current_mode)
            with (
                self.subTest(current=current_mode),
                self.assertRaisesRegex(ValueError, "byte bound"),
            ):
                candidate.emit("refinement_batch", changed)
            self.assertEqual(b"", stream.getvalue())
            self.assertEqual(0, candidate.sequence)

    def test_current_ceiling_refuses_without_emitting_a_prefix_or_advancing(self):
        output = io.BytesIO()
        current = writer(output)
        with self.assertRaisesRegex(ValueError, "byte bound"):
            current.emit("refinement_batch", payload(64 * 1024 * 1024 + 1024))
        self.assertEqual(b"", output.getvalue())
        self.assertEqual(0, current.sequence)

    def test_page_wrap_token_and_terminal_caps_do_not_expand(self):
        for kind, size in (
            ("page", 9 * 1024 * 1024),
            ("word_wrap_batch", 9 * 1024 * 1024),
            ("recognition", 2048),
            ("refinement", 2048),
            ("artifacts", 300000),
        ):
            output = io.BytesIO()
            candidate = writer(output)
            with self.subTest(kind=kind), self.assertRaisesRegex(ValueError, "byte bound"):
                candidate.emit(kind, payload(size))
            self.assertEqual(b"", output.getvalue())

    def test_version_and_current_flag_are_exact_and_legacy_small_bytes_match(self):
        for args in (dict(current=True, version=1), dict(current=1)):
            with self.subTest(args=args), self.assertRaises(ValueError):
                writer(io.BytesIO(), **args)
        streams = [io.BytesIO(), io.BytesIO()]
        for current, output in zip((False, True), streams, strict=True):
            writer(output, current).emit("refinement_batch", payload())
        self.assertEqual(streams[0].getvalue(), streams[1].getvalue())

    def test_unencodable_content_never_emits_a_prefix(self):
        for value in ("\ud800",):
            output = io.BytesIO()
            current = writer(output)
            with self.subTest(value=repr(value)), self.assertRaises((ValueError, UnicodeError)):
                current.emit("refinement_batch", {**payload(), "bad": value})
            self.assertEqual(b"", output.getvalue())
            self.assertEqual(0, current.sequence)
