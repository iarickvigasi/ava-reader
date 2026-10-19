"""Presentation rebasing must not change printed metadata decisions based on observed sizes."""

import copy
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfWriter

from ava_pdf_epub.reconstruction_v2.assemble_metadata import assemble_metadata
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.native_document_sizes import normalize_native_sizes
from ava_pdf_epub.reconstruction_v2.native_size_presentation import apply_native_sizes

from .native_size_metadata_fixture import state_for, threshold_document


class NativeSizeMetadataTests(unittest.TestCase):
    def test_title_and_credit_thresholds_remain_source_authorities_after_presentation(self):
        for title_size, credit_size in [(17, 11), (20, 13)]:
            with self.subTest(title_size=title_size), tempfile.TemporaryDirectory() as directory:
                values, pages = threshold_document(title_size, credit_size)
                source = Path(directory) / "metadata.pdf"
                pdf = PdfWriter()
                pdf.add_blank_page(width=600, height=800)
                pdf.add_metadata(
                    {
                        "/Title": "Measured Book",
                        "/Author": "A. Example",
                        "/Subject": "Unprinted candidate",
                    }
                )
                pdf.write(source)
                state = state_for(values)
                before = assemble_metadata(source, state, "fixed")
                self.assertEqual(
                    {"title": "accepted", "contributor": "accepted", "subject": "candidate"},
                    {
                        c["field"]: c["status"]
                        for c in before
                        if c["field"] in {"title", "contributor", "subject"}
                    },
                )
                old_segments = copy.deepcopy(state.segments)
                old_blocks = copy.deepcopy(state.blocks)
                apply_native_sizes(values, pages, state)
                self.assertEqual(before, assemble_metadata(source, state, "fixed"))
                self.assertEqual(old_segments, state.segments)
                for old, new in zip(old_blocks, state.blocks, strict=True):
                    self.assertEqual(
                        {k: v for k, v in old.items() if k != "style_id"},
                        {k: v for k, v in new.items() if k != "style_id"},
                    )
                self.assertEqual(
                    title_size / 12, state.styles[state.blocks[0]["style_id"]]["relative_size"]
                )
                early = state_for(normalize_native_sizes(values, pages, AssemblyState()))
                self.assertNotEqual(before, assemble_metadata(source, early, "fixed"))
