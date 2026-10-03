"""Independent prose and pixel boundaries prevent punctuation-only over-merging."""

import unittest

from PIL import Image, ImageDraw

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_boundary import inferred_continuation
from ava_pdf_epub.reconstruction_v2.continuation_margins import flush_first_line
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan
from ava_pdf_epub.reconstruction_v2.stream_joins import stream_joins

from .test_semantic_edges import segment


class ColumnJoinBoundariesTest(unittest.TestCase):
    def pair(self):
        a = segment(
            "a", "An unrelated traveller carries A😀B toward", style=Style(id="a", family="serif")
        )
        b = segment(
            "b",
            "the old bridge[2].",
            x=220,
            style=Style(id="b", family="serif"),
            spans=[ObservedSpan(start=14, end=17, note_label="2")],
        )
        state = AssemblyState(
            placements={"a": (1, 0, 1), "b": (1, 0, 2)},
            flush_starts={"b": True},
            evidence={"a": [{"page": 1}], "b": [{"page": 1}]},
        )
        return a, b, state

    def test_non_bmp_offsets_and_source_regions_survive_inferred_join(self):
        a, b, state = self.pair()
        joined = stream_joins([a, b], state)[0]
        span = joined.spans[0]
        self.assertEqual("[2]", joined.text[span.start : span.end])
        self.assertEqual(a.text + "\n" + b.text, joined.source_text)
        self.assertEqual(2, len(state.evidence["a"]))

    def test_independent_boundary_and_style_counterexamples(self):
        for changes in [
            {"text": "Another paragraph starts."},
            {"style": Style(id="b", family="serif", indent_em=1)},
            {"style": Style(id="b", family="serif", indent_em=-1)},
            {"style": Style(id="b", family="serif", bold=True)},
            {"style": Style(id="b", family="serif", line_height=1.6)},
            {"style": Style(id="b", family="serif", align="right")},
            {"kind": "quote"},
        ]:
            a, b, state = self.pair()
            self.assertFalse(inferred_continuation(a, b.model_copy(update=changes), state))
        for change in [
            lambda s: s.placements.update(b=(1, 1, 2)),
            lambda s: s.flush_starts.update(b=False),
            lambda s: s.placements.clear(),
        ]:
            a, b, state = self.pair()
            change(state)
            self.assertFalse(inferred_continuation(a, b, state))
        a, b, state = self.pair()
        self.assertFalse(inferred_continuation(a.model_copy(update={"text": "It ends."}), b, state))

    def test_actual_first_line_indent_and_crop_clipping_are_not_flush(self):
        for scale in (1, 2, 3):
            for indent, expected in ((-10, False), (0, True), (10, False)):
                image = Image.new("L", (100 * scale, 60 * scale), 255)
                draw = ImageDraw.Draw(image)
                for y, x in ((5, 20 + indent), (25, 20)):
                    draw.rectangle((x * scale, y * scale, 70 * scale, (y + 7) * scale), fill=0)
                self.assertEqual(expected, flush_first_line(image, scale))
            self.assertFalse(
                flush_first_line(image.crop((0, 5 * scale, 100 * scale, 60 * scale)), scale)
            )
        self.assertFalse(flush_first_line(Image.new("L", (100, 60), 255), 1))
