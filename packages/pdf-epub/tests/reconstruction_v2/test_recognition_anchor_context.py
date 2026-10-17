"""Authored repeated-digit cases retain strict source binding and context-only authority."""

import copy
import unittest

from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.recognition_anchor_context import (
    RecognitionAnchorContextResponse,
    apply_anchor_context,
    prepare_anchor_context,
)
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse, RecognitionTask
from ava_pdf_epub.reconstruction_v2.task_identity import task_identifier
from ava_pdf_epub.reconstruction_v2.validate_tasks import validate_tasks

from .recognition_task_fixture import task_fixture
from .response_fixtures import wire_segment


def fixture():
    task = task_fixture().model_dump(mode="json")
    task["prompt_version"] = "ava-prose-region-15"
    task["task_id"] = task_identifier(task)
    task = RecognitionTask.model_validate(task)
    response = dict(
        schema_version="ava-recognition-response-2",
        task_id=task.task_id,
        source_sha256=task.source_sha256,
        render_sha256=task.image.sha256,
        language="en",
        unresolved=[],
        segments=[],
    )
    for index, text in enumerate(["1 Alpha 1", "3 Beta 34"]):
        response["segments"].append(
            wire_segment(
                id=f"s{index}",
                text=text,
                spans=[
                    dict(
                        anchor={"exact_text": text[0]},
                        start=None,
                        end=None,
                        style={"id": "bold", "bold": True},
                        note_label=None,
                        target_text=None,
                        url=None,
                    )
                ],
            )
        )
    return task, response


def correction(task):
    return RecognitionAnchorContextResponse.model_validate(
        dict(
            schema_version="ava-recognition-anchor-context-response-1",
            task_id=task.task_id,
            source_sha256=task.source_sha256,
            original_task_id=task.original_task_id,
            render_sha256=task.render_sha256,
            original_response_sha256=task.original_response_sha256,
            outcome="corrected",
            unresolved_reason=None,
            patches=[
                dict(
                    segment_index=s.segment_index,
                    span_index=s.span_index,
                    span_sha256=s.span_sha256,
                    before="",
                    after=" Alpha" if s.segment_index == 0 else " Beta",
                )
                for s in task.slots
            ],
        )
    )


class AnchorContextTests(unittest.TestCase):
    def test_current_strict_anchor_refusal_is_preserved(self):
        _, raw = fixture()
        with self.assertRaisesRegex(ValueError, "Ambiguous exact inline anchor"):
            RecognitionResponse.model_validate(raw)

    def test_context_patch_preserves_every_other_field_and_full_acceptance(self):
        parent, raw = fixture()
        original = copy.deepcopy(raw)
        task = prepare_anchor_context(parent, json_bytes(raw).decode())
        self.assertEqual([(0, 0), (1, 0)], [(s.segment_index, s.span_index) for s in task.slots])
        patched = apply_anchor_context(parent, task, correction(task))
        self.assertEqual(original, raw)
        for segment in patched["segments"]:
            segment["spans"][0]["anchor"].pop("before")
            segment["spans"][0]["anchor"].pop("after")
        self.assertEqual(original, patched)
        accepted = apply_anchor_context(parent, task, correction(task))
        self.assertEqual(
            1,
            validate_tasks(
                json_bytes(
                    dict(
                        mode="validate_tasks",
                        tasks=[parent.model_dump(mode="json")],
                        responses=[accepted],
                    )
                )
            ).task_count,
        )

    def test_missing_quote_is_not_context_repairable(self):
        parent, raw = fixture()
        raw["segments"][0]["spans"][0]["anchor"]["exact_text"] = "not present"
        with self.assertRaises(ValueError):
            prepare_anchor_context(parent, json_bytes(raw).decode())

    def test_unknown_non_context_patch_fields_and_foreign_binding_refused(self):
        parent, raw = fixture()
        task = prepare_anchor_context(parent, json_bytes(raw).decode())
        for field in ["text", "style", "box", "exact_text", "url"]:
            changed = correction(task).model_dump(mode="json")
            changed["patches"][0][field] = "invented"
            with self.subTest(field=field), self.assertRaises(ValueError):
                RecognitionAnchorContextResponse.model_validate(changed)
        changed = correction(task).model_copy(update={"original_response_sha256": "b" * 64})
        with self.assertRaises(ValueError):
            apply_anchor_context(parent, task, changed)

    def test_missing_duplicate_or_still_ambiguous_patches_refused(self):
        parent, raw = fixture()
        task = prepare_anchor_context(parent, json_bytes(raw).decode())
        for patches in [
            correction(task).patches[:1],
            [correction(task).patches[0]] * 2,
            [p.model_copy(update={"before": "", "after": ""}) for p in correction(task).patches],
        ]:
            with self.subTest(count=len(patches)), self.assertRaises(ValueError):
                apply_anchor_context(
                    parent, task, correction(task).model_copy(update={"patches": patches})
                )

    def test_unrepairable_page_geometry_and_source_text_refuse_before_dispatch(self):
        parent, raw = fixture()
        for mutation in ["page", "box", "native"]:
            changed = copy.deepcopy(raw)
            task = parent
            if mutation == "page":
                changed["segments"][0]["page"] = 2
            elif mutation == "box":
                changed["segments"][0]["box"]["x1"] = 1001
            else:
                fields = parent.model_dump(mode="json")
                fields["native_evidence"] = json_bytes(
                    {
                        "reliable": True,
                        "lines": [
                            {
                                "id": "owned-line",
                                "box": parent.region_box.model_dump(mode="json"),
                                "text": "Missing reliable source words",
                            }
                        ],
                    }
                ).decode()
                from ava_pdf_epub.reconstruction_v2.recognition_anchor_context import digest

                fields["native_evidence_sha256"] = digest(fields["native_evidence"].encode())
                fields["task_id"] = task_identifier(fields)
                task = RecognitionTask.model_validate(fields)
                changed["task_id"] = task.task_id
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                prepare_anchor_context(task, json_bytes(changed).decode())

    def test_apply_revalidates_typed_patch_bounds(self):
        parent, raw = fixture()
        task = prepare_anchor_context(parent, json_bytes(raw).decode())
        reply = correction(task)
        forged = reply.model_copy(
            update={
                "patches": [
                    reply.patches[0].model_copy(update={"after": "x" * 129}),
                    reply.patches[1],
                ]
            }
        )
        with self.assertRaises(ValueError):
            apply_anchor_context(parent, task, forged)

    def test_parser_receipt_binds_exact_request_and_original_parent(self):
        from ava_pdf_epub.reconstruction_v2.recognition_anchor_context import (
            digest,
            validate_anchor_context,
        )

        parent, raw = fixture()
        task = prepare_anchor_context(parent, json_bytes(raw).decode())
        packet = json_bytes(
            {
                "mode": "validate_anchor_context",
                "task": parent.model_dump(mode="json"),
                "correction": task.model_dump(mode="json"),
            }
        )
        self.assertEqual(
            {
                "schema_version": "ava-anchor-context-checked-1",
                "request_sha256": digest(packet),
                "task_id": task.task_id,
            },
            validate_anchor_context(packet),
        )
        changed = parent.model_copy(update={"page_number": 2})
        with self.assertRaises(ValueError):
            validate_anchor_context(
                json_bytes(
                    {
                        "mode": "validate_anchor_context",
                        "task": changed.model_dump(mode="json"),
                        "correction": task.model_dump(mode="json"),
                    }
                )
            )

    def test_distinct_control_exceeds_terminal_bound_and_refuses_second_parent_pass(self):
        import io

        from ava_pdf_epub.reconstruction_v2.attempt_exchange import ExchangeWriter
        from ava_pdf_epub.reconstruction_v2.recognition_anchor_exchange import emit_context

        parent, raw = fixture()
        for segment in raw["segments"]:
            digit = segment["text"][0]
            segment["text"] = digit + " " + "x" * 199900 + " " + digit
        task = prepare_anchor_context(parent, json_bytes(raw).decode())
        output = io.BytesIO()
        writer = ExchangeWriter(output, parent.source_sha256, parent.profile_id)
        packet = emit_context(writer, task)
        self.assertEqual("ava-recognition-anchor-context-exchange-1", packet.schema_version)
        self.assertGreater(len(output.getvalue()), 256 * 1024)
        self.assertLess(len(output.getvalue()), 8 * 1024 * 1024 + 1024)
        with self.assertRaisesRegex(ValueError, "SECOND_PASS"):
            emit_context(writer, task)

    def test_unresolved_does_not_drop_styles_or_accept_parent(self):
        parent, raw = fixture()
        task = prepare_anchor_context(parent, json_bytes(raw).decode())
        unresolved = correction(task).model_copy(
            update={
                "outcome": "unresolved",
                "patches": [],
                "unresolved_reason": "NO_UNIQUE_CONTEXT",
            }
        )
        with self.assertRaisesRegex(ValueError, "UNRESOLVED"):
            apply_anchor_context(parent, task, unresolved)


if __name__ == "__main__":
    unittest.main()
