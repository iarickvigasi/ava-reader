"""Rendering-view reuse is bound to source bytes, policy and output bytes."""

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pypdf import PdfReader
from pypdf.generic import ArrayObject, NameObject

from ava_pdf_epub.annotation_view import annotation_view

from .appearance_fixture import BODY, EDITORIAL, annotated_document, passive_document
from .helpers import save


class AnnotationViewCache(unittest.TestCase):
    def test_cached_view_does_not_reparse_the_source(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = save(annotated_document("/Text"), directory)
            first = annotation_view(source, scratch)
            with patch(
                "ava_pdf_epub.annotation_view.PdfReader", side_effect=AssertionError("parse")
            ):
                self.assertEqual(first, annotation_view(source, scratch))

    def test_changed_source_same_path_never_reuses_the_old_view(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = save(annotated_document("/Text"), directory)
            first = annotation_view(source, scratch)
            document = annotated_document("/Text")
            document.add_metadata({"/Title": "Different source"})
            document.write(source)
            self.assertNotEqual(first, annotation_view(source, scratch))

    def test_corrupt_output_is_not_reused(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = save(annotated_document("/Text"), directory)
            output = annotation_view(source, scratch)
            output.write_bytes(b"corrupt")
            with self.assertRaisesRegex(ValueError, "PDF_ANNOTATION_VIEW_CACHE_INVALID"):
                annotation_view(source, scratch)

    def test_word_view_excludes_only_inline_objects_and_preserves_source(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            document = passive_document("/StrikeOut")
            editorial = annotated_document().pages[0]["/Annots"][0].get_object()
            document.pages[0][NameObject("/Annots")] = ArrayObject(
                [*document.pages[0]["/Annots"], document._add_object(editorial.clone(document))]
            )
            source = save(document, directory)
            before = source.read_bytes()
            normal = annotation_view(source, scratch)
            words = annotation_view(source, scratch, exclude_inline=True)
            self.assertNotEqual(normal, words)
            self.assertEqual(before, source.read_bytes())
            reader = PdfReader(words)
            kept = [ref.get_object() for ref in reader.pages[0]["/Annots"]]
            self.assertEqual(["/FreeText"], [item["/Subtype"] for item in kept])
            self.assertEqual(EDITORIAL, kept[0]["/Contents"])
            self.assertEqual(BODY, reader.pages[0].extract_text())
            with patch(
                "ava_pdf_epub.annotation_view.PdfReader", side_effect=AssertionError("parse")
            ):
                self.assertEqual(words, annotation_view(source, scratch, exclude_inline=True))

    def test_word_view_cache_cannot_reuse_normal_view_or_corrupt_output(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = save(passive_document("/Underline"), directory)
            self.assertEqual(source, annotation_view(source, scratch))
            words = annotation_view(source, scratch, exclude_inline=True)
            self.assertFalse(PdfReader(words).pages[0].get("/Annots"))
            words.write_bytes(b"corrupt")
            with self.assertRaisesRegex(ValueError, "PDF_ANNOTATION_VIEW_CACHE_INVALID"):
                annotation_view(source, scratch, exclude_inline=True)
            self.assertEqual(source, annotation_view(source, scratch))
