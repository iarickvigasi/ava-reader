"""Input8 cannot borrow historical captures or introduce prior decisions."""

import unittest
from copy import deepcopy

from ava_pdf_epub.runtime import supervisor

from . import test_supervisor_exchange as fixture
from .test_supervisor_title_exchange import title_packets

NATIVE2_CONFIGS = {
    "ava-pdf-prose-en-v2": "0fffcc842cce501bbcee910ce653064a702fee9ce5d592e4b39d14c3a693a88e",
    "ava-pdf-prose-en-uk-v3": "e424ec48dacf225082d3d8c6ebc4438114de1f7151eeb0c30ad311f7cb39307a",
}


def native2_packets(profile="ava-pdf-prose-en-uk-v3"):
    request, job = title_packets(profile)
    request["input"].update(
        schema_version="ava-reconstruct-input-8", source_structure_policy="ava-native-structure-2"
    )
    job["config_sha256"] = NATIVE2_CONFIGS[profile]
    return request, job


class SupervisorNative2Tests(unittest.TestCase):
    gate = fixture.SupervisorExchangeTests.gate

    def test_both_exact_native2_captures_reach_entry(self):
        for profile in NATIVE2_CONFIGS:
            request, job = native2_packets(profile)
            with self.subTest(profile=profile):
                self.assertIsNone(self.gate(request=request, job=job))

    def test_native2_cannot_borrow_historical_or_other_profile_capture(self):
        request, job = native2_packets()
        for config in (
            None,
            "f" * 64,
            NATIVE2_CONFIGS["ava-pdf-prose-en-v2"],
            *supervisor._LAYOUT_CONFIGS.values(),
            *supervisor._STRUCTURE_CONFIGS.values(),
            *supervisor._WORD_WRAP_CONFIGS.values(),
            *supervisor._GEOMETRY_CONFIGS.values(),
            *supervisor._TITLE_CONFIGS.values(),
        ):
            with self.subTest(config=config), self.assertRaises(ValueError):
                self.gate(request=request, job={**job, "config_sha256": config})

    def test_all_dependencies_and_initial_fields_are_closed(self):
        request, job = native2_packets()
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
        for profile in NATIVE2_CONFIGS:
            old, oldjob = title_packets(profile)
            new, newjob = native2_packets(profile)
            self.assertIsNone(self.gate(request=old, job=oldjob))
            for request, job in [(old, newjob), (new, oldjob)]:
                with self.subTest(profile=profile), self.assertRaises(ValueError):
                    self.gate(request=request, job=job)
            old["input"]["source_structure_policy"] = "ava-native-structure-2"
            with self.assertRaises(ValueError):
                self.gate(request=old, job=oldjob)
