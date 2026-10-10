from __future__ import annotations

import hashlib
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from xml.dom import minidom

from PIL import Image
from pydantic import ValidationError

from ava_pdf_epub.epub import build_epub
from ava_pdf_epub.inline import EPUB, XHTML, xml_id
from ava_pdf_epub.models import (
    Asset,
    Block,
    Book,
    Chapter,
    Claim,
    Evidence,
    Page,
    PageBreak,
    Span,
    Style,
)
from ava_pdf_epub.styles import compile_styles
from ava_pdf_epub.validation import resolve_internal, validate_resources


def block(id_: str, text: str, kind: str = "paragraph", page: int = 1, **kwargs: object) -> Block:
    return Block.model_validate(
        {
            "id": id_,
            "kind": kind,
            "text": text,
            "evidence": [Evidence(page=page, method="review")],
            **kwargs,
        }
    )


def fixture() -> Book:
    return Book(
        source_sha256="a" * 64,
        page_count=2,
        pages=[
            Page(
                number=1,
                label="i",
                width=600.0,
                height=800.0,
                route="replay",
                blocks=[
                    block("preface", "An introductory paragraph."),
                    block("head1", "I. PLAY", "heading"),
                    block(
                        "body1",
                        "A Greek ἀγών & <word>1 then 1.",
                        spans=[
                            Span(start=8, end=12, kind="em"),
                            Span(start=21, end=22, kind="noteref", target="note2"),
                            Span(start=28, end=29, kind="noteref", target="note2"),
                        ],
                    ),
                ],
            ),
            Page(
                number=2,
                label="1",
                width=600.0,
                height=800.0,
                route="replay",
                blocks=[
                    block("head2", "II. CULTURE", "heading", page=2),
                    block("body2", "Text on the second page.\r\nLiteral line.", page=2),
                    block("note2", "An explanatory note & its words.", "note", page=2, label="1"),
                ],
            ),
        ],
        chapters=[
            Chapter(id="chapter1", title="Play", start_block_id="head1", verified=True),
            Chapter(
                id="chapter2",
                title="Culture",
                start_block_id="head2",
                verified=True,
                parent_id="chapter1",
            ),
        ],
        metadata=[
            Claim(field="title", value="Homo & Ludens", status="accepted"),
            Claim(field="author", value="J. Huizinga", status="accepted"),
            Claim(field="translator", value="A. Translator", status="accepted"),
            Claim(field="language", value="en", status="accepted"),
            Claim(field="isbn", value="0710005784", status="accepted"),
            Claim(field="reprint_year", value="1980", status="accepted"),
            Claim(
                field="modified",
                value="2026-09-27T12:00:00Z",
                status="accepted",
                scope="conversion",
            ),
        ],
    )


class EpubTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.output = self.root / "book.epub"

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def resources(self) -> dict[str, bytes]:
        with zipfile.ZipFile(self.output) as archive:
            return {name: archive.read(name) for name in archive.namelist()}

    def test_chapter_partition_frontmatter_nested_navigation_and_exact_text(self) -> None:
        book = fixture()
        report = build_epub(book, self.root, self.output)
        self.assertTrue(report["export_valid"])
        self.assertEqual(report["issues"], [])
        self.assertEqual(len(report["content_files"]), 3)
        resources = self.resources()
        root = ET.fromstring(resources["EPUB/nav.xhtml"])
        toc = next(n for n in root.iter() if n.get(f"{{{EPUB}}}type") == "toc")
        nested = toc.findall(f"{{{XHTML}}}ol/{{{XHTML}}}li/{{{XHTML}}}ol/{{{XHTML}}}li")
        self.assertEqual(len(nested), 1)
        self.assertIn(b"I. PLAY", resources["EPUB/text/chapter-0001.xhtml"])
        self.assertNotIn(b"introductory", resources["EPUB/text/chapter-0001.xhtml"])
        expected = {b.id: b.text for p in book.pages for b in p.blocks}
        checks = validate_resources(resources, expected, 2)
        self.assertTrue(checks["passed"], checks)
        self.assertEqual(checks["canonical_blocks"], 6)
        self.assertIn(b"&amp;", resources["EPUB/text/chapter-0001.xhtml"])
        self.assertIn(b"&lt;word&gt;", resources["EPUB/text/chapter-0001.xhtml"])

    def test_cross_file_note_has_one_body_and_two_backlinks(self) -> None:
        report = build_epub(fixture(), self.root, self.output)
        self.assertEqual(report["counts"]["resolved_note_references"], 2)
        resources = self.resources()
        first = ET.fromstring(resources["EPUB/text/chapter-0001.xhtml"])
        refs = [n for n in first.iter() if n.get(f"{{{EPUB}}}type") == "noteref"]
        self.assertEqual(len(refs), 2)
        self.assertEqual(len({n.get("id") for n in refs}), 2)
        self.assertTrue(all(n.get("href", "").startswith("chapter-0002.xhtml#") for n in refs))
        second = ET.fromstring(resources["EPUB/text/chapter-0002.xhtml"])
        self.assertEqual(len([n for n in second.iter() if n.get("role") == "doc-footnote"]), 1)
        backs = [n for n in second.iter() if n.get("role") == "doc-backlink"]
        self.assertEqual(len(backs), 2)
        self.assertTrue(all(n.get("href", "").startswith("chapter-0001.xhtml#") for n in backs))

    def test_missing_or_wrong_note_target_is_issue_and_plain_text_not_broken_href(self) -> None:
        for target in ("absent", "head2"):
            with self.subTest(target=target):
                book = fixture()
                book.pages[0].blocks[2].spans = [
                    Span(start=0, end=1, kind="noteref", target=target)
                ]
                report = build_epub(book, self.root, self.output)
                self.assertTrue(report["export_valid"])
                self.assertTrue(
                    any(
                        i["code"] in {"unresolved_link", "noteref_target_not_note"}
                        for i in report["issues"]
                    )
                )
                self.assertEqual(report["counts"]["resolved_note_references"], 0)

    def test_repeated_printed_note_labels_are_independent(self) -> None:
        book = fixture()
        book.pages[0].blocks.append(block("note1", "First note.", "note", label="1"))
        book.pages[0].blocks[2].spans[0] = Span(start=0, end=1, kind="noteref", target="note1")
        report = build_epub(book, self.root, self.output)
        self.assertEqual(report["counts"]["notes"], 2)
        self.assertEqual(report["counts"]["resolved_note_references"], 3)
        self.assertTrue(report["validation"]["passed"])

    def test_duplicate_block_and_overlapping_link_spans_rejected(self) -> None:
        book = fixture()
        book.pages[0].blocks.append(block("body2", "Duplicate ID"))
        with self.assertRaises(ValidationError):
            build_epub(book, self.root, self.output)
        with self.assertRaises(ValidationError):
            block(
                "b",
                "abcd",
                spans=[
                    Span(start=0, end=3, kind="link", target="x"),
                    Span(start=2, end=4, kind="noteref", target="y"),
                ],
            )
        self.assertFalse(self.output.exists())

    def test_crossing_style_ranges_and_unicode_offsets_conserve_text(self) -> None:
        book = fixture()
        book.pages[0].blocks[2] = block(
            "body1",
            "A😀bcé text",
            spans=[
                Span(start=1, end=5, kind="em"),
                Span(start=3, end=8, kind="strong"),
                Span(start=2, end=7, kind="smallcaps"),
            ],
        )
        report = build_epub(book, self.root, self.output)
        self.assertTrue(report["validation"]["passed"])
        data = self.resources()["EPUB/text/chapter-0001.xhtml"]
        self.assertIn(b"<em>", data)
        self.assertIn(b"<strong>", data)

    def test_reopened_parent_subtree_cannot_reorder_nested_toc(self) -> None:
        book = fixture()
        book.chapters[1].parent_id = None
        book.chapters.append(
            Chapter(
                id="third",
                title="Third",
                start_block_id="body2",
                parent_id="chapter1",
                verified=True,
            )
        )
        with self.assertRaisesRegex(ValueError, "contiguous"):
            build_epub(book, self.root, self.output)

    def test_external_hyperlinks_allowed_unsafe_schemes_stay_plain(self) -> None:
        for target, allowed in [
            ("https://example.org/a?x=1&y=2", True),
            ("mailto:reader@example.org", True),
            ("javascript:alert(1)", False),
            ("file:///tmp/private", False),
            ("https://example.org/%0aheader", False),
            ("https://user:pass@example.org", False),
        ]:
            with self.subTest(target=target):
                book = fixture()
                book.pages[0].blocks[2].spans = [Span(start=0, end=1, kind="link", target=target)]
                report = build_epub(book, self.root, self.output)
                self.assertTrue(report["export_valid"])
                self.assertEqual(report["validation"]["external_hyperlinks"], int(allowed))
                self.assertEqual(
                    any(i["code"] == "unsafe_external_link" for i in report["issues"]), not allowed
                )

    def test_input_html_is_literal_text(self) -> None:
        book = fixture()
        book.pages[0].blocks[2] = block(
            "body1", '<script>alert("x")</script><img src="file:///x"/>'
        )
        report = build_epub(book, self.root, self.output)
        self.assertTrue(report["validation"]["passed"])
        self.assertIn(b"&lt;script&gt;", self.resources()["EPUB/text/chapter-0001.xhtml"])

    def test_archive_determinism_and_mimetype_position(self) -> None:
        first = build_epub(fixture(), self.root, self.output)
        bytes1 = self.output.read_bytes()
        second = build_epub(fixture(), self.root, self.output)
        self.assertEqual(bytes1, self.output.read_bytes())
        self.assertEqual(first["epub_sha256"], second["epub_sha256"])
        with zipfile.ZipFile(self.output) as archive:
            info = archive.infolist()[0]
            self.assertEqual(info.filename, "mimetype")
            self.assertEqual(info.compress_type, zipfile.ZIP_STORED)
            self.assertEqual(archive.read(info), b"application/epub+zip")

    def test_source_isbn_and_reprint_are_not_generated_identifier_or_date(self) -> None:
        build_epub(fixture(), self.root, self.output)
        package = ET.fromstring(self.resources()["EPUB/package.opf"])
        dc = "{http://purl.org/dc/elements/1.1/}"
        identifiers = [n.text for n in package.iter(dc + "identifier")]
        self.assertEqual(len(identifiers), 1)
        self.assertTrue(identifiers[0].startswith("urn:sha256:"))
        self.assertEqual(list(package.iter(dc + "date")), [])
        self.assertIn("0710005784", next(package.iter(dc + "source")).text)
        self.assertIn("1980", next(package.iter(dc + "source")).text)
        self.assertIn("A. Translator", [n.text for n in package.iter(dc + "contributor")])

    def test_package_and_container_support_unprefixed_importers_without_losing_namespaces(
        self,
    ) -> None:
        build_epub(fixture(), self.root, self.output)
        resources = self.resources()
        container_namespace = "urn:oasis:names:tc:opendocument:xmlns:container"
        opf_namespace = "http://www.idpf.org/2007/opf"
        dc_namespace = "http://purl.org/dc/elements/1.1/"

        # AVA's importer looks up literal names, so valid prefixed XML also needs
        # this compatibility check beyond a namespace-aware EPUB validator.
        with minidom.parseString(resources["META-INF/container.xml"]) as container:
            self.assertEqual(container.documentElement.tagName, "container")
            self.assertEqual(container.documentElement.getAttribute("xmlns"), container_namespace)
            self.assertEqual(len(container.getElementsByTagName("rootfiles")), 1)
            rootfiles = container.getElementsByTagName("rootfile")
            self.assertEqual(len(rootfiles), 1)
            self.assertEqual(rootfiles[0].getAttribute("full-path"), "EPUB/package.opf")

        with minidom.parseString(resources["EPUB/package.opf"]) as package:
            self.assertEqual(package.documentElement.tagName, "package")
            self.assertEqual(package.documentElement.getAttribute("xmlns"), opf_namespace)
            for name in ("metadata", "manifest", "spine"):
                self.assertEqual(len(package.getElementsByTagName(name)), 1)
            self.assertGreater(len(package.getElementsByTagName("item")), 0)
            self.assertEqual(len(package.getElementsByTagName("itemref")), 3)
            self.assertEqual(len(package.getElementsByTagName("dc:title")), 1)

        container_tree = ET.fromstring(resources["META-INF/container.xml"])
        self.assertEqual(container_tree.tag, f"{{{container_namespace}}}container")
        self.assertIsNotNone(
            container_tree.find(
                f"{{{container_namespace}}}rootfiles/{{{container_namespace}}}rootfile"
            )
        )
        package_tree = ET.fromstring(resources["EPUB/package.opf"])
        self.assertEqual(package_tree.tag, f"{{{opf_namespace}}}package")
        self.assertIsNotNone(
            package_tree.find(f"{{{opf_namespace}}}manifest/{{{opf_namespace}}}item")
        )
        self.assertIsNotNone(
            package_tree.find(f"{{{opf_namespace}}}spine/{{{opf_namespace}}}itemref")
        )
        metadata = package_tree.find(f"{{{opf_namespace}}}metadata")
        assert metadata is not None
        self.assertEqual(metadata.findtext(f"{{{dc_namespace}}}title"), "Homo & Ludens")
        self.assertEqual(metadata.findtext(f"{{{dc_namespace}}}creator"), "J. Huizinga")
        identifier = metadata.find(f"{{{dc_namespace}}}identifier")
        assert identifier is not None
        self.assertEqual(identifier.get("id"), package_tree.get("unique-identifier"))
        self.assertEqual(ET.fromstring(resources["EPUB/nav.xhtml"]).tag, f"{{{XHTML}}}html")

    def add_asset(self, book: Book, path: str = "figure.png") -> Asset:
        Image.new("RGB", (20, 30), "white").save(self.root / "figure.png")
        data = (self.root / "figure.png").read_bytes()
        asset = Asset(
            id="picture",
            path=path,
            sha256=hashlib.sha256(data).hexdigest(),
            media_type="image/png",
            width=20,
            height=30,
            alt="A blank test figure",
            evidence=[Evidence(page=1, method="review")],
        )
        book.assets = [asset]
        book.pages[0].blocks.append(
            block("figure", "Original caption.", "figure", asset_id="picture")
        )
        book.cover_asset_id = "picture"
        return asset

    def test_cover_and_repeated_figure_keep_occurrences_deduplicate_bytes(self) -> None:
        book = fixture()
        asset = self.add_asset(book)
        book.pages[1].blocks.append(
            block("figure2", "A second caption.", "figure", page=2, asset_id="picture")
        )
        report = build_epub(book, self.root, self.output)
        self.assertTrue(report["export_valid"])
        resources = self.resources()
        self.assertEqual(len([name for name in resources if name.startswith("EPUB/images/")]), 1)
        package = ET.fromstring(resources["EPUB/package.opf"])
        cover_items = [n for n in package.iter() if n.get("properties") == "cover-image"]
        self.assertEqual(len(cover_items), 1)
        self.assertIn(asset.sha256, cover_items[0].get("href"))
        self.assertEqual(report["validation"]["canonical_blocks"], 8)

    def test_asset_containment_including_symlinks_hash_and_media(self) -> None:
        for value in ("../figure.png", "/tmp/figure.png", "folder\\figure.png", "C:/figure.png"):
            with self.subTest(path=value):
                book = fixture()
                self.add_asset(book, value)
                with self.assertRaises(ValueError):
                    build_epub(book, self.root, self.output)
        book = fixture()
        asset = self.add_asset(book)
        asset.sha256 = "0" * 64
        with self.assertRaises(ValueError):
            build_epub(book, self.root, self.output)
        book = fixture()
        asset = self.add_asset(book)
        asset.media_type = "image/jpeg"
        with self.assertRaises(ValueError):
            build_epub(book, self.root, self.output)
        with tempfile.TemporaryDirectory() as elsewhere:
            other = Path(elsewhere) / "outside.png"
            other.write_bytes((self.root / "figure.png").read_bytes())
            (self.root / "escape.png").symlink_to(other)
            book = fixture()
            self.add_asset(book, "escape.png")
            with self.assertRaises(ValueError):
                build_epub(book, self.root, self.output)

    def test_failed_asset_does_not_replace_existing_output(self) -> None:
        self.output.write_bytes(b"Existing artifact")
        book = fixture()
        asset = self.add_asset(book)
        asset.width = 21
        with self.assertRaises(ValueError):
            build_epub(book, self.root, self.output)
        self.assertEqual(self.output.read_bytes(), b"Existing artifact")

    def test_blank_page_and_collision_shaped_source_ids(self) -> None:
        book = fixture()
        book.pages.append(Page(number=3, label="", width=600.0, height=800.0, route="blank"))
        book.page_count = 3
        book.pages[0].blocks.append(block("page-1", "ID that resembles a generated anchor"))
        book.pages[0].blocks.append(block("b-706167652d31", "Second distinct ID"))
        report = build_epub(book, self.root, self.output)
        self.assertTrue(report["validation"]["passed"])
        self.assertEqual(report["validation"]["source_page_anchors"], 3)
        self.assertNotEqual(xml_id("b", "page-1"), xml_id("b", "b-706167652d31"))

    def test_metadata_fallback_review_and_invalid_xml_or_modified_rejected(self) -> None:
        book = fixture()
        book.metadata = []
        report = build_epub(book, self.root, self.output)
        self.assertTrue(report["export_valid"])
        self.assertEqual(len([i for i in report["issues"] if i["code"] == "metadata_fallback"]), 3)
        book.metadata = [
            Claim(field="modified", value="not-a-date", scope="conversion", status="accepted")
        ]
        with self.assertRaises(ValueError):
            build_epub(book, self.root, self.output)
        book = fixture()
        book.metadata[0] = book.metadata[0].model_copy(update={"value": "Title\x00bad"})
        with self.assertRaises(ValueError):
            build_epub(book, self.root, self.output)

    def test_observed_default_style_overrides_editorial_defaults(self) -> None:
        css, names = compile_styles(
            [
                Style(),
                Style(observed=["indent", "bold", "align"], indent=0.0, bold=False, align="start"),
            ]
        )
        observed = Style(
            observed=["indent", "bold", "align"], indent=0.0, bold=False, align="start"
        )
        name = names[observed.model_dump_json()]
        self.assertIn(f".{name}.{name}", css)
        self.assertIn("text-indent:0em", css)
        self.assertIn("font-weight:normal", css)
        self.assertIn("text-align:start", css)

    def test_source_page_boundary_survives_inside_styled_link_and_joined_paragraph(self) -> None:
        text = "A word continued onto the next source page."
        joined = block(
            "joined",
            text,
            evidence=[Evidence(page=1, method="review"), Evidence(page=2, method="review")],
            spans=[
                Span(start=0, end=len(text), kind="em"),
                Span(start=2, end=16, kind="link", target="https://example.org"),
            ],
            page_breaks=[PageBreak(page=2, offset=7)],
        )
        book = Book(
            source_sha256="b" * 64,
            page_count=2,
            pages=[
                Page(
                    number=1, label="1", width=600.0, height=800.0, route="replay", blocks=[joined]
                ),
                Page(number=2, label="2", width=600.0, height=800.0, route="replay"),
            ],
            chapters=[Chapter(id="body", title="Body", start_block_id="joined", verified=True)],
            metadata=fixture().metadata,
        )
        report = build_epub(book, self.root, self.output)
        self.assertTrue(report["export_valid"])
        self.assertFalse(
            any(issue["code"] == "empty_unverified_page" for issue in report["issues"])
        )
        root = ET.fromstring(self.resources()["EPUB/text/chapter-0001.xhtml"])
        paragraph = next(node for node in root.iter() if node.get("data-canonical") == "joined")
        self.assertEqual("".join(paragraph.itertext()), text)
        parents = {child: parent for parent in paragraph.iter() for child in parent}
        marker = next(node for node in paragraph.iter() if node.get("id") == "page-2")
        self.assertEqual(parents[marker].tag, f"{{{XHTML}}}a")
        cursor = 0
        offsets: dict[str, int] = {}

        def visit(node: ET.Element) -> None:
            nonlocal cursor
            if node.get("id"):
                offsets[node.get("id")] = cursor
            cursor += len(node.text or "")
            for child in node:
                visit(child)
                cursor += len(child.tail or "")

        visit(paragraph)
        self.assertEqual(offsets["page-2"], 7)
        self.assertEqual(report["validation"]["source_page_anchors"], 2)

    def test_validator_finds_missing_fragments_changed_content_and_traversal(self) -> None:
        book = fixture()
        build_epub(book, self.root, self.output)
        resources = self.resources()
        resources["EPUB/text/chapter-0001.xhtml"] = resources[
            "EPUB/text/chapter-0001.xhtml"
        ].replace(b"chapter-0002.xhtml#", b"chapter-0002.xhtml#missing-")
        result = validate_resources(resources)
        self.assertIn("missing_fragment", [error["code"] for error in result["errors"]])
        expected = {b.id: b.text for p in book.pages for b in p.blocks}
        expected["body1"] = "Changed words"
        self.assertIn(
            "text_changed", [e["code"] for e in validate_resources(resources, expected)["errors"]]
        )
        self.assertIsNone(resolve_internal("EPUB/text/a.xhtml", "../../../secret"))
        self.assertIsNone(
            resolve_internal("EPUB/text/a.xhtml", "%2e%2e/%2e%2e/META-INF/container.xml")
        )
        self.assertEqual(
            resolve_internal("EPUB/text/a.xhtml", "../images/figure.png"),
            ("EPUB/images/figure.png", ""),
        )


if __name__ == "__main__":
    unittest.main()
