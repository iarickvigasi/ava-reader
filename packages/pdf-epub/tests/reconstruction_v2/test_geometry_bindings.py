"""Exact raw/image/slot identity and complete ordered patches remain mandatory."""

import unittest

from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.recognition_geometry_contract import (
    RecognitionGeometryProof,
    RecognitionGeometryResponse,
    RecognitionGeometryTask,
)
from ava_pdf_epub.reconstruction_v2.recognition_geometry_repair import (
    apply_geometry_repair,
    prepare_geometry_repair,
)

from .geometry_repair_fixture import correction, fixture


class GeometryBindingTests(unittest.TestCase):
    def test_complete_ordered_requested_ids_and_box_only_fields_are_required(self):
        parent, raw = fixture(2)
        task = prepare_geometry_repair(parent, json_bytes(raw).decode())
        for patches in [
            correction(task).patches[:1],
            correction(task).patches[::-1],
            [correction(task).patches[0]] * 2,
        ]:
            with self.subTest(patches=patches), self.assertRaises(ValueError):
                apply_geometry_repair(
                    parent,
                    task,
                    correction(task).model_copy(
                        update={"patches": patches},
                    ),
                )
        for field in ["text", "kind", "style", "segment_index"]:
            reply = correction(task).model_dump(mode="json")
            reply["patches"][0][field] = "invented"
            with self.subTest(field=field), self.assertRaises(ValueError):
                RecognitionGeometryResponse.model_validate(reply)

    def test_task_revalidates_original_bytes_image_slots_and_context(self):
        parent, raw = fixture(2)
        task = prepare_geometry_repair(parent, json_bytes(raw).decode())
        for mutation in ["raw", "image", "slots", "context", "box"]:
            fields = task.model_dump(mode="json")
            if mutation == "raw":
                fields["original_response_json"] += " "
            elif mutation == "image":
                fields["image"]["sha256"] = "b" * 64
            elif mutation == "slots":
                fields["slots"].pop()
            elif mutation == "context":
                fields["slots"][0]["context"] = "invented"
            else:
                fields["slots"][0]["original_box_json"] = "{}"
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                RecognitionGeometryTask.model_validate(fields)

    def test_apply_revalidates_forged_typed_box_and_parent(self):
        parent, raw = fixture()
        task = prepare_geometry_repair(parent, json_bytes(raw).decode())
        reply = correction(task)
        bad_box = reply.patches[0].box.model_copy(update={"y1": -1})
        forged = reply.model_copy(
            update={
                "patches": [reply.patches[0].model_copy(update={"box": bad_box})],
            }
        )
        with self.assertRaises(ValueError):
            apply_geometry_repair(parent, task, forged)
        with self.assertRaises(ValueError):
            apply_geometry_repair(parent.model_copy(update={"page_number": 2}), task, reply)

    def test_proof_binds_exact_raw_digest_and_the_correction_digest(self):
        parent, raw = fixture()
        task = prepare_geometry_repair(parent, json_bytes(raw).decode())
        fields = dict(
            original_response_json=task.original_response_json,
            original_response_sha256=task.original_response_sha256,
            response=correction(task).model_dump(mode="json"),
        )
        RecognitionGeometryProof.model_validate(fields)
        fields["original_response_json"] += " "
        with self.assertRaisesRegex(ValueError, "PROOF_BYTES_DIFFER"):
            RecognitionGeometryProof.model_validate(fields)
