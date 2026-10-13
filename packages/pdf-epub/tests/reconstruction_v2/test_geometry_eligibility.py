"""The additive control cannot turn other recognition failures into geometry repairs."""

import copy
import unittest

from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.recognition_geometry_repair import prepare_geometry_repair

from .geometry_repair_fixture import fixture


class GeometryEligibilityTests(unittest.TestCase):
    def test_valid_parent_and_out_of_bounds_coordinates_are_ineligible(self):
        parent, raw = fixture()
        for mutation in ["valid", "outside", "coordinate_space"]:
            changed = copy.deepcopy(raw)
            if mutation == "valid":
                changed["segments"][0]["box"].update(y0=500, y1=600)
            elif mutation == "outside":
                changed["segments"][0]["box"]["x1"] = 1001
            else:
                changed["segments"][0]["box"]["coordinate_space"] = "page_points_top_left"
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                prepare_geometry_repair(parent, json_bytes(changed).decode())

    def test_hidden_nonbox_semantics_and_source_binding_are_ineligible(self):
        parent, raw = fixture()
        for mutation in ["page", "unsupported", "unresolved", "missing", "foreign", "anchor"]:
            changed = copy.deepcopy(raw)
            segment = changed["segments"][0]
            if mutation == "page":
                segment["page"] = 2
            elif mutation == "unsupported":
                segment["kind"] = "unsupported"
            elif mutation == "unresolved":
                changed["unresolved"] = ["uncertain source"]
            elif mutation == "missing":
                segment.pop("continues_to_next")
            elif mutation == "foreign":
                changed["task_id"] = "foreign"
            else:
                segment["spans"] = [
                    dict(
                        anchor={"exact_text": "missing"},
                        start=None,
                        end=None,
                        style=None,
                        note_label=None,
                        target_text=None,
                        url=None,
                    )
                ]
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                prepare_geometry_repair(parent, json_bytes(changed).decode())

    def test_duplicate_segment_ids_and_cell_geometry_are_ineligible(self):
        parent, raw = fixture(2)
        raw["segments"][1]["id"] = raw["segments"][0]["id"]
        with self.assertRaises(ValueError):
            prepare_geometry_repair(parent, json_bytes(raw).decode())
        parent, raw = fixture()
        raw["segments"][0]["cells"] = [
            [
                dict(
                    id="cell",
                    text="source",
                    row_span=1,
                    col_span=1,
                    style=None,
                    spans=[],
                    box=dict(coordinate_space="render_normalized_1000", x0=1, x1=2, y0=5, y1=4),
                )
            ]
        ]
        with self.assertRaises(ValueError):
            prepare_geometry_repair(parent, json_bytes(raw).decode())

    def test_coordinate_strings_and_booleans_remain_ineligible(self):
        for field, value in [("y0", "700"), ("x0", False)]:
            parent, raw = fixture()
            raw["segments"][0]["box"][field] = value
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, "NOT_ELIGIBLE"):
                prepare_geometry_repair(parent, json_bytes(raw).decode())

    def test_utf8_byte_bound_and_slot_bound_apply_before_dispatch(self):
        from ava_pdf_epub.reconstruction_v2.recognition_geometry_prompt import (
            GEOMETRY_RESPONSE_BYTES,
        )

        parent, raw = fixture(33)
        with self.assertRaisesRegex(ValueError, "SLOT_BOUND"):
            prepare_geometry_repair(parent, json_bytes(raw).decode())
        with self.assertRaisesRegex(ValueError, "RESPONSE_BOUND"):
            prepare_geometry_repair(parent, "😀" * (GEOMETRY_RESPONSE_BYTES // 4 + 1))
