"""Complete-title admission requires its own captured policy and empty initial state."""

import unittest
from copy import deepcopy

from ava_pdf_epub.runtime import supervisor

from . import test_supervisor_exchange as fixture
from .test_supervisor_geometry_exchange import geometry_packets

TITLE_CONFIGS = {
    "ava-pdf-prose-en-v2": "d8bb90385b949c5bf22eefafdb427ff3a76a25ba3e8ce006f1e28c3c7f348e5b",
    "ava-pdf-prose-en-uk-v3": "5fed6a113e4851d26b843716cf48bbddf954e64155c82fd0655e63607600b8d4",
}


def title_packets(profile="ava-pdf-prose-en-uk-v3"):
    request, job = geometry_packets(profile)
    request["input"].update(
        schema_version="ava-reconstruct-input-7", source_title_policy="ava-frontmatter-title-1"
    )
    job["config_sha256"] = TITLE_CONFIGS[profile]
    return request, job


class SupervisorTitleTests(unittest.TestCase):
    gate = fixture.SupervisorExchangeTests.gate

    def test_both_exact_title_captures_reach_entry(self):
        for profile in TITLE_CONFIGS:
            request, job = title_packets(profile)
            with self.subTest(profile=profile):
                self.assertIsNone(self.gate(request=request, job=job))

    def test_input7_cannot_borrow_any_historical_capture(self):
        request, job = title_packets()
        for config in (
            None,
            "f" * 64,
            TITLE_CONFIGS["ava-pdf-prose-en-v2"],
            *supervisor._LAYOUT_CONFIGS.values(),
            *supervisor._STRUCTURE_CONFIGS.values(),
            *supervisor._WORD_WRAP_CONFIGS.values(),
            *supervisor._GEOMETRY_CONFIGS.values(),
        ):
            with self.subTest(config=config), self.assertRaises(ValueError):
                self.gate(request=request, job={**job, "config_sha256": config})

    def test_missing_wrong_extra_or_prior_fields_refuse(self):
        request, job = title_packets()
        for field, original in request["input"].items():
            if field in {"profile_id", "source_sha256", "schema_version"}:
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

    def test_old_input6_remains_closed_and_cannot_borrow_title_capture(self):
        for profile in TITLE_CONFIGS:
            old, old_job = geometry_packets(profile)
            request, title_job = title_packets(profile)
            with self.subTest(profile=profile):
                self.assertIsNone(self.gate(request=old, job=old_job))
                with self.assertRaises(ValueError):
                    self.gate(request=old, job=title_job)
                with self.assertRaises(ValueError):
                    self.gate(request=request, job=old_job)
                old["input"]["source_title_policy"] = "ava-frontmatter-title-1"
                with self.assertRaises(ValueError):
                    self.gate(request=old, job=old_job)
