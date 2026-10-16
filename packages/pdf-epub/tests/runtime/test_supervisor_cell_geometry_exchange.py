"""Input9 cannot borrow historical captures or introduce prior decisions."""

import unittest
from copy import deepcopy

from ava_pdf_epub.runtime import supervisor

from . import test_supervisor_exchange as fixture
from .test_supervisor_title_exchange import title_packets

CELL_CONFIGS = {
    "ava-pdf-prose-en-v2": "715bc6a2a09a67cb428b6c9b831295b5b3a0bb478411ef073adb825db5b52b53",
    "ava-pdf-prose-en-uk-v3": "65b7b299d373ff163147e38c4e8718a69fafe623f11c4478172f51517045b92d",
}


def cell_packets(profile="ava-pdf-prose-en-uk-v3"):
    request, job = title_packets(profile)
    request["input"].update(
        schema_version="ava-reconstruct-input-9",
        source_structure_policy="ava-native-structure-2",
        recognition_repair_policy="ava-recognition-geometry-repair-2",
    )
    job["config_sha256"] = CELL_CONFIGS[profile]
    return request, job


class SupervisorCellGeometryTests(unittest.TestCase):
    gate = fixture.SupervisorExchangeTests.gate

    def test_both_exact_native2_captures_reach_entry(self):
        for profile in CELL_CONFIGS:
            request, job = cell_packets(profile)
            with self.subTest(profile=profile):
                self.assertIsNone(self.gate(request=request, job=job))

    def test_native2_cannot_borrow_historical_or_other_profile_capture(self):
        request, job = cell_packets()
        for config in (
            None,
            "f" * 64,
            CELL_CONFIGS["ava-pdf-prose-en-v2"],
            *supervisor._LAYOUT_CONFIGS.values(),
            *supervisor._STRUCTURE_CONFIGS.values(),
            *supervisor._WORD_WRAP_CONFIGS.values(),
            *supervisor._GEOMETRY_CONFIGS.values(),
            *supervisor._TITLE_CONFIGS.values(),
            *supervisor._NATIVE2_CONFIGS.values(),
        ):
            with self.subTest(config=config), self.assertRaises(ValueError):
                self.gate(request=request, job={**job, "config_sha256": config})

    def test_all_dependencies_and_initial_fields_are_closed(self):
        request, job = cell_packets()
        for field, original in request["input"].items():
            if field in {"schema_version", "profile_id", "source_sha256"}:
                continue
            values = (None, "foreign", [{}]) if original == [] else (None, "foreign")
            for value in values:
                changed = deepcopy(request)
                changed["input"][field] = value
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    self.gate(request=changed, job=job)
            changed = deepcopy(request)
            del changed["input"][field]
            with self.subTest(field=field, value="missing"), self.assertRaises(ValueError):
                self.gate(request=changed, job=job)
        request["input"]["unknown"] = "not-authority"
        with self.assertRaises(ValueError):
            self.gate(request=request, job=job)

    def test_old_input7_keeps_structure1_and_its_own_capture(self):
        for profile in CELL_CONFIGS:
            old, oldjob = title_packets(profile)
            new, newjob = cell_packets(profile)
            self.assertIsNone(self.gate(request=old, job=oldjob))
            for request, job in [(old, newjob), (new, oldjob)]:
                with self.subTest(profile=profile), self.assertRaises(ValueError):
                    self.gate(request=request, job=job)
            old["input"]["source_structure_policy"] = "ava-native-structure-2"
            with self.assertRaises(ValueError):
                self.gate(request=old, job=oldjob)

    def test_legacy_entry_cannot_reuse_cell_capture(self):
        request, job = cell_packets()
        request["input"] = {
            key: value
            for key, value in request["input"].items()
            if key in {"schema_version", "source_sha256", "profile_id", "responses", "refinements"}
        }
        request["input"]["schema_version"] = "ava-reconstruct-input-1"
        with self.assertRaises(ValueError):
            self.gate(request=request, job=job)
