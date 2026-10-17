import unittest

from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.epub_v2.reader import prepare_reader

from .helpers import archive_bytes, exported


class PortableTests(unittest.TestCase):
    def test_import_mints_distinct_identity_without_changing_semantic_content(self):
        expected, data, _, _ = exported()
        book, assets = portable_epub(data)
        first = prepare_reader(book, "epub-import-first")
        second = prepare_reader(book, "epub-import-second")
        self.assertEqual(book, expected)
        self.assertEqual(first.book, second.book)
        self.assertEqual(first.canonical_sha256, document_digest(expected))
        self.assertNotEqual(first.final_content_id, second.final_content_id)
        self.assertEqual(set(assets), {r.id for r in expected.resources})

    def test_declared_profile_never_accepts_changed_visible_projection(self):
        _, _, original, _ = exported()
        paths = [p for p in original if p.endswith((".xhtml", ".css", ".png"))]
        self.assertGreater(len(paths), 3)
        for path in paths:
            with self.subTest(path=path):
                changed = dict(original)
                changed[path] += b"tampered"
                with self.assertRaises(ValueError):
                    portable_epub(archive_bytes(changed))

    def test_missing_profile_or_sidecar_and_traversal_refused(self):
        _, _, original, _ = exported()
        for path in ("META-INF/ava-profile", "EPUB/ava-canonical.json"):
            changed = dict(original)
            del changed[path]
            with self.assertRaises(ValueError):
                portable_epub(archive_bytes(changed))
        changed = {**original, "../escape": b"unsafe"}
        with self.assertRaises(ValueError):
            portable_epub(archive_bytes(changed))
