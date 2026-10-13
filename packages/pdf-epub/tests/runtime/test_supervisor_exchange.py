import contextlib
import io
import json
import struct
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


def layout_packets(profile="ava-pdf-prose-en-uk-v3"):
    request, job = packets()
    request["input"].update(
        schema_version="ava-reconstruct-input-3",
        profile_id=profile,
        source_feature_policy="ava-ocr-source-features-1",
        source_layout_policy="ava-native-layout-1",
    )
    job.update(
        profile_id=profile,
        config_sha256=(
            "937942d4a700d14ac59de24559044e098726fe355173f93680dd4fe0a9929060"
            if profile == "ava-pdf-prose-en-v2"
            else "da2d14755d575a3b0fe0c8a0430dfe093996e144e62bf31c2cc04df450a4e315"
        ),
    )
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

    def test_captured_layout_entry_accepts_both_stock_profiles(self):
        for profile in ("ava-pdf-prose-en-v2", "ava-pdf-prose-en-uk-v3"):
            with self.subTest(profile=profile):
                request, job = layout_packets(profile)
                self.assertIsNone(self.gate(request=request, job=job))

    def test_layout_policy_and_captured_configuration_cannot_be_crossed(self):
        for field, value in (
            ("source_layout_policy", None),
            ("source_layout_policy", "foreign"),
            ("source_feature_policy", None),
            ("schema_version", "ava-reconstruct-input-2"),
            ("responses", [{}]),
            ("refinements", [{}]),
            ("unknown", "not authority"),
        ):
            request, job = layout_packets()
            request["input"][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.gate(request=request, job=job)
        for config in (
            None,
            "a" * 64,
            "937942d4a700d14ac59de24559044e098726fe355173f93680dd4fe0a9929060",
        ):
            request, job = layout_packets()
            job["config_sha256"] = config
            with self.subTest(config=config), self.assertRaises(ValueError):
                self.gate(request=request, job=job)
        request, job = layout_packets()
        request["input"]["schema_version"] = "ava-reconstruct-input-1"
        del request["input"]["source_layout_policy"]
        with self.assertRaises(ValueError):
            self.gate(request=request, job=job)

    def test_actual_layout_gate_reaches_child_after_two_lease_sequences(self):
        request, job = layout_packets()
        process = Mock(pid=99)
        process.poll.return_value = 0
        with (
            patch.object(
                supervisor.os,
                "environ",
                {
                    "AVA_PDF_RUNTIME_TARGET": "ava_pdf_epub.reconstruction_v2",
                    "AVA_PDF_RUNTIME_EXCHANGE": "attempt_stream",
                },
            ),
            patch.object(
                supervisor,
                "snapshot",
                side_effect=[
                    json.dumps(request).encode(),
                    json.dumps(job).encode(),
                ],
            ),
            patch.object(supervisor, "read_lease", side_effect=[(1, 10.0), (2, 10.0)]) as lease,
            patch.object(supervisor.subprocess, "Popen", return_value=process) as start,
            patch.object(supervisor.time, "sleep"),
            self.assertRaises(SystemExit) as ended,
        ):
            supervisor.main()
        self.assertEqual(ended.exception.code, 0)
        self.assertEqual(lease.call_count, 2)
        self.assertIsNone(start.call_args.kwargs["stdin"])
        self.assertTrue(start.call_args.kwargs["start_new_session"])
        self.assertEqual(start.call_args.args[0][-1], "ava_pdf_epub.reconstruction_v2")

    def test_invalid_initial_entry_uses_bound_framed_refusal_without_lease_or_child(self):
        request, job = layout_packets()
        request["input"]["responses"] = [{}]
        output = io.BytesIO()
        wrapper = io.TextIOWrapper(output, encoding="utf-8")
        with (
            patch.object(
                supervisor.os,
                "environ",
                {
                    "AVA_PDF_RUNTIME_TARGET": "ava_pdf_epub.reconstruction_v2",
                    "AVA_PDF_RUNTIME_EXCHANGE": "attempt_stream",
                },
            ),
            patch.object(
                supervisor,
                "snapshot",
                side_effect=lambda root, name, size: json.dumps(
                    request if name == "reconstruction-request.json" else job
                ).encode(),
            ),
            patch.object(supervisor, "read_lease") as lease,
            patch.object(supervisor.subprocess, "Popen") as start,
            contextlib.redirect_stdout(wrapper),
            self.assertRaises(SystemExit) as ended,
        ):
            supervisor.main()
        wrapper.flush()
        frame = output.getvalue()
        self.assertEqual(ended.exception.code, 1)
        lease.assert_not_called()
        start.assert_not_called()
        size = struct.unpack(">I", frame[:4])[0]
        self.assertEqual(size, len(frame) - 4)
        packet = json.loads(frame[4:])
        self.assertEqual(packet["schema_version"], "ava-reconstruction-exchange-1")
        self.assertEqual(packet["kind"], "refusal")
        self.assertEqual(packet["sequence"], 1)
        self.assertEqual(packet["source_sha256"], job["source"]["sha256"])
        self.assertEqual(packet["profile_id"], job["profile_id"])
        self.assertEqual(
            packet["payload"],
            {
                "schema_version": "ava-reconstruction-error-1",
                "code": "RECONSTRUCTION_REVIEW_REQUIRED",
            },
        )
        wrapper.detach()

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
