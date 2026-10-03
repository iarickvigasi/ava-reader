"""Body labels are source candidates, never silently accepted bibliographic facts."""

import unittest

from ava_pdf_epub.reconstruction_v2.printed_metadata import printed_metadata

from .metadata_helpers import body, heading, metadata_state, paragraph, title


class PrintedMetadataScopeTests(unittest.TestCase):
    def test_first_body_section_is_not_a_book_title(self):
        state = metadata_state(
            [body(), heading("Watching the water", 2), paragraph("Publisher: Fictional body text")]
        )
        claims = printed_metadata(state, None)
        self.assertFalse(any(c["field"] == "title" for c in claims))
        self.assertEqual([("publisher", "candidate")], [(c["field"], c["status"]) for c in claims])

    def test_title_frontmatter_and_copyright_labels_remain_accepted(self):
        state = metadata_state(
            [
                title(),
                paragraph("A source subtitle", style=dict(id="subtitle", align="center")),
                paragraph("Author: A. Example"),
                heading("Copyright", 2, page=2),
                paragraph(
                    "Publisher: Example Press / Edition: First / Publication date: 2020-01-01",
                    page=2,
                ),
                paragraph("Printed ISBN: 9780000000002", page=2),
                body(),
                paragraph("Author: A character in the story"),
            ]
        )
        claims = printed_metadata(state, "A. Example")
        accepted = {c["field"]: c["value"] for c in claims if c["status"] == "accepted"}
        self.assertEqual("The Journey Book", accepted["title"])
        self.assertEqual("A source subtitle", accepted["subtitle"])
        self.assertEqual("A. Example", accepted["contributor"])
        self.assertEqual("Example Press", accepted["publisher"])
        self.assertEqual("9780000000002", accepted["identifier"])
        self.assertEqual("candidate", claims[-1]["status"])

    def test_narrative_and_quoted_labels_do_not_create_claims(self):
        state = metadata_state(
            [
                title(),
                paragraph('She read "Publisher: Someone Else" in the letter.'),
                dict(kind="quote", text="Author: Invented / Publisher: Invented"),
                body(),
            ]
        )
        self.assertEqual(["title"], [c["field"] for c in printed_metadata(state, None)])

    def test_frontmatter_role_alone_is_not_title_but_colophon_labels_are_supported(self):
        state = metadata_state(
            [
                heading("The Journey Book", chapter_start=True, chapter_role="frontmatter"),
                body(),
                heading("Colophon", chapter_start=True, chapter_role="backmatter"),
                paragraph("Publisher: Example Press"),
            ]
        )
        self.assertEqual(
            [("publisher", "accepted")],
            [(c["field"], c["status"]) for c in printed_metadata(state, None)],
        )

    def test_contents_and_later_section_never_become_title(self):
        state = metadata_state(
            [
                heading("Contents", chapter_start=True, chapter_role="frontmatter"),
                heading("A listed heading", 2),
                body(),
            ]
        )
        self.assertFalse(any(c["field"] == "title" for c in printed_metadata(state, None)))

    def test_named_frontmatter_sections_are_not_titles_even_when_centered(self):
        for label in ["Acknowledgments", "Acknowledgements", "Dedication", "Foreword"]:
            for chapter in [False, True]:
                with self.subTest(label=label, chapter=chapter):
                    state = metadata_state(
                        [
                            title(label) | dict(chapter_start=chapter, chapter_role="frontmatter"),
                            paragraph("Opening discussion"),
                            body(),
                        ]
                    )
                    self.assertFalse(
                        any(c["field"] == "title" for c in printed_metadata(state, None))
                    )

    def test_prominent_left_aligned_cover_title_can_start_its_frontmatter_file(self):
        state = metadata_state(
            [
                heading(
                    "ЖІНКИ,\nЯКІ КОХАЮТЬ\nДО НЕСТЯМИ",
                    chapter_start=True,
                    chapter_role="frontmatter",
                    style=dict(id="cover", align="left", relative_size=2.2),
                ),
                paragraph("Робін Норвуд", style=dict(id="credit", align="left", relative_size=1.4)),
                body(),
            ]
        )
        claims = printed_metadata(state, None)
        self.assertEqual(
            [("title", "ЖІНКИ,\nЯКІ КОХАЮТЬ\nДО НЕСТЯМИ")],
            [(c["field"], c["value"]) for c in claims],
        )
        self.assertEqual("accepted", claims[0]["status"])

    def test_prominent_ukrainian_frontmatter_and_numbered_chapters_are_not_titles(self):
        for label in [
            "Передмова",
            "ВСТУП",
            "Зміст",
            "Подяки",
            "Присвята",
            "Пролог",
            "Післямова",
            "1. A chapter",
        ]:
            with self.subTest(label=label):
                state = metadata_state(
                    [
                        heading(
                            label,
                            chapter_start=True,
                            chapter_role="frontmatter",
                            style=dict(id="cover", align="left", relative_size=2.2),
                        ),
                        body(),
                    ]
                )
                self.assertFalse(any(c["field"] == "title" for c in printed_metadata(state, None)))
