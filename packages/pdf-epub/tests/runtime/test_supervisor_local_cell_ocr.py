"""New local producer capture reuses Input10 without changing historic identities."""

import unittest

from ava_pdf_epub.runtime.supervisor_exchange_configs import _LOCAL_CELL_OCR_CONFIGS

from . import test_supervisor_exchange as fixture
from .test_supervisor_continuation_exchange import continuation_packets


class SupervisorLocalCellOcrTests(unittest.TestCase):
    gate = fixture.SupervisorExchangeTests.gate

    def test_both_captured_profiles_keep_the_same_closed_input10(self):
        for profile, config in _LOCAL_CELL_OCR_CONFIGS.items():
            request, job = continuation_packets(profile)
            job["config_sha256"] = config
            with self.subTest(profile=profile):
                self.assertIsNone(self.gate(request=request, job=job))

    def test_local_capture_cannot_be_borrowed_for_old_or_incomplete_input(self):
        for profile, config in _LOCAL_CELL_OCR_CONFIGS.items():
            for change in ("old", "missing", "extra", "foreign-profile"):
                request, job = continuation_packets(profile)
                job["config_sha256"] = config
                if change == "old":
                    request["input"]["schema_version"] = "ava-reconstruct-input-9"
                    request["input"].pop("source_continuation_policy")
                elif change == "missing":
                    request["input"].pop("source_normalization_policy")
                elif change == "extra":
                    request["input"]["local_cell_geometry_policy"] = "not-wire-authority"
                else:
                    job["profile_id"] = (
                        "ava-pdf-prose-en-v2"
                        if profile.endswith("v3")
                        else "ava-pdf-prose-en-uk-v3"
                    )
                with self.subTest(profile=profile, change=change), self.assertRaises(ValueError):
                    self.gate(request=request, job=job)
