import unittest

from ava_pdf_epub.reconstruction_v2.literal_url_anchor import anchor_literal_url


class LiteralUrlAnchor(unittest.TestCase):
    def raw(self, text="www.example.org", **changes):
        return dict(
            text=text,
            spans=[
                dict(
                    start=0,
                    end=999,
                    style=None,
                    note_label=None,
                    target_text=None,
                    url="http://www.example.org",
                    **changes,
                )
            ],
        )

    def test_exact_plain_address_owns_offsets_and_scheme(self):
        raw = self.raw("  www.example.org  ")
        anchored = anchor_literal_url(raw)
        self.assertEqual(anchored["text"], raw["text"])
        self.assertEqual(anchored["spans"][0]["start"], 2)
        self.assertEqual(anchored["spans"][0]["end"], 17)
        self.assertEqual(anchored["spans"][0]["url"], "https://www.example.org")
        self.assertEqual(raw["spans"][0]["end"], 999)
        self.assertEqual(anchor_literal_url(anchored), anchored)

    def test_unrelated_target_cannot_reanchor(self):
        raw = self.raw()
        raw["spans"][0]["url"] = "https://evil.example"
        self.assertEqual(anchor_literal_url(raw), raw)

    def test_ambiguity_and_independent_style_are_not_repaired(self):
        cases = [self.raw("See www.example.org"), self.raw("www.example.org www.example.org")]
        for key, value in [
            ("style", {"id": "emphasis", "italic": True}),
            ("note_label", "1"),
            ("target_text", "Chapter 1"),
        ]:
            raw = self.raw()
            raw["spans"][0][key] = value
            cases.append(raw)
        for raw in cases:
            self.assertEqual(anchor_literal_url(raw), raw)

    def test_explicit_source_scheme_is_preserved(self):
        raw = self.raw("http://www.example.org")
        self.assertEqual(anchor_literal_url(raw)["spans"][0]["url"], "http://www.example.org")

    def test_invalid_wire_offset_types_and_bounds_stay_invalid(self):
        for key, value in [("start", True), ("start", -1), ("end", "21"), ("end", 200001)]:
            raw = self.raw()
            raw["spans"][0][key] = value
            self.assertEqual(anchor_literal_url(raw), raw)

    def test_exact_styled_address_preserves_typography_when_resolving_scheme(self):
        style = {"id": "observed-link", "underline": True, "color": "#fbb03b"}
        raw = self.raw()
        raw["spans"][0].update(end=15, style=style)
        anchored = anchor_literal_url(raw)
        self.assertEqual(anchored["spans"][0]["url"], "https://www.example.org")
        self.assertEqual(anchored["spans"][0]["style"], style)
        self.assertEqual(anchored["spans"][0]["start"], 0)
        self.assertEqual(anchored["spans"][0]["end"], 15)
        self.assertEqual(anchored["text"], raw["text"])
        self.assertEqual(anchor_literal_url(anchored), anchored)
        explicit = self.raw("http://www.example.org")
        explicit["spans"][0].update(end=22, style=style)
        self.assertEqual(anchor_literal_url(explicit), explicit)
