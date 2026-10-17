"""Valid tall source references split into smaller same-scale sheets instead of being rejected."""

import unittest
from types import SimpleNamespace

from ava_pdf_epub.reconstruction_v2.refinement_catalogue import RefinementCatalogue
from ava_pdf_epub.reconstruction_v2.refinement_contract import RefinementNode
from ava_pdf_epub.reconstruction_v2.refinement_groups import refinement_groups
from ava_pdf_epub.reconstruction_v2.refinement_sheet_bounds import sheet_fits

from .test_refinement_grouping import segment


class RefinementSheetGroupsTest(unittest.TestCase):
    def test_tall_context_is_split_before_raster_allocation(self):
        nodes, segments, pages = [], {}, {}
        for index in range(24):
            heading, body = f"h{index}", f"p{index}"
            for ident, level in ((heading, 2 if index else 1), (body, None)):
                observed = segment(ident, "Source text", level, index + 1)
                observed = observed.model_copy(
                    update={"box": observed.box.model_copy(update={"y1": 120})}
                )
                segments[ident] = observed
                nodes.append(
                    RefinementNode(
                        id=ident,
                        page=index + 1,
                        kind="heading" if level else "paragraph",
                        text_sha256="a" * 64,
                        text_excerpt="Source text",
                        observed_level=level,
                        observed_chapter=index == 0 and level == 1,
                        observed_role="bodymatter" if level == 1 else None,
                        observed_style=None,
                        ranked_source=False,
                        body_reference_id=body if level else None,
                    )
                )
            pages[index + 1] = SimpleNamespace(
                observation=SimpleNamespace(width_pt=500, height_pt=720)
            )
        catalogue = RefinementCatalogue(nodes, [f"h{i}" for i in range(24)], [])
        initial = refinement_groups(catalogue)

        def fits(ids):
            return sheet_fits(ids, segments, pages)

        self.assertTrue(any(not fits(crops) for _, crops, _ in initial))
        groups = refinement_groups(catalogue, fits)
        self.assertGreater(len(groups), len(initial))
        self.assertTrue(all(fits(crops) for _, crops, _ in groups))
        self.assertEqual(catalogue.decisions, [key for ids, _, _ in groups for key in ids])
