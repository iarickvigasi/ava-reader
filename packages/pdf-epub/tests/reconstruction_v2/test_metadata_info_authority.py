"""PDF Info text repeated in narrative is not corroborated book metadata."""

import tempfile
import unittest
from pathlib import Path

from pypdf import PdfWriter

from ava_pdf_epub.reconstruction_v2.assemble_metadata import assemble_metadata

from .metadata_helpers import body, heading, metadata_state, paragraph, title


class MetadataInfoAuthorityTests(unittest.TestCase):
    def claims(self, rows, info):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "metadata.pdf"
            pdf = PdfWriter()
            pdf.add_blank_page(width=600, height=800)
            pdf.add_metadata(info)
            pdf.write(path)
            return assemble_metadata(path, metadata_state(rows), "authored-conversion")

    def test_body_only_info_title_author_subject_remain_candidates(self):
        claims = self.claims(
            [
                body(),
                heading("Watching the water", 2),
                paragraph("A. Example"),
                paragraph("A quoted subject"),
            ],
            {
                "/Title": "Watching the water",
                "/Author": "A. Example",
                "/Subject": "A quoted subject",
            },
        )
        self.assertEqual(["candidate"] * 3, [c["status"] for c in claims[1:]])

    def test_exact_title_and_frontmatter_byline_confirm_info(self):
        claims = self.claims(
            [title(), paragraph("A. Example"), body()],
            {"/Title": "The Journey Book", "/Author": "A. Example"},
        )
        self.assertEqual(["accepted", "accepted"], [c["status"] for c in claims[1:]])
        self.assertEqual(1, sum(c["field"] == "title" for c in claims))

    def test_printed_title_conflict_does_not_promote_noisy_info(self):
        claims = self.claims(
            [
                title(),
                paragraph("Author: A. Example"),
                body(),
                paragraph("Wrong Title / Author: Someone Else"),
            ],
            {"/Title": "Wrong Title", "/Author": "Someone Else"},
        )
        self.assertEqual(["conflict", "conflict"], [c["status"] for c in claims[1:3]])
        self.assertIn(
            ("title", "The Journey Book", "accepted"),
            [(c["field"], c["value"], c["status"]) for c in claims],
        )
