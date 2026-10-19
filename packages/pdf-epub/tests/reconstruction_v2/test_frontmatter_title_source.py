"""Actual authored PDF preparation, Title2 application, canonical graph and EPUB export."""

import hashlib
import io
import tempfile
import unittest
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from pypdf import PdfWriter

from ava_pdf_epub.reconstruction_v2.prepare_refinement_source import prepare_refinement_source
from ava_pdf_epub.reconstruction_v2.protocol_frontmatter_title import (
    FrontmatterTitleReconstructionInput,
)
from ava_pdf_epub.reconstruction_v2.reconstruct_source import reconstruct_source

from .frontmatter_title_fixture import (
    TITLE,
    authored_frontmatter_pdf,
    authored_frontmatter_receipts,
)


def request(source, refinements=None):
    return FrontmatterTitleReconstructionInput(
        schema_version="ava-reconstruct-input-7",
        source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
        profile_id="ava-pdf-prose-en-uk-v3",
        source_feature_policy="ava-ocr-source-features-1",
        source_layout_policy="ava-native-layout-1",
        source_structure_policy="ava-native-structure-1",
        source_normalization_policy="ava-native-word-wrap-1",
        recognition_repair_policy="ava-recognition-geometry-repair-1",
        source_title_policy="ava-frontmatter-title-1",
        responses=[],
        native_structure_responses=[],
        refinements=refinements or [],
        word_wrap_responses=[],
        geometry_corrections=[],
    )


class FrontmatterTitleSourceTests(unittest.TestCase):
    def test_full_source_title_and_alias_navigation_survive_export_without_body_rewrite(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            source = base / "source.pdf"
            authored_frontmatter_pdf(source)
            batch = prepare_refinement_source(source, base / "prepare", request(source))
            positive, _ = reconstruct_source(
                source,
                base / "positive",
                request(source, authored_frontmatter_receipts(batch.tasks)),
            )
            declined, _ = reconstruct_source(
                source,
                base / "declined",
                request(source, authored_frontmatter_receipts(batch.tasks, selected=False)),
            )
            book = positive.book
            self.assertEqual("frontmatter", book.chapters[0].role)
            self.assertEqual(
                ["The Harbour", "The Orchard"],
                [c.title for c in book.chapters if c.role == "bodymatter"],
            )
            self.assertEqual(
                [b.model_dump() for b in book.blocks],
                [b.model_dump() for b in declined.book.blocks],
            )
            self.assertEqual(book.styles, declined.book.styles)
            body_ids = {c.id for c in book.chapters if c.role == "bodymatter"}
            self.assertEqual(
                [t for t in book.toc if t.target.chapter_id in body_ids],
                [t for t in declined.book.toc if t.target.chapter_id in body_ids],
            )
            title = next(c for c in book.metadata if c.field == "title" and c.status == "accepted")
            self.assertEqual(TITLE, title.value)
            self.assertEqual([4], [e.page for e in title.evidence])
            self.assertFalse(
                any(c.field == "title" and c.status == "accepted" for c in declined.book.metadata)
            )
            self.assertEqual(
                ["Ada Walker"],
                [
                    c.value
                    for c in book.metadata
                    if c.field == "contributor" and c.status == "accepted"
                ],
            )
            labels = [t.label for t in book.toc]
            self.assertLess(labels.index("Cover"), labels.index("The Harbour"))
            self.assertLess(labels.index("Title: " + TITLE), labels.index("The Harbour"))
            for label, page in [
                ("Cover", 1),
                ("Half title", 2),
                ("Title: " + TITLE, 4),
                ("Contents", 5),
            ]:
                entry = next(t for t in book.toc if t.label == label)
                address = next(a for a in book.addresses if a.source_page == page)
                self.assertEqual(address.target, entry.target)
            contents = [
                b for b in book.blocks if hasattr(b, "content") and "...." in b.content.text
            ]
            self.assertEqual(2, len(contents))
            self.assertTrue(all(any(s.link for s in b.content.spans) for b in contents))
            with zipfile.ZipFile(io.BytesIO(positive.epub)) as archive:
                opf = ET.fromstring(archive.read("EPUB/package.opf"))
                self.assertEqual(
                    TITLE, opf.find("{*}metadata/{http://purl.org/dc/elements/1.1/}title").text
                )
                nav = ET.fromstring(archive.read("EPUB/nav/nav.xhtml"))
                anchors = [
                    "".join(a.itertext()) for a in nav.iter("{http://www.w3.org/1999/xhtml}a")
                ]
                self.assertLess(anchors.index("Cover"), anchors.index("The Harbour"))
                self.assertIn("Title: " + TITLE, anchors)

    def test_unknown_actual_body_bookmark_still_refuses(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            source = base / "source.pdf"
            authored_frontmatter_pdf(source)
            writer = PdfWriter(clone_from=str(source))
            writer.add_outline_item("Unknown conflicting body label", 5)
            writer.write(source)
            with self.assertRaisesRegex(ValueError, "disagrees"):
                prepare_refinement_source(source, base / "scratch", request(source))

    def test_no_bookmark_new_policy_title_precedes_body_in_actual_epub_navigation(self):
        from pypdf.generic import NameObject

        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            source = base / "source.pdf"
            authored_frontmatter_pdf(source)
            writer = PdfWriter(clone_from=str(source))
            del writer.root_object[NameObject("/Outlines")]
            writer.write(source)
            batch = prepare_refinement_source(source, base / "prepare", request(source))
            result, _ = reconstruct_source(
                source, base / "result", request(source, authored_frontmatter_receipts(batch.tasks))
            )
            self.assertEqual(TITLE, result.book.toc[0].label)
            self.assertEqual(TITLE, result.book.chapters[0].title)
            with zipfile.ZipFile(io.BytesIO(result.epub)) as archive:
                nav = ET.fromstring(archive.read("EPUB/nav/nav.xhtml"))
                labels = [
                    "".join(a.itertext()) for a in nav.iter("{http://www.w3.org/1999/xhtml}a")
                ]
                self.assertLess(labels.index(TITLE), labels.index("The Harbour"))
