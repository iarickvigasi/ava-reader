import tempfile
import unittest
from pathlib import Path

from pypdf import PdfWriter

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.findings import Finding
from ava_pdf_epub.reconstruction_v2.prepared import PreparedPage
from ava_pdf_epub.reconstruction_v2.refinement_catalogue import refinement_catalogue
from ava_pdf_epub.reconstruction_v2.source_structure import source_structure

from .test_pdf_links import observation
from .test_refinement_grouping import segment


class OcrHeadingRouting(unittest.TestCase):
    def test_unnumbered_ocr_ranks_reach_review_with_blocking_findings(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.pdf"
            writer = PdfWriter()
            writer.add_blank_page(width=100, height=100)
            writer.add_blank_page(width=100, height=100)
            writer.write(source)
            prepared = [
                PreparedPage(
                    schema_version="ava-prepared-page-1",
                    source_sha256="a" * 64,
                    source_byte_length=source.stat().st_size,
                    source_page_count=2,
                    observation=observation().model_copy(update={"number": n}),
                    tables=[],
                    native_segments=[],
                    tasks=[],
                )
                for n in [1, 2]
            ]
            headings = [
                segment(
                    "h" + str(n), "Opening" if n == 1 else "Closing", level=1, page=n
                ).model_copy(update={"chapter_start": False, "chapter_role": None})
                for n in [1, 2]
            ]
            body = [
                segment("body" + str(n), "Observed ordinary body prose. " * 4, page=n)
                for n in [1, 2]
            ]
            ordered = [headings[0], body[0], headings[1], body[1]]
            state = AssemblyState(
                structure_findings=[
                    Finding(
                        code="PDF_LINKED_FURNITURE_PRESERVED",
                        severity="information",
                        page=1,
                        message="Earlier source finding stays recorded.",
                    )
                ]
            )
            result = source_structure(
                source, prepared, {1: ordered[:2], 2: ordered[2:]}, ordered, state
            )
            state.placements = {s.id: (s.page, i, 0) for i, s in enumerate(result)}
            catalogue = refinement_catalogue(result, state)
            self.assertTrue({"h1", "h2"}.issubset(catalogue.decisions))
            self.assertFalse(any(s.chapter_start for s in result))
            self.assertEqual(
                2,
                sum(
                    f.code == "OCR_HIERARCHY_UNCORROBORATED" and f.severity == "blocking"
                    for f in state.structure_findings
                ),
            )
            self.assertEqual("PDF_LINKED_FURNITURE_PRESERVED", state.structure_findings[0].code)
