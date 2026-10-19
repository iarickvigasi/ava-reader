"""Unverified OCR ranks reach source crops and stay blocked until reviewed."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.prepare_refinement_source import prepare_refinement_source
from ava_pdf_epub.reconstruction_v2.reconstruct_source import reconstruct_source
from ava_pdf_epub.reconstruction_v2.source_segments import source_segments

from .mixed_heading_fixtures import CHAPTER, NATIVE_SECTION, OCR_SECTION, decisions
from .provisional_heading_fixture import provisional_case


class ProvisionalHeadingReview(unittest.TestCase):
    def test_invalid_page_local_ranks_preserve_observation_and_reach_real_source_review(self):
        for level in (1, 3, 4):
            with self.subTest(level=level), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                source, pages, request = provisional_case(root, level)
                before = request.model_dump_json()
                _, segments, state = source_segments(
                    source, root / "pages", pages, request.responses
                )
                ocr = next(s for s in segments if s.text == OCR_SECTION)
                self.assertEqual(level, ocr.heading_level)
                self.assertFalse(ocr.structure_candidate)
                self.assertTrue(
                    any(
                        f.block_id == ocr.id
                        and f.severity == "blocking"
                        and f.code == "OCR_HIERARCHY_UNCORROBORATED"
                        for f in state.structure_findings
                    )
                )
                batch = prepare_refinement_source(source, root / "review", request)
                node = next(n for t in batch.tasks for n in t.nodes if n.id == ocr.id)
                self.assertEqual(level, node.observed_level)
                self.assertFalse(node.structure_candidate or node.ranked_source)
                self.assertTrue(any(c.node_id == ocr.id for t in batch.tasks for c in t.crops))
                reviewed = request.model_copy(update={"refinements": decisions(batch.tasks)})
                result, report = reconstruct_source(source, root / "final", reviewed)
                self.assertEqual([CHAPTER], [c.title for c in result.book.chapters])
                headings = {
                    b.content.text: b.level for b in result.book.blocks if b.kind == "heading"
                }
                self.assertEqual([2, 2], [headings[OCR_SECTION], headings[NATIVE_SECTION]])
                self.assertEqual([], report.findings)
                self.assertEqual(before, request.model_dump_json())

    def test_missing_refinement_cannot_finish_a_provisional_heading(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, _, request = provisional_case(root)
            with self.assertRaisesRegex(ValueError, "coverage|refinement"):
                reconstruct_source(source, root / "refused", request)
