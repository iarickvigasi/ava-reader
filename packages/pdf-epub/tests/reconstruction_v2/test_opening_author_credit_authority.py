"""An opening-credit heuristic cannot override explicit review or infer OCR authority."""

import unittest

from ava_pdf_epub.reconstruction_v2.printed_metadata import printed_metadata

from .metadata_helpers import body, metadata_state, paragraph, title
from .opening_credit_test_fixture import credit


class OpeningAuthorCreditAuthorityTests(unittest.TestCase):
    def test_reviewed_unknown_other_roles_do_not_become_author(self):
        for role in [None, "translator", "publisher", "subtitle"]:
            with self.subTest(role=role):
                state = metadata_state([title(), credit(), body()])
                state.bibliographic_roles[state.blocks[1]["id"]] = (role, "A. Example")
                claims = printed_metadata(state, "A. Example")
                self.assertFalse(any(c.get("contributor_role") == "author" for c in claims))

    def test_reviewed_author_still_uses_existing_role_path(self):
        state = metadata_state([title(), credit(), body()])
        state.bibliographic_roles[state.blocks[1]["id"]] = ("author", "A. Example")
        claims = [
            c
            for c in printed_metadata(state, "A. Example")
            if c.get("contributor_role") == "author"
        ]
        self.assertEqual(1, len(claims))
        self.assertEqual(state.blocks[1]["evidence"], claims[0]["evidence"])

    def test_ocr_credit_or_title_does_not_use_native_heuristic(self):
        for target in [0, 2]:
            state = metadata_state([title(), body(), credit(), paragraph("Prose.")])
            ident = state.blocks[target]["id"]
            state.segments[ident] = state.segments[ident].model_copy(update={"method": "ocr"})
            claims = printed_metadata(state, "A. Example")
            self.assertFalse(any(c.get("contributor_role") == "author" for c in claims))
