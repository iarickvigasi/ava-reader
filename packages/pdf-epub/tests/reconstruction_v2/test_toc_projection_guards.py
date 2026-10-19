"""Missing, extra, reordered or hidden content must decline the complete page atomically."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.project_toc_pages import project_toc_pages

from .test_ocr_link_context import line
from .test_pdf_links import box
from .toc_projection_fixture import projection_case


class TocProjectionGuardTests(unittest.TestCase):
    def test_owner_or_source_coverage_error_preserves_every_raw_box(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            f = projection_case(root)
            self.addCleanup(f.reader.close)
            owners, page = f.owners, f.page
            bad_glyphs = [
                {"visible": False},
                {"source_artifact": True},
                {"box": box(20, 20, 24, 30).model_copy(update={"x1": 20})},
                {"text": "А"},
                {"box": box(119, 20, 123, 30)},
            ]
            pages = [
                page.model_copy(update={"lines": [*page.lines, line("orphan", "Extra", 1, 89)]}),
                page.model_copy(update={"lines": [*page.lines, page.lines[0]]}),
                page.model_copy(update={"lines": page.lines[1:]}),
                page.model_copy(update={"risks": ["unknown"]}),
            ]
            for change in bad_glyphs:
                first = page.lines[1]
                changed = first.model_copy(
                    update={
                        "glyphs": [first.glyphs[0].model_copy(update=change), *first.glyphs[1:]]
                    }
                )
                pages.append(
                    page.model_copy(update={"lines": [page.lines[0], changed, *page.lines[2:]]})
                )
            owner_sets = [
                owners[:-1],
                [*owners, owners[-1]],
                list(reversed(owners)),
                [owners[0].model_copy(update={"kind": "furniture"}), *owners[1:]],
            ]
            for text in ["Next", "Next 22", "Nеxt 2", "Next 3", "Next 2 extra"]:
                owner_sets.append(
                    [*owners[:2], owners[2].model_copy(update={"text": text}), owners[3]]
                )
            for observed, values in [(p, owners) for p in pages] + [(page, v) for v in owner_sets]:
                with self.subTest(text=[o.text for o in values], risks=observed.risks):
                    state = AssemblyState(source_continuation_policy=POLICY)
                    raw = {1: values}
                    result = project_toc_pages(
                        f.source,
                        root,
                        [f.checkpoint.model_copy(update={"observation": observed})],
                        raw,
                        state,
                    )
                    self.assertEqual(raw, result)
                    self.assertEqual([], state.structure_findings)
            self.assertFalse((root / "toc-projections").exists())

    def test_legacy_policy_source_frame_or_task_identity_has_no_authority(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            f = projection_case(root)
            self.addCleanup(f.reader.close)
            task, checkpoint = f.checkpoint.tasks[0], f.checkpoint
            changes = [
                {"source_sha256": "b" * 64},
                {"source_byte_length": 1},
                {"source_page_count": 1},
                {"source_layout_policy": None},
                {"tasks": []},
                {"tasks": [task, task]},
                {"tasks": [task.model_copy(update={"task_id": "recognize-" + "b" * 64})]},
                {"tasks": [task.model_copy(update={"prompt_version": "ava-prose-region-1"})]},
                {"observation": f.page.model_copy(update={"width_pt": 121})},
            ]
            for updated, policy in [(c, POLICY) for c in changes] + [({}, None)]:
                with self.subTest(updated=updated, policy=policy):
                    state = AssemblyState(source_continuation_policy=policy)
                    result = project_toc_pages(
                        f.source,
                        root,
                        [checkpoint.model_copy(update=updated)],
                        {1: f.owners},
                        state,
                    )
                    self.assertEqual({1: f.owners}, result)
                    self.assertEqual([], state.structure_findings)
