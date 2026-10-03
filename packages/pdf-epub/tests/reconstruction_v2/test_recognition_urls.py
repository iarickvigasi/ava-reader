import unittest

from pydantic import ValidationError

from ava_pdf_epub.reconstruction_v2.recognition_fields import RecognitionSpan


class RecognitionUrls(unittest.TestCase):
    def span(self, url: str) -> RecognitionSpan:
        return RecognitionSpan(start=0, end=19, style=None, note_label=None,
                               target_text=None, url=url)

    def test_printed_www_uses_existing_annotation_policy(self) -> None:
        span = self.span("www.aaronjarrels.com")
        self.assertEqual(span.url, "https://www.aaronjarrels.com")
        self.assertEqual((span.start, span.end), (0, 19))

    def test_explicit_scheme_is_unchanged(self) -> None:
        self.assertEqual(self.span("https://example.org/a").url, "https://example.org/a")

    def test_invalid_bare_addresses_remain_rejected(self) -> None:
        for url in ["www.a", "www..example.org", "www.example.org@evil.test",
                    "www.example.org\\evil", "www.example.org x"]:
            with self.subTest(url=url), self.assertRaises(ValidationError):
                self.span(url)
