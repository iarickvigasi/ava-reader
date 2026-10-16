"""Source-preserving cell-only recovery; authored fixtures do not establish book fidelity."""

import copy
import unittest

from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.recognition_cell_geometry_contract import (
    RecognitionCellGeometryProof,
    RecognitionCellGeometryResponse,
    RecognitionCellGeometryTask,
)
from ava_pdf_epub.reconstruction_v2.recognition_cell_geometry_repair import (
    apply_cell_geometry_repair,
    prepare_cell_geometry_repair,
)
from ava_pdf_epub.reconstruction_v2.recognition_geometry_repair import prepare_geometry_repair

from .geometry_repair_fixture import fixture


def cell(x=0, y=0, text="Same", **values):
    return dict(
        text=text,
        spans=[],
        style=None,
        header_axis=None,
        box=dict(coordinate_space="render_normalized_1000", x0=x, x1=x + 90, y0=y, y1=y + 90),
        **values,
    )


def authored(rows=2, columns=2, broken=2):
    task, raw = fixture()
    segment = raw["segments"][0]
    segment.update(
        kind="table",
        text="Same Same",
        cells=[[cell(10 + c * 100, 10 + r * 100) for c in range(columns)] for r in range(rows)],
    )
    segment["box"].update(x0=0, y0=0, x1=1000, y1=1000)
    good = copy.deepcopy(raw)
    for row in segment["cells"]:
        for value in row:
            if broken:
                value["box"].update(y0=value["box"]["y1"], y1=value["box"]["y0"])
                broken -= 1
    return task, raw, good


def answer(task, good):
    return RecognitionCellGeometryResponse.model_validate(
        dict(
            schema_version="ava-recognition-cell-geometry-response-1",
            task_id=task.task_id,
            source_sha256=task.source_sha256,
            original_task_id=task.original_task_id,
            render_sha256=task.render_sha256,
            original_response_sha256=task.original_response_sha256,
            outcome="corrected",
            patches=[
                dict(
                    slot_id=s.slot_id,
                    box=good["segments"][s.segment_index]["cells"][s.row_index][s.cell_index][
                        "box"
                    ],
                )
                for s in task.slots
            ],
        )
    )


class CellGeometryTests(unittest.TestCase):
    def test_repeated_labels_have_distinct_slots_and_only_boxes_change(self):
        parent, raw, good = authored()
        before = json_bytes(raw).decode()
        task = prepare_cell_geometry_repair(parent, before)
        self.assertEqual([(0, 0), (0, 1)], [(s.row_index, s.cell_index) for s in task.slots])
        self.assertEqual(2, len({s.slot_id for s in task.slots}))
        self.assertEqual(good, apply_cell_geometry_repair(parent, task, answer(task, good)))
        self.assertEqual(before, json_bytes(raw).decode())
        with self.assertRaisesRegex(ValueError, "NOT_ELIGIBLE"):
            prepare_geometry_repair(parent, before)

    def test_array_cell_index_is_not_logical_column_for_merged_rows(self):
        parent, raw, good = authored(broken=0)
        for packet in (raw, good):
            packet["segments"][0]["cells"][0][0]["row_span"] = 2
            packet["segments"][0]["cells"][1].pop(0)
        raw["segments"][0]["cells"][1][0]["box"].update(y0=190, y1=100)
        task = prepare_cell_geometry_repair(parent, json_bytes(raw).decode())
        self.assertEqual((1, 0), (task.slots[0].row_index, task.slots[0].cell_index))
        self.assertEqual(good, apply_cell_geometry_repair(parent, task, answer(task, good)))

    def test_patch_coverage_refuses_missing_extra_duplicate_reordered_or_foreign_slots(self):
        parent, raw, good = authored()
        task = prepare_cell_geometry_repair(parent, json_bytes(raw).decode())
        reply = answer(task, good).model_dump(mode="json")
        for mutation in ("missing", "extra", "duplicate", "reorder", "foreign"):
            changed = copy.deepcopy(reply)
            patches = changed["patches"]
            if mutation == "missing":
                patches.pop()
            elif mutation == "extra":
                patches.append(copy.deepcopy(patches[0]))
            elif mutation == "duplicate":
                patches[1] = copy.deepcopy(patches[0])
            elif mutation == "reorder":
                patches.reverse()
            else:
                patches[0]["slot_id"] = "cell-geometry-" + "0" * 64
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                apply_cell_geometry_repair(
                    parent, task, RecognitionCellGeometryResponse.model_validate(changed)
                )

    def test_task_binding_detects_every_authority_change(self):
        parent, raw, good = authored()
        task = prepare_cell_geometry_repair(parent, json_bytes(raw).decode())
        for mutation in ("row", "index", "text", "box", "context", "table", "image", "parent"):
            fields = task.model_dump(mode="json")
            slot = fields["slots"][0]
            if mutation == "row":
                slot["row_index"] = 1
            elif mutation == "index":
                slot["cell_index"] = 1
            elif mutation == "text":
                slot["cell_text_sha256"] = "b" * 64
            elif mutation == "box":
                slot["original_box_sha256"] = "b" * 64
            elif mutation == "context":
                slot["row_context"][0] = "changed"
            elif mutation == "table":
                slot["table_box"]["x1"] = 999
            elif mutation == "image":
                fields["image"]["sha256"] = "b" * 64
            else:
                fields["original_response_json"] += " "
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                RecognitionCellGeometryTask.model_validate(fields)

    def test_unrelated_errors_or_measured_geometry_cannot_be_masked(self):
        for mutation in (
            "outer",
            "pinned",
            "span",
            "grid",
            "kind",
            "page",
            "method",
            "unresolved",
            "bounds",
            "string",
            "null",
        ):
            parent, raw, _ = authored()
            segment = raw["segments"][0]
            value = segment["cells"][0][0]
            if mutation == "outer":
                segment["box"].update(y0=900, y1=100)
            elif mutation == "pinned":
                value["source_cell_id"] = "known"
            elif mutation == "span":
                value["spans"] = [
                    dict(start=0, end=100, style=None, note_label=None, target_text=None, url=None)
                ]
            elif mutation == "grid":
                segment["cells"][1].pop()
            elif mutation == "kind":
                segment["kind"] = "paragraph"
            elif mutation == "page":
                segment["page"] = 2
            elif mutation == "method":
                segment["method"] = "native"
            elif mutation == "unresolved":
                raw["unresolved"] = ["unknown"]
            elif mutation == "bounds":
                value["box"]["x1"] = 1001
            elif mutation == "string":
                value["box"]["y0"] = "90"
            else:
                value["box"] = None
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                prepare_cell_geometry_repair(parent, json_bytes(raw).decode())

    def test_final_reply_cannot_change_text_or_escape_table_or_stay_reversed(self):
        parent, raw, good = authored()
        task = prepare_cell_geometry_repair(parent, json_bytes(raw).decode())
        for mutation in ("text", "outside", "reversed", "source"):
            fields = answer(task, good).model_dump(mode="json")
            patch = fields["patches"][0]
            if mutation == "text":
                patch["text"] = "replacement"
            elif mutation == "outside":
                patch["box"]["x1"] = 1001
            elif mutation == "reversed":
                patch["box"].update(y0=90, y1=1)
            else:
                fields["source_sha256"] = "f" * 64
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                apply_cell_geometry_repair(
                    parent, task, RecognitionCellGeometryResponse.model_validate(fields)
                )

    def test_max32_valid_and33_refused_without_any_dispatch(self):
        for count in (32, 33):
            parent, raw, good = authored(rows=5, columns=8, broken=count)
            if count == 33:
                with self.assertRaisesRegex(ValueError, "SLOT_BOUND"):
                    prepare_cell_geometry_repair(parent, json_bytes(raw).decode())
            else:
                task = prepare_cell_geometry_repair(parent, json_bytes(raw).decode())
                self.assertEqual(32, len(task.slots))
                self.assertEqual(good, apply_cell_geometry_repair(parent, task, answer(task, good)))

    def test_valid_and_duplicate_json_are_not_repairable(self):
        parent, _, good = authored()
        with self.assertRaisesRegex(ValueError, "ALREADY_VALID"):
            prepare_cell_geometry_repair(parent, json_bytes(good).decode())
        with self.assertRaises(ValueError):
            prepare_cell_geometry_repair(parent, '{"segments":[],"segments":[]}')

    def test_unresolved_and_forged_proof_do_not_authorize_content(self):
        parent, raw, good = authored()
        task = prepare_cell_geometry_repair(parent, json_bytes(raw).decode())
        fields = answer(task, good).model_dump(mode="json")
        fields.update(outcome="unresolved", patches=[], unresolved_reason="IMAGE_UNCLEAR")
        with self.assertRaisesRegex(ValueError, "UNRESOLVED"):
            apply_cell_geometry_repair(
                parent, task, RecognitionCellGeometryResponse.model_validate(fields)
            )
        with self.assertRaisesRegex(ValueError, "PROOF_BYTES"):
            RecognitionCellGeometryProof(
                original_response_json=task.original_response_json + " ",
                original_response_sha256=task.original_response_sha256,
                response=answer(task, good),
            )

    def test_valid_render_box_still_must_stay_inside_original_table(self):
        parent, raw, good = authored()
        raw["segments"][0]["box"].update(x1=200, y1=200)
        task = prepare_cell_geometry_repair(parent, json_bytes(raw).decode())
        fields = answer(task, good).model_dump(mode="json")
        fields["patches"][0]["box"]["x1"] = 201
        with self.assertRaisesRegex(ValueError, "Table cell outside table"):
            apply_cell_geometry_repair(
                parent, task, RecognitionCellGeometryResponse.model_validate(fields)
            )

    def test_native_text_and_measured_table_checks_remain_required_before_dispatch(self):
        import json

        from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionTask
        from ava_pdf_epub.reconstruction_v2.recognition_geometry_identity import geometry_digest
        from ava_pdf_epub.reconstruction_v2.task_identity import task_identifier

        for measured in (False, True):
            parent, raw, good = authored()
            fields = parent.model_dump(mode="json")
            evidence = json.loads(fields["native_evidence"])
            if measured:
                # No source table can match the supplied four physical cells.
                evidence["ruled_tables"] = [
                    dict(box=parent.region_box.model_dump(mode="json"), cells=[])
                ]
            else:
                evidence.update(
                    reliable=True,
                    lines=[
                        dict(
                            id="line",
                            box=parent.region_box.model_dump(mode="json"),
                            text="Missing native content",
                        )
                    ],
                )
            fields["native_evidence"] = json_bytes(evidence).decode()
            fields["native_evidence_sha256"] = geometry_digest(fields["native_evidence"].encode())
            fields["task_id"] = task_identifier(fields)
            parent = RecognitionTask.model_validate(fields)
            raw["task_id"] = parent.task_id
            with (
                self.subTest(measured=measured),
                self.assertRaisesRegex(
                    ValueError, "physical table cell coverage|reliable native text"
                ),
            ):
                prepare_cell_geometry_repair(parent, json_bytes(raw).decode())
