"""All quotation purposes use exact final owning text, including cells and Unicode sequences."""

import copy
import unittest

from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse

from .response_fixtures import wire_segment
from .test_pinned_table_cells import fixture as pinned_fixture
from .test_recognition_coordinates import response_for
from .test_unicode_style_prompt import style_span, versioned_task


class TextAnchorPrecision(unittest.TestCase):
    def test_codepoint_and_adjacent_context_substitutions_remain_refused(self):
        cases = [
            ("é", "é", {}),
            ("é", "é", {}),
            ("ﬁ", "fi", {}),
            ("A\u00a0B", "A B", {}),
            ("A\u202fB", "A B", {}),
            ("а", "a", {}),
            ("👩‍🔬", "👩🔬", {}),
            ("✈️", "✈", dict(after=".")),
            ("x2 + y2.", "2", {}),
            ("x2 + y2.", "2", dict(before="X", after=" +")),
            ("x2 + y2.", "2", dict(before="x", after="+")),
        ]
        task = versioned_task("ava-prose-region-15")
        for text, quote, context in cases:
            # The variation-selector example supplies a following context from a discarded draft.
            with (
                self.subTest(text=text, quote=quote),
                self.assertRaisesRegex(ValueError, "absent|Ambiguous"),
            ):
                response_for(task, [wire_segment(text=text, spans=[style_span(quote, **context)])])

    def test_exact_intrinsic_and_combining_sequences_preserve_codepoint_ranges(self):
        tokens = ["₂", "²", "é", "ﬁ", "👩‍🔬", "✈️", "A\u00a0B", "A\u202fB", "а"]
        text = " | ".join(tokens)
        task = versioned_task("ava-prose-region-15")
        spans = [style_span(token) for token in tokens]
        result = accept_response(task, response_for(task, [wire_segment(text=text, spans=spans)]))[
            0
        ]
        self.assertEqual(text, result.text)
        self.assertEqual(tokens, [text[s.start : s.end] for s in result.spans])
        self.assertTrue(all(s.style.vertical_align is None for s in result.spans))

    def test_notes_links_and_styles_cannot_quote_another_draft(self):
        task = versioned_task("ava-prose-region-15")
        for fields in [
            dict(style=None, note_label="2"),
            dict(style=None, target_text="chapter"),
            dict(style=None, url="https://example.org"),
            {},
        ]:
            span = {**style_span("2", before="x"), **fields}
            before = copy.deepcopy(span)
            with self.subTest(fields=fields), self.assertRaisesRegex(ValueError, "absent"):
                response_for(task, [wire_segment(text="x₂", spans=[span])])
            self.assertEqual(before, span)

    def test_pinned_cells_quote_their_own_text_and_retain_exact_geometry(self):
        task, raw, source = pinned_fixture("ava-prose-region-16")
        cell = raw["segments"][0]["cells"][0][0]
        cell.update(text="x2 + y2.", spans=[style_span("2", "sub", before="x", after=" +")])
        result = accept_response(task, RecognitionResponse.model_validate(raw))[0]
        self.assertEqual(source.cells[0][0].box, result.cells[0][0].box)
        self.assertEqual(source.cells[0][0].column_span, result.cells[0][0].column_span)
        self.assertEqual(
            (1, 2), (result.cells[0][0].spans[0].start, result.cells[0][0].spans[0].end)
        )
        cell["spans"] = [style_span("2", before="other cell")]
        with self.assertRaisesRegex(ValueError, "absent"):
            RecognitionResponse.model_validate(raw)
