import hashlib
import json
import unittest
from contextlib import ExitStack
from unittest.mock import Mock, patch

from ava_pdf_epub.runtime import import_epub


class ImportCapacityTests(unittest.TestCase):
    def fixtures(self, stack, verdict=None):
        data = b"test EPUB bytes"
        request = json.dumps(
            {"source_sha256": hashlib.sha256(data).hexdigest(), "final_content_id": "test-import"}
        ).encode()
        events = []
        stack.enter_context(patch.object(import_epub, "snapshot", side_effect=[data, request]))
        stack.enter_context(patch.object(import_epub.Path, "mkdir"))
        stack.enter_context(patch.object(import_epub.Path, "write_bytes"))
        stack.enter_context(
            patch.object(
                import_epub, "epubcheck", side_effect=lambda *a, **k: events.append("epubcheck")
            )
        )
        stack.enter_context(
            patch.object(import_epub, "epub_verdict", return_value=verdict or (0, 0))
        )
        book = Mock(resources=[])
        book.model_dump_json.return_value = "{}"
        reader = Mock(required_capabilities=["text"])
        reader.model_dump_json.return_value = "{}"
        portable = stack.enter_context(
            patch.object(
                import_epub,
                "portable_epub",
                side_effect=lambda _: (events.append("portable") or book, {}),
            )
        )
        stack.enter_context(patch.object(import_epub, "prepare_reader", return_value=reader))
        stack.enter_context(patch.object(import_epub, "document_digest", return_value="a" * 64))
        stack.enter_context(patch.object(import_epub, "artifact_records", return_value=iter([])))
        return events, portable

    def test_package_validation_finishes_before_expanding_book_models(self):
        with ExitStack() as stack:
            events, _ = self.fixtures(stack)
            import_epub.main()
            self.assertEqual(events, ["epubcheck", "portable"])

    def test_invalid_package_never_loads_expanded_canonical_book(self):
        with ExitStack() as stack:
            events, portable = self.fixtures(stack)
            stack.enter_context(
                patch.object(import_epub, "epub_verdict", side_effect=import_epub.InvalidEpub())
            )
            stack.enter_context(patch.object(import_epub, "fail", side_effect=SystemExit(1)))
            with self.assertRaises(SystemExit):
                import_epub.main()
            self.assertEqual(events, ["epubcheck"])
            portable.assert_not_called()
