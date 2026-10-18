"""Use the real PDF parser/frame and current index route before projecting source boxes."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.native_layout_policy import NATIVE_LAYOUT_POLICY
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_from_source
from ava_pdf_epub.reconstruction_v2.project_index_pages import project_index_pages
from ava_pdf_epub.reconstruction_v2.segments import Segment
from ava_pdf_epub.reconstruction_v2.source_feature_contract import FEATURE_POLICY
from ava_pdf_epub.reconstruction_v2.source_preparation import SourcePreparation

from .index_pdf_fixture import index_pdf
from .test_pdf_links import box


class IndexProjectionSourceTests(unittest.TestCase):
    def test_real_source_frame_projects_only_current_policy_without_provider_calls(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            source = index_pdf(root / "source.pdf")
            with SourcePreparation(
                source,
                root / "scratch",
                BILINGUAL_PROFILE,
                source_layout_policy=NATIVE_LAYOUT_POLICY,
                source_feature_policy=FEATURE_POLICY,
            ) as preparation:
                checkpoint = prepare_from_source(preparation, 2)
                page = checkpoint.observation
                rows = sorted(
                    [r for r in page.lines if r.box.y0 > min(row.box.y1 for row in page.lines)],
                    key=lambda r: (r.box.x0 > page.width_pt / 2, r.box.y0),
                )
                self.assertEqual(16, len(rows))
                task = checkpoint.tasks[0]
                owners = [
                    Segment(
                        id=f"page2-{task.task_id[10:22]}-{i}",
                        page=2,
                        method="ocr",
                        kind="paragraph",
                        text=row.text,
                        box=box(250, 250, 300, 260),
                    )
                    for i, row in enumerate(rows)
                ]
                original = [s.model_dump_json() for s in owners]
                state = AssemblyState(source_continuation_policy=POLICY)
                output = project_index_pages(source, [checkpoint], {2: owners}, state)
                self.assertEqual(16, len(state.source_index_projections[2].entries))
                self.assertEqual(original, [s.model_dump_json() for s in owners])
                self.assertNotEqual(owners[0].box, output[2][0].box)
                historical = AssemblyState()
                self.assertEqual(
                    {2: owners}, project_index_pages(source, [checkpoint], {2: owners}, historical)
                )
                self.assertEqual({}, historical.source_index_projections)
