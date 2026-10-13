"""Zero-OCR pages still receive sparse decisions and serialize valid canonical EPUB content."""

import io
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from pydantic import ValidationError

from ava_pdf_epub.reconstruction_v2.protocol import reconstruction_input
from ava_pdf_epub.reconstruction_v2.reconstruct_source import reconstruct_source
from ava_pdf_epub.reconstruction_v2.word_wrap_prepare import prepare_word_wrap_source

from .word_wrap_pdf_fixture import authored_wrap_answers, input5, wrapped_document


class WordWrapPdfPipelineTests(unittest.TestCase):
    def test_real_extraction_to_epub_covers_zero_ocr_pages(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = wrapped_document(root / "source.pdf")
            request = input5(source)
            batch = prepare_word_wrap_source(source, root / "scratch", request)
            self.assertEqual(len(batch.entries), 3)
            self.assertEqual(len(batch.tasks), 1)
            request = request.model_copy(
                update={"word_wrap_responses": authored_wrap_answers(batch)}
            )
            result, report = reconstruct_source(source, root / "scratch", request)
            self.assertEqual(report.recognition_task_count, 0)
            self.assertEqual(len(result.book.pages), 3)
            texts = [b.content.text for b in result.book.blocks if hasattr(b, "content")]
            self.assertEqual(sum("stream of information." in text for text in texts), 3)
            self.assertFalse(any("informa- tion" in text for text in texts))
            with ZipFile(io.BytesIO(result.epub)) as epub:
                self.assertEqual(epub.read("mimetype"), b"application/epub+zip")
                html = b"".join(epub.read(n) for n in epub.namelist() if n.endswith(".xhtml"))
                self.assertIn(b"information.", html)
            self.assertEqual(len(report.refinement_evidence), 0)

    def test_missing_sparse_receipts_fail_and_old_versions_cannot_borrow_authority(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = wrapped_document(root / "source.pdf")
            request = input5(source)
            with self.assertRaisesRegex(ValueError, "response coverage differs"):
                reconstruct_source(source, root / "scratch", request)
            for version in range(1, 5):
                with self.subTest(version=version), self.assertRaises(ValidationError):
                    reconstruction_input(
                        {
                            **request.model_dump(),
                            "schema_version": f"ava-reconstruct-input-{version}",
                        }
                    )
