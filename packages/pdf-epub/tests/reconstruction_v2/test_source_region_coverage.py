"""Coverage unions preserve independent owners and strict page/column boundaries."""

import copy
import unittest

from ava_pdf_epub.contracts.source import SourcePage
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.source_region_coverage import source_region_coverage

from .test_reading_order_artwork import item


def fixture(bounds, *, route="native", columns=None, bands=None):
    state = AssemblyState(source_continuation_policy=POLICY)
    regions = []
    for index, rectangle in enumerate(bounds):
        segment = item(f"owner-{index}", "paragraph", rectangle).model_copy(
            update={"page": 2, "method": route}
        )
        band = bands[index] if bands else index
        column = columns[index] if columns else 0
        region = dict(
            id=f"region-{index}",
            box=segment.box.model_dump(),
            band=band,
            column=column,
            role="content",
            route=route,
        )
        regions.append(region)
        state.segments[segment.id] = segment
        state.placements[segment.id] = (2, band, column)
        state.evidence[segment.id] = [
            dict(page=2, region_id=region["id"], box=segment.box.model_dump(), method=route)
        ]
    page = dict(number=2, width_pt=400, height_pt=600, original_rotation=0, regions=regions)
    return [page], state


class SourceRegionCoverageTests(unittest.TestCase):
    def test_same_row_fragments_keep_every_owner_box_and_semantic_position(self):
        pages, state = fixture([(36, 56, 47, 76), (68, 56, 262, 76), (68, 80, 160, 100)])
        original = copy.deepcopy(pages)
        owners, positions = copy.deepcopy(state.segments), copy.deepcopy(state.placements)
        evidence = copy.deepcopy(state.evidence)
        with self.assertRaisesRegex(ValueError, "Content bands overlap"):
            SourcePage.model_validate(pages[0])
        result = source_region_coverage(pages, state)
        checked = SourcePage.model_validate(result[0])
        self.assertEqual([r.id for r in checked.regions], ["region-0", "region-2"])
        self.assertEqual(
            (36, 56, 262, 76),
            tuple(getattr(checked.regions[0].box, k) for k in ("x0", "y0", "x1", "y1")),
        )
        self.assertEqual(original, pages)
        self.assertEqual(owners, state.segments)
        self.assertEqual(positions, state.placements)
        for ident in evidence:
            self.assertEqual(evidence[ident][0]["box"], state.evidence[ident][0]["box"])
            self.assertEqual(evidence[ident][0]["method"], state.evidence[ident][0]["method"])
        self.assertEqual("region-0", state.evidence["owner-1"][0]["region_id"])
        self.assertEqual(result, source_region_coverage(result, state))
        self.assertEqual(1, len(state.structure_findings))

    def test_ocr_envelopes_with_real_columns_keep_the_gutter(self):
        pages, state = fixture(
            [(36, 142, 112, 169), (36, 161, 130, 180), (177, 142, 245, 152)],
            route="ocr",
            columns=[1, 1, 2],
            bands=[0, 0, 0],
        )
        checked = SourcePage.model_validate(source_region_coverage(pages, state)[0])
        self.assertEqual([1, 2], [r.column for r in checked.regions])
        self.assertLess(checked.regions[0].box.x1, checked.regions[1].box.x0)
        self.assertEqual((2, 0, 1), state.placements["owner-1"])

    def test_connected_envelopes_join_transitively_without_touching_next_row(self):
        pages, state = fixture(
            [(20, 10, 80, 40), (90, 20, 150, 30), (100, 35, 180, 50), (20, 50, 180, 70)],
            route="ocr",
        )
        checked = SourcePage.model_validate(source_region_coverage(pages, state)[0])
        self.assertEqual(["region-0", "region-3"], [r.id for r in checked.regions])
        self.assertEqual(50, checked.regions[0].box.y1)

    def test_missing_or_foreign_membership_and_nontext_keep_the_original_refusal(self):
        for change in ("missing", "method", "box", "figure", "unknown", "mixed_route"):
            with self.subTest(change=change):
                pages, state = fixture([(20, 10, 80, 30), (90, 10, 150, 30)])
                if change == "missing":
                    del state.evidence["owner-1"]
                elif change == "method":
                    state.evidence["owner-1"][0]["method"] = "ocr"
                elif change == "box":
                    state.evidence["owner-1"][0]["box"]["x1"] = 151
                elif change == "unknown":
                    del state.segments["owner-1"]
                elif change == "figure":
                    state.segments["owner-1"] = state.segments["owner-1"].model_copy(
                        update={"kind": "figure"}
                    )
                else:
                    pages[0]["regions"][1]["route"] = "ocr"
                before = copy.deepcopy(state.evidence)
                result = source_region_coverage(pages, state)
                self.assertEqual(pages, result)
                self.assertEqual(before, state.evidence)
                with self.assertRaises(ValueError):
                    SourcePage.model_validate(result[0])

    def test_invalid_gutter_or_page_boundary_cannot_commit_a_partial_repair(self):
        for change in ("gutter", "outside"):
            with self.subTest(change=change):
                pages, state = fixture(
                    [(20, 10, 180, 40), (20, 30, 210, 50), (200, 10, 380, 50)],
                    columns=[1, 1, 2],
                    bands=[0, 0, 0],
                )
                if change == "outside":
                    pages[0]["width_pt"] = 300
                before = copy.deepcopy(state.evidence)
                with self.assertRaises(ValueError):
                    source_region_coverage(pages, state)
                self.assertEqual(before, state.evidence)
                self.assertEqual([], state.structure_findings)

    def test_historical_policy_cover_and_reversed_geometry_are_not_broadened(self):
        for change in ("historical", "cover", "reversed", "band", "band_order"):
            with self.subTest(change=change):
                pages, state = fixture([(20, 10, 80, 30), (90, 10, 150, 30)])
                if change == "historical":
                    state.source_continuation_policy = None
                elif change == "cover":
                    pages[0]["number"] = 1
                elif change == "reversed":
                    pages[0]["regions"].reverse()
                    pages[0]["regions"][0]["box"]["y0"] = 12
                elif change == "band_order":
                    for r, band in zip(pages[0]["regions"], (1, 0), strict=True):
                        r["band"] = band
                else:
                    for r in pages[0]["regions"]:
                        r["column"] = 1
                before = copy.deepcopy(state.evidence)
                result = source_region_coverage(pages, state)
                self.assertEqual(pages, result)
                self.assertEqual(before, state.evidence)
                with self.assertRaises(ValueError):
                    SourcePage.model_validate(result[0])

    def test_disjoint_valid_page_remains_exact(self):
        pages, state = fixture([(20, 10, 180, 30), (20, 30, 180, 50)])
        before = copy.deepcopy(state.evidence)
        result = source_region_coverage(pages, state)
        self.assertEqual(pages, result)
        self.assertEqual(before, state.evidence)
        self.assertEqual([], state.structure_findings)
        SourcePage.model_validate(result[0])

    def test_compound_heading_and_source_page_start_keep_exact_first_component(self):
        from ava_pdf_epub.reconstruction_v2.source_page_starts import capture_page_starts

        pages, state = fixture([(36, 56, 47, 76), (68, 56, 262, 76)])
        first, second = state.segments.values()
        compound = first.model_copy(
            update={"text": first.text + "\n" + second.text, "kind": "heading"}
        )
        state.compound_heading_sources[first.id] = (first, second)
        state.segments[first.id] = compound
        state.evidence[first.id] += copy.deepcopy(state.evidence[second.id])
        result = source_region_coverage(pages, state)
        SourcePage.model_validate(result[0])
        start = capture_page_starts([compound], state)[2]
        self.assertEqual(
            (first.id, first.text, "region-0"), (start.segment_id, start.text, start.region_id)
        )
        self.assertEqual(2, len(state.evidence[first.id]))

    def test_native_hyphen_catalogue_retains_unique_lines_and_separate_owners(self):
        from ava_pdf_epub.contracts.styles import Style
        from ava_pdf_epub.reconstruction_v2.observations import NativeLine
        from ava_pdf_epub.reconstruction_v2.word_wrap_owners import catalogue_owners

        from .test_word_wrap_catalogue import prepare
        from .word_wrap_fixture_pages import word_wrap_fixture_pages

        pages, state = fixture([(20, 10, 30, 20), (40, 10, 180, 40)])
        first, body = state.segments.values()
        first = first.model_copy(
            update={"text": "1", "source_text": "1", "native_line_ids": ["p2-heading"]}
        )
        body = body.model_copy(
            update={
                "text": "trans- formation",
                "source_text": "trans-\nformation",
                "native_line_ids": ["p2-left", "p2-right"],
            }
        )
        state.segments.update({first.id: first, body.id: body})
        lines = [
            NativeLine(id="p2-heading", text="1", box=first.box, glyphs=[], style=Style(id="body")),
            NativeLine(
                id="p2-left",
                text="trans-",
                box=body.box.model_copy(update={"y1": 20}),
                glyphs=[],
                style=Style(id="body"),
            ),
            NativeLine(
                id="p2-right",
                text="formation",
                box=body.box.model_copy(update={"y0": 30}),
                glyphs=[],
                style=Style(id="body"),
            ),
        ]
        observations, _ = word_wrap_fixture_pages(lines, [2])
        observations = [observations[0].model_copy(update={"width_pt": 400, "height_pt": 600})]
        checked = SourcePage.model_validate(source_region_coverage(pages, state)[0])
        owners = catalogue_owners([first, body], observations, [checked], {}, "en")
        self.assertEqual([first.id, body.id], [owner.id for owner in owners])
        self.assertEqual(
            [["p2-heading"], ["p2-left", "p2-right"]],
            [[line.line_id for line in owner.lines] for owner in owners],
        )
        batch = prepare(owners, observations)
        self.assertEqual(1, len(batch.entries))
        self.assertEqual("line", batch.entries[0].candidate.boundary)
        self.assertEqual(body.id, batch.entries[0].owner_id)
