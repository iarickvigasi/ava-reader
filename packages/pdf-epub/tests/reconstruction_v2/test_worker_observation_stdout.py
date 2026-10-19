"""Optional measurements preserve the fixed stdout bytes and exit outcome."""

import io
import json
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2.__main__ import main
from ava_pdf_epub.worker_observation_packet import PREFIX

from .worker_observation_fixture import JOB, UNIT

MAIN = "ava_pdf_epub.reconstruction_v2.__main__"
OBSERVER = "ava_pdf_epub.worker_observation"
REQUEST = b'{"mode":"validate_tasks","tasks":[]}'


def trusted_snapshot(root, name, limit):
    return JOB.read_bytes() if name == "job.json" else json.dumps(UNIT).encode()


def invoke(observed, fail=False):
    raw_output, stderr = io.BytesIO(), io.StringIO()
    output = io.TextIOWrapper(raw_output, encoding="utf-8", write_through=True)
    code = 0
    with (
        patch(f"{MAIN}.snapshot", return_value=REQUEST),
        patch.object(Path, "mkdir"),
        patch(
            f"{OBSERVER}.snapshot",
            side_effect=trusted_snapshot if observed else FileNotFoundError(),
        ),
        redirect_stdout(output),
        redirect_stderr(stderr),
    ):
        if fail:
            with patch(f"{MAIN}.validate_tasks", side_effect=RuntimeError("private parser text")):
                try:
                    main()
                except SystemExit as error:
                    code = error.code
        else:
            main()
    return raw_output.getvalue(), stderr.getvalue(), code


class WorkerObservationStdoutTests(unittest.TestCase):
    def test_initial_observer_clock_failure_preserves_normal_stdout_and_exit(self):
        for fail in (False, True):
            original, _, code = invoke(False, fail=fail)
            with patch(
                f"{OBSERVER}.utc_now", side_effect=RuntimeError("private observer clock failure")
            ):
                measured, stderr, measured_code = invoke(True, fail=fail)
            self.assertEqual((original, code), (measured, measured_code))
            self.assertEqual("", stderr)

    def test_validation_stdout_is_identical_with_or_without_optional_observation(self):
        original, empty, code = invoke(False)
        measured, stderr, observed_code = invoke(True)
        self.assertEqual((original, code), (measured, observed_code))
        self.assertEqual("", empty)
        packet = json.loads(stderr.strip().removeprefix(PREFIX))
        self.assertEqual("completed", packet["outcome"])
        self.assertEqual("unknown", packet["inventory"]["coverage"])
        self.assertFalse(packet["inventory"]["source_bytes_verified"])
        self.assertIsNone(packet["inventory"]["observed_profile_id"])

    def test_generic_failure_stdout_and_exit_stay_identical_without_private_message(self):
        original, empty, code = invoke(False, fail=True)
        measured, stderr, observed_code = invoke(True, fail=True)
        self.assertEqual((original, code), (measured, observed_code))
        self.assertEqual(1, code)
        self.assertEqual("", empty)
        self.assertNotIn("private parser text", measured.decode() + stderr)
        packet = json.loads(stderr.strip().removeprefix(PREFIX))
        self.assertEqual("failed", packet["outcome"])
        self.assertEqual("RECONSTRUCTION_REVIEW_REQUIRED", packet["failure_code"])
