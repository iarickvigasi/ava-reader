"""Unprinted, malformed, narrative and ambiguous opening credits do not gain authority."""

import unittest

from .metadata_helpers import body, paragraph, title
from .opening_credit_test_fixture import author, credit


class OpeningAuthorCreditRefusalTests(unittest.TestCase):
    def test_complete_author_component_only(self):
        for text in [
            "A. Example Jr / First edition",
            "Not A. Example / First edition",
            "A. Example wrote the story",
            "A. Example / Another Person",
        ]:
            with self.subTest(text=text):
                self.assertEqual(
                    [],
                    author([title(), body(), credit(text), paragraph("Prose.")]),
                )

    def test_malformed_or_duplicate_bibliographic_suffixes_refuse(self):
        for suffix in [
            "2026-02-29",
            "2026-13-01",
            "2026",
            "edition 1 and 2",
            "First edition / Second edition",
            "First edition / 2026-09-28 / extra",
            "",
        ]:
            with self.subTest(suffix=suffix):
                self.assertEqual(
                    [],
                    author(
                        [
                            title(),
                            body(),
                            credit("A. Example / " + suffix),
                            paragraph("Prose."),
                        ]
                    ),
                )

    def test_later_body_credit_and_missing_title_or_info_refuse(self):
        for rows in [
            [body(), credit()],
            [title(), body(), paragraph("Narrative first."), credit()],
            [title(), body(), credit(page=2)],
        ]:
            self.assertEqual([], author(rows))
        self.assertEqual([], author([title(), body(), credit()], None))

    def test_unknown_large_left_or_ambiguous_credit_styles_refuse(self):
        for style in [
            None,
            dict(id="credit", align="center"),
            dict(id="credit", align="left", relative_size=0.8),
            dict(id="credit", align="center", relative_size=1.5),
        ]:
            self.assertEqual(
                [],
                author(
                    [
                        title(),
                        body(),
                        paragraph("A. Example / First edition", style=style),
                        paragraph("Prose."),
                    ]
                ),
            )
        self.assertEqual(
            [],
            author(
                [
                    title(),
                    body(),
                    credit(),
                    credit("Other Name"),
                    paragraph("Prose."),
                ]
            ),
        )

    def test_second_chapter_before_credit_refuses(self):
        self.assertEqual(
            [],
            author([title(), body(), body("2. Another chapter"), credit()]),
        )
