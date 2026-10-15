"""Authored script-digit examples exercise literal repair, not private book text."""

import copy
import unittest

from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.recognition_anchor_candidates import allowed_quotations
from ava_pdf_epub.reconstruction_v2.recognition_anchor_context import prepare_anchor_context
from ava_pdf_epub.reconstruction_v2.recognition_anchor_quote import (
    apply_anchor_quote,
    prepare_anchor_quote,
    validate_anchor_quote,
)
from ava_pdf_epub.reconstruction_v2.recognition_anchor_quote_contract import (
    RecognitionAnchorQuoteResponse,
    RecognitionAnchorQuoteTask,
    quote_task_id,
)
from ava_pdf_epub.reconstruction_v2.recognition_anchors import anchored_offsets
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse

from .test_recognition_anchor_context import fixture as context_fixture


def fixture():
    parent, raw = context_fixture()
    raw["segments"] = raw["segments"][:1]
    segment = raw["segments"][0]
    segment["text"] = "A😀é 1 left¹ middle¹ right¹."
    original = segment["spans"][0]
    segment["spans"] = []
    for before, after in [("left", " middle"), ("middle", " right"), ("right", ".")]:
        span = copy.deepcopy(original)
        span["style"] = {"id": "observed", "vertical_align": "super"}
        span["anchor"] = {"exact_text": "1", "before": before, "after": after}
        segment["spans"].append(span)
    return parent, raw


def correction(task):
    raw = dict(
        schema_version="ava-recognition-anchor-quote-response-2",
        task_id=task.task_id,
        source_sha256=task.source_sha256,
        original_task_id=task.original_task_id,
        render_sha256=task.render_sha256,
        original_response_sha256=task.original_response_sha256,
        outcome="corrected",
        unresolved_reason=None,
        patches=[],
    )
    for slot, before, after in zip(
        task.slots, ["left", "middle", "right"], [" middle", " right", "."], strict=True
    ):
        raw["patches"].append(
            dict(
                segment_index=slot.segment_index,
                span_index=slot.span_index,
                span_sha256=slot.span_sha256,
                exact_text="¹",
                before=before,
                after=after,
            )
        )
    return RecognitionAnchorQuoteResponse.model_validate(raw)


class AnchorQuoteTests(unittest.TestCase):
    def test_repeated_digits_preserve_text_styles_and_unique_codepoint_locations(self):
        parent, raw = fixture()
        original = copy.deepcopy(raw)
        task = prepare_anchor_quote(parent, json_bytes(raw).decode())
        self.assertEqual([["1", "¹"]] * 3, [s.allowed_quotations for s in task.slots])
        patched = apply_anchor_quote(parent, task, correction(task))
        typed = RecognitionResponse.model_validate(patched)
        self.assertEqual(
            [(11, 12), (19, 20), (26, 27)],
            [
                anchored_offsets(typed.segments[0].text, span.anchor)
                for span in typed.segments[0].spans
            ],
        )
        for i, span in enumerate(patched["segments"][0]["spans"]):
            span["anchor"] = original["segments"][0]["spans"][i]["anchor"]
        self.assertEqual(original, patched)
        self.assertEqual(original, raw)
        v1 = prepare_anchor_context(parent, json_bytes(raw).decode())
        self.assertEqual("ava-recognition-anchor-context-task-1", v1.schema_version)
        with self.assertRaises(ValueError):
            RecognitionResponse.model_validate(raw)

    def test_alias_absent_original_is_v2_only(self):
        parent, raw = fixture()
        raw["segments"][0]["text"] = raw["segments"][0]["text"].replace(" 1 ", " ")
        with self.assertRaises(ValueError):
            prepare_anchor_context(parent, json_bytes(raw).decode())
        task = prepare_anchor_quote(parent, json_bytes(raw).decode())
        self.assertEqual([["¹"]] * 3, [s.allowed_quotations for s in task.slots])
        apply_anchor_quote(parent, task, correction(task))

    def test_literal_families_sequences_and_no_general_unicode_normalization(self):
        examples = [
            ("super", "0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹"),
            ("sub", "0123456789", "₀₁₂₃₄₅₆₇₈₉"),
            ("super", "⁹⁸", "98"),
            ("sub", "₉₈", "98"),
        ]
        for style, quote, alias in examples:
            with self.subTest(style=style, quote=quote):
                span = {"anchor": {"exact_text": quote}, "style": {"vertical_align": style}}
                self.assertEqual([quote, alias], allowed_quotations(quote + " " + alias, span))
                self.assertEqual([quote], allowed_quotations(quote, span))
        for quote in ["１", "①", "1¹", "1₂", "1 2", "1.2", "i", "n", "₁"]:
            span = {"anchor": {"exact_text": quote}, "style": {"vertical_align": "super"}}
            with self.subTest(quote=quote):
                self.assertEqual([], allowed_quotations("1 12 ¹ ¹²", span))

    def test_reference_numeric_invalid_style_or_other_failures_are_not_masked(self):
        parent, raw = fixture()
        for key, value in [
            ("url", "https://example.com"),
            ("note_label", "1"),
            ("target_text", "note"),
            ("start", 0),
            ("end", 1),
        ]:
            changed = copy.deepcopy(raw)
            changed["segments"][0]["spans"][0][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                prepare_anchor_quote(parent, json_bytes(changed).decode())
        for mutate in [
            lambda s: s.update(page=2),
            lambda s: s["box"].update(x1=1001),
            lambda s: s["spans"][0]["style"].update(invented=True),
        ]:
            changed = copy.deepcopy(raw)
            mutate(changed["segments"][0])
            with self.assertRaises(ValueError):
                prepare_anchor_quote(parent, json_bytes(changed).decode())

    def test_task_candidates_and_original_fields_cannot_be_forged_even_with_new_id(self):
        parent, raw = fixture()
        task = prepare_anchor_quote(parent, json_bytes(raw).decode())
        for mutate in [
            lambda t: t["slots"][0].update(allowed_quotations=["middle¹"]),
            lambda t: t["slots"][0].update(allowed_quotations=["¹", "1"]),
            lambda t: t["slots"][0].update(segment_text_sha256="f" * 64),
            lambda t: t["slots"][0].update(span_sha256="f" * 64),
            lambda t: t.update(render_sha256="f" * 64),
            lambda t: t.update(original_task_id="other"),
        ]:
            fields = task.model_dump(mode="json")
            mutate(fields)
            with self.assertRaises(ValueError):
                RecognitionAnchorQuoteTask.model_validate(fields)
        changed = task.model_copy(
            update={
                "slots": [
                    task.slots[0].model_copy(update={"allowed_quotations": ["middle¹"]}),
                    *task.slots[1:],
                ]
            }
        )
        changed = changed.model_copy(update={"task_id": quote_task_id(changed)})
        with self.assertRaises(ValueError):
            apply_anchor_quote(parent, changed, correction(task))

    def test_patch_cannot_enlarge_skip_context_or_lose_coverage(self):
        parent, raw = fixture()
        task = prepare_anchor_quote(parent, json_bytes(raw).decode())
        reply = correction(task)
        for change in [
            {"exact_text": "middle¹"},
            {"exact_text": "₁"},
            {"before": "", "after": ""},
            {"before": "lef"},
            {"after": " middle¹ right"},
            {"after": "x" * 129},
            {"span_sha256": "f" * 64},
        ]:
            patches = [reply.patches[0].model_copy(update=change), *reply.patches[1:]]
            # An exact longer adjacent context is valid; do not treat it as skipped context.
            if change == {"after": " middle¹ right"}:
                apply_anchor_quote(parent, task, reply.model_copy(update={"patches": patches}))
            else:
                with self.subTest(change=change), self.assertRaises(ValueError):
                    apply_anchor_quote(parent, task, reply.model_copy(update={"patches": patches}))
        for patches in [
            reply.patches[:1],
            [reply.patches[0]] * 3,
            reply.patches + [reply.patches[0]],
        ]:
            with self.assertRaises(ValueError):
                apply_anchor_quote(parent, task, reply.model_copy(update={"patches": patches}))

    def test_parser_receipt_revalidates_parent_and_unresolved_cannot_apply(self):
        parent, raw = fixture()
        task = prepare_anchor_quote(parent, json_bytes(raw).decode())
        payload = dict(
            mode="validate_anchor_quote",
            task=parent.model_dump(mode="json"),
            correction=task.model_dump(mode="json"),
        )
        self.assertEqual(task.task_id, validate_anchor_quote(json_bytes(payload))["task_id"])
        payload["task"]["page_number"] = 2
        with self.assertRaises(ValueError):
            validate_anchor_quote(json_bytes(payload))
        reply = correction(task).model_copy(
            update={"outcome": "unresolved", "patches": [], "unresolved_reason": "IMAGE_UNCLEAR"}
        )
        with self.assertRaisesRegex(ValueError, "UNRESOLVED"):
            apply_anchor_quote(parent, task, reply)
        with self.assertRaises(ValueError):
            RecognitionAnchorQuoteResponse.model_validate(
                correction(task).model_dump() | {"outcome": "unresolved"}
            )


if __name__ == "__main__":
    unittest.main()
