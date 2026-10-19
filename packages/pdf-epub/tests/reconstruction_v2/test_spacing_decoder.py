"""Native document/page/text resources are released on success and interrupted extraction."""

import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from ava_pdf_epub.reconstruction_v2.spacing_decoder import spacing_proposals

from .spacing_fixture import spacing_fixture


class SpacingDecoderTests(unittest.TestCase):
    def test_all_handles_close_on_success_and_failure(self):
        line, _ = spacing_fixture()
        observation = SimpleNamespace(number=1, height_pt=300, lines=[line])
        for fails in [False, True]:
            text = MagicMock()
            if fails:
                text.get_text_bounded.side_effect = RuntimeError("native decoder interrupted")
            else:
                text.get_text_bounded.return_value = "exact source text"
            page = MagicMock()
            page.get_textpage.return_value = text
            doc = MagicMock()
            doc.__getitem__.return_value = page
            api = SimpleNamespace(PdfDocument=lambda _, document=doc: document)
            with patch(
                "ava_pdf_epub.reconstruction_v2.spacing_decoder.importlib.import_module",
                return_value=api,
            ):
                if fails:
                    with self.assertRaisesRegex(RuntimeError, "interrupted"):
                        spacing_proposals(Path("source.pdf"), observation)
                else:
                    self.assertEqual(
                        spacing_proposals(Path("source.pdf"), observation), ["exact source text"]
                    )
            self.assertEqual(text.get_text_bounded.call_args.kwargs["errors"], "strict")
            for handle in [text, page, doc]:
                handle.close.assert_called_once()
