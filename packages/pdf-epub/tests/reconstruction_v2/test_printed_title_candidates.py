"""Only one missing-title comparison; an opening heading is not accepted metadata by itself."""

import unittest

from ava_pdf_epub.reconstruction_v2.printed_metadata import printed_metadata
from ava_pdf_epub.reconstruction_v2.printed_title_candidates import printed_title_candidate

from .metadata_helpers import body, heading, metadata_state, paragraph, title


class PrintedTitleCandidatesTests(unittest.TestCase):
    def test_bodymatter_chapter_flag_does_not_exclude_the_unique_document_title_candidate(self):
        state = metadata_state(
            [body("Arthur Aron’s 36 questions"), paragraph("Opening context"), body()]
        )
        candidate = printed_title_candidate(list(state.segments.values()))
        self.assertEqual(state.blocks[0]["id"], candidate.id)
        self.assertFalse(any(c["field"] == "title" for c in printed_metadata(state, None)))

    def test_leading_furniture_cannot_schedule_an_already_qualified_frontmatter_title(self):
        state = metadata_state(
            [
                dict(kind="furniture", text="REPEATED RUNNING BANNER"),
                title()
                | dict(
                    chapter_start=True,
                    chapter_role="frontmatter",
                    style=dict(id="cover", align="center", relative_size=2.0),
                ),
                body(),
            ]
        )
        self.assertIsNone(printed_title_candidate(list(state.segments.values())))

    def test_observed_running_banner_is_not_the_candidate(self):
        state = metadata_state(
            [
                dict(kind="furniture", text="REPEATED RUNNING BANNER"),
                body("A Unique Printed Heading"),
                body(),
            ]
        )
        self.assertEqual(
            state.blocks[1]["id"], printed_title_candidate(list(state.segments.values())).id
        )

    def test_contents_numbered_chapters_and_quotation_only_openings_do_not_schedule(self):
        for text in [
            "Contents",
            "Foreword",
            "Chapter 1",
            "Chapter One: A Chapter",
            "Part Two",
            "1. Watching water",
            "IV. A chapter",
        ]:
            with self.subTest(text=text):
                state = metadata_state([body(text), paragraph("Body")])
                self.assertIsNone(printed_title_candidate(list(state.segments.values())))
        state = metadata_state([dict(kind="quote", text="A quotation - A. Writer")])
        self.assertIsNone(printed_title_candidate(list(state.segments.values())))

    def test_bounded_opening_candidate_is_not_a_later_section_or_partial_long_title(self):
        for row in [heading("A Later Heading", page=2), heading("Long " * 60)]:
            with self.subTest(row=row):
                state = metadata_state([paragraph("Body first"), row])
                self.assertIsNone(printed_title_candidate(list(state.segments.values())))
