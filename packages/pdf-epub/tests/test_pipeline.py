import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.io import atomic_write, contained_file
from ava_pdf_epub.models import Block, Book, Chapter, Claim, Evidence, Page, Style
from ava_pdf_epub.pipeline import run_conversion
from ava_pdf_epub.review import BlockEdit, Review, apply_review
from ava_pdf_epub.state import ConflictError


def fixture():
    return Book(
        source_sha256="a" * 64,
        page_count=1,
        pages=[
            Page(
                number=1,
                width=300.0,
                height=400.0,
                route="native",
                blocks=[
                    Block(
                        id="h1",
                        kind="heading",
                        text="Chapter One",
                        evidence=[Evidence(page=1, method="native")],
                    ),
                    Block(
                        id="b1",
                        kind="paragraph",
                        text="An original test book.",
                        evidence=[Evidence(page=1, method="native")],
                    ),
                ],
            )
        ],
        chapters=[Chapter(id="chapter1", title="Chapter One", start_block_id="h1", verified=True)],
        metadata=[
            Claim(field="title", value="Worker fixture", status="accepted"),
            Claim(field="language", value="en", status="accepted"),
        ],
    )


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "input.json"
        self.source.write_text(fixture().model_dump_json())
        self.options = dict(
            source=self.source,
            work_dir=self.root / "work",
            owner="alice",
            request_key="book-1",
            mode="book",
        )

    def test_actual_build_idempotency_and_truthful_readiness(self):
        first = run_conversion(**self.options)
        self.assertTrue(first["assembly"]["export_valid"])
        self.assertEqual(first["new_api_cost_usd"], 0)
        self.assertEqual(first["checks"]["epubcheck"]["status"], "not_run")
        self.assertFalse(first["readiness"]["production_ready"])
        with patch("ava_pdf_epub.epub.build_epub", side_effect=AssertionError("must reuse")):
            again = run_conversion(**self.options)
        self.assertTrue(again["reused"])
        self.assertEqual(first["epub_sha256"], again["epub_sha256"])

    def test_changed_input_cannot_reuse_request_key(self):
        run_conversion(**self.options)
        book = fixture()
        book.metadata[0].value = "Changed title"
        self.source.write_text(book.model_dump_json())
        with self.assertRaises(ConflictError):
            run_conversion(**self.options)

    def test_corrupted_output_is_not_reported_as_valid_reuse(self):
        first = run_conversion(**self.options)
        Path(first["epub_path"]).write_bytes(b"corrupt")
        with self.assertRaisesRegex(ValueError, "changed after completion"):
            run_conversion(**self.options)

    def test_resume_preserves_book_checkpoint_and_bounded_failures(self):
        with patch(
            "ava_pdf_epub.epub.build_epub", side_effect=RuntimeError("injected exporter failure")
        ):
            for _ in range(3):
                with self.assertRaisesRegex(RuntimeError, "injected"):
                    run_conversion(**self.options)
        with self.assertRaisesRegex(RuntimeError, "exhausted three"):
            run_conversion(**self.options)
        books = list((self.root / "work" / "jobs").glob("*/attempt-*/book.json"))
        self.assertEqual(len(books), 1, "Resume must not reconstruct checkpointed text")

    def test_resume_after_transient_export_failure(self):
        with patch("ava_pdf_epub.epub.build_epub", side_effect=RuntimeError("injected")):
            with self.assertRaises(RuntimeError):
                run_conversion(**self.options)
        result = run_conversion(**self.options)
        self.assertTrue(result["assembly"]["export_valid"])
        self.assertIn("attempt-2", result["epub_path"])


class ReviewTests(unittest.TestCase):
    def test_review_is_revision_bound_and_does_not_rewrite_text(self):
        book = fixture()
        review = Review(
            source_sha256=book.source_sha256,
            expected_book_sha256=hashlib.sha256(book.model_dump_json().encode()).hexdigest(),
            reviewer="test-editor",
            block_edits=[
                BlockEdit(
                    block_id="b1",
                    expected_text_sha256=hashlib.sha256(b"An original test book.").hexdigest(),
                    style=Style(italic=True, observed=["italic"]),
                )
            ],
        )
        changed = apply_review(book, review)
        self.assertEqual(changed.pages[0].blocks[1].text, book.pages[0].blocks[1].text)
        self.assertTrue(changed.pages[0].blocks[1].style.italic)
        self.assertFalse(book.pages[0].blocks[1].style.italic)
        with self.assertRaisesRegex(ValueError, "different book revision"):
            apply_review(changed, review)

    def test_asset_path_containment_and_atomic_writes(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            atomic_write(root / "image.png", b"one")
            atomic_write(root / "image.png", b"two")
            self.assertEqual(contained_file(root, "image.png").read_bytes(), b"two")
            with self.assertRaises(ValueError):
                contained_file(root, "../outside.png")
            (root / "outside-link").symlink_to("/etc/hosts")
            with self.assertRaises(ValueError):
                contained_file(root, "outside-link")


if __name__ == "__main__":
    unittest.main()
