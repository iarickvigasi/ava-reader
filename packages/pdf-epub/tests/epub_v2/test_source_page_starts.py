"""Source-page destinations retain text offsets, link grouping and old projection bytes."""

import hashlib
import json
import unittest
import xml.etree.ElementTree as ET

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.epub_v2.conservation import conservation_report
from ava_pdf_epub.epub_v2.context import ident
from ava_pdf_epub.epub_v2.export import export_entries, export_epub
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.epub_v2.profiles import LEGACY_PROFILE, PAGE_LABEL_PROFILE, SOURCE_PAGE_PROFILE
from ava_pdf_epub.epub_v2.xml import EPUB, XHTML
from tests.reconstruction_v2.page_start_test_fixture import joined_book, one_block_book, rename

from .helpers import FIXTURES, archive_bytes, fixture


def marker_offsets(node):
    offsets = {}
    count = 0

    def visit(element):
        nonlocal count
        if element.get(f"{{{EPUB}}}type") == "pagebreak":
            offsets[element.get("id")] = count
        count += len(element.text or "")
        for child in element:
            visit(child)
            count += len(child.tail or "")

    visit(node)
    return offsets


class SourcePageProjectionTests(unittest.TestCase):
    def test_joined_page_markers_are_at_exact_retained_codepoint_starts(self):
        cases = [
            (["A😀 carries", "é continues", "and ends."], False, " "),
            (["A😀 carries", "é continues", "and ends."], True, "\n"),
            (["будь-", "якому-", "місці"], False, ""),
        ]
        for parts, preserve, separator in cases:
            with self.subTest(separator=separator):
                book, _, _, _ = joined_book(parts, preserve=preserve)
                entries = export_entries(book, {})
                path = next(p for p in entries if p.startswith("EPUB/text/"))
                root = ET.fromstring(entries[path])
                node = next(n for n in root.iter() if n.get("data-ava-text"))
                self.assertEqual(separator.join(parts), "".join(node.itertext()))
                self.assertEqual(
                    {
                        f"page-{i + 1}": len(separator.join(parts[:i]))
                        + (len(separator) if i else 0)
                        for i in range(len(parts))
                    },
                    marker_offsets(node),
                )
                ids = [n.get("id") for n in root.iter() if n.get("id")]
                self.assertEqual(len(ids), len(set(ids)))
                self.assertEqual(SOURCE_PAGE_PROFILE.encode(), entries["META-INF/ava-profile"])
                self.assertEqual((book, {}), portable_epub(export_epub(book, {})))
                report = conservation_report(book)
                page_mappings = [
                    a
                    for a in report["source_addresses"]
                    if a["source_fragment"].startswith("ava-source-page-")
                ]
                self.assertEqual(
                    ["page-1", "page-2", "page-3"], [a["epub_fragment"] for a in page_mappings]
                )
                for mapped in page_mappings:
                    self.assertEqual(path, mapped["epub_resource"])

    def test_page_list_keeps_physical_order_and_printed_label_resets(self):
        book, _, _, _ = joined_book(["Alpha carries", "the light onward", "and home."])
        raw = book.model_dump()
        for page, label in zip(raw["pages"], ["iv", "1", "1"], strict=True):
            page["label"] = label
        book = CanonicalBookV2.model_validate(raw)
        entries = export_entries(book, {})
        nav = ET.fromstring(entries["EPUB/nav/nav.xhtml"])
        listing = next(n for n in nav.iter() if n.get(f"{{{EPUB}}}type") == "page-list")
        links = list(listing.iter(f"{{{XHTML}}}a"))
        self.assertEqual(["iv", "1", "1"], [a.text for a in links])
        self.assertEqual(
            ["page-1", "page-2", "page-3"], [a.get("href").split("#")[1] for a in links]
        )
        for link, label in zip(links, ["iv", "1", "1"], strict=True):
            path, fragment = link.get("href").split("#")
            chapter = ET.fromstring(entries["EPUB/" + path.removeprefix("../")])
            targets = [n for n in chapter.iter() if n.get("id") == fragment]
            self.assertEqual(1, len(targets))
            self.assertEqual(label, targets[0].get("aria-label"))

    def test_page_marker_inside_one_semantic_link_keeps_one_focusable_anchor(self):
        book, _, _, _ = joined_book(["Alpha carries", "the light onward", "and home."])
        raw = book.model_dump()
        text = raw["blocks"][0]["content"]["text"]
        raw["blocks"][0]["content"]["spans"] = [
            dict(
                id="cross-page-reference",
                start=0,
                end=len(text),
                link=dict(kind="external", url="https://example.invalid/reference"),
            )
        ]
        raw["addresses"].append(
            dict(
                resource_path="text/source.xhtml",
                fragment="cross-page-reference",
                target=dict(kind="internal", chapter_id="chapter", block_id="part-0", offset=0),
            )
        )
        book = CanonicalBookV2.model_validate(raw)
        entries = export_entries(book, {})
        root = ET.fromstring(
            next(data for path, data in entries.items() if path.startswith("EPUB/text/"))
        )
        anchors = list(root.iter(f"{{{XHTML}}}a"))
        self.assertEqual(1, len(anchors))
        self.assertEqual(text, "".join(anchors[0].itertext()))
        self.assertEqual(3, sum(n.get(f"{{{EPUB}}}type") == "pagebreak" for n in anchors[0].iter()))
        self.assertEqual((book, {}), portable_epub(export_epub(book, {})))

    def test_compound_and_nontext_starts_are_inside_list_items_or_before_owned_blocks(self):
        source, assets, _ = fixture()
        for kind in ["list_item", "table", "figure", "separator"]:
            with self.subTest(kind=kind):
                if kind == "separator":
                    raw = joined_book(["An authored separator."])[0].model_dump()
                    node = raw["blocks"][0]
                    raw["blocks"] = [
                        dict(
                            id=node["id"],
                            kind="separator",
                            style_id=None,
                            evidence=node["evidence"],
                        )
                    ]
                    book = CanonicalBookV2.model_validate(raw)
                else:
                    book = one_block_book(source, kind)
                owned_assets = assets if kind == "figure" else {}
                entries = export_entries(book, owned_assets)
                root = ET.fromstring(
                    next(data for path, data in entries.items() if path.startswith("EPUB/text/"))
                )
                marker = next(n for n in root.iter() if n.get("id") == "page-1")
                parents = {child: parent for parent in root.iter() for child in parent}
                if kind == "list_item":
                    self.assertEqual(
                        ident("b", book.blocks[0].id), parents[parents[marker]].get("id")
                    )
                else:
                    siblings = list(parents[marker])
                    self.assertEqual(
                        ident("b", book.blocks[0].id),
                        siblings[siblings.index(marker) + 1].get("id"),
                    )
                self.assertEqual(
                    (book, owned_assets), portable_epub(export_epub(book, owned_assets))
                )

    def test_blank_and_furniture_pages_have_no_borrowed_destination(self):
        for role in ["blank", "furniture"]:
            book, _, _, _ = joined_book(["Alpha carries", "the light onward"])
            raw = book.model_dump()
            raw["source"]["page_count"] = 3
            raw["pages"].append(
                dict(
                    number=3,
                    width_pt=300,
                    height_pt=300,
                    original_rotation=0,
                    regions=[
                        dict(
                            id="no-retained-content",
                            band=0,
                            column=0,
                            role=role,
                            route="blank",
                            box=dict(
                                coordinate_space="page_points_top_left", x0=0, y0=0, x1=300, y1=300
                            ),
                        )
                    ],
                )
            )
            book = CanonicalBookV2.model_validate(raw)
            entries = export_entries(book, {})
            self.assertFalse(
                any(b"page-3" in data for path, data in entries.items() if path.endswith(".xhtml"))
            )
            self.assertEqual((book, {}), portable_epub(export_epub(book, {})))

    def test_projection_downgrade_or_upgrade_cannot_change_page_address_semantics(self):
        book, _, _, _ = joined_book(["Alpha carries", "the light onward"])
        for profile in [LEGACY_PROFILE, PAGE_LABEL_PROFILE]:
            with self.subTest(profile=profile), self.assertRaisesRegex(ValueError, "semantics"):
                export_entries(book, {}, profile=profile)
            entries = export_entries(book, {})
            entries["META-INF/ava-profile"] = profile.encode()
            with self.assertRaises(ValueError):
                portable_epub(archive_bytes(entries))
        legacy, assets, _ = fixture()
        with self.assertRaisesRegex(ValueError, "semantics"):
            export_entries(legacy, assets, profile=SOURCE_PAGE_PROFILE)

    def test_frozen_legacy_projection_members_and_canonical_digests_are_unchanged(self):
        frozen = json.loads((FIXTURES / "legacy-page-projections.json").read_bytes())["cases"]
        for name, expected in frozen.items():
            book, assets, _ = fixture()
            raw = book.model_dump()
            if name == "unlabelled":
                for page in raw["pages"]:
                    page["label"] = None
            elif name == "labelled":
                for page, label in zip(raw["pages"], ["i", "1"], strict=True):
                    page["label"] = label
            if expected["rename_from"]:
                raw = rename(raw, expected["rename_from"], "ava-source-page-1")
            book = CanonicalBookV2.model_validate(raw)
            entries = export_entries(book, assets)
            with self.subTest(name=name):
                self.assertEqual(expected["canonical_sha256"], document_digest(book))
                self.assertEqual(expected["profile"].encode(), entries["META-INF/ava-profile"])
                self.assertEqual(
                    expected["entries"],
                    {
                        path: {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
                        for path, data in entries.items()
                    },
                )
                self.assertEqual((book, assets), portable_epub(archive_bytes(entries)))
