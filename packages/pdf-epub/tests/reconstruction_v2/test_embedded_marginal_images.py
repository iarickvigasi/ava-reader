"""Source-authored marginal artifacts retain exact pixels/bytes; body raster text stays reviewed."""

import hashlib
import io
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
    TextStringObject,
)

from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.source_feature_contract import FEATURE_POLICY


def artifact_source(
    path,
    *,
    tag="Artifact",
    clip=False,
    matrix=None,
    image_fields=None,
    overlap=False,
    count=3,
    jpeg=False,
):
    image = Image.new("RGB", (120, 30), "white")
    for x in [10, 30, 50, 70]:
        ImageDraw.Draw(image).rectangle((x, 5, x + 9, 22), outline="black", width=2)
    source = PdfWriter()
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    raw = DecodedStreamObject()
    raw.set_data(image.tobytes())
    raw.update(
        {
            NameObject("/Type"): NameObject("/XObject"),
            NameObject("/Subtype"): NameObject("/Image"),
            NameObject("/Width"): NumberObject(120),
            NameObject("/Height"): NumberObject(30),
            NameObject("/ColorSpace"): NameObject("/DeviceRGB"),
            NameObject("/BitsPerComponent"): NumberObject(8),
        }
    )
    if image_fields:
        raw.update(image_fields)
    if jpeg:
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=95)
        raw.set_data(buffer.getvalue())
        raw[NameObject("/Filter")] = NameObject("/DCTDecode")
    reference = source._add_object(raw if jpeg else raw.flate_encode())
    for number in range(count):
        page = source.add_blank_page(width=300, height=400)
        page[NameObject("/Resources")] = DictionaryObject(
            {
                NameObject("/Font"): DictionaryObject({NameObject("/F1"): font}),
                NameObject("/XObject"): DictionaryObject({NameObject("/Logo"): reference}),
            }
        )
        commands = ["BT /F1 16 Tf 20 350 Td (Chapter 1) Tj ET"] if number == 0 else []
        commands += [
            "BT /F1 10 Tf 20 320 Td (Ordinary source words stay available.) Tj "
            "0 -15 Td (The source keeps its original paragraph.) Tj "
            "0 -15 Td (Another independent line remains readable.) Tj ET"
        ]
        y = 305 if overlap else 0
        paint = matrix or f"96 0 0 24 160 {y}"
        rectangle = f"160 {y} {95 if clip else 96} 24 re W n "
        commands += [f"/{tag} BMC q {rectangle}{paint} cm /Logo Do Q EMC"]
        stream = DecodedStreamObject()
        stream.set_data("\n".join(commands).encode())
        page[NameObject("/Contents")] = source._add_object(stream)
        # Each footer URI is an actual separately owned source caller, outside the image.
        footer = DecodedStreamObject()
        footer.set_data(b"/Artifact BMC BT /F1 8 Tf 20 10 Td (www.example.org) Tj ET EMC")
        page[NameObject("/Contents")] = ArrayObject(
            [page.raw_get("/Contents"), source._add_object(footer)]
        )
        annotation = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Annot"),
                NameObject("/Subtype"): NameObject("/Link"),
                NameObject("/Rect"): ArrayObject([NumberObject(n) for n in [20, 7, 95, 19]]),
                NameObject("/A"): DictionaryObject(
                    {
                        NameObject("/S"): NameObject("/URI"),
                        NameObject("/URI"): TextStringObject("https://www.example.org"),
                    }
                ),
            }
        )
        page[NameObject("/Annots")] = ArrayObject([source._add_object(annotation)])
    source.write(path)
    return PdfReader(path).pages[0].images["/Logo"].data


def artifact_table_source(path, *, borderless=False):
    """A repeated image occupies the empty cell of an actual ruled footer table."""
    artifact_source(path, matrix="96 0 0 24 160 1")
    writer = PdfWriter(clone_from=path)
    for page in writer.pages:
        contents = page.get_contents().get_data().replace(b"160 0 96 24 re", b"160 1 96 24 re")
        contents = contents.replace(
            b"/Artifact BMC BT /F1 8 Tf 20 10 Td (www.example.org) Tj ET EMC", b""
        )
        del page["/Annots"]
        page["/Resources"]["/Font"][NameObject("/F2")] = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica-Bold"),
            }
        )
        contents += (
            b"\nBT /F2 8 Tf 20 28 Td (Hp) Tj 250 0 Td (Jp) Tj ET "
            b"BT /F1 8 Tf 20 14 Td (Ap) Tj 250 0 Td (Bp) Tj ET "
            b"BT /F1 8 Tf 20 2 Td (Ep) Tj 250 0 Td (Fp) Tj ET"
            if borderless
            else b"\n0.4 w 20 0 m 280 0 l S 20 30 m 280 30 l S "
            b"20 50 m 280 50 l S 20 0 m 20 50 l S "
            b"140 0 m 140 50 l S 280 0 m 280 50 l S "
            b"BT /F2 8 Tf 30 38 Td (Left) Tj 120 0 Td (Right) Tj ET"
        )
        stream = DecodedStreamObject()
        stream.set_data(contents)
        page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)


class EmbeddedMarginalImageTests(unittest.TestCase):
    def test_three_occurrences_one_exact_resource_and_all_footer_callers_survive_epub(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "book.pdf"
            expected = artifact_source(source)
            sha = hashlib.sha256(source.read_bytes()).hexdigest()
            pages = prepare_source(
                source, root / "scratch", sha, source_feature_policy=FEATURE_POLICY
            )
            self.assertFalse(any(p.tasks for p in pages))
            self.assertEqual(3, sum(s.kind == "figure" for p in pages for s in p.native_segments))
            result = reconstruct(source, root / "scratch", pages, [])
            figures = [b for b in result.book.blocks if b.kind == "figure"]
            self.assertEqual(3, len(figures))
            self.assertTrue(all(b.decorative for b in figures))
            self.assertEqual(1, len({b.resource_id for b in figures}))
            resource = next(r for r in result.book.resources if r.id == figures[0].resource_id)
            actual = result.assets[resource.id]
            self.assertEqual(expected, actual)
            self.assertEqual(hashlib.sha256(expected).hexdigest(), resource.sha256)
            self.assertEqual((120, 30), (resource.width, resource.height))
            with (
                Image.open(io.BytesIO(expected)) as original,
                Image.open(io.BytesIO(actual)) as copied,
            ):
                self.assertEqual(original.tobytes(), copied.tobytes())
            self.assertEqual([1, 2, 3], [f.evidence[0].page for f in figures])
            self.assertEqual(
                3,
                sum(
                    b.content.text == "www.example.org"
                    for b in result.book.blocks
                    if hasattr(b, "content")
                ),
            )
            links = [
                s.link
                for b in result.book.blocks
                if hasattr(b, "content")
                for s in b.content.spans
                if s.link
            ]
            self.assertEqual(3, len(links))
            self.assertTrue(all(link.url == "https://www.example.org" for link in links))
            imported, assets = portable_epub(result.epub)
            self.assertEqual(result.book, imported)
            self.assertEqual(result.assets, assets)
            self.assertEqual(sha, hashlib.sha256(source.read_bytes()).hexdigest())

    def test_unknown_tags_unproven_repetition_clipped_and_mixed_body_images_keep_review(self):
        for options in [
            {"tag": "P"},
            {"count": 2},
            {"clip": True},
            {"matrix": "96 1 0 24 160 0"},
            {"overlap": True},
            {"image_fields": {NameObject("/Mask"): ArrayObject([NumberObject(255)] * 6)}},
            {
                "image_fields": {
                    NameObject("/Decode"): ArrayObject([NumberObject(0), NumberObject(1)] * 3)
                }
            },
        ]:
            with self.subTest(options=options), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                source = root / "book.pdf"
                artifact_source(source, **options)
                pages = prepare_source(
                    source,
                    root / "scratch",
                    hashlib.sha256(source.read_bytes()).hexdigest(),
                    source_feature_policy=FEATURE_POLICY,
                )
                self.assertTrue(any(p.tasks for p in pages))
                self.assertFalse(
                    any(
                        g.source_image and g.source_image.qualified
                        for p in pages
                        for g in p.observation.graphics
                    )
                )

    def test_absent_policy_keeps_historical_raster_route_and_tampered_source_asset_is_refused(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "book.pdf"
            artifact_source(source)
            sha = hashlib.sha256(source.read_bytes()).hexdigest()
            old = prepare_source(source, root / "old", sha)
            self.assertTrue(any(p.tasks for p in old))
            current = prepare_source(
                source, root / "current", sha, source_feature_policy=FEATURE_POLICY
            )
            asset = next(
                g.source_image for p in current for g in p.observation.graphics if g.source_image
            )
            (root / "current" / asset.path).write_bytes(b"changed source image")
            with self.assertRaisesRegex(ValueError, "Source image changed"):
                reconstruct(source, root / "current", current, [])

    def test_source_jpeg_bytes_media_and_pixels_are_not_transcoded(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "jpeg-book.pdf"
            expected = artifact_source(source, jpeg=True)
            pages = prepare_source(
                source,
                root / "scratch",
                hashlib.sha256(source.read_bytes()).hexdigest(),
                source_feature_policy=FEATURE_POLICY,
            )
            self.assertFalse(any(p.tasks for p in pages))
            result = reconstruct(source, root / "scratch", pages, [])
            figure = next(b for b in result.book.blocks if b.kind == "figure")
            resource = next(r for r in result.book.resources if r.id == figure.resource_id)
            self.assertEqual("image/jpeg", resource.media_type)
            self.assertTrue(resource.path.endswith(".jpg"))
            self.assertEqual(expected, result.assets[resource.id])
            imported, assets = portable_epub(result.epub)
            self.assertEqual(result.book, imported)
            self.assertEqual(result.assets, assets)

    def test_repeated_image_inside_native_table_keeps_recognition_instead_of_disappearing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "table-book.pdf"
            artifact_table_source(source)
            pages = prepare_source(
                source,
                root / "scratch",
                hashlib.sha256(source.read_bytes()).hexdigest(),
                source_feature_policy=FEATURE_POLICY,
            )
            self.assertEqual(3, sum(len(p.tables) for p in pages))
            self.assertTrue(all(p.tasks for p in pages))
            self.assertFalse(
                any(
                    g.source_image and g.source_image.qualified
                    for p in pages
                    for g in p.observation.graphics
                )
            )
            with self.assertRaises(ValueError):
                reconstruct(source, root / "scratch", pages, [])

    def test_jpeg_color_transform_requires_compatible_source_appearance(self):
        for transform in [None, 1, 0, 2]:
            with self.subTest(transform=transform), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                source = root / "jpeg-transform.pdf"
                fields = (
                    {}
                    if transform is None
                    else {
                        NameObject("/DecodeParms"): DictionaryObject(
                            {NameObject("/ColorTransform"): NumberObject(transform)}
                        )
                    }
                )
                expected = artifact_source(source, jpeg=True, image_fields=fields)
                pages = prepare_source(
                    source,
                    root / "scratch",
                    hashlib.sha256(source.read_bytes()).hexdigest(),
                    source_feature_policy=FEATURE_POLICY,
                )
                qualified = [
                    g.source_image
                    for p in pages
                    for g in p.observation.graphics
                    if g.source_image and g.source_image.qualified
                ]
                if transform in [None, 1]:
                    self.assertEqual(3, len(qualified))
                    self.assertFalse(any(p.tasks for p in pages))
                    with (
                        Image.open(io.BytesIO(expected)) as copied,
                        Image.open(root / "scratch" / pages[0].observation.render_path) as rendered,
                    ):
                        pixel = rendered.convert("RGB").getpixel(
                            (int(228 / 300 * rendered.width), int(388 / 400 * rendered.height))
                        )
                        self.assertEqual(copied.convert("RGB").getpixel((85, 15)), pixel)
                    result = reconstruct(source, root / "scratch", pages, [])
                    figure = next(b for b in result.book.blocks if b.kind == "figure")
                    self.assertEqual(expected, result.assets[figure.resource_id])
                    imported, assets = portable_epub(result.epub)
                    self.assertEqual(result.book, imported)
                    self.assertEqual(result.assets, assets)
                else:
                    self.assertFalse(qualified)
                    self.assertTrue(all(p.tasks for p in pages))

    def test_repeated_image_inside_inferred_borderless_table_keeps_recognition(self):
        from ava_pdf_epub.reconstruction_v2.borderless_tables import borderless_tables

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "borderless-table-book.pdf"
            artifact_table_source(source, borderless=True)
            pages = prepare_source(
                source,
                root / "scratch",
                hashlib.sha256(source.read_bytes()).hexdigest(),
                source_feature_policy=FEATURE_POLICY,
            )
            self.assertEqual(0, sum(len(p.tables) for p in pages))
            self.assertEqual(3, sum(len(borderless_tables(p.observation)) for p in pages))
            self.assertTrue(all(p.tasks for p in pages))
            self.assertFalse(
                any(
                    g.source_image and g.source_image.qualified
                    for p in pages
                    for g in p.observation.graphics
                )
            )
            with self.assertRaisesRegex(ValueError, "Recognition task coverage is incomplete"):
                reconstruct(source, root / "scratch", pages, [])
