"""Complete TOC source geometry must precede canonical evidence and actual review crops."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assemble_pages import assemble_pages
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.geometry import union
from ava_pdf_epub.reconstruction_v2.project_toc_pages import project_toc_pages
from ava_pdf_epub.reconstruction_v2.refinement_sheet import refinement_sheet

from .toc_projection_fixture import projection_case


class TocProjectionTests(unittest.TestCase):
    def test_projection_preserves_raw_and_passes_ordinary_callers_and_real_crops(self):
        for roman, merged in [(False, False), (True, False), (False, True), (True, True)]:
            with self.subTest(roman=roman, merged=merged), tempfile.TemporaryDirectory() as d:
                directory = Path(d)
                f = projection_case(directory, roman=roman, merged=merged)
                self.addCleanup(f.reader.close)
                raw = [s.model_dump_json() for s in f.owners]
                checkpoint = f.checkpoint.model_dump_json()
                state = AssemblyState(source_continuation_policy=POLICY)
                current = project_toc_pages(
                    f.source, directory, [f.checkpoint], {1: f.owners}, state
                )
                self.assertIsNot(current[1], f.owners)
                self.assertEqual(raw, [s.model_dump_json() for s in f.owners])
                self.assertEqual(checkpoint, f.checkpoint.model_dump_json())
                self.assertEqual(1, len(state.structure_findings))
                self.assertEqual(1, len(list((directory / "toc-projections").glob("*.json"))))
                for original, owner in zip(f.owners, current[1], strict=True):
                    self.assertEqual(
                        original.model_dump(exclude={"box"}), owner.model_dump(exclude={"box"})
                    )
                self.assertEqual(
                    [(f.owners[1].id, 0, len(f.owners[1].text))], f.prove(owners=current[1])
                )
                pages, assembled = assemble_pages([f.checkpoint], current, state)
                crops, _ = refinement_sheet(
                    [s.id for s in assembled], state.segments, {1: f.checkpoint}, directory
                )
                for owner, crop in zip(assembled, crops, strict=True):
                    self.assertEqual(owner.box.model_dump(), state.evidence[owner.id][0]["box"])
                    self.assertIn(owner.box.model_dump(), [r["box"] for r in pages[0]["regions"]])
                    self.assertLessEqual(crop.source_box.x0, owner.box.x0)
                    self.assertGreaterEqual(crop.source_box.y1, owner.box.y1)
                    self.assertNotEqual(crop.source_box, f.owners[0].box)
                self.assertEqual(union([g.box for g in f.page.lines[0].glyphs]), current[1][0].box)
                again = project_toc_pages(f.source, directory, [f.checkpoint], {1: f.owners}, state)
                self.assertEqual(current, again)
                self.assertEqual(1, len(list((directory / "toc-projections").glob("*.json"))))
