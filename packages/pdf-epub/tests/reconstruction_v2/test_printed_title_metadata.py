"""Gold title roles do not change chapter roles or establish a contributor."""

import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.reconstruction_v2.assemble_metadata import assemble_metadata
from ava_pdf_epub.reconstruction_v2.printed_metadata import printed_metadata

from .metadata_helpers import body, metadata_state, paragraph


class PrintedTitleMetadataTests(unittest.TestCase):
    def test_explicit_complete_title_role_is_independent_from_native_or_scanned_bodymatter(self):
        for method in ["native", "ocr"]:
            with self.subTest(method=method):
                state = metadata_state(
                    [
                        body("Arthur Aron’s 36 questions") | dict(method=method),
                        paragraph("A quoted attribution is not an author credit."),
                        body("SET ONE"),
                    ]
                )
                selected = state.blocks[0]
                selected["evidence"][0]["method"] = method
                state.printed_title = (
                    selected["id"],
                    text_digest(selected["content"]["text"]),
                    "title",
                )
                claims = printed_metadata(state, "Aaron Jarrels")
                titles = [c for c in claims if c["field"] == "title"]
                self.assertEqual(1, len(titles))
                self.assertEqual("Arthur Aron’s 36 questions", titles[0]["value"])
                self.assertEqual("accepted", titles[0]["status"])
                self.assertEqual(selected["evidence"], titles[0]["evidence"])
                self.assertFalse(any(c["field"] == "contributor" for c in claims))
                self.assertEqual("bodymatter", state.segments[selected["id"]].chapter_role)

    def test_a_null_title_role_never_promotes_the_first_chapter(self):
        state = metadata_state([body("Watching the water"), paragraph("A body discussion")])
        selected = state.blocks[0]
        state.printed_title = (selected["id"], text_digest(selected["content"]["text"]), None)
        self.assertFalse(any(c["field"] == "title" for c in printed_metadata(state, None)))

    def test_printed_title_keeps_conflicting_info_title_and_unproven_creator(self):
        state = metadata_state([body("A Printed Work Title"), paragraph("A. Writer - quotation")])
        selected = state.blocks[0]
        state.printed_title = (selected["id"], text_digest(selected["content"]["text"]), "title")
        info = SimpleNamespace(title="An Unprinted Info Title", author="A Brand Name", subject=None)
        with patch(
            "ava_pdf_epub.reconstruction_v2.assemble_metadata.PdfReader",
            return_value=SimpleNamespace(metadata=info),
        ):
            claims = assemble_metadata(Path("unused-source.pdf"), state, "authored-document")
        values = {(c["field"], c["value"]): c["status"] for c in claims}
        self.assertEqual("accepted", values[("title", "A Printed Work Title")])
        self.assertEqual("conflict", values[("title", "An Unprinted Info Title")])
        self.assertEqual("candidate", values[("contributor", "A Brand Name")])

    def test_explicit_null_is_not_overridden_by_later_frontmatter_typography(self):
        state = metadata_state(
            [
                body("An Opening Chapter")
                | dict(
                    chapter_role="frontmatter",
                    style=dict(id="display", align="center", relative_size=2.0),
                ),
                body(),
            ]
        )
        selected = state.blocks[0]
        state.printed_title = (selected["id"], text_digest(selected["content"]["text"]), None)
        self.assertFalse(any(c["field"] == "title" for c in printed_metadata(state, None)))

    def test_classified_heading_cannot_be_substituted_or_edited_before_metadata_assembly(self):
        for stale in [False, True]:
            with self.subTest(stale=stale):
                state = metadata_state([body("The Whole Title")])
                state.printed_title = (
                    "foreign-node" if not stale else state.blocks[0]["id"],
                    "f" * 64,
                    "title",
                )
                with self.assertRaises(ValueError):
                    printed_metadata(state, None)
