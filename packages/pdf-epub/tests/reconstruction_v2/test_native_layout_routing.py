"""Source geometry, exact ornament offsets and strict legacy/uncertain routing."""

import hashlib
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.pdf_navigation import NavigationTarget
from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.attempt_stream import _input, initial_input
from ava_pdf_epub.reconstruction_v2.conservation import native_conservation
from ava_pdf_epub.reconstruction_v2.furniture import furniture_ids
from ava_pdf_epub.reconstruction_v2.line_spans import line_spans
from ava_pdf_epub.reconstruction_v2.native_layout_policy import NATIVE_LAYOUT_POLICY
from ava_pdf_epub.reconstruction_v2.native_page import native_page
from ava_pdf_epub.reconstruction_v2.native_review import NativeReviewRequired
from ava_pdf_epub.reconstruction_v2.pdf_links import glyph_ranges, page_target
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.prepared_native_layout import NativeLayoutPreparedPage
from ava_pdf_epub.reconstruction_v2.protocol import prepared_result, reconstruction_input
from ava_pdf_epub.reconstruction_v2.qualify_pages import qualify_pages
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.source_feature_contract import FEATURE_POLICY
from tests.reconstruction_v2.native_layout_fixture import BODY, contents_document, document


class NativeLayoutRoutingTests(unittest.TestCase):
    def source(self, source_layout_policy=None, **options):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        source = document(root / "source.pdf", **options)
        pages = prepare_source(
            source,
            root / "scratch",
            hashlib.sha256(source.read_bytes()).hexdigest(),
            BILINGUAL_PROFILE,
            source_feature_policy=FEATURE_POLICY,
            source_layout_policy=source_layout_policy,
        )
        furniture = furniture_ids((p.observation for p in pages), BILINGUAL_PROFILE)
        return source, pages, furniture

    def test_contents_rows_keep_wrapped_title_folio_and_source_targets(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        source = contents_document(root / "source.pdf")
        pages = prepare_source(
            source,
            root / "scratch",
            hashlib.sha256(source.read_bytes()).hexdigest(),
            BILINGUAL_PROFILE,
            source_feature_policy=FEATURE_POLICY,
            source_layout_policy=NATIVE_LAYOUT_POLICY,
        )
        self.assertEqual([], pages[0].tasks)
        self.assertEqual(3, sum(s.preserve_line_breaks for s in pages[0].native_segments))
        result = reconstruct(
            source,
            root / "scratch",
            pages,
            [],
            [],
            source_feature_policy=FEATURE_POLICY,
            source_layout_policy=NATIVE_LAYOUT_POLICY,
        )
        texts = [b.content.text for b in result.book.blocks if hasattr(b, "content")]
        self.assertIn("Chapter One and its honest ending 1", texts)
        self.assertIn("Chapter Two 2", texts)
        self.assertIn("Chapter Three 3", texts)
        self.assertEqual(
            3,
            sum(
                bool(span.link)
                for b in result.book.blocks
                if hasattr(b, "content")
                for span in b.content.spans
            ),
        )

    def test_ambiguous_contents_row_keeps_existing_visual_review(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        source = contents_document(root / "source.pdf", ambiguous=True)
        pages = prepare_source(
            source,
            root / "scratch",
            hashlib.sha256(source.read_bytes()).hexdigest(),
            BILINGUAL_PROFILE,
            source_feature_policy=FEATURE_POLICY,
            source_layout_policy=NATIVE_LAYOUT_POLICY,
        )
        self.assertTrue(pages[0].tasks)
        self.assertFalse(pages[0].native_line_maps)

    def test_explicit_complete_preparation_keeps_policy_and_exact_maps_with_zero_tasks(self):
        source, pages, _ = self.source(source_layout_policy=NATIVE_LAYOUT_POLICY)
        self.assertTrue(all(isinstance(p, NativeLayoutPreparedPage) for p in pages))
        self.assertTrue(all(not p.tasks for p in pages))
        self.assertTrue(
            all(prepared_result(p).schema_version == "ava-prepare-result-2" for p in pages)
        )
        mappings = {}
        qualified = qualify_pages(
            source,
            source.parent / "scratch",
            pages,
            [],
            source_layout_policy=NATIVE_LAYOUT_POLICY,
            source_line_maps=mappings,
        )
        self.assertEqual(30, len(mappings))
        self.assertTrue(all(any(s.text == "* * *" for s in local) for local in qualified.values()))
        with self.assertRaisesRegex(ValueError, "layout policy"):
            qualify_pages(source, source.parent / "scratch", pages, [])
        result = reconstruct(
            source,
            source.parent / "scratch",
            pages,
            [],
            [],
            source_feature_policy=FEATURE_POLICY,
            source_layout_policy=NATIVE_LAYOUT_POLICY,
        )
        self.assertEqual(
            3, sum(b.content.text == "* * *" for b in result.book.blocks if hasattr(b, "content"))
        )

    def test_private_checkpoint_refuses_overlapping_ocr_foreign_or_duplicate_owners(self):
        _, pages, _ = self.source(source_layout_policy=NATIVE_LAYOUT_POLICY)
        raw = pages[0].model_dump()
        ornament_id = next(s["id"] for s in raw["native_segments"] if s["text"] == "* * *")
        first = next(m for m in raw["native_line_maps"] if m["segment_id"] == ornament_id)
        for field, value in (("method", "ocr"), ("method", "render"), ("page", 2)):
            bad = pages[0].model_dump()
            owner = next(s for s in bad["native_segments"] if s["id"] == first["segment_id"])
            owner[field] = value
            with self.assertRaises(ValueError):
                NativeLayoutPreparedPage.model_validate(bad)
        bad = pages[0].model_dump()
        ornament_maps = [m for m in bad["native_line_maps"] if m["segment_id"] == ornament_id]
        ornament_maps[1].update(start=0, end=1)
        with self.assertRaises(ValueError):
            NativeLayoutPreparedPage.model_validate(bad)
        bad = pages[0].model_dump()
        ornament_maps = [m for m in bad["native_line_maps"] if m["segment_id"] == ornament_id]
        ornament_maps[0].update(start=4, end=5)
        ornament_maps[2].update(start=0, end=1)
        with self.assertRaises(ValueError):
            NativeLayoutPreparedPage.model_validate(bad)
        bad = pages[0].model_dump()
        bad["native_line_maps"].pop()
        with self.assertRaises(ValueError):
            NativeLayoutPreparedPage.model_validate(bad)
        bad = pages[0].model_dump()
        bad["native_line_maps"] = []
        with self.assertRaises(ValueError):
            NativeLayoutPreparedPage.model_validate(bad)
        for method in ("native", "render"):
            bad = pages[0].model_dump()
            bad["native_line_maps"] = [
                m for m in bad["native_line_maps"] if m["segment_id"] != ornament_id
            ]
            owner = next(s for s in bad["native_segments"] if s["id"] == ornament_id)
            owner.update(native_line_ids=[], method=method)
            with self.assertRaises(ValueError):
                NativeLayoutPreparedPage.model_validate(bad)
        bad = pages[0].model_dump()
        bad["native_segments"].append(bad["native_segments"][0])
        with self.assertRaises(ValueError):
            NativeLayoutPreparedPage.model_validate(bad)

    def test_input3_initial_empty_receipts_keeps_explicit_policy(self):
        request = reconstruction_input(
            dict(
                schema_version="ava-reconstruct-input-3",
                source_layout_policy=NATIVE_LAYOUT_POLICY,
                source_feature_policy=FEATURE_POLICY,
                source_sha256="0" * 64,
                profile_id=BILINGUAL_PROFILE,
                responses=[],
                refinements=[],
            )
        )
        self.assertEqual(NATIVE_LAYOUT_POLICY, request.source_layout_policy)
        initial = initial_input(
            json_bytes({"mode": "attempt_stream", "input": request.model_dump()})
        )
        self.assertEqual("ava-reconstruct-input-3", _input(initial, [], []).schema_version)
        raw = request.model_dump()
        raw.pop("source_layout_policy")
        with self.assertRaises(ValueError):
            reconstruction_input(raw)

    def test_qualified_ornament_preserves_source_text_styles_and_exact_repeated_offsets(self):
        source, pages, furniture = self.source()
        for page in pages:
            mappings = []
            content = native_page(
                page.observation,
                page.tables,
                furniture,
                [],
                BILINGUAL_PROFILE,
                source_layout_policy=NATIVE_LAYOUT_POLICY,
                source_line_maps=mappings,
            )
            native_conservation(page.observation, content, [])
            ornament = next(s for s in content if s.text == "* * *")
            mappings = [m for m in mappings if m.segment_id == ornament.id]
            self.assertEqual("paragraph", ornament.kind)
            self.assertEqual("center", ornament.style.align)
            self.assertIsNone(ornament.style.color)
            self.assertIsNone(ornament.style.block_indent_em)
            self.assertTrue(ornament.preserve_line_breaks)
            self.assertEqual([0, 2, 4], [m.start for m in mappings])
            self.assertEqual([1, 3, 5], [m.end for m in mappings])
            by_line = {m.line_id: m for m in mappings}
            source_lines = {line.id: line for line in page.observation.lines}
            for mapping in mappings:
                original = source_lines[mapping.line_id]
                self.assertEqual(original.text, ornament.text[mapping.start : mapping.end])
                self.assertTrue(
                    any(s.start == mapping.start and s.end == mapping.end for s in ornament.spans)
                )
                actual = [s for s in ornament.spans if mapping.start <= s.start < mapping.end]
                expected = [
                    s.model_copy(
                        update={"start": s.start + mapping.start, "end": s.end + mapping.start}
                    )
                    for s in line_spans(original)
                ]
                self.assertEqual(expected, actual)
                self.assertEqual(
                    [(ornament.id, mapping.start, mapping.end)],
                    glyph_ranges(page.observation, content, original.box, source_line_maps=by_line),
                )
            text = " ".join(s.text for s in content)
            for sentence in BODY:
                self.assertIn(sentence, text)
        first = pages[0]
        mappings = []
        content = native_page(
            first.observation,
            first.tables,
            furniture,
            [],
            BILINGUAL_PROFILE,
            source_layout_policy=NATIVE_LAYOUT_POLICY,
            source_line_maps=mappings,
        )
        mappings = [
            m
            for m in mappings
            if m.end - m.start == 1
            and content[[s.id for s in content].index(m.segment_id)].text == "* * *"
        ]
        self.assertEqual(
            (mappings[1].segment_id, 2),
            page_target(
                NavigationTarget(page=1, top=350, left=171),
                content,
                PdfReader(source),
                first.observation,
                source_line_maps={m.line_id: m for m in mappings},
            ),
        )

    def test_no_policy_preserves_the_original_source_review(self):
        _, pages, furniture = self.source()
        self.assertTrue(all(p.tasks for p in pages))
        for page in pages:
            with self.assertRaises(NativeReviewRequired):
                native_page(page.observation, page.tables, furniture, [], BILINGUAL_PROFILE)

    def test_unknown_paint_cannot_authorize_the_layout_correction(self):
        _, pages, furniture = self.source()
        original = pages[0].observation
        unknown = original.model_copy(
            update={
                "lines": [
                    line.model_copy(
                        update={
                            "glyphs": [
                                g.model_copy(update={"paint_ink_color": None}) for g in line.glyphs
                            ]
                        }
                    )
                    for line in original.lines
                ]
            }
        )
        with self.assertRaises(NativeReviewRequired):
            native_page(
                unknown,
                pages[0].tables,
                furniture,
                [],
                BILINGUAL_PROFILE,
                source_layout_policy=NATIVE_LAYOUT_POLICY,
                source_line_maps=[],
            )

    def test_disagreeing_ornament_style_stays_reviewed(self):
        _, pages, furniture = self.source(different_style=True)
        for page in pages:
            with self.assertRaises(NativeReviewRequired):
                native_page(
                    page.observation,
                    page.tables,
                    furniture,
                    [],
                    BILINGUAL_PROFILE,
                    source_layout_policy=NATIVE_LAYOUT_POLICY,
                    source_line_maps=[],
                )

    def test_math_expression_keeps_existing_review_and_receipt_identity(self):
        _, pages, _ = self.source(source_layout_policy=NATIVE_LAYOUT_POLICY, math=True)
        self.assertTrue(all(p.tasks and not p.native_line_maps for p in pages))
        self.assertTrue(all(t.purpose == "pdf_structure_repair" for p in pages for t in p.tasks))

    def test_hidden_glyph_does_not_become_a_qualified_row(self):
        _, pages, furniture = self.source(hidden=True)
        for page in pages:
            self.assertTrue(page.observation.risks)
            self.assertTrue(page.tasks)
            mappings = []
            self.assertEqual(
                [],
                native_page(
                    page.observation,
                    page.tables,
                    furniture,
                    [t.region_box for t in page.tasks],
                    BILINGUAL_PROFILE,
                    source_layout_policy=NATIVE_LAYOUT_POLICY,
                    source_line_maps=mappings,
                ),
            )
            self.assertEqual([], mappings)

    def test_true_columns_keep_left_then_right_order(self):
        _, pages, furniture = self.source(columns=True)
        for page in pages:
            mappings = []
            content = native_page(
                page.observation,
                page.tables,
                furniture,
                [],
                BILINGUAL_PROFILE,
                source_layout_policy=NATIVE_LAYOUT_POLICY,
                source_line_maps=mappings,
            )
            native_conservation(page.observation, content, [])
            text = " ".join(s.text for s in content)
            for i in range(5):
                self.assertLess(text.index(f"Left row {i}."), text.index(f"Right row {i}."))
            self.assertLess(text.index("Left row 4."), text.index("Right row 0."))


if __name__ == "__main__":
    unittest.main()
