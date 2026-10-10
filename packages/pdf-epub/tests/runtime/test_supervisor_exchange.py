import contextlib
import io
import json
import subprocess
import unittest
from unittest.mock import Mock, patch

from ava_pdf_epub.runtime import supervisor


def packets():
    request = {
        "mode": "attempt_stream",
        "input": {
            "schema_version": "ava-reconstruct-input-1",
            "profile_id": "ava-pdf-prose-en-v2",
            "source_sha256": "a" * 64,
            "responses": [],
            "refinements": [],
        },
    }
    job = {"source": {"sha256": "a" * 64}, "profile_id": "ava-pdf-prose-en-v2"}
    return request, job


class SupervisorExchangeTests(unittest.TestCase):
    def gate(
        self,
        request=None,
        job=None,
        target="ava_pdf_epub.reconstruction_v2",
        marker="attempt_stream",
    ):
        original_request, original_job = packets()
        with (
            patch.object(supervisor.os, "environ", {"AVA_PDF_RUNTIME_EXCHANGE": marker}),
            patch.object(
                supervisor,
                "snapshot",
                side_effect=[
                    json.dumps(request or original_request).encode(),
                    json.dumps(job or original_job).encode(),
                ],
            ),
        ):
            return supervisor.exchange_input(target)

    def test_exact_finite_entry_inherits_and_ordinary_does_not_read_request(self):
        self.assertIsNone(self.gate())
        with (
            patch.object(supervisor.os, "environ", {}),
            patch.object(supervisor, "snapshot") as read,
        ):
            self.assertEqual(
                supervisor.exchange_input("ava_pdf_epub.reconstruction_v2"),
                subprocess.DEVNULL,
            )
            read.assert_not_called()

    def test_wrong_entry_marker_source_and_nonempty_state_refused(self):
        for kwargs in (
            {"target": "ava_pdf_epub.runtime"},
            {"marker": "anything"},
            {"job": {"source": {"sha256": "b" * 64}}},
        ):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                self.gate(**kwargs)
        for name, value in (
            ("responses", [{}]),
            ("refinements", [{}]),
            ("profile_id", "foreign"),
            ("path", "/elsewhere"),
        ):
            request, _ = packets()
            request["input"][name] = value
            with self.subTest(name=name), self.assertRaises(ValueError):
                self.gate(request=request)

    def test_duplicate_keys_and_missing_initial_fields_refused(self):
        with (
            patch.object(supervisor.os, "environ", {"AVA_PDF_RUNTIME_EXCHANGE": "attempt_stream"}),
            patch.object(
                supervisor,
                "snapshot",
                return_value=b'{"mode":"attempt_stream","mode":"attempt_stream","input":{}}',
            ),
            self.assertRaisesRegex(ValueError, "Duplicate"),
        ):
            supervisor.exchange_input("ava_pdf_epub.reconstruction_v2")
        request, _ = packets()
        del request["input"]["refinements"]
        with self.assertRaises(ValueError):
            self.gate(request=request)

    def test_same_process_group_lease_killer_survives_interactive_entry(self):
        process = Mock(pid=99)
        process.poll.return_value = None
        with (
            patch.object(
                supervisor.os,
                "environ",
                {"AVA_PDF_RUNTIME_TARGET": "ava_pdf_epub.reconstruction_v2"},
            ),
            patch.object(supervisor, "exchange_input", return_value=None),
            patch.object(
                supervisor,
                "read_lease",
                side_effect=[(1, 10.0), (2, 10.0), ValueError("expired")],
            ),
            patch.object(supervisor.subprocess, "Popen", return_value=process) as start,
            patch.object(supervisor.os, "killpg") as kill,
            patch.object(supervisor.time, "sleep"),
            contextlib.redirect_stdout(io.StringIO()),
            self.assertRaises(SystemExit),
        ):
            supervisor.main()
        self.assertIsNone(start.call_args.kwargs["stdin"])
        self.assertTrue(start.call_args.kwargs["start_new_session"])
        kill.assert_called_once_with(99, supervisor.signal.SIGKILL)
        process.wait.assert_called_once_with(timeout=2)
