"""Split source ornaments cannot invent columns or authorize loss of ordinary body ink."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assemble_blocks import assemble_blocks
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.native_structure_assembly import (
    assemble_native_structure_source,
)
from ava_pdf_epub.reconstruction_v2.native_structure_contract import NativeStructureTask
from ava_pdf_epub.reconstruction_v2.native_structure_regions import native_structure_regions
from ava_pdf_epub.reconstruction_v2.native_structure_response import accept_native_structure
from ava_pdf_epub.reconstruction_v2.native_structure_source import prepare_native_structure
from ava_pdf_epub.reconstruction_v2.qualify_native_structure import qualify_native_structure

from .native_structure_decision_fixture import SOURCE, box, line, page, region, response
from .native_structure_routing_fixture import checkpoint, stored


def stars(y=240, xs=(267.5, 297.5, 327.5)):
    return [line(f"p1-star{index}", "*", x=x, y=y) for index, x in enumerate(xs)]


def wide_body(ident, text, y):
    return line(ident, text, x=200, y=y)


def passages(row):
    return [
        wide_body("p1-before", "Full width original words before the source ornament.", 120),
        *row,
        wide_body("p1-after", "Full width original words after the source ornament.", 340),
    ]


def decisions(task, row_ids):
    groups = []
    for source_region in task.regions:
        pending = []
        for ident in source_region.line_ids:
            if ident in row_ids:
                if pending:
                    groups.append(
                        dict(
                            id=f"group{len(groups)}",
                            region_id=source_region.source.id,
                            line_ids=pending,
                            kind="paragraph",
                        )
                    )
                    pending = []
                if not groups or groups[-1]["kind"] != "separator":
                    groups.append(
                        dict(
                            id=f"group{len(groups)}",
                            region_id=source_region.source.id,
                            line_ids=[],
                            kind="separator",
                        )
                    )
                groups[-1]["line_ids"].append(ident)
            else:
                pending.append(ident)
        if pending:
            groups.append(
                dict(
                    id=f"group{len(groups)}",
                    region_id=source_region.source.id,
                    line_ids=pending,
                    kind="paragraph",
                )
            )
    return response(task, groups)


class NativeStructureOrnaments(unittest.TestCase):
    def test_tiny_split_row_routes_native_and_preserves_every_source_line_and_style(self):
        row = stars()
        lines = passages(row)
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            original = checkpoint(scratch, lines)
            pages = stored(scratch, [original])
            qualify_native_structure(pages, scratch, "ava-native-structure-1")
            prepared = pages[0]
            task = prepared.tasks[0]
            self.assertIsInstance(task, NativeStructureTask)
            self.assertEqual(prepared.observation, original.observation)
            self.assertEqual([source.id for source in task.lines], [source.id for source in lines])
            self.assertEqual(
                [ident for source_region in task.regions for ident in source_region.line_ids],
                [source.id for source in lines],
            )
            self.assertTrue(all(r.source.role == "content" for r in task.regions))
            for source, owned in zip(lines, task.lines, strict=True):
                self.assertEqual(owned.text, source.text)
                self.assertEqual(owned.box, source.box)
                self.assertEqual(
                    owned.style.model_dump(exclude={"relative_size"}),
                    source.style.model_dump(exclude={"relative_size"}),
                )
            answer = decisions(task, {source.id for source in row})
            result = assemble_native_structure_source(task, answer, prepared.observation)
            self.assertEqual(
                [segment.text for segment in result.segments],
                [lines[0].text, "* * *", lines[-1].text],
            )
            ornament = result.segments[1]
            self.assertEqual(ornament.source_text, "*\n*\n*")
            self.assertEqual(ornament.native_line_ids, [source.id for source in row])
            self.assertEqual(
                [
                    (mapping.line_id, mapping.start, mapping.end)
                    for mapping in result.line_maps
                    if mapping.segment_id == ornament.id
                ],
                [("p1-star0", 0, 1), ("p1-star1", 2, 3), ("p1-star2", 4, 5)],
            )
            self.assertEqual(
                [ornament.text[s.start : s.end] for s in ornament.spans], ["*", "*", "*"]
            )
            self.assertEqual(
                [s.style for s in ornament.spans],
                [source.spans[0].style for source in task.lines[1:4]],
            )
            state = AssemblyState()
            for segment in result.segments:
                state.segments[segment.id] = segment
                state.evidence[segment.id] = [
                    dict(page=1, region_id="body", method="native", box=segment.box.model_dump())
                ]
            assemble_blocks(list(result.segments), [], scratch, state)
            self.assertEqual(
                [block["content"]["text"] for block in state.blocks if "content" in block],
                [lines[0].text, lines[-1].text],
            )
            self.assertEqual(
                [block["kind"] for block in state.blocks], ["paragraph", "separator", "paragraph"]
            )

    def test_exact_page29_sized_source_boxes_expand_without_replacing_original_ids(self):
        row = stars(y=310.5244, xs=(135.905968, 171.184519, 206.463070))
        precise = []
        for source in row:
            bounds = box(source.box.x0, 310.5244, source.box.x0 + 4.09563, 321.0244)
            glyph = source.glyphs[0].model_copy(update={"box": bounds, "size": 10.5})
            precise.append(source.model_copy(update={"box": bounds, "glyphs": [glyph]}))
        lines = [
            line("p1-before", "Body source before a centered ornamental row.", x=36.7, y=100),
            *precise,
            line("p1-after", "Body source after a centered ornamental row.", x=36.7, y=400),
        ]
        # These are authored glyphs and page geometry, not the private book transcription.
        for index in (0, len(lines) - 1):
            source = lines[index]
            lines[index] = source.model_copy(
                update={"glyphs": [source.glyphs[0].model_copy(update={"size": 10.5})]}
            )
        observation, image = page(lines)
        observation = observation.model_copy(update={"width_pt": 346.0, "height_pt": 582.0})
        regions = native_structure_regions(observation, [], set())
        task = prepare_native_structure(observation, SOURCE, image, regions)
        self.assertEqual(
            [ident for source_region in task.regions for ident in source_region.line_ids],
            [source.id for source in lines],
        )
        result = assemble_native_structure_source(
            task, decisions(task, {source.id for source in precise}), observation
        )
        self.assertEqual(result.segments[1].box, box(135.905968, 310.5244, 210.558700, 321.0244))
        self.assertEqual(
            [owned.box for owned in task.lines[1:4]], [source.box for source in precise]
        )

    def test_true_two_column_source_order_survives_ornament_barrier(self):
        left = [line("p1-left0", "Left first.", y=120), line("p1-left1", "Left second.", y=140)]
        right = [
            line("p1-right0", "Right first.", x=330, y=120),
            line("p1-right1", "Right second.", x=330, y=140),
        ]
        row = stars()
        lines = [left[0], right[0], left[1], right[1], *row, passages(row)[-1]]
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            pages = stored(scratch, [checkpoint(scratch, lines)])
            qualify_native_structure(pages, scratch, "ava-native-structure-1")
            task = pages[0].tasks[0]
            self.assertIsInstance(task, NativeStructureTask)
            self.assertEqual(
                [(r.source.column, r.line_ids) for r in task.regions],
                [
                    (1, [source.id for source in left]),
                    (2, [source.id for source in right]),
                    (0, [source.id for source in row] + ["p1-after"]),
                ],
            )
            result = assemble_native_structure_source(
                task, decisions(task, {source.id for source in row}), pages[0].observation
            )
            self.assertEqual(
                [segment.text for segment in result.segments],
                ["Left first. Left second.", "Right first. Right second.", "* * *", lines[-1].text],
            )

    def test_unsafe_row_evidence_keeps_original_recognition_task(self):
        base = stars()
        mixed_font = base[1].model_copy(
            update={"glyphs": [base[1].glyphs[0].model_copy(update={"font": "Garamond-Regular"})]}
        )
        hidden = base[1].model_copy(
            update={"glyphs": [base[1].glyphs[0].model_copy(update={"visible": False})]}
        )
        cases = [
            [base[0], line("p1-star1", "*", x=297.5, y=241), base[2]],
            [base[0], line("p1-star1", "Ordinary words", x=297.5, y=240), base[2]],
            [base[0], line("p1-star1", "*", x=297.5, y=240, faces=[("*", "Times-Bold")]), base[2]],
            [base[0], mixed_font, base[2]],
            [base[0], hidden, base[2]],
            stars(xs=(247.5, 297.5, 327.5)),  # Uneven gaps.
            [*base, line("p1-nearby-body", "A body caller*", x=40, y=240)],
        ]
        for row in cases:
            with self.subTest(row=row), tempfile.TemporaryDirectory() as directory:
                scratch = Path(directory)
                original = checkpoint(scratch, passages(row))
                pages = stored(scratch, [original])
                qualify_native_structure(pages, scratch, "ava-native-structure-1")
                self.assertEqual(
                    [task.model_dump() for task in pages[0].tasks],
                    [task.model_dump() for task in original.tasks],
                )
                self.assertEqual(pages[0].observation, original.observation)

    def test_separator_role_refuses_unrelated_symbols_body_text_and_small_callers(self):
        base = stars()
        small = [
            source.model_copy(update={"glyphs": [source.glyphs[0].model_copy(update={"size": 7})]})
            for source in base
        ]
        cases = [
            [base[0], line("p1-star1", "*", x=297.5, y=260), line("p1-star2", "*", x=327.5, y=280)],
            [base[0], line("p1-star1", "Body words.", x=297.5, y=240), base[2]],
            [base[0], line("p1-star1", "*", x=297.5, y=240, faces=[("*", "Times-Bold")]), base[2]],
            small,
            [*base, line("p1-caller-body", "Words* with a caller.", x=40, y=240)],
            base[:2],
        ]
        for row in cases:
            with self.subTest(row=row):
                row = sorted(row, key=lambda source: (source.box.y0, source.box.x0))
                lines = passages(row)
                observation, image = page(lines)
                # Pin independently owned regions to exercise response-role proof even
                # when the routing qualifier would conservatively keep recognition.
                regions = [
                    region("before", [lines[0]]),
                    region("symbols", row, band=1),
                    region("after", [lines[-1]], band=2),
                ]
                task = prepare_native_structure(observation, SOURCE, image, regions)
                with self.assertRaisesRegex(ValueError, "source ornamental proof"):
                    accept_native_structure(task, decisions(task, {source.id for source in row}))

    def test_three_symbols_beside_body_caller_cannot_be_separator(self):
        row = stars()
        source_body = line("p1-caller", "Body words with a caller*", x=40, y=240)
        lines = [passages(row)[0], source_body, *row, passages(row)[-1]]
        observation, image = page(lines)
        task = prepare_native_structure(observation, SOURCE, image, [region("body", lines)])
        with self.assertRaisesRegex(ValueError, "source ornamental proof"):
            accept_native_structure(task, decisions(task, {source.id for source in row}))
