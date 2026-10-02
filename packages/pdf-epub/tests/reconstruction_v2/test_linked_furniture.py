import tempfile
import unittest
from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, NumberObject, TextStringObject

from ava_pdf_epub.reconstruction_v2.assemble_pages import assemble_pages
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.linked_furniture import preserve_linked_furniture
from ava_pdf_epub.reconstruction_v2.prepared import PreparedPage

from .test_pdf_links import box, observation
from .test_refinement_grouping import segment


class LinkedFurniture(unittest.TestCase):
    def test_annotation_linked_footer_survives_without_model_link_guess(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "source.pdf"
            writer = PdfWriter()
            writer.add_blank_page(width=100, height=100)
            writer.add_annotation(
                0,
                DictionaryObject(
                    {
                        NameObject("/Type"): NameObject("/Annot"),
                        NameObject("/Subtype"): NameObject("/Link"),
                        NameObject("/Rect"): ArrayObject(
                            [NumberObject(v) for v in [10, 10, 90, 20]]
                        ),
                        NameObject("/A"): DictionaryObject(
                            {
                                NameObject("/S"): NameObject("/URI"),
                                NameObject("/URI"): TextStringObject("https://example.org"),
                            }
                        ),
                    }
                ),
            )
            with source.open("wb") as handle:
                writer.write(handle)
            page = PreparedPage(
                schema_version="ava-prepared-page-1",
                tables=[],
                tasks=[],
                source_sha256="a" * 64,
                source_byte_length=source.stat().st_size,
                source_page_count=1,
                observation=observation(),
                native_segments=[],
            )
            footer = segment("footer", "Publisher").model_copy(
                update={"kind": "furniture", "box": box(10, 80, 90, 90)}
            )
            folio = segment("folio", "1").model_copy(
                update={"kind": "furniture", "box": box(0, 80, 5, 90)}
            )
            state = AssemblyState()
            qualified = preserve_linked_furniture(source, [page], {1: [footer, folio]}, state)
            self.assertEqual([s.kind for s in qualified[1]], ["credit", "furniture"])
            _, retained = assemble_pages([page], qualified, state)
            self.assertEqual([s.id for s in retained], ["footer"])
            self.assertEqual(retained[0].text, footer.text)
            self.assertEqual(footer.kind, "furniture")
            self.assertEqual(state.structure_findings[0].code, "PDF_LINKED_FURNITURE_PRESERVED")
