"""Actual attempt and observer retain public refusal and bounded private provenance."""

import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2.attempt_stream import AttemptFailure, attempt_stream
from ava_pdf_epub.reconstruction_v2.source_link_refusal import SourceLinkRefusal
from ava_pdf_epub.worker_observation_packet import PACKET_BYTES, PREFIX

from .source_link_fixture import fixture
from .test_attempt_stream import request
from .test_worker_observation import emitted
from .worker_observation_fixture import observation_context


class SourceLinkObservationTests(unittest.TestCase):
    def test_bound_observer_preserves_location_without_claiming_complete_inventory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, checkpoint, _ = fixture(root)
            error = SourceLinkRefusal(
                checkpoint, 3, "caller", ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
            )
            observer = observation_context(root, source.read_bytes(), {"mode": "attempt_stream"})
            observer.failed(error)
            data = emitted(observer)
        packet = json.loads(data.strip().removeprefix(PREFIX))
        self.assertLessEqual(len(data.encode()), PACKET_BYTES)
        self.assertEqual("failed", packet["outcome"])
        self.assertEqual("RECONSTRUCTION_REVIEW_REQUIRED", packet["failure_code"])
        self.assertTrue(packet["findings_complete"])
        self.assertEqual([error.finding.model_dump(mode="json")], packet["findings"])
        self.assertFalse(packet["inventory"]["source_bytes_verified"])
        self.assertEqual("unknown", packet["inventory"]["coverage"])
        self.assertNotIn("PRIVATE_BOOK", data)

    def test_attempt_wire_remains_generic_and_never_produces_candidate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, checkpoint, _ = fixture(root)
            error = SourceLinkRefusal(checkpoint, 3, "caller", ValueError("PRIVATE_BOOK"))
            outgoing = io.BytesIO()
            with patch("ava_pdf_epub.reconstruction_v2.attempt_stream._run", side_effect=error):
                with self.assertRaises(AttemptFailure) as caught:
                    attempt_stream(source, root, request(source), io.BytesIO(), outgoing)
            self.assertIs(error, caught.exception.cause)
            wire = outgoing.getvalue()
            self.assertIn(b"RECONSTRUCTION_REVIEW_REQUIRED", wire)
            self.assertNotIn(b"source_link", wire)
            self.assertNotIn(b"PRIVATE_BOOK", wire)
            self.assertNotIn(b"artifacts", wire)
