"""One active preparation phase excludes host waits and reports private attempt reuse honestly."""

import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2.attempt_stream import attempt_stream
from ava_pdf_epub.worker_observation import ACTIVE
from ava_pdf_epub.worker_observation_packet import PREFIX

from .attempt_peer import PeerOutput
from .test_attempt_stream import FIXTURES, request
from .worker_observation_fixture import observation_context


class AttemptObservationTests(unittest.TestCase):
    def test_host_waits_are_outside_active_phase_and_parsers_retired_before_first_callback(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = FIXTURES / "native.pdf"
            data = request(source)
            observation = observation_context(root, source.read_bytes(), json.loads(data))
            self.addCleanup(lambda: ACTIVE.set(None))
            clock = [0]
            observation.milliseconds = lambda: clock[0]
            instances = []
            from ava_pdf_epub.reconstruction_v2 import attempt_stream as worker

            constructor = worker.SourcePreparation.__init__

            def capture(instance, *args, **kwargs):
                constructor(instance, *args, **kwargs)
                instances.append(instance)

            def callback(packet):
                if packet["kind"] == "page" and packet["payload"]["page_number"] == 1:
                    self.assertEqual(1, len(observation.phases))
                self.assertIsNone(instances[0]._reader)
                self.assertIsNone(instances[0]._document)
                clock[0] += 10000  # A fake ten-second host wait; no sleeping/provider.
                return []

            peer = PeerOutput(callback)
            with patch.object(worker.SourcePreparation, "__init__", capture):
                attempt_stream(source, root / "scratch", data, peer.incoming, peer)
            output = io.StringIO()
            with redirect_stderr(output):
                observation.finish()
            packet = json.loads(output.getvalue().strip().removeprefix(PREFIX))
            prep = [phase for phase in packet["phases"] if phase["name"] == "prepare_source"]
            self.assertEqual(1, len(prep))
            self.assertEqual(0, prep[0]["work_ms"])
            self.assertGreaterEqual(packet["work_ms"], 90000)
            self.assertLessEqual(len(packet["phases"]), 8)
            self.assertEqual("attempt_stream", packet["command"])
            self.assertEqual(
                "attempt_private_page_checkpoints", packet["reuse"]["source_preparation"]
            )
            self.assertEqual(
                "worker_attempt_private_checkpoints_and_process_local_decode_and_annotation_memo",
                packet["reuse"]["scope"],
            )
            self.assertIsNone(ACTIVE.get())

    def test_early_refusal_does_not_claim_checkpoint_reuse(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            observation = observation_context(root, request=dict(mode="attempt_stream"))
            output = io.StringIO()
            with redirect_stderr(output):
                observation.failed(ValueError("private"))
                observation.finish()
            packet = json.loads(output.getvalue().strip().removeprefix(PREFIX))
            self.assertEqual("none", packet["reuse"]["source_preparation"])
            self.assertEqual("attempt_stream", packet["command"])


if __name__ == "__main__":
    unittest.main()
