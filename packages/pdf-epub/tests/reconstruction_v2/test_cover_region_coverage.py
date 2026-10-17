"""Cover coverage keeps exact owners; body/column/historical guards remain closed."""

import copy
import unittest

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.contracts.source import SourcePage
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.cover_region_coverage import cover_region_coverage
from ava_pdf_epub.reconstruction_v2.observations import Graphic
from ava_pdf_epub.reconstruction_v2.reading_order import reading_order

from .test_ocr_font_faces import checkpoint
from .test_pdf_links import box, observation
from .test_reading_order_artwork import item


def fixture():
    segments = [
        item("title", "heading", (24, 300, 310, 512)),
        item("art", "figure", (228, 314, 296, 380)),
        item("credit", "credit", (42, 364, 110, 377)),
        item("subtitle", "heading", (34, 424, 309, 440)),
    ]
    observed = observation().model_copy(
        update={
            "width_pt": 346.0,
            "height_pt": 600.0,
            "graphics": [Graphic(kind="image", box=box(0, 0, 346, 600))],
        }
    )
    placements = reading_order(segments, 346)
    state = AssemblyState(
        source_title_policy="ava-frontmatter-title-1", source_continuation_policy=POLICY
    )
    state.frontmatter_title_compared = True
    state.frontmatter_cover = [(s.id, text_digest(s.text)) for s in segments if s.kind == "heading"]
    regions = []
    for index, placed in enumerate(placements):
        segment = placed.segment
        region = {
            "id": f"page1-region{index}",
            "box": segment.box.model_dump(),
            "band": placed.band,
            "column": placed.column,
            "role": "content",
            "route": segment.method,
        }
        regions.append(region)
        state.evidence[segment.id] = [
            {
                "page": 1,
                "region_id": region["id"],
                "box": segment.box.model_dump(),
                "method": segment.method,
            }
        ]
        state.placements[segment.id] = (1, placed.band, placed.column)
    page = {
        "number": 1,
        "width_pt": 346.0,
        "height_pt": 600.0,
        "original_rotation": 0,
        "regions": regions,
    }
    return [page], segments, [checkpoint(observed)], state


class CoverRegionCoverageTest(unittest.TestCase):
    def test_existing_artwork_arrangement_passes_the_real_page_contract(self):
        pages, segments, prepared, state = fixture()
        before = copy.deepcopy(pages)
        owners = [s.model_dump() for s in segments]
        evidence = copy.deepcopy(state.evidence)
        placements = copy.deepcopy(state.placements)
        with self.assertRaisesRegex(ValueError, "Content bands overlap"):
            SourcePage.model_validate(pages[0])
        result = cover_region_coverage(pages, segments, prepared, state)
        validated = SourcePage.model_validate(result[0])
        self.assertEqual(1, len(validated.regions))
        region = validated.regions[0]
        self.assertEqual(
            ("content", "ocr", 0, 0), (region.role, region.route, region.band, region.column)
        )
        self.assertEqual(box(24, 300, 310, 512), region.box)
        self.assertEqual(before, pages)
        self.assertEqual(owners, [s.model_dump() for s in segments])
        for ident, local in state.evidence.items():
            self.assertEqual(
                evidence[ident],
                [{**e, "region_id": evidence[ident][0]["region_id"]} for e in local],
            )
            self.assertEqual([region.id], [e["region_id"] for e in local])
        self.assertEqual(placements, state.placements)
        self.assertEqual(
            "SOURCE_COVER_OVERLAP_COVERAGE_COALESCED", state.structure_findings[0].code
        )

    def test_missing_comparison_policy_or_cover_art_leaves_original_refusal(self):
        for change in (
            "historical",
            "no_title_policy",
            "not_compared",
            "no_cover",
            "no_art",
            "ambiguous_art",
            "small_art",
        ):
            with self.subTest(change=change):
                pages, segments, prepared, state = fixture()
                if change == "historical":
                    state.source_continuation_policy = None
                elif change == "no_title_policy":
                    state.source_title_policy = None
                elif change == "not_compared":
                    state.frontmatter_title_compared = False
                elif change == "no_cover":
                    state.frontmatter_cover = []
                else:
                    page = prepared[0].observation
                    graphics = (
                        []
                        if change == "no_art"
                        else page.graphics * 2
                        if change == "ambiguous_art"
                        else [Graphic(kind="image", box=box(0, 0, 100, 100))]
                    )
                    prepared = [checkpoint(page.model_copy(update={"graphics": graphics}))]
                before = copy.deepcopy(state.evidence)
                result = cover_region_coverage(pages, segments, prepared, state)
                self.assertIs(pages, result)
                self.assertEqual(before, state.evidence)
                with self.assertRaisesRegex(ValueError, "Content bands overlap"):
                    SourcePage.model_validate(result[0])

    def test_compared_heading_text_and_page_must_still_match(self):
        for change in ("text", "page", "kind", "missing", "evidence"):
            with self.subTest(change=change):
                pages, segments, prepared, state = fixture()
                if change == "missing":
                    segments = segments[1:]
                elif change == "evidence":
                    state.evidence["title"][0]["page"] = 2
                else:
                    values = (
                        {"text": "changed"}
                        if change == "text"
                        else ({"page": 2} if change == "page" else {"kind": "paragraph"})
                    )
                    segments[0] = segments[0].model_copy(update=values)
                with self.assertRaisesRegex(ValueError, "Cover coverage"):
                    cover_region_coverage(pages, segments, prepared, state)

    def test_columns_mixed_routes_and_uncompared_overlaps_are_not_hidden(self):
        for change in ("columns", "mixed_routes", "uncompared"):
            with self.subTest(change=change):
                pages, segments, prepared, state = fixture()
                if change == "columns":
                    pages[0]["regions"][0]["column"] = 1
                elif change == "mixed_routes":
                    pages[0]["regions"][1]["route"] = "native"
                else:
                    state.frontmatter_cover = [("other", text_digest("other"))]
                    other = item("other", "heading", (20, 20, 200, 40))
                    segments.append(other)
                    region = {
                        "id": "other",
                        "box": other.box.model_dump(),
                        "band": 0,
                        "column": 0,
                        "role": "content",
                        "route": "ocr",
                    }
                    pages[0]["regions"].insert(0, region)
                    for old in pages[0]["regions"][1:]:
                        old["band"] += 1
                    state.evidence["other"] = [
                        {
                            "page": 1,
                            "region_id": "other",
                            "method": "ocr",
                            "box": other.box.model_dump(),
                        }
                    ]
                result = cover_region_coverage(pages, segments, prepared, state)
                self.assertIs(pages, result)

    def test_later_page_is_not_changed(self):
        pages, segments, prepared, state = fixture()
        later = copy.deepcopy(pages[0])
        later["number"] = 2
        pages.append(later)
        result = cover_region_coverage(pages, segments, prepared, state)
        self.assertEqual(later, result[1])
        with self.assertRaisesRegex(ValueError, "Content bands overlap"):
            SourcePage.model_validate(result[1])
