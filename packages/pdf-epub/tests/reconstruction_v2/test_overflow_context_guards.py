"""Masking an invalid anchor must never hide another invalid observation or reference."""

import copy
import unittest

from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.overflow_context_prepare import prepare_overflow_context

from .overflow_context_fixture import overflow_fixture


class OverflowContextGuardTests(unittest.TestCase):
    def test_masked_span_still_requires_valid_style_closed_fields_and_no_reference_authority(self):
        parent, original = overflow_fixture()
        for patch in (
            {"style": {"id": "bad", "imagined": True}},
            {"style": None},
            {"url": "https://example.com"},
            {"note_label": "1"},
            {"target_text": "Alpha"},
            {"start": 0, "end": 1},
            {"unknown": "discarded"},
            {"anchor": {"exact_text": "Absent", "before": "x" * 161}},
            {"anchor": {"exact_text": "1", "before": "x" * 4097}},
        ):
            raw = copy.deepcopy(original)
            raw["segments"][0]["spans"][0].update(patch)
            with self.subTest(patch=list(patch)), self.assertRaises(ValueError):
                prepare_overflow_context(parent, json_bytes(raw).decode())

    def test_other_schema_geometry_source_language_and_unsupported_faults_are_not_masked(self):
        parent, original = overflow_fixture()
        cases = []
        for field, value in (
            ("language", "fr"),
            ("source_sha256", "b" * 64),
            ("unresolved", ["unknown"]),
        ):
            raw = copy.deepcopy(original)
            raw[field] = value
            cases.append(raw)
        raw = copy.deepcopy(original)
        raw["segments"][0]["box"]["x1"] = 1001
        cases.append(raw)
        raw = copy.deepcopy(original)
        raw["segments"][0]["imagined"] = True
        cases.append(raw)
        raw = copy.deepcopy(original)
        raw["segments"][0]["text"] += "\ud800"
        cases.append(raw)
        for raw in cases:
            with self.assertRaises(ValueError):
                prepare_overflow_context(parent, json_bytes(raw).decode())
        wire = json_bytes(original).decode()
        with self.assertRaises(ValueError):
            prepare_overflow_context(
                parent, wire.replace('"language":"en"', '"language":"en","language":"en"')
            )
