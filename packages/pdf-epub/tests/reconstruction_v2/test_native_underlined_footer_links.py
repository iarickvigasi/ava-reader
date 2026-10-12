"""A source-authored Artifact URI underline is typography, not a raster text owner."""

import hashlib
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject

from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.source_feature_contract import FEATURE_POLICY
from tests.reconstruction_v2.test_embedded_marginal_images import artifact_source


def underlined_footer_source(
    path, *, color="0 0 0", width=95.352, top=8.7, clipped=False, form=False
):
    artifact_source(path)
    writer = PdfWriter(clone_from=path)
    for page in writer.pages:
        content = (
            page.get_contents().get_data().replace(b"/F1 8 Tf 20 10 Td", b"/F1 12 Tf 20 10 Td")
        )
        from pypdf.generic import ArrayObject, NumberObject

        page["/Annots"][0].get_object()[NameObject("/Rect")] = ArrayObject(
            [NumberObject(v) for v in [20, 5, 117, 21]]
        )
        paint = f"/Artifact BMC {color} rg 20 {top} {width} 1.02 re f EMC".encode()
        if clipped:
            paint = b"q 20 8.7 40 1.02 re W n " + paint + b" Q"
        if form:
            from pypdf.generic import DictionaryObject

            shape = DecodedStreamObject()
            shape.set_data(paint)
            shape.update(
                {
                    NameObject("/Type"): NameObject("/XObject"),
                    NameObject("/Subtype"): NameObject("/Form"),
                    NameObject("/BBox"): ArrayObject([NumberObject(v) for v in [0, 0, 300, 400]]),
                    NameObject("/Resources"): DictionaryObject(),
                }
            )
            page["/Resources"]["/XObject"][NameObject("/Underline")] = writer._add_object(shape)
            paint = b"/Underline Do"
        content += b"\n" + paint
        stream = DecodedStreamObject()
        stream.set_data(content)
        page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)


class NativeUnderlinedFooterLinks(unittest.TestCase):
    def test_exact_native_uri_underline_preserves_all_callers_styles_and_epub(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "book.pdf"
            underlined_footer_source(source)
            sha = hashlib.sha256(source.read_bytes()).hexdigest()
            pages = prepare_source(
                source, root / "scratch", sha, source_feature_policy=FEATURE_POLICY
            )
            result = reconstruct(source, root / "scratch", pages, [])
            credits = [
                b
                for b in result.book.blocks
                if b.kind == "credit" and b.content.text == "www.example.org"
            ]
            self.assertEqual(3, len(credits))
            for credit in credits:
                style = next(s for s in result.book.styles if s.id == credit.style_id)
                self.assertTrue(style.underline)
                links = [s for s in credit.content.spans if s.link]
                self.assertEqual(1, len(links))
                self.assertEqual((0, len(credit.content.text)), (links[0].start, links[0].end))
                self.assertEqual("https://www.example.org", links[0].link.url)
            imported, assets = portable_epub(result.epub)
            self.assertEqual(result.book, imported)
            self.assertEqual(result.assets, assets)
            self.assertEqual(sha, hashlib.sha256(source.read_bytes()).hexdigest())

    def test_unproved_color_width_or_strike_geometry_keeps_strict_link_refusal(self):
        for options in [
            {"color": "1 0 0"},
            {"width": 92},
            {"top": 14},
            {"clipped": True},
            {"form": True},
        ]:
            with self.subTest(options=options), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                source = root / "book.pdf"
                underlined_footer_source(source, **options)
                pages = prepare_source(
                    source,
                    root / "scratch",
                    hashlib.sha256(source.read_bytes()).hexdigest(),
                    source_feature_policy=FEATURE_POLICY,
                )
                with self.assertRaisesRegex(ValueError, "PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW"):
                    reconstruct(source, root / "scratch", pages, [])

    def test_separation_tint_is_not_device_gray_underline_authority(self):
        from pypdf.generic import ArrayObject, DictionaryObject, NumberObject

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "book.pdf"
            underlined_footer_source(source)
            writer = PdfWriter(clone_from=source)
            function = DictionaryObject(
                {
                    NameObject("/FunctionType"): NumberObject(2),
                    NameObject("/Domain"): ArrayObject([NumberObject(0), NumberObject(1)]),
                    NameObject("/C0"): ArrayObject(
                        [NumberObject(1), NumberObject(0), NumberObject(0)]
                    ),
                    NameObject("/C1"): ArrayObject([NumberObject(0)] * 3),
                    NameObject("/N"): NumberObject(1),
                }
            )
            spot = ArrayObject(
                [
                    NameObject("/Separation"),
                    NameObject("/RedSpot"),
                    NameObject("/DeviceRGB"),
                    writer._add_object(function),
                ]
            )
            for page in writer.pages:
                page["/Resources"][NameObject("/ColorSpace")] = DictionaryObject(
                    {NameObject("/Spot"): spot}
                )
                content = (
                    page.get_contents()
                    .get_data()
                    .replace(
                        b"/Artifact BMC 0 0 0 rg 20 8.7", b"/Artifact BMC /Spot cs 0 scn 20 8.7"
                    )
                )
                stream = DecodedStreamObject()
                stream.set_data(content)
                page[NameObject("/Contents")] = writer._add_object(stream)
            writer.write(source)
            pages = prepare_source(
                source,
                root / "scratch",
                hashlib.sha256(source.read_bytes()).hexdigest(),
                source_feature_policy=FEATURE_POLICY,
            )
            self.assertFalse(
                any(g.underline_line_id for p in pages for g in p.observation.graphics)
            )
            with self.assertRaisesRegex(ValueError, "PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW"):
                reconstruct(source, root / "scratch", pages, [])
