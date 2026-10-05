"""Character/style wire consistency is strict; these controls are not live OCR evidence."""

import base64
import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2 import recognition_prompt as prompts
from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.make_task import make_task
from ava_pdf_epub.reconstruction_v2.native_review import NativeReviewRequired
from ava_pdf_epub.reconstruction_v2.observations import PageObservation
from ava_pdf_epub.reconstruction_v2.observe_tables import TableObservation
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse
from ava_pdf_epub.reconstruction_v2.route_native import route_native
from ava_pdf_epub.reconstruction_v2.task_identity import task_identifier

from .recognition_task_fixture import task_fixture
from .response_fixtures import wire_segment
from .test_pinned_table_cells import fixture as pinned_fixture
from .test_recognition_coordinates import response_for
from .test_recognition_tables import source_table

HISTORICAL_PROMPTS = {
    "SYSTEM_PROMPT": "19ee580f70ef6f86869d76ef2800b7f307b2c98b590f8ebbaa130c386857027b",
    "MERGED_TABLE_PROMPT": "3fc80c924c550faa23a88e49c8a8f58e3f789b3d499a503d3ec7e85bc7d6728d",
    "PINNED_TABLE_PROMPT": "00abaa35eb29a645bf4fb00fa4ce4f182e36f7998c771d425baebab8cb5a6f63",
    "EXPLICIT_STYLE_PROMPT": "88e6f1febb61b7421f707f28e548bb7e063db09ce8b8b60a841ba5b18620e592",
    "PINNED_STYLE_PROMPT": "8d31f77ccf23919e93d5eec76c00215ddb9c8d6935fa6ed27b393339f8b76340",
    "ANCHORED_STYLE_PROMPT": "76424ebf8a647137a307d1cd79989ac14297d9cb8807c88585f9b0098349eab6",
    "PINNED_ANCHORED_PROMPT": "61c4cfdaad199ce120604613bf8b16b25886c9f2928628957c84fb3cd37d0951",
    "BOUNDARY_STYLE_PROMPT": "12eb1541a9402e6293450ccca39ee9a284d063bf1659f4ede2c143df4ce927f8",
    "PINNED_BOUNDARY_PROMPT": "60254df25f2271689ab8ff559ef7f2f7d1149ab40354cdf2e2e9e6493d506982",
}


def versioned_task(version):
    task = task_fixture()
    raw = task.model_dump()
    raw["prompt_version"] = version
    raw["task_id"] = task_identifier(raw)
    return type(task).model_validate(raw)


def style_span(quotation, placement=None, **context):
    return dict(
        anchor=dict(exact_text=quotation, **context),
        style={"id": "inline", **({"vertical_align": placement} if placement else {})},
        note_label=None,
        target_text=None,
        url=None,
    )


class UnicodeStylePrompt(unittest.TestCase):
    def test_historical_prompt_bytes_remain_exact(self):
        for name, expected in HISTORICAL_PROMPTS.items():
            with self.subTest(name=name):
                self.assertEqual(
                    expected,
                    hashlib.sha256(getattr(prompts, name).encode()).hexdigest(),
                )

    def test_new_tasks_have_distinct_identity_and_strict_anchor_authority(self):
        for old, new in [(9, 11), (10, 12)]:
            a, b = [versioned_task(f"ava-prose-region-{version}") for version in [old, new]]
            self.assertNotEqual(a.task_id, b.task_id)
            self.assertEqual(a.image, b.image)
            self.assertEqual(a.source_sha256, b.source_sha256)
            numeric = style_span("2")
            numeric.update(anchor=None, start=1, end=2)
            with self.assertRaisesRegex(ValueError, "task version"):
                accept_response(b, response_for(b, [wire_segment(text="x2", spans=[numeric])]))

    def test_retained_invalid_response_shape_still_refuses_without_rewriting(self):
        # Same failure shape as the retained response: intrinsic digits, ASCII anchors.
        task = versioned_task("ava-prose-region-11")
        wire = wire_segment(
            text="Water is H₂O; the area is m².",
            spans=[style_span("2", "sub"), style_span("2", "super", after=".")],
        )
        before = copy.deepcopy(wire)
        with self.assertRaisesRegex(ValueError, "absent from exact text"):
            response_for(task, [wire])
        self.assertEqual(before, wire)

    def test_ordinary_digits_have_contextual_codepoint_offsets_and_style(self):
        text = "😀 x2 + y2."
        spans = [
            style_span("2", "sub", before="x", after=" +"),
            style_span("2", "super", before="y", after="."),
        ]
        for version in ["ava-prose-region-11", "ava-prose-region-12"]:
            task = versioned_task(version)
            response = response_for(task, [wire_segment(text=text, spans=spans)])
            observed = accept_response(task, response)[0]
            self.assertEqual(text, observed.text)
            self.assertEqual([(3, 4), (8, 9)], [(s.start, s.end) for s in observed.spans])
            self.assertEqual(["sub", "super"], [s.style.vertical_align for s in observed.spans])
            self.assertEqual(["2", "2"], [text[s.start : s.end] for s in observed.spans])
            self.assertIsNone(response.segments[0].spans[0].start)

    def test_absent_ambiguous_and_wrong_context_are_refused(self):
        task = versioned_task("ava-prose-region-11")
        for text, span, message in [
            ("x₂", style_span("2", "sub"), "absent"),
            ("x2 + y2.", style_span("2", "sub"), "Ambiguous"),
            ("x2 + y2.", style_span("2", "sub", before="X", after=" +"), "absent"),
            ("x2 + y2.", style_span("2", "sub", before="x", after="+"), "absent"),
        ]:
            with (
                self.subTest(text=text, span=span),
                self.assertRaisesRegex(ValueError, message),
            ):
                response_for(task, [wire_segment(text=text, spans=[span])])

    def test_intrinsic_unicode_marks_and_ligatures_remain_exact(self):
        text = "A₂B | ² | 😀 | é | ﬁ"
        spans = [style_span(char) for char in ["₂", "²", "😀", "é", "ﬁ"]]
        task = versioned_task("ava-prose-region-11")
        response = response_for(task, [wire_segment(text=text, spans=spans)])
        observed = accept_response(task, response)[0]
        self.assertEqual(text, observed.text)
        self.assertEqual(
            ["₂", "²", "😀", "é", "ﬁ"], [text[s.start : s.end] for s in observed.spans]
        )
        self.assertTrue(all(s.style.vertical_align is None for s in observed.spans))
        for quotation in ["2", "é", "fi", "☺"]:
            with (
                self.subTest(quotation=quotation),
                self.assertRaisesRegex(ValueError, "absent"),
            ):
                response_for(task, [wire_segment(text=text, spans=[style_span(quotation)])])

    def test_pinned_new_version_retains_source_cell_geometry(self):
        task, raw, source = pinned_fixture("ava-prose-region-12")
        cell = raw["segments"][0]["cells"][0][0]
        cell["spans"] = [style_span(cell["text"])]
        observed = accept_response(task, RecognitionResponse.model_validate(raw))[0]
        self.assertEqual(source.cells[0][0].box, observed.cells[0][0].box)
        self.assertEqual(source.cells[0][0].column_span, observed.cells[0][0].column_span)
        self.assertEqual(cell["text"], observed.cells[0][0].text)
        self.assertEqual(
            (0, len(cell["text"])),
            (observed.cells[0][0].spans[0].start, observed.cells[0][0].spans[0].end),
        )

    def test_new_prose_version_cannot_authorize_pinned_geometry(self):
        task, raw, _ = pinned_fixture("ava-prose-region-11")
        with self.assertRaises(ValueError):
            accept_response(task, RecognitionResponse.model_validate(raw))

    def test_new_task_factory_and_native_table_routing_select_current_versions(self):
        seed = task_fixture((0, 0, 20, 20))
        pixels = base64.b64decode(seed.image.base64)
        page = PageObservation(
            number=1,
            width_pt=20,
            height_pt=20,
            rotation=0,
            render_path="page.png",
            render_sha256=seed.image.sha256,
            render_width=4,
            render_height=8,
            lines=[],
            graphics=[],
            risks=[],
        )
        _, source = source_table()
        cells = [[source.cells[0][0].box, None], [source.cells[1][0].box, source.cells[1][1].box]]
        table = TableObservation(box=source.box, cells=cells, line_ids=[])
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            (scratch / page.render_path).write_bytes(pixels)
            prose = make_task(page, seed.source_sha256, seed.region_box, scratch)
            self.assertEqual("ava-prose-region-13", prose.prompt_version)
            with patch(
                "ava_pdf_epub.reconstruction_v2.route_native.native_page",
                side_effect=NativeReviewRequired("Authored ambiguous structure"),
            ):
                _, tasks = route_native(page, [table], [], seed.source_sha256, scratch)
            self.assertEqual(["ava-prose-region-14"], [task.prompt_version for task in tasks])
            evidence = json.loads(tasks[0].native_evidence)
            self.assertEqual(3, len(evidence["ruled_tables"][0]["cells"]))
            self.assertEqual(2, evidence["ruled_tables"][0]["cells"][0]["column_span"])
