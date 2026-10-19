"""A separate printed title label does not undo a complete native opening credit."""

import copy
import unittest

from ava_pdf_epub.reconstruction_v2.printed_metadata import printed_metadata

from .metadata_helpers import body, metadata_state, paragraph, title
from .opening_credit_test_fixture import author, credit


class OpeningCreditContinuationTests(unittest.TestCase):
    def test_complete_credit_before_separate_title_edition_label_keeps_exact_claims(self):
        for name, suffix in [
            ("The Journey Book", " — Streaming verification edition"),
            ("An Independent Atlas", " – Reader comparison edition 2"),
            ("Дорога", " — Оновлене видання"),
        ]:
            with self.subTest(name=name):
                rows = [title(name), body(), credit()]
                baseline = printed_metadata(metadata_state(rows), "A. Example")
                rows += [credit(name + suffix), paragraph("The story began.")]
                state = metadata_state(rows)
                original = copy.deepcopy(state.blocks)
                claims = printed_metadata(state, "A. Example")
                self.assertEqual(baseline, claims)
                self.assertEqual(original, state.blocks)
                self.assertTrue(
                    all(
                        claim["evidence"] == state.blocks[2]["evidence"]
                        for claim in claims
                        if claim["field"] != "title"
                    )
                )

    def test_ambiguous_or_conflicting_continuations_still_refuse(self):
        for text in [
            "Other Name",
            "A. Example",
            "A. Example / Second edition",
            "The Journey Book — Another Author",
            "The Journey Book — By Another Author edition",
            "The Journey Book — First edition / Other Name",
            "A Different Book — Streaming verification edition",
            "The Journey Book —",
        ]:
            with self.subTest(text=text):
                self.assertEqual([], author([title(), body(), credit(), credit(text)]))

    def test_title_label_cannot_start_a_credit_or_corroborate_a_body_name(self):
        label = credit("The Journey Book — Streaming verification edition")
        for rows in [
            [title(), body(), label, credit()],
            [title(), body(), paragraph("A. Example wrote the story."), label],
            [title(), body(), credit("Another Author"), label],
        ]:
            with self.subTest(rows=rows):
                self.assertEqual([], author(rows))

    def test_ocr_reviewed_credit_or_overlapping_label_remains_unresolved(self):
        rows = [title(), body(), credit(), credit("The Journey Book — Test edition")]
        for change in ["ocr", "reviewed", "credit", "overlap"]:
            with self.subTest(change=change):
                state = metadata_state(rows)
                target = state.segments["observed-3"]
                if change == "ocr":
                    state.segments[target.id] = target.model_copy(update={"method": "ocr"})
                elif change == "reviewed":
                    state.bibliographic_roles[target.id] = (None, "")
                elif change == "credit":
                    state.blocks[3]["kind"] = "credit"
                else:
                    state.segments[target.id] = target.model_copy(
                        update={"box": state.segments["observed-2"].box}
                    )
                claims = printed_metadata(state, "A. Example")
                self.assertFalse(any(c.get("contributor_role") == "author" for c in claims))
