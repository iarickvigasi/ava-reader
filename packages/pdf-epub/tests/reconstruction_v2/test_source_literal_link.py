import unittest

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan
from ava_pdf_epub.reconstruction_v2.source_literal_link import source_literal_link

from .test_refinement_grouping import segment


class SourceLiteralLink(unittest.TestCase):
    def test_source_range_does_not_extend_observed_style(self):
        observed = ObservedSpan(
            start=0,
            end=14,
            url="https://www.example.org",
            style=Style(id="observed-underline", underline=True),
        )
        item = segment("address", "www.example.org").model_copy(update={"spans": [observed]})
        result = source_literal_link(item, 0, 15, "https://www.example.org", [observed])
        self.assertIsNotNone(result)
        self.assertEqual(
            (0, 14, None, observed.style),
            (result[0].start, result[0].end, result[0].url, result[0].style),
        )
        self.assertEqual(
            (0, 15, "https://www.example.org"), (result[1].start, result[1].end, result[1].url)
        )
        self.assertEqual(item.spans, [observed])
        self.assertEqual(item.text, "www.example.org")

    def test_other_targets_ambiguous_labels_and_unproven_ranges_remain_refused(self):
        good = ObservedSpan(start=0, end=14, url="https://www.example.org")
        item = segment("address", "www.example.org").model_copy(update={"spans": [good]})
        for changed, start, end, url, existing in [
            (item, 0, 14, "https://www.example.org", [good]),
            (item, 0, 15, "https://other.example", [good]),
            (item, 0, 15, "https://www.example.org", [good, good]),
            (
                item,
                0,
                15,
                "https://www.example.org",
                [good.model_copy(update={"url": "https://other.example"})],
            ),
            (
                item.model_copy(update={"text": "Visit the publisher"}),
                0,
                19,
                "https://www.example.org",
                [good],
            ),
            (
                item.model_copy(update={"text": "http://www.example.org"}),
                0,
                22,
                "https://www.example.org",
                [good],
            ),
        ]:
            self.assertIsNone(source_literal_link(changed, start, end, url, existing))
