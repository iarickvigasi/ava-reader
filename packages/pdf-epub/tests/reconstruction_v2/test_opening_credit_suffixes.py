"""Printed edition/date parts survive without borrowing PDF Info publication authority."""

import unittest

from ava_pdf_epub.reconstruction_v2.opening_credit_value import opening_credit_parts
from ava_pdf_epub.reconstruction_v2.printed_metadata import printed_metadata

from .metadata_helpers import body, metadata_state, title
from .opening_credit_test_fixture import credit


class OpeningCreditSuffixTests(unittest.TestCase):
    def test_complete_printed_suffixes_keep_their_values_scope_and_evidence(self):
        rows = [title(), body(), credit("A. Example / Revised edition 2 / 2024-02-29")]
        state = metadata_state(rows)
        claims = printed_metadata(state, "A. Example")
        suffixes = {c["field"]: c for c in claims if c["field"] in {"edition", "date"}}
        self.assertEqual({"edition", "date"}, set(suffixes))
        self.assertEqual("Revised edition 2", suffixes["edition"]["value"])
        self.assertEqual("2024-02-29", suffixes["date"]["value"])
        for claim in suffixes.values():
            self.assertEqual("accepted", claim["status"])
            self.assertEqual("source", claim["origin"])
            self.assertEqual("source_edition", claim["scope"])
            self.assertEqual(state.blocks[2]["evidence"], claim["evidence"])
            self.assertNotIn("contributor_role", claim)

    def test_absent_components_are_not_invented(self):
        self.assertEqual(
            {"contributor": "A. Example"}, opening_credit_parts("A. Example", "A. Example")
        )
        claims = printed_metadata(
            metadata_state([title(), credit("A. Example"), body()]), "A. Example"
        )
        self.assertFalse(any(c["field"] in {"date", "edition"} for c in claims))

    def test_invalid_ambiguous_or_uncorroborated_suffixes_have_no_claims(self):
        for text in [
            "A. Example / 2023-02-29",
            "A. Example / No edition",
            "A. Example / Unknown edition",
            "A. Example / Not an edition",
            "A. Example / Maybe an edition",
            "A. Example / First Second edition",
            "A. Example / Невідоме видання",
            "A. Example / Civil edition",
            "A. Example / First edition 2",
            "A. Example / IV edition 2",
            "A. Example / edition 0",
            "A. Example / 2st edition",
            "A. Example / 11st edition",
            "A. Example / 12nd edition",
            "A. Example / 13rd edition",
            "A. Example / First edition / Revised edition",
            "A. Example / 2024-02-29 / 2025-01-01",
            "Another Author / First edition / 2024-02-29",
            "A. Example / Publisher Unknown / 2024-02-29",
        ]:
            with self.subTest(text=text):
                self.assertIsNone(opening_credit_parts(text, "A. Example"))
                claims = printed_metadata(
                    metadata_state([title(), credit(text), body()]), "A. Example"
                )
                self.assertFalse(any(c["field"] in {"date", "edition"} for c in claims))

    def test_supported_affirmative_edition_forms_are_preserved_exactly(self):
        for edition in [
            "Revised second edition",
            "2nd edition",
            "IV edition",
            "Revised edition 2",
            "edition 1",
            "21st edition",
            "11th edition",
            "112th edition",
            "Оновлене друге видання",
        ]:
            with self.subTest(edition=edition):
                parts = opening_credit_parts(f"A. Example / {edition}", "A. Example")
                self.assertEqual({"contributor": "A. Example", "edition": edition}, parts)
