"""Authored direct-page source roles qualify furniture and bounded native item wraps."""

import hashlib
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NullObject,
    NumberObject,
)

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.source_feature_contract import FEATURE_POLICY
from tests.reconstruction_v2.test_embedded_marginal_images import artifact_source


def tagged_source(
    path,
    *,
    namespace="valid",
    indent=38,
    gap=14,
    tag="P",
    banner_tag="Artifact",
    unique_banner=False,
    separate_label=False,
    ends_sentence=False,
):
    artifact_source(path)
    writer = PdfWriter(clone_from=path)
    structure = DictionaryObject({NameObject("/Type"): NameObject("/StructTreeRoot")})
    structure_ref = writer._add_object(structure)
    elements, nums = ArrayObject(), ArrayObject()
    for index, page in enumerate(writer.pages):
        page[NameObject("/StructParents")] = NumberObject(index)
        bold = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica-Bold"),
            }
        )
        page["/Resources"]["/Font"][NameObject("/F2")] = bold
        content = page.get_contents().get_data()
        old = (
            b"BT /F1 10 Tf 20 320 Td (Ordinary source words stay available.) Tj "
            b"0 -15 Td (The source keeps its original paragraph.) Tj "
            b"0 -15 Td (Another independent line remains readable.) Tj ET"
        )
        number = 13 + 12 * index
        body = (
            f"/{tag} << /MCID 3 >> BDC BT /F1 10 Tf 20 320 Td "
            f"({number}. One question wraps into) Tj ET "
            f"BT /F1 10 Tf {indent} {320 - gap} Td (the complete item and ) Tj "
            f"/F2 10 Tf (emphasis.) Tj ET EMC "
            f"/P << /MCID 4 >> BDC BT /F1 10 Tf 20 270 Td "
            f"({number + 1}. A separate numbered item stays separate.) Tj ET EMC"
        ).encode()
        if ends_sentence:
            body = body.replace(b"One question wraps into)", b"One question wraps into.)")
        if separate_label:
            opening = (
                f"/{tag} << /MCID 3 >> BDC BT /F1 10 Tf 20 320 Td "
                f"({number}. One question wraps into) Tj ET"
            )
            replacement = (
                f"/Artifact BMC BT /F1 10 Tf 20 320 Td ({number}. ) Tj ET EMC "
                f"/{tag} << /MCID 3 >> BDC BT /F1 10 Tf 36.68 320 Td "
                "(One question wraps into) Tj ET"
            )
            assert opening.encode() in body
            body = body.replace(opening.encode(), replacement.encode())
        if namespace == "duplicate_instance":
            body = body.replace(
                b"Tj ET BT /F1 10 Tf 38 306 Td",
                b"Tj ET EMC /P << /MCID 3 >> BDC BT /F1 10 Tf 38 306 Td",
            )
        if namespace == "contradictory_instance":
            body += (
                b" /Caption << /MCID 3 >> BDC BT /F1 10 Tf 20 200 Td "
                b"(Separate source text.) Tj ET EMC"
            )
        if namespace == "form":
            form = DecodedStreamObject()
            form.set_data(body)
            form.update(
                {
                    NameObject("/Type"): NameObject("/XObject"),
                    NameObject("/Subtype"): NameObject("/Form"),
                    NameObject("/BBox"): ArrayObject([NumberObject(x) for x in [0, 0, 300, 400]]),
                    NameObject("/Resources"): page["/Resources"],
                }
            )
            page["/Resources"]["/XObject"][NameObject("/Body")] = writer._add_object(form)
            body = b"/Body Do"
        content = content.replace(old, body)
        banner = (
            ["Unique one", "Unique two", "Unique three"][index]
            if unique_banner
            else "Source banner"
        )
        content += f"\n/{banner_tag} BMC BT /F1 26 Tf 20 375 Td ({banner}) Tj ET EMC".encode()
        if index == 0:
            content = content.replace(
                b"BT /F1 16 Tf 20 350 Td (Chapter 1) Tj ET",
                b"/P << /MCID 0 >> BDC BT /F1 16 Tf 20 350 Td (Chapter 1) Tj ET EMC",
            )
        stream = DecodedStreamObject()
        stream.set_data(content)
        page[NameObject("/Contents")] = writer._add_object(stream)
        entries = ArrayObject([NullObject() for _ in range(5)])
        for mcid, role in [(0, "P"), (3, "LBody"), (4, "LBody")]:
            element = DictionaryObject(
                {
                    NameObject("/Type"): NameObject("/StructElem"),
                    NameObject("/S"): NameObject("/" + role),
                    NameObject("/P"): structure_ref,
                    NameObject("/Pg"): (
                        writer.pages[(index + 1) % 3].indirect_reference
                        if namespace == "wrong_page"
                        else page.indirect_reference
                    ),
                    NameObject("/K"): ArrayObject(
                        [NumberObject(2 if namespace == "wrong_mcid" and mcid == 3 else mcid)]
                    ),
                }
            )
            ref = writer._add_object(element)
            elements.append(ref)
            entries[mcid] = ref
        nums.extend([NumberObject(index), entries])
    structure[NameObject("/K")] = elements
    structure[NameObject("/ParentTree")] = writer._add_object(
        DictionaryObject({NameObject("/Nums"): nums})
    )
    if namespace != "missing":
        writer._root_object[NameObject("/StructTreeRoot")] = structure_ref
    writer.write(path)


class TaggedNativeFurnitureAndWrapTests(unittest.TestCase):
    def test_repeated_artifact_banner_and_logos_do_not_interrupt_items(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "book.pdf"
            tagged_source(source)
            sha = hashlib.sha256(source.read_bytes()).hexdigest()
            pages = prepare_source(
                source,
                root / "scratch",
                sha,
                profile_id=BILINGUAL_PROFILE,
                source_feature_policy=FEATURE_POLICY,
            )
            self.assertFalse(any(p.tasks for p in pages))
            result = reconstruct(source, root / "scratch", pages, [])
            texts = [b.content.text for b in result.book.blocks if hasattr(b, "content")]
            self.assertNotIn("Source banner", texts)
            self.assertIn("Chapter 1", texts)
            expected = ["One question wraps into the complete item and emphasis." for _ in range(3)]
            questions = [
                b
                for b in result.book.blocks
                if b.kind == "list_item" and "One question" in b.content.text
            ]
            self.assertEqual(expected, [b.content.text for b in questions])
            for page_number, question in zip([1, 2, 3], questions, strict=True):
                address = next(a for a in result.book.addresses if a.source_page == page_number)
                if page_number > 1:
                    self.assertEqual(question.id, address.target.block_id)
                    self.assertEqual(0, address.target.offset)
            self.assertEqual(3, sum("A separate numbered item stays separate." == t for t in texts))
            self.assertEqual(3, len([t for t in texts if t == "www.example.org"]))
            links = [
                s.link
                for b in result.book.blocks
                if hasattr(b, "content")
                for s in b.content.spans
                if s.link
            ]
            self.assertEqual(3, len(links))
            self.assertTrue(all(link.url == "https://www.example.org" for link in links))
            figures = [b for b in result.book.blocks if b.kind == "figure"]
            self.assertEqual(1, len(figures))
            self.assertEqual(figures[0].id, result.book.blocks[-1].id)
            self.assertTrue(figures[0].decorative)
            self.assertEqual([3], [e.page for e in figures[0].evidence])
            resource = next(r for r in result.book.resources if r.id == figures[0].resource_id)
            self.assertEqual([1, 2, 3], [e.page for e in resource.evidence])
            self.assertEqual(
                3,
                sum(
                    r.role == "furniture" and r.box.x0 == 160
                    for p in result.book.pages
                    for r in p.regions
                ),
            )
            for question in questions:
                spans = [
                    s
                    for s in question.content.spans
                    if s.style_id and s.start <= question.content.text.index("emphasis") < s.end
                ]
                self.assertTrue(spans)
                self.assertTrue(
                    any(
                        next(st for st in result.book.styles if st.id == s.style_id).bold
                        for s in spans
                    )
                )
                question.content.normalization.validate_canonical(question.content.text)
            imported, assets = portable_epub(result.epub)
            self.assertEqual(result.book, imported)
            self.assertEqual(result.assets, assets)
            self.assertEqual(sha, hashlib.sha256(source.read_bytes()).hexdigest())

    def test_missing_contradictory_form_and_nonwrap_geometry_do_not_authorize_item_join(self):
        for options in [
            {"namespace": "missing"},
            {"namespace": "duplicate_instance"},
            {"namespace": "contradictory_instance"},
            {"namespace": "wrong_page"},
            {"namespace": "wrong_mcid"},
            {"namespace": "form"},
            {"tag": "Caption"},
            {"indent": 20},
            {"gap": 40},
        ]:
            with self.subTest(options=options), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                source = root / "book.pdf"
                tagged_source(source, **options)
                pages = prepare_source(
                    source,
                    root / "scratch",
                    hashlib.sha256(source.read_bytes()).hexdigest(),
                    profile_id=BILINGUAL_PROFILE,
                    source_feature_policy=FEATURE_POLICY,
                )
                items = [
                    s
                    for p in pages
                    for s in p.native_segments
                    if s.kind == "list_item" and "One question" in s.text
                ]
                self.assertEqual(3, len(items))
                self.assertTrue(all("complete item" not in s.text for s in items))

    def test_absent_policy_retains_historical_glyph_projection(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "book.pdf"
            tagged_source(source)
            pages = prepare_source(
                source, root / "old", hashlib.sha256(source.read_bytes()).hexdigest()
            )
            dumps = [
                g.model_dump() for p in pages for line in p.observation.lines for g in line.glyphs
            ]
            self.assertTrue(dumps)
            self.assertTrue(
                all("source_artifact" not in g and "list_body_mcid" not in g for g in dumps)
            )

    def test_large_repeated_P_titles_and_unique_Artifact_text_remain_content(self):
        from ava_pdf_epub.reconstruction_v2.qualify_pages import qualify_pages

        for options in [{"banner_tag": "P"}, {"unique_banner": True}]:
            with self.subTest(options=options), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                source = root / "book.pdf"
                tagged_source(source, **options)
                pages = prepare_source(
                    source,
                    root / "scratch",
                    hashlib.sha256(source.read_bytes()).hexdigest(),
                    profile_id=BILINGUAL_PROFILE,
                    source_feature_policy=FEATURE_POLICY,
                )
                qualified = qualify_pages(source, root / "scratch", pages, [])
                banners = [
                    s
                    for local in qualified.values()
                    for s in local
                    if s.text == "Source banner" or s.text.startswith("Unique ")
                ]
                self.assertEqual(3, len(banners))
                self.assertTrue(all(s.kind != "furniture" for s in banners))

    def test_linked_image_occurrence_keeps_all_same_resource_occurrences_in_source_order(self):
        from pypdf.generic import TextStringObject

        from ava_pdf_epub.reconstruction_v2.assemble_pages import assemble_pages
        from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
        from ava_pdf_epub.reconstruction_v2.linked_furniture import preserve_linked_furniture
        from ava_pdf_epub.reconstruction_v2.qualify_pages import qualify_pages

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "book.pdf"
            tagged_source(source)
            writer = PdfWriter(clone_from=source)
            link = DictionaryObject(
                {
                    NameObject("/Type"): NameObject("/Annot"),
                    NameObject("/Subtype"): NameObject("/Link"),
                    NameObject("/Rect"): ArrayObject([NumberObject(v) for v in [160, 0, 256, 24]]),
                    NameObject("/A"): DictionaryObject(
                        {
                            NameObject("/S"): NameObject("/URI"),
                            NameObject("/URI"): TextStringObject("https://www.example.org/logo"),
                        }
                    ),
                }
            )
            writer.pages[0]["/Annots"].append(writer._add_object(link))
            writer.write(source)
            pages = prepare_source(
                source,
                root / "scratch",
                hashlib.sha256(source.read_bytes()).hexdigest(),
                profile_id=BILINGUAL_PROFILE,
                source_feature_policy=FEATURE_POLICY,
            )
            state = AssemblyState()
            qualified = preserve_linked_furniture(
                source, pages, qualify_pages(source, root / "scratch", pages, []), state
            )
            _, ordered = assemble_pages(pages, qualified, state)
            figures = [s for s in ordered if s.kind == "figure"]
            self.assertEqual([1, 2, 3], [s.page for s in figures])
            self.assertEqual(1, len({s.source_image.sha256 for s in figures}))
            self.assertFalse(any(s.source_marginal_furniture for s in figures))

    def test_distinct_decorations_stay_on_their_last_actual_page_before_later_body(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "book.pdf"
            artifact_source(source, count=5)
            writer = PdfWriter(clone_from=source)
            image = writer.pages[0]["/Resources"]["/XObject"]["/Logo"].get_object()
            raw = bytearray(image.get_data())
            raw[-3:] = bytes([255, 0, 0])
            second = DecodedStreamObject()
            second.set_data(bytes(raw))
            for key, value in image.items():
                if str(key) not in {"/Length", "/Filter", "/DecodeParms"}:
                    second[key] = value
            second_ref = writer._add_object(second.flate_encode())
            first_paint = b"/Artifact BMC q 160 0 96 24 re W n 96 0 0 24 160 0 cm /Logo Do Q EMC"
            second_paint = b"/Artifact BMC q 20 0 96 24 re W n 96 0 0 24 20 0 cm /LogoB Do Q EMC"
            for number, page in enumerate(writer.pages, 1):
                content = page.get_contents().get_data()
                content = content.replace(
                    b"/Artifact BMC BT /F1 8 Tf 20 10 Td (www.example.org) Tj ET EMC", b""
                )
                del page["/Annots"]
                page["/Resources"]["/XObject"][NameObject("/LogoB")] = second_ref
                content = content.replace(
                    first_paint,
                    (first_paint if number in [1, 4, 5] else b"")
                    + (b"\n" + second_paint if number in [2, 3, 4] else b""),
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
            self.assertFalse(any(p.tasks for p in pages))
            result = reconstruct(source, root / "scratch", pages, [])
            figures = [b for b in result.book.blocks if b.kind == "figure"]
            self.assertEqual([[4], [5]], [[e.page for e in b.evidence] for b in figures])
            self.assertEqual(
                [[2, 3, 4], [1, 4, 5]],
                [
                    [
                        e.page
                        for e in next(
                            r for r in result.book.resources if r.id == b.resource_id
                        ).evidence
                    ]
                    for b in figures
                ],
            )
            body5 = next(
                b
                for b in result.book.blocks
                if hasattr(b, "content") and any(e.page == 5 for e in b.evidence)
            )
            self.assertLess(result.book.blocks.index(figures[0]), result.book.blocks.index(body5))
            self.assertLess(result.book.blocks.index(body5), result.book.blocks.index(figures[1]))
            imported, assets = portable_epub(result.epub)
            self.assertEqual(result.book, imported)
            self.assertEqual(result.assets, assets)

    def test_printed_label_outside_list_body_namespace_keeps_checked_body_wrap(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "book.pdf"
            tagged_source(source, separate_label=True)
            pages = prepare_source(
                source,
                root / "scratch",
                hashlib.sha256(source.read_bytes()).hexdigest(),
                profile_id=BILINGUAL_PROFILE,
                source_feature_policy=FEATURE_POLICY,
            )
            items = [
                s
                for p in pages
                for s in p.native_segments
                if s.kind == "list_item" and "One question" in s.text
            ]
            self.assertEqual(3, len(items))
            self.assertTrue(all("the complete item and emphasis." in s.text for s in items))
            self.assertTrue(all(len(s.native_line_ids) == 2 for s in items))
            result = reconstruct(source, root / "scratch", pages, [])
            imported, assets = portable_epub(result.epub)
            self.assertEqual(result.book, imported)
            self.assertEqual(result.assets, assets)

    def test_sentence_ending_inside_one_checked_list_paragraph_keeps_item_complete(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "book.pdf"
            tagged_source(source, ends_sentence=True)
            pages = prepare_source(
                source,
                root / "scratch",
                hashlib.sha256(source.read_bytes()).hexdigest(),
                profile_id=BILINGUAL_PROFILE,
                source_feature_policy=FEATURE_POLICY,
            )
            result = reconstruct(source, root / "scratch", pages, [])
            items = [
                b
                for b in result.book.blocks
                if b.kind == "list_item" and "One question" in b.content.text
            ]
            self.assertEqual(
                ["One question wraps into. the complete item and emphasis."] * 3,
                [b.content.text for b in items],
            )
