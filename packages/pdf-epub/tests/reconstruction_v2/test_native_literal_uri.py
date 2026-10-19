"""A PDF URI may corroborate its own literal boundary, never an arbitrary link label."""

import unittest
from dataclasses import replace
from unittest.mock import patch

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, NumberObject, TextStringObject

from ava_pdf_epub.pdf_navigation import NavigationTarget
from ava_pdf_epub.reconstruction_v2.annotation_words import AnnotationWord
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.native_caller_context import native_caller_ranges
from ava_pdf_epub.reconstruction_v2.native_literal_uri import raw_literal_uri
from ava_pdf_epub.reconstruction_v2.pdf_links import apply_pdf_links

from . import test_native_caller_context as fixtures
from .test_native_caller_context import rectangle


class NativeLiteralUriTests(unittest.TestCase):
    def fixture(self):
        uri = "http://a.b"
        root, source, page, owner, _ = fixtures.NativeCallerContextTests.fixture(self, uri + ";")
        caller = rectangle(10, 22, 69, 32)
        word = AnnotationWord((1, 1, 1), 1, uri + ";", 97, rectangle(11, 23, 71, 30))
        return uri, root, source, page, owner, caller, word

    def test_exact_uri_corroborates_prefix_without_linking_or_removing_semicolon(self):
        uri, root, _, page, owner, caller, word = self.fixture()
        evidence = []
        with patch(
            "ava_pdf_epub.reconstruction_v2.native_caller_context.recognize_native_line_words",
            return_value=[word],
        ):
            with self.assertRaises(ValueError):
                native_caller_ranges(
                    page.observation, [owner], caller, root, page.profile_id, None, {}
                )
            actual = native_caller_ranges(
                page.observation,
                [owner],
                caller,
                root,
                page.profile_id,
                None,
                {},
                literal_uri=uri,
                findings=evidence,
            )
        self.assertEqual([(owner.id, 8, 18)], actual)
        self.assertEqual("Before. http://a.b;", owner.text)
        self.assertEqual(";", owner.text[actual[0][2]])
        self.assertEqual(["PDF_LINK_LITERAL_URI_CORROBORATED"], [f.code for f in evidence])

    def test_annotation_path_requires_unmodified_absolute_http_uri(self):
        uri, root, source, page, owner, caller, word = self.fixture()
        writer = PdfWriter()
        writer.clone_document_from_reader(PdfReader(source))
        annotation = writer.pages[0]["/Annots"][0].get_object()
        annotation["/A"][NameObject("/URI")] = TextStringObject(uri)
        annotation[NameObject("/Rect")] = ArrayObject([NumberObject(v) for v in (10, 68, 69, 78)])
        changed = root / "literal.pdf"
        writer.write(changed)
        state = AssemblyState()
        with patch(
            "ava_pdf_epub.reconstruction_v2.native_caller_context.recognize_native_line_words",
            return_value=[word],
        ):
            result = apply_pdf_links(changed, [page], [owner], state, root)
        self.assertEqual([(8, 18, uri)], [(s.start, s.end, s.url) for s in result[0].spans])
        self.assertEqual(owner.style, result[0].style)
        for raw, target in (
            ("www.a.b", NavigationTarget(url="https://www.a.b", derived_scheme=True)),
            ("/a", NavigationTarget(url="https://a.b/a")),
            (uri, NavigationTarget(url="https://a.b")),
            ("mailto:a@b.c", NavigationTarget(url="mailto:a@b.c")),
        ):
            with self.subTest(raw=raw):
                action = DictionaryObject(
                    {
                        NameObject("/S"): NameObject("/URI"),
                        NameObject("/URI"): TextStringObject(raw),
                    }
                )
                self.assertIsNone(raw_literal_uri({"/A": action}, target))

    def test_literal_proof_does_not_override_earlier_geometry_text_or_visibility_failures(self):
        uri, root, _, page, owner, caller, word = self.fixture()
        for target, observed, rectangle_, source_page in (
            ("https://a.b", word, caller, page.observation),
            ("http://a", word, caller, page.observation),
            (uri, word, rectangle(10, 22, 70.2, 32), page.observation),
            (uri, replace(word, confidence=84), caller, page.observation),
            (uri, replace(word, visible=False), caller, page.observation),
            (uri, replace(word, text=uri + ","), caller, page.observation),
            (uri, replace(word, box=rectangle(11, 23, 80, 30)), caller, page.observation),
            (uri, word, rectangle(10, 22, 64, 32), page.observation),
            (uri, word, caller, page.observation.model_copy(update={"risks": ["clipped_glyph"]})),
        ):
            with (
                self.subTest(target=target, word=observed),
                patch(
                    "ava_pdf_epub.reconstruction_v2.native_caller_context.recognize_native_line_words",
                    return_value=[observed],
                ),
                self.assertRaises(ValueError),
            ):
                native_caller_ranges(
                    source_page,
                    [owner],
                    rectangle_,
                    root,
                    page.profile_id,
                    None,
                    {},
                    literal_uri=target,
                )
