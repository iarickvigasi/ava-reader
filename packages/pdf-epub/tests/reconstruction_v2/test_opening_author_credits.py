"""Printed opening credits corroborate complete Info authors, never ordinary narrative."""

import unittest

from .metadata_helpers import body, metadata_state, paragraph, title
from .opening_credit_test_fixture import author, credit


class OpeningAuthorCreditsTests(unittest.TestCase):
    def test_credit_after_first_chapter_before_prose_has_its_actual_evidence(self):
        rows = [title(), body(), credit(), paragraph("The journey began.")]
        state = metadata_state(rows)
        claim = author(rows)[0]
        self.assertEqual(
            ("A. Example", "accepted", "source"),
            (claim["value"], claim["status"], claim["origin"]),
        )
        self.assertEqual(state.blocks[2]["evidence"], claim["evidence"])

    def test_standalone_credit_before_chapter_and_valid_finite_suffixes(self):
        for text in [
            "A. Example",
            "A. Example / Revised edition 2",
            "A. Example / 2024-02-29",
            "A. Example / Перше видання / 2024-02-29",
        ]:
            with self.subTest(text=text):
                self.assertEqual(
                    "A. Example",
                    author([title(), credit(text), body()])[0]["value"],
                )
