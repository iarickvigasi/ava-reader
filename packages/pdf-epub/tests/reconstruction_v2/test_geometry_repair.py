"""Corrections retain every nonbox observation and still pass full source semantics."""

import copy
import unittest

from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.recognition_geometry_repair import (
    apply_geometry_repair,
    canonical_geometry_parent,
    prepare_geometry_repair,
)

from .geometry_repair_fixture import correction, fixture


class GeometryRepairTests(unittest.TestCase):
    def test_only_requested_boxes_change_and_original_bytes_are_immutable(self):
        parent, raw = fixture(2)
        original = copy.deepcopy(raw)
        task = prepare_geometry_repair(parent, json_bytes(raw).decode())
        patched = apply_geometry_repair(parent, task, correction(task))
        self.assertEqual(original, raw)
        self.assertEqual([0, 1], [slot.segment_index for slot in task.slots])
        for index in range(2):
            patched["segments"][index]["box"] = original["segments"][index]["box"]
        self.assertEqual(original, patched)
        self.assertEqual(json_bytes(raw).decode(), task.original_response_json)

    def test_color_case_is_the_only_existing_host_normalization(self):
        parent, raw = fixture()
        raw["segments"][0]["style"] = dict(id="ink", color="#ABCDEF")
        raw["segments"][0]["text"] = "#ABCDEF source"
        task = prepare_geometry_repair(parent, json_bytes(raw).decode())
        result = apply_geometry_repair(parent, task, correction(task))
        self.assertEqual("#abcdef", result["segments"][0]["style"]["color"])
        self.assertEqual("#ABCDEF source", result["segments"][0]["text"])
        value = '{"style":{"color":"#ABC","background_color":"#12ABCD"},"text":"#12ABCD"}'
        normalized = canonical_geometry_parent(value)
        self.assertEqual("#ABC", normalized["style"]["color"])
        self.assertEqual("#12abcd", normalized["style"]["background_color"])
        self.assertEqual("#12ABCD", normalized["text"])

    def test_eligibility_probe_does_not_replace_final_native_geometry_checks(self):
        parent, raw = fixture(reliable=True)
        task = prepare_geometry_repair(parent, json_bytes(raw).decode())
        reply = correction(task).model_dump(mode="json")
        reply["patches"][0]["box"].update(y0=700, y1=900)
        from ava_pdf_epub.reconstruction_v2.recognition_geometry_contract import (
            RecognitionGeometryResponse,
        )

        with self.assertRaisesRegex(ValueError, "reliable native text"):
            apply_geometry_repair(parent, task, RecognitionGeometryResponse.model_validate(reply))
        self.assertEqual(700, raw["segments"][0]["box"]["y0"])

    def test_missing_native_words_refuse_before_a_repair_request(self):
        parent, raw = fixture(reliable=True)
        raw["segments"][0]["text"] = "Changed source"
        with self.assertRaisesRegex(ValueError, "reliable native text"):
            prepare_geometry_repair(parent, json_bytes(raw).decode())

    def test_unresolved_requires_bound_empty_patches_and_never_accepts_parent(self):
        parent, raw = fixture()
        task = prepare_geometry_repair(parent, json_bytes(raw).decode())
        reply = correction(task).model_copy(
            update={
                "outcome": "unresolved",
                "patches": [],
                "unresolved_reason": "IMAGE_UNCLEAR",
            }
        )
        with self.assertRaisesRegex(ValueError, "GEOMETRY_UNRESOLVED"):
            apply_geometry_repair(parent, task, reply)
        forged = reply.model_copy(update={"source_sha256": "b" * 64})
        with self.assertRaisesRegex(ValueError, "BINDING_DIFFERS"):
            apply_geometry_repair(parent, task, forged)
