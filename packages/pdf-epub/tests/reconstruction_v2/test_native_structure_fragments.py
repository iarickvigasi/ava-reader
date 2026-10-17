"""Disjoint marker/body fragments share one source row without weakening layout guards."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.source import SourcePage
from ava_pdf_epub.reconstruction_v2.native_structure_assembly import (
    assemble_native_structure_source,
)
from ava_pdf_epub.reconstruction_v2.native_structure_response import accept_native_structure
from ava_pdf_epub.reconstruction_v2.native_structure_source import prepare_native_structure
from ava_pdf_epub.reconstruction_v2.native_structure_v2_contract import NativeStructureTask2
from ava_pdf_epub.reconstruction_v2.qualify_native_structure import (
    replacement_native_structure_task,
)

from .native_structure_decision_fixture import SOURCE, box, line, page, region
from .native_structure_routing_fixture import checkpoint
from .native_structure_v2_fixture import response2


def split_list_source():
    # The source geometry reproduces the page26 marker/body boundary; all words are authored.
    lines = [
        line("line1", "Authored running title", x=36.7, y=36.686),
        line("line2", "26", x=300, y=36.686),
    ]
    lines.extend(
        line(
            f"line{index}",
            f"Authored prose line {index} keeps its ink-",
            x=36.7,
            y=56.5315 + (index - 3) * 12.7,
        )
        for index in range(3, 18)
    )
    lines.extend(
        [
            line("line18", "1.", x=36.7, y=259.7315),
            line(
                "line19",
                "First authored list item",
                x=48.1,
                y=259.7315,
                faces=[("First authored list item", "Times-Bold")],
            ),
            line("line20", "continues with literal words.", x=48.1, y=272.431),
            line("line21", "2.", x=36.7, y=285.131),
            line("line22", "Second authored list item", x=48.1, y=285.131),
        ]
    )
    lines.extend(
        line(
            f"line{index}",
            f"Authored following prose {index}.",
            x=36.7,
            y=297.831 + (index - 23) * 12.7,
        )
        for index in range(23, 40)
    )
    return lines


class NativeStructureFragments(unittest.TestCase):
    def test_exact_source_page_band_overlap_guard_remains_closed(self):
        observation, _ = page([])
        regions = [
            region(
                "first",
                [line("first-line", "First source.")],
                bounds=box(36.7, 56.5315, 309.7, 270.2315),
            ),
            region(
                "next",
                [line("next-line", "Next source.")],
                band=1,
                bounds=box(48.1, 259.7315, 268.7, 295.631),
            ),
        ]
        with self.assertRaisesRegex(ValueError, "Content bands overlap"):
            SourcePage(
                number=1,
                width_pt=observation.width_pt,
                height_pt=observation.height_pt,
                original_rotation=0,
                regions=[r.source for r in regions],
            )

    def test_split_markers_route_native2_preserving_all_39_lines_and_literal_ink(self):
        lines = split_list_source()
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            prepared = checkpoint(scratch, lines)
            prepared = prepared.model_copy(
                update={
                    "observation": prepared.observation.model_copy(
                        update={
                            "width_pt": 346.0,
                            "height_pt": 582.0,
                        }
                    ),
                    "tasks": [
                        prepared.tasks[0].model_copy(
                            update={
                                "region_box": box(0, 0, 346, 582),
                            }
                        )
                    ],
                }
            )
            replacement = replacement_native_structure_task(
                prepared,
                scratch,
                {"line1", "line2"},
                structure_policy="ava-native-structure-2",
            )
            self.assertIsNotNone(replacement)
            task, _ = replacement
            self.assertIsInstance(task, NativeStructureTask2)
            self.assertEqual(len(task.lines), 39)
            for owned, source in zip(task.lines, lines, strict=True):
                self.assertEqual(
                    (owned.id, owned.text, owned.box), (source.id, source.text, source.box)
                )
                self.assertEqual(
                    owned.style.model_dump(exclude={"relative_size"}),
                    source.style.model_dump(exclude={"relative_size"}),
                )
            content = [r for r in task.regions if r.source.role == "content"]
            self.assertEqual(len(content), 1)
            self.assertEqual(content[0].line_ids, [s.id for s in lines[2:]])
            self.assertEqual(
                [r.line_ids for r in task.regions if r.source.role == "furniture"],
                [["line1"], ["line2"]],
            )

    def test_two_columns_finish_left_stream_before_right_including_split_list_rows(self):
        left = [
            line("left-marker", "1.", y=120),
            line("left-body", "Left item text.", x=60, y=120),
            line("left-next", "Left continuation.", x=60, y=140),
        ]
        right = [
            line("right-marker", "2.", x=330, y=120),
            line("right-body", "Right item text.", x=350, y=120),
            line("right-next", "Right continuation.", x=350, y=140),
        ]
        lines = [left[0], left[1], right[0], right[1], left[2], right[2]]
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            prepared = checkpoint(scratch, lines)
            replacement = replacement_native_structure_task(
                prepared,
                scratch,
                set(),
                structure_policy="ava-native-structure-2",
            )
            self.assertIsNotNone(replacement)
            task, _ = replacement
            self.assertEqual(
                [(r.source.column, r.line_ids) for r in task.regions],
                [(1, [s.id for s in left]), (2, [s.id for s in right])],
            )
            answer = response2(
                task,
                [
                    dict(
                        id=f"item{index}",
                        region_id=source.source.id,
                        kind="list_item",
                        line_ids=source.line_ids,
                        list_role="ordered",
                        list_start=index + 1,
                        list_depth=1,
                    )
                    for index, source in enumerate(task.regions)
                ],
            )
            result = assemble_native_structure_source(task, answer, prepared.observation)
            self.assertEqual(
                [s.text for s in result.segments],
                [
                    "1. Left item text. Left continuation.",
                    "2. Right item text. Right continuation.",
                ],
            )
            self.assertEqual([m.line_id for m in result.line_maps], [s.id for s in left + right])

    def test_overlapping_or_misaligned_fragments_keep_recognition_route(self):
        cases = [
            [line("marker", "1.", y=120), line("body", "Overlapping ink", x=45, y=120)],
            [line("marker", "1.", y=120), line("body", "Offset baseline", x=60, y=120.2)],
            [line("marker", "1.", y=120), line("body", "Tall bounds", x=60, y=120)],
            [
                line("one", "A", x=40, y=120),
                line("two", "B", x=60, y=120.09),
                line("three", "C", x=80, y=120.18),
            ],
        ]
        source = cases[2][1]
        bounds = box(source.box.x0, 120, source.box.x1, 131)
        cases[2][1] = source.model_copy(
            update={
                "box": bounds,
                "glyphs": [source.glyphs[0].model_copy(update={"box": bounds})],
            }
        )
        for lines in cases:
            with (
                self.subTest(ids=[s.id for s in lines]),
                tempfile.TemporaryDirectory() as directory,
            ):
                scratch = Path(directory)
                prepared = checkpoint(scratch, lines)
                original = prepared.tasks[0]
                self.assertIsNone(
                    replacement_native_structure_task(
                        prepared,
                        scratch,
                        set(),
                        structure_policy="ava-native-structure-2",
                    )
                )
                self.assertEqual(prepared.tasks[0], original)

    def test_hidden_marker_does_not_bypass_source_glyph_qualification(self):
        marker = line("marker", "1.", y=120)
        hidden = marker.model_copy(
            update={
                "glyphs": [marker.glyphs[0].model_copy(update={"visible": False})],
            }
        )
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            prepared = checkpoint(scratch, [hidden, line("body", "Visible text", x=60, y=120)])
            self.assertIsNone(
                replacement_native_structure_task(
                    prepared,
                    scratch,
                    set(),
                    structure_policy="ava-native-structure-2",
                )
            )

    def test_shorter_last_row_fragment_cannot_hide_prior_ink_overlap(self):
        shorter = line("shorter", "B", x=60, y=120)
        bounds = box(shorter.box.x0, 120, shorter.box.x1, 129.91)
        shorter = shorter.model_copy(
            update={
                "box": bounds,
                "glyphs": [shorter.glyphs[0].model_copy(update={"box": bounds})],
            }
        )
        lines = [line("taller", "A", x=40, y=120), shorter, line("overlap", "C", x=40, y=129.95)]
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            prepared = checkpoint(scratch, lines)
            self.assertIsNone(
                replacement_native_structure_task(
                    prepared,
                    scratch,
                    set(),
                    structure_policy="ava-native-structure-2",
                )
            )

    def test_split_marker_proof_refuses_wrong_number_family_isolation_and_geometry(self):
        valid = [line("marker", "1.", y=120), line("body", "Original text", x=60, y=120)]
        cases = [
            (valid, "ordered", 2),
            (valid, "unordered", None),
            (valid[:1], "ordered", 1),
            ([valid[0], line("body", "Shifted text", x=60, y=120.2)], "ordered", 1),
            ([valid[0], line("body", "Overlapping text", x=45, y=120)], "ordered", 1),
        ]
        for lines, role, start in cases:
            observation, image = page(lines)
            task = prepare_native_structure(
                observation,
                SOURCE,
                image,
                [region("body", lines)],
                structure_policy="ava-native-structure-2",
            )
            self.assertIsNotNone(task)
            group = dict(
                id="item",
                region_id="body",
                kind="list_item",
                line_ids=[s.id for s in lines],
                list_role=role,
                list_depth=1,
            )
            if start is not None:
                group["list_start"] = start
            with self.subTest(role=role, start=start, ids=[s.id for s in lines]):
                with self.assertRaisesRegex(ValueError, "list (marker|number) differs"):
                    accept_native_structure(task, response2(task, [group]))

    def test_split_roman_markers_keep_printed_sequence_authority(self):
        rows = [
            [
                line("first-marker", "i.", y=120),
                line("first-body", "First roman item", x=60, y=120),
            ],
            [
                line("next-marker", "ii.", y=140),
                line("next-body", "Second roman item", x=60, y=140),
            ],
        ]
        observation, image = page(rows[0] + rows[1])
        task = prepare_native_structure(
            observation,
            SOURCE,
            image,
            [region(f"row{index}", row, band=index) for index, row in enumerate(rows)],
            structure_policy="ava-native-structure-2",
        )
        self.assertIsNotNone(task)
        groups = [
            dict(
                id=f"item{index}",
                region_id=f"row{index}",
                kind="list_item",
                line_ids=[s.id for s in row],
                list_role="ordered",
                list_start=index + 1,
                list_depth=1,
            )
            for index, row in enumerate(rows)
        ]
        accept_native_structure(task, response2(task, groups))
        groups[0]["list_start"] = 9  # Alphabetic i cannot replace the printed i, ii sequence.
        with self.assertRaisesRegex(ValueError, "list number differs"):
            accept_native_structure(task, response2(task, groups))


if __name__ == "__main__":
    unittest.main()
