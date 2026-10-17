import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts import CanonicalBookV2

from .helpers import block, fixture


class SourceOrderTests(unittest.TestCase):
    def test_reversed_region_labels_geometry_and_canonical_stream_fail(self):
        for mutation in ["labels", "geometry", "canonical"]:
            book = fixture()
            if mutation == "labels":
                book["pages"][0]["regions"].reverse()
            elif mutation == "geometry":
                a, b = book["pages"][0]["regions"]
                a["box"], b["box"] = b["box"], a["box"]
            else:
                ids = book["chapters"][0]["block_ids"]
                ids[0], ids[2] = ids[2], ids[0]
                book["blocks"][0], book["blocks"][2] = book["blocks"][2], book["blocks"][0]
                for address in book["addresses"]:
                    if address["fragment"] == "chapter-one":
                        address["target"]["block_id"] = "caption-one"
            with self.subTest(mutation=mutation), self.assertRaises(ValidationError):
                CanonicalBookV2.model_validate(book)

    def test_metadata_cannot_cover_a_missing_content_region(self):
        book = fixture()
        page = book["pages"][1]
        page["regions"].append(
            {
                "id": "missing-content",
                "box": {
                    "coordinate_space": "page_points_top_left",
                    "x0": 20,
                    "y0": 760,
                    "x1": 580,
                    "y1": 790,
                },
                "band": 1,
                "column": 0,
                "role": "content",
                "route": "native",
            }
        )
        evidence = {
            "page": 2,
            "region_id": "missing-content",
            "method": "native",
            "box": page["regions"][-1]["box"],
        }
        book["metadata"].append(
            {
                "id": "pretend",
                "field": "description",
                "value": "Omitted paragraph",
                "status": "candidate",
                "scope": "source_edition",
                "origin": "source",
                "evidence": [evidence],
            }
        )
        with self.assertRaisesRegex(ValidationError, "no content evidence"):
            CanonicalBookV2.model_validate(book)

    def test_evidence_must_be_in_its_real_region_and_pages_complete(self):
        for bad in ["unknown", "box", "page"]:
            book = fixture()
            if bad == "unknown":
                block(book, "body-one")["evidence"][0]["region_id"] = "missing"
            elif bad == "box":
                block(book, "body-one")["evidence"][0]["box"]["x1"] = 590
            else:
                book["pages"].pop()
            with self.subTest(bad=bad), self.assertRaises(ValidationError):
                CanonicalBookV2.model_validate(book)

    def test_nested_child_after_parent_next_sibling_fails(self):
        book = fixture()
        a = book["chapters"][0]["block_ids"].index("list-child")
        b = a + 1
        book["blocks"][a], book["blocks"][b] = book["blocks"][b], book["blocks"][a]
        ids = book["chapters"][0]["block_ids"]
        ids[a], ids[b] = ids[b], ids[a]
        with self.assertRaisesRegex(ValidationError, "sibling boundaries"):
            CanonicalBookV2.model_validate(book)
