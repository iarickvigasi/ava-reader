"""Cover artwork may overlap text, but cannot weaken source reading order or ownership."""

import unittest

from ava_pdf_epub.contracts.book import CanonicalBookV2
from tests.epub_v2.helpers import fixture


def source_layer():
    book, assets, _ = fixture()
    raw = book.model_dump(mode="json")
    cover = next(r for r in raw["resources"] if r["id"] == raw["cover_resource_id"])
    region = dict(raw["pages"][0]["regions"][0])
    region.update(id="cover-layer", role="cover", route="render")
    raw["pages"][0]["regions"].append(region)
    cover["evidence"].append(
        dict(page=1, region_id="cover-layer", method="render", box=region["box"])
    )
    return raw, assets


class CoverLayerTests(unittest.TestCase):
    def test_cover_can_overlap_text_while_reading_regions_and_text_are_unchanged(self):
        raw, _ = source_layer()
        got = CanonicalBookV2.model_validate(raw)
        baseline, _, _ = fixture()
        self.assertEqual(baseline.blocks, got.blocks)
        self.assertEqual(baseline.pages[0].regions, got.pages[0].regions[:-1])

    def test_cover_layer_requires_the_identified_cover_and_render_route(self):
        for field in ("cover", "route", "duplicate"):
            raw, _ = source_layer()
            if field == "cover":
                raw["cover_resource_id"] = None
            elif field == "route":
                raw["pages"][0]["regions"][-1]["route"] = "ocr"
            else:
                extra = {**raw["pages"][0]["regions"][-1], "id": "other-cover"}
                raw["pages"][0]["regions"].append(extra)
            with self.subTest(field=field), self.assertRaises(ValueError):
                CanonicalBookV2.model_validate(raw)

    def test_content_band_overlap_is_still_refused(self):
        raw, _ = source_layer()
        raw["pages"][0]["regions"][-1]["role"] = "content"
        with self.assertRaises(ValueError):
            CanonicalBookV2.model_validate(raw)
