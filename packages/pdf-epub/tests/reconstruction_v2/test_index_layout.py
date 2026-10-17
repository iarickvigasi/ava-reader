"""Index ambiguity selects one source-bound visual task, never a native text split."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from ava_pdf_epub.reconstruction_v2.index_layout import index_layout, mark_index_layout
from ava_pdf_epub.reconstruction_v2.index_prompt import INDEX_PROMPT, INDEX_PROMPT_VERSION
from ava_pdf_epub.reconstruction_v2.route_native import route_native
from ava_pdf_epub.reconstruction_v2.text_style_prompt import TEXT_STYLE_PROMPT

from .index_fixture import index_page
from .test_unicode_style_prompt import versioned_task


class IndexLayoutTests(unittest.TestCase):
    def test_explicit_heading_dense_rows_and_independent_columns_select_review(self):
        for header in ["General index", "Index", "216 General index", "Предметний покажчик 214"]:
            for fused in [False, True]:
                page = index_page(header=header, fused=fused, introduction=True)
                self.assertTrue(index_layout(page))
                changed = mark_index_layout(page)
                self.assertEqual(["native_index_layout"], changed.risks)
                self.assertEqual(page.lines, changed.lines)
                self.assertIs(changed, mark_index_layout(changed))

    def test_prose_contents_bibliography_and_uncorroborated_columns_do_not_select(self):
        for header in ["An index can be useful", "Contents", "Bibliography", "Chapter 2"]:
            self.assertFalse(index_layout(index_page(header=header)))
        page = index_page()
        self.assertFalse(index_layout(page.model_copy(update={"lines": page.lines[:5]})))
        self.assertFalse(
            index_layout(
                page.model_copy(
                    update={
                        "lines": [row for row in page.lines if not row.id.startswith("right")],
                    }
                )
            )
        )
        prose = [
            row.model_copy(update={"text": "A complete prose sentence ends here."})
            for row in page.lines[1:]
        ]
        self.assertFalse(index_layout(page.model_copy(update={"lines": [page.lines[0], *prose]})))

    def test_full_page_route_keeps_all_risks_and_uses_no_native_maps_or_reliable_rows(self):
        with tempfile.TemporaryDirectory() as d:
            page = index_page(fused=True)
            page = page.model_copy(update={"risks": ["language_uncertain", "unknown_source_risk"]})
            changed = mark_index_layout(page)
            self.assertEqual([*page.risks, "native_index_layout"], changed.risks)
            Image.new("RGB", (346, 582), "white").save(Path(d) / page.render_path)
            maps = []
            native, tasks = route_native(changed, [], [], "a" * 64, Path(d), source_line_maps=maps)
            self.assertEqual([], native)
            self.assertEqual([], maps)
            self.assertEqual(1, len(tasks))
            task = tasks[0]
            self.assertEqual("pdf_structure_repair", task.purpose)
            self.assertEqual(INDEX_PROMPT_VERSION, task.prompt_version)
            self.assertEqual(
                (0, 0, 346, 582),
                (task.region_box.x0, task.region_box.y0, task.region_box.x1, task.region_box.y1),
            )
            self.assertEqual({"reliable": False, "lines": []}, json.loads(task.native_evidence))

    def test_prompt_and_task_identity_are_new_without_rewriting_history(self):
        self.assertEqual(TEXT_STYLE_PROMPT, INDEX_PROMPT[: len(TEXT_STYLE_PROMPT)])
        before, after = [versioned_task(f"ava-prose-region-{v}") for v in [15, 17]]
        self.assertNotEqual(before.task_id, after.task_id)
        self.assertEqual(before.image, after.image)
        self.assertEqual(
            hashlib.sha256(before.native_evidence.encode()).hexdigest(),
            after.native_evidence_sha256,
        )
