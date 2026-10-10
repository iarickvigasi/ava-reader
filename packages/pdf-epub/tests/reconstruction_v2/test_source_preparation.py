"""Preparation reuse preserves source decisions and retires private parser resources."""

import hashlib
import io
import json
import os
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import pdfplumber
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject

from ava_pdf_epub.admission_actions import AdmissionError
from ava_pdf_epub.annotation_view import annotation_view
from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE, LEGACY_PROFILE
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_from_source, prepare_page
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.source_preparation import SourcePreparation
from tests.admission.appearance_fixture import annotated_document, passive_document

from .test_ocr_font_faces import checkpoint
from .test_pdf_links import observation

FIXTURES = Path(__file__).parent / "fixtures"
MODULE = "ava_pdf_epub.reconstruction_v2.source_preparation"


class SourcePreparationTests(unittest.TestCase):
    def test_native_scan_mixed_ukrainian_annotations_and_table_records_match(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            mixed = root / "mixed.pdf"
            with PdfWriter() as writer:
                writer.add_page(PdfReader(FIXTURES / "native.pdf").pages[0])
                writer.add_page(PdfReader(FIXTURES / "two-column-scan.pdf").pages[0])
                writer.write(mixed)
            annotations = root / "annotations.pdf"
            passive_document("/Highlight").write(annotations)
            personal = root / "personal.pdf"
            annotated_document("/Text").write(personal)
            for index, (source, profile) in enumerate(
                [
                    (FIXTURES / "native.pdf", LEGACY_PROFILE),
                    (FIXTURES / "two-column-scan.pdf", LEGACY_PROFILE),
                    (mixed, LEGACY_PROFILE),
                    (FIXTURES / "uk-native.pdf", BILINGUAL_PROFILE),
                    (annotations, LEGACY_PROFILE),
                    (personal, LEGACY_PROFILE),
                    (FIXTURES / "table-captions-native.pdf", LEGACY_PROFILE),
                ]
            ):
                with self.subTest(source=source.name):
                    single, shared = root / f"single{index}", root / f"shared{index}"
                    single.mkdir()
                    digest = hashlib.sha256(source.read_bytes()).hexdigest()
                    expected = [
                        prepare_page(source, single, number, profile)
                        for number in range(1, len(PdfReader(source).pages) + 1)
                    ]
                    actual = prepare_source(source, shared, digest, profile)
                    self.assertEqual(expected, list(actual))
                    for page in actual:
                        relative = page.observation.render_path
                        self.assertEqual(
                            (single / relative).read_bytes(), (shared / relative).read_bytes()
                        )

    def test_native_final_book_epub_and_assets_match_independent_page_preparation(self):
        source = FIXTURES / "uk-native.pdf"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            single, shared = root / "single", root / "shared"
            single.mkdir()
            expected = [prepare_page(source, single, n, BILINGUAL_PROFILE) for n in (1, 2, 3)]
            actual = prepare_source(
                source, shared, hashlib.sha256(source.read_bytes()).hexdigest(), BILINGUAL_PROFILE
            )
            self.assertEqual(
                reconstruct(source, single, expected, []), reconstruct(source, shared, actual, [])
            )

    def test_later_unsafe_annotation_refuses_before_render_or_first_task(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "unsafe.pdf"
            document = annotated_document("/Redact")
            document.pages[1][NameObject("/Annots")] = document.pages[0]["/Annots"]
            del document.pages[0][NameObject("/Annots")]
            document.write(source)
            findings = []
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            for action in (
                lambda: prepare_page(source, root, 1),
                lambda: prepare_source(source, root, digest),
            ):
                with patch("ava_pdf_epub.reconstruction_v2.prepare_page.observe_page") as render:
                    with self.assertRaises(AdmissionError) as caught:
                        action()
                    findings.append(caught.exception.refusal())
                    render.assert_not_called()
            self.assertEqual(findings[0], findings[1])
            self.assertEqual("PDF_REDACTION_UNSUPPORTED", findings[0]["code"])
            self.assertEqual(2, findings[0]["finding"]["page_number"])

    def test_changed_source_with_restored_mtime_refuses_and_closes_context(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.pdf"
            source.write_bytes((FIXTURES / "native.pdf").read_bytes())
            with SourcePreparation(source, root, LEGACY_PROFILE) as preparation:
                prepare_from_source(preparation, 1)
                before = source.stat()
                source.write_bytes(source.read_bytes().replace(b"/Creator", b"/Creatoz", 1))
                os.utime(source, ns=(before.st_atime_ns, before.st_mtime_ns))
                with self.assertRaisesRegex(ValueError, "source identity changed"):
                    prepare_from_source(preparation, 2)
                with self.assertRaisesRegex(ValueError, "closed"):
                    prepare_from_source(preparation, 2)

    def test_changed_private_view_refuses_before_reuse(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.pdf"
            annotated_document("/Text").write(source)
            with SourcePreparation(source, root, LEGACY_PROFILE) as preparation:
                with preparation.page(1) as parsed:
                    view = parsed.view
                self.assertNotEqual(source, view)
                view.write_bytes(view.read_bytes() + b"\n")
                with self.assertRaisesRegex(ValueError, "PDF_ANNOTATION_VIEW_CACHE_INVALID"):
                    prepare_from_source(preparation, 2)

    def test_source_identity_page_bounds_and_profile_remain_enforced(self):
        source = FIXTURES / "native.pdf"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaisesRegex(ValueError, "source identity differs"):
                prepare_source(source, root, "0" * 64)
            with self.assertRaises(ValueError):
                prepare_page(source, root, 1, "unsupported-profile")
            with patch(f"{MODULE}.annotation_view") as view:
                with self.assertRaisesRegex(ValueError, "Page is outside source"):
                    prepare_page(source, root, 9)
                view.assert_not_called()

    def test_encryption_and_page_count_refuse_before_annotation_view(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for encrypted in (False, True):
                source = root / "source.pdf"
                with PdfWriter() as writer:
                    for _ in range(1 if encrypted else 501):
                        writer.add_blank_page(width=100, height=100)
                    if encrypted:
                        writer.encrypt("private-fixture-password")
                    writer.write(source)
                with patch(f"{MODULE}.annotation_view") as view:
                    with self.assertRaisesRegex(ValueError, "encrypted or page bound"):
                        prepare_page(source, root, 1)
                    view.assert_not_called()

    def test_two_page_parser_windows_reduce_source_reads_and_opens(self):
        source = FIXTURES / "native.pdf"
        original_read = Path.read_bytes
        source_reads = []

        def read(path):
            if path == source:
                source_reads.append(path)
            return original_read(path)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            with (
                patch.object(Path, "read_bytes", read),
                patch(f"{MODULE}.PdfReader", wraps=PdfReader) as readers,
                patch(f"{MODULE}.pdfplumber.open", wraps=pdfplumber.open) as documents,
                patch(f"{MODULE}.annotation_view", wraps=annotation_view) as views,
                patch(f"{MODULE}.gc.collect") as collect,
            ):
                stored = prepare_source(source, root, digest)
            self.assertEqual(8, len(stored))
            self.assertEqual(2, len(source_reads))  # Source identity plus initial view identity.
            self.assertEqual(4, readers.call_count)
            self.assertEqual(1, views.call_count)
            self.assertEqual(4, collect.call_count)
            self.assertEqual(
                [[1, 2], [3, 4], [5, 6], [7, 8]],
                [call.kwargs["pages"] for call in documents.call_args_list],
            )

    def test_parser_streams_close_after_success_and_page_failure(self):
        source = FIXTURES / "native.pdf"
        original_open = pdfplumber.open
        for fail in (False, True):
            with self.subTest(fail=fail), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                readers, documents = [], []

                def reader(*args, records=readers, **kwargs):
                    result = PdfReader(*args, **kwargs)
                    records.append(result)
                    return result

                def document(*args, records=documents, **kwargs):
                    result = original_open(*args, **kwargs)
                    records.append(result)
                    return result

                with (
                    patch(f"{MODULE}.PdfReader", reader),
                    patch(f"{MODULE}.pdfplumber.open", document),
                ):
                    if fail:
                        with (
                            patch(
                                "ava_pdf_epub.reconstruction_v2.prepare_page.observe_page",
                                side_effect=ValueError("render failed"),
                            ),
                            self.assertRaisesRegex(ValueError, "render failed"),
                        ):
                            prepare_page(source, root, 1)
                    else:
                        digest = hashlib.sha256(source.read_bytes()).hexdigest()
                        prepare_source(source, root, digest)
                self.assertTrue(readers and documents)
                self.assertTrue(all(item.stream.closed for item in [*readers, *documents]))


class ImmutableEntryTests(unittest.TestCase):
    def invoke(self, request):
        from ava_pdf_epub.reconstruction_v2.__main__ import main

        raw = io.BytesIO()
        output = io.TextIOWrapper(raw, encoding="utf-8", write_through=True)
        prefix = "ava_pdf_epub.reconstruction_v2.__main__"
        source_bytes = b"private-source-fixture"
        result = checkpoint(observation())

        def snapshot(root, name, limit):
            self.assertEqual(Path("/input"), root)
            if name == "reconstruction-request.json":
                self.assertEqual(64 * 1024 * 1024, limit)
                return json.dumps(request).encode()
            self.assertEqual(("source.pdf", 52428800), (name, limit))
            return source_bytes

        code = 0
        with (
            patch.object(Path, "mkdir"),
            patch.object(Path, "write_bytes", side_effect=AssertionError("No source copy")),
            patch(f"{prefix}.Observation", return_value=None),
            patch(f"{prefix}.snapshot", side_effect=snapshot),
            patch(f"{prefix}.observe") as observe,
            patch(f"{prefix}.prepare_page", return_value=result) as prepare,
            redirect_stdout(output),
        ):
            try:
                main()
            except SystemExit as error:
                code = error.code
        return json.loads(raw.getvalue()), code, prepare, observe, source_bytes

    def test_preparation_uses_fixed_readonly_input_and_bounded_snapshot_without_copy(self):
        result, code, prepare, observe, source_bytes = self.invoke(
            {"mode": "prepare", "page_number": 1}
        )
        self.assertEqual(0, code)
        self.assertEqual("ava-prepare-result-1", result["schema_version"])
        prepare.assert_called_once_with(
            Path("/input/source.pdf"), Path("/scratch"), 1, LEGACY_PROFILE
        )
        observe.assert_called_once_with("source_bytes", source_bytes)

    def test_caller_selected_source_path_does_not_enter_preparation(self):
        result, code, prepare, _, _ = self.invoke(
            {"mode": "prepare", "page_number": 1, "source": "/other/private.pdf"}
        )
        self.assertEqual(1, code)
        self.assertEqual("RECONSTRUCTION_REVIEW_REQUIRED", result["code"])
        prepare.assert_not_called()
