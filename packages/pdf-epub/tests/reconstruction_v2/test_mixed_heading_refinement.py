"""Mixed ancestry reaches source review, never guessed rank or mutable native typography."""

import copy
import hashlib
import io
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.apply_refinement import apply_refinement
from ava_pdf_epub.reconstruction_v2.prepare_refinement_source import prepare_refinement_source
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.protocol import ReconstructionInput
from ava_pdf_epub.reconstruction_v2.reconstruct_source import reconstruct_source
from ava_pdf_epub.reconstruction_v2.refinement_contract import BookRefinementTask, RefinementStyle
from ava_pdf_epub.reconstruction_v2.refinement_identity import refinement_identifier
from ava_pdf_epub.reconstruction_v2.refinement_response import accept_refinement
from ava_pdf_epub.reconstruction_v2.source_segments import source_segments

from .mixed_heading_fixtures import (
    CHAPTER,
    NATIVE_SECTION,
    OCR_SECTION,
    decisions,
    recognition,
    source_pdf,
)


class MixedHeadingRefinement(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = source_pdf(self.root)
        self.digest = hashlib.sha256(self.source.read_bytes()).hexdigest()
        self.pages = prepare_source(self.source, self.root / "pages", self.digest)
        self.ocr = recognition(self.pages[1].tasks[0])
        self.request = ReconstructionInput(
            schema_version="ava-reconstruct-input-1",
            source_sha256=self.digest,
            responses=[self.ocr],
        )
        self.batch = prepare_refinement_source(self.source, self.root / "refinement", self.request)
        self.receipts = decisions(self.batch.tasks)

    def test_preparation_requires_explicit_native_ancestry_decision_and_keeps_observations(self):
        _, segments, state = source_segments(
            self.source, self.root / "pages", self.pages, [self.ocr]
        )
        native = next(s for s in segments if s.text == NATIVE_SECTION)
        task = next(t for t in self.batch.tasks if native.id in t.decision_ids)
        node = next(n for n in task.nodes if n.id == native.id)
        self.assertEqual("heading", node.candidate_original_kind)
        self.assertTrue(node.structure_candidate)
        self.assertFalse(node.ranked_source)
        self.assertEqual("ava-book-refinement-6", task.prompt_version)
        self.assertTrue(
            any(
                f.block_id == native.id
                and f.severity == "blocking"
                and f.code == "MIXED_NATIVE_HIERARCHY_UNCORROBORATED"
                for f in state.structure_findings
            )
        )
        self.assertTrue(
            {OCR_SECTION, NATIVE_SECTION}.issubset(
                {n.text_excerpt for n in task.nodes if n.id in {c.node_id for c in task.crops}}
            )
        )
        before = copy.deepcopy(segments)
        refined = apply_refinement(segments, self.batch.tasks, self.receipts, state)
        actual = next(s for s in refined if s.id == native.id)
        self.assertEqual(before, segments)
        self.assertEqual(
            (native.text, native.source_text, native.style, native.spans, native.method),
            (actual.text, actual.source_text, actual.style, actual.spans, actual.method),
        )
        self.assertEqual(2, actual.heading_level)
        self.assertFalse(actual.structure_candidate)
        self.assertEqual([], state.structure_findings)

    def test_final_complete_decisions_emit_sibling_h2_and_toc_under_one_chapter(self):
        request = self.request.model_copy(update={"refinements": self.receipts})
        result, report = reconstruct_source(self.source, self.root / "final", request)
        self.assertEqual([CHAPTER], [c.title for c in result.book.chapters])
        headings = {b.content.text: b for b in result.book.blocks if b.kind == "heading"}
        self.assertEqual([2, 2], [headings[text].level for text in [OCR_SECTION, NATIVE_SECTION]])
        self.assertTrue(
            all(t.parent_id for t in result.book.toc if t.label in {OCR_SECTION, NATIVE_SECTION})
        )
        self.assertEqual([], report.findings)
        with zipfile.ZipFile(io.BytesIO(result.epub)) as archive:
            texts = [p for p in archive.namelist() if p.startswith("EPUB/text/")]
            self.assertEqual(1, len(texts))
            html = ET.fromstring(archive.read(texts[0]))
            self.assertEqual(
                [OCR_SECTION, NATIVE_SECTION],
                ["".join(h.itertext()) for h in html.iter("{http://www.w3.org/1999/xhtml}h2")],
            )

    def test_missing_or_unresolved_decisions_cannot_reconstruct(self):
        for receipts in [
            [],
            [r.model_copy(update={"unresolved": [NATIVE_SECTION]}) for r in self.receipts],
        ]:
            with self.assertRaisesRegex(ValueError, "coverage|unresolved"):
                reconstruct_source(
                    self.source,
                    self.root / f"refused-{len(receipts)}",
                    self.request.model_copy(update={"refinements": receipts}),
                )

    def test_native_rank_decision_cannot_demote_heading_or_change_typography_or_parent(self):
        task = next(
            t
            for t in self.batch.tasks
            if any(
                n.candidate_original_kind == "heading" and n.id in t.decision_ids for n in t.nodes
            )
        )
        receipt = next(r for r in self.receipts if r.task_id == task.task_id)
        native_id = next(n.id for n in task.nodes if n.candidate_original_kind == "heading")
        for change in [
            {"role_kind": "paragraph"},
            {"style": RefinementStyle(id="observed", relative_size=1, bold=False)},
            {"parent_id": native_id},
        ]:
            altered = receipt.model_copy(
                update={
                    "decisions": [
                        d.model_copy(update=change) if d.node_id == native_id else d
                        for d in receipt.decisions
                    ]
                }
            )
            with self.assertRaises(ValueError):
                accept_refinement(task, altered)
        old_version = task.model_dump(mode="json")
        old_version["prompt_version"] = "ava-book-refinement-5"
        old_version["task_id"] = refinement_identifier(old_version)
        with self.assertRaisesRegex(ValueError, "versioned heading contract"):
            BookRefinementTask.model_validate(old_version)

    def test_source_backed_native_child_and_skipped_parent_guard(self):
        other = self.root / "nested"
        other.mkdir()
        source = source_pdf(other, ocr_size=18)
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        pages = prepare_source(source, other / "pages", digest)
        response = recognition(pages[1].tasks[0], heading_size=18)
        request = self.request.model_copy(update={"source_sha256": digest, "responses": [response]})
        batch = prepare_refinement_source(source, other / "refinement", request)
        receipts = decisions(batch.tasks, native_level=3, ocr_size=18)
        result, _ = reconstruct_source(
            source, other / "valid", request.model_copy(update={"refinements": receipts})
        )
        native = next(
            b
            for b in result.book.blocks
            if b.kind == "heading" and b.content.text == NATIVE_SECTION
        )
        self.assertEqual(3, native.level)
        native_ids = {
            n.id for t in batch.tasks for n in t.nodes if n.candidate_original_kind == "heading"
        }
        skipped = [
            r.model_copy(
                update={
                    "decisions": [
                        d.model_copy(update={"heading_level": 4}) if d.node_id in native_ids else d
                        for d in r.decisions
                    ]
                }
            )
            for r in receipts
        ]
        with self.assertRaisesRegex(ValueError, "skips an observed parent"):
            reconstruct_source(
                source, other / "invalid", request.model_copy(update={"refinements": skipped})
            )

    def test_explicit_outline_rank_keeps_native_heading_fixed(self):
        other = self.root / "outline"
        other.mkdir()
        source = source_pdf(other, outline=True)
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        pages = prepare_source(source, other / "pages", digest)
        response = recognition(pages[1].tasks[0])
        request = self.request.model_copy(update={"source_sha256": digest, "responses": [response]})
        batch = prepare_refinement_source(source, other / "refinement", request)
        native = next(s for s in pages[2].native_segments if s.text == NATIVE_SECTION)
        self.assertFalse(any(native.id in t.decision_ids for t in batch.tasks))
        self.assertTrue(all(t.prompt_version == "ava-book-refinement-5" for t in batch.tasks))
