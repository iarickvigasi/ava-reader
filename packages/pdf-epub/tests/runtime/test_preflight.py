import tempfile
import unittest
from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject, NumberObject

from ava_pdf_epub.runtime.preflight import preflight


class PreflightTests(unittest.TestCase):
    def test_resource_count_is_inclusive_within_one_dictionary(self):
        from ava_pdf_epub.runtime.preflight import _resources

        objects = {str(index): DictionaryObject() for index in range(10000)}
        _resources({"/XObject": objects}, set(), 0)
        objects["overflow"] = DictionaryObject()
        with self.assertRaisesRegex(ValueError, "PDF_RESOURCE_LIMIT"):
            _resources({"/XObject": objects}, set(), 0)

    def test_page_limit_is_not_inferred_from_uploaded_job(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "source.pdf"
            writer = PdfWriter()
            for _ in range(2):
                writer.add_blank_page(width=300, height=400)
            writer.write(source)
            self.assertEqual(preflight(source, 2)["page_count"], 2)
            with self.assertRaisesRegex(ValueError, "PDF_PAGE_LIMIT"):
                preflight(source, 1)

    def test_oversized_raster_is_refused_without_decoding(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "source.pdf"
            for width, height in [(6001, 1), (6000, 6000), (0, 1)]:
                writer = PdfWriter()
                page = writer.add_blank_page(width=300, height=400)
                image = DecodedStreamObject()
                image.set_data(b"intentionally not an image")
                image.update(
                    {
                        NameObject("/Subtype"): NameObject("/Image"),
                        NameObject("/Width"): NumberObject(width),
                        NameObject("/Height"): NumberObject(height),
                    }
                )
                page[NameObject("/Resources")] = DictionaryObject(
                    {
                        NameObject("/XObject"): DictionaryObject(
                            {NameObject("/I"): writer._add_object(image)}
                        )
                    }
                )
                writer.write(source)
                with self.assertRaisesRegex(ValueError, "PDF_RASTER_LIMIT"):
                    preflight(source)

    def test_form_resources_cannot_hide_large_image(self):
        from ava_pdf_epub.runtime.preflight import _resources

        with self.assertRaisesRegex(ValueError, "PDF_RASTER_LIMIT"):
            _resources(
                {
                    "/XObject": {
                        "form": DictionaryObject(
                            {
                                NameObject("/Subtype"): NameObject("/Form"),
                                NameObject("/Resources"): DictionaryObject(
                                    {
                                        NameObject("/XObject"): DictionaryObject(
                                            {
                                                NameObject("/I"): DictionaryObject(
                                                    {
                                                        NameObject("/Subtype"): NameObject(
                                                            "/Image"
                                                        ),
                                                        NameObject("/Width"): NumberObject(6001),
                                                        NameObject("/Height"): NumberObject(1),
                                                    }
                                                )
                                            }
                                        )
                                    }
                                ),
                            }
                        )
                    }
                },
                set(),
                0,
            )
