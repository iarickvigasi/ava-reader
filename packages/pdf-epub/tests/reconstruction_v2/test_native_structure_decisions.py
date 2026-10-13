"""Literal assembly conserves authored source order, typography and private artifacts."""

import unittest

from pydantic import ValidationError

from ava_pdf_epub.reconstruction_v2.native_structure_assembly import (
    assemble_native_structure_source,
)
from ava_pdf_epub.reconstruction_v2.native_structure_contract import NativeStructureResponse
from ava_pdf_epub.reconstruction_v2.native_structure_response import accept_native_structure
from ava_pdf_epub.reconstruction_v2.native_structure_source import prepare_native_structure
from ava_pdf_epub.reconstruction_v2.observations import Graphic
from ava_pdf_epub.reconstruction_v2.pdf_links import glyph_ranges
from ava_pdf_epub.reconstruction_v2.segments import Segment

from .native_structure_decision_fixture import SOURCE, box, line, page, region, response


class NativeStructureDecisions(unittest.TestCase):
    def test_single_column_exact_source_and_every_inline_plain_reset(self):
        lines = [
            line(
                "p1-line0",
                "Bold plain.",
                faces=[("Bold", "Times-Bold"), (" plain.", "Times-Roman")],
            ),
            line(
                "p1-line1",
                "Italic plain.",
                y=60,
                faces=[("Italic", "Times-Italic"), (" plain.", "Times-Roman")],
            ),
        ]
        observation, image = page(lines)
        task = prepare_native_structure(observation, SOURCE, image, [region("body", lines)])
        answer = response(
            task,
            [
                dict(
                    id="body-one",
                    region_id="body",
                    line_ids=[source.id for source in lines],
                    kind="paragraph",
                )
            ],
        )
        result = assemble_native_structure_source(task, answer, observation)
        segment = result.segments[0]
        self.assertEqual(segment.text, "Bold plain. Italic plain.")
        self.assertEqual(segment.source_text, "Bold plain.\nItalic plain.")
        self.assertEqual(segment.method, "native")
        self.assertEqual(segment.box, box(40, 40, 105, 70))
        self.assertEqual(
            [(segment.text[s.start : s.end], s.style.bold, s.style.italic) for s in segment.spans],
            [
                ("Bold", True, False),
                (" plain.", False, False),
                ("Italic", False, True),
                (" plain.", False, False),
            ],
        )
        self.assertEqual(
            [(m.line_id, m.start, m.end) for m in result.line_maps],
            [("p1-line0", 0, 11), ("p1-line1", 12, 25)],
        )
        self.assertEqual(result.pending_normalization, ())
        self.assertEqual(task.lines[0].style, lines[0].style)

    def test_two_columns_follow_source_regions_without_row_interleaving(self):
        left = [line("p1-left0", "Left first.", y=40), line("p1-left1", "Left second.", y=60)]
        right = [
            line("p1-right0", "Right first.", x=330, y=40),
            line("p1-right1", "Right second.", x=330, y=60),
        ]
        observation, image = page([left[0], right[0], left[1], right[1]])
        task = prepare_native_structure(
            observation,
            SOURCE,
            image,
            [region("left", left, column=1), region("right", right, column=2)],
        )
        answer = response(
            task,
            [
                dict(
                    id="left-body",
                    region_id="left",
                    line_ids=[source.id for source in left],
                    kind="paragraph",
                ),
                dict(
                    id="right-body",
                    region_id="right",
                    line_ids=[source.id for source in right],
                    kind="paragraph",
                ),
            ],
        )
        result = assemble_native_structure_source(task, answer, observation)
        self.assertEqual(
            [s.text for s in result.segments],
            ["Left first. Left second.", "Right first. Right second."],
        )
        self.assertEqual(
            [m.line_id for m in result.line_maps],
            ["p1-left0", "p1-left1", "p1-right0", "p1-right1"],
        )

    def test_preserved_image_caption_and_footer_are_not_replaced_or_suppressed(self):
        body = line("p1-body", "An ordinary body.")
        caption = line("p1-caption", "Figure 1. Source picture.", y=170)
        footer = line("p1-footer", "17", y=760)
        art_box = box(40, 100, 180, 150)
        figure = Segment(id="p1-figure", page=1, box=art_box, kind="figure", method="render")
        observation, image = page([body, caption, footer], [Graphic(box=art_box, kind="image")])
        regions = [
            region("body", [body]),
            region("picture", [], band=1, artifact=figure.id, bounds=art_box),
            region("caption", [caption], band=2),
            region("footer", [footer], role="furniture"),
        ]
        task = prepare_native_structure(
            observation, SOURCE, image, regions, preserved_segments=[figure], furniture={footer.id}
        )
        answer = response(
            task,
            [
                dict(id="body-one", region_id="body", line_ids=[body.id], kind="paragraph"),
                dict(
                    id="caption-one",
                    region_id="caption",
                    line_ids=[caption.id],
                    kind="caption",
                    related_to=figure.id,
                ),
                dict(id="footer-one", region_id="footer", line_ids=[footer.id], kind="furniture"),
            ],
        )
        result = assemble_native_structure_source(
            task, answer, observation, preserved_segments=[figure], furniture={footer.id}
        )
        self.assertEqual(result.segments[1].model_dump(), figure.model_dump())
        self.assertEqual(result.segments[2].related_to, figure.id)
        self.assertEqual(result.segments[3].text, "17")
        altered = figure.model_copy(update={"alt": "Invented picture label"})
        with self.assertRaisesRegex(ValueError, "artifact identity"):
            assemble_native_structure_source(
                task, answer, observation, preserved_segments=[altered], furniture={footer.id}
            )

    def test_response_has_no_text_box_or_style_authority(self):
        source = line("p1-line0", "Source words.")
        observation, image = page([source])
        task = prepare_native_structure(observation, SOURCE, image, [region("body", [source])])
        answer = response(
            task, [dict(id="body-one", region_id="body", line_ids=[source.id], kind="paragraph")]
        )
        for key, value in [
            ("text", "Changed words."),
            ("box", source.box.model_dump()),
            ("style", {"id": "invented", "bold": True}),
        ]:
            with self.subTest(key=key), self.assertRaises(ValidationError):
                raw = answer.model_dump()
                raw["groups"][0][key] = value
                NativeStructureResponse.model_validate(raw)
        bad = answer.model_copy(update={"source_sha256": "b" * 64})
        with self.assertRaisesRegex(ValueError, "another source"):
            accept_native_structure(task, bad)

    def test_repeated_unicode_source_lines_keep_distinct_link_ranges(self):
        lines = [line("p1-line0", "Repeat café😀."), line("p1-line1", "Repeat café😀.", y=60)]
        observation, image = page(lines)
        task = prepare_native_structure(observation, SOURCE, image, [region("body", lines)])
        answer = response(
            task,
            [
                dict(
                    id="body-one",
                    region_id="body",
                    kind="paragraph",
                    line_ids=[source.id for source in lines],
                )
            ],
        )
        result = assemble_native_structure_source(task, answer, observation)
        mappings = {mapping.line_id: mapping for mapping in result.line_maps}
        ranges = glyph_ranges(
            observation, list(result.segments), lines[1].box, source_line_maps=mappings
        )
        self.assertEqual(ranges, [(result.segments[0].id, 14, 27)])
        self.assertEqual(result.segments[0].text[14:27], "Repeat café😀.")
