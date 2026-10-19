"""Current continuation admission must agree with the host without widening old inputs."""

import unittest
from copy import deepcopy

from ava_pdf_epub.runtime import supervisor

from . import test_supervisor_exchange as fixture
from .test_supervisor_cell_geometry_exchange import cell_packets

CONFIGS = {
    "ava-pdf-prose-en-v2": "3c974d2ba01a10df95ee8dc58406d9a87529462f2cc9aa5566cd6399750fab2a",
    "ava-pdf-prose-en-uk-v3": "11480edd876d3e5c41ae9a24af13ee33e797e6ea5176fcd3d2e68d46acf050bb",
}
POLICY = "ava-source-continuation-presentation-1"


def continuation_packets(profile="ava-pdf-prose-en-uk-v3"):
    request, job = cell_packets(profile)
    request["input"].update(
        schema_version="ava-reconstruct-input-10", source_continuation_policy=POLICY
    )
    job["config_sha256"] = CONFIGS[profile]
    return request, job


class SupervisorContinuationTests(unittest.TestCase):
    gate = fixture.SupervisorExchangeTests.gate

    def test_both_exact_captured_profiles_enter(self):
        for profile in CONFIGS:
            request, job = continuation_packets(profile)
            with self.subTest(profile=profile):
                self.assertIsNone(self.gate(request=request, job=job))

    def test_each_required_policy_and_empty_state_is_closed(self):
        request, job = continuation_packets()
        for field in request["input"]:
            if field in {"schema_version", "profile_id", "source_sha256"}:
                continue
            for value in (None, "foreign", [{}]):
                changed = deepcopy(request)
                changed["input"][field] = value
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    self.gate(request=changed, job=job)
            changed = deepcopy(request)
            del changed["input"][field]
            with self.subTest(field=field, missing=True), self.assertRaises(ValueError):
                self.gate(request=changed, job=job)
        request["input"]["unknown"] = "not-authority"
        with self.assertRaises(ValueError):
            self.gate(request=request, job=job)

    def test_historical_or_other_profile_configuration_cannot_enter(self):
        request, job = continuation_packets()
        old = [
            getattr(supervisor, name)
            for name in (
                "_LAYOUT_CONFIGS",
                "_STRUCTURE_CONFIGS",
                "_WORD_WRAP_CONFIGS",
                "_GEOMETRY_CONFIGS",
                "_TITLE_CONFIGS",
                "_NATIVE2_CONFIGS",
                "_CELL_GEOMETRY_CONFIGS",
            )
        ]
        for config in [
            None,
            "f" * 64,
            CONFIGS["ava-pdf-prose-en-v2"],
            *(value for group in old for value in group.values()),
        ]:
            with self.subTest(config=config), self.assertRaises(ValueError):
                self.gate(request=request, job={**job, "config_sha256": config})

    def test_no_legacy_input_can_borrow_current_capture(self):
        request, job = continuation_packets()
        for version in [1, 3, 4, 5, 6, 7, 8, 9]:
            for keep_policy in [False, True]:
                changed = deepcopy(request)
                changed["input"]["schema_version"] = f"ava-reconstruct-input-{version}"
                if not keep_policy:
                    del changed["input"]["source_continuation_policy"]
                with (
                    self.subTest(version=version, policy=keep_policy),
                    self.assertRaises(ValueError),
                ):
                    self.gate(request=changed, job=job)

    def test_input9_keeps_its_own_capture_and_rejects_new_policy(self):
        for profile in CONFIGS:
            old, job = cell_packets(profile)
            self.assertIsNone(self.gate(request=old, job=job))
            old["input"]["source_continuation_policy"] = POLICY
            with self.subTest(profile=profile), self.assertRaises(ValueError):
                self.gate(request=old, job=job)
