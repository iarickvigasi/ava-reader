"""Whole-page native qualification conserves source bytes and established OCR fallback."""

import base64
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.native_structure_contract import NativeStructureTask
from ava_pdf_epub.reconstruction_v2.observations import Graphic
from ava_pdf_epub.reconstruction_v2.observe_tables import TableObservation
from ava_pdf_epub.reconstruction_v2.prepared_native_structure import NativeStructurePreparedPage
from ava_pdf_epub.reconstruction_v2.qualify_native_structure import qualify_native_structure
from ava_pdf_epub.reconstruction_v2.segments import Segment

from .native_structure_decision_fixture import box, line
from .native_structure_routing_fixture import checkpoint, stored

POLICY = "ava-native-structure-1"


class NativeStructureRouting(unittest.TestCase):
    def test_single_column_keeps_multiline_region_exact_original_bytes_and_furniture(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            lines = [
                line("p1-line0", "First ordinary source line.", y=120),
                line("p1-line1", "Second ordinary source line.", y=140),
                line("p1-folio", "17", y=760),
            ]
            original = checkpoint(scratch, lines)
            self.assertNotEqual(original.tasks[0].image.sha256, original.observation.render_sha256)
            pages = stored(scratch, [original])
            qualify_native_structure(pages, scratch, POLICY)
            result = pages[0]
            self.assertIsInstance(result, NativeStructurePreparedPage)
            self.assertEqual(result.observation.model_dump(), original.observation.model_dump())
            self.assertEqual(result.native_line_maps, original.native_line_maps)
            self.assertEqual(len(result.tasks), 1)
            task = result.tasks[0]
            self.assertIsInstance(task, NativeStructureTask)
            self.assertEqual(
                base64.b64decode(task.image.base64),
                (scratch / original.observation.render_path).read_bytes(),
            )
            self.assertEqual(task.image.sha256, original.observation.render_sha256)
            self.assertEqual(
                [(r.source.role, r.line_ids) for r in task.regions],
                [("content", ["p1-line0", "p1-line1"]), ("furniture", ["p1-folio"])],
            )
            before = (pages.root / "page-0001.json").read_bytes()
            qualify_native_structure(pages, scratch, POLICY)
            self.assertEqual((pages.root / "page-0001.json").read_bytes(), before)

    def test_two_columns_consolidate_each_source_column_without_interleaving(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            left = [line("p1-left0", "Left first.", y=120), line("p1-left1", "Left second.", y=140)]
            right = [
                line("p1-right0", "Right first.", x=330, y=120),
                line("p1-right1", "Right second.", x=330, y=140),
            ]
            pages = stored(scratch, [checkpoint(scratch, [left[0], right[0], left[1], right[1]])])
            qualify_native_structure(pages, scratch, POLICY)
            task = pages[0].tasks[0]
            self.assertIsInstance(task, NativeStructureTask)
            self.assertEqual(
                [(r.source.band, r.source.column, r.line_ids) for r in task.regions],
                [(0, 1, ["p1-left0", "p1-left1"]), (0, 2, ["p1-right0", "p1-right1"])],
            )

    def test_source_hyphen_candidates_retain_full_pair_authority_without_classification(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            lines = [
                line("p1-line0", "An ordinary trans-", y=120),
                line("p1-line1", "cription continues.", y=140),
            ]
            pages = stored(scratch, [checkpoint(scratch, lines)])
            qualify_native_structure(pages, scratch, POLICY)
            result = pages[0]
            self.assertIsInstance(result.tasks[0], NativeStructureTask)
            self.assertEqual(len(result.layout_hyphen_candidates), 1)
            candidate = result.layout_hyphen_candidates[0]
            self.assertEqual(candidate.left.line_id, "p1-line0")
            self.assertEqual(candidate.right.line_id, "p1-line1")
            self.assertEqual(result.tasks[0].boundaries[0].candidate_id, candidate.id)
            self.assertEqual(result.observation.lines[0].text, "An ordinary trans-")

    def test_unsafe_glyph_graphic_table_and_ambiguous_order_keep_original_tasks(self):
        base = [
            line("p1-line0", "Original body.", y=120),
            line("p1-line1", "Continued body.", y=140),
        ]
        hidden = base[0].model_copy(
            update={"glyphs": [base[0].glyphs[0].model_copy(update={"visible": False})]}
        )
        table = TableObservation(
            box=box(40, 120, 170, 150),
            cells=[[box(40, 120, 170, 130)], [box(40, 140, 170, 150)]],
            line_ids=[source.id for source in base],
            ruled=False,
        )
        columns = [
            line("p1-left", "Left.", y=120),
            line("p1-right", "Right.", x=330, y=120),
            line("p1-wide", "Spanning content crosses the middle.", x=200, y=120),
        ]
        cases = [
            dict(lines=[hidden, base[1]]),
            dict(lines=base, risks=["clipped_glyph"]),
            dict(lines=base, graphics=[Graphic(box=base[0].box, kind="image")]),
            dict(lines=base, tables=[table]),
            dict(lines=columns),
            dict(lines=[base[0], line("p1-overlap", "Overlap.", y=125)]),
        ]
        for case in cases:
            with self.subTest(case=case), tempfile.TemporaryDirectory() as directory:
                scratch = Path(directory)
                original = checkpoint(scratch, **case)
                pages = stored(scratch, [original])
                qualify_native_structure(pages, scratch, POLICY)
                result = pages[0]
                self.assertIsInstance(result, NativeStructurePreparedPage)
                self.assertEqual(
                    [t.model_dump() for t in result.tasks], [t.model_dump() for t in original.tasks]
                )
                self.assertEqual(result.observation, original.observation)

    def test_preserved_source_picture_stays_byte_identical_and_is_not_a_text_group(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            picture_box = box(40, 220, 180, 270)
            picture = Segment(
                id="p1-picture", page=1, kind="figure", method="render", box=picture_box
            )
            lines = [
                line("p1-body", "Original body.", y=120),
                line("p1-caption", "Figure 1. Source picture.", y=300),
            ]
            original = checkpoint(
                scratch,
                lines,
                preserved=[picture],
                graphics=[Graphic(box=picture_box, kind="image")],
            )
            pages = stored(scratch, [original])
            qualify_native_structure(pages, scratch, POLICY)
            result = pages[0]
            self.assertIsInstance(result.tasks[0], NativeStructureTask)
            self.assertEqual(
                [s.model_dump() for s in result.native_segments], [picture.model_dump()]
            )
            artifacts = [r for r in result.tasks[0].regions if r.artifact_id]
            self.assertEqual([r.artifact_id for r in artifacts], [picture.id])

    def test_furniture_only_blank_partial_and_ocr_routes_are_never_erased(self):
        cases = [
            dict(lines=[line("p1-folio", "17", y=760)]),
            dict(lines=[]),
            dict(
                lines=[line("p1-body", "Original body.", y=120)], purpose="pdf_region_recognition"
            ),
            dict(lines=[line("p1-body", "Original body.", y=120)], crop=box(30, 110, 150, 150)),
        ]
        for case in cases:
            with self.subTest(case=case), tempfile.TemporaryDirectory() as directory:
                scratch = Path(directory)
                original = checkpoint(scratch, **case)
                pages = stored(scratch, [original])
                qualify_native_structure(pages, scratch, POLICY)
                self.assertEqual(
                    [t.model_dump() for t in pages[0].tasks],
                    [t.model_dump() for t in original.tasks],
                )

    def test_absent_policy_does_not_rewrite_checkpoint_or_task(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            pages = stored(scratch, [checkpoint(scratch, [line("p1-body", "Source.", y=120)])])
            before = (pages.root / "page-0001.json").read_bytes()
            qualify_native_structure(pages, scratch, None)
            self.assertEqual((pages.root / "page-0001.json").read_bytes(), before)
            with self.assertRaisesRegex(ValueError, "Unknown native structure policy"):
                qualify_native_structure(pages, scratch, "unrecognized-policy")

    def test_all_carriers_convert_with_cross_page_source_furniture_proof(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            originals = []
            for number in (1, 2):
                lines = [
                    line(f"p{number}-header", "Repeated running header.", y=20),
                    line(f"p{number}-body", "Source body on this page.", y=120),
                ]
                originals.append(
                    checkpoint(
                        scratch,
                        lines,
                        number=number,
                        count=2,
                        purpose="pdf_structure_repair" if number == 1 else "pdf_region_recognition",
                    )
                )
            pages = stored(scratch, originals)
            qualify_native_structure(pages, scratch, POLICY)
            self.assertTrue(all(isinstance(page, NativeStructurePreparedPage) for page in pages))
            self.assertIsInstance(pages[0].tasks[0], NativeStructureTask)
            self.assertEqual(
                [r.line_ids for r in pages[0].tasks[0].regions if r.source.role == "furniture"],
                [["p1-header"]],
            )
            self.assertEqual(
                [task.model_dump() for task in pages[1].tasks],
                [task.model_dump() for task in originals[1].tasks],
            )

    def test_changed_original_render_refuses_instead_of_silently_falling_back(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            original = checkpoint(scratch, [line("p1-body", "Source body.", y=120)])
            pages = stored(scratch, [original])
            render = scratch / original.observation.render_path
            render.write_bytes(render.read_bytes() + b"changed")
            before = (pages.root / "page-0001.json").read_bytes()
            with self.assertRaisesRegex(ValueError, "render content identity"):
                qualify_native_structure(pages, scratch, POLICY)
            self.assertEqual((pages.root / "page-0001.json").read_bytes(), before)
