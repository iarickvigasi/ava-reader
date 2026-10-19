"""Finite native credit components retain evidence without overriding unknown model roles."""

import copy
import unittest

from ava_pdf_epub.reconstruction_v2.bibliographic_refinement import bibliographic_candidates
from ava_pdf_epub.reconstruction_v2.opening_credit_value import opening_credit_parts
from ava_pdf_epub.reconstruction_v2.printed_metadata import printed_metadata

from .metadata_helpers import body, metadata_state, paragraph, title
from .opening_credit_test_fixture import credit


class OpeningLanguageCreditTests(unittest.TestCase):
    def state(self, text="A. Example / English / 2024-02-29"):
        return metadata_state([title(), credit(text), body(), paragraph("The story began.")])

    def test_supported_language_markers_have_exact_author_date_and_credit_evidence(self):
        for marker, code in [("English", "en"), ("Ukrainian", "uk"), ("Українська", "uk")]:
            with self.subTest(marker=marker):
                state = self.state(f"A. Example / {marker} / 2024-02-29")
                original = copy.deepcopy(state.blocks)
                claims = printed_metadata(state, "A. Example")
                fields = {c["field"]: c for c in claims if c["field"] != "title"}
                self.assertEqual({"contributor", "language", "date"}, set(fields))
                self.assertEqual("author", fields["contributor"]["contributor_role"])
                self.assertEqual(
                    ("accepted", "work"),
                    (fields["contributor"]["status"], fields["contributor"]["scope"]),
                )
                self.assertEqual(
                    ("2024-02-29", "source_edition", "accepted"),
                    (fields["date"]["value"], fields["date"]["scope"], fields["date"]["status"]),
                )
                self.assertEqual(
                    (code, "candidate"), (fields["language"]["value"], fields["language"]["status"])
                )
                self.assertTrue(
                    all(c["evidence"] == state.blocks[1]["evidence"] for c in fields.values())
                )
                self.assertEqual(original, state.blocks)

    def test_only_the_complete_source_corroborated_native_credit_skips_model_comparison(self):
        state = self.state()
        segments = list(state.segments.values())
        self.assertEqual(["observed-1"], bibliographic_candidates(segments))
        self.assertEqual([], bibliographic_candidates(segments, "A. Example"))
        self.assertEqual(["observed-1"], bibliographic_candidates(segments, "Another Author"))
        ident = state.blocks[1]["id"]
        state.segments[ident] = state.segments[ident].model_copy(update={"method": "ocr"})
        self.assertEqual(
            ["observed-1"], bibliographic_candidates(list(state.segments.values()), "A. Example")
        )
        self.assertFalse(
            any(
                c.get("contributor_role") == "author" for c in printed_metadata(state, "A. Example")
            )
        )

    def test_invalid_or_ambiguous_components_keep_metadata_unresolved(self):
        for suffix in [
            "English / 2023-02-29",
            "English memoir / 2024-02-29",
            "Unknown / 2024-02-29",
            "English / Ukrainian",
            "English / English",
            "English / 2024",
            "English / 2024-02-29 / extra",
        ]:
            with self.subTest(suffix=suffix):
                text = "A. Example / " + suffix
                self.assertIsNone(opening_credit_parts(text, "A. Example"))
                state = self.state(text)
                self.assertEqual(
                    ["observed-1"],
                    bibliographic_candidates(list(state.segments.values()), "A. Example"),
                )
                self.assertFalse(
                    any(
                        c["field"] in {"contributor", "date", "language"}
                        for c in printed_metadata(state, "A. Example")
                    )
                )

    def test_explicit_unknown_conflicting_and_author_roles_keep_existing_authority(self):
        for role in [None, "translator", "publisher", "subtitle", "author"]:
            with self.subTest(role=role):
                state = self.state()
                state.bibliographic_roles["observed-1"] = (role, "A. Example" if role else "")
                claims = printed_metadata(state, "A. Example")
                self.assertEqual(
                    role == "author", any(c.get("contributor_role") == "author" for c in claims)
                )
                self.assertFalse(any(c["field"] in {"date", "language"} for c in claims))

    def test_missing_info_or_title_nonopening_and_uncertain_geometry_stay_unresolved(self):
        self.assertFalse(any(c["field"] == "date" for c in printed_metadata(self.state(), None)))
        for rows in [
            [body(), credit("A. Example / English / 2024-02-29")],
            [
                title(),
                body(),
                paragraph("Body first."),
                credit("A. Example / English / 2024-02-29"),
            ],
            [
                title(),
                paragraph(
                    "A. Example / English / 2024-02-29",
                    style=dict(id="left", align="left", relative_size=0.8),
                ),
                body(),
            ],
        ]:
            with self.subTest(rows=rows):
                self.assertFalse(
                    any(
                        c["field"] in {"date", "language"}
                        for c in printed_metadata(metadata_state(rows), "A. Example")
                    )
                )
