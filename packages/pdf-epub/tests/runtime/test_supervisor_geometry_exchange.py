"""The repair opt-in cannot borrow a historical configuration or a prior response."""

import json
import unittest
from unittest.mock import Mock, patch

from ava_pdf_epub.runtime import supervisor

from . import test_supervisor_exchange as fixture

GEOMETRY_CONFIGS = {
    "ava-pdf-prose-en-v2": "75709f32827723b3675d81bc84177b6d7dfffbb3f9abb8ada5f48e504f84db4a",
    "ava-pdf-prose-en-uk-v3": "a12919c9d07e696b224aafc0e4f5d648d0e66406306b443f58628609595073e4",
}


def geometry_packets(profile="ava-pdf-prose-en-uk-v3"):
    request, job = fixture.layout_packets(profile)
    request["input"].update(
        schema_version="ava-reconstruct-input-6",
        source_structure_policy="ava-native-structure-1",
        native_structure_responses=[],
        source_normalization_policy="ava-native-word-wrap-1",
        word_wrap_responses=[],
        recognition_repair_policy="ava-recognition-geometry-repair-1",
        geometry_corrections=[],
    )
    job["config_sha256"] = GEOMETRY_CONFIGS[profile]
    return request, job


class SupervisorGeometryTests(unittest.TestCase):
    gate = fixture.SupervisorExchangeTests.gate

    def test_both_captured_profiles_reach_finite_entry(self):
        for profile in GEOMETRY_CONFIGS:
            with self.subTest(profile=profile):
                request, job = geometry_packets(profile)
                self.assertIsNone(self.gate(request=request, job=job))

    def test_new_capture_cannot_borrow_old_or_other_profile_authority(self):
        request, job = geometry_packets()
        for config in (
            None,
            "f" * 64,
            GEOMETRY_CONFIGS["ava-pdf-prose-en-v2"],
            *supervisor._LAYOUT_CONFIGS.values(),
            *supervisor._STRUCTURE_CONFIGS.values(),
            *supervisor._WORD_WRAP_CONFIGS.values(),
        ):
            with self.subTest(config=config), self.assertRaises(ValueError):
                self.gate(request=request, job={**job, "config_sha256": config})

    def test_all_policies_required_and_initial_decisions_empty(self):
        request, job = geometry_packets()
        for field in (
            "source_feature_policy",
            "source_layout_policy",
            "source_structure_policy",
            "source_normalization_policy",
            "recognition_repair_policy",
            "responses",
            "refinements",
            "native_structure_responses",
            "word_wrap_responses",
            "geometry_corrections",
        ):
            for value in (None, "foreign", [{}]):
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    self.gate(
                        request={**request, "input": {**request["input"], field: value}}, job=job
                    )
            missing = {key: value for key, value in request["input"].items() if key != field}
            with self.subTest(field=field, value="missing"), self.assertRaises(ValueError):
                self.gate(request={**request, "input": missing}, job=job)

    def test_historical_input_cannot_carry_repair_fields_or_config(self):
        request, job = geometry_packets()
        for marker in (
            "ava-reconstruct-input-1",
            "ava-reconstruct-input-3",
            "ava-reconstruct-input-4",
            "ava-reconstruct-input-5",
        ):
            with self.subTest(marker=marker), self.assertRaises(ValueError):
                self.gate(
                    request={**request, "input": {**request["input"], "schema_version": marker}},
                    job=job,
                )
        legacy, _ = fixture.packets()
        legacy["input"]["profile_id"] = job["profile_id"]
        with self.assertRaises(ValueError):
            self.gate(request=legacy, job=job)

    def test_input5_remains_valid_only_with_its_own_capture(self):
        for profile in GEOMETRY_CONFIGS:
            request, job = geometry_packets(profile)
            del request["input"]["recognition_repair_policy"]
            del request["input"]["geometry_corrections"]
            request["input"]["schema_version"] = "ava-reconstruct-input-5"
            with self.subTest(profile=profile), self.assertRaises(ValueError):
                self.gate(request=request, job=job)
            job["config_sha256"] = supervisor._WORD_WRAP_CONFIGS[profile]
            self.assertIsNone(self.gate(request=request, job=job))

    def test_empty_input6_reaches_child_with_lease_control_preserved(self):
        request, job = geometry_packets()
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
                side_effect=[json.dumps(request).encode(), json.dumps(job).encode()],
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
