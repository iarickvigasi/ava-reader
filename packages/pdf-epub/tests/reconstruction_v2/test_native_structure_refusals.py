"""Foreign, missing, duplicated and unsafe native evidence cannot become accepted prose."""

import unittest

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.reconstruction_v2.native_structure_assembly import (
    assemble_native_structure_source,
)
from ava_pdf_epub.reconstruction_v2.native_structure_contract import NativeStructureTask
from ava_pdf_epub.reconstruction_v2.native_structure_identity import native_structure_identifier
from ava_pdf_epub.reconstruction_v2.native_structure_response import accept_native_structure
from ava_pdf_epub.reconstruction_v2.native_structure_source import prepare_native_structure
from ava_pdf_epub.reconstruction_v2.observations import Graphic

from .native_structure_decision_fixture import SOURCE, line, page, region, response


class NativeStructureRefusals(unittest.TestCase):
    def setUp(self):
        self.lines = [
            line("p1-line0", "First source line."),
            line("p1-line1", "Second source line.", y=60),
        ]
        self.page, self.image = page(self.lines)
        self.task = prepare_native_structure(
            self.page, SOURCE, self.image, [region("body", self.lines)]
        )

    def answer(self, ids=None, **extra):
        return response(
            self.task,
            [
                dict(
                    id="body-one",
                    region_id="body",
                    kind="paragraph",
                    line_ids=ids or [source.id for source in self.lines],
                    **extra,
                )
            ],
        )

    def test_foreign_duplicate_omission_and_reversed_source_ids_refuse(self):
        cases = [
            ["p1-foreign", "p1-line1"],
            ["p1-line0", "p1-line0"],
            ["p1-line0"],
            ["p1-line1", "p1-line0"],
        ]
        for ids in cases:
            with self.subTest(ids=ids), self.assertRaisesRegex(ValueError, "order/coverage"):
                accept_native_structure(self.task, self.answer(ids))

    def test_region_ownership_and_furniture_reclassification_refuse(self):
        raw = self.answer().model_dump()
        raw["groups"][0]["region_id"] = "foreign-region"
        with self.assertRaisesRegex(ValueError, "region ownership"):
            accept_native_structure(self.task, type(self.answer()).model_validate(raw))
        raw["groups"][0].update(region_id="body", kind="furniture")
        with self.assertRaisesRegex(ValueError, "furniture"):
            accept_native_structure(self.task, type(self.answer()).model_validate(raw))

    def test_rehashed_source_text_or_style_cannot_override_observation(self):
        for patch in [
            dict(text="Altered new words.", text_sha256=text_digest("Altered new words.")),
            dict(style={**self.task.lines[0].style.model_dump(), "bold": True}),
        ]:
            with self.subTest(patch=patch), self.assertRaisesRegex(ValueError, "qualification"):
                raw = self.task.model_dump()
                raw["lines"][0].update(patch)
                raw["task_id"] = native_structure_identifier(raw)
                changed = NativeStructureTask.model_validate(raw)
                answer = response(changed, self.answer().model_dump()["groups"])
                assemble_native_structure_source(changed, answer, self.page)

    def test_hidden_unmatched_and_artifact_glyphs_keep_ocr_fallback(self):
        glyph = self.lines[0].glyphs[0]
        for patch in [dict(visible=False), dict(text="Absent glyph"), dict(source_artifact=True)]:
            with self.subTest(patch=patch):
                source = self.lines[0].model_copy(
                    update={"glyphs": [glyph.model_copy(update=patch)]}
                )
                observation, image = page([source, self.lines[1]])
                self.assertIsNone(
                    prepare_native_structure(
                        observation, SOURCE, image, [region("body", [source, self.lines[1]])]
                    )
                )

    def test_unqualified_raster_and_source_risks_keep_ocr_fallback(self):
        for observation in [
            self.page.model_copy(update={"risks": ["unreliable_glyph_mapping"]}),
            self.page.model_copy(
                update={"graphics": [Graphic(box=self.lines[0].box, kind="image")]}
            ),
        ]:
            self.assertIsNone(
                prepare_native_structure(
                    observation, SOURCE, self.image, [region("body", self.lines)]
                )
            )

    def test_malformed_source_region_does_not_silently_take_fallback(self):
        malformed = region("body", list(reversed(self.lines)))
        with self.assertRaisesRegex(ValueError, "source line order"):
            prepare_native_structure(self.page, SOURCE, self.image, [malformed])

    def test_source_footer_proof_is_required_and_literal_quote_breaks_remain(self):
        furniture = region("body", self.lines, role="furniture")
        with self.assertRaisesRegex(ValueError, "qualified source proof"):
            prepare_native_structure(self.page, SOURCE, self.image, [furniture])
        answer = response(
            self.task,
            [
                dict(
                    id="quotation",
                    region_id="body",
                    kind="quote",
                    line_ids=[source.id for source in self.lines],
                )
            ],
        )
        result = assemble_native_structure_source(self.task, answer, self.page)
        self.assertEqual(result.segments[0].text, "First source line.\nSecond source line.")

    def test_roman_and_alphabetic_list_ordinals_use_existing_marker_rules(self):
        for labels, starts in [(["i.", "ii."], [1, 2]), (["a)", "b)"], [1, 2])]:
            with self.subTest(labels=labels):
                lines = [
                    line("p1-list0", labels[0] + " First item."),
                    line("p1-list1", labels[1] + " Second item.", y=60),
                ]
                observation, image = page(lines)
                task = prepare_native_structure(observation, SOURCE, image, [region("body", lines)])
                answer = response(
                    task,
                    [
                        dict(
                            id=f"item{i}",
                            region_id="body",
                            kind="list_item",
                            line_ids=[source.id],
                            list_ordered=True,
                            list_depth=1,
                            list_start=starts[i],
                        )
                        for i, source in enumerate(lines)
                    ],
                )
                result = assemble_native_structure_source(task, answer, observation)
                self.assertEqual(
                    [s.text for s in result.segments],
                    [labels[0] + " First item.", labels[1] + " Second item."],
                )

    def test_bracket_note_labels_match_existing_printed_marker_authority(self):
        lines = [
            line("p1-callout", "Printed caller [1]."),
            line("p1-note", "[1] Printed note body.", y=60),
        ]
        observation, image = page(lines)
        task = prepare_native_structure(observation, SOURCE, image, [region("body", lines)])
        answer = response(
            task,
            [
                dict(id="caller", region_id="body", kind="paragraph", line_ids=[lines[0].id]),
                dict(
                    id="note",
                    region_id="body",
                    kind="note",
                    line_ids=[lines[1].id],
                    note_label="1",
                    note_role="footnote",
                ),
            ],
        )
        result = assemble_native_structure_source(task, answer, observation)
        self.assertEqual(result.segments[0].text, "Printed caller [1].")
        self.assertEqual(result.segments[1].text, "[1] Printed note body.")
        self.assertEqual(result.segments[1].note_label, "1")
