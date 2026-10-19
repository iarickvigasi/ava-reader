"""Outside-parent cells use the same closed box-only correction, never a table expansion."""

import unittest

from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.recognition_cell_geometry_repair import (
    apply_cell_geometry_repair,
    prepare_cell_geometry_repair,
)

from .test_cell_geometry_repair import answer, authored


def containment(edge="y1"):
    parent, raw, good = authored(broken=0)
    for packet in (raw, good):
        packet["segments"][0]["box"].update(x0=5, y0=5, x1=800, y1=800)
    raw["segments"][0]["cells"][0][0]["box"][edge] = 4 if edge in {"x0", "y0"} else 801
    return parent, raw, good


class CellContainmentTests(unittest.TestCase):
    def test_all_four_sides_keep_everything_except_requested_cell_box_exact(self):
        for edge in ("x0", "y0", "x1", "y1"):
            parent, raw, good = containment(edge)
            before = json_bytes(raw).decode()
            with self.subTest(edge=edge):
                task = prepare_cell_geometry_repair(parent, before)
                self.assertEqual(
                    [(0, 0, 0)], [(s.segment_index, s.row_index, s.cell_index) for s in task.slots]
                )
                self.assertEqual(good, apply_cell_geometry_repair(parent, task, answer(task, good)))
                self.assertEqual(before, json_bytes(raw).decode())

    def test_hidden_outside_cell_and_reversed_cell_share_one_ordered_correction(self):
        parent, raw, good = containment()
        raw["segments"][0]["cells"][0][1]["box"].update(y0=100, y1=10)
        task = prepare_cell_geometry_repair(parent, json_bytes(raw).decode())
        self.assertEqual([(0, 0), (0, 1)], [(s.row_index, s.cell_index) for s in task.slots])
        self.assertEqual(good, apply_cell_geometry_repair(parent, task, answer(task, good)))

    def test_unrelated_errors_and_pinned_or_out_of_image_cells_still_refuse(self):
        for kind in ("outer", "pinned", "span", "grid", "page", "bounds", "unknown", "other_cell"):
            parent, raw, _ = containment()
            segment = raw["segments"][0]
            cell = segment["cells"][0][0]
            if kind == "outer":
                segment["box"].update(y0=800, y1=5)
            elif kind == "pinned":
                cell["source_cell_id"] = "known"
            elif kind == "span":
                cell["spans"] = [
                    dict(start=0, end=100, style=None, note_label=None, target_text=None, url=None)
                ]
            elif kind == "grid":
                segment["cells"][1].pop()
            elif kind == "page":
                segment["page"] = 2
            elif kind == "bounds":
                cell["box"]["y1"] = 1001
            elif kind == "unknown":
                cell["discarded"] = True
            else:
                segment["cells"][1][1]["box"]["x0"] = "10"
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                prepare_cell_geometry_repair(parent, json_bytes(raw).decode())

    def test_corrected_positive_in_image_box_must_also_fit_unchanged_table(self):
        parent, raw, good = containment()
        task = prepare_cell_geometry_repair(parent, json_bytes(raw).decode())
        response = answer(task, good)
        bad = response.model_dump(mode="json")
        bad["patches"][0]["box"]["y1"] = 801
        with self.assertRaisesRegex(ValueError, "Table cell outside table"):
            apply_cell_geometry_repair(parent, task, type(response).model_validate(bad))
        self.assertEqual(raw["segments"][0]["box"], good["segments"][0]["box"])

    def test_valid_inside_or_exact_boundary_cells_do_not_gain_repair_authority(self):
        parent, _, good = containment()
        good["segments"][0]["cells"][0][0]["box"].update(y1=800)
        with self.assertRaisesRegex(ValueError, "ALREADY_VALID"):
            prepare_cell_geometry_repair(parent, json_bytes(good).decode())

    def test_merged_rows_keep_array_address_and_outside_slots_obey_32_limit(self):
        parent, raw, good = containment()
        for packet in (raw, good):
            packet["segments"][0]["cells"][0][0]["box"]["y1"] = 100
            packet["segments"][0]["cells"][0][0]["row_span"] = 2
            packet["segments"][0]["cells"][1].pop(0)
        raw["segments"][0]["cells"][1][0]["box"]["y1"] = 801
        task = prepare_cell_geometry_repair(parent, json_bytes(raw).decode())
        self.assertEqual((1, 0), (task.slots[0].row_index, task.slots[0].cell_index))
        self.assertEqual(good, apply_cell_geometry_repair(parent, task, answer(task, good)))
        for count in (32, 33):
            parent, raw, good = authored(rows=5, columns=8, broken=0)
            for packet in (raw, good):
                packet["segments"][0]["box"].update(x1=900, y1=900)
            for index, cell in enumerate(c for row in raw["segments"][0]["cells"] for c in row):
                if index < count:
                    cell["box"]["x1"] = 901
            if count == 33:
                with self.assertRaisesRegex(ValueError, "SLOT_BOUND"):
                    prepare_cell_geometry_repair(parent, json_bytes(raw).decode())
            else:
                task = prepare_cell_geometry_repair(parent, json_bytes(raw).decode())
                self.assertEqual(32, len(task.slots))
                self.assertEqual(good, apply_cell_geometry_repair(parent, task, answer(task, good)))
