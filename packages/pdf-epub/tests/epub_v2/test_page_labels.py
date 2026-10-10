"""Printed labels are display text; physical page IDs remain unique across resets."""

import hashlib
import json
import unittest
import xml.etree.ElementTree as ET

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.epub_v2.conservation import conservation_report
from ava_pdf_epub.epub_v2.export import export_entries, export_epub
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.epub_v2.profiles import LEGACY_PROFILE, PAGE_LABEL_PROFILE
from ava_pdf_epub.epub_v2.xml import EPUB, XHTML

from .helpers import archive_bytes, fixture


def labelled_book(labels):
    book, assets, _ = fixture()
    raw = book.model_dump()
    for page, label in zip(raw["pages"], labels, strict=True):
        page["label"] = label
    return CanonicalBookV2.model_validate(raw), assets


class PageLabelTests(unittest.TestCase):
    def test_printed_roman_and_restarted_labels_keep_unique_resolving_targets(self):
        for labels in [("iv", "1"), ("1", "1"), ("i & <v>", "2")]:
            with self.subTest(labels=labels):
                book, assets = labelled_book(labels)
                entries = export_entries(book, assets)
                root = ET.fromstring(entries["EPUB/nav/nav.xhtml"])
                nav = next(n for n in root.iter() if n.get(f"{{{EPUB}}}type") == "page-list")
                links = list(nav.iter(f"{{{XHTML}}}a"))
                self.assertEqual(list(labels), [n.text for n in links])
                self.assertEqual(2, len({n.get("href") for n in links}))
                for page, link in enumerate(links, 1):
                    path, anchor = link.get("href").split("#")
                    chapter = ET.fromstring(entries["EPUB/" + path.removeprefix("../")])
                    targets = [n for n in chapter.iter() if n.get("id") == anchor]
                    self.assertEqual(1, len(targets))
                    self.assertEqual(f"page-{page}", anchor)
                    self.assertEqual(labels[page - 1], targets[0].get("aria-label"))
                self.assertEqual(PAGE_LABEL_PROFILE.encode(), entries["META-INF/ava-profile"])
                self.assertEqual(PAGE_LABEL_PROFILE, conservation_report(book)["epub_profile"])
                self.assertEqual((book, assets), portable_epub(export_epub(book, assets)))

    def test_missing_printed_label_falls_back_only_for_that_page(self):
        book, assets = labelled_book(("iv", None))
        nav = ET.fromstring(export_entries(book, assets)["EPUB/nav/nav.xhtml"])
        pages = next(n for n in nav.iter() if n.get(f"{{{EPUB}}}type") == "page-list")
        self.assertEqual(["iv", "2"], [n.text for n in pages.iter(f"{{{XHTML}}}a")])

    def test_empty_printed_labels_keep_canonical_value_and_have_named_page_links(self):
        book, assets = labelled_book(("", "  "))
        entries = export_entries(book, assets)
        nav = ET.fromstring(entries["EPUB/nav/nav.xhtml"])
        pages = next(n for n in nav.iter() if n.get(f"{{{EPUB}}}type") == "page-list")
        self.assertEqual(["1", "2"], [n.text for n in pages.iter(f"{{{XHTML}}}a")])
        for link in pages.iter(f"{{{XHTML}}}a"):
            path, fragment = link.get("href").split("#")
            root = ET.fromstring(entries["EPUB/" + path.removeprefix("../")])
            anchor = next(n for n in root.iter() if n.get("id") == fragment)
            self.assertTrue(anchor.get("aria-label"))
        self.assertEqual((book, assets), portable_epub(export_epub(book, assets)))

    def test_legacy_labelled_projection_still_imports_without_rewriting_content(self):
        book, assets = labelled_book(("iv", "1"))
        entries = export_entries(book, assets, profile=LEGACY_PROFILE)
        # Frozen from pre-change b17f5778; the current importer must accept those exact members.
        members = {name: hashlib.sha256(data).hexdigest() for name, data in entries.items()}
        self.assertEqual(
            "56aa4a76969d54a29f33e99267e010b7e249fd227c65e96328458cf039546a91",
            hashlib.sha256(json.dumps(members, sort_keys=True).encode()).hexdigest(),
        )
        data = archive_bytes(entries)
        self.assertEqual((book, assets), portable_epub(data))
        nav = ET.fromstring(entries["EPUB/nav/nav.xhtml"])
        pages = next(n for n in nav.iter() if n.get(f"{{{EPUB}}}type") == "page-list")
        self.assertEqual(["1", "2"], [n.text for n in pages.iter(f"{{{XHTML}}}a")])

    def test_profile_substitution_cannot_hide_changed_visible_labels(self):
        book, assets = labelled_book(("iv", "1"))
        for profile, replacement in [
            (LEGACY_PROFILE, PAGE_LABEL_PROFILE),
            (PAGE_LABEL_PROFILE, LEGACY_PROFILE),
        ]:
            entries = export_entries(book, assets, profile=profile)
            entries["META-INF/ava-profile"] = replacement.encode()
            with self.assertRaisesRegex(ValueError, "conservation mismatch"):
                portable_epub(archive_bytes(entries))

    def test_unknown_projection_is_never_generated_or_accepted(self):
        book, assets = labelled_book((None, None))
        with self.assertRaisesRegex(ValueError, "Unsupported generated EPUB profile"):
            export_entries(book, assets, profile="ava-epub-canonical-future")
        entries = export_entries(book, assets)
        entries["META-INF/ava-profile"] = b"ava-epub-canonical-future"
        with self.assertRaisesRegex(ValueError, "Unsupported generated EPUB profile"):
            portable_epub(archive_bytes(entries))
