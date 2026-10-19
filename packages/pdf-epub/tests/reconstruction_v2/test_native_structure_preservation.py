"""Review regressions exercise effective measured typography and canonical text delivery."""

import unittest
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.assemble_blocks import assemble_blocks
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.native_structure_assembly import (
    assemble_native_structure_source,
)
from ava_pdf_epub.reconstruction_v2.native_structure_response import accept_native_structure
from ava_pdf_epub.reconstruction_v2.native_structure_source import prepare_native_structure

from .native_structure_decision_fixture import SOURCE, line, page, region, response


def sized_line(ident, text, size, y):
    source = line(ident, text, y=y)
    return source.model_copy(
        update={
            "glyphs": [glyph.model_copy(update={"size": float(size)}) for glyph in source.glyphs]
        }
    )


class NativeStructurePreservation(unittest.TestCase):
    def test_grouped_ten_and_fourteen_point_lines_keep_each_effective_source_size(self):
        lines = [
            sized_line("p1-line0", "Ten point source.", 10, 40),
            sized_line("p1-line1", "Fourteen point source.", 14, 60),
        ]
        observation, image = page(lines)
        task = prepare_native_structure(observation, SOURCE, image, [region("body", lines)])
        answer = response(
            task,
            [
                dict(
                    id="body",
                    region_id="body",
                    kind="paragraph",
                    line_ids=[source.id for source in lines],
                )
            ],
        )
        result = assemble_native_structure_source(task, answer, observation)
        segment = result.segments[0]
        base = segment.style.relative_size
        for source, mapping in zip(task.lines, result.line_maps, strict=True):
            source_span = source.spans[0]
            actual = next(
                span
                for span in segment.spans
                if span.start == mapping.start and span.end == mapping.end
            )
            expected_size = source.style.relative_size * source_span.style.relative_size
            self.assertAlmostEqual(base * actual.style.relative_size, expected_size, places=12)
        self.assertAlmostEqual(base, 10 / 12, places=12)
        self.assertAlmostEqual(segment.spans[1].style.relative_size, 14 / 10, places=12)
        self.assertEqual(segment.text, "Ten point source. Fourteen point source.")

    def test_unrepresentable_grouped_size_refuses_without_clamping(self):
        lines = [
            sized_line("p1-line0", "Small source.", 10, 40),
            sized_line("p1-line1", "Large source.", 80, 60),
        ]
        observation, image = page(lines)
        task = prepare_native_structure(observation, SOURCE, image, [region("body", lines)])
        answer = response(
            task,
            [
                dict(
                    id="body",
                    region_id="body",
                    kind="paragraph",
                    line_ids=[source.id for source in lines],
                )
            ],
        )
        with self.assertRaisesRegex(ValueError, "representable span ratio"):
            accept_native_structure(task, answer)
        with self.assertRaisesRegex(ValueError, "representable span ratio"):
            assemble_native_structure_source(task, answer, observation)

    def test_body_cannot_vanish_as_separator_in_downstream_canonical_blocks(self):
        lines = [
            line("p1-body0", "Ordinary body words."),
            line("p1-ornament", "* * *", y=60),
            line("p1-body1", "The next body passage.", y=80),
        ]
        observation, image = page(lines)
        task = prepare_native_structure(observation, SOURCE, image, [region("body", lines)])
        malicious = response(
            task,
            [
                dict(id="lost-body", region_id="body", kind="separator", line_ids=[lines[0].id]),
                dict(id="ornament", region_id="body", kind="separator", line_ids=[lines[1].id]),
                dict(id="next-body", region_id="body", kind="paragraph", line_ids=[lines[2].id]),
            ],
        )
        with self.assertRaisesRegex(ValueError, "source ornamental proof"):
            accept_native_structure(task, malicious)
        valid = malicious.model_dump()
        valid["groups"][0]["kind"] = "paragraph"
        result = assemble_native_structure_source(
            task, type(malicious).model_validate(valid), observation
        )
        state = AssemblyState()
        for segment in result.segments:
            state.segments[segment.id] = segment
            state.evidence[segment.id] = [
                dict(page=1, region_id="body", method="native", box=segment.box.model_dump())
            ]
        assemble_blocks(list(result.segments), [], Path("/private/tmp"), state)
        self.assertEqual(
            [block["content"]["text"] for block in state.blocks if "content" in block],
            ["Ordinary body words.", "The next body passage."],
        )
        self.assertEqual(
            [block["kind"] for block in state.blocks], ["paragraph", "separator", "paragraph"]
        )
