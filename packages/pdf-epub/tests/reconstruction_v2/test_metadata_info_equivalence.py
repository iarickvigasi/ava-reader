"""An accepted printed Info author stays a fact when another printed witness changes case."""

import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.reconstruction_v2.assemble_metadata import assemble_metadata

from .metadata_helpers import body, heading, metadata_state, paragraph


class MetadataInfoEquivalenceTests(unittest.TestCase):
    def test_cover_info_and_printed_title_page_case_variants_merge_without_false_conflict(self):
        for coauthor in [False, True]:
            with self.subTest(coauthor=coauthor):
                state = metadata_state(
                    [
                        heading("A Measured Book", page=1),
                        paragraph("A. WRITER", page=1),
                        heading("A Measured Book", page=4),
                        paragraph("A. Writer", page=4),
                        paragraph("B. Writer" if coauthor else "A separate line", page=4),
                        body() | dict(page=5),
                    ]
                )
                state.source_title_policy = "ava-frontmatter-title-1"
                title = state.blocks[2]["id"]
                state.frontmatter_title = title, text_digest(state.segments[title].text)
                cover = state.blocks[0]["id"]
                state.frontmatter_cover = [(cover, text_digest(state.segments[cover].text))]
                for index in [1, 3, *([4] if coauthor else [])]:
                    ident = state.blocks[index]["id"]
                    state.bibliographic_roles[ident] = "author", state.segments[ident].text
                info = SimpleNamespace(author="A. WRITER", title=None, subject=None)
                with patch(
                    "ava_pdf_epub.reconstruction_v2.assemble_metadata.PdfReader",
                    return_value=SimpleNamespace(metadata=info),
                ):
                    claims = assemble_metadata(Path("unused-authored.pdf"), state, "fixed")
                authors = [c for c in claims if c["field"] == "contributor"]
                self.assertEqual(
                    [c["value"] for c in authors],
                    ["A. Writer", "B. Writer"] if coauthor else ["A. Writer"],
                )
                self.assertTrue(all(c["status"] == "accepted" for c in authors))
                self.assertEqual({e["page"] for e in authors[0]["evidence"]}, {1, 4})
