import io
import unittest
import warnings
import zipfile
from unittest.mock import patch

from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.epub_v2.export import export_epub
from ava_pdf_epub.epub_v2.reimport import reimport_epub

from .helpers import archive_bytes, exported, fixture


class RefusalTests(unittest.TestCase):
    def test_changed_visible_content_or_missing_parts_cannot_hide_behind_sidecar(self):
        book, _, entries, _ = exported()
        chapter = next(name for name in entries if name.startswith("EPUB/text/"))
        cases = [
            (chapter, entries[chapter].replace(b"Harbour", b"ALTERED")),
            (chapter, entries[chapter].replace(b"href=", b"data-broken=")),
            ("EPUB/styles/book.css", b"body{display:none}"),
            ("EPUB/assets/image-one.png", b"broken"),
            ("META-INF/ava-profile", b"unknown"),
            ("EPUB/nav/nav.xhtml", b"<html/>"),
            ("EPUB/package.opf", b"<package/>"),
            ("../escape", b"inert"),
            ("EPUB/remote.html", b'<img src="https://ava-canary.invalid/never"/>'),
        ]
        for name, value in cases:
            with self.subTest(name=name), self.assertRaises(ValueError):
                reimport_epub(archive_bytes({**entries, name: value}), document_digest(book))
        del entries[chapter]
        with self.assertRaises(ValueError):
            reimport_epub(archive_bytes(entries), document_digest(book))

    def test_identity_missing_resource_and_duplicate_entries_fail_closed(self):
        book, data, entries, _ = exported()
        with self.assertRaises(ValueError):
            reimport_epub(data, "f" * 64)
        book, assets, _ = fixture()
        with self.assertRaises(ValueError):
            export_epub(book, {})
        assets["image-one"] = b"bad"
        with self.assertRaises(ValueError):
            export_epub(book, assets)
        duplicate = io.BytesIO(archive_bytes(entries))
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with zipfile.ZipFile(duplicate, "a") as archive:
                archive.writestr("mimetype", b"application/epub+zip")
        with self.assertRaises(ValueError):
            reimport_epub(duplicate.getvalue(), document_digest(book))

    def test_declared_zip_limits_are_enforced_before_content_read(self):
        book, data, _, _ = exported()
        for name in ["MAX_ARCHIVE_BYTES", "MAX_ENTRY_BYTES", "MAX_ENTRIES", "MAX_EXPANDED_BYTES"]:
            with self.subTest(bound=name), patch("ava_pdf_epub.epub_v2.archive." + name, 1):
                with self.assertRaises(ValueError):
                    reimport_epub(data, document_digest(book))

    def test_export_obeys_the_same_entry_and_archive_bounds(self):
        book, assets, _ = fixture()
        for name in ["MAX_ARCHIVE_BYTES", "MAX_ENTRY_BYTES", "MAX_ENTRIES", "MAX_EXPANDED_BYTES"]:
            with self.subTest(bound=name), patch("ava_pdf_epub.epub_v2.export." + name, 1):
                with self.assertRaises(ValueError):
                    export_epub(book, assets)
