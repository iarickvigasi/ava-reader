"""Printed ranges, foreign works and competing destinations remain refused."""

import unittest

from ava_pdf_epub.reconstruction_v2.bind_printed_targets import bind_printed_targets
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan

from .chapter_reference_fixture import fixture


class ChapterReferenceContextTests(unittest.TestCase):
    def test_unproven_contexts_boundaries_and_ranges_refuse(self):
        for text in [
            "Chapter 1.",
            "Smith's Chapter 1.",
            "In Chapter 1.",
            "See Chapter 1 of another book.",
            "See Chapter 1 in Smith.",
            "See Chapter 1 by Smith.",
            "See Chapter 1 from another work.",
            "See Chapter 1x.",
            "See Chapter 1_thing.",
            "See Chapter 1.2.",
            "See Chapter 1–2.",
            "See Chapter 1-2.",
            "See Chapter 1, 2.",
            "See Chapter 1 and Chapter 2.",
            "See Chapter 1 to 3.",
            "See Chapter 1–II.",
        ]:
            with self.subTest(text=text):
                items, state = fixture(text)
                with self.assertRaisesRegex(ValueError, "missing or ambiguous"):
                    bind_printed_targets(items, state)
                self.assertEqual([], state.internal_targets)

    def test_literal_span_and_noncompeting_destinations_required(self):
        for change in ["range", "label", "url", "note", "other"]:
            with self.subTest(change=change):
                items, state = fixture()
                span = items[1].spans[0]
                if change in {"range", "label"}:
                    update = (
                        {"start": span.start - 1}
                        if change == "range"
                        else {"target_text": "Chapter 2"}
                    )
                    spans = [span.model_copy(update=update)]
                else:
                    values = {
                        "url": {"url": "https://example.org"},
                        "note": {"note_label": "1"},
                        "other": {"target_text": "A different destination"},
                    }[change]
                    spans = [span, ObservedSpan(start=span.start, end=span.end, **values)]
                items[1] = items[1].model_copy(update={"spans": spans})
                with self.assertRaisesRegex(ValueError, "missing or ambiguous"):
                    bind_printed_targets(items, state)

    def test_positive_same_book_context_preserves_caller(self):
        for text in [
            "See Chapter 1.",
            "Return to Chapter 1.",
            "As in Chapter 1.",
            "See Chapter 1 of this book.",
        ]:
            with self.subTest(text=text):
                items, state = fixture(text)
                actual = bind_printed_targets(items, state)
                self.assertEqual(text, actual[1].text)
                self.assertEqual(("number", 0), state.internal_targets[-1][3:])

    def test_nonparagraph_owners_do_not_gain_number_authority(self):
        for kind in ["quote", "aside", "caption", "credit"]:
            with self.subTest(kind=kind):
                items, state = fixture()
                items[1] = items[1].model_copy(update={"kind": kind})
                with self.assertRaisesRegex(ValueError, "missing or ambiguous"):
                    bind_printed_targets(items, state)
