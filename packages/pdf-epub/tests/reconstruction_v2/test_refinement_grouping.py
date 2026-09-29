"""Large catalogues use bounded context; explicit numbered parents establish nesting."""

import unittest

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.refinement_catalogue import (
    RefinementCatalogue,
    refinement_catalogue,
)
from ava_pdf_epub.reconstruction_v2.refinement_contract import RefinementNode
from ava_pdf_epub.reconstruction_v2.refinement_graph import validate_refined_graph
from ava_pdf_epub.reconstruction_v2.refinement_groups import refinement_groups
from ava_pdf_epub.reconstruction_v2.segments import Segment


def segment(ident, text, level=None, page=1):
    return Segment.model_validate(
        dict(
            id=ident,
            page=page,
            method="ocr",
            text=text,
            kind="heading" if level else "paragraph",
            heading_level=level,
            chapter_start=level == 1,
            chapter_role="bodymatter" if level == 1 else None,
            box=dict(coordinate_space="page_points_top_left", x0=10, y0=20, x1=200, y1=40),
        )
    )


class RefinementGroupingTest(unittest.TestCase):
    def test_sixty_headings_do_not_require_sixty_crops_in_every_task(self):
        nodes = [
            RefinementNode(
                id=f"h{i}",
                page=i + 1,
                kind="heading",
                text_sha256="a" * 64,
                text_excerpt=f"Heading {i}",
                observed_level=2 if i else 1,
                observed_chapter=i == 0,
                observed_role="bodymatter" if i == 0 else None,
                observed_style=None,
                ranked_source=False,
                body_reference_id=None,
            )
            for i in range(60)
        ]
        groups = refinement_groups(RefinementCatalogue(nodes, [n.id for n in nodes], []))
        self.assertEqual([n.id for n in nodes], [n for group in groups for n in group[0]])
        self.assertTrue(all(len(group[1]) <= 48 for group in groups))
        self.assertTrue(all("h0" in group[1] for group in groups))

    def test_prose_boundary_is_selected_without_any_heading(self):
        left, right = (
            segment("left", "Before the page turns"),
            segment("right", "the prose continues.", page=2),
        )
        state = AssemblyState(placements={"left": (1, 0, 0), "right": (2, 0, 0)})
        catalogue = refinement_catalogue([left, right], state)
        self.assertEqual(["left", "right"], catalogue.decisions)
        self.assertEqual(1, len(catalogue.edges))

    def test_numbered_chapter_and_sections_use_observed_parent_not_blanket_offset(self):
        values = [
            segment("one", "Chapter 1 River", 1),
            segment("two", "1.1 Channels", 2),
            segment("three", "1.1.1 The eastern channel", 3),
        ]
        validate_refined_graph(values, {"one": None, "two": "one", "three": "two"})
        wrong = [*values[:2], values[2].model_copy(update={"heading_level": 2})]
        with self.assertRaisesRegex(ValueError, "numbered parent"):
            validate_refined_graph(wrong, {"one": None, "two": "one", "three": "one"})
